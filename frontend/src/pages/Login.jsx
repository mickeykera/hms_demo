import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Hospital, Shield, Heart, Stethoscope, Users } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user?.workspacePath || '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { username: 'admin', password: 'Admin', role: 'Administrator' },
    { username: 'doctor', password: 'Doctor', role: 'Physician' },
    { username: 'receptionist', password: 'Receptionist', role: 'Receptionist' },
    { username: 'nurse', password: 'Nurse', role: 'Nurse' },
    { username: 'labtech', password: 'LabTech', role: 'Lab Technician' },
    { username: 'pharmacy', password: 'Pharmacy', role: 'Pharmacy' },
    { username: 'radiology', password: 'Radiology', role: 'Radiology' },
    { username: 'billing', password: 'Billing', role: 'Billing Staff' },
    { username: 'patient', password: 'Patient', role: 'Patient' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Hospital className="w-7 h-7 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-white">Hospital HMS</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-6">Hospital Management System</h1>
          <p className="text-blue-100 text-lg leading-relaxed mb-12">
            Comprehensive healthcare management platform for modern hospitals.
            Manage patients, clinical workflows, billing, laboratory, pharmacy, and more.
          </p>
          <div className="grid grid-cols-3 gap-4 text-blue-100">
            {[
              { icon: Users, label: 'Patient Management' },
              { icon: Stethoscope, label: 'Clinical Workflows' },
              { icon: Heart, label: 'IoT Monitoring' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-4 bg-white/10 rounded-xl">
                <div className="p-2 bg-white/20 rounded-lg"><item.icon className="w-5 h-5" /></div>
                <span className="font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-blue-200 text-sm">
          <Shield className="w-5 h-5" />
          <span>HIPAA Compliant • Secure • Real-time</span>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Hospital className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Hospital HMS</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600 mb-8">Sign in to access your dashboard</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your username"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-gray-500 mb-4 text-center">Demo Accounts</p>
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map(user => (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => { setUsername(user.username); setPassword(user.password); }}
                    className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-left transition text-gray-700"
                  >
                    <div className="font-medium">{user.username}</div>
                    <div className="text-gray-500">{user.role}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}