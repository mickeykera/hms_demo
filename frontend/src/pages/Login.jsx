import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getWorkspacePath } from '../context/AuthContext';
import { Loader2, Hospital, Shield, Heart, Stethoscope, Users } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    await performLogin(username, password);
  };

  // Demo-account tiles log in immediately instead of only filling the form,
  // so a single click takes you to that role's dashboard.
  const handleDemoLogin = (demo) => performLogin(demo.username, demo.password);

  const performLogin = async (uname, pwd) => {
    setError('');
    setLoading(true);
    setPendingUser(uname);
    try {
      const user = await login(uname, pwd);
      navigate(user?.workspacePath || getWorkspacePath(user?.role));
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
      setPendingUser(null);
    }
  };

  const demoUsers = [
    { username: 'admin', password: 'Admin', role: 'Administrator' },
    { username: 'superadmin', password: 'SuperAdmin', role: 'Super Administrator' },
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
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Hospital className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-white">Hospital HMS</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Compassionate Care Starts Here</h1>
          <p className="text-blue-100 text-lg leading-relaxed mb-8">
            Comprehensive healthcare management platform for modern hospitals.
            Manage patients, clinical workflows, billing, laboratory, pharmacy, and more.
          </p>
          <div className="flex space-x-4 text-blue-200 text-sm">
            <Shield className="w-5 h-5" />
            <span>HIPAA Compliant • Secure • Real-time</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-blue-200 text-sm">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span>24/7 Support</span>
          </div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span>Clinical Excellence</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Patient-Centered</span>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Branding */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <Hospital className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Hospital HMS</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
              <p className="text-gray-600 mb-0">Sign in to access your dashboard</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your username"
                  />
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-gray-500 mb-3 text-center">Demo Accounts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {demoUsers.map(demo => (
                  <button
                    key={demo.username}
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemoLogin(demo)}
                    className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingUser === demo.username && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{demo.username}</div>
                      <div className="text-gray-500 truncate">{demo.role}</div>
                    </div>
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