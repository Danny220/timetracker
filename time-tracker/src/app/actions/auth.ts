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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = ['admin', 'business_manager', 'employee'];

export async function inviteUser(email: string, role: string, accessToken: string) {
  try {
    // SECURITY: Input validation
    if (!email || !EMAIL_REGEX.test(email)) {
      throw new Error("Invalid email format.");
    }
    if (!ALLOWED_ROLES.includes(role)) {
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
    console.error("Invite User Error:", error);
    // Return a generic error message to the client to avoid leaking DB schema or system internals
    const isValidationError = error instanceof Error && (error.message === "Invalid email format." || error.message === "Invalid role specified." || error.message === "Forbidden: You do not have permission to invite users.");
    return {
      success: false,
      message: isValidationError && error instanceof Error ? error.message : "An error occurred while inviting the user. Please try again."
    };
  }
}
