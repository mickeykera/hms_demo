import { useNavigate } from 'react-router-dom';
import { getColor } from '../utils/colorMap';

/**
 * Quick-action tiles that actually navigate.
 *
 * Previously these were plain <button>s with no handler (or <a href> to
 * unregistered routes), so every one was a dead control. Each action now
 * carries a `to` route; entries without one are skipped rather than shown
 * as controls that cannot work.
 */
export default function QuickActions({ actions = [], title = 'Quick Actions' }) {
  const navigate = useNavigate();
  const usable = actions.filter((a) => a && a.to);

  if (usable.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-3">
        {usable.map((action, i) => {
          const colors = getColor(action.color);
          const Icon = action.icon;
          return (
            <button
              key={action.label ?? i}
              type="button"
              onClick={() => navigate(action.to)}
              className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left"
            >
              {Icon ? (
                <div className={`p-2 rounded-lg shrink-0 ${colors.icon}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
                </div>
              ) : (
                <div className={`p-2 rounded-lg shrink-0 ${colors.icon}`} />
              )}
              <span className="font-medium text-gray-900">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}