const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.resolve(process.cwd(), process.env.KYROVIA_DATA_DIR || './data');
const EMPTY_TITLE = 'New chat';
const MAX_CONVERSATIONS = 200;
const MAX_MESSAGES = 2000;
const MAX_LIBRARY_ITEMS = 500;
const MAX_PROJECTS = 100;
const MAX_SCHEDULED_TASKS = 200;
const MAX_DEVICE_USAGE_RECORDS = 3650;
const MAX_GENERATED_FILES = 12;
const MAX_ARTIFACTS = 4;
const MAX_TEXT_LENGTH = 200000;
const MAX_IMAGE_DATA_URL_LENGTH = 24 * 1024 * 1024;
const MAX_INTERACTIVE_HTML_LENGTH = 300000;
const MAX_FILE_DATA_URL_LENGTH = 36 * 1024 * 1024;

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function cleanString(value, fallback = '', maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value.slice(0, maxLength);
}

function cleanDate(value, fallback) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function cleanId(value, prefix) {
  const id = cleanString(value, '', 160).trim();
  return id || createId(prefix);
}

function workspacePath(username) {
  const safeUsername = cleanString(username, 'default', 120).replace(/[^a-z0-9._-]/gi, '_') || 'default';
  return path.join(DATA_DIR, `${safeUsername}.workspace.json`);
}

