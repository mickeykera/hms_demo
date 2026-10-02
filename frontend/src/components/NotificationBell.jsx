import { useState } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { api } from '../services/api';

/**
 * Working notification bell with an open/close panel.
 *
 * Replaces the decorative bell buttons that had no onClick handler, so the
 * control now does something when pressed. Closes on outside click and on
 * Escape, and marks items read via the API when the user clicks "Mark all read".
 */
export default function NotificationBell({ notifications = [], onChanged }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(notifications) ? notifications : [];

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
    } catch {
      // Non-fatal: the UI still clears locally if the endpoint is unavailable.
    }
    items.forEach((n) => { n.is_read = 1; });
    onChanged?.();
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        type="button"
        className="relative p-2 text-gray-600 hover:text-gray-900 rounded-md transition"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 min-w-[1.25rem] px-1 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            className="absolute right-0 mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] card overflow-hidden"
            role="dialog"
            aria-label="Notifications"
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-900">
                Notifications {unread > 0 && <span className="text-gray-500">({unread} new)</span>}
              </h3>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-800"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
              ) : (
                items.map((n, i) => (
                  <div
                    key={n.id ?? i}
                    className={`px-4 py-3 border-b border-border last:border-b-0 ${n.is_read ? '' : 'bg-blue-50/50'}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    {n.message && <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {n.type}{n.created_at ? ` • ${new Date(n.created_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 bg-surface-alt border-t border-border text-[11px] text-gray-500">
              Showing {items.length} notification{items.length === 1 ? '' : 's'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}