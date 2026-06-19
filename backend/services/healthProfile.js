const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.cwd(), process.env.KYROVIA_DATA_DIR || './data');
const HEALTH_DIR = path.join(DATA_DIR, 'health');
const MAX_TEXT = 1200;
const MAX_ITEMS = 100;
const MAX_HISTORY = 180;
const TODAY = () => new Date().toISOString().slice(0, 10);

const PROVIDERS = [
  {
    id: 'health-connect',
    name: 'Health Connect',
    status: 'available',
    description: 'Android health data hub for steps, sleep, heart rate, exercise, and nutrition exports.'
  },
  {
    id: 'google-fit',
    name: 'Google Fit',
    status: 'consent_required',
    description: 'Sync steps, calories burned, and active minutes from an existing approved Google Fit REST integration.'
  },
  {
    id: 'smart-watch',
    name: 'Smart watch',
    status: 'import_ready',
    description: 'Import watch readings such as heart rate, active minutes, sleep, and workouts.'
  },
  {
    id: 'fitness-band',
    name: 'Fitness band',
    status: 'import_ready',
    description: 'Import band readings such as steps, calories, sleep, and activity sessions.'
  }
];

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function cleanString(value, fallback = '', maxLength = MAX_TEXT) {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.replace(/\u0000/g, '').slice(0, maxLength).trim();
}

function cleanNumber(value, fallback = 0, min = 0, max = 100000) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
}

function cleanDate(value, fallback = TODAY()) {
  const raw = cleanString(value, '', 40);
  const date = raw ? new Date(raw) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toISOString().slice(0, 10);
}

