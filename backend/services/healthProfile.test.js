const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('imports health metrics and builds a wellness plan', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kyrovia-health-test-'));
  process.env.KYROVIA_DATA_DIR = tempDir;
  delete require.cache[require.resolve('./healthProfile')];
  const {
    buildDeterministicPlan,
    buildHealthInsight,
    connectHealthSource,
    importFitnessData,
    migrateHealthProfile,
    readHealthProfile,
    updateHealthProfile
  } = require('./healthProfile');

  const username = 'health-user@example.com';
  let profile = await connectHealthSource(username, 'health-connect');

  assert.equal(profile.connections['health-connect'].connected, true);
  assert.equal(profile.connections['health-connect'].status, 'ready_for_import');

  profile = await importFitnessData(username, {
    source: 'health-connect',
    records: [
      { date: '2026-06-16', steps: 6200, calories: 1900, sleepHours: 6.5, activeMinutes: 25, waterLiters: 1.8 },
      { date: '2026-06-17', steps: 9200, calories: 2250, sleepHours: 7.4, activeMinutes: 42, waterLiters: 2.6 }
    ]
  });

  assert.equal(profile.metrics.date, '2026-06-17');
  assert.equal(profile.metrics.steps, 9200);
  assert.equal(profile.metrics.calories, 2250);
  assert.equal(profile.metricHistory.length >= 2, true);

  profile = await updateHealthProfile(username, {
    medicines: [{ name: 'Vitamin D', dose: '1000 IU', times: ['09:00'] }],
    checkups: [{ type: 'Blood pressure', result: '142/92', notes: 'BP is elevated' }],
    metrics: {
      ...profile.metrics,
      bpSystolic: 142,
      bpDiastolic: 92
    }
  });

  const insight = buildHealthInsight(profile);
  const plan = buildDeterministicPlan(profile);

  assert.equal(Number.isInteger(insight.healthBalance), true);
  assert.equal(insight.averages.calories > 0, true);
  assert.match(insight.suggestions.join(' '), /energy expenditure/i);
  assert.match(plan.reminders.map((item) => item.label).join(' '), /Vitamin D/);
  assert.match(plan.doctorSuggestions.join(' '), /Cardiologist/);

  const saved = await readHealthProfile(username);
  assert.equal(saved.medicines[0].name, 'Vitamin D');

  await migrateHealthProfile(username, 'firebase-health-user');
  const migrated = await readHealthProfile('firebase-health-user');
  assert.equal(migrated.medicines[0].name, 'Vitamin D');
  assert.equal(migrated.metrics.steps, 9200);
});
