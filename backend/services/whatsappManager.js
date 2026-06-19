const { createHash } = require('crypto');
const path = require('path');

const { resolveAccountId } = require('./sessionIdentity');
const WhatsAppService = require('./whatsapp');

function accountStorageId(accountId) {
  return createHash('sha256').update(accountId).digest('hex').slice(0, 40);
}

class WhatsAppManager {
  constructor(config = {}, dependencies = {}) {
    this.config = config;
    this.ServiceClass = dependencies.ServiceClass || WhatsAppService;
    this.responseHandler = dependencies.responseHandler || null;
    this.baseAuthDir = path.resolve(process.cwd(), config.authDir || './data/whatsapp-auth');
    this.services = new Map();
  }

  getService(user = {}) {
    const accountId = resolveAccountId(user);

    if (!accountId) {
      const error = new Error('A signed-in account is required for WhatsApp.');
      error.status = 401;
      throw error;
    }

    const storageId = accountStorageId(accountId);
    const existing = this.services.get(storageId);

    if (existing) {
      return existing;
    }

    const service = new this.ServiceClass(
      {
        ...this.config,
        authDir: path.join(this.baseAuthDir, 'accounts', storageId)
      },
      {
        responseHandler: this.responseHandler
          ? (message) => this.responseHandler(message, { accountId, storageId, user })
          : null
      }
    );

    this.services.set(storageId, service);
    return service;
  }

  async disconnectAll() {
    const services = [...this.services.values()];

    await Promise.allSettled(services.map((service) => service.disconnect()));
    this.services.clear();
  }

  getActiveServiceCount() {
    return this.services.size;
  }
}

module.exports = {
  WhatsAppManager,
  accountStorageId
};
