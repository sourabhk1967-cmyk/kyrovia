const { randomUUID } = require('crypto');

function createQueueError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.expose = true;
  return error;
}

class SerialTaskQueue {
  constructor(options = {}) {
    this.maxPending = Number.isInteger(options.maxPending) && options.maxPending > 0 ? options.maxPending : 25;
    this.maxConcurrent =
      Number.isInteger(options.maxConcurrent) && options.maxConcurrent > 0 ? options.maxConcurrent : 1;
    this.waitTimeoutMs =
      Number.isInteger(options.waitTimeoutMs) && options.waitTimeoutMs > 0 ? options.waitTimeoutMs : 60 * 60 * 1000;
    this.pending = [];
    this.activeJobs = new Map();
    this.closed = false;
    this.pumpScheduled = false;
    this.stats = {
      accepted: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      rejected: 0
    };
  }

  enqueue(task, options = {}) {
    if (typeof task !== 'function') {
      return Promise.reject(createQueueError(500, 'INVALID_QUEUE_TASK', 'Queue task must be a function.'));
    }

    if (this.closed) {
      return Promise.reject(createQueueError(503, 'QUEUE_CLOSED', 'Kyrovia is restarting. Please try again shortly.'));
    }

    if (this.pending.length >= this.maxPending) {
      this.stats.rejected += 1;
      return Promise.reject(
        createQueueError(
          503,
          'QUEUE_FULL',
          `Kyrovia is busy with ${this.pending.length + 1} AI requests. Please retry shortly.`
        )
      );
    }

    const queuedAt = Date.now();
    const id = randomUUID();
    const position = this.pending.length + this.activeJobs.size + 1;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const job = {
      id,
      kind: String(options.kind || 'task'),
      key: typeof options.key === 'string' ? options.key.trim().slice(0, 500) : '',
      task,
      queuedAt,
      startedAt: 0,
      resolve: resolvePromise,
      reject: rejectPromise,
      signal: options.signal,
      onStarted: typeof options.onStarted === 'function' ? options.onStarted : null,
      abortHandler: null,
      timeoutId: null,
      settled: false
    };

    if (job.signal?.aborted) {
      this.stats.cancelled += 1;
      job.settled = true;
      job.reject(createQueueError(499, 'QUEUE_CANCELLED', 'The client disconnected before the request started.'));
      return promise;
    }

    if (job.signal) {
      job.abortHandler = () => {
        if (this.activeJobs.has(job.id) || job.settled) {
          return;
        }

        this.cancelPendingJob(
          job,
          createQueueError(499, 'QUEUE_CANCELLED', 'The client disconnected before the request started.')
        );
      };
      job.signal.addEventListener('abort', job.abortHandler, { once: true });
    }

    job.timeoutId = setTimeout(() => {
      if (this.activeJobs.has(job.id) || job.settled) {
        return;
      }

      this.cancelPendingJob(
        job,
        createQueueError(503, 'QUEUE_WAIT_TIMEOUT', 'Kyrovia is busy and this request waited too long. Please retry.')
      );
    }, this.waitTimeoutMs);
    job.timeoutId.unref?.();

    this.pending.push(job);
    this.stats.accepted += 1;
    if (typeof options.onQueued === 'function') {
      try {
        options.onQueued({
          id,
          kind: job.kind,
          position,
          queuedAt,
          pending: this.pending.length,
          maxPending: this.maxPending,
          maxConcurrent: this.maxConcurrent
        });
      } catch (_error) {
        // Queue lifecycle callbacks must never strand an accepted request.
      }
    }
    this.schedulePump();
    return promise;
  }

  getStatus() {
    const now = Date.now();
    const activeJobs = [...this.activeJobs.values()].map((job) => ({
      id: job.id,
      kind: job.kind,
      key: job.key,
      runningMs: Math.max(0, now - job.startedAt)
    }));

    return {
      processing: activeJobs.length > 0,
      active: activeJobs[0] || null,
      activeJobs,
      activeCount: activeJobs.length,
      pending: this.pending.filter((job) => !job.settled).length,
      maxPending: this.maxPending,
      maxConcurrent: this.maxConcurrent,
      waitTimeoutMs: this.waitTimeoutMs,
      stats: { ...this.stats }
    };
  }

  close() {
    this.closed = true;
    const error = createQueueError(503, 'QUEUE_CLOSED', 'Kyrovia is restarting. Please try again shortly.');

    for (const job of [...this.pending]) {
      this.cancelPendingJob(job, error);
    }
  }

  cancelPendingJob(job, error) {
    if (job.settled || this.activeJobs.has(job.id)) {
      return false;
    }

    const index = this.pending.indexOf(job);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }

    job.settled = true;
    this.stats.cancelled += 1;
    this.cleanupJob(job);
    job.reject(error);
    return true;
  }

  schedulePump() {
    if (this.pumpScheduled || this.closed || this.activeJobs.size >= this.maxConcurrent) {
      return;
    }

    this.pumpScheduled = true;
    queueMicrotask(() => {
      this.pumpScheduled = false;
      this.pump();
    });
  }

  pump() {
    while (!this.closed && this.activeJobs.size < this.maxConcurrent) {
      const jobIndex = this.findRunnableJobIndex();

      if (jobIndex < 0) {
        return;
      }

      const [job] = this.pending.splice(jobIndex, 1);

      if (job.settled) {
        continue;
      }

      this.startJob(job);
    }
  }

  findRunnableJobIndex() {
    const activeKeys = new Set(
      [...this.activeJobs.values()].map((job) => job.key).filter(Boolean)
    );

    return this.pending.findIndex((job) => !job.settled && (!job.key || !activeKeys.has(job.key)));
  }

  async startJob(job) {
    this.activeJobs.set(job.id, job);
    job.startedAt = Date.now();
    this.cleanupJob(job);
    if (job.onStarted) {
      try {
        job.onStarted({
          id: job.id,
          kind: job.kind,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          waitMs: Math.max(0, job.startedAt - job.queuedAt)
        });
      } catch (_error) {
        // Queue lifecycle callbacks must never interrupt task execution.
      }
    }

    try {
      const result = await job.task({
        id: job.id,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt
      });
      job.settled = true;
      this.stats.completed += 1;
      job.resolve(result);
    } catch (error) {
      job.settled = true;
      this.stats.failed += 1;
      job.reject(error);
    } finally {
      this.activeJobs.delete(job.id);
      this.schedulePump();
    }
  }

  cleanupJob(job) {
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
      job.timeoutId = null;
    }

    if (job.signal && job.abortHandler) {
      job.signal.removeEventListener('abort', job.abortHandler);
      job.abortHandler = null;
    }
  }
}

module.exports = SerialTaskQueue;
