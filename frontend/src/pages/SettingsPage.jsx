import { Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <section className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Settings className="w-7 h-7 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-600 mt-2">Manage your account preferences.</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900">Account</h2>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="mt-1 text-gray-900">{user?.full_name}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Role</dt>
            <dd className="mt-1 text-gray-900">{user?.displayRole || user?.role}</dd>
          </div>
        </dl>

        {/* The page is otherwise read-only display. Linking the change screen
            rather than inlining the form keeps one implementation of it, so the
            voluntary and forced paths cannot drift apart. */}
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Password</p>
            <p className="text-sm text-gray-500">Change the password you sign in with.</p>
          </div>
          <Link to="/change-password" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            Change password
          </Link>
        </div>
      </div>
    </section>
  );
}
