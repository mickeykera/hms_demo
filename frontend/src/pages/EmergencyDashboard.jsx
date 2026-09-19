import { useState, useEffect } from 'react';
import { useDashboardTab } from '../hooks/useDashboardTab';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Heart, Users, Clock, CheckCircle, Search,
  Eye, Edit, Plus, Bell, AlertCircle, Stethoscope,
  Activity, Droplet, Thermometer, Weight, Shield,
  Ambulance, Cross, Zap, Flag as FlagIcon,
} from 'lucide-react';
import { format } from 'date-fns';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'triage', label: 'Triage Queue', icon: FlagIcon },
  { id: 'patients', label: 'Active Patients', icon: Users },
  { id: 'ambulance', label: 'Ambulance', icon: Ambulance },
  { id: 'resources', label: 'Resources', icon: Shield },
  { id: 'stats', label: 'Statistics', icon: BarChart2 },
];

function LayoutDashboard({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function BarChart2({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
}

function Flag({ className }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}

export default function EmergencyDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useDashboardTab('overview');

  const stats = {
    waitingTriage: 12,
    criticalPatients: 3,
    activePatients: 18,
    availableBeds: 5,
    ambulancesActive: 3,
    ambulancesAvailable: 2,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Department Dashboard</h1>
          <p className="text-gray-600">{user?.full_name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            {user?.displayRole}
          </span>
          <button className="relative p-2 text-gray-600 hover:text-gray-900">
            <Bell className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              3
            </span>
          </button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-900">CRITICAL ALERT</p>
            <p className="text-sm text-red-700">3 patients in critical condition requiring immediate attention</p>
          </div>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">View Critical Patients</button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Waiting Triage</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.waitingTriage}</p>
            </div>
            <div className="p-3 rounded-full bg-red-100">
              <Flag className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Patients</p>
              <p className="text-3xl font-bold text-red-700 mt-1">{stats.criticalPatients}</p>
            </div>
            <div className="p-3 rounded-full bg-red-200">
              <Heart className="w-6 h-6 text-red-700" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Patients</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.activePatients}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Available ED Beds</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.availableBeds}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ambulances Active</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.ambulancesActive}</p>
            </div>
            <div className="p-3 rounded-full bg-amber-100">
              <Ambulance className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ambulances Available</p>
              <p className="text-3xl font-bold text-gray-600 mt-1">{stats.ambulancesAvailable}</p>
            </div>
            <div className="p-3 rounded-full bg-gray-100">
              <Ambulance className="w-6 h-6 text-gray-600" />
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
              className={`px-6 py-4 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <tab.icon className="w-4 h-4 mr-2 inline" /> {tab.label}
              {tab.id === 'triage' && stats.waitingTriage > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{stats.waitingTriage}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Triage Queue */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-600" /> Triage Queue
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { pos: 1, name: 'John Doe', age: 45, chief: 'Chest pain', triage: 1, time: '10:15', vitals: 'BP 180/110 HR 110' },
                  { pos: 2, name: 'Jane Smith', age: 32, chief: 'Severe abdominal pain', triage: 2, time: '10:20', vitals: 'BP 140/90 HR 95' },
                  { pos: 3, name: 'Bob Wilson', age: 28, chief: 'Laceration forehead', triage: 3, time: '10:25', vitals: 'BP 120/80 HR 85' },
                  { pos: 4, name: 'Alice Brown', age: 67, chief: 'Shortness of breath', triage: 2, time: '10:30', vitals: 'BP 150/95 HR 105 SpO2 92%' },
                  { pos: 5, name: 'Mike Davis', age: 19, chief: 'Ankle injury', triage: 4, time: '10:35', vitals: 'BP 110/70 HR 75' },
                ].map((patient, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                    <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                      {patient.pos}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${patient.triage === 1 ? 'bg-red-100 text-red-800' : patient.triage === 2 ? 'bg-orange-100 text-orange-800' : patient.triage === 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          ESI {patient.triage}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{patient.chief} • Age {patient.age}</p>
                      <p className="text-xs text-gray-500">{patient.vitals}</p>
                    </div>
                    <span className="text-sm text-gray-500">{patient.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {[
                  { label: 'Register Trauma', icon: Cross, color: 'red' },
                  { label: 'Call Code Blue', icon: Zap, color: 'red' },
                  { label: 'Request Ambulance', icon: Ambulance, color: 'amber' },
                  { label: 'Order Stat Labs', icon: Activity, color: 'purple' },
                  { label: 'Order Stat Imaging', icon: Stethoscope, color: 'blue' },
                  { label: 'Administer Meds', icon: Droplet, color: 'green' },
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ambulance Status</h2>
              <div className="space-y-3">
                {[
                  { id: 'AMB-01', status: 'En Route', eta: '5 min', type: 'ALS' },
                  { id: 'AMB-02', status: 'At Scene', eta: '-', type: 'BLS' },
                  { id: 'AMB-03', status: 'Transporting', eta: '12 min', type: 'ALS' },
                  { id: 'AMB-04', status: 'Available', eta: '-', type: 'BLS' },
                  { id: 'AMB-05', status: 'Available', eta: '-', type: 'ALS' },
                ].map((amb, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{amb.id} ({amb.type})</p>
                      <p className="text-sm text-gray-500">ETA: {amb.eta}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${amb.status === 'Available' ? 'bg-green-100 text-green-800' : amb.status === 'En Route' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                      {amb.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'triage' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Triage management coming soon</p>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Active patient management coming soon</p>
        </div>
      )}

      {activeTab === 'ambulance' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Ambulance dispatch coming soon</p>
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">Resource management coming soon</p>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500 text-center py-8">ED statistics coming soon</p>
        </div>
      )}
    </div>
  );
}