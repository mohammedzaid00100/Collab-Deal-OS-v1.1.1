'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, Reply, ArrowDown, Clock, AlertCircle, MoreVertical, Trash2 } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MessageComposer } from './message-composer';
import type { ChatMessage, ConversationMessage, ReplyTarget } from '@/types/messaging';

export interface ConversationThreadProps {
  conversationId: string;
  currentUserId: string;
  otherPartyName: string;
  initialMessages: ConversationMessage[];
  emptyState: {
    title: string;
    description: string;
    iconTheme?: 'blue' | 'indigo';
  };
}

export function ConversationThread({
  conversationId,
  currentUserId,
  otherPartyName,
  initialMessages,
  emptyState,
}: ConversationThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({ ...m, status: 'sent' }))
  );
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [confirmDeleteMessage, setConfirmDeleteMessage] = useState<ChatMessage | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const isRealtimeReadyRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Track latest message timestamp for reconnect delta recovery
  const lastSeenTimestampRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].created_at : null
  );

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    if (!activeMenuMessageId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuMessageId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuMessageId]);

  // Handle ESC key to dismiss delete confirmation dialog
  useEffect(() => {
    if (!confirmDeleteMessage) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConfirmDeleteMessage(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteMessage]);

  // Map of messages for O(1) reply lookup
  const messagesMap = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const msg of messages) {
      map.set(msg.id, msg);
      if (msg.tempId) {
        map.set(msg.tempId, msg);
      }
    }
    return map;
  }, [messages]);

  const scrollToBottom = useCallback((smooth = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Position at bottom on initial mount
  useEffect(() => {
    scrollToBottom(false);
    const frameId = requestAnimationFrame(() => {
      scrollToBottom(false);
    });
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 60);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [conversationId, scrollToBottom]);

  // Handle scroll events to detect if user is near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceToBottom < 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowNewMessageIndicator(false);
    }
  }, []);

  // Handle message deletion locally and clean up active reply if affected
  const handleDeleteMessage = useCallback((deletedId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== deletedId && m.tempId !== deletedId));
    setReplyTarget((curr) => (curr?.id === deletedId ? null : curr));
  }, []);

  // Execute deletion: optimistic local update, realtime broadcast, and database deletion
  const executeDeleteMessage = useCallback(
    async (messageId: string) => {
      handleDeleteMessage(messageId);

      if (messageId.startsWith('temp-')) {
        return;
      }

      // Fast peer notification via Realtime Broadcast
      if (channelRef.current) {
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'delete_message',
            payload: { id: messageId },
          });
        } catch (err) {
          console.warn('[Realtime] Failed to broadcast delete_message:', err);
        }
      }

      // Persist deletion to Supabase (RLS ensures sender_user_id = auth.uid())
      const supabase = createSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase
          .from('conversation_messages')
          .delete()
          .eq('id', messageId);

        if (error) {
          console.error('[Messaging] Failed to delete message from database:', error.message);
        }
      }
    },
    [handleDeleteMessage]
  );

  // Handle incoming realtime message (INSERT / Broadcast / Poll)
  const handleIncomingMessage = useCallback(
    (newRow: ConversationMessage, clientMsgId?: string) => {
      setMessages((prev) => {
        // 1. Deduplicate by permanent ID
        if (prev.some((m) => m.id === newRow.id)) {
          return prev;
        }

        // 2. Deduplicate by clientMsgId / tempId if provided
        if (clientMsgId) {
          const matchIdx = prev.findIndex((m) => m.tempId === clientMsgId || m.id === clientMsgId);
          if (matchIdx !== -1) {
            const updated = [...prev];
            updated[matchIdx] = { ...newRow, status: 'sent' };
            return updated;
          }
        }

        // 3. If it is our own message and we have a matching optimistic item pending
        if (newRow.sender_user_id === currentUserId) {
          const optimisticIndex = prev.findIndex(
            (m) =>
              m.status === 'sending' &&
              m.body === newRow.body &&
              m.reply_to_message_id === newRow.reply_to_message_id
          );
          if (optimisticIndex !== -1) {
            const updated = [...prev];
            updated[optimisticIndex] = {
              ...newRow,
              status: 'sent',
            };
            return updated;
          }
        }

        // 4. Otherwise append the new message
        return [...prev, { ...newRow, status: 'sent' }];
      });

      // Update last seen timestamp
      if (
        !lastSeenTimestampRef.current ||
        new Date(newRow.created_at) > new Date(lastSeenTimestampRef.current)
      ) {
        lastSeenTimestampRef.current = newRow.created_at;
      }

      // Scroll management for incoming messages
      if (newRow.sender_user_id === currentUserId) {
        // Own message confirmed: keep scrolled
        scrollToBottom(true);
      } else {
        // Message from other party: auto-scroll only if already near bottom
        if (isNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        } else {
          setShowNewMessageIndicator(true);
        }
      }
    },
    [currentUserId, scrollToBottom]
  );

  // Delta polling fallback: queries only messages newer than newest created_at in local state
  const fetchDeltaMessages = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const lastTs = lastSeenTimestampRef.current;
      let query = supabase
        .from('conversation_messages')
        .select('id, sender_user_id, body, created_at, reply_to_message_id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (lastTs) {
        query = query.gt('created_at', lastTs);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[Realtime] Delta poll error:', error.message);
        return;
      }

      if (data && data.length > 0) {
        for (const row of data as ConversationMessage[]) {
          handleIncomingMessage(row);
        }
      }
    } catch (err) {
      console.warn('[Realtime] Delta poll exception:', err);
    }
  }, [conversationId, handleIncomingMessage]);

  // Supabase Realtime Subscription & Broadcast Channel
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let isMounted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    async function initChannel() {
      try {
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        if (!isMounted) return;

        if (session?.access_token) {
          await supabase!.realtime.setAuth(session.access_token);
        }
      } catch (err) {
        console.warn('[Realtime] Failed to configure auth:', err);
      }

      if (!isMounted) return;

      const channel = supabase!.channel(`conversation-messages:${conversationId}`, {
        config: {
          broadcast: { ack: true, self: false, replication_ready: true },
        },
      });
      channelRef.current = channel;

      // Listen for system events to detect when postgres_changes extension is active
      channel.on('system', {}, (payload) => {
        console.log('[Realtime] System event:', payload);
        if (
          (payload?.extension === 'postgres_changes' || payload?.extension === 'system') &&
          payload?.status === 'ok'
        ) {
          isRealtimeReadyRef.current = true;
        }
      });

      // Listen for postgres_changes INSERT
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newRow = payload.new as ConversationMessage;
          if (newRow && newRow.id) {
            handleIncomingMessage(newRow);
          }
        }
      );

      // Listen for postgres_changes DELETE
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            handleDeleteMessage(deletedId);
          }
        }
      );

      // Listen for broadcast events
      channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const row = payload as ConversationMessage & { client_msg_id?: string };
        if (row && row.id) {
          handleIncomingMessage(row, row.client_msg_id);
        }
      });

      channel.on('broadcast', { event: 'delete_message' }, ({ payload }) => {
        const { id } = (payload ?? {}) as { id?: string };
        if (id) {
          handleDeleteMessage(id);
        }
      });

      // Subscribe and handle all channel lifecycle states
      channel.subscribe(async (status, err) => {
        console.log(`[Realtime] Subscription status for conversation ${conversationId}:`, status, err ?? '');

        if (status === 'SUBSCRIBED') {
          // Delta recovery upon subscription / reconnect
          await fetchDeltaMessages();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error on conversation:', conversationId, err);
          isRealtimeReadyRef.current = false;
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Channel timed out on conversation:', conversationId, err);
          isRealtimeReadyRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Channel closed on conversation:', conversationId);
          isRealtimeReadyRef.current = false;
        }
      });

      // 1-second fallback delta polling loop when realtime is not yet ready or reconnecting
      pollInterval = setInterval(() => {
        if (!isRealtimeReadyRef.current) {
          void fetchDeltaMessages();
        }
      }, 1000);
    }

    void initChannel();

    // Keep auth token synchronized
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        try {
          await supabase.realtime.setAuth(session.access_token);
        } catch (e) {
          console.warn('[Realtime] Auth refresh error:', e);
        }
      }
    });
    authSubscription = authListener.subscription;

    return () => {
      isMounted = false;
      isRealtimeReadyRef.current = false;
      if (pollInterval) clearInterval(pollInterval);
      if (authSubscription) authSubscription.unsubscribe();
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, fetchDeltaMessages, handleIncomingMessage, handleDeleteMessage]);

  // Optimistic sending handlers
  const handleOptimisticSend = useCallback((optimisticMsg: ChatMessage) => {
    setMessages((prev) => [...prev, optimisticMsg]);
    if (
      !lastSeenTimestampRef.current ||
      new Date(optimisticMsg.created_at) > new Date(lastSeenTimestampRef.current)
    ) {
      lastSeenTimestampRef.current = optimisticMsg.created_at;
    }
    requestAnimationFrame(() => scrollToBottom(true));
    setShowNewMessageIndicator(false);
  }, [scrollToBottom]);

  const handleSendSuccess = useCallback((tempId: string, persistedMsg: ConversationMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId || m.tempId === tempId
          ? { ...persistedMsg, status: 'sent' }
          : m
      )
    );
    if (
      !lastSeenTimestampRef.current ||
      new Date(persistedMsg.created_at) > new Date(lastSeenTimestampRef.current)
    ) {
      lastSeenTimestampRef.current = persistedMsg.created_at;
    }

    // Fast peer delivery via Realtime Broadcast
    if (channelRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: {
            ...persistedMsg,
            client_msg_id: tempId,
          },
        });
      } catch (err) {
        console.warn('[Realtime] Broadcast new_message failed:', err);
      }
    }
  }, []);

  const handleSendError = useCallback((tempId: string, errorMessage: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId || m.tempId === tempId
          ? { ...m, status: 'failed', errorMessage }
          : m
      )
    );
  }, []);

  const handleSelectReply = useCallback((message: ChatMessage) => {
    setReplyTarget({
      id: message.id,
      sender_user_id: message.sender_user_id,
      body: message.body,
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleScrollToRepliedMessage = useCallback((replyId: string) => {
    const el = document.getElementById(`msg-${replyId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#4F46E5]');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-[#4F46E5]');
      }, 1500);
    }
  }, []);

  return (
    <>
      <div className="relative w-full min-w-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="min-h-[420px] max-h-[62vh] overflow-y-auto overflow-x-hidden p-3 sm:p-5"
        >
          {messages.length ? (
            <div className="grid gap-3 w-full min-w-0">
              {messages.map((message) => {
                const own = message.sender_user_id === currentUserId;
                const repliedMsg = message.reply_to_message_id
                  ? messagesMap.get(message.reply_to_message_id)
                  : null;

                return (
                  <div
                    id={`msg-${message.id}`}
                    className={`group flex items-end gap-1.5 sm:gap-2 transition-all w-full min-w-0 ${
                      own ? 'justify-end' : 'justify-start'
                    }`}
                    key={message.id || message.tempId}
                  >
                    {/* Actions menu on left for sender's own messages */}
                    {own ? (
                      <div className="relative mb-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuMessageId((curr) =>
                              curr === message.id ? null : message.id
                            )
                          }
                          className={`flex size-8 shrink-0 items-center justify-center rounded p-1 text-[#5A5870] transition-opacity hover:bg-black/5 hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:bg-white/10 dark:hover:text-[#F3F4F8] ${
                            activeMenuMessageId === message.id
                              ? 'opacity-100 bg-black/5 dark:bg-white/10'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'
                          }`}
                          title="Message options"
                          aria-label="Message options"
                          aria-expanded={activeMenuMessageId === message.id}
                        >
                          <MoreVertical className="size-3.5" />
                        </button>

                        {activeMenuMessageId === message.id && (
                          <div
                            ref={menuRef}
                            className="absolute bottom-full left-0 right-auto sm:left-auto sm:right-0 z-30 mb-1 min-w-[120px] max-w-[calc(100vw-3rem)] rounded-[8px] border-2 border-[#0D0C1D] bg-white p-1 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[2px_2px_0_#000000]"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuMessageId(null);
                                handleSelectReply(message);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-semibold text-[#0D0C1D] hover:bg-[#F5F2EA] dark:text-[#F3F4F8] dark:hover:bg-[#1E2134]"
                            >
                              <Reply className="size-3.5" />
                              Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuMessageId(null);
                                setConfirmDeleteMessage(message);
                              }}
                              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div
                      className={`min-w-0 max-w-[calc(100%-2.5rem)] sm:max-w-[75%] rounded-[10px] border-2 border-[#0D0C1D] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] ${
                        own
                          ? message.status === 'failed'
                            ? 'border-red-600 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950/40 dark:text-red-100'
                            : 'bg-[#4F46E5] text-white dark:bg-[#6366F1]'
                          : 'bg-[#F5F2EA] text-[#0D0C1D] dark:bg-[#1E2134] dark:text-[#F3F4F8]'
                      }`}
                      style={own && message.status !== 'failed' ? { color: '#fff' } : undefined}
                    >
                      {/* Quoted block for replies */}
                      {message.reply_to_message_id ? (
                        <div
                          onClick={() => {
                            if (message.reply_to_message_id) {
                              handleScrollToRepliedMessage(message.reply_to_message_id);
                            }
                          }}
                          className={`mb-2 cursor-pointer rounded-[6px] border-l-4 px-2.5 py-1.5 text-xs transition-opacity hover:opacity-90 min-w-0 ${
                            own && message.status !== 'failed'
                              ? 'border-indigo-200 bg-white/15 text-white'
                              : 'border-[#4F46E5] bg-black/5 text-[#0D0C1D] dark:border-[#818CF8] dark:bg-white/5 dark:text-[#F3F4F8]'
                          }`}
                        >
                          {repliedMsg ? (
                            <>
                              <span
                                className={`block font-bold truncate ${
                                   own && message.status !== 'failed'
                                    ? 'text-indigo-100'
                                    : 'text-[#4F46E5] dark:text-[#818CF8]'
                                }`}
                              >
                                {repliedMsg.sender_user_id === currentUserId
                                  ? 'You'
                                  : otherPartyName}
                              </span>
                              <p className="line-clamp-2 text-xs opacity-90 break-words [overflow-wrap:anywhere]">
                                {repliedMsg.body}
                              </p>
                            </>
                          ) : (
                            <span className="italic opacity-70">
                              Original message unavailable
                            </span>
                          )}
                        </div>
                      ) : null}

                      <p className="min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6">
                        {message.body}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                        <span
                          className={`text-[11px] ${
                            own && message.status !== 'failed'
                              ? 'text-indigo-100'
                              : 'text-[#5A5870] dark:text-[#9CA1BA]'
                          }`}
                        >
                          {formatTime(message.created_at)}
                        </span>

                        {message.status === 'sending' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-100">
                            <Clock className="size-3 animate-pulse" />
                            Sending…
                          </span>
                        ) : message.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                            <AlertCircle className="size-3" />
                            Failed to send
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Reply trigger button on right for incoming messages from other party (never delete) */}
                    {!own ? (
                      <button
                        type="button"
                        onClick={() => handleSelectReply(message)}
                        className="mb-1 flex size-8 shrink-0 items-center justify-center rounded p-1 text-[#5A5870] opacity-100 transition-opacity hover:bg-black/5 hover:text-[#0D0C1D] sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:text-[#9CA1BA] dark:hover:bg-white/10 dark:hover:text-[#F3F4F8]"
                        title="Reply to this message"
                        aria-label="Reply to message"
                      >
                        <Reply className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center px-2">
              <span
                className={`flex size-12 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:shadow-[2px_2px_0_#000000] ${
                  emptyState.iconTheme === 'indigo'
                    ? 'bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#1E1F3B] dark:text-[#818CF8]'
                    : 'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E293B] dark:text-[#60A5FA]'
                }`}
              >
                <MessageCircle className="size-6" />
              </span>
              <h2 className="mt-3 text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                {emptyState.title}
              </h2>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
                {emptyState.description}
              </p>
            </div>
          )}
        </div>

        {/* Floating "New message" indicator if user is scrolled up */}
        {showNewMessageIndicator ? (
          <button
            type="button"
            onClick={() => {
              scrollToBottom(true);
              setShowNewMessageIndicator(false);
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border-2 border-[#0D0C1D] bg-[#4F46E5] px-3.5 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_#0D0C1D] transition-all hover:bg-[#4338CA] dark:border-[#262A3D] dark:bg-[#6366F1]"
          >
            <ArrowDown className="size-3.5" />
            New message
          </button>
        ) : null}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-[1px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteMessage(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 sm:p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="size-5 shrink-0" />
              <h3 id="delete-dialog-title" className="text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
                Delete message?
              </h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
              Delete message? This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteMessage(null)}
                className="rounded-[6px] border-2 border-[#0D0C1D] bg-white px-3.5 py-1.5 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#F3F4F8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmDeleteMessage;
                  setConfirmDeleteMessage(null);
                  if (target) {
                    void executeDeleteMessage(target.id);
                  }
                }}
                className="rounded-[6px] border-2 border-[#0D0C1D] bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_#0D0C1D] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageComposer
        conversationId={conversationId}
        senderUserId={currentUserId}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        onOptimisticSend={handleOptimisticSend}
        onSendSuccess={handleSendSuccess}
        onSendError={handleSendError}
        otherPartyName={otherPartyName}
        textareaRef={textareaRef}
      />
    </>
  );
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
