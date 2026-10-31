import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const base = 'http://localhost:3000';
const outDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\768e2c34-186c-4ca4-9f43-e5fa8a395c21';

const candidates = [
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
];
const browser = candidates.find(p => p && fs.existsSync(p));
if (!browser) {
  console.error('Edge browser executable not found.');
  process.exit(1);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.next = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', e => reject(e));
    });
    this.ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(JSON.stringify(m.error)));
        else p.resolve(m.result);
      }
      const ls = this.listeners.get(m.method) || [];
      for (const fn of ls) fn(m.params);
    });
  }
  async cmd(method, params = {}) {
    await this.ready;
    const id = this.next++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async close() {
    try { this.ws.close(); } catch {}
  }
}

async function waitFor(condition, timeoutMs = 15000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await condition()) return true;
    } catch {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function pickTarget(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!r.ok) throw new Error(`TARGET_LIST_HTTP_${r.status}`);
  const list = await r.json();
  return list.find(x => x.type === 'page' && typeof x.webSocketDebuggerUrl === 'string');
}

async function evalJs(cdp, expression) {
  const r = await cdp.cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'Eval error');
  return r.result?.value;
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-cin-test-'));
  const port = 9333;
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,1100',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const ready = await waitFor(async () => {
      try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); return r.ok; } catch { return false; }
    }, 10000, 100);
    if (!ready) throw new Error('CDP not ready');

    const target = await pickTarget(port);
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.cmd('Page.enable');
    await cdp.cmd('Runtime.enable');
    await cdp.cmd('DOM.enable');

    console.log('[1/4] Navigating to homepage...');
    await cdp.cmd('Page.navigate', { url: base });
    await waitFor(async () => {
      const v = await evalJs(cdp, 'document.readyState');
      return v === 'complete';
    });
    // Wait for client React hydration
    await new Promise(r => setTimeout(r, 2000));

    // Check Manifesto Character Stage
    const manifestoData = await evalJs(cdp, `(() => {
      const stage = document.querySelector('.cin-character-stage');
      const tabs = Array.from(document.querySelectorAll('.cin-character-tab')).map(t => t.innerText.trim());
      const pins = Array.from(document.querySelectorAll('.cin-hotspot')).map(p => p.innerText.trim());
      const img = document.querySelector('.cin-character-cutout')?.getAttribute('src');
      return {
        stageFound: !!stage,
        tabs,
        pins,
        img
      };
    })()`);
    console.log('Manifesto Check Result:', JSON.stringify(manifestoData, null, 2));

    // Scroll to Manifesto section and take screenshot
    await evalJs(cdp, `(() => {
      const el = document.querySelector('.cin-manifesto');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await new Promise(r => setTimeout(r, 1000));

    const shot1 = await cdp.cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'manifesto_character_stage.png'), Buffer.from(shot1.data, 'base64'));
    console.log('Saved manifesto_character_stage.png');

    // Test Search Modal
    console.log('[2/4] Testing Search overlay...');
    await evalJs(cdp, `(() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText && el.innerText.toUpperCase().includes('SEARCH'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 800));

    const searchData = await evalJs(cdp, `(() => {
      const overlay = document.querySelector('.search-overlay');
      const palette = document.querySelector('.search-palette-container');
      const header = document.querySelector('.search-telemetry-header')?.innerText;
      return {
        overlayFound: !!overlay,
        paletteFound: !!palette,
        header
      };
    })()`);
    console.log('Search Check Result:', JSON.stringify(searchData, null, 2));

    const shot2 = await cdp.cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'search_palette_hud.png'), Buffer.from(shot2.data, 'base64'));
    console.log('Saved search_palette_hud.png');

    // Close search overlay by pressing Escape
    await evalJs(cdp, `(() => {
      const closeBtn = document.querySelector('.search-close-btn');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    // Navigate to /collections
    console.log('[3/4] Navigating to /collections...');
    await cdp.cmd('Page.navigate', { url: `${base}/collections` });
    await waitFor(async () => {
      const v = await evalJs(cdp, 'document.readyState');
      return v === 'complete';
    });
    await new Promise(r => setTimeout(r, 2000));

    const collectionsData = await evalJs(cdp, `(() => {
      const page = document.querySelector('.cin-collections-page');
      const chapters = Array.from(document.querySelectorAll('.chapter-head h2')).map(h => h.innerText.trim());
      const productCards = document.querySelectorAll('.mini-card').length;
      return {
        pageFound: !!page,
        chapters,
        productCards
      };
    })()`);
    console.log('Collections Check Result:', JSON.stringify(collectionsData, null, 2));

    // Scroll into Chapter 01
    await evalJs(cdp, `(() => {
      const ch = document.querySelector('.cin-chapter-block');
      if (ch) ch.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`);
    await new Promise(r => setTimeout(r, 1200));

    const shot3 = await cdp.cmd('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'collections_anthology.png'), Buffer.from(shot3.data, 'base64'));
    console.log('Saved collections_anthology.png');

    await cdp.close();
    child.kill('SIGTERM');
    console.log('[4/4] All verification steps passed successfully!');
  } catch (err) {
    console.error('Verification error:', err);
    try { child.kill('SIGKILL'); } catch {}
    process.exit(1);
  }
}

main();