function cleanTime(value, fallback = '09:00') {
  const text = cleanString(value, fallback, 10);

  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function safeUsername(username) {
  return cleanString(username, 'default', 120).replace(/[^a-z0-9._-]/gi, '_') || 'default';
}

function profilePath(username) {
  return path.join(HEALTH_DIR, `${safeUsername(username)}.health.json`);
}

function normalizeMetricEntry(entry = {}, fallbackDate = TODAY()) {
  return {
    date: cleanDate(entry.date, fallbackDate),
    steps: Math.round(cleanNumber(entry.steps, 0, 0, 200000)),
    sleepHours: cleanNumber(entry.sleepHours, 0, 0, 24),
    heartRate: Math.round(cleanNumber(entry.heartRate, 0, 0, 240)),
    waterLiters: cleanNumber(entry.waterLiters, 0, 0, 20),
    calories: Math.round(cleanNumber(entry.calories, 0, 0, 20000)),
    activeMinutes: Math.round(cleanNumber(entry.activeMinutes, 0, 0, 1440)),
    weightKg: cleanNumber(entry.weightKg, 0, 0, 400),
    bpSystolic: Math.round(cleanNumber(entry.bpSystolic, 0, 0, 260)),
    bpDiastolic: Math.round(cleanNumber(entry.bpDiastolic, 0, 0, 180)),
    bloodSugarMgDl: Math.round(cleanNumber(entry.bloodSugarMgDl, 0, 0, 1000)),
    mood: cleanString(entry.mood, '', 80),
    notes: cleanString(entry.notes, '', 500)
  };
}

function normalizeMedicine(item = {}) {
  return {
    id: cleanString(item.id, createId('medicine'), 180),
    name: cleanString(item.name, 'Medicine', 160) || 'Medicine',
    dose: cleanString(item.dose, '', 160),
    times: Array.isArray(item.times) && item.times.length
      ? item.times.slice(0, 8).map((time) => cleanTime(time))
      : [cleanTime(item.time)],
    withFood: item.withFood !== false,
    notes: cleanString(item.notes, '', 500),
    active: item.active !== false
  };
}

function normalizeCheckup(item = {}) {
  return {
    id: cleanString(item.id, createId('checkup'), 180),
    date: cleanDate(item.date),
    type: cleanString(item.type, 'General check-up', 160) || 'General check-up',
    result: cleanString(item.result, '', 500),
    doctor: cleanString(item.doctor, '', 160),
    notes: cleanString(item.notes, '', 700),
    nextDue: cleanDate(item.nextDue, '')
  };
}

function normalizeReminder(item = {}) {
  return {
    id: cleanString(item.id, createId('reminder'), 180),
    type: ['medicine', 'food', 'water', 'exercise', 'checkup'].includes(item.type) ? item.type : 'medicine',
    label: cleanString(item.label, 'Reminder', 180) || 'Reminder',
    time: cleanTime(item.time),
    days: Array.isArray(item.days) && item.days.length
      ? item.days.slice(0, 7).map((day) => cleanString(day, '', 16)).filter(Boolean)
      : ['daily'],
    active: item.active !== false
  };
}

function normalizeGoals(goals = {}) {
  return {
    steps: Math.round(cleanNumber(goals.steps, 8000, 1000, 50000)),
    sleepHours: cleanNumber(goals.sleepHours, 7.5, 3, 12),
    waterLiters: cleanNumber(goals.waterLiters, 2.5, 0.5, 8),
    activeMinutes: Math.round(cleanNumber(goals.activeMinutes, 30, 5, 240))
  };
}

function providerDefaults() {
  return Object.fromEntries(
    PROVIDERS.map((provider) => [
      provider.id,
      {
        connected: false,
        connectedAt: '',
        lastSync: '',
        status: provider.status,
        source: provider.id,
        note: provider.description
      }
    ])
  );
}

function defaultProfile() {
  const today = TODAY();

  return {
    updatedAt: new Date().toISOString(),
    providers: PROVIDERS,
    connections: providerDefaults(),
    goals: normalizeGoals(),
    metrics: normalizeMetricEntry({ date: today }, today),
    metricHistory: [normalizeMetricEntry({ date: today }, today)],
    medicines: [],
    checkups: [],
    reminders: [],
    preferences: {
      diet: '',
      exerciseLevel: '',
      routineNotes: ''
    },
    plan: null
  };
}

function normalizeProfile(seed = {}) {
  const base = defaultProfile();
  const metricHistory = Array.isArray(seed.metricHistory)
    ? seed.metricHistory.slice(-MAX_HISTORY).map((entry) => normalizeMetricEntry(entry))
    : base.metricHistory;
  const metrics = normalizeMetricEntry(seed.metrics || metricHistory[metricHistory.length - 1] || base.metrics);
  const connections = {
    ...base.connections,
    ...(seed.connections && typeof seed.connections === 'object' ? seed.connections : {})
  };

  return {
    ...base,
    updatedAt: cleanString(seed.updatedAt, base.updatedAt, 60) || base.updatedAt,
    connections,
    goals: normalizeGoals(seed.goals || base.goals),
    metrics,
    metricHistory: upsertMetric(metricHistory, metrics).slice(-MAX_HISTORY),
    medicines: Array.isArray(seed.medicines) ? seed.medicines.slice(0, MAX_ITEMS).map(normalizeMedicine) : [],
    checkups: Array.isArray(seed.checkups) ? seed.checkups.slice(0, MAX_ITEMS).map(normalizeCheckup) : [],
    reminders: Array.isArray(seed.reminders) ? seed.reminders.slice(0, MAX_ITEMS).map(normalizeReminder) : [],
    preferences: {
      diet: cleanString(seed.preferences?.diet, '', 240),
      exerciseLevel: cleanString(seed.preferences?.exerciseLevel, '', 120),
      routineNotes: cleanString(seed.preferences?.routineNotes, '', 600)
    },
    plan: seed.plan && typeof seed.plan === 'object' ? seed.plan : null
  };
}

function upsertMetric(history, metric) {
  const normalized = normalizeMetricEntry(metric);
  const next = (Array.isArray(history) ? history : []).filter((entry) => entry.date !== normalized.date);

  next.push(normalized);
  next.sort((left, right) => left.date.localeCompare(right.date));
  return next;
}

function hasMetricData(metric = {}) {
  return [
    metric.steps,
    metric.sleepHours,
    metric.heartRate,
    metric.waterLiters,
    metric.calories,
    metric.activeMinutes,
    metric.weightKg,
    metric.bpSystolic,
    metric.bpDiastolic,
    metric.bloodSugarMgDl
  ].some((value) => Number(value) > 0) || Boolean(metric.mood || metric.notes);
}

async function readHealthProfile(username) {
  const filePath = profilePath(username);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return normalizeProfile(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultProfile();
    }

    throw error;
  }
}

