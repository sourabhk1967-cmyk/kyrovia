const { getAdvancedModes } = require('./advancedModes');

const appsCatalog = {
  featured: {
    id: 'featured',
    label: 'Featured',
    hero: {
      appId: 'adobe-photoshop',
      title: 'Edit with Photoshop',
      subtitle: 'Edit and enhance images',
      prompt: '@Adobe Photoshop add lens blur',
      tone: 'blue'
    },
    apps: [
      ['adobe-photoshop', 'Adobe Photoshop', 'Edit and transform your images', 'Ps', '#001e36'],
      ['apple-music', 'Apple Music', 'Build playlists and find music', 'AM', '#fb3f63'],
      ['canva', 'Canva', 'Search, create, edit designs', 'C', '#14b8d4'],
      ['figma', 'Figma', 'Turn code into editable design', 'Fg', '#ffffff'],
      ['replit', 'Replit', 'Turn your ideas into real apps', 'R', '#ff6b2c'],
      ['airtable', 'Airtable', 'Add structured data to Kyrovia', 'A', '#111111'],
      ['booking', 'Booking.com', 'Find stays and rental cars', 'B.', '#003b95'],
      ['expedia', 'Expedia', 'Plan trips, flights and hotels', 'Ex', '#ffd500'],
      ['lovable', 'Lovable', 'Build apps and websites', 'L', '#f472b6'],
      ['tripadvisor', 'Tripadvisor', 'Book top-rated hotels', 'Ta', '#00af87'],
      ['human-tone', 'Human Tone Studio', 'Polish writing into a natural human voice', 'HT', '#b45309'],
      ['health-connect', 'Health Balance Lab', 'Routines from fitness and medicine data', 'HB', '#0f766e'],
      ['whatsapp-bridge', 'WhatsApp AI Bridge', 'Auto-reply from WhatsApp with Baileys', 'WA', '#25d366']
    ]
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced Modes',
    hero: {
      appId: 'memoryCompression',
      title: 'Advanced Agent Modes',
      subtitle: 'Specialized reasoning lenses for deeper analysis',
      prompt: '@AdvancedMode memoryCompression',
      tone: 'violet'
    },
    apps: getAdvancedModes().map((mode) => [mode.id, mode.name, mode.description, mode.initials, mode.color])
  },
  lifestyle: {
    id: 'lifestyle',
    label: 'Lifestyle',
    hero: {
      appId: 'canva',
      title: 'Create with Canva',
      subtitle: 'Make designs and flyers',
      prompt: '@Canva create social posts',
      tone: 'cyan'
    },
    apps: [
      ['abhibus', 'AbhiBus', 'Find buses', 'Ab', '#ffffff'],
      ['acko', 'ACKO', 'Get insurance, check challans', 'Ak', '#6d28d9'],
      ['adac', 'ADAC Mietwagen', 'Gunstige Mietwagen weltweit.', 'AD', '#ffd100'],
      ['all-accor', 'ALL Accor', 'Search and book Accor hotels', 'All', '#ffffff'],
      ['almosfer', 'Almosafer.com', 'Find flights, hotels and more', 'Al', '#07485a'],
      ['apple-music', 'Apple Music', 'Build playlists and find music', 'AM', '#fb3f63'],
      ['artue', 'artue', 'Find art with natural language', 'A', '#ffffff'],
      ['atlys', 'Atlys', 'Get Your Visa on Time', 'At', '#ffffff'],
      ['autoscout24', 'AutoScout24', 'Automobile buying and leasing', 'Au', '#ffeb00'],
      ['autotrader', 'Autotrader', 'Search for new and used cars', 'AT', '#ee1b2f'],
      ['backstage', 'Backstage', 'Find casting calls and jobs', 'B', '#000000'],
      ['bible', 'Bible', 'Find and read Bible verses', 'HB', '#ffffff'],
      ['blablacar', 'BlaBlaCar', 'Find carpool, bus, train rides', 'Bb', '#006cff'],
      ['booking', 'Booking.com', 'Find stays and rental cars', 'B.', '#003b95'],
      ['busbud', 'Busbud', 'Find bus and train tickets', 'Bu', '#fbbf24'],
      ['expedia', 'Expedia', 'Plan trips, flights and hotels', 'Ex', '#ffd500'],
      ['health-connect', 'Health Balance Lab', 'Fitness, medicines, checkups, and routine planning', 'HB', '#0f766e'],
      ['klook', 'Klook', 'Find travel things-to-do', 'Kl', '#ff681a'],
      ['makemytrip', 'MakeMyTrip', 'Find flights, hotels & cabs', 'my', '#e11d48'],
      ['redfin', 'Redfin', 'Find and tour homes for sale', 'Rf', '#dc2626'],
      ['zomato', 'Zomato', 'Food Delivery', 'Zo', '#f43f5e']
    ]
  },
  productivity: {
    id: 'productivity',
    label: 'Productivity',
    hero: {
      appId: 'github',
      title: 'Work with GitHub',
      subtitle: 'Review repositories and pull requests',
      prompt: '@GitHub summarize open work',
      tone: 'dark'
    },
    apps: [
      ['github', 'GitHub', 'Access repositories, issues, and pull requests', 'GH', '#111827'],
      ['gmail', 'Gmail', 'Find and reference emails from your inbox', 'Gm', '#ffffff'],
      ['google-calendar', 'Google Calendar', 'Look up events and availability', '31', '#ffffff'],
      ['google-contacts', 'Google Contacts', 'Reference saved contact details', 'GC', '#ffffff'],
      ['google-drive', 'Google Drive', 'Work with Google Docs, Sheets, and Slides', 'Dr', '#ffffff'],
      ['intercom', 'Intercom', 'Look up past user chats and tickets', 'In', '#111111'],
      ['outlook-calendar', 'Outlook Calendar', 'Look up events and availability', 'Oc', '#ffffff'],
      ['outlook-email', 'Outlook Email', 'Search and reference your Outlook email', 'Om', '#ffffff'],
      ['sharepoint', 'SharePoint', 'Search and pull from shared sites and OneDrive', 'Sp', '#ffffff'],
      ['teams', 'Teams', 'Look up chats and messages', 'Tm', '#635bff'],
      ['adobe-acrobat', 'Adobe Acrobat', 'Edit and organize PDFs easily', 'Ac', '#dc2626'],
      ['airtable', 'Airtable', 'Add structured data to Kyrovia', 'A', '#111111'],
      ['asana', 'Asana', 'Turn chats into actions', 'As', '#ffffff'],
      ['calendly', 'Calendly', 'Manage bookings and availability', 'Ca', '#006bff'],
      ['clickup', 'ClickUp', 'Automate projects, docs, reports', 'Cu', '#ffffff'],
      ['dropbox', 'Dropbox', 'Access, save and share files', 'Db', '#0061ff'],
      ['figma', 'Figma', 'Turn code into editable design', 'Fg', '#ffffff'],
      ['hubspot', 'HubSpot', 'Insights to action in HubSpot', 'Hs', '#ff5c35'],
      ['notion', 'Notion', 'Create docs, tasks, databases', 'N', '#ffffff'],
      ['slack', 'Slack', 'Send messages and fetch data', 'Sl', '#ffffff'],
      ['supabase', 'Supabase', 'Manage and query databases', 'Su', '#3ecf8e'],
      ['vercel', 'Vercel', 'Search docs and deploy apps', 'V', '#ffffff'],
      ['zoom', 'Zoom', 'Smart meeting insights from Zoom', 'Zm', '#0b5cff']
    ]
  }
};

