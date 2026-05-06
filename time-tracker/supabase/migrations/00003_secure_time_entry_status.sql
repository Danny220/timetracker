-- Security Enhancement: Prevent users from bypassing leave approval by enforcing status on the backend
-- This stops malicious API calls from manually setting status='approved' on leaves.

CREATE OR REPLACE FUNCTION public.enforce_time_entry_status()
RETURNS trigger AS $$
DECLARE
  v_is_leave BOOLEAN;
  v_require_approval BOOLEAN;
  v_user_role public.user_role;
BEGIN
  -- If triggered by service role / system, allow the operation
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the user's role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- If the user is an admin or manager, they can set the status to whatever they want
  IF v_user_role IN ('admin', 'business_manager') THEN
    RETURN NEW;
  END IF;

  -- For regular employees, we must securely determine the correct status
  SELECT is_leave INTO v_is_leave FROM public.activities WHERE id = NEW.activity_id;
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

DROP TRIGGER IF EXISTS ensure_secure_time_entry_status ON public.time_entries;
CREATE TRIGGER ensure_secure_time_entry_status
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.enforce_time_entry_status();
