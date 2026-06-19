const STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'does',
  'from', 'have', 'into', 'just', 'make', 'more', 'need', 'please', 'should', 'some', 'than',
  'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'using',
  'very', 'want', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your'
]);

export const DEFAULT_INTELLIGENCE_PREFERENCES = {
  memoryEnabled: true,
  behaviorAnalysisEnabled: true,
  predictiveSearchEnabled: true,
  deviceUsageEnabled: false,
  updatedAt: ''
};

function cleanText(value = '', maxLength = 180) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizeIntelligence(intelligence = {}) {
  return {
    preferences: {
      ...DEFAULT_INTELLIGENCE_PREFERENCES,
      ...(intelligence.preferences || {})
    },
    deviceUsage: Array.isArray(intelligence.deviceUsage) ? intelligence.deviceUsage : []
  };
}

function collectUserMessages(workspace = {}) {
  return (workspace.conversations || [])
    .flatMap((conversation) =>
      (conversation.messages || [])
        .filter((message) => message.role === 'user' && cleanText(message.content))
        .map((message) => ({
          ...message,
          appName: message.appName || conversation.appName || ''
        }))
    )
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

function extractTopics(messages, limit = 8) {
  const counts = new Map();

  messages.forEach((message, index) => {
    const weight = Math.max(1, 5 - Math.floor(index / 12));
    const words = cleanText(message.content, 800).toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];

    for (const word of words) {
      const topic = word.replace(/^[.-]+|[.-]+$/g, '');

      if (topic.length < 3 || topic.length > 32 || STOP_WORDS.has(topic) || /^\d+$/.test(topic)) {
        continue;
      }

      counts.set(topic, (counts.get(topic) || 0) + weight);
    }
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([topic, score]) => ({ topic, score }));
}

function summarizeUsage(records = []) {
  const appTotals = new Map();
  const categoryTotals = new Map();
  let totalMinutes = 0;

  for (const record of records) {
    const minutes = Number(record.minutes) || 0;

    if (minutes <= 0) {
      continue;
    }

    totalMinutes += minutes;
    appTotals.set(record.appName, (appTotals.get(record.appName) || 0) + minutes);
    categoryTotals.set(record.category, (categoryTotals.get(record.category) || 0) + minutes);
  }

  const rank = (map) =>
    [...map.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([name, minutes]) => ({ name, minutes }));

  return {
    totalMinutes,
    topApps: rank(appTotals).slice(0, 5),
    categories: rank(categoryTotals).slice(0, 5)
  };
}

export function analyzeWorkspaceBehavior(workspace = {}) {
  const intelligence = normalizeIntelligence(workspace.intelligence);
  const messages = collectUserMessages(workspace);
  const activeDays = new Set();
  const activeHours = new Map();
  const appCounts = new Map();

  for (const message of messages) {
    const date = new Date(message.createdAt);

    if (!Number.isNaN(date.getTime())) {
      activeDays.add(date.toISOString().slice(0, 10));
      activeHours.set(date.getHours(), (activeHours.get(date.getHours()) || 0) + 1);
    }

    if (message.appName) {
      appCounts.set(message.appName, (appCounts.get(message.appName) || 0) + 1);
    }
  }

  const peakHour = [...activeHours.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  const favoriteApp = [...appCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '';

  return {
    totalConversations: (workspace.conversations || []).filter((conversation) => conversation.messages?.length).length,
    totalUserMessages: messages.length,
    activeDays: activeDays.size,
    peakHour: Number.isInteger(peakHour) ? peakHour : null,
    favoriteApp,
    topics: intelligence.preferences.behaviorAnalysisEnabled ? extractTopics(messages) : [],
    deviceUsage: intelligence.preferences.deviceUsageEnabled
      ? summarizeUsage(intelligence.deviceUsage)
      : summarizeUsage([])
  };
}

export function predictWorkspaceSearches(workspace = {}, prefix = '', limit = 5) {
  const intelligence = normalizeIntelligence(workspace.intelligence);

  if (!intelligence.preferences.predictiveSearchEnabled) {
    return [];
  }

  const messages = collectUserMessages(workspace);
  const topics = extractTopics(messages);
  const normalizedPrefix = cleanText(prefix, 140).toLowerCase();
  const recentQueries = messages.map((message) => cleanText(message.content, 140));
  const candidates = [
    ...recentQueries,
    ...topics.map(({ topic }) => `Explain ${topic}`),
    ...topics.map(({ topic }) => `Latest information about ${topic}`)
  ];
  const seen = new Set();

  return candidates.filter((candidate) => {
    const key = candidate.toLowerCase();

    if (
      candidate.length < 3 ||
      seen.has(key) ||
      (normalizedPrefix && !key.includes(normalizedPrefix) && !key.startsWith(normalizedPrefix))
    ) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, limit);
}

export function formatPeakHour(hour) {
  if (!Number.isInteger(hour)) {
    return 'Not enough data';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric'
  }).format(new Date(2026, 0, 1, hour));
}
