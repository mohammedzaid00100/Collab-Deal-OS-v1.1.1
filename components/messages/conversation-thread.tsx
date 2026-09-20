'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MessageCircle, Reply, ArrowDown, Clock, AlertCircle } from 'lucide-react';
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Track latest message timestamp for reconnect delta recovery
  const lastSeenTimestampRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].created_at : null
  );

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

  // Handle incoming realtime message (INSERT)
  const handleIncomingMessage = useCallback((newRow: ConversationMessage) => {
    setMessages((prev) => {
      // 1. Deduplicate by permanent ID
      if (prev.some((m) => m.id === newRow.id)) {
        return prev;
      }

      // 2. If it is our own message and we have a matching optimistic item pending
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

      // 3. Otherwise append the new message
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
  }, [currentUserId, scrollToBottom]);

  // Supabase Realtime Subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`conversation-messages:${conversationId}`);

    channel
      .on(
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
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Recover any missed messages during connection or reconnection
          const lastTs = lastSeenTimestampRef.current;
          if (lastTs) {
            const { data } = await supabase
              .from('conversation_messages')
              .select('id, sender_user_id, body, created_at, reply_to_message_id')
              .eq('conversation_id', conversationId)
              .gt('created_at', lastTs)
              .order('created_at', { ascending: true });

            if (data && data.length > 0) {
              for (const row of data as ConversationMessage[]) {
                handleIncomingMessage(row);
              }
            }
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, handleIncomingMessage]);

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
      <div className="relative">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="min-h-[420px] max-h-[62vh] overflow-y-auto p-4 sm:p-5"
        >
          {messages.length ? (
            <div className="grid gap-3">
              {messages.map((message) => {
                const own = message.sender_user_id === currentUserId;
                const repliedMsg = message.reply_to_message_id
                  ? messagesMap.get(message.reply_to_message_id)
                  : null;

                return (
                  <div
                    id={`msg-${message.id}`}
                    className={`group flex items-end gap-2 transition-all ${
                      own ? 'justify-end' : 'justify-start'
                    }`}
                    key={message.id || message.tempId}
                  >
                    {/* Reply trigger button on left for own messages */}
                    {own ? (
                      <button
                        type="button"
                        onClick={() => handleSelectReply(message)}
                        className="mb-1 rounded p-1 text-[#5A5870] opacity-0 transition-opacity hover:bg-black/5 hover:text-[#0D0C1D] group-hover:opacity-100 dark:text-[#9CA1BA] dark:hover:bg-white/10 dark:hover:text-[#F3F4F8]"
                        title="Reply to this message"
                        aria-label="Reply to message"
                      >
                        <Reply className="size-3.5" />
                      </button>
                    ) : null}

                    <div
                      className={`max-w-[82%] rounded-[10px] border-2 border-[#0D0C1D] px-4 py-3 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] sm:max-w-[75%] ${
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
                          className={`mb-2 cursor-pointer rounded-[6px] border-l-4 px-2.5 py-1.5 text-xs transition-opacity hover:opacity-90 ${
                            own && message.status !== 'failed'
                              ? 'border-indigo-200 bg-white/15 text-white'
                              : 'border-[#4F46E5] bg-black/5 text-[#0D0C1D] dark:border-[#818CF8] dark:bg-white/5 dark:text-[#F3F4F8]'
                          }`}
                        >
                          {repliedMsg ? (
                            <>
                              <span
                                className={`block font-bold ${
                                  own && message.status !== 'failed'
                                    ? 'text-indigo-100'
                                    : 'text-[#4F46E5] dark:text-[#818CF8]'
                                }`}
                              >
                                {repliedMsg.sender_user_id === currentUserId
                                  ? 'You'
                                  : otherPartyName}
                              </span>
                              <p className="line-clamp-2 text-xs opacity-90">
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

                      <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>

                      <div className="mt-1 flex items-center justify-between gap-3">
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

                    {/* Reply trigger button on right for incoming messages */}
                    {!own ? (
                      <button
                        type="button"
                        onClick={() => handleSelectReply(message)}
                        className="mb-1 rounded p-1 text-[#5A5870] opacity-0 transition-opacity hover:bg-black/5 hover:text-[#0D0C1D] group-hover:opacity-100 dark:text-[#9CA1BA] dark:hover:bg-white/10 dark:hover:text-[#F3F4F8]"
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
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
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
