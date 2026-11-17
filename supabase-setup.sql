-- ============================================================
-- FULL PERMISSIONS & SEED FOR WORKPULSE APP
-- Copy and run this in your Supabase SQL Editor (Run button)
-- ============================================================

-- 1. Enable RLS and add open permissions for mobile app
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- EMPLOYEES POLICIES
DROP POLICY IF EXISTS "Allow select employees" ON public.employees;
DROP POLICY IF EXISTS "Allow insert employees" ON public.employees;
DROP POLICY IF EXISTS "Allow update employees" ON public.employees;
CREATE POLICY "Allow select employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update employees" ON public.employees FOR UPDATE USING (true);

-- ATTENDANCE POLICIES
DROP POLICY IF EXISTS "Allow select attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow read own attendance or admin all" ON public.attendance;
CREATE POLICY "Allow select attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update attendance" ON public.attendance FOR UPDATE USING (true);

-- LEAVE REQUESTS POLICIES
DROP POLICY IF EXISTS "Allow select leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow insert leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Allow update leave_requests" ON public.leave_requests;
CREATE POLICY "Allow select leave_requests" ON public.leave_requests FOR SELECT USING (true);
CREATE POLICY "Allow insert leave_requests" ON public.leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update leave_requests" ON public.leave_requests FOR UPDATE USING (true);

-- SALARY TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Allow select salary_transactions" ON public.salary_transactions;
DROP POLICY IF EXISTS "Allow insert salary_transactions" ON public.salary_transactions;
CREATE POLICY "Allow select salary_transactions" ON public.salary_transactions FOR SELECT USING (true);
CREATE POLICY "Allow insert salary_transactions" ON public.salary_transactions FOR INSERT WITH CHECK (true);

-- PAYSLIPS POLICIES
DROP POLICY IF EXISTS "Allow select payslips" ON public.payslips;
DROP POLICY IF EXISTS "Allow insert payslips" ON public.payslips;
DROP POLICY IF EXISTS "Allow read own payslips or admin all" ON public.payslips;
CREATE POLICY "Allow select payslips" ON public.payslips FOR SELECT USING (true);
CREATE POLICY "Allow insert payslips" ON public.payslips FOR INSERT WITH CHECK (true);

-- APP SETTINGS (payroll rates read by the app; edit values here, not in code)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select app_settings" ON public.app_settings;
CREATE POLICY "Allow select app_settings" ON public.app_settings FOR SELECT USING (true);

INSERT INTO public.app_settings (key, value)
VALUES ('night_allowance', 250)
ON CONFLICT (key) DO NOTHING;

-- PAYSLIPS: freeze the night bonus amount at generation time so later rate changes don't rewrite history.
-- Existing rows are backfilled at the old fixed rate of 250 per night.
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS night_allowance NUMERIC;
UPDATE public.payslips SET night_allowance = night_present_days * 250 WHERE night_allowance IS NULL;
ALTER TABLE public.payslips ALTER COLUMN night_allowance SET DEFAULT 0;
ALTER TABLE public.payslips ALTER COLUMN night_allowance SET NOT NULL;

-- 2. INSERT INITIAL SEED ACCOUNTS
INSERT INTO public.employees (mobile_number, full_name, role, designation, base_salary, salary_type, bank_upi_id)
VALUES 
  ('9876543210', 'Vikram Mehta (Admin)', 'admin', 'Operations Director', 75000, 'monthly', 'vikram@okaxis'),
  ('9811122233', 'Ramesh Kumar', 'employee', 'Senior Electrician', 28000, 'monthly', 'ramesh.kumar@upi'),
  ('9822233344', 'Priya Sharma', 'employee', 'Assembly Supervisor', 32000, 'monthly', 'priya.sharma@paytm'),
  ('9833344455', 'Amit Patel', 'employee', 'Logistics Handler', 950, 'daily', 'amit.patel@okhdfcbank')
ON CONFLICT (mobile_number) DO NOTHING;
