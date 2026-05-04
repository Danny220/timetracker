-- 1. Create User Profiles (Roles)
CREATE TYPE user_role AS ENUM ('admin', 'business_manager', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to automatically create a profile when a new user is invited/signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'employee');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Global Settings Table
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure only one row exists
  require_leave_approval BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
INSERT INTO public.settings (require_leave_approval) VALUES (false);

-- 3. Project Assignments (Explicit assignments)
CREATE TABLE public.project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, user_id)
);

-- 4. Update Activities Table for Leaves
ALTER TABLE public.activities ADD COLUMN is_leave BOOLEAN DEFAULT false;

-- Add standard Italian leaves automatically
INSERT INTO public.projects (id, name, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Assenze (Leaves)', 'Active');

INSERT INTO public.activities (project_id, name, is_billable, is_leave) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ferie (Vacation)', false, true),
  ('00000000-0000-0000-0000-000000000001', 'Malattia (Sick Leave)', false, true),
  ('00000000-0000-0000-0000-000000000001', 'Permesso (Personal Leave)', false, true),
  ('00000000-0000-0000-0000-000000000001', 'Maternità (Maternity Leave)', false, true);

-- 5. Update Time Entries for Approval Workflow
CREATE TYPE entry_status AS ENUM ('approved', 'pending', 'rejected');
ALTER TABLE public.time_entries ADD COLUMN status entry_status DEFAULT 'approved';

-- 6. RLS Policies Update
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can read profiles (needed to display names). Only admins can update roles.
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Settings: Anyone can read, only admins can update
CREATE POLICY "Settings are viewable by all" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.settings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Project Assignments: Admins/Managers can manage, Users can read their own
CREATE POLICY "Users can see their own assignments" ON public.project_assignments FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);
CREATE POLICY "Managers and Admins can manage assignments" ON public.project_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);

-- Redefine Projects to let Admins/Managers write
DROP POLICY "Allow read access on projects for authenticated users" ON public.projects;
CREATE POLICY "Anyone can read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers and Admins can modify projects" ON public.projects FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);

-- Redefine Activities to let Admins/Managers write
DROP POLICY "Allow read access on activities for authenticated users" ON public.activities;
CREATE POLICY "Anyone can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers and Admins can modify activities" ON public.activities FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);

-- Update Time Entries to let Managers/Admins read all for reporting, and update status
CREATE POLICY "Managers and Admins can read all time entries" ON public.time_entries FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);
CREATE POLICY "Managers and Admins can update time entries (approve/reject)" ON public.time_entries FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'business_manager'))
);
