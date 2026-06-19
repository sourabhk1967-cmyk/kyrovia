import assert from 'node:assert/strict';
import test from 'node:test';

import { readGenerationEventStream } from './api.js';

function withBrowserTimers(fn) {
  const previousWindow = globalThis.window;

  globalThis.window = {
    ...(previousWindow || {}),
    clearTimeout,
    setTimeout
  };

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previousWindow === undefined) {
        delete globalThis.window;
        return;
      }

      globalThis.window = previousWindow;
    });
}

test('returns the completed generation payload without waiting for the stream to close', async () => {
  await withBrowserTimers(async () => {
    const encoder = new TextEncoder();
    let cancelCalled = false;
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              event: 'completed',
              data: { message: 'Final backend reply' }
            })}\n`
          )
        );
      },
      cancel() {
        cancelCalled = true;
      }
    });
    const response = {
      body,
      headers: new Headers({
        'content-type': 'application/x-ndjson; charset=utf-8'
      })
    };

    const payload = await Promise.race([
      readGenerationEventStream(response),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timed out waiting for completed event.')), 100);
      })
    ]);

    assert.deepEqual(payload, { message: 'Final backend reply' });
    assert.equal(cancelCalled, true);
  });
});
