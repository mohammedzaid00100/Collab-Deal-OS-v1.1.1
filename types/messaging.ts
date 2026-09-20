export interface ConversationMessage {
  id: string;
  sender_user_id: string;
  body: string;
  reply_to_message_id: string | null;
  created_at: string;
}

export interface ChatMessage extends ConversationMessage {
  tempId?: string;
  status?: 'sending' | 'sent' | 'failed';
  errorMessage?: string;
}

export interface ReplyTarget {
  id: string;
  sender_user_id: string;
  body: string;
}
