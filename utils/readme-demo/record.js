// Records the LinShare Quick Share walkthrough (sign in, drop a file, pick a
// recipient, send) as a WebM video with Playwright. convert.sh turns the
// result into the GIF used in the top-level README.
//
// Configuration (environment variables):
//   LINSHARE_URL        user portal login page  (default: https://demo.linshare.org/new/login)
//   LINSHARE_USER       account shown in the recording
//   LINSHARE_PASSWORD   its password
//   LINSHARE_RECIPIENT  search text typed in the recipient field
//   LINSHARE_RECIPIENT_LABEL  label of the entry to pick in the suggestions
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LINSHARE_URL || 'https://demo.linshare.org/new/login';
const USER = process.env.LINSHARE_USER || 'abbey.curry@linshare.org';
const PASS = process.env.LINSHARE_PASSWORD || 'secret';
const RECIPIENT_QUERY = process.env.LINSHARE_RECIPIENT || 'amy';
const RECIPIENT_LABEL = process.env.LINSHARE_RECIPIENT_LABEL || 'Amy WOLSH';
const FILE = path.join(__dirname, 'Product-roadmap.pdf');
const SUBJECT = 'Product roadmap 2027';
const W = 1280, H = 800;

// A minimal one-page PDF, so the recording does not depend on any external file.
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE,
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f \n' +
    '0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF\n');
}

// Fake cursor overlay: Playwright videos do not show the mouse pointer.
const CURSOR_CSS = `
#pw-cursor{position:fixed;z-index:2147483647;pointer-events:none;width:18px;height:18px;left:0;top:0;
  transform:translate(-2px,-2px);transition:transform .05s linear}
#pw-cursor svg{display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}
#pw-cursor.click{transform:translate(-2px,-2px) scale(.85)}`;
const CURSOR_SVG = `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6 1.5L16.5 20l-2.5 1-3.5-7.5L5 17z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    locale: 'en-US',
    ignoreHTTPSErrors: true,
    recordVideo: { dir: path.join(__dirname, 'video'), size: { width: W, height: H } },
  });
  const t0 = Date.now();
  const page = await context.newPage();

  await page.addInitScript(({ css, svg }) => {
    const install = () => {
      if (document.getElementById('pw-cursor')) return;
      const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
      const c = document.createElement('div'); c.id = 'pw-cursor'; c.innerHTML = svg; document.body.appendChild(c);
      window.addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
      window.addEventListener('mousedown', () => c.classList.add('click'), true);
      window.addEventListener('mouseup', () => c.classList.remove('click'), true);
    };
    if (document.body) install(); else document.addEventListener('DOMContentLoaded', install);
  }, { css: CURSOR_CSS, svg: CURSOR_SVG });

  // Timestamps (ms since recording start) used by convert.sh to trim the video.
  const marks = {};
  const mark = (n) => { marks[n] = Date.now() - t0; };

  let cur = { x: W / 2, y: H / 2 };
  const glide = async (loc, ms = 500) => {
    const box = await loc.boundingBox();
    const tx = box.x + box.width / 2, ty = box.y + box.height / 2;
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < .5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // ease in-out
      await page.mouse.move(cur.x + (tx - cur.x) * e, cur.y + (ty - cur.y) * e);
      await page.waitForTimeout(ms / steps);
    }
    cur = { x: tx, y: ty };
  };
  // Playwright's click (with actionability checks) for inputs and list entries.
  const click = async (loc) => {
    await glide(loc); await page.waitForTimeout(120);
    await loc.click({ noWaitAfter: true });
    const b = await loc.boundingBox().catch(() => null);
    if (b) cur = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  // Raw mouse events for buttons that trigger a transition: Playwright's
  // actionability checks stall for ~30 s on those in this UI.
  const clickRaw = async (loc) => {
    await glide(loc); await page.waitForTimeout(120);
    await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  };
  const type = async (loc, text) => { await click(loc); await page.waitForTimeout(200); await loc.pressSequentially(text, { delay: 55 }); };

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.mouse.move(cur.x, cur.y);
  mark('loginReady');
  await page.waitForTimeout(700);

  // 1. Sign in
  await type(page.locator('#mail'), USER);
  await type(page.locator('#password'), PASS);
  await page.waitForTimeout(300);
  await clickRaw(page.locator('button:has-text("Continue")'));
  mark('loginSubmitted');
  await page.waitForURL('**/new/', { timeout: 30000 });
  await page.locator('.file-drop-area').first().waitFor({ timeout: 30000 });
  mark('dashboard');
  await page.waitForTimeout(1600);

  // 2. Drop a file into the Quick Share zone of the dashboard
  const drop = page.locator('.file-drop-area').first();
  await glide(drop, 600);
  await page.waitForTimeout(400);
  await drop.locator('input[type=file]').setInputFiles(FILE);
  await page.waitForTimeout(1500);

  // 3. Pick a recipient
  const rec = page.locator('.ant-select-selection-search-input').last();
  await type(rec, RECIPIENT_QUERY);
  const opt = page.locator('.ant-select-item-option:visible').filter({ hasText: RECIPIENT_LABEL }).first();
  await opt.waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);
  await click(opt);
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); // the multi-select keeps its list open
  await page.waitForTimeout(300);

  // 4. Subject, send, wait for the success toast
  await type(page.locator('input[placeholder=Subject]'), SUBJECT);
  await page.waitForTimeout(500);
  await clickRaw(page.locator('button:has-text("Send File")'));
  await page.locator('.composer-success-title').waitFor({ timeout: 20000 });
  await page.mouse.move(cur.x - 300, cur.y - 250); // keep the toast readable
  await page.waitForTimeout(2600);
  mark('end');

  const video = page.video();
  await context.close();
  marks.path = await video.path();
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'marks.json'), JSON.stringify(marks, null, 2));
  console.log(JSON.stringify(marks));
}
main().catch(e => { console.error(e); process.exit(1); });