async function migrateHealthProfile(fromAccountId, toAccountId) {
  const fromId = cleanString(fromAccountId, '', 240);
  const toId = cleanString(toAccountId, '', 240);

  if (!fromId || !toId || fromId === toId) {
    return;
  }

  const sourcePath = profilePath(fromId);
  const targetPath = profilePath(toId);

  try {
    await fs.access(targetPath);
    return;
  } catch (_error) {
    // The UID profile does not exist yet.
  }

  try {
    await fs.mkdir(HEALTH_DIR, { recursive: true });
    await fs.rename(sourcePath, targetPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function writeHealthProfile(username, profile) {
  const normalized = normalizeProfile({
    ...profile,
    updatedAt: new Date().toISOString()
  });
  const filePath = profilePath(username);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  await fs.mkdir(HEALTH_DIR, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
  return normalized;
}

async function updateHealthProfile(username, patch = {}) {
  const current = await readHealthProfile(username);
  const next = normalizeProfile({
    ...current,
    ...patch,
    connections: {
      ...current.connections,
      ...(patch.connections || {})
    },
    preferences: {
      ...current.preferences,
      ...(patch.preferences || {})
    }
  });

  return writeHealthProfile(username, next);
}

async function connectHealthSource(username, sourceId, metadata = {}) {
  const provider = PROVIDERS.find((item) => item.id === sourceId);

  if (!provider) {
    const error = new Error('Health source is not supported.');
    error.status = 400;
    throw error;
  }

  const current = await readHealthProfile(username);
  const connection = {
    ...current.connections[sourceId],
    connected: true,
    connectedAt: current.connections[sourceId]?.connectedAt || new Date().toISOString(),
    lastSync: current.connections[sourceId]?.lastSync || '',
    status: provider.id === 'google-fit' ? 'consent_required' : 'ready_for_import',
    source: sourceId,
    note: cleanString(metadata.note, provider.description, 600)
  };

  return updateHealthProfile(username, {
    connections: {
      [sourceId]: connection
    }
  });
}

async function importFitnessData(username, payload = {}) {
  const sourceId = cleanString(payload.source, 'manual', 80) || 'manual';
  const current = await readHealthProfile(username);
  const records = Array.isArray(payload.records) && payload.records.length
    ? payload.records
    : [payload.metrics || payload];
  let metricHistory = current.metricHistory.filter(hasMetricData);

  for (const record of records.slice(0, 60)) {
    const date = cleanDate(record?.date);
    const existing = metricHistory.find((entry) => entry.date === date) || {};
    const merged = {
      ...existing,
      ...record,
      date,
      notes: cleanString(record?.notes, existing.notes || '', 500),
      mood: cleanString(record?.mood, existing.mood || '', 80)
    };

    metricHistory = upsertMetric(metricHistory, normalizeMetricEntry(merged));
  }

  const latest = [...metricHistory].sort((left, right) => right.date.localeCompare(left.date))[0] || current.metrics;
  const connection = current.connections[sourceId]
    ? {
        ...current.connections[sourceId],
        connected: true,
        lastSync: new Date().toISOString(),
        status: 'synced'
      }
    : undefined;

  return updateHealthProfile(username, {
    metrics: latest,
    metricHistory,
    connections: connection ? { [sourceId]: connection } : current.connections
  });
}

function scoreRatio(value, target) {
  if (!target || !value) {
    return 0;
  }

  return Math.max(0, Math.min(1, value / target));
}

function buildHealthInsight(profile) {
  const goals = profile.goals;
  const metrics = profile.metrics;
  const recent = [...profile.metricHistory]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-7);
  const avgSteps = average(recent.map((item) => item.steps).filter(Boolean));
  const avgSleep = average(recent.map((item) => item.sleepHours).filter(Boolean));
  const avgCalories = average(recent.map((item) => item.calories).filter(Boolean));
  const avgActiveMinutes = average(recent.map((item) => item.activeMinutes).filter(Boolean));
  const movement = scoreRatio(avgSteps || metrics.steps, goals.steps);
  const sleep = scoreRatio(avgSleep || metrics.sleepHours, goals.sleepHours);
  const hydration = scoreRatio(metrics.waterLiters, goals.waterLiters);
  const activity = scoreRatio(metrics.activeMinutes, goals.activeMinutes);
  const medicine = profile.medicines.length ? 0.82 : 0.55;
  const healthBalance = Math.round(((movement + sleep + hydration + activity + medicine) / 5) * 100);

  return {
    healthBalance,
    summary: balanceSummary(healthBalance),
    weekly: recent,
    averages: {
      activeMinutes: Math.round(avgActiveMinutes || 0),
      calories: Math.round(avgCalories || 0),
      steps: Math.round(avgSteps || 0),
      sleepHours: Number((avgSleep || 0).toFixed(1))
    },
    flags: buildFlags(profile),
    suggestions: buildFitnessSuggestions(profile, {
      avgActiveMinutes,
      avgCalories,
      avgSteps
    }),
    trends: buildFitnessTrends(recent)
  };
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function balanceSummary(score) {
  if (score >= 80) {
    return 'Your routine signals look balanced. Keep the rhythm steady and review weekly trends.';
  }

  if (score >= 60) {
    return 'Your routine has a workable base. Small improvements in sleep, movement, hydration, or reminders can lift the balance.';
  }

  return 'Your routine needs attention. Start with gentle movement, regular meals, hydration, and medicine reminders.';
}

function buildFlags(profile) {
  const flags = [];
  const metrics = profile.metrics;
  const combinedText = [
    metrics.notes,
    ...profile.checkups.map((item) => `${item.type} ${item.result} ${item.notes}`)
  ].join(' ').toLowerCase();

  if (/\b(chest pain|shortness of breath|fainting|stroke|severe bleeding|suicidal|self harm)\b/i.test(combinedText)) {
    flags.push('Urgent symptoms were mentioned. Seek emergency or local urgent medical care now.');
  }

  if (metrics.bpSystolic >= 140 || metrics.bpDiastolic >= 90) {
    flags.push('Blood pressure entry is above common wellness targets. Discuss repeated readings with a clinician.');
  }

  if (metrics.bloodSugarMgDl >= 200) {
    flags.push('Blood sugar entry is high. Confirm measurement context and speak with a clinician.');
  }

  return flags;
}

function buildFitnessSuggestions(profile, averages = {}) {
  const suggestions = [];
  const stepGoal = profile.goals.steps;
  const activeGoal = profile.goals.activeMinutes;
  const steps = averages.avgSteps || profile.metrics.steps;
  const activeMinutes = averages.avgActiveMinutes || profile.metrics.activeMinutes;
  const calories = averages.avgCalories || profile.metrics.calories;

  if (!steps && !activeMinutes && !calories) {
    return ['Connect a fitness source or add daily metrics to receive activity-based suggestions.'];
  }

  if (steps < stepGoal * 0.6) {
    suggestions.push(`Your recent step average is below 60% of the ${stepGoal.toLocaleString()}-step goal. Try two gentle 10-minute walks and increase gradually.`);
  } else if (steps < stepGoal) {
    suggestions.push(`You are approaching the ${stepGoal.toLocaleString()}-step goal. One short walk or a few movement breaks may close the daily gap.`);
  } else {
    suggestions.push('Your recent step average meets the current goal. Keep the routine consistent and include recovery when needed.');
  }

  if (activeMinutes < activeGoal * 0.7) {
    suggestions.push(`Active minutes are below the ${activeGoal}-minute target. Add low-impact activity in manageable blocks rather than making a sudden large increase.`);
  } else {
    suggestions.push('Your active-minute trend is near or above the current target. Balance activity with sleep, hydration, and rest.');
  }

  if (calories) {
    suggestions.push(`Recent recorded energy expenditure averages about ${Math.round(calories).toLocaleString()} kcal per day. Treat this as an activity trend, not a food-intake prescription.`);
  }

  return suggestions.slice(0, 4);
}

function buildFitnessTrends(recent = []) {
  const withActivity = recent.filter((item) => item.steps || item.calories || item.activeMinutes);
  const midpoint = Math.max(withActivity.length - 3, 0);
  const latest = withActivity.slice(midpoint);
  const previous = withActivity.slice(Math.max(midpoint - 3, 0), midpoint);

  function change(field) {
    const latestAverage = average(latest.map((item) => Number(item[field]) || 0));
    const previousAverage = average(previous.map((item) => Number(item[field]) || 0));

    if (!previousAverage || !latestAverage) {
      return 0;
    }

    return Math.round(((latestAverage - previousAverage) / previousAverage) * 100);
  }

  return {
    activeMinutesPercent: change('activeMinutes'),
    caloriesPercent: change('calories'),
    stepsPercent: change('steps')
  };
}

function buildDeterministicPlan(profile, aiText = '', aiError = '') {
  const insight = buildHealthInsight(profile);
  const medicines = profile.medicines.filter((item) => item.active);
  const medicineReminders = medicines.flatMap((medicine) =>
    medicine.times.map((time) => ({
      type: 'medicine',
      label: `${medicine.name}${medicine.dose ? ` - ${medicine.dose}` : ''}`,
      time,
      note: medicine.withFood ? 'Take with food if your prescription allows it.' : medicine.notes
    }))
  );
  const doctorSuggestions = suggestDoctor(profile);

  return {
    generatedAt: new Date().toISOString(),
    summary: insight.summary,
    healthBalance: insight.healthBalance,
    warnings: insight.flags,
    routine: [
      'Morning: water, medicine reminders, 10 minutes of mobility, and a protein-rich breakfast.',
      'Midday: short walk, balanced lunch, posture break, and hydration check.',
      'Evening: light exercise or yoga, simple dinner, medicine reminders, and a fixed sleep wind-down.'
    ],
    reminders: [
      ...medicineReminders,
      { type: 'water', label: 'Hydration check', time: '11:00', note: 'Spread water intake through the day.' },
      { type: 'food', label: 'Meal planning', time: '19:30', note: 'Keep dinner lighter if sleep quality is low.' },
      { type: 'exercise', label: 'Movement session', time: '18:30', note: 'Choose walking, cycling, stretching, or yoga.' }
    ].slice(0, 24),
    foodIntake: [
      'Build each main meal around vegetables, protein, fiber-rich carbohydrates, and healthy fats.',
      'Keep caffeine and heavy meals away from bedtime if sleep is poor.',
      'Adjust diet with a clinician if you track diabetes, kidney disease, pregnancy, allergies, or prescribed diet restrictions.'
    ],
    exerciseYoga: [
      'Start with 20-30 minutes of walking or low-impact cardio on most days.',
      'Add two short strength sessions per week using bodyweight movements.',
      'Use gentle yoga, breathing, and mobility work on recovery days.'
    ],
    doctorSuggestions,
    aiText: cleanString(aiText, '', 4000),
    aiError: cleanString(aiError, '', 500),
    insight
  };
}

function suggestDoctor(profile) {
  const suggestions = new Set(['General physician for routine health review']);
  const metrics = profile.metrics;
  const text = [
    metrics.notes,
    ...profile.checkups.map((item) => `${item.type} ${item.result} ${item.notes}`)
  ].join(' ').toLowerCase();

  if (metrics.bpSystolic >= 140 || metrics.bpDiastolic >= 90 || /\b(bp|blood pressure|heart|pulse)\b/.test(text)) {
    suggestions.add('Cardiologist if repeated blood pressure, chest discomfort, or heart-rate concerns continue');
  }

  if (metrics.bloodSugarMgDl >= 140 || /\b(sugar|diabetes|glucose|hba1c)\b/.test(text)) {
    suggestions.add('Endocrinologist for blood sugar or hormone-related concerns');
  }

  if (/\b(joint|back pain|knee|shoulder|injury)\b/.test(text)) {
    suggestions.add('Orthopedist or physiotherapist for pain, injury, or mobility limits');
  }

  if (/\b(stress|anxiety|sleep|insomnia|mood)\b/.test(text)) {
    suggestions.add('Mental health professional or sleep specialist for stress, mood, or sleep concerns');
  }

  return [...suggestions].slice(0, 5);
}

async function saveHealthPlan(username, plan) {
  return updateHealthProfile(username, {
    plan
  });
}

module.exports = {
  PROVIDERS,
  buildDeterministicPlan,
  buildHealthInsight,
  connectHealthSource,
  importFitnessData,
  migrateHealthProfile,
  normalizeMetricEntry,
  readHealthProfile,
  saveHealthPlan,
  updateHealthProfile
};
