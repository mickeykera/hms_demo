import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Makes a failed data load VISIBLE, and distinct from "there is nothing here".
 *
 * The dashboards previously ended every query with `.catch(() => [])`, which
 * turns a 500, a 403 or a dead endpoint into an empty list. A doctor whose
 * lab-orders endpoint 500s saw "no pending results" -- identical to a genuinely
 * clear queue. That is the most dangerous class of bug in this UI: it looks
 * correct and is clinically wrong.
 *
 * Removing the catch lets React Query surface the real error, and this renders
 * it. The retry button matters most in practice: these endpoints fail on
 * transient network problems and on an expired session, both of which clear
 * themselves without a reload.
 *
 * @param {Array<{label: string, error: any}>} sections
 */
export default function QueryErrorBanner({ sections = [], onRetry }) {
  const failed = sections.filter((s) => s?.error);

  if (failed.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">
            {failed.length === 1
              ? 'Could not load'
              : `Could not load ${failed.length} sections`}
          </p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {failed.map((s) => (
              <li key={s.label}>
                <span className="font-medium">{s.label}:</span>{' '}
                {/* The status code, not the message -- an API error body is
                    not written for a clinician to read. */}
                {statusOf(s.error)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            These panels are empty because the data could not be loaded, not
            because there is nothing to show. Do not treat them as a clear
            result.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1 rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A short, honest description of what went wrong. */
export function statusOf(error) {
  if (!error) return 'unknown error';
  if (error.code === 'ERR_NETWORK') return 'server unreachable';
  const status = error.response?.status;
  if (status === 401) return 'session expired';
  if (status === 403) return 'not permitted for your role';
  if (status === 404) return 'not available';
  if (status >= 500) return 'server error';
  if (status) return `request failed (${status})`;
  return error.message || 'unknown error';
}