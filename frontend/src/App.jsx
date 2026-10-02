import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, getWorkspacePath } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import './index.css';

// Route components are loaded on demand.
//
// Every page was previously imported eagerly, so a first-time visitor downloaded
// all ~20 dashboards and module pages before the login screen could render.
// Splitting keeps the initial payload to the shell (auth, layout, routing) and
// fetches each screen the first time it is actually visited.
//
// Login and the layout stay eager: they are guaranteed to be needed on first
// paint, and eagerly loading them avoids a flash of the Suspense fallback.
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const NurseDashboard = lazy(() => import('./pages/NurseDashboard'));
const ReceptionDashboard = lazy(() => import('./pages/ReceptionDashboard'));
const LaboratoryDashboard = lazy(() => import('./pages/LaboratoryDashboard'));
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const RadiologyDashboard = lazy(() => import('./pages/RadiologyDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'));
const HRDashboard = lazy(() => import('./pages/HRDashboard'));
const InventoryDashboard = lazy(() => import('./pages/InventoryDashboard'));
const EmergencyDashboard = lazy(() => import('./pages/EmergencyDashboard'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Module pages. These existed but were never routed, so the quick-action links
// that pointed at them rendered "Coming Soon" placeholders.
const Appointments = lazy(() => import('./pages/Appointments'));
const Billing = lazy(() => import('./pages/Billing'));
const Clinical = lazy(() => import('./pages/Clinical'));
const IoT = lazy(() => import('./pages/IoT'));
const Lab = lazy(() => import('./pages/Lab'));
const OR = lazy(() => import('./pages/OR'));
const Pharmacy = lazy(() => import('./pages/Pharmacy'));
const Reception = lazy(() => import('./pages/Reception'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ward = lazy(() => import('./pages/Ward'));

// Shown while a route chunk is in flight.
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

// NOTE: role -> landing route mapping now lives in AuthContext and is reached
// via getWorkspacePath(). It used to be duplicated here, which meant a role
// could be routed to a page that no longer existed. One copy, one place.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, hasAnyRole } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !hasAnyRole(...allowedRoles)) return <Navigate to={getWorkspacePath(user.role)} replace />;
  // Wrap every protected page so a render crash shows a recoverable error
  // screen instead of a blank page, and always offers a route back to login.
  // Keying on the pathname resets a previous crash when the user navigates.
  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getWorkspacePath(user.role)} replace /> : <Login />} />
      
      {/* Role-specific dashboard routes - backend enforced */}
      <Route element={<ProtectedRoute allowedRoles={['SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/superadmin/dashboard" element={<AdminDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['SuperAdmin', 'Admin', 'DepartmentAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/department" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminDashboard />} />
        <Route path="/admin/users/new" element={<AdminDashboard />} />
        <Route path="/admin/roles" element={<AdminDashboard />} />
        <Route path="/admin/departments" element={<AdminDashboard />} />
        <Route path="/admin/audit" element={<AdminDashboard />} />
        <Route path="/admin/reports" element={<AdminDashboard />} />
        <Route path="/admin/settings" element={<AdminDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Doctor']}><Layout /></ProtectedRoute>}>
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor/patients" element={<DoctorDashboard />} />
        <Route path="/doctor/appointments" element={<DoctorDashboard />} />
        <Route path="/doctor/consultations" element={<DoctorDashboard />} />
        <Route path="/doctor/prescriptions" element={<DoctorDashboard />} />
        <Route path="/doctor/lab-results" element={<DoctorDashboard />} />
        <Route path="/doctor/imaging" element={<DoctorDashboard />} />
        <Route path="/doctor/referrals" element={<DoctorDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Nurse']}><Layout /></ProtectedRoute>}>
        <Route path="/nurse/dashboard" element={<NurseDashboard />} />
        <Route path="/nurse/patients" element={<NurseDashboard />} />
        <Route path="/nurse/vitals" element={<NurseDashboard />} />
        <Route path="/nurse/medications" element={<NurseDashboard />} />
        <Route path="/nurse/tasks" element={<NurseDashboard />} />
        <Route path="/nurse/orders" element={<NurseDashboard />} />
        <Route path="/nurse/notes" element={<NurseDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Receptionist']}><Layout /></ProtectedRoute>}>
        <Route path="/reception/dashboard" element={<ReceptionDashboard />} />
        <Route path="/reception/appointments" element={<ReceptionDashboard />} />
        <Route path="/reception/registration" element={<ReceptionDashboard />} />
        <Route path="/reception/checkin" element={<ReceptionDashboard />} />
        <Route path="/reception/queue" element={<ReceptionDashboard />} />
        <Route path="/reception/patients" element={<ReceptionDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['LabTech']}><Layout /></ProtectedRoute>}>
        <Route path="/laboratory/dashboard" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/queue" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/samples" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/in-progress" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/results" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/critical" element={<LaboratoryDashboard />} />
        <Route path="/laboratory/inventory" element={<LaboratoryDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Pharmacy']}><Layout /></ProtectedRoute>}>
        <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/queue" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/dispensing" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/inventory" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/low-stock" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/expiring" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/suppliers" element={<PharmacyDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Radiology']}><Layout /></ProtectedRoute>}>
        <Route path="/radiology/dashboard" element={<RadiologyDashboard />} />
        <Route path="/radiology/queue" element={<RadiologyDashboard />} />
        <Route path="/radiology/scheduled" element={<RadiologyDashboard />} />
        <Route path="/radiology/in-progress" element={<RadiologyDashboard />} />
        <Route path="/radiology/reports" element={<RadiologyDashboard />} />
        <Route path="/radiology/critical" element={<RadiologyDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Doctor', 'Nurse', 'Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/operating-room/dashboard" element={<OR />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Nurse', 'Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/ward/dashboard" element={<Ward />} />
      </Route>
      
      {/* Admin is included because the billing APIs authorize Admin alongside
          Billing for the system-wide finance view. Without it the API allowed
          the request but the router bounced Admins to their own dashboard. */}
      <Route element={<ProtectedRoute allowedRoles={['Billing', 'Admin']}><Layout /></ProtectedRoute>}>
        <Route path="/billing/dashboard" element={<FinanceDashboard />} />
        <Route path="/billing/invoices" element={<FinanceDashboard />} />
        <Route path="/billing/payments" element={<FinanceDashboard />} />
        <Route path="/billing/insurance" element={<FinanceDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/hr/dashboard" element={<HRDashboard />} />
        <Route path="/hr/employees" element={<HRDashboard />} />
        <Route path="/hr/departments" element={<HRDashboard />} />
        <Route path="/hr/attendance" element={<HRDashboard />} />
        <Route path="/hr/leave" element={<HRDashboard />} />
        <Route path="/hr/payroll" element={<HRDashboard />} />
        <Route path="/hr/performance" element={<HRDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Billing', 'Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/finance/dashboard" element={<FinanceDashboard />} />
        <Route path="/finance/invoices" element={<FinanceDashboard />} />
        <Route path="/finance/payments" element={<FinanceDashboard />} />
        <Route path="/finance/insurance" element={<FinanceDashboard />} />
        <Route path="/finance/reports" element={<FinanceDashboard />} />
        <Route path="/finance/outstanding" element={<FinanceDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Pharmacy', 'Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/inventory/inventory" element={<InventoryDashboard />} />
        <Route path="/inventory/orders" element={<InventoryDashboard />} />
        <Route path="/inventory/low-stock" element={<InventoryDashboard />} />
        <Route path="/inventory/expiring" element={<InventoryDashboard />} />
        <Route path="/inventory/suppliers" element={<InventoryDashboard />} />
        <Route path="/inventory/reports" element={<InventoryDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Receptionist', 'Doctor', 'Nurse', 'Admin', 'SuperAdmin']}><Layout /></ProtectedRoute>}>
        <Route path="/emergency/dashboard" element={<EmergencyDashboard />} />
        <Route path="/emergency/triage" element={<EmergencyDashboard />} />
        <Route path="/emergency/patients" element={<EmergencyDashboard />} />
        <Route path="/emergency/ambulance" element={<EmergencyDashboard />} />
        <Route path="/emergency/resources" element={<EmergencyDashboard />} />
        <Route path="/emergency/stats" element={<EmergencyDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Patient']}><Layout /></ProtectedRoute>}>
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/patient/appointments" element={<PatientDashboard />} />
        <Route path="/patient/records" element={<PatientDashboard />} />
        <Route path="/patient/prescriptions" element={<PatientDashboard />} />
        <Route path="/patient/lab-results" element={<PatientDashboard />} />
        <Route path="/patient/imaging" element={<PatientDashboard />} />
        <Route path="/patient/invoices" element={<PatientDashboard />} />
        <Route path="/patient/messages" element={<PatientDashboard />} />
      </Route>

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      
      {/* Module routes accessible by multiple roles.
          These previously rendered "Coming Soon" placeholders even though the
          full pages existed and were never routed, so every quick action that
          pointed here landed on a dead end. */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/clinical" element={<Clinical />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/ward" element={<Ward />} />
        <Route path="/iot" element={<IoT />} />
        <Route path="/or" element={<OR />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/reception" element={<Reception />} />
        <Route path="/radiology" element={<RadiologyDashboard />} />
      </Route>
      
      {/* Unknown URL: send signed-in users to their own dashboard rather than
          bouncing them through /login and out again. */}
      <Route path="*" element={<Navigate to={user ? getWorkspacePath(user.role) : '/login'} replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}