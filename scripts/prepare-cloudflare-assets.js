const { rm } = require('node:fs/promises');
const { resolve } = require('node:path');

const redirectsPath = resolve('frontend/dist/_redirects');

async function main() {
  try {
    await rm(redirectsPath);
    console.log('Removed Netlify _redirects file from Cloudflare assets.');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

main();
