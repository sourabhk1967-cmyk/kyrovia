const assert = require('node:assert/strict');
const test = require('node:test');

const ChatGPTService = require('./chatgpt');

test('completes a stable text response even if the page still reports generating', async () => {
  const service = new ChatGPTService({ timeoutMs: 5000 });

  service.isGenerating = async () => true;
  service.countVisibleContentImages = async () => 0;
  service.countVisibleResponseVisuals = async () => 0;
  service.getNewVisibleContentImages = async () => [];
  service.countDownloadCandidateLinks = async () => 0;
  service.extractAssistantMarkdown = async () => 'Final backend reply';
  service.scrapeResponseSources = async () => [];

  const page = {
    waitForTimeout: async () => undefined
  };
  const locator = {
    innerText: async () => 'Final backend reply'
  };

  const response = await service.waitForStableResponse(page, locator);

  assert.deepEqual(response, {
    text: 'Final backend reply',
    images: [],
    interactiveHtml: '',
    files: [],
    sources: [],
    artifacts: []
  });
});

test('treats a ready send button as not generating', async () => {
  const service = new ChatGPTService();
  const page = {
    locator(selector) {
      return {
        first() {
          return {
            isVisible: async () => selector === '[data-testid="send-button"]',
            isEnabled: async () => true
          };
        }
      };
    }
  };

  assert.equal(await service.isGenerating(page), false);
});

test('does not finalize a response during a brief pause while text is still arriving', async () => {
  const service = new ChatGPTService({ timeoutMs: 5000 });
  let readCount = 0;

  service.isGenerating = async () => readCount < 16;
  service.countVisibleContentImages = async () => 0;
  service.countVisibleResponseVisuals = async () => 0;
  service.getNewVisibleContentImages = async () => [];
  service.countDownloadCandidateLinks = async () => 0;
  service.extractAssistantMarkdown = async () =>
    readCount < 11 ? 'KYROVIA_DELIVERY_O' : 'KYROVIA_DELIVERY_OK';
  service.scrapeResponseSources = async () => [];

  const page = {
    waitForTimeout: async () => undefined
  };
  const locator = {
    innerText: async () => {
      readCount += 1;
      return readCount < 11 ? 'KYROVIA_DELIVERY_O' : 'KYROVIA_DELIVERY_OK';
    }
  };

  const response = await service.waitForStableResponse(page, locator);

  assert.equal(response.text, 'KYROVIA_DELIVERY_OK');
});

test('does not complete the transient thinking placeholder', async () => {
  const service = new ChatGPTService({ timeoutMs: 50 });

  service.isGenerating = async () => false;
  service.countVisibleContentImages = async () => 0;
  service.countVisibleResponseVisuals = async () => 0;
  service.getNewVisibleContentImages = async () => [];
  service.countDownloadCandidateLinks = async () => 0;

  const page = {
    waitForTimeout: async () => undefined
  };
  const locator = {
    innerText: async () => 'Thinking'
  };

  await assert.rejects(
    () => service.waitForStableResponse(page, locator),
    /Timed out waiting for Kyrovia response/
  );
});
