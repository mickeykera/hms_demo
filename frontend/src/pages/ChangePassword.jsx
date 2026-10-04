import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

/**
 * Self-service password change, in two modes:
 *   forced   -- reached automatically when must_change_password is set. The API
 *            blocks every other endpoint until it succeeds, so there is no way
 *            to skip it; the form offers sign-out instead of cancel.
 *   voluntary -- the same route from Settings, with a way out.
 *
 * Server field-level messages render against their own inputs rather than
 * collapsing into one banner, so a rejected password says which rule it broke.
 */
export default function ChangePassword() {
  const { user, logout, markPasswordChanged } = useAuth();

  // Derived, not passed as a prop: one route serves both paths, and a stale
  // prop would let a flagged account appear to skip the gate.
  const forced = Boolean(user?.must_change_password);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const fieldError = (name) => errors?.[name]?.[0];

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    setFormError('');

    // Client-side only for the "did you type it twice" mistake. The server
    // enforces the real policy and stays the source of truth.
    if (next !== confirm) {
      setErrors({ confirm: ['Passwords do not match'] });
      return;
    }

    setPending(true);
    try {
      await authService.changePassword(current, next);
      setDone(true);

      if (forced) {
        // The API has already cleared the flag; refresh the cached user so the
        // router stops redirecting here rather than waiting for a new login.
        markPasswordChanged();
      } else {
        setCurrent('');
        setNext('');
        setConfirm('');
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'VALIDATION_ERROR' && data.details) {
        setErrors(data.details);
      } else {
        setFormError(data?.error || 'Could not change your password. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  if (done && forced) {
    return (
      <section className="max-w-md mx-auto mt-16 text-center">
        <div className="bg-white rounded-lg shadow p-8">
          <KeyRound className="w-8 h-8 text-green-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated</h1>
          <p className="text-gray-600 text-sm">Your account is ready. Taking you back to the system…</p>
        </div>
      </section>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <section className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg shadow p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <KeyRound className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">
            {forced ? 'Set a new password' : 'Change your password'}
          </h1>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          {forced
            ? 'You must set your own password before you can continue. Yours was generated for you, so please replace it with something only you know.'
            : 'Enter your current password to confirm it is you, then choose a new one.'}
        </p>

        {formError && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {formError}
          </div>
        )}
        {done && !forced && (
          <div role="status" className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
            Password changed.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input type="password" autoComplete="current-password" required value={current}
              onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
            {fieldError('currentPassword') && (
              <p role="alert" className="mt-1 text-sm text-red-600">{fieldError('currentPassword')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input type="password" autoComplete="new-password" required value={next}
              onChange={(e) => setNext(e.target.value)} className={inputCls} />
            <p className="mt-1 text-xs text-gray-500">At least 12 characters, and not your username.</p>
            {fieldError('newPassword') && (
              <p role="alert" className="mt-1 text-sm text-red-600">{fieldError('newPassword')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input type="password" autoComplete="new-password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            {fieldError('confirm') && (
              <p role="alert" className="mt-1 text-sm text-red-600">{fieldError('confirm')}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t">
            {forced ? (
              <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
                Sign out instead
              </button>
            ) : (
              <button type="button" onClick={() => window.history.back()} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            )}
            <button type="submit" disabled={pending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
              {forced ? 'Set password' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
      {user?.username && (
        <p className="text-xs text-gray-500 mt-4 text-center">Signed in as {user.username}</p>
      )}
    </section>
  );
}