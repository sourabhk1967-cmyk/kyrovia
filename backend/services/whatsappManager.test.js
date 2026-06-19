const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { WhatsAppManager } = require('./whatsappManager');

class FakeWhatsAppService {
  constructor(config, dependencies) {
    this.config = config;
    this.responseHandler = dependencies.responseHandler;
    this.disconnected = false;
  }

  async disconnect() {
    this.disconnected = true;
  }
}

test('isolates WhatsApp services and auth directories by Firebase account', async () => {
  const contexts = [];
  const manager = new WhatsAppManager(
    {
      authDir: './data/whatsapp-test'
    },
    {
      ServiceClass: FakeWhatsAppService,
      responseHandler: async (_message, context) => {
        contexts.push(context);
        return context.accountId;
      }
    }
  );
  const accountA = { firebaseUid: 'firebase-account-a', username: 'a@example.com' };
  const accountARenamed = { firebaseUid: 'firebase-account-a', username: 'new-a@example.com' };
  const accountB = { firebaseUid: 'firebase-account-b', username: 'b@example.com' };
  const serviceA = manager.getService(accountA);
  const serviceAAgain = manager.getService(accountARenamed);
  const serviceB = manager.getService(accountB);

  assert.equal(serviceA, serviceAAgain);
  assert.notEqual(serviceA, serviceB);
  assert.notEqual(serviceA.config.authDir, serviceB.config.authDir);
  assert.equal(serviceA.config.authDir.includes(`${path.sep}accounts${path.sep}`), true);
  assert.equal(manager.getActiveServiceCount(), 2);

  assert.equal(await serviceA.responseHandler({ text: 'hello' }), 'firebase-account-a');
  assert.equal(await serviceB.responseHandler({ text: 'hello' }), 'firebase-account-b');
  assert.deepEqual(contexts.map((context) => context.accountId), [
    'firebase-account-a',
    'firebase-account-b'
  ]);

  await manager.disconnectAll();
  assert.equal(serviceA.disconnected, true);
  assert.equal(serviceB.disconnected, true);
  assert.equal(manager.getActiveServiceCount(), 0);
});
