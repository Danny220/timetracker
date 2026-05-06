// src/utils/api.ts
import { supabase } from './supabase';

export interface Project {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  is_leave: boolean;
  project: Project;
}

export interface TimeEntry {
  activity_id: string;
  date: string;
  hours: number;
}

export async function fetchActivities(): Promise<Activity[]> {
  // Only fetch assigned activities or generic leaves
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First get the projects assigned to the user
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('user_id', user.id);

  const assignedProjectIds = assignments?.map(a => a.project_id) || [];

  // Now fetch activities that belong to those assigned projects, OR are generic leaves (project_id = 0...1)
  const leaveProjectId = '00000000-0000-0000-0000-000000000001';

  let query = supabase
    .from('activities')
    .select(`
      id,
      name,
      is_leave,
      project_id,
      project:projects(id, name)
    `);

  if (assignedProjectIds.length > 0) {
    query = query.or(`project_id.in.(${assignedProjectIds.join(',')}),project_id.eq.${leaveProjectId}`);
  } else {
    query = query.eq('project_id', leaveProjectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching activities", error);
    return [];
  }

  return data as unknown as Activity[];
}

export async function fetchTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from('time_entries')
    .select('activity_id, date, hours')
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    console.error("Error fetching time entries", error);
    return [];
  }

  return data as TimeEntry[];
}

export async function upsertTimeEntry(activity_id: string, date: string, hours: number, isLeave: boolean = false): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to log time.");
  }

  let status = 'approved';
  if (isLeave) {
    const { data: settings } = await supabase.from('settings').select('require_leave_approval').eq('id', 1).single();
    if (settings?.require_leave_approval) {
      status = 'pending';
    }
  }

  const { error } = await supabase
    .from('time_entries')
    .upsert({
      user_id: user.id,
      activity_id,
      date,
      hours,
      status
    }, {
      onConflict: 'user_id, activity_id, date'
    });

  if (error) {
    console.error("Error upserting time entry", error);
    throw error;
  }
}

export async function upsertBulkTimeEntries(entries: { activity_id: string, date: string, hours: number, isLeave?: boolean }[]): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to log time.");
  }

  const { data: settings } = await supabase.from('settings').select('require_leave_approval').eq('id', 1).single();
  const requireApproval = settings?.require_leave_approval || false;

  const payload = entries.map(entry => ({
    user_id: user.id,
    activity_id: entry.activity_id,
    date: entry.date,
    hours: entry.hours,
    status: (entry.isLeave && requireApproval) ? 'pending' : 'approved'
  }));

  const { error } = await supabase
    .from('time_entries')
    .upsert(payload, {
      onConflict: 'user_id, activity_id, date'
    });

  if (error) {
    console.error("Error bulk upserting time entries", error);
    throw error;
  }
}


export async function deleteTimeEntry(activity_id: string, date: string): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to delete time.");
  }

  const { error } = await supabase
    .from('time_entries')
    .delete()
    .match({ user_id: user.id, activity_id, date });

  if (error) {
    console.error("Error deleting time entry", error);
    throw error;
  }
}
