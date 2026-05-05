-- Update the Foreign Key in `time_entries` to point to `public.profiles` instead of `auth.users`
-- This allows PostgREST to automatically resolve the relation for reporting queries (`user:profiles!inner(email)`)

ALTER TABLE public.time_entries
DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;

ALTER TABLE public.time_entries
ADD CONSTRAINT time_entries_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
