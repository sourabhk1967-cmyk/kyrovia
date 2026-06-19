const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectIdentityRequest,
  kyroviaIdentityInstruction,
  kyroviaIdentityResponse,
  sanitizeKyroviaBranding
} = require('./identity');

const identityCases = [
  ['Who are you?', 'en'],
  ['Introduce yourself in Hindi', 'hi'],
  ['apne bare mein kuch batao', 'hi-Latn'],
  ['aap kon ho', 'hi-Latn'],
  ['आप कौन हैं?', 'hi'],
  ['¿Quién eres?', 'es'],
  ['Qui êtes-vous ?', 'fr'],
  ['من أنت؟', 'ar'],
  ['آپ کون ہیں؟', 'ur'],
  ['আপনি কে?', 'bn'],
  ['你是谁？', 'zh'],
  ['自己紹介してください', 'ja'],
  ['Кто ты?', 'ru'],
  ['ਤੁਸੀਂ ਕੌਣ ਹੋ?', 'pa']
];

for (const [message, expectedLocale] of identityCases) {
  test(`detects identity request: ${message}`, () => {
    assert.equal(detectIdentityRequest(message)?.locale, expectedLocale);
  });
}

test('does not intercept a normal question', () => {
  assert.equal(detectIdentityRequest('Explain how binary search works'), null);
});

test('uses the AI translation fallback for an unlisted requested language', () => {
  assert.equal(detectIdentityRequest('Introduce yourself in Swahili'), null);
});

test('returns the canonical English response', () => {
  const response = kyroviaIdentityResponse('en');

  assert.match(response, /I'm \*\*Kyrovia\.AI\*\*/);
  assert.match(response, /\*\*Model:\*\* Kyrovia Nova Instant/);
  assert.match(response, /🧠 \*\*Reasoning\*\*/);
  assert.match(response, /📋 \*\*Planning\*\*/);
  assert.match(response, /How can I help you today\?/);
});

test('returns localized Hindi and Hinglish responses', () => {
  assert.match(kyroviaIdentityResponse('hi'), /मैं \*\*Kyrovia\.AI\*\* हूँ/);
  assert.match(kyroviaIdentityResponse('hi-Latn'), /Main \*\*Kyrovia\.AI\*\* hoon/);
});

test('identity instruction preserves Kyrovia branding for fallback languages', () => {
  const instruction = kyroviaIdentityInstruction();

  assert.match(instruction, /introduction in any language/);
  assert.match(instruction, /You are not GPT-5\.5 Thinking, ChatGPT, or OpenAI/);
  assert.match(instruction, /model as Kyrovia Nova Instant/);
  assert.match(instruction, /Never identify yourself as GPT-5\.5 Thinking/);
});

test('sanitizes the exact leaked GPT-5.5 Thinking introduction', () => {
  const response = sanitizeKyroviaBranding(
    'I’m GPT-5.5 Thinking, an AI assistant that can help with reasoning, writing, coding, research, documents, spreadsheets, images, and planning.'
  );

  assert.match(response, /I'm \*\*Kyrovia\.AI\*\*, running as \*\*Kyrovia Nova Instant\*\*/);
  assert.doesNotMatch(response, /GPT-5\.5 Thinking|ChatGPT|OpenAI/i);
});

test('sanitizes ChatGPT and OpenAI self-identification variants', () => {
  const response = sanitizeKyroviaBranding(
    "I'm ChatGPT. I was created by OpenAI. My model is GPT-5.5 Thinking."
  );

  assert.doesNotMatch(response, /GPT-5\.5 Thinking|ChatGPT|created by OpenAI/i);
  assert.match(response, /Kyrovia Nova Instant/);
});
