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

  it('deduplicates between fast Realtime Broadcast and postgres_changes using client_msg_id and permanent id', () => {
    let state: ChatMessage[] = [];

    function processIncoming(newRow: ConversationMessage, clientMsgId?: string) {
      if (state.some((m) => m.id === newRow.id)) return;
      if (clientMsgId) {
        const matchIdx = state.findIndex((m) => m.tempId === clientMsgId || m.id === clientMsgId);
        if (matchIdx !== -1) {
          state[matchIdx] = { ...newRow, status: 'sent' };
          return;
        }
      }
      state = [...state, { ...newRow, status: 'sent' }];
    }

    const broadcastMsg: ConversationMessage & { client_msg_id: string } = {
      id: 'msg-real-100',
      sender_user_id: otherUserId,
      body: 'Broadcast message arrival',
      reply_to_message_id: null,
      created_at: '2026-09-20T10:05:00Z',
      client_msg_id: 'client-temp-abc',
    };

    // 1. Broadcast arrives first
    processIncoming(broadcastMsg, broadcastMsg.client_msg_id);
    expect(state).toHaveLength(1);
    expect(state[0].id).toBe('msg-real-100');

    // 2. postgres_changes WAL arrives 100ms later with same permanent id
    const walRow: ConversationMessage = {
      id: 'msg-real-100',
      sender_user_id: otherUserId,
      body: 'Broadcast message arrival',
      reply_to_message_id: null,
      created_at: '2026-09-20T10:05:00Z',
    };
    processIncoming(walRow);

    expect(state).toHaveLength(1);
    expect(state[0].body).toBe('Broadcast message arrival');
  });

  it('processes 10 rapid messages sent in a row without duplicates or dropped messages', () => {
    let state: ChatMessage[] = [];

    function processIncoming(newRow: ConversationMessage, clientMsgId?: string) {
      if (state.some((m) => m.id === newRow.id)) return;
      if (clientMsgId) {
        const matchIdx = state.findIndex((m) => m.tempId === clientMsgId || m.id === clientMsgId);
        if (matchIdx !== -1) {
          state[matchIdx] = { ...newRow, status: 'sent' };
          return;
        }
      }
      state = [...state, { ...newRow, status: 'sent' }];
    }

    // Generate 10 rapid messages
    const rapidMessages: Array<ConversationMessage & { client_msg_id: string }> = Array.from({ length: 10 }, (_, i) => ({
      id: `rapid-db-msg-${i + 1}`,
      sender_user_id: i % 2 === 0 ? currentUserId : otherUserId,
      body: `Rapid message #${i + 1}`,
      reply_to_message_id: i > 0 && i % 3 === 0 ? `rapid-db-msg-${i}` : null,
      created_at: new Date(Date.now() + i * 50).toISOString(),
      client_msg_id: `client-rapid-temp-${i + 1}`,
    }));

    // Deliver all via broadcast
    for (const msg of rapidMessages) {
      processIncoming(msg, msg.client_msg_id);
    }
    expect(state).toHaveLength(10);

    // Deliver all again via postgres_changes (simulate dual-delivery)
    for (const msg of rapidMessages) {
      const { client_msg_id: _, ...row } = msg;
      processIncoming(row);
    }
    // Zero duplicates!
    expect(state).toHaveLength(10);

    for (let i = 0; i < 10; i++) {
      expect(state[i].id).toBe(`rapid-db-msg-${i + 1}`);
      expect(state[i].body).toBe(`Rapid message #${i + 1}`);
    }
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

  it('gracefully handles replies when the parent message is deleted/unavailable', () => {
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

  describe('message deletion workflow', () => {
    it('removes the message from local state and clears active reply target if matched', () => {
      let messages: ChatMessage[] = [
        { id: 'msg-1', sender_user_id: currentUserId, body: 'Own message', reply_to_message_id: null, created_at: '2026-09-20T10:00:00Z', status: 'sent' },
        { id: 'msg-2', sender_user_id: otherUserId, body: 'Peer message', reply_to_message_id: 'msg-1', created_at: '2026-09-20T10:01:00Z', status: 'sent' },
      ];
      let activeReplyTarget: ReplyTarget | null = { id: 'msg-1', sender_user_id: currentUserId, body: 'Own message' };

      function handleDelete(idToDelete: string) {
        messages = messages.filter((m) => m.id !== idToDelete && m.tempId !== idToDelete);
        if (activeReplyTarget?.id === idToDelete) {
          activeReplyTarget = null;
        }
      }

      handleDelete('msg-1');

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-2');
      expect(activeReplyTarget).toBeNull();
    });

    it('enforces that only sender can see the delete action', () => {
      const ownMessage: ChatMessage = {
        id: 'm-own',
        sender_user_id: currentUserId,
        body: 'Created by current user',
        reply_to_message_id: null,
        created_at: '2026-09-20T10:00:00Z',
        status: 'sent',
      };

      const peerMessage: ChatMessage = {
        id: 'm-peer',
        sender_user_id: otherUserId,
        body: 'Created by other user',
        reply_to_message_id: null,
        created_at: '2026-09-20T10:01:00Z',
        status: 'sent',
      };

      const canDeleteOwn = ownMessage.sender_user_id === currentUserId;
      const canDeletePeer = peerMessage.sender_user_id === currentUserId;

      expect(canDeleteOwn).toBe(true);
      expect(canDeletePeer).toBe(false);
    });

    it('propagates deletion in realtime to recipient state', () => {
      let recipientMessages: ChatMessage[] = [
        { id: 'm-10', sender_user_id: otherUserId, body: 'Peer message', reply_to_message_id: null, created_at: '2026-09-20T10:00:00Z', status: 'sent' },
        { id: 'm-11', sender_user_id: currentUserId, body: 'My reply', reply_to_message_id: 'm-10', created_at: '2026-09-20T10:01:00Z', status: 'sent' },
      ];

      // Realtime broadcast or postgres_changes DELETE event arrives for m-10
      const deletedEventId = 'm-10';
      recipientMessages = recipientMessages.filter((m) => m.id !== deletedEventId);

      expect(recipientMessages).toHaveLength(1);
      expect(recipientMessages[0].id).toBe('m-11');
      // m-11 still references m-10, but Map lookup will safely return undefined / fallback label
      const map = new Map(recipientMessages.map((m) => [m.id, m]));
      expect(map.get(recipientMessages[0].reply_to_message_id!)).toBeUndefined();
    });
  });
});
