# Time Tracking & Resource Management System Architecture

## 1. System Architecture

### Tech Stack
To achieve a highly dynamic, "snappy", and real-time user experience with fewer clicks than Kimai, the recommended stack is **Next.js (React) + Supabase**.

*   **Frontend**: Next.js (React) with Tailwind CSS. Next.js provides excellent performance, fast page loads, and React allows for building complex, highly interactive grid interfaces. Tailwind CSS ensures rapid UI development and a cohesive design system.
*   **Backend/Database**: Supabase (PostgreSQL). Supabase provides a robust PostgreSQL database, built-in authentication, and real-time subscriptions out of the box. This enables a BaaS (Backend-as-a-Service) approach that is fast to develop and highly scalable.
*   **State Management**: React Context or Zustand for fast, localized state updates without prop drilling.
*   **Date Handling**: `date-fns` for lightweight date manipulations.

### Database Schema
The data model uses a relational structure mapped in PostgreSQL:

*   **User**
    *   `id` (UUID, Primary Key)
    *   `name` (String)
    *   `email` (String)
    *   `role` (Enum: Admin, User)
*   **Project (Commessa)**
    *   `id` (UUID, Primary Key)
    *   `name` (String)
    *   `client_id` (UUID, Foreign Key)
    *   `status` (Enum: Active, Completed)
*   **Activity** (Sub-task specific to a Project)
    *   `id` (UUID, Primary Key)
    *   `project_id` (UUID, Foreign Key)
    *   `name` (String - e.g., "Frontend Development", "Client Meeting")
    *   `is_billable` (Boolean)
*   **TimeEntry**
    *   `id` (UUID, Primary Key)
    *   `user_id` (UUID, Foreign Key)
    *   `activity_id` (UUID, Foreign Key)
    *   `date` (Date)
    *   `hours` (Numeric/Decimal)
    *   `notes` (Text, optional)

*Relationships*:
- A User has many TimeEntries.
- A Project has many Activities.
- A TimeEntry belongs to one User and one Activity.
- An Activity belongs to one Project.

---

## 2. Feature Implementation Guide

### Bulk Entry ("Mass Fill 8h/Day") Logic
1. **User Action**: The user selects a Project and Activity, then clicks the "Fill Week (8h)" button for a specific week.
2. **Data Fetching**: The system checks the local state for existing time entries for that specific user, week, and activity.
3. **Filtering**: The system iterates through Monday to Friday (and optionally weekends if selected).
    - If a day *already has hours logged* (for any activity or this specific one, depending on strictness - usually if total hours > 0), it is **skipped**.
    - The system checks if the day is a weekend or an Italian public holiday.
4. **Holiday/Weekend Conflict Handling (UX)**:
    - If conflicts (holidays/weekends) are detected among the days to be filled, the system pauses the fill and displays a **Confirmation Modal**.
    - The modal lists the conflicting dates (e.g., "April 10th - Easter Monday", "April 15th - Saturday").
    - Each listed date has a checkbox next to it. The user can check the box to explicitly *override* the warning and add 8 hours to that day anyway.
5. **Execution**: Once the user confirms the modal (or if there were no conflicts), the system applies the 8 hours to the valid and user-approved dates, updating the UI optimistically and sending a bulk `INSERT` to Supabase.

### Holiday Warning Logic (Single Entry)
1. **User Action**: The user manually types "8" into a grid cell corresponding to a holiday or weekend.
2. **Validation**: The `onChange` or `onBlur` event triggers the local holiday utility.
3. **Alert**: A non-intrusive toast or inline warning appears: *"You are logging hours on a holiday [Holiday Name]. Proceed?"* with an "Undo" and "Keep" button. If the user ignores it, it defaults to keeping it (overtime assumed).

---

## 3. Code Snippets

### Utility: Italian Public Holiday Calculator
This uses a local calculation method to ensure zero-latency checks. It uses the "Computus" algorithm to calculate Easter Sunday, from which Easter Monday (Pasquetta) is derived.

```javascript
// utils/holidays.js
import { isWeekend, format, parseISO } from 'date-fns';

/**
 * Calculates Easter Sunday for a given year using the Anonymous Gregorian algorithm.
 */
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Returns a map of Italian public holidays for a given year.
 */
export function getItalianHolidays(year) {
  const easter = getEasterSunday(year);

  // Easter Monday (Pasquetta) is the day after Easter
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const holidays = {
    [`${year}-01-01`]: "Capodanno",
    [`${year}-01-06`]: "Epifania",
    [`${year}-04-25`]: "Festa della Liberazione",
    [`${year}-05-01`]: "Festa dei Lavoratori",
    [`${year}-06-02`]: "Festa della Repubblica",
    [`${year}-08-15`]: "Ferragosto",
    [`${year}-11-01`]: "Tutti i Santi",
    [`${year}-12-08`]: "Immacolata Concezione",
    [`${year}-12-25`]: "Natale",
    [`${year}-12-26`]: "Santo Stefano",
    [format(easterMonday, 'yyyy-MM-dd')]: "Lunedì dell'Angelo (Pasquetta)"
  };

  return holidays;
}

/**
 * Checks if a date is a weekend or an Italian holiday.
 */
export function isNonWorkingDay(dateString) {
  const date = parseISO(dateString);
  if (isWeekend(date)) return { isNonWorking: true, reason: 'Weekend' };

  const year = date.getFullYear();
  const holidays = getItalianHolidays(year);

  const formattedDate = format(date, 'yyyy-MM-dd');
  if (holidays[formattedDate]) {
    return { isNonWorking: true, reason: holidays[formattedDate] };
  }

  return { isNonWorking: false, reason: null };
}
```

