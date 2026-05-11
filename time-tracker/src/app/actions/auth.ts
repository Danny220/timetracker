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
  try {
    if (supabaseServiceKey === 'service-role-key-placeholder') {
      throw new Error("Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. You cannot invite users until the admin sets this variable.");
    }

    // SECURE: Verify the caller is authenticated and authorized using the passed token
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Because the service key IS now required to reach this point, we can just use supabaseAdmin
    // to confidently fetch the profile and bypass any RLS/token header quirks in Next.js Server Actions.
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileFetchError) {
      throw new Error(`Failed to fetch user profile: ${profileFetchError.message}`);
    }

    if (!profile || !['admin', 'business_manager'].includes(profile.role)) {
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
    console.error("Invite User Error:", error);
    return { success: false, message: error instanceof Error ? error.message : "An unexpected error occurred while inviting the user." };
  }
}
