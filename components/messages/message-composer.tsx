'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Reply } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ChatMessage, ConversationMessage, ReplyTarget } from '@/types/messaging';

export interface MessageComposerProps {
  conversationId: string;
  senderUserId: string;
  replyTarget?: ReplyTarget | null;
  onCancelReply?: () => void;
  onOptimisticSend?: (optimisticMsg: ChatMessage) => void;
  onSendSuccess?: (tempId: string, persistedMsg: ConversationMessage) => void;
  onSendError?: (tempId: string, errorMessage: string) => void;
  otherPartyName?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function MessageComposer({
  conversationId,
  senderUserId,
  replyTarget = null,
  onCancelReply,
  onOptimisticSend,
  onSendSuccess,
  onSendError,
  otherPartyName = 'Participant',
  textareaRef: externalTextareaRef,
}: MessageComposerProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;

  // Auto-focus textarea when a reply target is chosen
  useEffect(() => {
    if (replyTarget && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTarget, textareaRef]);

  async function sendMessage() {
    const message = body.trim();
    if (!message) return;
    if (message.length > 4000) {
      setError('Keep messages under 4,000 characters.');
      return;
    }

    setError(null);
    const tempId = 'temp-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const activeReplyId = replyTarget?.id ?? null;

    const optimisticMsg: ChatMessage = {
      id: tempId,
      tempId,
      sender_user_id: senderUserId,
      body: message,
      reply_to_message_id: activeReplyId,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    // Immediate optimistic local update
    if (onOptimisticSend) {
      onOptimisticSend(optimisticMsg);
    }

    // Reset input and reply state immediately for responsive chat feel
    setBody('');
    if (onCancelReply) {
      onCancelReply();
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      const err = 'Messaging is not configured yet.';
      setError(err);
      if (onSendError) onSendError(tempId, err);
      return;
    }

    // Persist in background
    try {
      const { data, error: insertError } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: senderUserId,
          body: message,
          reply_to_message_id: activeReplyId,
        })
        .select('id, sender_user_id, body, created_at, reply_to_message_id')
        .single();

      if (insertError) {
        setError(insertError.message);
        if (onSendError) onSendError(tempId, insertError.message);
      } else if (data) {
        if (onSendSuccess) {
          onSendSuccess(tempId, data as ConversationMessage);
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errMsg);
      if (onSendError) onSendError(tempId, errMsg);
    }
  }

  return (
    <div className="border-t-2 border-[#0D0C1D] bg-white p-3 sm:p-4 dark:border-[#262A3D] dark:bg-[#161826]">
      {replyTarget ? (
        <div className="mb-2.5 flex items-start justify-between gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-2.5 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1C1E30] dark:shadow-none">
          <div className="min-w-0 flex-1 border-l-4 border-[#4F46E5] pl-2.5 dark:border-[#818CF8]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#4F46E5] dark:text-[#818CF8]">
              <Reply className="size-3.5 shrink-0" />
              <span>
                Replying to {replyTarget.sender_user_id === senderUserId ? 'yourself' : otherPartyName}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 truncate text-xs text-[#5A5870] dark:text-[#9CA1BA]">
              {replyTarget.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-transparent text-[#5A5870] transition-colors hover:border-[#0D0C1D] hover:bg-white hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:border-[#262A3D] dark:hover:bg-[#161826] dark:hover:text-[#F3F4F8]"
            aria-label="Cancel reply"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className="min-h-11 max-h-36 min-w-0 flex-1 resize-y rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA]/40 px-3 py-2.5 text-sm font-medium text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] outline-none transition placeholder:text-[#8D8BA7] focus:bg-white focus:shadow-[3px_3px_0_#4F46E5] dark:border-[#262A3D] dark:bg-[#11131E] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000] dark:focus:shadow-[3px_3px_0_#6366F1]"
          maxLength={4000}
          rows={1}
          placeholder="Write a message…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] text-white shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] disabled:opacity-50 dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[2px_2px_0_#000000]"
          style={{ color: '#fff' }}
          type="button"
          disabled={!body.trim()}
          onClick={() => void sendMessage()}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
    </div>
  );
}
