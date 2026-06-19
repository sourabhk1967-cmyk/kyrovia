import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GenerationEventError,
  consumeGenerationEvent,
  parseGenerationEventText,
  shouldRecoverGenerationResult
} from './generationEvents.js';

test('parses a completed NDJSON response even when transport metadata is unavailable', () => {
  const received = [];
  const result = parseGenerationEventText(
    [
      JSON.stringify({ event: 'accepted', requestId: 'request-1' }),
      JSON.stringify({ event: 'message', data: { message: 'Partial reply' } }),
      JSON.stringify({ event: 'completed', data: { message: 'Final reply' } })
    ].join('\n'),
    (event) => received.push(event.event)
  );

  assert.equal(result.matched, true);
  assert.deepEqual(result.payload, { message: 'Final reply' });
  assert.deepEqual(received, ['accepted', 'message', 'completed']);
});

test('does not mistake an ordinary JSON response for an event stream', () => {
  assert.deepEqual(parseGenerationEventText(JSON.stringify({ message: 'Regular response' })), {
    matched: false,
    payload: null
  });
});

test('marks backend generation errors as terminal', () => {
  assert.throws(
    () => consumeGenerationEvent({ event: 'error', status: 504, message: 'Generation timed out' }),
    (error) => {
      assert.ok(error instanceof GenerationEventError);
      assert.equal(error.status, 504);
      assert.equal(error.terminal, true);
      return true;
    }
  );
});

test('reports a truncated lifecycle stream so result recovery can take over', () => {
  assert.throws(
    () => parseGenerationEventText(JSON.stringify({ event: 'accepted', requestId: 'request-1' })),
    /ended before a result/
  );
});

test('recovers when the request header arrived but the proxy delivered no stream event', () => {
  assert.equal(
    shouldRecoverGenerationResult({
      streamResponse: true,
      requestId: 'request-from-response-header',
      terminal: false
    }),
    true
  );
});

test('does not recover terminal backend errors or requests without an id', () => {
  assert.equal(
    shouldRecoverGenerationResult({
      streamResponse: true,
      requestId: 'request-1',
      terminal: true
    }),
    false
  );
  assert.equal(shouldRecoverGenerationResult({ streamResponse: true }), false);
});
