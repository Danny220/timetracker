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
  -- For demo purposes without full auth, we'll use a generic user_id or allow it to be nullable for testing
  -- In a real app, this should reference auth.users(id)
  user_id UUID,
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

-- Create permissive policies for development (replace with strict policies in production)
CREATE POLICY "Allow read access on projects for all" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow read access on activities for all" ON public.activities FOR SELECT USING (true);

-- Time entries policies (allowing all for local dev/demo)
CREATE POLICY "Allow all actions on time_entries for all" ON public.time_entries FOR ALL USING (true);

-- Insert Mock Data
INSERT INTO public.projects (id, name, status) VALUES
  ('a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'Website Redesign', 'Active'),
  ('b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e', 'Mobile App V2', 'Active');

INSERT INTO public.activities (id, project_id, name, is_billable) VALUES
  ('c3d4e5f6-a1b2-4c3d-0e1f-2a3b4c5d6e7f', 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'UI/UX Design', true),
  ('d4e5f6a1-b2c3-4d4e-1f2a-3b4c5d6e7f8a', 'a1b2c3d4-e5f6-4a1b-8c9d-0e1f2a3b4c5d', 'Frontend Development', true),
  ('e5f6a1b2-c3d4-4e5f-2a3b-4c5d6e7f8a9b', 'b2c3d4e5-f6a1-4b2c-9d0e-1f2a3b4c5d6e', 'API Integration', true);
