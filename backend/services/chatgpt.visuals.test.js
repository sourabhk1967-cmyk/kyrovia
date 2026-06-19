const assert = require('node:assert/strict');
const test = require('node:test');
const { chromium } = require('playwright');

const ChatGPTService = require('./chatgpt');

test('captures a large interactive diagram block as a frontend image', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <p>Ohm's Law explanation</p>
      <section style="width: 640px; padding: 20px; border: 1px solid #ddd">
        <input aria-label="Voltage" style="width: 240px" type="range" />
        <svg height="220" viewBox="0 0 500 220" width="500">
          <rect fill="#f3f4f6" height="120" width="420" x="40" y="50"></rect>
          <path d="M80 110 H420" stroke="#111" stroke-width="6"></path>
        </svg>
      </section>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');

  assert.equal(await service.countVisibleResponseVisuals(response), 1);

  const visual = await service.captureResponseVisual(response);
  assert.equal(visual.captureType, 'backend-visual');
  assert.equal(visual.mimeType, 'image/png');
  assert.match(visual.src, /^data:image\/png;base64,/);
  assert.ok(visual.width >= 500);
  assert.ok(visual.height >= 220);
});

test('does not capture ordinary icon-sized SVG elements', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <p>Plain text response</p>
      <svg height="24" viewBox="0 0 24 24" width="24">
        <circle cx="12" cy="12" r="8"></circle>
      </svg>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');

  assert.equal(await service.countVisibleResponseVisuals(response), 0);
  assert.equal(await service.captureResponseVisual(response), null);
});

test('captures the diagram card inside an oversized embedded frame', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <p>Ohm's Law explanation</p>
      <iframe
        srcdoc='
          <style>
            body { margin: 0; min-height: 760px; }
            .diagram { width: 520px; padding: 16px; border: 1px solid #ddd; }
          </style>
          <section class="diagram">
            <input aria-label="Voltage" style="width: 240px" type="range" />
            <input aria-label="Resistance" style="width: 240px" type="range" />
            <svg height="220" viewBox="0 0 500 220" width="500">
              <rect fill="#f3f4f6" height="120" width="420" x="40" y="50"></rect>
              <path d="M80 110 H420" stroke="#111" stroke-width="6"></path>
            </svg>
          </section>
        '
        style="width: 800px; height: 760px; border: 0"
      ></iframe>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');
  const visual = await service.captureResponseVisual(response, {
    allowRootFallback: true
  });

  assert.equal(visual.captureType, 'backend-visual');
  assert.ok(visual.width >= 520 && visual.width < 600);
  assert.ok(visual.height >= 220 && visual.height < 350);
});

test('captures the complete card around compact ARIA slider thumbs', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <section
        data-testid="learning-card"
        style="display: flex; width: 766px; height: 318px; padding: 12px; box-sizing: border-box; border: 1px solid #ddd"
      >
        <div style="width: 376px">
          <div style="width: 272px; height: 24px">
            <span aria-label="Voltage" role="slider" style="display: block; width: 20px; height: 20px"></span>
          </div>
          <div style="width: 272px; height: 24px">
            <span aria-label="Resistance" role="slider" style="display: block; width: 20px; height: 20px"></span>
          </div>
        </div>
        <svg aria-label="Circuit diagram" height="294" role="img" viewBox="0 0 376 294" width="376">
          <rect fill="#f3f4f6" height="180" width="320" x="28" y="57"></rect>
          <path d="M60 147 H316" stroke="#111" stroke-width="6"></path>
        </svg>
      </section>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');
  const visual = await service.captureResponseVisual(response);

  assert.equal(visual.captureType, 'backend-visual');
  assert.ok(visual.width >= 740);
  assert.ok(visual.height >= 300 && visual.height < 350);
});

test('captures the completed response region for explicit visual requests when the widget DOM is opaque', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <article data-message-author-role="assistant" style="width: 560px; min-height: 220px; padding: 20px">
      <p>A generated visual is rendered by an opaque component.</p>
      <div style="height: 150px; background: linear-gradient(90deg, #eee, #ccc)"></div>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');
  const visual = await service.captureResponseVisual(response, {
    allowRootFallback: true,
    preferRoot: true
  });

  assert.equal(visual.captureType, 'backend-visual');
  assert.match(visual.src, /^data:image\/png;base64,/);
  assert.ok(visual.width >= 560);
  assert.ok(visual.height >= 220);
});

