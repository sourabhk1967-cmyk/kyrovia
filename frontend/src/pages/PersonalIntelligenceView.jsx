import {
  Activity,
  Brain,
  Clock3,
  Database,
  Gauge,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  analyzeWorkspaceBehavior,
  formatPeakHour,
  normalizeIntelligence,
  predictWorkspaceSearches
} from '../utils/personalIntelligence';
import styles from './PersonalIntelligenceView.module.css';

const USAGE_CATEGORIES = ['Social', 'Video', 'Browser', 'Productivity', 'Education', 'Games', 'Health', 'Other'];

function Toggle({ checked, description, label, onChange }) {
  return (
    <label className={styles.toggleRow}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span aria-hidden="true" className={styles.toggleTrack}>
        <span />
      </span>
    </label>
  );
}

export default function PersonalIntelligenceView({ onUsePrediction, onWorkspaceChange, workspace }) {
  const intelligence = normalizeIntelligence(workspace.intelligence);
  const analysis = useMemo(() => analyzeWorkspaceBehavior(workspace), [workspace]);
  const predictions = useMemo(() => predictWorkspaceSearches(workspace, '', 6), [workspace]);
  const [usageDraft, setUsageDraft] = useState({
    appName: '',
    category: 'Productivity',
    minutes: '',
    date: new Date().toISOString().slice(0, 10)
  });

  function updateIntelligence(updater) {
    onWorkspaceChange((current) => ({
      ...current,
      intelligence: updater(normalizeIntelligence(current.intelligence))
    }));
  }

  function updatePreference(key, value) {
    updateIntelligence((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        [key]: value,
        updatedAt: new Date().toISOString()
      }
    }));
  }

  function addUsageRecord(event) {
    event.preventDefault();
    const appName = usageDraft.appName.trim();
    const minutes = Number(usageDraft.minutes);

    if (!appName || !Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    updateIntelligence((current) => ({
      ...current,
      deviceUsage: [
        ...current.deviceUsage,
        {
          id: `usage-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
          appName,
          category: usageDraft.category,
          minutes: Math.min(Math.round(minutes), 1440),
          date: usageDraft.date,
          source: 'manual',
          createdAt: new Date().toISOString()
        }
      ]
    }));
    setUsageDraft((current) => ({
      ...current,
      appName: '',
      minutes: ''
    }));
  }

  function removeUsageRecord(recordId) {
    updateIntelligence((current) => ({
      ...current,
      deviceUsage: current.deviceUsage.filter((record) => record.id !== recordId)
    }));
  }

  return (
    <section className={styles.pane}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><Brain size={16} /> Personal Intelligence</span>
          <h1>Memory that stays under your control</h1>
          <p>Kyrovia learns from saved chats and optional usage summaries. You can switch each signal off independently.</p>
        </div>
        <div className={styles.privacyBadge}><ShieldCheck size={20} /> Account-private</div>
      </header>

      <div className={styles.metricGrid}>
        <article><Database size={21} /><strong>{analysis.totalConversations}</strong><span>saved chats</span></article>
        <article><Activity size={21} /><strong>{analysis.totalUserMessages}</strong><span>prompts analyzed</span></article>
        <article><Gauge size={21} /><strong>{analysis.activeDays}</strong><span>active days</span></article>
        <article><Clock3 size={21} /><strong>{formatPeakHour(analysis.peakHour)}</strong><span>usual active time</span></article>
      </div>

      <div className={styles.columns}>
        <article className={styles.card}>
          <div className={styles.cardHeading}>
            <div><Brain size={20} /><span><strong>Memory and behavior</strong><small>Derived only from your Kyrovia workspace</small></span></div>
          </div>
          <div className={styles.toggleList}>
            <Toggle
              checked={intelligence.preferences.memoryEnabled}
              description="Use relevant details from saved chats in future answers."
              label="Remember saved history"
              onChange={(value) => updatePreference('memoryEnabled', value)}
            />
            <Toggle
              checked={intelligence.preferences.behaviorAnalysisEnabled}
              description="Show recurring topics and activity patterns without inferring sensitive traits."
              label="Behavior analysis"
              onChange={(value) => updatePreference('behaviorAnalysisEnabled', value)}
            />
            <Toggle
              checked={intelligence.preferences.predictiveSearchEnabled}
              description="Suggest likely searches from your own recent prompts and recurring topics."
              label="Predictive search"
              onChange={(value) => updatePreference('predictiveSearchEnabled', value)}
            />
          </div>

          <div className={styles.insightBlock}>
            <h2>Recurring topics</h2>
            {analysis.topics.length ? (
              <div className={styles.topicList}>
                {analysis.topics.map(({ topic }) => <span key={topic}>{topic}</span>)}
              </div>
            ) : (
              <p>Enable behavior analysis and keep chatting to build a useful topic profile.</p>
            )}
          </div>

          <div className={styles.insightBlock}>
            <h2>Predicted next searches</h2>
            {predictions.length ? (
              <div className={styles.predictionList}>
                {predictions.map((prediction) => (
                  <button key={prediction} onClick={() => onUsePrediction(prediction)} type="button">
                    <Search size={16} /><span>{prediction}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>Predictions appear after Kyrovia has a few saved prompts to learn from.</p>
            )}
          </div>
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeading}>
            <div><Smartphone size={20} /><span><strong>Phone and app usage</strong><small>Optional aggregated data only</small></span></div>
          </div>
          <p className={styles.boundaryNote}>
            A web app cannot silently read Android or iPhone app usage. Add a summary manually here, or send the same records from a permission-based native companion.
          </p>
          <Toggle
            checked={intelligence.preferences.deviceUsageEnabled}
            description="Allow imported usage summaries to influence insights and relevant suggestions."
            label="Use device-usage summaries"
            onChange={(value) => updatePreference('deviceUsageEnabled', value)}
          />

          <form className={styles.usageForm} onSubmit={addUsageRecord}>
            <input
              aria-label="App name"
              disabled={!intelligence.preferences.deviceUsageEnabled}
              onChange={(event) => setUsageDraft((current) => ({ ...current, appName: event.target.value }))}
              placeholder="App name"
              value={usageDraft.appName}
            />
            <select
              aria-label="Usage category"
              disabled={!intelligence.preferences.deviceUsageEnabled}
              onChange={(event) => setUsageDraft((current) => ({ ...current, category: event.target.value }))}
              value={usageDraft.category}
            >
              {USAGE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
            <input
              aria-label="Minutes used"
              disabled={!intelligence.preferences.deviceUsageEnabled}
              min="1"
              onChange={(event) => setUsageDraft((current) => ({ ...current, minutes: event.target.value }))}
              placeholder="Minutes"
              type="number"
              value={usageDraft.minutes}
            />
            <input
              aria-label="Usage date"
              disabled={!intelligence.preferences.deviceUsageEnabled}
              onChange={(event) => setUsageDraft((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={usageDraft.date}
            />
            <button disabled={!intelligence.preferences.deviceUsageEnabled} type="submit">
              <Plus size={17} /> Add usage
            </button>
          </form>

          {analysis.deviceUsage.topApps.length ? (
            <div className={styles.usageSummary}>
              <h2>Usage analysis</h2>
              <strong>{analysis.deviceUsage.totalMinutes} minutes recorded</strong>
              {analysis.deviceUsage.topApps.map((app) => (
                <div key={app.name}><span>{app.name}</span><b>{app.minutes} min</b></div>
              ))}
            </div>
          ) : null}

          <div className={styles.usageRecords}>
            {intelligence.deviceUsage.slice().reverse().slice(0, 12).map((record) => (
              <div key={record.id}>
                <span><strong>{record.appName}</strong><small>{record.category} · {record.date}</small></span>
                <b>{record.minutes} min</b>
                <button aria-label={`Remove ${record.appName} usage`} onClick={() => removeUsageRecord(record.id)} type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
