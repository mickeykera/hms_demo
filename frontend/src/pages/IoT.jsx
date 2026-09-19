import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iotService, patientService } from '../services/api';
import { 
  Search, Activity, Heart, Activity as ActivityIcon, 
  Waves, Cpu, AlertTriangle, CheckCircle, 
  Download, TrendingUp, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function IoT() {
  const [patientId, setPatientId] = useState('');
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientService.get(patientId).then(r => r.data.patient),
    enabled: !!patientId,
  });

  const { data: telemetry, refetch } = useQuery({
    queryKey: ['iot', patientId, timeRange],
    queryFn: () => iotService.getTelemetry(patientId).then(r => r.data.device_readings || []),
    enabled: !!patientId,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['patientSearch', search],
    queryFn: () => patientService.search(search).then(r => r.data.patients || []),
    enabled: !!search,
  });

  useEffect(() => {
    if (autoRefresh && patientId) {
      const interval = setInterval(() => refetch(), 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, patientId, refetch]);

  const getLatestReading = (deviceType) => {
    return telemetry?.find(r => r.device_type === deviceType);
  };

  const parseTelemetry = (data) => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  if (!patientId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT Monitoring</h1>
          <p className="text-gray-600">Real-time patient device telemetry and vital signs</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Select Patient</h2>
          <input
            type="text"
            placeholder="Search by name, ID, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input mb-4"
          />
          {search && searchResults?.map(p => (
            <button 
              key={p.id} 
              onClick={() => setPatientId(p.id)}
              className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium">{p.first_name} {p.last_name}</p>
                <p className="text-sm text-gray-500">{p.global_id} • {p.phone}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const devices = [
    { type: 'HeartRateMonitor', label: 'Heart Rate', icon: Heart, unit: 'BPM', color: 'red' },
    { type: 'SpO2Monitor', label: 'SpO₂', icon: Activity, unit: '%', color: 'blue' },
    { type: 'BloodPressureMonitor', label: 'Blood Pressure', icon: Waves, unit: 'mmHg', color: 'green' },
    { type: 'TemperatureSensor', label: 'Temperature', icon: TrendingUp, unit: '°F', color: 'orange' },
    { type: 'GlucoseMonitor', label: 'Glucose', icon: ActivityIcon, unit: 'mg/dL', color: 'purple' },
    { type: 'ECGMonitor', label: 'ECG', icon: Waves, unit: 'mV', color: 'indigo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IoT Monitoring - {patient?.first_name} {patient?.last_name}</h1>
          <p className="text-gray-600">{patient?.global_id}</p>
        </div>
        <div className="flex gap-2">
          <select value={timeRange} onChange={e => setTimeRange(e.target.value)} className="input w-auto">
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {devices.map(device => {
          const reading = getLatestReading(device.type);
          const parsed = reading ? parseTelemetry(reading.telemetry_data) : {};
          const value = parsed[Object.keys(parsed).find(k => k.toLowerCase().includes(device.type.toLowerCase().replace('monitor', '').replace('sensor', '')))] || parsed.value || 'N/A';
          return (
            <div key={device.type} className="bg-white rounded-lg shadow p-5 border-l-4" style={{ borderColor: device.color }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-full bg-${device.color}-100`}>
                    <device.icon className={`w-5 h-5 text-${device.color}-600`} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{device.label}</span>
                </div>
                {reading && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live" />}
              </div>
              <div className="text-3xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500">{device.unit} • {reading ? format(new Date(reading.timestamp), 'HH:mm:ss') : 'No data'}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Telemetry History</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {telemetry?.length || 0} readings
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {telemetry?.slice(0, 50).map(reading => (
                <tr key={reading.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{format(new Date(reading.timestamp), 'MMM dd, HH:mm:ss')}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">{reading.device_type}</span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">{reading.device_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono max-w-xs truncate">{reading.telemetry_data}</td>
                </tr>
              ))}
              {(!telemetry || telemetry.length === 0) && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No telemetry data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Device Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(device => {
            const reading = getLatestReading(device.type);
            const isOnline = reading && (Date.now() - new Date(reading.timestamp).getTime()) < 60000;
            return (
              <div key={device.type} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-full bg-${device.color}-100`}>
                      <device.icon className={`w-5 h-5 text-${device.color}-600`} />
                    </div>
                    <span className="font-medium">{device.label}</span>
                  </div>
                  <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
                <p className="text-sm text-gray-500">{isOnline ? 'Online' : 'Offline'}</p>
                <p className="text-xs text-gray-400 mt-1">Last seen: {reading ? format(new Date(reading.timestamp), 'HH:mm:ss') : 'Never'}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}