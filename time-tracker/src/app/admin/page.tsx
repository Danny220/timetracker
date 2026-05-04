"use client";

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Settings as SettingsIcon } from 'lucide-react';
import { inviteUser } from '@/app/actions/auth';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviteStatus, setInviteStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadAdminData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Check role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (!profile || profile.role !== 'admin') {
        router.push('/');
        return;
      }

      // Load settings
      const { data: settings } = await supabase.from('settings').select('require_leave_approval').eq('id', 1).single();
      if (settings) {
        setRequireApproval(settings.require_leave_approval);
      }

      setLoading(false);
    }
    loadAdminData();
  }, [router]);

  const handleToggleApproval = async () => {
    const newVal = !requireApproval;
    setRequireApproval(newVal);
    await supabase.from('settings').update({ require_leave_approval: newVal }).eq('id', 1);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus('Sending...');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setInviteStatus('Error: Not authenticated');
      return;
    }

    const result = await inviteUser(inviteEmail, inviteRole, session.access_token);
    if (result.success) {
      setInviteStatus('User invited successfully!');
      setInviteEmail('');
    } else {
      setInviteStatus(`Error: ${result.message}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
          <ShieldCheck size={32} className="text-blue-600" />
          <span>Admin Panel</span>
        </h2>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Global Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center space-x-2">
              <SettingsIcon size={20} /> <span>Global Settings</span>
            </h3>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={handleToggleApproval}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300">Require Manager Approval for Leaves (Ferie, Malattia, etc.)</span>
            </label>
          </div>

          {/* Invite User */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Invite New User</h3>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-900 dark:text-white"
                >
                  <option value="employee">Employee</option>
                  <option value="business_manager">Business Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                Send Invite
              </button>
              {inviteStatus && <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">{inviteStatus}</p>}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
