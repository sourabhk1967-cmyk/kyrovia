const assert = require('node:assert/strict');
const test = require('node:test');

const {
  analyzeWorkspace,
  buildPersonalizationInstruction,
  predictSearches
} = require('./behaviorInsights');

function sampleWorkspace() {
  return {
    intelligence: {
      preferences: {
        memoryEnabled: true,
        behaviorAnalysisEnabled: true,
        predictiveSearchEnabled: true,
        deviceUsageEnabled: true
      },
      deviceUsage: [
        { appName: 'YouTube', category: 'Video', minutes: 45 },
        { appName: 'Chrome', category: 'Browser', minutes: 30 }
      ]
    },
    conversations: [
      {
        id: 'chat-1',
        title: 'React help',
        messages: [
          {
            role: 'user',
            content: 'Help me improve React performance and Firebase caching',
            createdAt: '2026-06-17T18:00:00.000Z'
          }
        ]
      },
      {
        id: 'chat-2',
        title: 'Firebase',
        messages: [
          {
            role: 'user',
            content: 'Explain Firebase authentication for React',
            createdAt: '2026-06-18T18:00:00.000Z'
          }
        ]
      }
    ]
  };
}

test('analyzes saved chat and consented app usage without inferring traits', () => {
  const analysis = analyzeWorkspace(sampleWorkspace());

  assert.equal(analysis.totalConversations, 2);
  assert.equal(analysis.totalUserMessages, 2);
  assert.equal(analysis.deviceUsage.totalMinutes, 75);
  assert.equal(analysis.deviceUsage.topApps[0].name, 'YouTube');
  assert.ok(analysis.topics.some(({ topic }) => topic === 'react'));
});

test('predicts searches from recent history and respects the preference toggle', () => {
  const workspace = sampleWorkspace();
  assert.ok(predictSearches(workspace, 'firebase').some((query) => /firebase/i.test(query)));

  workspace.intelligence.preferences.predictiveSearchEnabled = false;
  assert.deepEqual(predictSearches(workspace, ''), []);
});

test('builds bounded cross-chat memory and treats it as background', () => {
  const instruction = buildPersonalizationInstruction(sampleWorkspace(), 'chat-2');

  assert.match(instruction, /background context/);
  assert.match(instruction, /React performance/);
  assert.match(instruction, /Explain Firebase authentication/);
  assert.match(instruction, /YouTube 45 min/);
});
