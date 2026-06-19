import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeCdnBaseUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '/';
  }

  try {
    const cdnUrl = new URL(rawValue);
    cdnUrl.pathname = cdnUrl.pathname.replace(/\/?$/, '/');
    cdnUrl.search = '';
    cdnUrl.hash = '';

    return cdnUrl.toString();
  } catch (_error) {
    const pathBase = rawValue.replace(/\\/g, '/').replace(/^\/?/, '/').replace(/\/?$/, '/');
    return pathBase;
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const cloudflareCdnBase = normalizeCdnBaseUrl(env.VITE_CLOUDFLARE_CDN_URL);

  return {
    base: command === 'build' ? cloudflareCdnBase : '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5050',
          changeOrigin: true
        }
      }
    }
  };
});