const appDetails = {
  'human-tone': {
    category: 'Writing',
    capabilities: 'Natural rewriting, voice cleanup, clarity pass, tone matching',
    developer: 'Kyrovia',
    website: '',
    privacyPolicy: '',
    termsOfService: '',
    longDescription:
      'Rewrite pasted text so it sounds natural, clear, and genuinely written by a person. It preserves meaning, keeps the user voice, removes robotic phrasing, and avoids over-polished corporate wording.'
  },
  'health-connect': {
    category: 'Health & Wellness',
    capabilities: 'Health Connect and Google Fit-ready imports, medicines, checkups, reminders, charts, routines',
    developer: 'Kyrovia',
    website: 'https://developer.android.com/health-and-fitness/health-connect',
    privacyPolicy: '',
    termsOfService: '',
    longDescription:
      'Connect health sources such as Health Connect, Google Fit, a smart watch, or a fitness band through a provider-ready backend profile. Track daily metrics, medicines, checkups, food and water reminders, exercise and yoga routines, health-balance charts, and doctor-specialty suggestions. Kyrovia provides wellness planning support only and does not diagnose, prescribe, or replace a clinician.'
  },
  'whatsapp-bridge': {
    category: 'Messaging',
    capabilities: 'Baileys QR auth, incoming message auto-replies, status, send messages',
    developer: 'Kyrovia',
    website: 'https://github.com/WhiskeySockets/Baileys',
    privacyPolicy: '',
    termsOfService: '',
    longDescription:
      'Connect a WhatsApp session through Baileys multi-file authentication. Incoming private WhatsApp messages are sent to the Kyrovia backend, generated through the ChatGPT browser service, and replied to the sender automatically.'
  },
  github: {
    category: 'Developer Tools',
    capabilities: 'File Search, Writes',
    developer: 'Kyrovia',
    website: 'https://github.com',
    privacyPolicy: 'https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement',
    termsOfService: 'https://docs.github.com/site-policy/github-terms/github-terms-of-service',
    longDescription:
      'Explore repository files, documentation, folder structures, and commit history to understand code, prepare reviews, or document a project. Summarize pull requests, clarify how parts of the codebase fit together, or turn technical details into approachable explanations when sharing work with others.'
  }
};

function normalizeApp(tuple, categoryId) {
  const [id, name, description, initials, color] = tuple;
  const advancedMode = categoryId === 'advanced' ? id : '';

  return {
    id,
    name,
    description,
    initials,
    color,
    detail: appDetails[id] || null,
    advancedMode,
    categoryId
  };
}

function getAppsCatalog() {
  return Object.values(appsCatalog).map((category) => ({
    id: category.id,
    label: category.label,
    hero: category.hero,
    apps: category.apps.map((app) => normalizeApp(app, category.id))
  }));
}

function findApp(appId) {
  for (const category of getAppsCatalog()) {
    const app = category.apps.find((item) => item.id === appId);

    if (app) {
      return {
        ...app,
        categoryLabel: category.label
      };
    }
  }

  return null;
}

function getAppDetail(appId) {
  const app = findApp(appId);

  if (!app) {
    return null;
  }

  return {
    ...app,
    detail: app.detail || {
      category: app.categoryLabel,
      capabilities: app.advancedMode ? `AdvancedMode: ${app.advancedMode}` : 'Kyrovia chat',
      developer: 'Kyrovia',
      website: '',
      privacyPolicy: '',
      termsOfService: '',
      longDescription: app.advancedMode
        ? `${app.description}. This mode preloads a specialized Kyrovia reasoning profile named "${app.advancedMode}".`
        : app.description
    }
  };
}

module.exports = {
  findApp,
  getAppDetail,
  getAppsCatalog
};
