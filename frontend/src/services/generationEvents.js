export class GenerationEventError extends Error {
  constructor(message, status = 502, payload = {}, terminal = false) {
    super(message);
    this.name = 'GenerationEventError';
    this.status = status;
    this.payload = payload;
    this.terminal = terminal;
  }
}

export function consumeGenerationEvent(lifecycleEvent, onEvent) {
  if (!lifecycleEvent || typeof lifecycleEvent !== 'object' || typeof lifecycleEvent.event !== 'string') {
    throw new GenerationEventError('The backend returned an invalid generation event.');
  }

  if (lifecycleEvent.event === 'error') {
    throw new GenerationEventError(
      lifecycleEvent.message || 'Generation failed.',
      lifecycleEvent.status || 500,
      lifecycleEvent,
      true
    );
  }

  if (lifecycleEvent.event !== 'heartbeat') {
    onEvent?.(lifecycleEvent);
  }

  return {
    completed: lifecycleEvent.event === 'completed',
    payload: lifecycleEvent.event === 'completed' ? lifecycleEvent.data || {} : null
  };
}

export function parseGenerationEventText(text, onEvent) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      matched: false,
      payload: null
    };
  }

  const events = [];

  for (const line of lines) {
    let event;

    try {
      event = JSON.parse(line);
    } catch (_error) {
      if (!events.length) {
        return {
          matched: false,
          payload: null
        };
      }

      throw new GenerationEventError('The backend returned an invalid generation event.');
    }

    if (!event || typeof event !== 'object' || typeof event.event !== 'string') {
      return {
        matched: false,
        payload: null
      };
    }

    events.push(event);
  }

  let completed = false;
  let payload = null;

  for (const event of events) {
    const result = consumeGenerationEvent(event, onEvent);

    if (result.completed) {
      completed = true;
      payload = result.payload;
    }
  }

  if (!completed) {
    throw new GenerationEventError('The generation stream ended before a result was returned.');
  }

  return {
    matched: true,
    payload
  };
}

export function shouldRecoverGenerationResult({
  streamResponse = false,
  requestId = '',
  terminal = false
} = {}) {
  return Boolean(streamResponse && requestId && !terminal);
}
