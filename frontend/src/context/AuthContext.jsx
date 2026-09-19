import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

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

const roleDisplayNames = {
  SuperAdmin: 'Super Administrator',
  Admin: 'Hospital Administrator',
  DepartmentAdmin: 'Department Administrator',
  Doctor: 'Physician',
  Nurse: 'Registered Nurse',
  Receptionist: 'Receptionist',
  LabTech: 'Laboratory Technician',
  Pharmacy: 'Pharmacist',
  Radiology: 'Radiology Technician',
  OperatingRoom: 'Operating Room Staff',
  WardStaff: 'Ward Staff',
  Billing: 'Billing Specialist',
  HR: 'HR Personnel',
  Finance: 'Finance Personnel',
  Inventory: 'Inventory Manager',
  Emergency: 'Emergency Department Staff',
  Patient: 'Patient',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (Array.isArray(parsedUser.permissions)) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const res = await authService.login(username, password);
    const { token, user: responseUser } = res.data;
    const userData = { 
      ...responseUser, 
      workspacePath: workspacePaths[responseUser.role] || '/dashboard',
      displayRole: roleDisplayNames[responseUser.role] || responseUser.role,
    };
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);
  const hasAnyRole = (...roles) => user && roles.some(r => user.role === r);
  const canAccess = (module) => user?.permissions?.includes(module) || false;
  const hasPermission = (...perms) => user?.permissions?.some(p => perms.includes(p)) || false;
  const hasAllPermissions = (...perms) => user?.permissions?.every(p => perms.includes(p)) || false;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      hasRole, 
      hasAnyRole,
      canAccess, 
      hasPermission,
      hasAllPermissions,
      loading,
      workspacePaths,
      roleDisplayNames,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}