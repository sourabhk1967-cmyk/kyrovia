const path = require('path');

const fs = require('fs-extra');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

const MAX_SEEN_MESSAGE_IDS = 600;
const MAX_WHATSAPP_REPLY_LENGTH = 3900;
const OUTBOUND_STATUS = {
  0: 'failed',
  1: 'pending',
  2: 'sent',
  3: 'delivered',
  4: 'read',
  5: 'played'
};
const REPLY_LABEL_RE =
  /^(?:suggested\s+reply|you\s+can\s+reply(?:\s+with)?|reply\s+to\s+send|reply|message|whatsapp\s+reply)\s*[:：-]\s*/i;

function createWhatsAppError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function normalizePhoneJid(value = '') {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  if (raw.includes('@')) {
    return raw;
  }

  const digits = raw.replace(/[^\d]/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function preferredUserJid(...values) {
  const jids = values
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return jids.find((jid) => jid.endsWith('@s.whatsapp.net')) || jids[0] || '';
}

class WhatsAppService {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this.authDir = path.resolve(process.cwd(), config.authDir || './data/whatsapp-auth');
    this.responseHandler = dependencies.responseHandler || null;
    this.sock = null;
    this.connectingPromise = null;
    this.status = 'idle';
    this.qr = '';
    this.qrDataUrl = '';
    this.lastDisconnectReason = '';
    this.lastConnectedAt = '';
    this.version = null;
    this.user = null;
    this.modules = null;
    this.autoReplyEnabled = config.autoReply !== false;
    this.replyGroups = Boolean(config.replyGroups);
    this.seenMessageIds = new Set();
    this.autoReplyStats = {
      deliveryFailed: 0,
      failed: 0,
      ignored: 0,
      lastDeliveryAt: '',
      lastError: '',
      lastGeneratedReply: '',
      lastInboundAt: '',
      lastIncomingText: '',
      lastRecipient: '',
      lastReplyAt: '',
      lastReplyStatus: '',
      lastSentReply: '',
      lastSentMessageId: '',
      lastSender: '',
      pending: 0,
      processed: 0,
      replied: 0
    };
  }

  setResponseHandler(responseHandler) {
    this.responseHandler = responseHandler;
    return this;
  }

  async loadModules() {
    if (this.modules) {
      return this.modules;
    }

    const baileys = await import('@whiskeysockets/baileys');
    const boomModule = await import('@hapi/boom');

    this.modules = {
      Boom: boomModule.Boom || boomModule.default?.Boom,
      boomify: boomModule.boomify || boomModule.default?.boomify,
      DisconnectReason: baileys.DisconnectReason,
      downloadMediaMessage: baileys.downloadMediaMessage,
      fetchLatestBaileysVersion: baileys.fetchLatestBaileysVersion,
      jidNormalizedUser: baileys.jidNormalizedUser,
      makeWASocket: baileys.default || baileys.makeWASocket,
      useMultiFileAuthState: baileys.useMultiFileAuthState
    };

    return this.modules;
  }

  async connect({ restart = false } = {}) {
    if (!restart && this.sock && ['connecting', 'qr', 'connected'].includes(this.status)) {
      return this.getStatus();
    }

    if (this.connectingPromise) {
      await this.connectingPromise;
      return this.getStatus();
    }

    if (restart && this.sock) {
      await this.disconnect();
    }

    this.connectingPromise = this.openSocket().finally(() => {
      this.connectingPromise = null;
    });

    await this.connectingPromise;
    return this.getStatus();
  }

  async openSocket() {
    const {
      Boom,
      boomify,
      DisconnectReason,
      fetchLatestBaileysVersion,
      jidNormalizedUser,
      makeWASocket,
      useMultiFileAuthState
    } = await this.loadModules();

    await fs.ensureDir(this.authDir);
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.version = version;
    this.status = 'connecting';
    this.lastDisconnectReason = '';

    const sock = makeWASocket({
      auth: state,
      browser: ['Kyrovia', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      printQRInTerminal: false,
      syncFullHistory: false,
      version
    });

    this.sock = sock;

    sock.ev.on('creds.update', () => {
      if (this.sock === sock) {
        saveCreds().catch((error) => {
          this.autoReplyStats.lastError = error?.message || 'Unable to save the WhatsApp session.';
        });
      }
    });
    sock.ev.on('messages.upsert', (event) => {
      if (this.sock !== sock) {
        return;
      }

      this.handleMessagesUpsert(event).catch((error) => {
        this.autoReplyStats.failed += 1;
        this.autoReplyStats.lastError = error?.message || 'Unable to process WhatsApp message.';
      });
    });
    sock.ev.on('messages.update', (updates) => {
      if (this.sock === sock) {
        this.handleMessageUpdates(updates);
      }
    });
    sock.ev.on('connection.update', async (update) => {
      if (this.sock !== sock) {
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrDataUrl = await qrcode.toDataURL(qr).catch(() => '');

        if (this.sock !== sock) {
          return;
        }

        this.status = 'qr';
        this.qr = qr;
        this.qrDataUrl = qrDataUrl;
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.sock = sock;
        this.status = 'connected';
        this.qr = '';
        this.qrDataUrl = '';
        this.user = sock.user
          ? {
              id: jidNormalizedUser(sock.user.id || ''),
              name: sock.user.name || ''
            }
          : null;
        this.lastConnectedAt = new Date().toISOString();
      }

      if (connection === 'close') {
        if (this.sock !== sock) {
          return;
        }

        const error = lastDisconnect?.error;
        const boom = boomify && error ? boomify(error) : null;
        const statusCode = error?.output?.statusCode || boom?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const replaced = statusCode === DisconnectReason.connectionReplaced;

        this.status = loggedOut ? 'logged_out' : replaced ? 'replaced' : 'disconnected';
        this.lastDisconnectReason = replaced
          ? 'WhatsApp session was replaced by another Web connection. Reconnect Kyrovia from the WhatsApp AI Bridge panel.'
          : error?.message || (loggedOut ? 'Logged out' : 'Connection closed');
        this.sock = null;

        if (!loggedOut && !replaced && this.config.autoReconnect !== false) {
          windowlessDelay(1200).then(() => this.connect().catch(() => undefined));
        }
      }
    });
  }

  handleMessageUpdates(updates = []) {
    const sentMessageId = this.autoReplyStats.lastSentMessageId;

    if (!sentMessageId) {
      return;
    }

    for (const item of Array.isArray(updates) ? updates : []) {
      if (item?.key?.id !== sentMessageId || typeof item?.update?.status !== 'number') {
        continue;
      }

      const status = OUTBOUND_STATUS[item.update.status];

      if (!status) {
        continue;
      }

      this.autoReplyStats.lastReplyStatus = status;

      if (status === 'delivered' || status === 'read' || status === 'played') {
        this.autoReplyStats.lastDeliveryAt = new Date().toISOString();
      }

      if (status === 'failed') {
        const detail = Array.isArray(item.update.messageStubParameters)
          ? item.update.messageStubParameters.filter(Boolean).join(', ')
          : '';

        this.autoReplyStats.deliveryFailed += 1;
        this.autoReplyStats.lastError = detail
          ? `WhatsApp rejected the generated reply (${detail}).`
          : 'WhatsApp rejected the generated reply.';
      }
    }
  }

  async handleMessagesUpsert(event = {}) {
    if (!this.autoReplyEnabled || event.type !== 'notify') {
      return;
    }

    const messages = Array.isArray(event.messages) ? event.messages : [];

    for (const message of messages) {
      const incoming = this.normalizeIncomingMessage(message);

      if (!incoming) {
        continue;
      }

      this.trackMessageId(incoming.messageId);
      this.replyToIncomingMessage(incoming).catch((error) => {
        this.autoReplyStats.failed += 1;
        this.autoReplyStats.lastError = error?.message || 'Unable to auto-reply on WhatsApp.';
      });
    }
  }

  normalizeIncomingMessage(rawMessage = {}) {
    const key = rawMessage.key || {};
    const chatJid = key.remoteJid || '';
    const messageId = key.id || '';

    if (!chatJid || !messageId || key.fromMe || this.seenMessageIds.has(messageId)) {
      return null;
    }

    if (chatJid === 'status@broadcast' || chatJid.endsWith('@broadcast') || chatJid.endsWith('@newsletter')) {
      this.autoReplyStats.ignored += 1;
      return null;
    }

    const isGroup = chatJid.endsWith('@g.us');

    if (isGroup && !this.replyGroups) {
      this.autoReplyStats.ignored += 1;
      return null;
    }

    const text = this.extractIncomingText(rawMessage.message);

    if (!text) {
      this.autoReplyStats.ignored += 1;
      return null;
    }

    const senderJid = isGroup
      ? preferredUserJid(key.participantAlt, key.participant, chatJid)
      : preferredUserJid(key.remoteJidAlt, chatJid, key.participantAlt, key.participant);
    const replyJid = isGroup
      ? chatJid
      : preferredUserJid(key.remoteJidAlt, chatJid, key.participantAlt, key.participant);

    return {
      chatJid,
      isGroup,
      messageId,
      rawMessage,
      replyJid,
      senderJid,
      senderName: rawMessage.pushName || '',
      text
    };
  }

  extractIncomingText(message = {}) {
    const content = this.unwrapMessage(message);

    if (!content || typeof content !== 'object') {
      return '';
    }

    const candidates = [
      content.conversation,
      content.extendedTextMessage?.text,
      content.imageMessage?.caption,
      content.videoMessage?.caption,
      content.documentMessage?.caption,
      content.buttonsResponseMessage?.selectedDisplayText,
      content.buttonsResponseMessage?.selectedButtonId,
      content.listResponseMessage?.title,
      content.listResponseMessage?.singleSelectReply?.selectedRowId,
      content.templateButtonReplyMessage?.selectedDisplayText,
      content.templateButtonReplyMessage?.selectedId
    ];

    return candidates
      .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
      .find(Boolean) || '';
  }

  unwrapMessage(message = {}) {
    let content = message;

    for (let depth = 0; depth < 4; depth += 1) {
      if (content?.ephemeralMessage?.message) {
        content = content.ephemeralMessage.message;
        continue;
      }

      if (content?.viewOnceMessage?.message) {
        content = content.viewOnceMessage.message;
        continue;
      }

      if (content?.viewOnceMessageV2?.message) {
        content = content.viewOnceMessageV2.message;
        continue;
      }

      if (content?.documentWithCaptionMessage?.message) {
        content = content.documentWithCaptionMessage.message;
        continue;
      }

      break;
    }

    return content;
  }

  trackMessageId(messageId) {
    this.seenMessageIds.add(messageId);

    if (this.seenMessageIds.size <= MAX_SEEN_MESSAGE_IDS) {
      return;
    }

    const [oldest] = this.seenMessageIds;
    this.seenMessageIds.delete(oldest);
  }

  async replyToIncomingMessage(incoming) {
    if (!this.responseHandler) {
      this.autoReplyStats.failed += 1;
      this.autoReplyStats.lastError = 'No Kyrovia WhatsApp response handler is configured.';
      return;
    }

    if (!this.sock || this.status !== 'connected') {
      this.autoReplyStats.failed += 1;
      this.autoReplyStats.lastError = 'WhatsApp disconnected before Kyrovia could generate a reply. Reconnect the bridge and try again.';
      return;
    }

    this.autoReplyStats.pending += 1;
    this.autoReplyStats.processed += 1;
    this.autoReplyStats.lastInboundAt = new Date().toISOString();
    this.autoReplyStats.lastIncomingText = incoming.text;
    this.autoReplyStats.lastSender = incoming.senderName || incoming.senderJid;

    try {
      const replyJid = incoming.replyJid || incoming.chatJid;
      const receiveSocket = this.sock;

      await receiveSocket.readMessages?.([incoming.rawMessage.key]).catch(() => undefined);
      await receiveSocket.sendPresenceUpdate?.('composing', replyJid).catch(() => undefined);

      const response = await this.responseHandler(incoming);
      const replyText = this.normalizeReplyText(response);
      this.autoReplyStats.lastGeneratedReply = replyText;

      if (!replyText) {
        this.autoReplyStats.ignored += 1;
        this.autoReplyStats.lastError = 'Backend generated an empty WhatsApp reply.';
        return;
      }

      const sendSocket = this.sock;

      if (!sendSocket || this.status !== 'connected') {
        throw new Error('WhatsApp disconnected while the backend reply was being generated. Reconnect the bridge and resend the message.');
      }

      const quoteMatchesRecipient = incoming.rawMessage?.key?.remoteJid === replyJid;
      const sent = await sendSocket.sendMessage(
        replyJid,
        { text: replyText },
        quoteMatchesRecipient ? { quoted: incoming.rawMessage } : {}
      );
      const sentMessageId = sent?.key?.id || '';

      if (!sentMessageId) {
        throw new Error('WhatsApp did not accept the generated backend reply.');
      }

      await sendSocket.sendPresenceUpdate?.('paused', replyJid).catch(() => undefined);

      this.autoReplyStats.replied += 1;
      this.autoReplyStats.lastReplyAt = new Date().toISOString();
      this.autoReplyStats.lastRecipient = replyJid;
      this.autoReplyStats.lastReplyStatus = 'accepted';
      this.autoReplyStats.lastSentReply = replyText;
      this.autoReplyStats.lastSentMessageId = sentMessageId;
      this.autoReplyStats.lastError = '';
    } catch (error) {
      this.autoReplyStats.failed += 1;
      this.autoReplyStats.lastError = error?.message || 'Unable to auto-reply on WhatsApp.';
    } finally {
      this.autoReplyStats.pending = Math.max(this.autoReplyStats.pending - 1, 0);
    }
  }

  normalizeReplyText(response) {
    const rawText = typeof response === 'string' ? response : response?.text;
    const text = this.stripReplyWrapper(String(rawText || '').replace(/\n{4,}/g, '\n\n\n').trim());

    if (!text) {
      return '';
    }

    return text.length > MAX_WHATSAPP_REPLY_LENGTH
      ? `${text.slice(0, MAX_WHATSAPP_REPLY_LENGTH - 24).trim()}\n\n[Reply shortened]`
      : text;
  }

  stripReplyWrapper(text) {
    let cleaned = String(text || '').trim();

    const fencedText = cleaned.match(/^```(?:text|txt|markdown|md)?\s*\n([\s\S]*?)\n```$/i);
    if (fencedText) {
      cleaned = fencedText[1].trim();
    }

    for (let count = 0; count < 3 && REPLY_LABEL_RE.test(cleaned); count += 1) {
      cleaned = cleaned.replace(REPLY_LABEL_RE, '').trim();
    }

    const quotedText = cleaned.match(/^(["'“‘])([\s\S]*)(["'”’])$/);
    if (quotedText && quotedText[2].trim()) {
      cleaned = quotedText[2].trim();
    }

    return cleaned;
  }

  async disconnect({ logout = false } = {}) {
    const sock = this.sock;

    this.sock = null;
    this.status = logout ? 'logged_out' : 'disconnected';
    this.qr = '';
    this.qrDataUrl = '';

    if (!sock) {
      return this.getStatus();
    }

    if (logout && typeof sock.logout === 'function') {
      await sock.logout().catch(() => undefined);
    } else if (typeof sock.end === 'function') {
      sock.end(undefined);
    }

    return this.getStatus();
  }

  async sendText({ to, text }) {
    if (!this.sock || this.status !== 'connected') {
      throw createWhatsAppError(409, 'WhatsApp is not connected. Pair the device first.');
    }

    const jid = normalizePhoneJid(to);
    const message = String(text || '').trim();

    if (!jid) {
      throw createWhatsAppError(400, 'Provide a WhatsApp phone number or JID.');
    }

    if (!message) {
      throw createWhatsAppError(400, 'Message text is required.');
    }

    const sent = await this.sock.sendMessage(jid, { text: message });

    if (!sent?.key?.id) {
      throw createWhatsAppError(502, 'WhatsApp did not accept the message.');
    }

    return {
      id: sent.key.id,
      to: jid,
      sentAt: new Date().toISOString()
    };
  }

  getStatus() {
    return {
      connected: this.status === 'connected',
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectReason: this.lastDisconnectReason,
      qr: this.qr,
      qrDataUrl: this.qrDataUrl,
      status: this.status,
      user: this.user,
      version: Array.isArray(this.version) ? this.version.join('.') : '',
      autoReply: {
        ...this.autoReplyStats,
        enabled: this.autoReplyEnabled,
        replyGroups: this.replyGroups
      }
    };
  }
}

function windowlessDelay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = WhatsAppService;
