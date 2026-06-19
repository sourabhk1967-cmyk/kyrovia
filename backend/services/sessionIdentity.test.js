const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createChatSessionKey,
  createLoginSessionId,
  resolveAccountId,
  resolveRequestSessionId
} = require('./sessionIdentity');

test('login sessions receive unique backend session ids', () => {
  const first = createLoginSessionId();
  const second = createLoginSessionId();

  assert.match(first, /^[a-f0-9-]{36}$/i);
  assert.match(second, /^[a-f0-9-]{36}$/i);
  assert.notEqual(first, second);
});

test('chat session keys isolate accounts, logins, and conversations', () => {
  const baseUser = {
    firebaseUid: 'account-a',
    sessionId: 'login-a',
    username: 'person@example.com'
  };

  const first = createChatSessionKey(baseUser, 'conversation-a');
  assert.notEqual(first, createChatSessionKey({ ...baseUser, firebaseUid: 'account-b' }, 'conversation-a'));
  assert.notEqual(first, createChatSessionKey({ ...baseUser, sessionId: 'login-b' }, 'conversation-a'));
  assert.notEqual(first, createChatSessionKey(baseUser, 'conversation-b'));
  assert.equal(first, createChatSessionKey(baseUser, 'conversation-a'));
});

test('account identity prefers stable Firebase UID over mutable username', () => {
  assert.equal(
    resolveAccountId({ firebaseUid: 'firebase-account', username: 'person@example.com' }),
    'firebase-account'
  );
  assert.equal(resolveAccountId({ username: 'person@example.com' }), 'person@example.com');
});

test('legacy tokens receive a stable derived session id', () => {
  const first = resolveRequestSessionId({}, 'legacy-token');
  const second = resolveRequestSessionId({}, 'legacy-token');

  assert.equal(first, second);
  assert.match(first, /^legacy-[a-f0-9]{32}$/);
});
