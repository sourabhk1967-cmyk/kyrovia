const path = require('path');

function isRenderRuntime() {
  return Boolean(process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_SERVICE_ID);
}

function configurePlaywrightBrowserPath() {
  // On Render, ALWAYS use the project-local cache directory so that the build
  // step (which downloads Chromium) and the runtime (which launches it) resolve
  // the exact same path.  Any externally-set PLAYWRIGHT_BROWSERS_PATH is
  // overridden to prevent mismatches (e.g. /opt/render/.cache vs project-local).
  if (isRenderRuntime()) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.resolve(__dirname, '.cache', 'ms-playwright');
  } else if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }

  return process.env.PLAYWRIGHT_BROWSERS_PATH;
}

module.exports = {
  configurePlaywrightBrowserPath,
  isRenderRuntime
};