function corruptWorkspacePath(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.corrupt-${timestamp}`;
}

function normalizeAttachment(attachment = {}) {
  return {
    id: cleanString(attachment.id, createId('attachment'), 180),
    name: cleanString(attachment.name, 'Untitled file', 240),
    size: Number.isFinite(attachment.size) ? attachment.size : 0,
    type: cleanString(attachment.type, 'application/octet-stream', 180),
    lastModified: Number.isFinite(attachment.lastModified) ? attachment.lastModified : Date.now()
  };
}

function normalizeImage(image = {}) {
  return {
    src: cleanString(image.src, '', MAX_IMAGE_DATA_URL_LENGTH),
    sourceUrl: cleanString(image.sourceUrl, '', 2048),
    alt: cleanString(image.alt, 'Generated image', 500),
    mimeType: cleanString(image.mimeType, '', 100),
    captureType: ['backend-visual', 'generated-image'].includes(image.captureType) ? image.captureType : '',
    interactiveType: image.interactiveType === 'sandboxed-html' ? 'sandboxed-html' : '',
    interactiveHtml: cleanString(image.interactiveHtml, '', MAX_INTERACTIVE_HTML_LENGTH),
    width: Number.isFinite(image.width) ? image.width : undefined,
    height: Number.isFinite(image.height) ? image.height : undefined
  };
}

function normalizeSource(source = {}) {
  return {
    id: cleanString(source.id, createId('source'), 180),
    title: cleanString(source.title, 'Source', 240),
    url: cleanString(source.url, '', 2048),
    displayUrl: cleanString(source.displayUrl, '', 300),
    hostname: cleanString(source.hostname, '', 180),
    linkText: cleanString(source.linkText, '', 500),
    ariaLabel: cleanString(source.ariaLabel, '', 500),
    titleAttribute: cleanString(source.titleAttribute, '', 500),
    sourceText: cleanString(source.sourceText, '', 1200),
    sourceType: cleanString(source.sourceType, '', 120)
  };
}

function normalizeGeneratedFile(file = {}) {
  return {
    id: cleanString(file.id, createId('file'), 180),
    name: cleanString(file.name, 'Generated file', 260).trim() || 'Generated file',
    mimeType: cleanString(file.mimeType, 'application/octet-stream', 180),
    size: Number.isFinite(file.size) ? file.size : 0,
    dataUrl: cleanString(file.dataUrl, '', MAX_FILE_DATA_URL_LENGTH),
    sourceUrl: cleanString(file.sourceUrl, '', 2048),
    linkText: cleanString(file.linkText, '', 500)
  };
}

function normalizeArtifact(artifact = {}) {
  return {
    id: cleanString(artifact.id, createId('artifact'), 180),
    title: cleanString(artifact.title, 'Generated document', 240).trim() || 'Generated document',
    type: ['document', 'code', 'spreadsheet'].includes(artifact.type) ? artifact.type : 'document',
    format: cleanString(artifact.format, 'markdown', 80),
    content: cleanString(artifact.content, ''),
    plainText: cleanString(artifact.plainText, ''),
    editable: artifact.editable !== false,
    modifiedAt: cleanDate(artifact.modifiedAt, '')
  };
}

function normalizeLibraryItem(item = {}) {
  const now = new Date().toISOString();

  return {
    id: cleanId(item.id, 'library'),
    name: cleanString(item.name, 'Untitled file', 260).trim() || 'Untitled file',
    kind: ['image', 'file', 'code', 'link'].includes(item.kind) ? item.kind : 'file',
    mimeType: cleanString(item.mimeType, 'application/octet-stream', 180),
    size: Number.isFinite(item.size) ? item.size : 0,
    url: cleanString(item.url, '', MAX_TEXT_LENGTH),
    dataUrl: cleanString(item.dataUrl, '', MAX_TEXT_LENGTH),
    content: cleanString(item.content, '', MAX_TEXT_LENGTH),
    conversationId: cleanString(item.conversationId, '', 180),
    messageId: cleanString(item.messageId, '', 180),
    source: cleanString(item.source, '', 80),
    createdAt: cleanDate(item.createdAt, now),
    modifiedAt: cleanDate(item.modifiedAt, item.createdAt || now)
  };
}

function normalizeProject(project = {}) {
  const now = new Date().toISOString();
  const createdAt = cleanDate(project.createdAt, now);
  const memoryMode = project.memoryMode === 'project-only' ? 'project-only' : 'default';

  return {
    id: cleanId(project.id, 'project'),
    name: cleanString(project.name, 'Untitled project', 180).trim() || 'Untitled project',
    memoryMode,
    createdAt,
    updatedAt: cleanDate(project.updatedAt, createdAt)
  };
}

function normalizeScheduledTask(task = {}) {
  const now = new Date().toISOString();
  const createdAt = cleanDate(task.createdAt, now);
  const cadence = ['Daily', 'Weekdays', 'Weekly', 'Event-based'].includes(task.cadence)
    ? task.cadence
    : 'Daily';
  const delivery = ['Kyrovia chat', 'Email', 'WhatsApp'].includes(task.delivery)
    ? task.delivery
    : 'Kyrovia chat';

  return {
    id: cleanId(task.id, 'scheduled'),
    title: cleanString(task.title, 'Scheduled task', 180).trim() || 'Scheduled task',
    prompt: cleanString(task.prompt, '', 8000).trim(),
    cadence,
    delivery,
    active: task.active !== false,
    status: cleanString(task.status, 'setup', 80).trim() || 'setup',
    connectedApps: Array.isArray(task.connectedApps)
      ? task.connectedApps.slice(0, 12).map((appId) => cleanString(appId, '', 120)).filter(Boolean)
      : [],
    approvalMode: ['ask', 'safe', 'full'].includes(task.approvalMode) ? task.approvalMode : 'ask',
    accessScopes: Array.isArray(task.accessScopes)
      ? task.accessScopes.slice(0, 12).map((scopeId) => cleanString(scopeId, '', 120)).filter(Boolean)
      : [],
    createdAt,
    updatedAt: cleanDate(task.updatedAt, createdAt)
  };
}

function normalizeScheduledSettings(settings = {}) {
  const deviceScopes =
    settings.deviceScopes && typeof settings.deviceScopes === 'object'
      ? settings.deviceScopes
      : {};

  return {
    approvalMode: ['ask', 'safe', 'full'].includes(settings.approvalMode)
      ? settings.approvalMode
      : 'ask',
    connectedApps: Array.isArray(settings.connectedApps)
      ? settings.connectedApps
          .slice(0, 24)
          .map((appId) => cleanString(appId, '', 120))
          .filter(Boolean)
      : ['interests', 'web'],
    deviceScopes: {
      notifications: deviceScopes.notifications === true,
      microphone: deviceScopes.microphone === true,
      location: deviceScopes.location === true,
      files: deviceScopes.files === true
    },
    updatedAt: cleanDate(settings.updatedAt, '')
  };
}

function normalizeIntelligencePreferences(preferences = {}) {
  return {
    memoryEnabled: preferences.memoryEnabled !== false,
    behaviorAnalysisEnabled: preferences.behaviorAnalysisEnabled !== false,
    predictiveSearchEnabled: preferences.predictiveSearchEnabled !== false,
    deviceUsageEnabled: preferences.deviceUsageEnabled === true,
    updatedAt: cleanDate(preferences.updatedAt, '')
  };
}

function normalizeDeviceUsageRecord(record = {}) {
  const now = new Date().toISOString();
  const minutes = Number(record.minutes);

  return {
    id: cleanId(record.id, 'usage'),
    appName: cleanString(record.appName, 'Unknown app', 160).trim() || 'Unknown app',
    category: cleanString(record.category, 'Other', 80).trim() || 'Other',
    minutes: Number.isFinite(minutes) ? Math.max(0, Math.min(Math.round(minutes), 1440)) : 0,
    date: cleanDate(record.date, now).slice(0, 10),
    source: ['manual', 'android-companion', 'ios-import'].includes(record.source)
      ? record.source
      : 'manual',
    createdAt: cleanDate(record.createdAt, now)
  };
}

function normalizeIntelligence(intelligence = {}) {
  return {
    preferences: normalizeIntelligencePreferences(intelligence.preferences),
    deviceUsage: Array.isArray(intelligence.deviceUsage)
      ? intelligence.deviceUsage
          .slice(-MAX_DEVICE_USAGE_RECORDS)
          .map(normalizeDeviceUsageRecord)
          .filter((record) => record.minutes > 0)
      : []
  };
}

function normalizeMessage(message = {}) {
  const now = new Date().toISOString();
  const role = message.role === 'user' ? 'user' : 'assistant';

  return {
    id: cleanId(message.id, 'message'),
    role,
    content: cleanString(message.content, ''),
    images: Array.isArray(message.images) ? message.images.slice(0, 4).map(normalizeImage) : [],
    files: Array.isArray(message.files) ? message.files.slice(0, MAX_GENERATED_FILES).map(normalizeGeneratedFile) : [],
    sources: Array.isArray(message.sources) ? message.sources.slice(0, 12).map(normalizeSource) : [],
    artifacts: Array.isArray(message.artifacts) ? message.artifacts.slice(0, MAX_ARTIFACTS).map(normalizeArtifact) : [],
    attachments: Array.isArray(message.attachments) ? message.attachments.slice(0, 12).map(normalizeAttachment) : [],
    conversationUrl: cleanString(message.conversationUrl, '', 2048),
    feedback: ['good', 'bad'].includes(message.feedback) ? message.feedback : '',
    model: cleanString(message.model, '', 120),
    provider: cleanString(message.provider, '', 80),
    messageFormat: message.messageFormat === 'backend-markdown' ? 'backend-markdown' : '',
    appId: cleanString(message.appId, '', 120),
    appName: cleanString(message.appName, '', 160),
    intent: cleanString(message.intent, '', 80),
    scheduledTaskId: cleanString(message.scheduledTaskId, '', 180),
    createdAt: cleanDate(message.createdAt, now)
  };
}

function normalizeConversation(conversation = {}) {
  const now = new Date().toISOString();
  const createdAt = cleanDate(conversation.createdAt, now);

  return {
    id: cleanId(conversation.id, 'chat'),
    title: cleanString(conversation.title, EMPTY_TITLE, 180).trim() || EMPTY_TITLE,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.slice(0, MAX_MESSAGES).map(normalizeMessage)
      : [],
    appId: cleanString(conversation.appId, '', 120),
    appName: cleanString(conversation.appName, '', 160),
    appIcon: cleanString(conversation.appIcon, '', 24),
    projectId: cleanString(conversation.projectId, '', 180),
    projectName: cleanString(conversation.projectName, '', 180),
    scheduledTaskId: cleanString(conversation.scheduledTaskId, '', 180),
    createdAt,
    updatedAt: cleanDate(conversation.updatedAt, createdAt)
  };
}

function normalizeWorkspace(workspace = {}) {
  const conversations = Array.isArray(workspace.conversations)
    ? workspace.conversations.slice(0, MAX_CONVERSATIONS).map(normalizeConversation)
    : [];
  const firstConversation = conversations[0];
  const activeId = conversations.some((conversation) => conversation.id === workspace.activeId)
    ? workspace.activeId
    : firstConversation?.id || '';

  return {
    activeId,
    conversations,
    library: Array.isArray(workspace.library)
      ? workspace.library.slice(0, MAX_LIBRARY_ITEMS).map(normalizeLibraryItem)
      : [],
    projects: Array.isArray(workspace.projects)
      ? workspace.projects.slice(0, MAX_PROJECTS).map(normalizeProject)
      : [],
    scheduled: Array.isArray(workspace.scheduled)
      ? workspace.scheduled.slice(0, MAX_SCHEDULED_TASKS).map(normalizeScheduledTask)
      : [],
    scheduledSettings: normalizeScheduledSettings(workspace.scheduledSettings),
    intelligence: normalizeIntelligence(workspace.intelligence)
  };
}

async function readWorkspace(username) {
  const filePath = workspacePath(username);

  try {
    const raw = await fs.readFile(filePath, 'utf8');

    if (!raw.trim()) {
      return null;
    }

    return normalizeWorkspace(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }

    if (error instanceof SyntaxError) {
      const backupPath = corruptWorkspacePath(filePath);
      await fs.rename(filePath, backupPath).catch(() => undefined);
      console.warn(`Ignored invalid workspace JSON for ${username}. A backup was saved at ${backupPath}.`);
      return null;
    }

    throw error;
  }
}

async function writeWorkspace(username, workspace) {
  const normalized = normalizeWorkspace(workspace);
  const filePath = workspacePath(username);
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const payload = `${JSON.stringify(normalized, null, 2)}\n`;

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.writeFile(tempPath, payload, 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return normalized;
}

async function createConversationRecord(username, seed = {}) {
  const current = (await readWorkspace(username)) || {
    activeId: '',
    conversations: []
  };
  const conversation = normalizeConversation(seed);
  const existing = current.conversations.filter((item) => item.id !== conversation.id);
  const workspace = await writeWorkspace(username, {
    activeId: conversation.id,
    conversations: [conversation, ...existing],
    library: current.library || [],
    projects: current.projects || [],
    scheduled: current.scheduled || [],
    scheduledSettings: current.scheduledSettings || {},
    intelligence: current.intelligence || {}
  });

  return {
    conversation,
    workspace
  };
}

module.exports = {
  createConversationRecord,
  normalizeWorkspace,
  readWorkspace,
  writeWorkspace
};
