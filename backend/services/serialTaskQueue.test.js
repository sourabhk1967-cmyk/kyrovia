const assert = require('node:assert/strict');
const test = require('node:test');

const SerialTaskQueue = require('./serialTaskQueue');

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('serial queue returns ten concurrent results in FIFO order without overlapping tasks', async () => {
  const queue = new SerialTaskQueue({ maxPending: 25, waitTimeoutMs: 5000 });
  const started = [];
  let activeTasks = 0;
  let maximumActiveTasks = 0;

  const requests = Array.from({ length: 10 }, (_, index) =>
    queue.enqueue(async () => {
      started.push(index);
      activeTasks += 1;
      maximumActiveTasks = Math.max(maximumActiveTasks, activeTasks);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeTasks -= 1;
      return `reply-${index}`;
    })
  );

  const replies = await Promise.all(requests);
  assert.deepEqual(started, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(replies, [
    'reply-0',
    'reply-1',
    'reply-2',
    'reply-3',
    'reply-4',
    'reply-5',
    'reply-6',
    'reply-7',
    'reply-8',
    'reply-9'
  ]);
  assert.equal(maximumActiveTasks, 1);
  assert.equal(queue.getStatus().stats.completed, 10);
});

test('serial queue rejects work beyond the configured waiting capacity', async () => {
  const queue = new SerialTaskQueue({ maxPending: 1, waitTimeoutMs: 5000 });
  const gate = deferred();
  const first = queue.enqueue(() => gate.promise);
  await new Promise((resolve) => setImmediate(resolve));
  const second = queue.enqueue(async () => 'second');
  const third = queue.enqueue(async () => 'third');

  await assert.rejects(third, (error) => error.code === 'QUEUE_FULL' && error.status === 503);
  gate.resolve('first');
  assert.equal(await first, 'first');
  assert.equal(await second, 'second');
});

test('serial queue removes a disconnected request before it reaches the browser', async () => {
  const queue = new SerialTaskQueue({ maxPending: 5, waitTimeoutMs: 5000 });
  const gate = deferred();
  const controller = new AbortController();
  const first = queue.enqueue(() => gate.promise);
  await new Promise((resolve) => setImmediate(resolve));
  const cancelled = queue.enqueue(async () => 'should-not-run', {
    signal: controller.signal
  });

  controller.abort();
  await assert.rejects(cancelled, (error) => error.code === 'QUEUE_CANCELLED' && error.status === 499);
  gate.resolve('first');
  assert.equal(await first, 'first');
  assert.equal(queue.getStatus().stats.cancelled, 1);
});

test('concurrent queue starts ten different session keys at the same time', async () => {
  const queue = new SerialTaskQueue({
    maxConcurrent: 10,
    maxPending: 25,
    waitTimeoutMs: 5000
  });
  const gate = deferred();
  const started = [];
  let activeTasks = 0;
  let maximumActiveTasks = 0;

  const requests = Array.from({ length: 10 }, (_, index) =>
    queue.enqueue(
      async () => {
        started.push(index);
        activeTasks += 1;
        maximumActiveTasks = Math.max(maximumActiveTasks, activeTasks);
        await gate.promise;
        activeTasks -= 1;
        return index;
      },
      { key: `session-${index}` }
    )
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started.length, 10);
  assert.equal(queue.getStatus().activeCount, 10);
  assert.equal(maximumActiveTasks, 10);

  gate.resolve();
  assert.deepEqual(await Promise.all(requests), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('concurrent queue keeps the same session key ordered', async () => {
  const queue = new SerialTaskQueue({
    maxConcurrent: 10,
    maxPending: 25,
    waitTimeoutMs: 5000
  });
  const firstGate = deferred();
  const started = [];

  const first = queue.enqueue(
    async () => {
      started.push('first');
      await firstGate.promise;
      return 'first';
    },
    { key: 'shared-session' }
  );
  const second = queue.enqueue(
    async () => {
      started.push('second');
      return 'second';
    },
    { key: 'shared-session' }
  );
  const other = queue.enqueue(
    async () => {
      started.push('other');
      return 'other';
    },
    { key: 'other-session' }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ['first', 'other']);
  assert.equal(await other, 'other');

  firstGate.resolve();
  assert.equal(await first, 'first');
  assert.equal(await second, 'second');
  assert.deepEqual(started, ['first', 'other', 'second']);
});