test('excludes captured visual controls from assistant markdown', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <p>Ohm's Law explains voltage, current, and resistance.</p>
      <section
        data-testid="learning-card"
        style="display: flex; width: 620px; height: 260px; border: 1px solid #ddd"
      >
        <div style="width: 300px">
          <p>V = IR</p>
          <p>V_s</p>
          <p>V</p>
          <p>R</p>
          <p>Ohm</p>
          <input aria-label="Voltage" style="width: 220px" type="range" />
        </div>
        <svg aria-label="Circuit diagram" height="240" viewBox="0 0 300 240" width="300">
          <rect fill="#f3f4f6" height="140" width="260" x="20" y="50"></rect>
          <path d="M50 120 H250" stroke="#111" stroke-width="6"></path>
        </svg>
      </section>
      <p>Where:</p>
      <p><strong>V</strong> = Voltage</p>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');
  const markdown = await service.extractAssistantMarkdown(response, {
    excludeVisuals: true
  });

  assert.equal(markdown, "Ohm's Law explains voltage, current, and resistance.\n\nWhere:\n\n**V** = Voltage");
  assert.doesNotMatch(markdown, /V_s|Circuit diagram/);
});

test('preserves backend paragraph line breaks as Markdown hard breaks', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <p>Where:</p>
      <p>
        <strong>V</strong> = Voltage in volts<br>
        <strong>I</strong> = Current in amperes<br>
        <strong>R</strong> = Resistance in ohms
      </p>
      <p>So,</p>
    </article>
  `);

  const service = new ChatGPTService();
  const response = page.locator('[data-message-author-role="assistant"]');
  const markdown = await service.extractAssistantMarkdown(response);

  assert.equal(
    markdown,
    'Where:\n\n**V** = Voltage in volts\\\n**I** = Current in amperes\\\n**R** = Resistance in ohms\n\nSo,'
  );
});

test('preserves headings, nested bullets, emphasis, quotes, and code blocks', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <article data-message-author-role="assistant">
      <h2>Delivery Check</h2>
      <ul>
        <li><strong>Alpha</strong>: one</li>
        <li>
          <strong>Beta</strong>: two
          <ul><li>Nested item</li></ul>
        </li>
      </ul>
      <blockquote><p>Styled quote</p></blockquote>
      <pre><code class="language-js">const value = 1;</code></pre>
    </article>
  `);

  const service = new ChatGPTService();
  const markdown = await service.extractAssistantMarkdown(
    page.locator('[data-message-author-role="assistant"]')
  );

  assert.equal(
    markdown,
    [
      '## Delivery Check',
      '',
      '- **Alpha**: one',
      '- **Beta**: two',
      '  - Nested item',
      '',
      '> Styled quote',
      '',
      '```js',
      'const value = 1;',
      '```'
    ].join('\n')
  );
});

test('returns a completed plain-text response without rich-output settling delays', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <h2>Fast response</h2>
        <ul><li>Ready</li></ul>
      </article>
    </main>
  `);

  const service = new ChatGPTService({ timeoutMs: 5000 });
  service.waitForResponseArtifactsSettled = async () => {
    throw new Error('Plain text must not wait for rich response artifacts.');
  };
  service.scrapeResponseImages = async () => {
    throw new Error('Plain text must not scan response images.');
  };
  service.scrapeResponseFiles = async () => {
    throw new Error('Plain text must not scan response files.');
  };
  service.scrapeResponseArtifacts = async () => {
    throw new Error('Plain text must not scan response artifacts.');
  };
  const startedAt = Date.now();
  const response = await service.waitForStableResponse(
    page,
    page.locator('[data-message-author-role="assistant"]'),
    new Set(),
    new Set(),
    false,
    false,
    false,
    false
  );

  assert.equal(response.text, '## Fast response\n\n- Ready');
  assert.ok(Date.now() - startedAt < 5000);
});

test('treats a visible disabled stop button as completed generation', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <p>Hello is a common greeting.</p>
      </article>
      <button aria-label="Stop generating" data-testid="stop-button" disabled>Stop</button>
    </main>
  `);

  const service = new ChatGPTService({ timeoutMs: 3000 });
  assert.equal(await service.isGenerating(page), false);

  const response = await service.waitForStableResponse(
    page,
    page.locator('[data-message-author-role="assistant"]'),
    new Set(),
    new Set(),
    false,
    false,
    false,
    false
  );

  assert.equal(response.text, 'Hello is a common greeting.');
});

