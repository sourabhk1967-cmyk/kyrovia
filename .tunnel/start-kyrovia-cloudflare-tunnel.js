const fs = require('fs');
const path = require('path');
const { Tunnel, use: useCloudflaredBinary } = require('cloudflared');
const { GoogleAuth } = require('../backend/node_modules/google-auth-library');

const port = Number(process.env.KYROVIA_TUNNEL_PORT || 5050);
const localUrl = process.env.KYROVIA_TUNNEL_LOCAL_URL || `http://127.0.0.1:${port}`;
const cloudflaredBin = process.env.CLOUDFLARED_BIN || path.join(__dirname, 'bin', 'cloudflared.exe');
const urlFile = path.join(__dirname, 'public-url.txt');
const providerFile = path.join(__dirname, 'public-provider.txt');
const serviceAccountPath = path.resolve(__dirname, '../backend/serviceAccountKey.json');
const healthCheckIntervalMs = Number(process.env.KYROVIA_CLOUDFLARE_HEALTH_CHECK_MS || 15000);
const restartDelayMs = Number(process.env.KYROVIA_CLOUDFLARE_RESTART_MS || 3000);
const maxHealthFailures = Number(process.env.KYROVIA_CLOUDFLARE_MAX_FAILURES || 2);

let activeTunnel = null;
let activePublicUrl = '';
let healthTimer = null;
let restartTimer = null;
let healthFailures = 0;
let shuttingDown = false;

async function authorizeFirebaseDomain(publicUrl) {
  const hostname = new URL(publicUrl).hostname;
  const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const projectId = credentials.project_id;
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const current = await client.request({
    method: 'GET',
    url: configUrl
  });
  const authorizedDomains = [
    ...(current.data.authorizedDomains || []).filter(
      (domain) => !domain.endsWith('.trycloudflare.com') || domain === hostname
    ),
    hostname
  ];

  await client.request({
    method: 'PATCH',
    url: `${configUrl}?updateMask=authorizedDomains`,
    data: {
      authorizedDomains: [...new Set(authorizedDomains)]
    }
  });

  return hostname;
}

async function waitForUrl(tunnel) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for Cloudflare tunnel URL.'));
    }, 60000);

    tunnel.once('url', (url) => {
      clearTimeout(timer);
      resolve(url);
    });

    tunnel.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function clearHealthTimer() {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

function scheduleRestart(reason) {
  if (shuttingDown || restartTimer) {
    return;
  }

  clearHealthTimer();
  healthFailures = 0;
  const previousTunnel = activeTunnel;
  activeTunnel = null;
  activePublicUrl = '';

  if (previousTunnel) {
    previousTunnel.stop();
  }

  console.error(`Restarting Kyrovia Cloudflare tunnel: ${reason}`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    connectTunnel().catch((error) => {
      scheduleRestart(error.message);
    });
  }, restartDelayMs);
}

async function publicTunnelIsHealthy() {
  if (!activePublicUrl) {
    return false;
  }

  try {
    const healthUrl = new URL('/api/health', activePublicUrl);
    healthUrl.searchParams.set('_', Date.now().toString());
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return payload?.ok === true;
  } catch (_error) {
    return false;
  }
}

function startHealthMonitor() {
  clearHealthTimer();
  healthTimer = setInterval(async () => {
    const healthy = await publicTunnelIsHealthy();

    if (healthy) {
      healthFailures = 0;
      return;
    }

    healthFailures += 1;
    console.error(
      `Kyrovia public tunnel health check failed (${healthFailures}/${maxHealthFailures}).`
    );

    if (healthFailures >= maxHealthFailures) {
      scheduleRestart('the public URL is no longer reachable');
    }
  }, healthCheckIntervalMs);
  healthTimer.unref?.();
}

async function waitForPublicTunnel() {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    if (await publicTunnelIsHealthy()) {
      return true;
    }

    if (attempt < 8) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return false;
}

async function connectTunnel() {
  const tunnel = Tunnel.quick(localUrl);
  activeTunnel = tunnel;

  tunnel.on('stdout', (output) => {
    if (process.env.KYROVIA_TUNNEL_VERBOSE === 'true') {
      process.stdout.write(output);
    }
  });

  tunnel.on('stderr', (output) => {
    if (process.env.KYROVIA_TUNNEL_VERBOSE === 'true') {
      process.stderr.write(output);
    }
  });

  tunnel.on('exit', (code, signal) => {
    console.log(`Kyrovia Cloudflare tunnel exited: code=${code} signal=${signal || ''}`);
    if (!shuttingDown && activeTunnel === tunnel) {
      activeTunnel = null;
      scheduleRestart(`cloudflared exited with code ${code ?? ''}`);
    }
  });

  const publicUrl = await waitForUrl(tunnel);
  if (activeTunnel !== tunnel || shuttingDown) {
    tunnel.stop();
    return;
  }

  activePublicUrl = publicUrl;
  fs.writeFileSync(urlFile, `${publicUrl}\n`, 'utf8');
  fs.writeFileSync(providerFile, 'cloudflare\n', 'utf8');
  console.log(`Kyrovia public URL: ${publicUrl}`);

  authorizeFirebaseDomain(publicUrl)
    .then((authorizedHostname) => {
      console.log(`Firebase Google sign-in authorized for: ${authorizedHostname}`);
    })
    .catch((error) => {
      console.error(`Unable to authorize Firebase domain: ${error.message}`);
    });

  const healthy = await waitForPublicTunnel();
  if (!healthy) {
    scheduleRestart('the new public URL failed its initial health check');
    return;
  }

  console.log('Kyrovia public tunnel health check passed.');
  startHealthMonitor();
}

async function start() {
  if (fs.existsSync(cloudflaredBin)) {
    useCloudflaredBinary(cloudflaredBin);
  }

  await connectTunnel();
}

function shutdown() {
  shuttingDown = true;
  clearHealthTimer();
  clearTimeout(restartTimer);
  if (activeTunnel) {
    activeTunnel.stop();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((error) => {
  console.error(`Unable to start Kyrovia Cloudflare tunnel: ${error.message}`);
  if (activeTunnel) {
    activeTunnel.stop();
  }
  process.exit(1);
});
