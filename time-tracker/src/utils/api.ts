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

// Since auth is not yet implemented in the prototype, we use a constant dummy user ID
// This ensures that the UNIQUE(user_id, activity_id, date) constraint works properly
// during the upsert (ON CONFLICT) commands.
const DUMMY_USER_ID = '00000000-0000-0000-0000-000000000000';

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
  const { error } = await supabase
    .from('time_entries')
    .upsert({
      user_id: DUMMY_USER_ID,
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
  const payload = entries.map(entry => ({
    user_id: DUMMY_USER_ID,
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
