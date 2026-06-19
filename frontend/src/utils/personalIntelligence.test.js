import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeWorkspaceBehavior,
  normalizeIntelligence,
  predictWorkspaceSearches
} from './personalIntelligence.js';

const workspace = {
  conversations: [
    {
      id: 'chat-1',
      messages: [
        {
          role: 'user',
          content: 'Show me Firebase authentication in React',
          createdAt: '2026-06-18T12:00:00.000Z'
        }
      ]
    }
  ],
  intelligence: {
    preferences: {
      deviceUsageEnabled: true
    },
    deviceUsage: [
      { appName: 'Chrome', category: 'Browser', minutes: 25 }
    ]
  }
};

test('normalizes intelligence defaults and analyzes stored activity', () => {
  const intelligence = normalizeIntelligence({});
  const analysis = analyzeWorkspaceBehavior(workspace);

  assert.equal(intelligence.preferences.memoryEnabled, true);
  assert.equal(intelligence.preferences.deviceUsageEnabled, false);
  assert.equal(analysis.totalUserMessages, 1);
  assert.equal(analysis.deviceUsage.totalMinutes, 25);
});

test('predicts matching searches from saved prompts', () => {
  assert.deepEqual(predictWorkspaceSearches(workspace, 'firebase', 1), [
    'Show me Firebase authentication in React'
  ]);
});
