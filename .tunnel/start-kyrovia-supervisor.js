const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');
const backendHealthUrl = process.env.KYROVIA_BACKEND_HEALTH_URL || 'http://127.0.0.1:5050/api/health';
const checkIntervalMs = Number(process.env.KYROVIA_SUPERVISOR_CHECK_MS || 10000);
const backendRestartMs = Number(process.env.KYROVIA_BACKEND_RESTART_MS || 4000);
const tunnelRestartMs = Number(process.env.KYROVIA_TUNNEL_RESTART_MS || 10000);
const publicHealthTimeoutMs = Number(process.env.KYROVIA_PUBLIC_HEALTH_TIMEOUT_MS || 8000);
const publicFailureLimit = Number(process.env.KYROVIA_PUBLIC_FAILURE_LIMIT || 18);
const enableFallback = /^(1|true|yes|on)$/i.test(
  String(process.env.KYROVIA_ENABLE_FALLBACK || '')
);
const lockFile = path.join(__dirname, 'supervisor.pid');
const stopRequestFile = path.join(__dirname, 'stop.request');
const statusFile = path.join(__dirname, 'supervisor-status.json');
const supervisorLog = path.join(__dirname, 'kyrovia-supervisor.log');
const backendLog = path.join(backendDir, 'kyrovia-live.out.log');
const backendErrorLog = path.join(backendDir, 'kyrovia-live.err.log');
const tunnelLog = path.join(__dirname, 'kyrovia-localtunnel-live.out.log');
const tunnelErrorLog = path.join(__dirname, 'kyrovia-localtunnel-live.err.log');
const fallbackLog = path.join(__dirname, 'kyrovia-cloudflare-live.out.log');
const fallbackErrorLog = path.join(__dirname, 'kyrovia-cloudflare-live.err.log');
const activePublicUrlFile = path.join(__dirname, 'active-public-url.txt');
const tunnelSubdomain = process.env.KYROVIA_TUNNEL_SUBDOMAIN || 'kyrovia';
const brandedPublicUrl = `https://${tunnelSubdomain}.loca.lt`;

let backendProcess = null;
let tunnelProcess = null;
let fallbackProcess = null;
let backendFailures = 0;
let publicFailures = 0;
let publicHealthy = false;
let publicStatus = 0;
let stopping = false;
let checkTimer = null;
let backendRestartTimer = null;
let tunnelRestartTimer = null;
let checkingServices = false;

function appendLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  fs.appendFileSync(supervisorLog, `${line}\n`, 'utf8');
  console.log(line);
}

function powershellPublicHealth(url) {
  return new Promise((resolve) => {
    const escapedUrl = String(url).replace(/'/g, "''");
    const command = [
      "$ProgressPreference = 'SilentlyContinue';",
      "$headers = @{ 'User-Agent' = 'Mozilla/5.0 KyroviaLive/1.0'; 'Bypass-Tunnel-Reminder' = 'true'; 'Cache-Control' = 'no-cache'; Accept = 'application/json' };",
      "try {",
      `  $response = Invoke-WebRequest -UseBasicParsing -Uri '${escapedUrl}' -Headers $headers -TimeoutSec 8 -ErrorAction Stop;`,
      "  @{ status = [int]$response.StatusCode; body = $response.Content } | ConvertTo-Json -Compress",
      "} catch {",
      "  $status = 0;",
      "  if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }",
      "  @{ status = $status; body = '' } | ConvertTo-Json -Compress",
      "}"
    ].join(' ');
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ healthy: false, status: 0 });
    }, publicHealthTimeoutMs + 5000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolve({ healthy: false, status: 0 });
    });
    child.once('exit', () => {
      clearTimeout(timer);

      try {
        const result = JSON.parse(stdout.trim());
        const payload = result.body ? JSON.parse(result.body) : null;
        resolve({
          healthy: result.status === 200 && payload?.ok === true && payload?.service === 'kyrovia',
          status: result.status || 0
        });
      } catch (_error) {
        resolve({ healthy: false, status: 0 });
      }
    });
  });
}

