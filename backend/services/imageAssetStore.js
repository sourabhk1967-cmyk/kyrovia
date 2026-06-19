const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), process.env.KYROVIA_DATA_DIR || './data');
const IMAGE_DIR = path.join(DATA_DIR, 'generated-images');
const MAX_IMAGE_BYTES = 36 * 1024 * 1024;

const EXTENSION_BY_MIME = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
};

const MIME_BY_EXTENSION = Object.entries(EXTENSION_BY_MIME).reduce((current, [mimeType, extension]) => {
  current[extension] = mimeType;
  return current;
}, {});

function createImageAssetError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  return error;
}

function parseImageDataUrl(dataUrl = '') {
  const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?,([\s\S]*)$/i.exec(String(dataUrl));

  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const isBase64 = Boolean(match[2]);
  const body = match[3] || '';
  const buffer = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body), 'utf8');

  if (!EXTENSION_BY_MIME[mimeType] || !buffer.length) {
    return null;
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw createImageAssetError(413, `Generated image is too large. Limit is ${MAX_IMAGE_BYTES} bytes.`);
  }

  return {
    buffer,
    extension: EXTENSION_BY_MIME[mimeType],
    mimeType
  };
}

function normalizeAssetName(name = '') {
  const basename = path.basename(String(name || ''));

  if (!/^[a-f0-9-]{36}\.(?:avif|bmp|gif|jpe?g|png|svg|webp|remote)$/i.test(basename)) {
    return '';
  }

  return basename;
}

function mimeTypeFromName(name = '') {
  const extension = path.extname(name).slice(1).toLowerCase();
  return MIME_BY_EXTENSION[extension === 'jpeg' ? 'jpg' : extension] || 'application/octet-stream';
}

async function saveImageDataUrl(dataUrl) {
  const parsed = parseImageDataUrl(dataUrl);

  if (!parsed) {
    return null;
  }

  return saveImageBuffer(parsed.buffer, parsed.mimeType);
}

async function saveImageBuffer(buffer, mimeType = '') {
  const normalizedMimeType = String(mimeType).split(';')[0].trim().toLowerCase();
  const extension = EXTENSION_BY_MIME[normalizedMimeType];

  if (!Buffer.isBuffer(buffer) || !buffer.length || !extension) {
    return null;
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw createImageAssetError(413, `Generated image is too large. Limit is ${MAX_IMAGE_BYTES} bytes.`);
  }

  await fs.mkdir(IMAGE_DIR, { recursive: true });

  const name = `${randomUUID()}.${extension}`;
  const filePath = path.join(IMAGE_DIR, name);
  await fs.writeFile(filePath, buffer);

  return {
    name,
    mimeType: normalizedMimeType,
    size: buffer.length
  };
}

async function saveRemoteImageSource(sourceUrl) {
  const url = new URL(String(sourceUrl || ''));

  if (!/^https?:$/i.test(url.protocol)) {
    return null;
  }

  await fs.mkdir(IMAGE_DIR, { recursive: true });

  const name = `${randomUUID()}.remote`;
  const filePath = path.join(IMAGE_DIR, name);
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        sourceUrl: url.toString(),
        createdAt: new Date().toISOString()
      },
      null,
      2
    )
  );

  return {
    name,
    sourceUrl: url.toString()
  };
}

async function readImageAsset(name) {
  const safeName = normalizeAssetName(name);

  if (!safeName) {
    return null;
  }

  const filePath = path.join(IMAGE_DIR, safeName);

  if (safeName.endsWith('.remote')) {
    const json = await fs.readFile(filePath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    });

    if (!json) {
      return null;
    }

    const payload = JSON.parse(json);
    const url = new URL(String(payload.sourceUrl || ''));

    if (!/^https?:$/i.test(url.protocol)) {
      return null;
    }

    return {
      remote: true,
      sourceUrl: url.toString()
    };
  }

  const buffer = await fs.readFile(filePath).catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (!buffer) {
    return null;
  }

  return {
    buffer,
    mimeType: mimeTypeFromName(safeName)
  };
}

module.exports = {
  readImageAsset,
  saveImageBuffer,
  saveImageDataUrl,
  saveRemoteImageSource
};
