const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeWorkspace } = require('./workspaceStore');

test('workspace normalization preserves editable generated artifacts', () => {
  const workspace = normalizeWorkspace({
    activeId: 'chat-1',
    conversations: [
      {
        id: 'chat-1',
        title: 'Research',
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            content: 'A generated paper is attached.',
            artifacts: [
              {
                id: 'artifact-1',
                title: 'AI Research Paper',
                type: 'document',
                format: 'markdown',
                content: '# AI Research Paper\n\nEdited content.',
                plainText: 'AI Research Paper Edited content.',
                editable: true,
                modifiedAt: '2026-06-09T12:00:00.000Z'
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(workspace.conversations[0].messages[0].artifacts.length, 1);
  assert.deepEqual(workspace.conversations[0].messages[0].artifacts[0], {
    id: 'artifact-1',
    title: 'AI Research Paper',
    type: 'document',
    format: 'markdown',
    content: '# AI Research Paper\n\nEdited content.',
    plainText: 'AI Research Paper Edited content.',
    editable: true,
    modifiedAt: '2026-06-09T12:00:00.000Z'
  });
});

test('workspace normalization preserves backend visual captures', () => {
  const workspace = normalizeWorkspace({
    activeId: 'chat-1',
    conversations: [
      {
        id: 'chat-1',
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            images: [
              {
                src: '/api/chat/images/example.png',
                sourceUrl: '/api/chat/images/example.png',
                alt: 'Generated diagram',
                mimeType: 'image/png',
                captureType: 'backend-visual',
                interactiveType: 'sandboxed-html',
                interactiveHtml: '<!doctype html><html><body><input type="range"></body></html>',
                width: 640,
                height: 320
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(workspace.conversations[0].messages[0].images[0].captureType, 'backend-visual');
  assert.equal(workspace.conversations[0].messages[0].images[0].interactiveType, 'sandboxed-html');
  assert.match(workspace.conversations[0].messages[0].images[0].interactiveHtml, /input type="range"/);
});

test('workspace normalization preserves authoritative backend Markdown mode', () => {
  const workspace = normalizeWorkspace({
    conversations: [
      {
        id: 'chat-1',
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            content: '## Title\n\n- **Item**',
            messageFormat: 'backend-markdown'
          }
        ]
      }
    ]
  });

  assert.equal(workspace.conversations[0].messages[0].messageFormat, 'backend-markdown');
  assert.equal(workspace.conversations[0].messages[0].content, '## Title\n\n- **Item**');
});

test('workspace normalization preserves privacy preferences and bounded device usage', () => {
  const workspace = normalizeWorkspace({
    intelligence: {
      preferences: {
        memoryEnabled: false,
        behaviorAnalysisEnabled: true,
        predictiveSearchEnabled: false,
        deviceUsageEnabled: true,
        updatedAt: '2026-06-18T10:00:00.000Z'
      },
      deviceUsage: [
        {
          id: 'usage-1',
          appName: 'YouTube',
          category: 'Video',
          minutes: 45,
          date: '2026-06-18',
          source: 'manual'
        }
      ]
    }
  });

  assert.equal(workspace.intelligence.preferences.memoryEnabled, false);
  assert.equal(workspace.intelligence.preferences.deviceUsageEnabled, true);
  assert.deepEqual(workspace.intelligence.deviceUsage[0], {
    id: 'usage-1',
    appName: 'YouTube',
    category: 'Video',
    minutes: 45,
    date: '2026-06-18',
    source: 'manual',
    createdAt: workspace.intelligence.deviceUsage[0].createdAt
  });
});