test('streams authoritative Markdown before the generation control disappears', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <h2>Delivery Check</h2>
        <ul><li>Alpha ready</li><li>Beta ready</li></ul>
      </article>
      <button data-testid="stop-button">Stop</button>
    </main>
  `);

  const service = new ChatGPTService({ timeoutMs: 5000 });
  const updates = [];
  setTimeout(() => {
    page.locator('[data-testid="stop-button"]').evaluate((node) => node.remove()).catch(() => undefined);
  }, 700);

  const response = await service.waitForStableResponse(
    page,
    page.locator('[data-message-author-role="assistant"]'),
    new Set(),
    new Set(),
    false,
    false,
    false,
    false,
    (update) => updates.push(update.text)
  );

  assert.equal(updates[0], '## Delivery Check\n\n- Alpha ready\n- Beta ready');
  assert.equal(response.text, updates[0]);
});

test('does not attach an image from an earlier response to a new text response', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <p>Earlier image response</p>
        <img
          alt="Earlier generated image"
          height="320"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='red'/%3E%3C/svg%3E"
          width="480"
        />
      </article>
      <article data-message-author-role="assistant">
        <p>This is the new text-only answer.</p>
      </article>
    </main>
  `);

  const service = new ChatGPTService();
  const currentResponse = page.locator('[data-message-author-role="assistant"]').last();
  const images = await service.scrapeResponseImages(page, currentResponse, new Set(), {
    expectImage: false
  });

  assert.deepEqual(images, []);
});

test('captures an image owned by the current response without reusing the earlier image', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <img
          alt="Earlier generated image"
          height="320"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='red'/%3E%3C/svg%3E"
          width="480"
        />
      </article>
      <article data-message-author-role="assistant">
        <img
          alt="Current generated image"
          height="320"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='blue'/%3E%3C/svg%3E"
          width="480"
        />
      </article>
    </main>
  `);

  const service = new ChatGPTService();
  const currentResponse = page.locator('[data-message-author-role="assistant"]').last();
  const images = await service.scrapeResponseImages(page, currentResponse, new Set(), {
    expectImage: true
  });

  assert.equal(images.length, 1);
  assert.equal(images[0].alt, 'Current generated image');
  assert.match(images[0].src, /fill='blue'/);
});

test('ignores a late reload of an earlier image while waiting for a text response', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent(`
    <main>
      <article data-message-author-role="assistant">
        <p>Earlier image response</p>
        <div id="earlier-image"></div>
      </article>
    </main>
  `);

  const service = new ChatGPTService({ timeoutMs: 5000 });
  const previousAssistantCount = await page.locator('[data-message-author-role="assistant"]').count();
  const previousImageKeys = await service.getVisibleContentImageKeys(page.locator('main'));

  await page.evaluate(() => {
    window.setTimeout(() => {
      document.querySelector('#earlier-image').innerHTML = `
        <img
          alt="Earlier generated image"
          height="320"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='red'/%3E%3C/svg%3E"
          width="480"
        />
      `;
    }, 100);

    window.setTimeout(() => {
      document.querySelector('main').insertAdjacentHTML(
        'beforeend',
        '<article data-message-author-role="assistant"><p>This is the new text-only answer.</p></article>'
      );
    }, 900);
  });

  const response = await service.waitForAssistantResponseStarted(
    page,
    previousAssistantCount,
    previousImageKeys,
    false
  );

  assert.equal(await response.innerText(), 'This is the new text-only answer.');
  assert.equal(await service.countVisibleContentImages(response), 0);
});

test('allows a page-level image to start an explicit image response', async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.setContent('<main><div id="image-canvas"></div></main>');

  const service = new ChatGPTService({ timeoutMs: 5000 });

  await page.evaluate(() => {
    window.setTimeout(() => {
      document.querySelector('#image-canvas').innerHTML = `
        <img
          alt="Current generated image"
          height="320"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='blue'/%3E%3C/svg%3E"
          width="480"
        />
      `;
    }, 100);
  });

  const response = await service.waitForAssistantResponseStarted(page, 0, new Set(), true);

  assert.match(await response.evaluate((node) => node.tagName), /^(?:BODY|MAIN)$/);
  assert.equal(await service.countVisibleContentImages(response), 1);
});
