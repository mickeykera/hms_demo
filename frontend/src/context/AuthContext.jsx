import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

/**
 * Single source of truth for "where does this role land after login".
 * Exported so App.jsx routes can reuse it instead of keeping a second copy
 * that can silently drift out of sync.
 */
export const workspacePaths = {
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

/**
 * Resolve the landing route for a role.
 *
 * `/dashboard` was previously the fallback, but no such route is registered,
 * so any unmapped role silently rendered a blank page. Admins are the correct
 * fallback destination: they have the broadest access, so an unrecognised
 * role still lands somewhere usable instead of nowhere.
 */
export function getWorkspacePath(role) {
  return workspacePaths[role] || '/admin/dashboard';
}

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
          // Re-resolve rather than trusting the cached value, so a session
          // stored by an older build still routes to a valid page.
          setUser({
            ...parsedUser,
            workspacePath: getWorkspacePath(parsedUser.role),
            displayRole: parsedUser.displayRole
              || roleDisplayNames[parsedUser.role]
              || parsedUser.role,
          });
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
    return establishSession(res.data);
  };

  // Demo shortcut. The server decides whether this is available at all; the
  // response shape is identical to a normal login, so both paths share
  // establishSession and cannot drift apart in how a session is set up.
  const demoLogin = async (username) => {
    const res = await authService.demoLogin(username);
    return establishSession(res.data);
  };

  // Single place where a successful auth response becomes an app session.
  const establishSession = ({ token, user: responseUser }) => {
    const userData = {
      ...responseUser,
      workspacePath: getWorkspacePath(responseUser.role),
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
    // A full reload guarantees we land on the login route. Without this the
    // user stays parked on whatever protected page they were viewing (or on
    // an error screen), which reads as "stuck in the system".
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
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
      demoLogin,
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