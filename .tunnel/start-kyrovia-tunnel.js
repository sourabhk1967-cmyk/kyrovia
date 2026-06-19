const fs = require('fs');
const net = require('net');
const path = require('path');
const { lookup } = require('dns').promises;
const localtunnel = require('localtunnel');
const { GoogleAuth } = require('../backend/node_modules/google-auth-library');

const port = Number(process.env.KYROVIA_TUNNEL_PORT || 5050);
const localHost = process.env.KYROVIA_TUNNEL_HOST || '127.0.0.1';
const requestedSubdomain = process.env.KYROVIA_TUNNEL_SUBDOMAIN || 'kyrovia';
const urlFile = path.join(__dirname, 'requested-public-url.txt');
const providerFile = path.join(__dirname, 'requested-provider.txt');
const serviceAccountPath = path.resolve(__dirname, '../backend/serviceAccountKey.json');
const reconnectMs = Number(process.env.KYROVIA_TUNNEL_RECONNECT_MS || 10000);
const acquisitionTimeoutMs = Number(process.env.KYROVIA_TUNNEL_ACQUIRE_TIMEOUT_MS || 60000);
const connectivityIntervalMs = Number(process.env.KYROVIA_CONNECTIVITY_CHECK_MS || 15000);
const statusFile = path.join(__dirname, 'kyrovia-tunnel-status.json');
const providerHost = process.env.KYROVIA_TUNNEL_PROVIDER_HOST || 'localtunnel.me';
const providerPort = Number(process.env.KYROVIA_TUNNEL_PROVIDER_PORT || 443);

let stopping = false;
let activeTunnel = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeStatus(state, detail = '', publicUrl = '') {
  fs.writeFileSync(
    statusFile,
    `${JSON.stringify(
      {
        state,
        detail,
        publicUrl,
        pid: process.pid,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function clearPublishedUrl() {
  fs.rmSync(urlFile, { force: true });
  fs.rmSync(providerFile, { force: true });
}

async function providerIsReachable() {
  const { address } = await lookup(providerHost, { family: 4 });

  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: address,
      port: providerPort,
      timeout: 8000
    });

    const finish = (reachable) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function waitForInternet() {
  while (!stopping) {
    try {
      if (await providerIsReachable()) {
        return;
      }
    } catch (_error) {
      // DNS or provider connectivity is unavailable.
    }

    writeStatus('offline', `Waiting for connectivity to ${providerHost}:${providerPort}.`);
    await sleep(reconnectMs);
  }
}

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
      (domain) =>
        ((!domain.endsWith('.loca.lt') && !domain.endsWith('.trycloudflare.com')) ||
          domain === hostname)
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

async function openTunnel() {
  writeStatus('connecting', `Requesting ${requestedSubdomain}.loca.lt.`);
  const acquisitionTimer = setTimeout(() => {
    const message = `Tunnel acquisition timed out after ${acquisitionTimeoutMs}ms.`;
    console.error(message);
    writeStatus('error', message);
    process.exit(1);
  }, acquisitionTimeoutMs);

  const tunnel = await localtunnel({
    port,
    local_host: localHost,
    subdomain: requestedSubdomain
  });
  clearTimeout(acquisitionTimer);
  const requestedHostname = `${requestedSubdomain}.loca.lt`.toLowerCase();
  const assignedHostname = new URL(tunnel.url).hostname.toLowerCase();

  if (assignedHostname !== requestedHostname) {
    tunnel.close();
    throw new Error(
      `Requested hostname "${requestedHostname}" is unavailable; ` +
        `LocalTunnel offered "${assignedHostname}".`
    );
  }

  activeTunnel = tunnel;
  fs.writeFileSync(urlFile, `${tunnel.url}\n`, 'utf8');
  fs.writeFileSync(providerFile, 'localtunnel\n', 'utf8');
  writeStatus('online', 'Tunnel connected.', tunnel.url);
  console.log(`Kyrovia public URL: ${tunnel.url}`);

  authorizeFirebaseDomain(tunnel.url)
    .then((authorizedHostname) => {
      console.log(`Firebase Google sign-in authorized for: ${authorizedHostname}`);
    })
    .catch((error) => {
      console.error(`Unable to authorize Firebase domain: ${error.message}`);
    });

  return tunnel;
}

async function runTunnel() {
  const tunnel = await openTunnel();

  return new Promise((resolve) => {
    let closed = false;
    let checking = false;
    let providerWasOffline = false;
    const connectivityTimer = setInterval(async () => {
      if (closed || stopping || checking) {
        return;
      }

      checking = true;

      try {
        const providerOnline = await providerIsReachable();

        if (!providerOnline) {
          providerWasOffline = true;
          writeStatus(
            'offline',
            `Connection to ${providerHost}:${providerPort} was lost. The backend remains online.`,
            tunnel.url
          );
          return;
        }

        if (providerWasOffline) {
          console.log('Internet connection restored. Recreating the public tunnel connection.');
          tunnel.close();
          return;
        }

        writeStatus('online', 'Tunnel connected.', tunnel.url);
      } catch (error) {
        providerWasOffline = true;
        writeStatus(
          'offline',
          `Provider connectivity check failed: ${error.message}`,
          tunnel.url
        );
      } finally {
        checking = false;
      }
    }, connectivityIntervalMs);

    const finish = () => {
      if (closed) {
        return;
      }

      closed = true;
      clearInterval(connectivityTimer);
      if (activeTunnel === tunnel) {
        activeTunnel = null;
      }
      clearPublishedUrl();
      resolve();
    };

    tunnel.on('error', (error) => {
      console.error(`Kyrovia tunnel error: ${error.message}`);
      writeStatus('error', error.message, tunnel.url);
      tunnel.close();
    });

    tunnel.on('request', ({ method, path: requestPath }) => {
      console.log(`Kyrovia public request: ${method} ${requestPath}`);
    });

    tunnel.on('close', () => {
      console.log('Kyrovia tunnel closed.');
      finish();
    });
  });
}

async function start() {
  clearPublishedUrl();

  while (!stopping) {
    try {
      await waitForInternet();
      await runTunnel();
    } catch (error) {
      console.error(`Unable to start Kyrovia tunnel: ${error.message}`);
      writeStatus('error', error.message);
    }

    if (!stopping) {
      console.log(`Reconnecting Kyrovia tunnel in ${Math.round(reconnectMs / 1000)} seconds...`);
      await sleep(reconnectMs);
    }
  }
}

function shutdown() {
  stopping = true;
  clearPublishedUrl();
  writeStatus('stopped', 'Tunnel process stopped.');
  if (activeTunnel) {
    activeTunnel.close();
  }
}

{
  const close = shutdown;
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

start().catch((error) => {
  console.error(`Unable to start Kyrovia tunnel: ${error.message}`);
  process.exit(1);
});
