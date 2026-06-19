const test = require('node:test');
const assert = require('node:assert/strict');

const {
  googleAccountNameFromClaims,
  googleAccountNameFromUser,
  kyroviaUserContextInstruction,
  normalizeGoogleAccountName
} = require('./userContext');

test('keeps Google account display names exact apart from unsafe whitespace', () => {
  assert.equal(normalizeGoogleAccountName('  Arogya Link  '), 'Arogya Link');
  assert.equal(normalizeGoogleAccountName('Arogya\nLink'), 'Arogya Link');
});

test('reads Google account name from Firebase claims in priority order', () => {
  assert.equal(
    googleAccountNameFromClaims({
      name: 'Arogya Link',
      displayName: 'Sourabh'
    }),
    'Arogya Link'
  );

  assert.equal(
    googleAccountNameFromClaims({
      given_name: 'Arogya',
      family_name: 'Link'
    }),
    'Arogya Link'
  );
});

test('falls back to email prefix when Firebase claims do not contain a name', () => {
  assert.equal(googleAccountNameFromClaims({ email: 'linkarogya25@gmail.com' }), 'linkarogya25');
});

test('builds an instruction that forces greetings to use the current account name', () => {
  const instruction = kyroviaUserContextInstruction({
    name: 'Arogya Link',
    displayName: 'Sourabh'
  });

  assert.match(instruction, /Google account display name: "Arogya Link"/);
  assert.match(instruction, /use exactly "Arogya Link"/);
  assert.match(instruction, /shared backend browser session/);
  assert.equal(googleAccountNameFromUser({ name: 'Arogya Link' }), 'Arogya Link');
});
