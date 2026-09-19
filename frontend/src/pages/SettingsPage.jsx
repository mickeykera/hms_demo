import { Settings } from 'lucide-react';
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
      </div>
    </section>
  );
}
