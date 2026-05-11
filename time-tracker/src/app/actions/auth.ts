"use server";

import { createClient } from '@supabase/supabase-js';

// Server-side only: requires the service role key to bypass RLS and use admin methods
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-key-placeholder';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function inviteUser(email: string, role: string, accessToken: string) {
  // Input validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return { success: false, message: 'Invalid email format' };
  }

  const validRoles = ['admin', 'business_manager', 'employee'];
  if (!role || !validRoles.includes(role)) {
    return { success: false, message: 'Invalid role specified' };
  }

  if (!accessToken || typeof accessToken !== 'string') {
    return { success: false, message: 'Invalid access token' };
  }

  try {
    // Input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error("Invalid email format.");
    }
    const allowedRoles = ['admin', 'business_manager', 'employee'];
    if (!role || !allowedRoles.includes(role)) {
      throw new Error("Invalid role specified.");
    }

    // SECURE: Verify the caller is authenticated and authorized using the passed token
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error("Forbidden: You do not have permission to invite users.");
    }

    // 1. Invite the user using the Service Role bypass
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user");

    // 2. The handle_new_user trigger creates the profile with 'employee' by default
    // We need to update it immediately to the selected role if it's not employee
    if (role !== 'employee') {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;
    }

    return { success: true };
  } catch (error: unknown) {
    // Log the detailed error internally but don't leak it to the client
    console.error("Invite User Error:", error);
    return { success: false, message: "An unexpected error occurred while inviting the user." };
  }
}