### React Component: Weekly Timesheet Grid
```jsx
// components/WeeklyTimesheet.jsx
import React, { useState, useMemo } from 'react';
import { isNonWorkingDay } from '../utils/holidays';
import { addDays, startOfWeek, format } from 'date-fns';

export default function WeeklyTimesheet({ project, activity, weekStartDate, existingEntries }) {
  const [entries, setEntries] = useState(existingEntries || {});
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [conflictDates, setConflictDates] = useState([]);
  const [selectedOverrides, setSelectedOverrides] = useState({});

  // Generate an array of 7 dates for the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStartDate, i));
  }, [weekStartDate]);

  const handleMassFill = () => {
    const conflicts = [];
    const newEntries = { ...entries };

    weekDays.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');

      // Skip if already has hours
      if (newEntries[dateStr] && newEntries[dateStr] > 0) return;

      const { isNonWorking, reason } = isNonWorkingDay(dateStr);

      if (isNonWorking) {
        conflicts.push({ date: dateStr, reason });
      } else {
        newEntries[dateStr] = 8;
      }
    });

    if (conflicts.length > 0) {
      setConflictDates(conflicts);
      setShowOverrideModal(true);
      // Temporarily store the valid entries, wait for user resolution
      setEntries(newEntries);
    } else {
      setEntries(newEntries);
    }
  };

  const handleConfirmOverrides = () => {
    const finalEntries = { ...entries };
    conflictDates.forEach(({ date }) => {
      if (selectedOverrides[date]) {
        finalEntries[date] = 8;
      }
    });
    setEntries(finalEntries);
    setShowOverrideModal(false);
    setSelectedOverrides({});
    setConflictDates([]);
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">{project.name} - {activity.name}</h3>
        <button
          onClick={handleMassFill}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
        >
          Mass Fill (8h/Day)
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const { isNonWorking, reason } = isNonWorkingDay(dateStr);
          return (
            <div key={dateStr} className={`p-2 border rounded ${isNonWorking ? 'bg-gray-100' : 'bg-white'}`}>
              <div className="text-xs text-gray-500 mb-1">{format(date, 'EEE dd')}</div>
              <input
                type="number"
                value={entries[dateStr] || ''}
                onChange={(e) => setEntries({...entries, [dateStr]: e.target.value})}
                className="w-full border-b focus:outline-none focus:border-blue-500 text-center"
                placeholder="0"
              />
              {isNonWorking && <div className="text-[10px] text-orange-500 mt-1 truncate" title={reason}>{reason}</div>}
            </div>
          );
        })}
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg max-w-md w-full">
            <h4 className="text-lg font-bold mb-4">Non-Working Days Detected</h4>
            <p className="text-sm text-gray-600 mb-4">
              You are attempting to log 8 hours on the following weekends or holidays. Select the ones you want to override and log overtime for:
            </p>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {conflictDates.map(({ date, reason }) => (
                <label key={date} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={!!selectedOverrides[date]}
                    onChange={(e) => setSelectedOverrides({...selectedOverrides, [date]: e.target.checked})}
                  />
                  <span>{date} <span className="text-gray-500 text-sm">({reason})</span></span>
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Skip All
              </button>
              <button
                onClick={handleConfirmOverrides}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. UI Wireframe Description

The goal of the interface is to be **snappy, grid-based, and require minimal clicks**.

### The Layout Structure
1. **Top Navigation Bar**
   - User Profile & Settings.
   - Global Week Picker (e.g., `< Previous Week | April 3 - April 9 | Next Week >`). Changing the week here updates the entire grid instantly without a page reload.

2. **Main Workspace (The Grid)**
   - **Left Column (Row Headers)**: Lists the active `Project > Activity` pairs the user is assigned to.
   - **Right Area (The Timeline)**: 7 columns representing Monday to Sunday.
   - **Intersection (The Cells)**: Clean input fields. Users can just click a cell and type a number. Pressing `Tab` moves to the next day perfectly.

3. **Row-Level Controls**
   - Next to each `Project > Activity` name on the left, a prominent **"Mass Fill 8h"** icon/button exists.
   - Clicking this instantly populates empty cells in that row for Monday-Friday.
   - If a holiday is in that week, a fast, centered modal pops up asking for overrides (as defined in the code snippet).

4. **Footer / Summary Row**
   - A sticky row at the bottom sums up the total hours per day.
   - Visual indicators: If a day exceeds 8 hours, the total turns bold and slightly orange. If it exceeds 24, it turns red (validation error).

### Visual Hierarchy & "Snappiness"
- **No Save Button**: Every time an input loses focus (`onBlur`), it auto-saves in the background via Supabase. A tiny checkmark or "Saving..." indicator appears momentarily in the corner of the cell.
- **Color Coding**:
  - Standard workdays: White background.
  - Weekends/Holidays: Light gray background with a subtle red/orange tint if hours are logged on them.
  - Today: Highlighted with a subtle blue border.
