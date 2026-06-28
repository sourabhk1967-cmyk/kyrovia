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

test('delivers an image-ready message before the completed generation event', async () => {
  await withBrowserTimers(async () => {
    const encoder = new TextEncoder();
    const imagePayload = {
      message: '',
      imageIntent: true,
      images: [
        {
          src: 'data:image/png;base64,aW1hZ2U=',
          sourceUrl: '/api/chat/images/generated.png'
        }
      ]
    };
    const received = [];
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              event: 'message',
              partial: false,
              data: imagePayload
            })}\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              event: 'completed',
              data: imagePayload
            })}\n`
          )
        );
      }
    });
    const response = {
      body,
      headers: new Headers({
        'content-type': 'application/x-ndjson; charset=utf-8'
      })
    };

    const payload = await readGenerationEventStream(response, (event) => {
      received.push(event.event);
    });

    assert.deepEqual(received, ['message', 'completed']);
    assert.deepEqual(payload, imagePayload);
  });
});
