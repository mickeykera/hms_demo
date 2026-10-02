/**
 * Minimal Chrome DevTools Protocol driver for the browser E2E suite.
 *
 * Deliberately dependency-free: it drives a headless Chromium over the raw
 * DevTools WebSocket using Node's built-in WebSocket. Adding Puppeteer/Playwright
 * would pull hundreds of MB of browser binaries into the dependency tree for the
 * handful of assertions these tests make.
 */
import { spawn } from 'node:child_process';
import { existsSync, accessSync, constants, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_BIN,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
].filter(Boolean);

function findChromium() {
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (!existsSync(candidate)) continue;
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      /* present but not executable: keep looking */
    }
  }
  return null;
}

/**
 * Launch headless Chromium and attach to its first page target.
 *
 * Console/page errors are collected rather than thrown, so a test can assert
 * on them at the end ("navigating to X must not log a console error").
 */
export async function launchBrowser({ port = 0 } = {}) {
  const binary = findChromium();
  if (!binary) {
    throw new Error(
      `No Chromium binary found. Looked at: ${CHROMIUM_CANDIDATES.join(', ')}. ` +
        'Set CHROMIUM_BIN to override.'
    );
  }

  const debugPort = port || 9200 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'hms-e2e-'));

  const proc = spawn(
    binary,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  // Poll the HTTP endpoint instead of sleeping a fixed amount: on a cold machine
  // Chromium can take several seconds to expose the debugging socket.
  let target = null;
  for (let attempt = 0; attempt < 80 && !target; attempt++) {
    await sleep(250);
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      .then((r) => r.json())
      .catch(() => null);
    target = targets?.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  }
  if (!target) {
    proc.kill('SIGKILL');
    throw new Error('Chromium did not expose a debuggable page target in time');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('Failed to open the DevTools WebSocket'));
  });

  let nextId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(
        message.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')
      );
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const d = message.params.exceptionDetails;
      pageErrors.push(d.exception?.description || d.text || 'unknown page error');
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');

  /** Evaluate an expression in the page and return its value. */
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.result?.exceptionDetails) {
      throw new Error(
        response.result.exceptionDetails.exception?.description ||
          response.result.exceptionDetails.text
      );
    }
    return response.result?.result?.value;
  };

  /** Navigate, then let the SPA settle (React renders after `load`). */
  const goto = async (url, { settle = 900 } = {}) => {
    await send('Page.navigate', { url });
    await sleep(settle);
  };

  const close = () => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    proc.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  };

  return { evaluate, goto, close, consoleErrors, pageErrors };
}

/** Rendered text of the whole document. */
export const bodyText = (page) => page.evaluate('document.body.innerText');

/** Current client-side route. */
export const pathname = (page) => page.evaluate('location.pathname');

/**
 * Click the first button whose trimmed text matches exactly, then wait for the
 * client-side navigation to commit.
 *
 * Exact matching matters: the patient dashboard renders both a nav tab and a
 * quick-action button labelled "Prescriptions", and the two tests intentionally
 * target different elements.
 */
export async function clickButton(page, label, { settle = 800 } = {}) {
  const clicked = await page.evaluate(`(() => {
    const el = [...document.querySelectorAll('button')]
      .find(e => e.textContent.trim() === ${JSON.stringify(label)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`No button found with text "${label}"`);
  await new Promise((r) => setTimeout(r, settle));
  return true;
}

/** Number of rendered table body rows. */
export const rowCount = (page) => page.evaluate('document.querySelectorAll("tbody tr").length');

/** Text of the nav tab currently marked as the active section. */
export const activeTabLabel = (page) =>
  page.evaluate("document.querySelector('nav button[aria-current=page]')?.textContent.trim() || null");

/** Headings (h1/h2) currently on screen, useful for asserting a panel rendered. */
export const headings = (page) =>
  page.evaluate(
    "Array.from(document.querySelectorAll('h1,h2')).map(e => e.textContent.trim()).slice(0, 4).join(' | ')"
  );

/**
 * Log in through the real login form.
 *
 * React tracks controlled inputs with its own value setter, so assigning
 * `input.value` directly does not update component state. This goes through the
 * native prototype descriptor and dispatches an `input` event, which is what a
 * real keystroke produces.
 *
 * Assumes a logged-out session (i.e. a freshly launched browser).
 */
export async function loginAs(page, baseUrl, username, password) {
  await page.goto(baseUrl);
  const inputCount = await page.evaluate('document.querySelectorAll("input").length');
  if (inputCount < 2) {
    throw new Error(
      `Expected the login form to expose 2 inputs, found ${inputCount}. ` +
        'A stale session would cause this.'
    );
  }

  await page.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')].slice(0, 2);
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    [[${JSON.stringify(username)}, inputs[0]], [${JSON.stringify(password)}, inputs[1]]]
      .forEach(([value, input]) => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    return true;
  })()`);

  await clickButton(page, 'Sign In', { settle: 2200 });
  return pathname(page);
}

/** Formatted console/page errors, for assertion messages. */
export function describeErrors(page) {
  return [
    ...page.consoleErrors.map((e) => `console.error: ${e}`),
    ...page.pageErrors.map((e) => `pageerror: ${e}`),
  ].join('\n');
}

/** Assert there have been no console or page errors so far. */
export function assertNoErrors(page) {
  if (page.consoleErrors.length || page.pageErrors.length) {
    throw new Error(`Unexpected browser errors:\n${describeErrors(page)}`);
  }
}