const assert = require('node:assert/strict');
const test = require('node:test');

const ChatGPTService = require('./chatgpt');

test('serial browser mode reuses the owned page instead of opening a new tab', async () => {
  let newPageCalls = 0;
  let zoomResetCalls = 0;
  const page = {
    isClosed: () => false,
    keyboard: {
      press: async () => {
        zoomResetCalls += 1;
      }
    }
  };
  const service = new ChatGPTService({ parallelTabs: false });
  service.context = {
    newPage: async () => {
      newPageCalls += 1;
      return page;
    }
  };
  service.page = page;

  const requestPage = await service.createRequestPage();
  await service.closeRequestPage(requestPage);

  assert.equal(requestPage, page);
  assert.equal(newPageCalls, 0);
  assert.equal(zoomResetCalls, 1);
  assert.equal(service.activeRequestPages.size, 0);
  assert.equal(page.isClosed(), false);
});