function writeStatus(extra = {}) {
  let tunnelState = null;
  let fallbackPublicUrl = null;

  try {
    tunnelState = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'kyrovia-tunnel-status.json'), 'utf8')
    );
  } catch (_error) {
    tunnelState = null;
  }

  if (enableFallback) {
    try {
      fallbackPublicUrl = fs.readFileSync(path.join(__dirname, 'public-url.txt'), 'utf8').trim() || null;
    } catch (_error) {
      fallbackPublicUrl = null;
    }
  }

  const activePublicUrl =
    publicHealthy
      ? tunnelState?.publicUrl || brandedPublicUrl
      : enableFallback
        ? fallbackPublicUrl
        : tunnelState?.state === 'online' && tunnelState?.publicUrl
          ? tunnelState.publicUrl
          : null;

  if (activePublicUrl) {
    fs.writeFileSync(activePublicUrlFile, `${activePublicUrl}\n`, 'utf8');
  } else {
    fs.rmSync(activePublicUrlFile, { force: true });
  }

  fs.writeFileSync(
    statusFile,
    `${JSON.stringify(
      {
        supervisorPid: process.pid,
        backendPid: backendProcess?.pid || null,
        tunnelPid: tunnelProcess?.pid || null,
        tunnelProcessRunning: Boolean(tunnelProcess),
        fallbackPid: fallbackProcess?.pid || null,
        fallbackProcessRunning: Boolean(fallbackProcess),
        tunnelState: tunnelState?.state || null,
        requestedPublicUrl: tunnelState?.publicUrl || null,
        activePublicUrl,
        fallbackPublicUrl,
        backendFailures,
        publicFailures,
        publicHealthy,
        publicStatus,
        fallbackEnabled: enableFallback,
        stopping,
        checkedAt: new Date().toISOString(),
        ...extra
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (_error) {
    return false;
  }
}

function acquireLock() {
  if (fs.existsSync(lockFile)) {
    const existingPid = Number(fs.readFileSync(lockFile, 'utf8').trim());

    if (processExists(existingPid)) {
      throw new Error(`Kyrovia supervisor is already running with PID ${existingPid}.`);
    }
  }

  fs.writeFileSync(lockFile, `${process.pid}\n`, 'utf8');
}

function pipeChildOutput(child, outputFile, errorFile, label) {
  const output = fs.createWriteStream(outputFile, { flags: 'a' });
  const errors = fs.createWriteStream(errorFile, { flags: 'a' });

  child.stdout.pipe(output);
  child.stderr.pipe(errors);
  child.on('exit', () => {
    output.end();
    errors.end();
  });
  appendLog(`${label} started with PID ${child.pid}.`);
}

function scheduleBackendRestart() {
  if (stopping || backendRestartTimer || backendProcess) {
    return;
  }

  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null;
    startBackend();
  }, backendRestartMs);
}

function scheduleTunnelRestart() {
  if (stopping || tunnelRestartTimer || tunnelProcess) {
    return;
  }

  tunnelRestartTimer = setTimeout(() => {
    tunnelRestartTimer = null;
    startTunnel();
  }, tunnelRestartMs);
}

function startFallback() {
  if (!enableFallback || stopping || fallbackProcess) {
    return;
  }

  fallbackProcess = spawn(
    process.execPath,
    [path.join(__dirname, 'start-kyrovia-cloudflare-tunnel.js')],
    {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  );
  pipeChildOutput(fallbackProcess, fallbackLog, fallbackErrorLog, 'Public fallback');

  fallbackProcess.once('exit', (code, signal) => {
    appendLog(`Public fallback exited: code=${code ?? ''} signal=${signal || ''}.`);
    fallbackProcess = null;

    if (enableFallback && !stopping) {
      setTimeout(startFallback, tunnelRestartMs);
    }
  });
}

function startBackend() {
  if (stopping || backendProcess) {
    return;
  }

  backendProcess = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  pipeChildOutput(backendProcess, backendLog, backendErrorLog, 'Backend');

  backendProcess.once('exit', (code, signal) => {
    appendLog(`Backend exited: code=${code ?? ''} signal=${signal || ''}.`);
    backendProcess = null;
    backendFailures = 0;
    writeStatus({ backendHealthy: false });
    scheduleBackendRestart();
  });
}

function startTunnel() {
  if (stopping || tunnelProcess) {
    return;
  }

  tunnelProcess = spawn(process.execPath, [path.join(__dirname, 'start-kyrovia-tunnel.js')], {
    cwd: repoRoot,
    env: {
      ...process.env,
      KYROVIA_TUNNEL_SUBDOMAIN: tunnelSubdomain,
      DEBUG: process.env.DEBUG || 'localtunnel:*'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  pipeChildOutput(tunnelProcess, tunnelLog, tunnelErrorLog, 'Tunnel');

  tunnelProcess.once('exit', (code, signal) => {
    appendLog(`Tunnel exited: code=${code ?? ''} signal=${signal || ''}.`);
    tunnelProcess = null;
    publicHealthy = false;
    publicStatus = 0;
    writeStatus({ tunnelConnected: false });
    scheduleTunnelRestart();
  });
}

async function backendIsHealthy() {
  try {
    const response = await fetch(backendHealthUrl, {
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
}

async function publicTunnelHealth() {
  const publicUrl = currentTunnelPublicUrl();
  const healthUrl = `${publicUrl}/api/health?supervisor=${Date.now()}`;

  try {
    const response = await fetch(healthUrl, {
      headers: {
        'Bypass-Tunnel-Reminder': 'true',
        'Cache-Control': 'no-cache'
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(publicHealthTimeoutMs)
    });
    const status = response.status;

    if (!response.ok) {
      if (process.platform === 'win32') {
        return powershellPublicHealth(healthUrl);
      }

      return { healthy: false, status };
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return { healthy: false, status };
    }

    const payload = await response.json();
    return {
      healthy: payload?.ok === true && payload?.service === 'kyrovia',
      status
    };
  } catch (_error) {
    if (process.platform === 'win32') {
      return powershellPublicHealth(healthUrl);
    }

    return { healthy: false, status: 0 };
  }
}

function currentTunnelPublicUrl() {
  try {
    const status = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'kyrovia-tunnel-status.json'), 'utf8')
    );
    return status.publicUrl || brandedPublicUrl;
  } catch (_error) {
    return brandedPublicUrl;
  }
}

async function checkServicesNow() {
  if (stopping) {
    return;
  }

  if (fs.existsSync(stopRequestFile)) {
    fs.rmSync(stopRequestFile, { force: true });
    await shutdown('manual stop request');
    return;
  }

  const healthy = await backendIsHealthy();

  if (healthy) {
    backendFailures = 0;
    const publicCheck = await publicTunnelHealth();
    publicHealthy = publicCheck.healthy;
    publicStatus = publicCheck.status;

    if (publicHealthy) {
      publicFailures = 0;
    } else if (tunnelProcess && tunnelStateIsOnline()) {
      publicFailures += 1;
      appendLog(
        `Public tunnel health failed (${publicFailures}/${publicFailureLimit}, HTTP ${publicStatus || 'unreachable'}).`
      );
    }

    if (!publicHealthy && !tunnelProcess) {
      startTunnel();
    }

    if (!publicHealthy && tunnelProcess && publicFailures >= publicFailureLimit) {
      appendLog('Public tunnel is stale. Restarting the LocalTunnel connection.');
      const unhealthyTunnel = tunnelProcess;
      tunnelProcess = null;
      publicFailures = 0;
      unhealthyTunnel.kill();
      scheduleTunnelRestart();
    }

    if (enableFallback && !fallbackProcess && !publicHealthy) {
      startFallback();
    }
  } else {
    backendFailures += 1;
    publicHealthy = false;
    publicStatus = 0;

    if (!backendProcess) {
      startBackend();
    } else if (backendFailures >= 3) {
      appendLog('Backend failed three local health checks. Restarting it.');
      const unhealthyProcess = backendProcess;
      backendProcess = null;
      unhealthyProcess.kill();
      backendFailures = 0;
      scheduleBackendRestart();
    }
  }

  writeStatus({
    backendHealthy: healthy,
    tunnelConnected: publicHealthy
  });
}

async function checkServices() {
  if (stopping || checkingServices) {
    return;
  }

  checkingServices = true;

  try {
    await checkServicesNow();
  } catch (error) {
    appendLog(`Supervisor health check failed: ${error.message}`);
  } finally {
    checkingServices = false;
  }
}

function tunnelStateIsOnline() {
  try {
    const status = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'kyrovia-tunnel-status.json'), 'utf8')
    );
    return status.state === 'online' && status.publicUrl === brandedPublicUrl;
  } catch (_error) {
    return false;
  }
}

async function stopChild(child, label) {
  if (!child || child.exitCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      appendLog(`${label} did not stop in time. Terminating it.`);
      child.kill('SIGKILL');
    }, 10000);

    child.once('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });
    child.kill();
  });
}

async function shutdown(signal) {
  if (stopping) {
    return;
  }

  stopping = true;
  appendLog(`Supervisor received ${signal}. Stopping Kyrovia services.`);
  clearInterval(checkTimer);
  clearTimeout(backendRestartTimer);
  clearTimeout(tunnelRestartTimer);

  const currentTunnel = tunnelProcess;
  const currentFallback = fallbackProcess;
  const currentBackend = backendProcess;
  tunnelProcess = null;
  fallbackProcess = null;
  backendProcess = null;

  await Promise.all([
    stopChild(currentTunnel, 'Tunnel'),
    stopChild(currentFallback, 'Public fallback'),
    stopChild(currentBackend, 'Backend')
  ]);

  fs.rmSync(lockFile, { force: true });
  fs.rmSync(stopRequestFile, { force: true });
  writeStatus({ backendHealthy: false, tunnelConnected: false });
  process.exit(0);
}

async function start() {
  acquireLock();
  fs.rmSync(stopRequestFile, { force: true });
  appendLog('Kyrovia supervisor starting.');

  if (await backendIsHealthy()) {
    appendLog('An existing Kyrovia backend is healthy; monitoring it without starting a duplicate.');
  } else {
    startBackend();
  }

  await checkServices();
  checkTimer = setInterval(checkServices, checkIntervalMs);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => {
  if (Number(fs.existsSync(lockFile) && fs.readFileSync(lockFile, 'utf8').trim()) === process.pid) {
    fs.rmSync(lockFile, { force: true });
  }
});

start().catch((error) => {
  appendLog(`Supervisor failed to start: ${error.message}`);
  fs.rmSync(lockFile, { force: true });
  process.exit(1);
});
