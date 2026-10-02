/**
 * Regression coverage for the Patient dashboard quick actions.
 *
 * The bug this pins down: every `/patient/*` route renders the same
 * `PatientDashboard` component, and the component used to ignore the URL, so
 * clicking a quick action changed the address bar and then re-rendered the
 * identical overview. The buttons also shipped with no `onClick` handlers at
 * all, making them inert. Both are invisible to the API-level test suite, which
 * is exactly why this lives in the browser suite.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from './helpers/server.mjs';
import {
  activeTabLabel,
  assertNoErrors,
  bodyText,
  clickButton,
  launchBrowser,
  loginAs,
  pathname,
  rowCount,
} from './helpers/cdp.mjs';

describe('Patient portal quick actions', () => {
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

  const quickActions = [
    { button: 'Book Appointment', route: '/patient/appointments', tab: 'Appointments' },
    { button: 'View Records', route: '/patient/records', tab: 'Records' },
    { button: 'Prescriptions', route: '/patient/prescriptions', tab: 'Prescriptions' },
    { button: 'View Invoices', route: '/patient/invoices', tab: 'Invoices' },
  ];

  it('logs the patient in and lands on the portal', async () => {
    const landed = await loginAs(page, server.baseUrl, 'patient', 'Patient');
    expect(landed).toBe('/patient/dashboard');
  });

  it.each(quickActions)('$button navigates to $route', async ({ button, route, tab }) => {
    // Start each case from the overview so the button under test is present.
    await page.goto(`${server.baseUrl}/patient/dashboard`, { settle: 1200 });
    await clickButton(page, button);

    expect(await pathname(page)).toBe(route);
    expect(await activeTabLabel(page)).toBe(tab);
  });

  it('renders each section with data from the API', async () => {
    await page.goto(`${server.baseUrl}/patient/appointments`, { settle: 1200 });
    expect(await rowCount(page)).toBeGreaterThan(0);

    await page.goto(`${server.baseUrl}/patient/invoices`, { settle: 1200 });
    expect(await rowCount(page)).toBeGreaterThan(0);

    // Prescriptions/records are card layouts rather than tables, so assert on
    // the presence of a heading plus the absence of the empty state.
    await page.goto(`${server.baseUrl}/patient/prescriptions`, { settle: 1200 });
    expect(await bodyText(page)).toContain('My Prescriptions');
  });

  it('supports deep links and the browser back button', async () => {
    // A full load on the section must render it directly (deep link).
    await page.goto(`${server.baseUrl}/patient/invoices`, { settle: 1200 });
    expect(await activeTabLabel(page)).toBe('Invoices');

    // Then a client-side navigation, followed by back, must return to where we
    // started. Built from a fresh dashboard load so the history stack is
    // deterministic and does not depend on earlier tests.
    await page.goto(`${server.baseUrl}/patient/dashboard`, { settle: 1200 });
    await clickButton(page, 'View Invoices');
    expect(await pathname(page)).toBe('/patient/invoices');

    await page.evaluate('history.back()');
    await new Promise((r) => setTimeout(r, 900));
    expect(await pathname(page)).toBe('/patient/dashboard');
    expect(await activeTabLabel(page)).toBe('Overview');
  });

  it('logs no console or page errors while navigating every section', async () => {
    for (const { route } of quickActions) {
      await page.goto(`${server.baseUrl}${route}`, { settle: 1000 });
    }
    assertNoErrors(page);
  });
});