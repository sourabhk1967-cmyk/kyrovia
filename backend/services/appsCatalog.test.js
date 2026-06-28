const assert = require('node:assert/strict');
const test = require('node:test');

const { getAppDetail } = require('./appsCatalog');

test('GitHub detail uses Kyrovia branding and a safe sign-in fallback', () => {
  const previousClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const previousAuthorizeUrl = process.env.GITHUB_OAUTH_AUTHORIZE_URL;

  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.GITHUB_OAUTH_AUTHORIZE_URL;

  try {
    const github = getAppDetail('github');

    assert.equal(github.detail.developer, 'Kyrovia');
    assert.equal(github.detail.connectUrl, 'https://github.com/login');
    assert.equal(github.detail.oauthConfigured, false);
  } finally {
    if (previousClientId === undefined) {
      delete process.env.GITHUB_OAUTH_CLIENT_ID;
    } else {
      process.env.GITHUB_OAUTH_CLIENT_ID = previousClientId;
    }

    if (previousAuthorizeUrl === undefined) {
      delete process.env.GITHUB_OAUTH_AUTHORIZE_URL;
    } else {
      process.env.GITHUB_OAUTH_AUTHORIZE_URL = previousAuthorizeUrl;
    }
  }
});

test('GitHub detail builds a Kyrovia OAuth authorization URL when configured', () => {
  const previousClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const previousRedirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  const previousScope = process.env.GITHUB_OAUTH_SCOPE;

  process.env.GITHUB_OAUTH_CLIENT_ID = 'kyrovia-client';
  process.env.GITHUB_OAUTH_REDIRECT_URI = 'https://kyrovia.example/connect/github';
  process.env.GITHUB_OAUTH_SCOPE = 'repo read:user';

  try {
    const github = getAppDetail('github');
    const connectUrl = new URL(github.detail.connectUrl);

    assert.equal(github.detail.oauthConfigured, true);
    assert.equal(connectUrl.origin, 'https://github.com');
    assert.equal(connectUrl.pathname, '/login/oauth/authorize');
    assert.equal(connectUrl.searchParams.get('client_id'), 'kyrovia-client');
    assert.equal(connectUrl.searchParams.get('redirect_uri'), 'https://kyrovia.example/connect/github');
    assert.equal(connectUrl.searchParams.get('scope'), 'repo read:user');
  } finally {
    if (previousClientId === undefined) {
      delete process.env.GITHUB_OAUTH_CLIENT_ID;
    } else {
      process.env.GITHUB_OAUTH_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri === undefined) {
      delete process.env.GITHUB_OAUTH_REDIRECT_URI;
    } else {
      process.env.GITHUB_OAUTH_REDIRECT_URI = previousRedirectUri;
    }

    if (previousScope === undefined) {
      delete process.env.GITHUB_OAUTH_SCOPE;
    } else {
      process.env.GITHUB_OAUTH_SCOPE = previousScope;
    }
  }
});
