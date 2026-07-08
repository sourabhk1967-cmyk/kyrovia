const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { configurePlaywrightBrowserPath } = require('../playwrightEnvironment');

configurePlaywrightBrowserPath();

const playwrightPackageDir = path.dirname(require.resolve('playwright/package.json'));
const playwrightCli = path.join(playwrightPackageDir, 'cli.js');
const result = spawnSync(
  process.execPath,
  [playwrightCli, 'install', '--force', 'chromium', 'chromium-headless-shell'],
  {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit'
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

const { chromium } = require('playwright');
const chromiumExecutablePath = chromium.executablePath();

if (!fs.existsSync(chromiumExecutablePath)) {
  console.error(`Playwright install finished, but Chromium is missing at ${chromiumExecutablePath}`);
  process.exit(1);
}

console.info(`Playwright Chromium installed at ${chromiumExecutablePath}`);
