"use client";

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/utils/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Calendar, LogOut, Moon, Sun, Monitor } from 'lucide-react';
import Link from 'next/link';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'business_manager' | 'employee' | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        // Fetch role from profile
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data) setRole(data.role);
      }
    }
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (data) setRole(data.role);
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Prevent hydration mismatch for themes
  if (!mounted) return null;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Calendar size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">TimeTracker</h1>
        </Link>

        {/* Role-based navigation */}
        {user && (
          <nav className="hidden md:flex space-x-4">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${pathname === '/' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Timesheet
            </Link>
            {(role === 'admin' || role === 'business_manager') && (
              <Link
                href="/manage"
                className={`text-sm font-medium transition-colors ${pathname === '/manage' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Management
              </Link>
            )}
            {role === 'admin' && (
              <Link
                href="/admin"
                className={`text-sm font-medium transition-colors ${pathname === '/admin' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
              >
                Admin Panel
              </Link>
            )}
          </nav>
        )}
      </div>

      <div className="flex items-center space-x-4">
        {/* Theme Dropdown */}
        <div className="relative group">
          <button aria-label="Toggle theme" className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
          </button>
          <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <button onClick={() => setTheme('light')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
              <Sun size={14} /> <span>Light</span>
            </button>
            <button onClick={() => setTheme('dark')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
              <Moon size={14} /> <span>Dark</span>
            </button>
            <button onClick={() => setTheme('system')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
              <Monitor size={14} /> <span>System</span>
            </button>
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-3 border-l border-gray-300 dark:border-gray-600 pl-4">
            <div className="flex flex-col text-right hidden sm:flex">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.email}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{role?.replace('_', ' ')}</span>
            </div>
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
