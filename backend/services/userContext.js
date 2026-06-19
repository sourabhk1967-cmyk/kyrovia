const MAX_ACCOUNT_NAME_LENGTH = 160;

function normalizeGoogleAccountName(value = '') {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ACCOUNT_NAME_LENGTH);
}

function googleAccountNameFromClaims(claims = {}) {
  const givenFamilyName = [claims.given_name, claims.family_name]
    .map((value) => normalizeGoogleAccountName(value))
    .filter(Boolean)
    .join(' ');

  const name = [
    claims.name,
    claims.displayName,
    givenFamilyName
  ]
    .map((value) => normalizeGoogleAccountName(value))
    .find(Boolean);

  if (name) {
    return name;
  }

  const email = normalizeGoogleAccountName(claims.email);
  return email ? email.split('@')[0] : '';
}

function googleAccountNameFromUser(user = {}) {
  return [
    user.name,
    user.displayName
  ]
    .map((value) => normalizeGoogleAccountName(value))
    .find(Boolean) || '';
}

function kyroviaUserContextInstruction(user = {}) {
  const accountName = googleAccountNameFromUser(user);

  if (!accountName) {
    return '';
  }

  const quotedAccountName = JSON.stringify(accountName);

  return [
    'Current signed-in Kyrovia user context:',
    `- Google account display name: ${quotedAccountName}`,
    `When greeting or addressing the user by name, use exactly ${quotedAccountName}.`,
    'Ignore any different personal name from the shared backend browser session.'
  ].join('\n');
}

module.exports = {
  googleAccountNameFromClaims,
  googleAccountNameFromUser,
  kyroviaUserContextInstruction,
  normalizeGoogleAccountName
};
