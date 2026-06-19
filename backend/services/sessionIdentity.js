const { createHash, randomUUID } = require('crypto');

function createLoginSessionId() {
  return randomUUID();
}

function resolveAccountId(user = {}) {
  return String(user.firebaseUid || user.username || '').trim().slice(0, 240);
}

function resolveRequestSessionId(user = {}, token = '') {
  if (typeof user.sessionId === 'string' && user.sessionId.trim()) {
    return user.sessionId.trim().slice(0, 180);
  }

  if (typeof user.jti === 'string' && user.jti.trim()) {
    return user.jti.trim().slice(0, 180);
  }

  if (token) {
    return `legacy-${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
  }

  return 'legacy-session';
}

function createChatSessionKey(user = {}, conversationId = '') {
  const normalizedConversationId =
    typeof conversationId === 'string' ? conversationId.trim().slice(0, 180) : '';
  const accountId = resolveAccountId(user);
  const sessionId = resolveRequestSessionId(user);

  if (!accountId || !normalizedConversationId) {
    return '';
  }

  return JSON.stringify([accountId, sessionId, normalizedConversationId]);
}

module.exports = {
  createChatSessionKey,
  createLoginSessionId,
  resolveAccountId,
  resolveRequestSessionId
};
