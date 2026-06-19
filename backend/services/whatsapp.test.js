const assert = require('node:assert/strict');
const test = require('node:test');

const WhatsAppService = require('./whatsapp');

test('normalizes wrapper labels out of WhatsApp replies', () => {
  const service = new WhatsAppService();

  assert.equal(service.normalizeReplyText('Suggested reply:\nHi, I am Kyrovia.'), 'Hi, I am Kyrovia.');
  assert.equal(service.normalizeReplyText('You can reply: Hello there.'), 'Hello there.');
  assert.equal(service.normalizeReplyText('```text\nReply: "Sure, I can help."\n```'), 'Sure, I can help.');
  assert.equal(service.normalizeReplyText('Suggested reply:'), '');
});

test('sends the normalized backend reply and exposes it in status', async () => {
  const service = new WhatsAppService({}, {
    responseHandler: async () => 'Suggested reply:\nI am Kyrovia, your AI assistant.'
  });
  let sentMessage = null;

  service.sock = {
    readMessages: async () => undefined,
    sendPresenceUpdate: async () => undefined,
    sendMessage: async (jid, payload, options) => {
      sentMessage = { jid, payload, options };
      return { key: { id: 'sent-message-id' } };
    }
  };
  service.status = 'connected';

  const incoming = {
    chatJid: '15551234567@s.whatsapp.net',
    messageId: 'incoming-message-id',
    rawMessage: {
      key: {
        id: 'incoming-message-id',
        remoteJid: '15551234567@s.whatsapp.net'
      }
    },
    senderJid: '15551234567@s.whatsapp.net',
    senderName: 'Sourabh',
    text: 'Tell me something about yourself'
  };

  await service.replyToIncomingMessage(incoming);

  assert.equal(sentMessage.jid, incoming.chatJid);
  assert.deepEqual(sentMessage.payload, { text: 'I am Kyrovia, your AI assistant.' });
  assert.equal(sentMessage.options.quoted, incoming.rawMessage);

  const status = service.getStatus().autoReply;
  assert.equal(status.lastIncomingText, incoming.text);
  assert.equal(status.lastGeneratedReply, 'I am Kyrovia, your AI assistant.');
  assert.equal(status.lastSentReply, 'I am Kyrovia, your AI assistant.');
  assert.equal(status.lastSentMessageId, 'sent-message-id');
  assert.equal(status.lastReplyStatus, 'accepted');
  assert.equal(status.replied, 1);
  assert.equal(status.failed, 0);
});

test('uses the phone-number JID when an incoming direct message is LID-addressed', async () => {
  const service = new WhatsAppService();
  const incoming = service.normalizeIncomingMessage({
    key: {
      id: 'lid-message-id',
      remoteJid: '149202986377411@lid',
      remoteJidAlt: '15551234567@s.whatsapp.net'
    },
    message: {
      conversation: 'Hello'
    },
    pushName: 'Sender'
  });

  assert.equal(incoming.chatJid, '149202986377411@lid');
  assert.equal(incoming.replyJid, '15551234567@s.whatsapp.net');
  assert.equal(incoming.senderJid, '15551234567@s.whatsapp.net');
});

test('sends an LID-addressed inbound reply to the same phone-number sender', async () => {
  const service = new WhatsAppService({}, {
    responseHandler: async () => 'Exact backend reply'
  });
  let sentMessage = null;

  service.sock = {
    readMessages: async () => undefined,
    sendPresenceUpdate: async () => undefined,
    sendMessage: async (jid, payload, options) => {
      sentMessage = { jid, payload, options };
      return { key: { id: 'lid-reply-id' } };
    }
  };
  service.status = 'connected';

  await service.replyToIncomingMessage({
    chatJid: '149202986377411@lid',
    replyJid: '15551234567@s.whatsapp.net',
    messageId: 'lid-message-id',
    rawMessage: {
      key: {
        id: 'lid-message-id',
        remoteJid: '149202986377411@lid',
        remoteJidAlt: '15551234567@s.whatsapp.net'
      }
    },
    senderJid: '15551234567@s.whatsapp.net',
    senderName: 'Sender',
    text: 'Hello'
  });

  assert.equal(sentMessage.jid, '15551234567@s.whatsapp.net');
  assert.deepEqual(sentMessage.payload, { text: 'Exact backend reply' });
  assert.deepEqual(sentMessage.options, {});
  assert.equal(service.getStatus().autoReply.lastRecipient, '15551234567@s.whatsapp.net');
});

test('tracks delivery acknowledgement for the generated backend reply', () => {
  const service = new WhatsAppService();
  service.autoReplyStats.lastSentMessageId = 'sent-message-id';
  service.autoReplyStats.lastReplyStatus = 'accepted';

  service.handleMessageUpdates([
    {
      key: { id: 'sent-message-id' },
      update: { status: 3 }
    }
  ]);

  assert.equal(service.autoReplyStats.lastReplyStatus, 'delivered');
  assert.ok(service.autoReplyStats.lastDeliveryAt);
});

test('does not let an old socket close event clear a replacement socket', async () => {
  const sockets = [];
  const service = new WhatsAppService();

  function makeSocket() {
    const handlers = new Map();
    const socket = {
      end: () => undefined,
      ev: {
        on: (event, handler) => handlers.set(event, handler)
      },
      handlers,
      user: null
    };

    sockets.push(socket);
    return socket;
  }

  service.modules = {
    DisconnectReason: {
      connectionReplaced: 440,
      loggedOut: 401
    },
    fetchLatestBaileysVersion: async () => ({ version: [1, 2, 3] }),
    jidNormalizedUser: (jid) => jid,
    makeWASocket: makeSocket,
    useMultiFileAuthState: async () => ({
      saveCreds: async () => undefined,
      state: {}
    })
  };

  await service.connect();
  const firstSocket = sockets[0];
  service.status = 'qr';

  await service.connect();
  assert.equal(sockets.length, 1);

  await service.connect({ restart: true });
  const secondSocket = sockets[1];
  await secondSocket.handlers.get('connection.update')({ connection: 'open' });
  await firstSocket.handlers.get('connection.update')({
    connection: 'close',
    lastDisconnect: {
      error: {
        output: {
          statusCode: 440
        }
      }
    }
  });

  assert.equal(service.sock, secondSocket);
  assert.equal(service.status, 'connected');
});
