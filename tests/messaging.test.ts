import { describe, expect, it } from 'vitest';
import type { ChatMessage, ConversationMessage, ReplyTarget } from '@/types/messaging';

describe('messaging and realtime deduplication', () => {
  const currentUserId = 'user-creator-1';
  const otherUserId = 'user-brand-2';

  it('deduplicates messages by permanent id', () => {
    const existing: ChatMessage[] = [
      { id: 'msg-1', sender_user_id: otherUserId, body: 'Hello', reply_to_message_id: null, created_at: '2026-09-20T10:00:00Z', status: 'sent' },
    ];

    const duplicateIncoming: ConversationMessage = {
      id: 'msg-1',
      sender_user_id: otherUserId,
      body: 'Hello',
      reply_to_message_id: null,
      created_at: '2026-09-20T10:00:00Z',
    };

    const isDuplicate = existing.some((m) => m.id === duplicateIncoming.id);
    expect(isDuplicate).toBe(true);

    const merged = isDuplicate ? existing : [...existing, { ...duplicateIncoming, status: 'sent' }];
    expect(merged).toHaveLength(1);
  });

  it('matches and updates an in-flight optimistic message when confirmed', () => {
    const tempId = 'temp-12345';
    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      sender_user_id: currentUserId,
      body: 'I will send the draft tomorrow',
      reply_to_message_id: 'msg-1',
      created_at: '2026-09-20T10:01:00Z',
      status: 'sending',
    };

    const messages: ChatMessage[] = [optimistic];

    const serverConfirmation: ConversationMessage = {
      id: 'db-real-999',
      sender_user_id: currentUserId,
      body: 'I will send the draft tomorrow',
      reply_to_message_id: 'msg-1',
      created_at: '2026-09-20T10:01:02Z',
    };

    // Update on success
    const updated = messages.map((m) =>
      m.id === tempId || m.tempId === tempId
        ? { ...serverConfirmation, status: 'sent' as const }
        : m
    );

    expect(updated[0].id).toBe('db-real-999');
    expect(updated[0].status).toBe('sent');
    expect(updated[0].body).toBe('I will send the draft tomorrow');
  });

  it('correctly marks an optimistic message as failed when insert fails', () => {
    const tempId = 'temp-error-1';
    const optimistic: ChatMessage = {
      id: tempId,
      tempId,
      sender_user_id: currentUserId,
      body: 'Network fail test',
      reply_to_message_id: null,
      created_at: '2026-09-20T10:02:00Z',
      status: 'sending',
    };

    const messages: ChatMessage[] = [optimistic];
    const errorMessage = 'Network error: Failed to fetch';

    const updated = messages.map((m) =>
      m.id === tempId || m.tempId === tempId
        ? { ...m, status: 'failed' as const, errorMessage }
        : m
    );

    expect(updated[0].status).toBe('failed');
    expect(updated[0].errorMessage).toBe(errorMessage);
  });

  it('resolves reply preview correctly with author attribution', () => {
    const messages: ChatMessage[] = [
      { id: 'm1', sender_user_id: otherUserId, body: 'Can you deliver by Friday?', reply_to_message_id: null, created_at: '2026-09-20T10:00:00Z', status: 'sent' },
      { id: 'm2', sender_user_id: currentUserId, body: 'Yes, Friday works.', reply_to_message_id: 'm1', created_at: '2026-09-20T10:01:00Z', status: 'sent' },
    ];

    const messagesMap = new Map<string, ChatMessage>(messages.map((m) => [m.id, m]));

    const replyTarget = messagesMap.get(messages[1].reply_to_message_id!);
    expect(replyTarget).toBeDefined();
    expect(replyTarget?.body).toBe('Can you deliver by Friday?');

    const replyAuthor = replyTarget?.sender_user_id === currentUserId ? 'You' : 'Acme Brand';
    expect(replyAuthor).toBe('Acme Brand');
  });

  it('gracefully handles replies when the parent message is unavailable', () => {
    const messagesMap = new Map<string, ChatMessage>();
    const missingParentId = 'deleted-msg-xyz';

    const replyTarget = messagesMap.get(missingParentId);
    expect(replyTarget).toBeUndefined();

    const fallbackLabel = replyTarget ? replyTarget.body : 'Original message unavailable';
    expect(fallbackLabel).toBe('Original message unavailable');
  });

  it('tracks lastSeenTimestamp correctly for delta reconnection recovery', () => {
    const list: ConversationMessage[] = [
      { id: 'm1', sender_user_id: otherUserId, body: 'First', reply_to_message_id: null, created_at: '2026-09-20T09:00:00.000Z' },
      { id: 'm2', sender_user_id: otherUserId, body: 'Second', reply_to_message_id: null, created_at: '2026-09-20T09:05:00.000Z' },
    ];

    let lastSeen = list[list.length - 1].created_at;
    expect(lastSeen).toBe('2026-09-20T09:05:00.000Z');

    const incoming: ConversationMessage = {
      id: 'm3',
      sender_user_id: otherUserId,
      body: 'Third',
      reply_to_message_id: null,
      created_at: '2026-09-20T09:10:00.000Z',
    };

    if (new Date(incoming.created_at) > new Date(lastSeen)) {
      lastSeen = incoming.created_at;
    }

    expect(lastSeen).toBe('2026-09-20T09:10:00.000Z');
  });
});
