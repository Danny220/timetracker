-- 1. Create Projects Table
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_id UUID, -- Placeholder if you add a clients table later
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Activities Table (Sub-tasks of Projects)
CREATE TABLE public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_billable BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Time Entries Table
CREATE TABLE public.time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, activity_id, date) -- Prevent duplicate entries for the same user/activity/day
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Projects: All authenticated users can read active projects
CREATE POLICY "Allow read access on projects for authenticated users"
ON public.projects FOR SELECT TO authenticated USING (true);

-- Activities: All authenticated users can read activities
CREATE POLICY "Allow read access on activities for authenticated users"
ON public.activities FOR SELECT TO authenticated USING (true);

-- Time entries policies: Strict RLS based on user_id
CREATE POLICY "Users can view their own time entries"
ON public.time_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time entries"
ON public.time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
ON public.time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries"
ON public.time_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Insert Mock Data
INSERT INTO public.projects (id, name, status) VALUES
  ('a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'Website Redesign', 'Active'),
  ('b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e', 'Mobile App V2', 'Active');

INSERT INTO public.activities (id, project_id, name, is_billable) VALUES
  ('c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f', 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'UI/UX Design', true),
  ('d4e5f6a1-b2c3-4d4e-1f2a-3b4c5d6e7f8a', 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'Frontend Development', true),
  ('e5f6a1b2-c3d4-4e5f-2a3b-4c5d6e7f8a9b', 'b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e', 'API Integration', true);
