-- Security Enhancement: Enforce Project Assignment for Time Entries
-- Prevents employees from logging time against projects they are not assigned to.

CREATE OR REPLACE FUNCTION public.enforce_time_entry_status()
RETURNS trigger AS $$
DECLARE
  v_is_leave BOOLEAN;
  v_require_approval BOOLEAN;
  v_user_role public.user_role;
  v_is_assigned BOOLEAN;
BEGIN
  -- If triggered by service role / system, allow the operation
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the user's role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = NEW.user_id;

  -- Determine if activity is a leave
  SELECT is_leave INTO v_is_leave FROM public.activities WHERE id = NEW.activity_id;

  -- ENFORCE ASSIGNMENT (SECURITY FIX)
  -- Employees cannot log time for non-leave activities unless explicitly assigned to the project
  IF NOT v_is_leave AND v_user_role = 'employee' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.project_assignments pa
      JOIN public.activities a ON a.project_id = pa.project_id
      WHERE a.id = NEW.activity_id AND pa.user_id = NEW.user_id
    ) INTO v_is_assigned;

    IF NOT v_is_assigned THEN
      RAISE EXCEPTION 'Unauthorized: You are not assigned to this project.';
    END IF;
  END IF;

  -- If the user is an admin or manager, they can set the status to whatever they want
  IF v_user_role IN ('admin', 'business_manager') THEN
    RETURN NEW;
  END IF;

  SELECT require_leave_approval INTO v_require_approval FROM public.settings WHERE id = 1;

  IF v_is_leave AND v_require_approval THEN
    -- Force pending for leaves if approval is required
    NEW.status := 'pending';
  ELSE
    -- Force approved for regular work or if approval is not required
    NEW.status := 'approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
