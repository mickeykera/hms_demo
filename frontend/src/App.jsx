import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import NurseDashboard from './pages/NurseDashboard';
import ReceptionDashboard from './pages/ReceptionDashboard';
import LaboratoryDashboard from './pages/LaboratoryDashboard';
import PharmacyDashboard from './pages/PharmacyDashboard';
import RadiologyDashboard from './pages/RadiologyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import HRDashboard from './pages/HRDashboard';
import InventoryDashboard from './pages/InventoryDashboard';
import EmergencyDashboard from './pages/EmergencyDashboard';
import SettingsPage from './pages/SettingsPage';
import './index.css';

const workspacePaths = {
  SuperAdmin: '/superadmin/dashboard',
  Admin: '/admin/dashboard',
  DepartmentAdmin: '/admin/department',
  Doctor: '/doctor/dashboard',
  Nurse: '/nurse/dashboard',
  Receptionist: '/reception/dashboard',
  LabTech: '/laboratory/dashboard',
  Pharmacy: '/pharmacy/dashboard',
  Radiology: '/radiology/dashboard',
  OperatingRoom: '/operating-room/dashboard',
  WardStaff: '/ward/dashboard',
  Billing: '/billing/dashboard',
  HR: '/hr/dashboard',
  Finance: '/finance/dashboard',
  Inventory: '/inventory/dashboard',
  Emergency: '/emergency/dashboard',
  Patient: '/patient/dashboard',
};

function withWorkspacePath(user) {
  return user && { ...user, workspacePath: workspacePaths[user.role] || '/dashboard' };
}

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
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !hasAnyRole(...allowedRoles)) return <Navigate to={user.workspacePath || '/login'} replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={workspacePaths[user.role] || '/dashboard'} /> : <Login />} />
      
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
        <Route path="/radiology/reports" element={<RadiologyDashboard />} />
        <Route path="/radiology/critical" element={<RadiologyDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['OperatingRoom']}><Layout /></ProtectedRoute>}>
        <Route path="/operating-room/dashboard" element={<div>Operating Room Dashboard - Coming Soon</div>} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['WardStaff']}><Layout /></ProtectedRoute>}>
        <Route path="/ward/dashboard" element={<div>Ward Dashboard - Coming Soon</div>} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Billing']}><Layout /></ProtectedRoute>}>
        <Route path="/billing/dashboard" element={<FinanceDashboard />} />
        <Route path="/billing/invoices" element={<FinanceDashboard />} />
        <Route path="/billing/payments" element={<FinanceDashboard />} />
        <Route path="/billing/insurance" element={<FinanceDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['HR']}><Layout /></ProtectedRoute>}>
        <Route path="/hr/dashboard" element={<HRDashboard />} />
        <Route path="/hr/employees" element={<HRDashboard />} />
        <Route path="/hr/departments" element={<HRDashboard />} />
        <Route path="/hr/attendance" element={<HRDashboard />} />
        <Route path="/hr/leave" element={<HRDashboard />} />
        <Route path="/hr/payroll" element={<HRDashboard />} />
        <Route path="/hr/performance" element={<HRDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Finance']}><Layout /></ProtectedRoute>}>
        <Route path="/finance/dashboard" element={<FinanceDashboard />} />
        <Route path="/finance/invoices" element={<FinanceDashboard />} />
        <Route path="/finance/payments" element={<FinanceDashboard />} />
        <Route path="/finance/insurance" element={<FinanceDashboard />} />
        <Route path="/finance/reports" element={<FinanceDashboard />} />
        <Route path="/finance/outstanding" element={<FinanceDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Inventory']}><Layout /></ProtectedRoute>}>
        <Route path="/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/inventory/inventory" element={<InventoryDashboard />} />
        <Route path="/inventory/orders" element={<InventoryDashboard />} />
        <Route path="/inventory/low-stock" element={<InventoryDashboard />} />
        <Route path="/inventory/expiring" element={<InventoryDashboard />} />
        <Route path="/inventory/suppliers" element={<InventoryDashboard />} />
        <Route path="/inventory/reports" element={<InventoryDashboard />} />
      </Route>
      
      <Route element={<ProtectedRoute allowedRoles={['Emergency']}><Layout /></ProtectedRoute>}>
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
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      
      {/* Module routes accessible by multiple roles */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/appointments" element={<div>Appointments Module - Coming Soon</div>} />
        <Route path="/clinical" element={<div>Clinical Module - Coming Soon</div>} />
        <Route path="/billing" element={<div>Billing Module - Coming Soon</div>} />
        <Route path="/lab" element={<div>Lab Module - Coming Soon</div>} />
        <Route path="/ward" element={<div>Ward Module - Coming Soon</div>} />
        <Route path="/iot" element={<div>IoT Module - Coming Soon</div>} />
        <Route path="/or" element={<div>OR Module - Coming Soon</div>} />
        <Route path="/pharmacy" element={<div>Pharmacy Module - Coming Soon</div>} />
        <Route path="/radiology" element={<div>Radiology Module - Coming Soon</div>} />
      </Route>
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}