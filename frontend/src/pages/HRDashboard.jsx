import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, UserPlus, UserCheck, Clock, DollarSign, FileText,
  Search, Eye, Edit, Plus, Bell, AlertTriangle,
  Calendar, Briefcase, Award, Shield, Settings,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'leave', label: 'Leave Management', icon: Calendar },
  { id: 'payroll', label: 'Payroll', icon: DollarSign },
  { id: 'performance', label: 'Performance', icon: Award },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function Building2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 21v-2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"/><path d="M18 21V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v15"/><path d="M12 11h.01"/><path d="M12 16h.01"/><path d="M12 6.5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5"/></svg>;
}

export default function HRDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  const stats = {
    totalEmployees: 156,
    activeEmployees: 142,
    onLeave: 8,
    openPositions: 12,
    pendingLeave: 5,
    payrollThisMonth: 450000,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <button className="relative p-2 text-gray-600 hover:text-gray-900">
            <Bell className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalEmployees}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.activeEmployees}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.onLeave}</p>
            </div>
            <div className="p-3 rounded-full bg-yellow-100">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Positions</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.openPositions}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Leave</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.pendingLeave}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Payroll This Month</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">${stats.payrollThisMonth.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <nav className="flex border-b overflow-x-auto" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Hires</h2>
            <div className="space-y-3">
              {[
                { name: 'Dr. Sarah Johnson', role: 'Cardiologist', dept: 'Cardiology', date: '2024-01-15' },
                { name: 'Nurse Maria Santos', role: 'RN', dept: 'ICU', date: '2024-01-10' },
                { name: 'Tech James Wilson', role: 'Lab Tech', dept: 'Laboratory', date: '2024-01-08' },
              ].map((emp, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-sm text-gray-500">{emp.role} • {emp.dept} • {format(new Date(emp.date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Hire New Employee', icon: UserPlus, color: 'purple' },
                  { label: 'Process Leave Request', icon: Calendar, color: 'blue' },
                  { label: 'Run Payroll', icon: DollarSign, color: 'emerald' },
                  { label: 'Schedule Training', icon: Award, color: 'orange' },
                  { label: 'View Attendance', icon: Clock, color: 'indigo' },
                  { label: 'Generate Report', icon: FileText, color: 'gray' },
                ].map((action, i) => (
                  <button key={i} className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition text-left">
                    <div className={`p-2 rounded-lg bg-${action.color}-100`}>
                      <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                    </div>
                    <span className="font-medium text-gray-900">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Leave</h2>
              <div className="space-y-3">
                {[
                  { name: 'Dr. Robert Chen', type: 'Annual Leave', dates: 'Jan 20-26', status: 'Approved' },
                  { name: 'Nurse Lisa Park', type: 'Sick Leave', dates: 'Jan 18-19', status: 'Pending' },
                ].map((leave, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{leave.name}</p>
                      <p className="text-sm text-gray-500">{leave.type} • {leave.dates}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${leave.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Employee management coming soon</p>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Department management coming soon</p>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Attendance tracking coming soon</p>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Leave management coming soon</p>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Payroll processing coming soon</p>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Performance reviews coming soon</p>
        </div>
      )}
    </div>
  );
}