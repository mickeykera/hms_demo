import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orService, patientService, clinicalService } from '../services/api';
import { 
  Plus, Search, Eye, Scissors, Calendar, UserPlus, 
  AlertCircle, Loader2, CheckCircle, XCircle,
  Users, Clock, FileText, Download, Shield, 
  Stethoscope, Pill, Trash2, Edit
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  Scheduled: 'bg-blue-100 text-blue-800',
  InProgress: 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
};

export default function OR() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [scheduleData, setScheduleData] = useState({ patient_id: '', procedure_name: '', scheduled_date: '', surgeon_id: '', anesthesiologist_id: '', notes: '' });
  const [teamData, setTeamData] = useState({ member_id: '', role: '' });
  const [reportData, setReportData] = useState({ procedure_notes: '', complications: '', outcome: '', surgeon_notes: '', post_op_care_instructions: '' });
  const queryClient = useQueryClient();

  const { data: schedules } = useQuery({
    queryKey: ['orSchedules'],
    queryFn: () => orService.getSchedules ? orService.getSchedules() : Promise.resolve({ data: { schedules: [] } }).then(r => r.data.schedules || []),
  });

  const { data: patients } = useQuery({
    queryKey: ['orPatients'],
    queryFn: () => patientService.search('').then(r => r.data.patients || []),
  });

  const { data: doctors } = useQuery({
    queryKey: ['orDoctors'],
    queryFn: () => clinicalService.getDoctors ? clinicalService.getDoctors() : Promise.resolve({ data: [] }).then(r => r.data || []),
  });

  const scheduleMutation = useMutation({
    mutationFn: orService.schedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orSchedules'] });
      setShowScheduleModal(false);
      setScheduleData({ patient_id: '', procedure_name: '', scheduled_date: '', surgeon_id: '', anesthesiologist_id: '', notes: '' });
    }
  });

  const teamMutation = useMutation({
    mutationFn: () => orService.addTeam(selectedSchedule.id, teamData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orSchedules'] });
      setShowTeamModal(false);
      setTeamData({ member_id: '', role: '' });
    }
  });

  const reportMutation = useMutation({
    mutationFn: () => orService.addReport(selectedSchedule.id, reportData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orSchedules'] });
      setShowReportModal(false);
      setReportData({ procedure_notes: '', complications: '', outcome: '', surgeon_notes: '', post_op_care_instructions: '' });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operating Room</h1>
          <p className="text-gray-600">Surgery scheduling, team management, and surgical reports</p>
        </div>
        <button onClick={() => setShowScheduleModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Schedule Surgery
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-4">
        <nav className="flex border-b" aria-label="Tabs">
          {['schedule', 'upcoming', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition ${activeTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'schedule' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Procedure</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Surgeon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anesthesiologist</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {schedules?.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{format(new Date(s.scheduled_date), 'MMM dd, yyyy HH:mm')}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{s.patient?.first_name} {s.patient?.last_name}</p>
                    <p className="text-sm text-gray-500">{s.patient?.global_id}</p>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.procedure_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">Dr. {s.surgeon?.last_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.anesthesiologist ? `Dr. ${s.anesthesiologist.last_name}` : '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[s.status] || 'bg-gray-100 text-gray-800'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{s.team?.length || 0} members</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedSchedule(s); setShowTeamModal(true); }} className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                        <Users className="w-4 h-4 inline mr-1" /> Team
                      </button>
                      {s.status === 'Scheduled' && (
                        <button onClick={() => { setSelectedSchedule(s); setShowReportModal(true); }} className="text-green-600 hover:text-green-900 text-sm font-medium">
                          <FileText className="w-4 h-4 inline mr-1" /> Report
                        </button>
                      )}
                      <button onClick={() => { setSelectedSchedule(s); }} className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                        <Eye className="w-4 h-4 inline mr-1" /> View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!schedules || schedules.length === 0) && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No surgeries scheduled</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          {schedules?.filter(s => s.status === 'Scheduled').map(s => (
            <div key={s.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{s.procedure_name}</h3>
                  <p className="text-gray-500">{s.patient?.first_name} {s.patient?.last_name} • {s.patient?.global_id}</p>
                  <p className="text-sm text-gray-600 mt-1">Dr. {s.surgeon?.last_name} • {format(new Date(s.scheduled_date), 'MMM dd, yyyy HH:mm')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedSchedule(s); setShowTeamModal(true); }} className="btn-secondary text-sm">
                    <Users className="w-4 h-4 mr-1" /> Manage Team
                  </button>
                  <button onClick={() => { setSelectedSchedule(s); setShowReportModal(true); }} className="btn-primary text-sm">
                    <FileText className="w-4 h-4 mr-1" /> Post-Op Report
                  </button>
                </div>
              </div>
            </div>
          ))}
          {schedules?.filter(s => s.status === 'Scheduled').length === 0 && (
            <p className="text-gray-500 text-center py-8">No upcoming surgeries</p>
          )}
        </div>
      )}

      {activeTab === 'completed' && (
        <div className="space-y-4">
          {schedules?.filter(s => s.status === 'Completed').map(s => (
            <div key={s.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{s.procedure_name}</h3>
                  <p className="text-gray-500">{s.patient?.first_name} {s.patient?.last_name} • {format(new Date(s.scheduled_date), 'MMM dd, yyyy')}</p>
                  <p className="text-sm text-gray-600 mt-1">Surgeon: Dr. {s.surgeon?.last_name} • Outcome: {s.surgical_report?.outcome || 'N/A'}</p>
                </div>
                <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                  <FileText className="w-4 h-4 inline mr-1" /> View Report
                </button>
              </div>
              {s.surgical_report && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm"><strong>Complications:</strong> {s.surgical_report.complications || 'None'}</p>
                  <p className="text-sm"><strong>Post-op Care:</strong> {s.surgical_report.post_op_care_instructions || 'N/A'}</p>
                </div>
              )}
            </div>
          ))}
          {schedules?.filter(s => s.status === 'Completed').length === 0 && (
            <p className="text-gray-500 text-center py-8">No completed surgeries</p>
          )}
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Schedule Surgery</h2>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); scheduleMutation.mutate(scheduleData); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <select required value={scheduleData.patient_id} onChange={e => setScheduleData({...scheduleData, patient_id: e.target.value})} className="input">
                    <option value="">Select Patient</option>
                    {patients?.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.global_id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon *</label>
                  <select required value={scheduleData.surgeon_id} onChange={e => setScheduleData({...scheduleData, surgeon_id: e.target.value})} className="input">
                    <option value="">Select Surgeon</option>
                    {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name} ({d.department})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesiologist</label>
                  <select value={scheduleData.anesthesiologist_id} onChange={e => setScheduleData({...scheduleData, anesthesiologist_id: e.target.value})} className="input">
                    <option value="">Select (Optional)</option>
                    {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input type="datetime-local" required value={scheduleData.scheduled_date} onChange={e => setScheduleData({...scheduleData, scheduled_date: e.target.value})} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                  <input required value={scheduleData.procedure_name} onChange={e => setScheduleData({...scheduleData, procedure_name: e.target.value})} className="input" placeholder="e.g., Laparoscopic Appendectomy" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={scheduleData.notes} onChange={e => setScheduleData({...scheduleData, notes: e.target.value})} rows={3} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={scheduleMutation.isPending} className="btn-primary bg-red-600 hover:bg-red-700">
                  {scheduleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeamModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Surgical Team - {selectedSchedule.procedure_name}</h2>
              <button onClick={() => setShowTeamModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="font-semibold">Current Team</h3>
              {selectedSchedule.team?.map(member => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Dr. {member.user?.last_name}</p>
                    <p className="text-sm text-gray-500">{member.role}</p>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Add Team Member</h3>
                <form onSubmit={e => { e.preventDefault(); teamMutation.mutate(); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Member *</label>
                      <select required value={teamData.member_id} onChange={e => setTeamData({...teamData, member_id: e.target.value})} className="input">
                        <option value="">Select</option>
                        {doctors?.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name} ({d.department})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <input required value={teamData.role} onChange={e => setTeamData({...teamData, role: e.target.value})} className="input" placeholder="e.g., Assistant Surgeon, Scrub Nurse" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={() => setShowTeamModal(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={teamMutation.isPending} className="btn-primary">
                      {teamMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Add
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Post-Operative Report</h2>
              <button onClick={() => setShowReportModal(false)} className="text-gray-500 hover:text-gray-700"><Download size={24} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); reportMutation.mutate(); }} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Notes *</label>
                  <textarea required value={reportData.procedure_notes} onChange={e => setReportData({...reportData, procedure_notes: e.target.value})} rows={4} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complications</label>
                  <textarea value={reportData.complications} onChange={e => setReportData({...reportData, complications: e.target.value})} rows={3} className="input" placeholder="None or describe complications" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outcome *</label>
                  <select required value={reportData.outcome} onChange={e => setReportData({...reportData, outcome: e.target.value})} className="input">
                    <option value="">Select Outcome</option>
                    <option value="Successful">Successful</option>
                    <option value="Successful with complications">Successful with complications</option>
                    <option value="Unsuccessful">Unsuccessful</option>
                    <option value="Converted to open">Converted to open</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon Notes</label>
                  <textarea value={reportData.surgeon_notes} onChange={e => setReportData({...reportData, surgeon_notes: e.target.value})} rows={3} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post-Op Care Instructions *</label>
                  <textarea required value={reportData.post_op_care_instructions} onChange={e => setReportData({...reportData, post_op_care_instructions: e.target.value})} rows={4} className="input" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setShowReportModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={reportMutation.isPending} className="btn-primary bg-green-600 hover:bg-green-700">
                  {reportMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : ''} Complete Surgery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}