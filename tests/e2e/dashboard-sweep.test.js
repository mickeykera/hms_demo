/**
 * Cross-role dashboard sweep.
 *
 * Guards two classes of regression that the API-level suite cannot see:
 *  1. A dashboard tab that throws while rendering (React error boundary, console
 *     error) but whose endpoints still return 200.
 *  2. A tab that renders plausible-looking but hardcoded numbers instead of data
 *     from the API -- the failure mode that produced the "1,247 items /
 *     $2,450,000" inventory tiles and the HR/Emergency stat rows.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from './helpers/server.mjs';
import {
  assertNoErrors,
  bodyText,
  describeErrors,
  headings,
  launchBrowser,
  loginAs,
  rowCount,
} from './helpers/cdp.mjs';

/** Tabs that must render rows from their backing endpoint. */
const TABLE_TABS = [
  { route: '/hr/attendance', label: 'Attendance' },
  { route: '/hr/leave', label: 'Leave' },
  { route: '/hr/payroll', label: 'Payroll' },
  { route: '/emergency/ambulance', label: 'Ambulance' },
  { route: '/emergency/stats', label: 'Stats' },
  { route: '/inventory/orders', label: 'Purchase Orders' },
  { route: '/inventory/suppliers', label: 'Suppliers' },
  { route: '/inventory/reports', label: 'Inventory Reports' },
];

/** Overviews that previously showed invented figures. */
const FABRICATED_VALUES = [
  // Inventory overview
  'Syringe 10ml',
  'IV Catheter',
  'Gloves Nitrile',
  'Normal Saline',
  '2,450,000',
  '185,000',
  '1,247',
  // HR overview
  'Open Positions',
  '450,000',
  // Emergency overview
  '3 patients in critical condition',
];

const OVERVIEWS = ['/hr/dashboard', '/emergency/dashboard', '/inventory/dashboard', '/admin/dashboard'];

describe('Dashboard sweep', () => {
  let server;
  let page;

  beforeAll(async () => {
    server = await startServer();
    page = await launchBrowser();
  });

  afterAll(async () => {
    await page?.close();
    server?.stop();
  });

  it('admin can sign in', async () => {
    const landed = await loginAs(page, server.baseUrl, 'admin', 'Admin');
    expect(landed).toBe('/admin/dashboard');
  });

  it.each(TABLE_TABS)('$route renders data rows', async ({ route, label }) => {
    await page.goto(`${server.baseUrl}${route}`, { settle: 1200 });
    expect(await headings(page)).toContain(label);
    expect(await rowCount(page)).toBeGreaterThan(0);
  });

  it.each(OVERVIEWS)('%s shows no fabricated values', async (route) => {
    await page.goto(`${server.baseUrl}${route}`, { settle: 1200 });
    const text = await bodyText(page);
    const present = FABRICATED_VALUES.filter((value) => text.includes(value));
    expect(present, `hardcoded values still rendered on ${route}: ${present.join(', ')}`).toEqual([]);
  });

  it('system settings are editable inputs seeded from the API', async () => {
    await page.goto(`${server.baseUrl}/admin/settings`, { settle: 1200 });
    const values = await page.evaluate(
      '[...document.querySelectorAll("input")].map(i => i.value).filter(Boolean)'
    );
    expect(values).toContain('General Hospital');
    expect(values).toContain('USD');
  });

  it('every dashboard renders without console or page errors', async () => {
    for (const route of [...OVERVIEWS, ...TABLE_TABS.map((t) => t.route), '/admin/settings']) {
      await page.goto(`${server.baseUrl}${route}`, { settle: 900 });
    }
    if (page.consoleErrors.length || page.pageErrors.length) {
      throw new Error(`Browser errors during sweep:\n${describeErrors(page)}`);
    }
    assertNoErrors(page);
  });
});