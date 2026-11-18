-- ============================================================
-- ENABLE UPDATE & DELETE ON PAYSLIPS TABLE IN SUPABASE
-- Run this once in your Supabase SQL Editor so Recalculate,
-- Delete Payslip, and PAID/PARTIAL status persist in cloud.
-- ============================================================

DROP POLICY IF EXISTS "Allow update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Allow delete payslips" ON public.payslips;
CREATE POLICY "Allow update payslips" ON public.payslips FOR UPDATE USING (true);
CREATE POLICY "Allow delete payslips" ON public.payslips FOR DELETE USING (true);
