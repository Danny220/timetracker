// src/utils/api.ts

// Mocking Supabase database interactions since the local docker container cannot start
// In production, these would be calls like `await supabase.from('projects').select('*')`

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

const mockActivities: Activity[] = [
  {
    id: 'a1',
    name: 'Frontend Development',
    project: { id: 'p1', name: 'Website Redesign' }
  },
  {
    id: 'a2',
    name: 'UI/UX Design',
    project: { id: 'p1', name: 'Website Redesign' }
  },
  {
    id: 'a3',
    name: 'API Integration',
    project: { id: 'p2', name: 'Mobile App V2' }
  }
];

// Memory store for demo
let mockTimeEntries: TimeEntry[] = [
  { activity_id: 'a1', date: new Date().toISOString().split('T')[0], hours: 4 }
];

export async function fetchActivities(): Promise<Activity[]> {
  return new Promise((resolve) => setTimeout(() => resolve(mockActivities), 400));
}

export async function fetchTimeEntries(startDate: string, endDate: string): Promise<TimeEntry[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // In real SQL, this would be a WHERE date >= startDate AND date <= endDate
      const filtered = mockTimeEntries.filter(e => e.date >= startDate && e.date <= endDate);
      resolve(filtered);
    }, 300);
  });
}

export async function upsertTimeEntry(activity_id: string, date: string, hours: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const existingIdx = mockTimeEntries.findIndex(e => e.activity_id === activity_id && e.date === date);
      if (existingIdx >= 0) {
        mockTimeEntries[existingIdx].hours = hours;
      } else {
        mockTimeEntries.push({ activity_id, date, hours });
      }
      resolve();
    }, 200);
  });
}

export async function upsertBulkTimeEntries(entries: { activity_id: string, date: string, hours: number }[]): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      entries.forEach(entry => {
        const existingIdx = mockTimeEntries.findIndex(e => e.activity_id === entry.activity_id && e.date === entry.date);
        if (existingIdx >= 0) {
          mockTimeEntries[existingIdx].hours = entry.hours;
        } else {
          mockTimeEntries.push(entry);
        }
      });
      resolve();
    }, 300);
  });
}
