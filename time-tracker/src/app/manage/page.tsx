"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, LayoutDashboard, Briefcase, Plus, Users, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface Activity {
  id: string;
  name: string;
  is_billable: boolean;
}

interface Project {
  id: string;
  name: string;
  status: string;
  activities?: Activity[];
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
}

interface PendingLeave {
  id: string;
  date: string;
  hours: number;
  status: string;
  user: { email: string };
  activity: { name: string };
}

export default function ManageDashboard() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  // Reporting & Approvals state
  const [reportData, setReportData] = useState<{ user_email: string; project_name: string; total_hours: number; status: string }[]>([]);
  const [reportMonth, setReportMonth] = useState(new Date());

  const [pendingLeaves, setPendingLeaves] = useState<PendingLeave[]>([]);

  // Forms state
  const [newProjectName, setNewProjectName] = useState('');
  const [newActivityName, setNewActivityName] = useState('');
  const [assignmentProjectId, setAssignmentProjectId] = useState('');
  const [assignmentUserId, setAssignmentUserId] = useState('');
  const [assignmentMsg, setAssignmentMsg] = useState('');

  const router = useRouter();

  const loadPendingLeaves = React.useCallback(async () => {
    const { data } = await supabase
      .from('time_entries')
      .select(`
        id,
        date,
        hours,
        status,
        user:profiles!inner(email),
        activity:activities!inner(name)
      `)
      .eq('status', 'pending')
      .order('date', { ascending: false });

    if (data) {
      setPendingLeaves((data as unknown as { id: string, date: string, hours: number, status: string, user: { email?: string } | { email?: string }[], activity: { name?: string } | { name?: string }[] }[]).map((d) => ({
        ...d,
        user: { email: Array.isArray(d.user) ? d.user[0]?.email || '' : d.user?.email || '' },
        activity: { name: Array.isArray(d.activity) ? d.activity[0]?.name || '' : d.activity?.name || '' }
      })));
    }
  }, []);

  const loadReportData = React.useCallback(async (date: Date) => {
    const startDate = format(startOfMonth(date), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(date), 'yyyy-MM-dd');

    // In a real application, you'd likely create a Postgres View or RPC for this aggregation.
    // For this prototype, we'll fetch entries and aggregate client-side to satisfy the constraint quickly.
    const { data: entries } = await supabase
      .from('time_entries')
      .select(`
        hours,
        status,
        user:profiles!inner(email),
        activity:activities!inner(project:projects!inner(name))
      `)
      .gte('date', startDate)
      .lte('date', endDate);

    if (entries) {
      // Grouping logic
      const grouped: Record<string, { user_email: string; project_name: string; total_hours: number; status: string }> = {};

      entries.forEach((e: { user: { email: string } | { email: string }[], activity: { project: { name: string } | { name: string }[] } | { project: { name: string } | { name: string }[] }[], status: string, hours: number }) => {
        const uEmail = Array.isArray(e.user) ? e.user[0]?.email : e.user?.email || 'Unknown User';
        const pName = Array.isArray(e.activity)
          ? (Array.isArray(e.activity[0]?.project) ? e.activity[0]?.project[0]?.name : e.activity[0]?.project?.name)
          : (Array.isArray(e.activity?.project) ? e.activity.project[0]?.name : e.activity?.project?.name) || 'Unknown Project';

        const key = `${uEmail}-${pName}-${e.status}`;
        if (!grouped[key]) {
          grouped[key] = {
            user_email: uEmail,
            project_name: pName,
            total_hours: 0,
            status: e.status
          };
        }
        grouped[key].total_hours += Number(e.hours);
      });

      setReportData(Object.values(grouped).sort((a, b) => b.total_hours - a.total_hours));
    } else {
      setReportData([]);
    }
  }, []);

  useEffect(() => {
    async function loadManagerData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check role (Admins and Business Managers allowed)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (!profile || (profile.role !== 'admin' && profile.role !== 'business_manager')) {
        router.push('/');
        return;
      }

      // Load Projects with Activities
      const { data: projData } = await supabase.from('projects').select('*, activities(*)').order('created_at', { ascending: false });
      if (projData) setProjects(projData);

      // Load Users
      const { data: usrData } = await supabase.from('profiles').select('*').order('email', { ascending: true });
      if (usrData) setUsers(usrData);

      await loadReportData(new Date());
      await loadPendingLeaves();

      setLoading(false);
    }
    loadManagerData();
  }, [router, loadReportData, loadPendingLeaves]);

  const handleLeaveAction = async (id: string, newStatus: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('time_entries')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setPendingLeaves(pendingLeaves.filter(leave => leave.id !== id));
      loadReportData(reportMonth); // Refresh reports
    }
  };


  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = new Date(e.target.value);
    setReportMonth(d);
    loadReportData(d);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const { data, error } = await supabase.from('projects').insert([{ name: newProjectName }]).select().single();
    if (data) {
      setProjects([{ ...data, activities: [] }, ...projects]);
      setNewProjectName('');
    } else if (error) {
      setAssignmentMsg('An error occurred while creating the project.');
      setTimeout(() => setAssignmentMsg(''), 3000);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (!newActivityName.trim()) return;

    const { data, error } = await supabase.from('activities').insert([{ name: newActivityName, project_id: projectId }]).select().single();
    if (data) {
      setProjects(projects.map(p => {
        if (p.id === projectId) {
          return { ...p, activities: [...(p.activities || []), data] };
        }
        return p;
      }));
      setNewActivityName('');
    } else if (error) {
      setAssignmentMsg('An error occurred while creating the activity.');
      setTimeout(() => setAssignmentMsg(''), 3000);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignmentMsg('');
    if (!assignmentProjectId || !assignmentUserId) return;

    const { error } = await supabase.from('project_assignments').insert([{ project_id: assignmentProjectId, user_id: assignmentUserId }]);

    if (error) {
      if (error.code === '23505') setAssignmentMsg('User is already assigned to this project.');
      else setAssignmentMsg('An error occurred while assigning the user.');
    } else {
      setAssignmentMsg('Successfully assigned.');
    }

    // Clear message after 3s
    setTimeout(() => setAssignmentMsg(''), 3000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
          <LayoutDashboard size={32} className="text-blue-600" />
          <span>Management Dashboard</span>
        </h2>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Projects List */}
          <div className="col-span-2 bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center space-x-2">
              <Briefcase size={20} /> <span>Projects & Activities</span>
            </h3>

            <form onSubmit={handleCreateProject} className="flex space-x-2 mb-6">
              <input
                type="text"
                placeholder="New Project Name..."
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
              />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-1 hover:bg-blue-700">
                <Plus size={16} /> <span>Create</span>
              </button>
            </form>

            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {projects.map(proj => (
                <li key={proj.id} className="py-4 flex flex-col">
                  <button
                    type="button"
                    className="flex justify-between items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
                    onClick={() => setExpandedProject(expandedProject === proj.id ? null : proj.id)}
                    aria-expanded={expandedProject === proj.id}
                    aria-controls={`project-activities-${proj.id}`}
                  >
                    <div className="flex items-center space-x-2">
                      {expandedProject === proj.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                      <span className="font-medium text-gray-800 dark:text-gray-200">{proj.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${proj.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800'}`}>
                      {proj.status}
                    </span>
                  </button>

                  {expandedProject === proj.id && (
                    <div id={`project-activities-${proj.id}`} className="mt-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                      <ul className="space-y-2 mb-4">
                        {proj.activities?.map(act => (
                          <li key={act.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            <span>{act.name}</span>
                          </li>
                        ))}
                      </ul>
                      <form onSubmit={(e) => handleCreateActivity(e, proj.id)} className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="New Activity..."
                          value={newActivityName}
                          onChange={e => setNewActivityName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
                        />
                        <button type="submit" className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                          Add Activity
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-8">
            {/* Leave Approvals */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center space-x-2">
                <Users size={20} /> <span>Leave Approvals</span>
              </h3>

              {pendingLeaves.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No pending leave requests.</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                  {pendingLeaves.map(leave => (
                    <li key={leave.id} className="py-3 flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{leave.user.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{leave.activity.name} • {leave.date}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{leave.hours}h</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLeaveAction(leave.id, 'approved')}
                          className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 py-1 rounded text-xs font-medium transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleLeaveAction(leave.id, 'rejected')}
                          className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 py-1 rounded text-xs font-medium transition"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* User Assignment */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center space-x-2">
                <Users size={20} /> <span>Assign Users</span>
              </h3>
              <form onSubmit={handleAssignUser} className="space-y-4">
                <div>
                  <label htmlFor="assign-project" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project</label>
                  <select
                    id="assign-project"
                    value={assignmentProjectId}
                    onChange={e => setAssignmentProjectId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
                    required
                  >
                    <option value="" disabled>Select a Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="assign-user" className="block text-sm font-medium text-gray-700 dark:text-gray-300">User</label>
                  <select
                    id="assign-user"
                    value={assignmentUserId}
                    onChange={e => setAssignmentUserId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
                    required
                  >
                    <option value="" disabled>Select a User</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                  Assign to Project
                </button>
                {assignmentMsg && <p className="text-sm mt-2 text-blue-600 dark:text-blue-400 font-medium">{assignmentMsg}</p>}
              </form>
            </div>

            {/* Reporting Dashboard */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center space-x-2">
                  <BarChart3 size={20} /> <span>Monthly Reports</span>
                </h3>
                <input
                  type="month"
                  value={format(reportMonth, 'yyyy-MM')}
                  onChange={handleMonthChange}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white"
                />
              </div>

              {reportData.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No time entries found for this month.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Hours</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {reportData.map((row, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{row.user_email}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{row.project_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">{row.total_hours}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              row.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              row.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
