// src/utils/api.ts
import { supabase } from './supabase';

export interface Project {
  id: string;
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  project: Project;
}

export interface TimeEntry {
  activity_id: string;
  date: string;
  hours: number;
}

export async function fetchActivities(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      id,
      name,
      project:projects(id, name)
    `);

  if (error) {
    console.error("Error fetching activities", error);
    return [];
  }

  // The Supabase join syntax `project:projects(id, name)` returns the relation as an object.
  // We cast it to ensure it matches the strict Activity interface.
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

export async function upsertTimeEntry(activity_id: string, date: string, hours: number): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to log time.");
  }

  const { error } = await supabase
    .from('time_entries')
    .upsert({
      user_id: user.id,
      activity_id,
      date,
      hours
    }, {
      onConflict: 'user_id, activity_id, date'
    });

  if (error) {
    console.error("Error upserting time entry", error);
    throw error;
  }
}

export async function upsertBulkTimeEntries(entries: { activity_id: string, date: string, hours: number }[]): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to log time.");
  }

  const payload = entries.map(entry => ({
    user_id: user.id,
    activity_id: entry.activity_id,
    date: entry.date,
    hours: entry.hours
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
