"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { isNonWorkingDay } from '@/utils/holidays';
import { addDays, format } from 'date-fns';
import { Zap, Loader2, Check } from 'lucide-react';
import { upsertTimeEntry, upsertBulkTimeEntries, deleteTimeEntry } from '@/utils/api';

interface Activity {
  id: string;
  name: string;
  project: {
    id: string;
    name: string;
  };
}

interface WeeklyTimesheetProps {
  activity: Activity;
  weekStartDate: Date;
  existingEntries?: Record<string, number>;
  onTotalChange: (activityId: string, totals: Record<string, number>) => void;
}

const WeeklyTimesheet = React.memo(function WeeklyTimesheet({ activity, weekStartDate, existingEntries, onTotalChange }: WeeklyTimesheetProps) {
  // Initialize state directly from props to avoid unnecessary sync effects
  const [entries, setEntries] = useState<Record<string, number | string>>(existingEntries || {});
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [conflictDates, setConflictDates] = useState<{ date: string; reason: string | null }[]>([]);
  const [selectedOverrides, setSelectedOverrides] = useState<Record<string, boolean>>({});

  // Track saving status per cell for "snappy" UX feedback
  const [savingStatus, setSavingStatus] = useState<Record<string, 'saving' | 'saved' | null>>({});

  // When external data actually changes (e.g. changing weeks), update local state
  useEffect(() => {
    setEntries(existingEntries || {});
  }, [existingEntries]);

  // Generate an array of 7 dates for the week with pre-computed metadata
  // to avoid expensive date formatting and holiday calculations on every re-render (e.g., when typing)
  const weekDaysInfo = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(weekStartDate, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const { isNonWorking, reason } = isNonWorkingDay(dateStr);
      return { date, dateStr, isNonWorking, reason, isToday: dateStr === todayStr };
    });
  }, [weekStartDate]);

  const handleMassFill = () => {
    const conflicts: { date: string; reason: string | null }[] = [];
    const newEntries = { ...entries };

    weekDaysInfo.forEach(({ dateStr, isNonWorking, reason }) => {
      // Skip if already has hours
      if (newEntries[dateStr] && Number(newEntries[dateStr]) > 0) return;

      if (isNonWorking) {
        conflicts.push({ date: dateStr, reason });
      } else {
        newEntries[dateStr] = 8;
      }
    });

    if (conflicts.length > 0) {
      setConflictDates(conflicts);
      setShowOverrideModal(true);
      setEntries(newEntries);
    } else {
      executeBulkSave(newEntries);
    }
  };

  const handleConfirmOverrides = () => {
    const finalEntries = { ...entries };
    conflictDates.forEach(({ date }) => {
      if (selectedOverrides[date]) {
        finalEntries[date] = 8;
      }
    });

    setShowOverrideModal(false);
    setSelectedOverrides({});
    setConflictDates([]);
    executeBulkSave(finalEntries);
  };

  const handleSkipOverrides = () => {
    setShowOverrideModal(false);
    setSelectedOverrides({});
    setConflictDates([]);
    executeBulkSave(entries as Record<string, number>);
  };

  const executeBulkSave = async (finalEntries: Record<string, number | string>) => {
    setEntries(finalEntries);
    onTotalChange(activity.id, finalEntries as Record<string, number>);

    const bulkPayload = Object.entries(finalEntries)
      .map(([dateStr, hours]) => ({
        activity_id: activity.id,
        date: dateStr,
        hours: Number(hours),
        isLeave: (activity as unknown as { is_leave: boolean }).is_leave // Avoid local type interface mismatch
      }))
      .filter(entry => entry.hours > 0);

    if (bulkPayload.length > 0) {
      await upsertBulkTimeEntries(bulkPayload);
      // Optional: Set all to 'saved' visually
    }
  };

  const handleInputChange = (dateStr: string, value: string) => {
    setEntries(prev => ({ ...prev, [dateStr]: value }));
  };

  const handleInputBlur = async (dateStr: string, value: string) => {
    const numValue = Number(value);

    // Auto-save logic
    if (value && numValue >= 0) {
      const { isNonWorking, reason } = isNonWorkingDay(dateStr);
      if (isNonWorking && numValue > 0) {
        alert(`Warning: You are logging hours on ${reason} (${dateStr}).`);
      }

      setSavingStatus(prev => ({ ...prev, [dateStr]: 'saving' }));

      try {
        await upsertTimeEntry(activity.id, dateStr, numValue, (activity as unknown as { is_leave: boolean }).is_leave);
        setSavingStatus(prev => ({ ...prev, [dateStr]: 'saved' }));
        onTotalChange(activity.id, { ...entries, [dateStr]: numValue } as Record<string, number>);

        // Clear checkmark after 2s
        setTimeout(() => {
          setSavingStatus(prev => ({ ...prev, [dateStr]: null }));
        }, 2000);
      } catch (e) {
        console.error("Failed to save", e);
        setSavingStatus(prev => ({ ...prev, [dateStr]: null }));
      }
    } else if (!value) {
      // If the input is cleared entirely, we delete the entry from the database
      // The user reviewer noted that 'entries[dateStr]' becomes '' immediately on change,
      // so checking existingEntries[dateStr] is the correct way to see if we actually
      // need to perform a database deletion for this newly cleared field.
      if (existingEntries?.[dateStr] !== undefined) {
        setSavingStatus(prev => ({ ...prev, [dateStr]: 'saving' }));
        try {
          await deleteTimeEntry(activity.id, dateStr);
          setSavingStatus(prev => ({ ...prev, [dateStr]: 'saved' }));

          const newEntries = { ...entries };
          delete newEntries[dateStr];
          setEntries(newEntries);
          onTotalChange(activity.id, newEntries as Record<string, number>);

          // Clear checkmark after 2s
          setTimeout(() => {
            setSavingStatus(prev => ({ ...prev, [dateStr]: null }));
          }, 2000);
        } catch (e) {
          console.error("Failed to delete", e);
          setSavingStatus(prev => ({ ...prev, [dateStr]: null }));
          // Revert visual state on failure
          setEntries(prev => ({ ...prev, [dateStr]: existingEntries?.[dateStr] || '' }));
        }
      }
    }
  };

  return (
    <div className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Row Header (Project & Activity) */}
      <div className="w-1/4 p-3 flex items-center justify-between border-r border-gray-200">
        <div>
          <div className="font-semibold text-gray-800 text-sm">{activity.project.name}</div>
          <div className="text-xs text-gray-500">{activity.name}</div>
        </div>
        <button
          onClick={handleMassFill}
          aria-label="Mass fill 8 hours for this row"
          className="text-gray-400 hover:text-blue-600 p-1 rounded transition"
          title="Mass Fill (8h/Day) for this row"
        >
          <Zap size={18} />
        </button>
      </div>

      {/* Grid Cells */}
      <div className="w-3/4 grid grid-cols-7">
        {weekDaysInfo.map(({ dateStr, isNonWorking, isToday }) => {
          const status = savingStatus[dateStr];

          return (
            <div
              key={dateStr}
              className={`relative p-2 border-r border-gray-200 last:border-r-0 flex flex-col justify-center items-center ${isNonWorking ? 'bg-gray-100/60' : 'bg-transparent'} ${isToday ? 'bg-blue-50/30' : ''}`}
            >
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={entries[dateStr] || ''}
                onChange={(e) => handleInputChange(dateStr, e.target.value)}
                onBlur={(e) => handleInputBlur(dateStr, e.target.value)}
                className={`w-full text-center bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 rounded p-1 ${isNonWorking && entries[dateStr] ? 'text-orange-600 font-semibold' : 'text-gray-800'}`}
                placeholder="-"
              />
              {status === 'saving' && <Loader2 size={12} className="absolute bottom-1 right-1 text-gray-400 animate-spin" />}
              {status === 'saved' && <Check size={12} className="absolute bottom-1 right-1 text-green-500" />}
            </div>
          );
        })}
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-200">
            <h4 className="text-lg font-bold text-gray-800 mb-2">Non-Working Days Detected</h4>
            <p className="text-sm text-gray-600 mb-4">
              You are attempting to mass-fill 8 hours across a week that contains holidays or weekends. Select the ones you want to override and log overtime for:
            </p>
            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded border border-gray-200">
              {conflictDates.map(({ date, reason }) => (
                <label key={date} className="flex items-center space-x-3 cursor-pointer p-1 hover:bg-gray-100 rounded">
                  <input
                    type="checkbox"
                    checked={!!selectedOverrides[date]}
                    onChange={(e) => setSelectedOverrides({...selectedOverrides, [date]: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800 font-medium">{format(new Date(date), 'MMM do')} <span className="text-gray-500 font-normal">({reason})</span></span>
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleSkipOverrides}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Skip Conflicts
              </button>
              <button
                onClick={handleConfirmOverrides}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition"
              >
                Confirm Overrides
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default WeeklyTimesheet;
