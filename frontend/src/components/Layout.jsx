import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import NotificationBell from './NotificationBell';
import {
  LayoutDashboard, Users, Stethoscope, DollarSign, FlaskConical, Bed,
  Cpu, Scissors, Calendar, Pill, LogOut, Menu, X,
  PanelLeftClose, PanelLeftOpen,
  Home, Settings, Bell, User, Search, Heart, Activity, Microscope,
  TestTube, Package, Truck, Shield, Building2, FileText, BarChart2,
  Key, Lock, Unlock, Award, Clock, Briefcase, RotateCcw, Box,
  Ambulance, Cross, Zap, Flag as FlagIcon, HeartPulse, UserPlus, UserCheck, UserX,
} from 'lucide-react';

// NOTE: XRay is not exported by lucide-react, and the icons below are declared
// as local stubs further down. Do not import them from lucide-react - doing so
// collides with the local declarations and breaks the build.

const roleNavigation = {
  SuperAdmin: [
    { path: '/superadmin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/roles', label: 'Roles & Permissions', icon: Shield },
    { path: '/admin/departments', label: 'Departments', icon: Building2 },
    { path: '/admin/audit', label: 'Audit Logs', icon: FileText },
    { path: '/admin/reports', label: 'Reports', icon: BarChart2 },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  Admin: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/roles', label: 'Roles & Permissions', icon: Shield },
    { path: '/admin/departments', label: 'Departments', icon: Building2 },
    { path: '/admin/audit', label: 'Audit Logs', icon: FileText },
    { path: '/admin/reports', label: 'Reports', icon: BarChart2 },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  DepartmentAdmin: [
    { path: '/admin/department', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Staff', icon: Users },
    { path: '/admin/reports', label: 'Reports', icon: BarChart2 },
  ],
  Doctor: [
    { path: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/doctor/patients', label: 'My Patients', icon: Users },
    { path: '/doctor/appointments', label: 'Appointments', icon: Calendar },
    { path: '/doctor/consultations', label: 'Consultations', icon: Stethoscope },
    { path: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill },
    { path: '/doctor/lab-results', label: 'Lab Results', icon: FlaskConical },
    { path: '/doctor/imaging', label: 'Imaging', icon: Activity },
    { path: '/doctor/referrals', label: 'Referrals', icon: HeartPulse },
  ],
  Nurse: [
    { path: '/nurse/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/nurse/patients', label: 'My Patients', icon: Users },
    { path: '/nurse/vitals', label: 'Vital Signs', icon: Heart },
    { path: '/nurse/medications', label: 'Medications', icon: Pill },
    { path: '/nurse/tasks', label: 'Tasks', icon: FileText },
    { path: '/nurse/orders', label: 'Doctor Orders', icon: Stethoscope },
    { path: '/nurse/notes', label: 'Nursing Notes', icon: ClipboardList },
  ],
  Receptionist: [
    { path: '/reception/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/reception/appointments', label: 'Appointments', icon: Calendar },
    { path: '/reception/registration', label: 'Registration', icon: UserPlus },
    { path: '/reception/checkin', label: 'Check-In', icon: UserCheck },
    { path: '/reception/queue', label: 'Queue', icon: FileText },
    { path: '/reception/patients', label: 'Patients', icon: Users },
  ],
  LabTech: [
    { path: '/laboratory/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/laboratory/queue', label: 'Test Queue', icon: FlaskConical },
    { path: '/laboratory/samples', label: 'Samples', icon: TestTube },
    { path: '/laboratory/in-progress', label: 'In Progress', icon: Microscope },
    { path: '/laboratory/results', label: 'Results', icon: FileText },
    { path: '/laboratory/critical', label: 'Critical', icon: AlertTriangle },
    { path: '/laboratory/inventory', label: 'Inventory', icon: Package },
  ],
  Pharmacy: [
    { path: '/pharmacy/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pharmacy/queue', label: 'Prescription Queue', icon: Pill },
    { path: '/pharmacy/dispensing', label: 'Dispensing', icon: Package },
    { path: '/pharmacy/inventory', label: 'Inventory', icon: Package },
    { path: '/pharmacy/low-stock', label: 'Low Stock', icon: AlertTriangle },
    { path: '/pharmacy/expiring', label: 'Expiring', icon: Clock },
    { path: '/pharmacy/suppliers', label: 'Suppliers', icon: Truck },
  ],
  Radiology: [
    { path: '/radiology/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/radiology/queue', label: 'Imaging Queue', icon: Activity },
    { path: '/radiology/scheduled', label: 'Scheduled', icon: Calendar },
    { path: '/radiology/in-progress', label: 'In Progress', icon: XRay },
    { path: '/radiology/reports', label: 'Reports', icon: FileText },
    { path: '/radiology/critical', label: 'Critical', icon: AlertTriangle },
  ],
  OperatingRoom: [
    { path: '/operating-room/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  WardStaff: [
    { path: '/ward/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ],
  Billing: [
    { path: '/billing/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/billing/invoices', label: 'Invoices', icon: FileText },
    { path: '/billing/payments', label: 'Payments', icon: CreditCard },
    { path: '/billing/insurance', label: 'Insurance', icon: Shield },
  ],
  Finance: [
    { path: '/finance/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/finance/invoices', label: 'Invoices', icon: FileText },
    { path: '/finance/payments', label: 'Payments', icon: CreditCard },
    { path: '/finance/insurance', label: 'Insurance', icon: Shield },
    { path: '/finance/reports', label: 'Reports', icon: BarChart2 },
    { path: '/finance/outstanding', label: 'Outstanding', icon: AlertTriangle },
  ],
  HR: [
    { path: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/hr/employees', label: 'Employees', icon: Users },
    { path: '/hr/departments', label: 'Departments', icon: Building2 },
    { path: '/hr/attendance', label: 'Attendance', icon: Clock },
    { path: '/hr/leave', label: 'Leave', icon: Calendar },
    { path: '/hr/payroll', label: 'Payroll', icon: DollarSign },
    { path: '/hr/performance', label: 'Performance', icon: Award },
  ],
  Inventory: [
    { path: '/inventory/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/inventory/inventory', label: 'Inventory', icon: Package },
    { path: '/inventory/orders', label: 'Purchase Orders', icon: FileText },
    { path: '/inventory/low-stock', label: 'Low Stock', icon: AlertTriangle },
    { path: '/inventory/expiring', label: 'Expiring', icon: Clock },
    { path: '/inventory/suppliers', label: 'Suppliers', icon: Truck },
    { path: '/inventory/reports', label: 'Reports', icon: BarChart2 },
  ],
  Emergency: [
    { path: '/emergency/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/emergency/triage', label: 'Triage Queue', icon: FlagIcon },
    { path: '/emergency/patients', label: 'Active Patients', icon: Users },
    { path: '/emergency/ambulance', label: 'Ambulance', icon: Ambulance },
    { path: '/emergency/resources', label: 'Resources', icon: Shield },
    { path: '/emergency/stats', label: 'Statistics', icon: BarChart2 },
  ],
  Patient: [
    { path: '/patient/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { path: '/patient/appointments', label: 'Appointments', icon: Calendar },
    { path: '/patient/records', label: 'Medical Records', icon: FileText },
    { path: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
    { path: '/patient/lab-results', label: 'Lab Results', icon: FlaskConical },
    { path: '/patient/imaging', label: 'Imaging', icon: Activity },
    { path: '/patient/invoices', label: 'Bills', icon: DollarSign },
    { path: '/patient/messages', label: 'Messages', icon: MessageSquare },
  ],
};

function XRay({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
}

function ClipboardList({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="5" width="6" height="16" rx="1"/><path d="M16 14H8"/><path d="M16 10H8"/><path d="M16 6H8"/></svg>;
}

function MessageSquare({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}

function CreditCard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
}

function AlertTriangle({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  // Feeds the header notification bell. Scoped to the signed-in user and
  // marked unread-only, matching what the dashboards already fetch.
  const { data: headerNotifications = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications', { params: { unread: true } })
      .then(r => r.data.notifications || []).catch(() => []),
    enabled: !!user?.id,
    refetchInterval: 30000,
  });
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = roleNavigation[user?.role] || roleNavigation.Patient;
  const settingsPath = user?.role === 'Admin' || user?.role === 'SuperAdmin'
    ? '/admin/settings'
    : '/settings';

  const displayName = user?.full_name || 'User';
  const displayRole = user?.displayRole || (user?.role ? user.role.toLowerCase().replace(/([A-Z])/g, ' $1') : '');

  // Allow dismissing the mobile drawer with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-surface-alt">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-white border-r',
          'transition-transform duration-300 ease-in-out',
          // Mobile: overlay drawer, only visible when opened.
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // md+ : persistent sidebar driven by the collapse toggle.
          sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full',
        ].join(' ')}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border pt-[env(safe-area-inset-top)]">
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-2">
                <span className="text-lg font-bold text-gray-900">HMS</span>
                <span className="block text-xs text-gray-500 -mt-0.5">Hospital Management</span>
              </div>
            </div>
            <button
              className="md:hidden p-2 -mr-2 rounded-md text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {navigation.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User info & logout */}
          <div className="p-4 border-t border-border pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 capitalize">{displayRole}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Padding-left tracks the sidebar. Without a transition the content area
          snapped to full width while the sidebar was still animating, which
          read as the dashboard "stretching" during collapse. */}
      <div
        className={[
          'transition-[padding] duration-300 ease-in-out',
          sidebarOpen ? 'md:pl-64' : 'md:pl-0',
        ].join(' ')}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu size={24} />
              </button>
              <button
                className="hidden md:block p-2 rounded-md text-gray-600 hover:bg-gray-100"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Collapse navigation sidebar' : 'Expand navigation sidebar'}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
              <h1 className="text-xl font-semibold text-gray-800 hidden sm:block truncate">
                {location.pathname.split('/').pop().replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()) || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <NotificationBell notifications={headerNotifications} />
              <button
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                onClick={() => navigate(settingsPath)}
                title="Open settings"
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              {/* Always-available escape hatch: switch user / get back to
                  the login screen without hunting for the sidebar. */}
              <button
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                onClick={logout}
                title="Sign out and return to login"
                aria-label="Sign out and return to login"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
