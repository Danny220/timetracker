"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import WeeklyTimesheet from '@/components/WeeklyTimesheet';
import { addDays, subDays, startOfWeek, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Loader2, LogOut } from 'lucide-react';
import { fetchActivities, fetchTimeEntries, Activity } from '@/utils/api';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dbEntries, setDbEntries] = useState<Record<string, Record<string, number>>>({});
  const [totals, setTotals] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Ensure the week starts on Monday
  const weekStartDate = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEndDate = useMemo(() => addDays(weekStartDate, 6), [weekStartDate]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStartDate, i));
  }, [weekStartDate]);

  // Check Auth Status and Load data
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      setUser(session.user);

      const startStr = format(weekStartDate, 'yyyy-MM-dd');
      const endStr = format(weekEndDate, 'yyyy-MM-dd');

      const [fetchedActivities, fetchedEntries] = await Promise.all([
        fetchActivities(),
        fetchTimeEntries(startStr, endStr)
      ]);

      setActivities(fetchedActivities);

      // Map entries to a format the WeeklyTimesheet can use easily: { activityId: { dateStr: hours } }
      const entryMap: Record<string, Record<string, number>> = {};
      fetchedEntries.forEach(entry => {
        if (!entryMap[entry.activity_id]) {
          entryMap[entry.activity_id] = {};
        }
        entryMap[entry.activity_id][entry.date] = entry.hours;
      });

      setDbEntries(entryMap);
      setTotals(entryMap);
      setLoading(false);
    }
    loadData();
  }, [weekStartDate, weekEndDate, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handlePrevWeek = () => setCurrentDate(prev => subDays(prev, 7));
  const handleNextWeek = () => setCurrentDate(prev => addDays(prev, 7));
  const handleToday = () => setCurrentDate(new Date());

  const handleTotalChange = useCallback((activityId: string, activityTotals: Record<string, number>) => {
    setTotals(prev => ({
      ...prev,
      [activityId]: activityTotals
    }));
  }, []);

  // Calculate daily sums
  const dailySums = useMemo(() => {
    const sums: Record<string, number> = {};
    weekDays.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      let dayTotal = 0;
      Object.values(totals).forEach(activityDates => {
        if (activityDates[dateStr]) {
          dayTotal += Number(activityDates[dateStr]);
        }
      });
      sums[dateStr] = dayTotal;
    });
    return sums;
  }, [totals, weekDays]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Calendar size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">TimeTracker</h1>
        </div>
        <div className="flex items-center space-x-4 bg-gray-100 p-1 rounded-lg">
          <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded shadow-sm text-gray-600 transition">
            <ChevronLeft size={20} />
          </button>
          <div className="text-sm font-medium px-4 text-gray-700 min-w-[140px] text-center">
            {format(weekStartDate, 'MMM d')} - {format(weekEndDate, 'MMM d, yyyy')}
          </div>
          <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded shadow-sm text-gray-600 transition">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleToday} className="text-sm font-medium text-blue-600 hover:text-blue-800 transition">
            Today
          </button>
          {user && (
            <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-red-600 transition"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px] relative">

          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-20 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          )}

          {/* Grid Header (Days of Week) */}
          <div className="flex border-b border-gray-200 bg-gray-50/50">
            <div className="w-1/4 p-4 font-semibold text-sm text-gray-600 uppercase tracking-wider">
              Project / Activity
            </div>
            <div className="w-3/4 grid grid-cols-7">
              {weekDays.map(date => {
                const isToday = format(new Date(), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
                return (
                  <div key={date.toString()} className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50/50' : ''}`}>
                    <div className={`text-xs font-medium uppercase ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                      {format(date, 'EEE')}
                    </div>
                    <div className={`text-lg font-light ${isToday ? 'text-blue-700 font-medium' : 'text-gray-900'}`}>
                      {format(date, 'dd')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid Body (Rows) */}
          <div className="flex flex-col">
            {activities.map((activity) => {
              // Extract the specific entries or provide undefined to rely on the component's internal default state
              const activityEntries = dbEntries[activity.id];
              return (
                <WeeklyTimesheet
                  key={activity.id}
                  activity={activity}
                  weekStartDate={weekStartDate}
                  existingEntries={activityEntries}
                  onTotalChange={handleTotalChange}
                />
              );
            })}
          </div>

          {/* Grid Footer (Totals) */}
          <div className="flex border-t border-gray-200 bg-gray-50">
            <div className="w-1/4 p-4 font-medium text-gray-700 text-right">
              Total Hours
            </div>
            <div className="w-3/4 grid grid-cols-7">
              {weekDays.map((date, i) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const total = dailySums[dateStr] || 0;
                const isOvertime = total > 8;
                const isInvalid = total > 24;

                return (
                  <div key={i} className={`p-4 text-center font-semibold border-r border-gray-200 last:border-r-0
                    ${isInvalid ? 'text-red-600 bg-red-50' : isOvertime ? 'text-orange-600' : 'text-gray-700'}
                  `}>
                    {total > 0 ? total : '-'}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
