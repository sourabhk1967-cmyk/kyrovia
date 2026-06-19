const advancedModes = [
  ['standard', 'Standard', 'Balanced assistant mode for everyday work', 'St', '#111111'],
  ['biologicalAge', 'Biological Age', 'Estimate wellness signals and longevity factors', 'BA', '#0f766e'],
  ['intention', 'Intention Mapper', 'Clarify goals, motives, and next actions', 'IN', '#7c3aed'],
  ['randomDecision', 'Random Decision', 'Compare uncertain options with controlled randomness', 'RD', '#f59e0b'],
  ['memoryCompression', 'Memory Compression', 'Condense long context into durable notes', 'MC', '#2563eb'],
  ['linguisticFingerprint', 'Linguistic Fingerprint', 'Analyze writing style, tone, and identity markers', 'LF', '#be123c'],
  ['sleepArchitecture', 'Sleep Architecture', 'Map sleep quality, routines, and recovery patterns', 'SA', '#4338ca'],
  ['financialStress', 'Financial Stress', 'Identify money pressure and planning risks', 'FS', '#15803d'],
  ['relationshipDecay', 'Relationship Decay', 'Track communication drift and repair options', 'RD', '#db2777'],
  ['painPattern', 'Pain Pattern', 'Organize symptom timing, triggers, and care notes', 'PP', '#b45309'],
  ['hormonalCycle', 'Hormonal Cycle', 'Track cycle-linked mood, energy, and symptoms', 'HC', '#c026d3'],
  ['dreamPattern', 'Dream Pattern', 'Extract themes, recurrence, and emotional signals', 'DP', '#6d28d9'],
  ['vocalBiomarker', 'Vocal Biomarker', 'Reason about voice logs and wellness signals', 'VB', '#0369a1'],
  ['realityAnchor', 'Reality Anchor', 'Ground anxious or uncertain thoughts in evidence', 'RA', '#475569'],
  ['chemicalExposure', 'Chemical Exposure', 'Structure exposure history and safety follow-up', 'CE', '#65a30d'],
  ['griefTracker', 'Grief Tracker', 'Journal grief waves, supports, and coping patterns', 'GT', '#334155'],
  ['epistemology', 'Epistemology', 'Audit claims, certainty, and evidence quality', 'EP', '#0f172a'],
  ['entropyScore', 'Entropy Score', 'Measure disorder, drift, and process stability', 'ES', '#ea580c'],
  ['resilienceIndex', 'Resilience Index', 'Assess stress recovery and protective factors', 'RI', '#0891b2'],
  ['decisionRegret', 'Decision Regret', 'Analyze past choices and future regret risk', 'DR', '#991b1b']
];

function getAdvancedModes() {
  return advancedModes.map(([id, name, description, initials, color]) => ({
    id,
    name,
    description,
    initials,
    color,
    mode: id,
    promptTemplate: `Use Advanced Mode: ${id}. Analyze the user's input with structured reasoning, practical next steps, and clear uncertainty boundaries.`
  }));
}

function findAdvancedMode(modeId) {
  return getAdvancedModes().find((mode) => mode.id === modeId) || null;
}

module.exports = {
  advancedModeIds: advancedModes.map(([id]) => id),
  findAdvancedMode,
  getAdvancedModes
};
