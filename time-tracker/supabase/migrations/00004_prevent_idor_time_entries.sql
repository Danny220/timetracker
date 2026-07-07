-- Security Enhancement: Prevent Insecure Direct Object References (IDOR) on time entries
-- Ensures that users can only log time against activities that belong to projects they are explicitly assigned to,
-- unless it is the global Leaves project ('00000000-0000-0000-0000-000000000001').

CREATE OR REPLACE FUNCTION public.enforce_time_entry_assignment()
RETURNS trigger AS $$
DECLARE
  v_project_id UUID;
  v_is_assigned BOOLEAN;
BEGIN
  -- If triggered by service role / system (no active user), allow the operation
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the project_id for the given activity
  SELECT project_id INTO v_project_id FROM public.activities WHERE id = NEW.activity_id;

  -- If no such activity exists, it will fail foreign key constraints anyway, but we can catch it here
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Activity does not exist.';
  END IF;

  -- Allow if it is the global Leaves project
  IF v_project_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;

  -- Check if the user is explicitly assigned to this project
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE user_id = NEW.user_id AND project_id = v_project_id
  ) INTO v_is_assigned;

  IF NOT v_is_assigned THEN
    RAISE EXCEPTION 'IDOR prevention: User is not assigned to the project for this activity.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_time_entry_assignment_trigger ON public.time_entries;
CREATE TRIGGER ensure_time_entry_assignment_trigger
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_time_entry_assignment();
