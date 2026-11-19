-- ============================================================
-- ENABLE UPDATE & DELETE ON PAYSLIPS AND TRANSACTIONS IN SUPABASE
-- Run this once in your Supabase SQL Editor so Recalculate,
-- Delete Payslip, and Delete Transaction persist in cloud.
-- ============================================================

DROP POLICY IF EXISTS "Allow update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Allow delete payslips" ON public.payslips;
CREATE POLICY "Allow update payslips" ON public.payslips FOR UPDATE USING (true);
CREATE POLICY "Allow delete payslips" ON public.payslips FOR DELETE USING (true);

-- Allow deleting transactions (to void accidental test payments)
DROP POLICY IF EXISTS "Allow delete salary_transactions" ON public.salary_transactions;
CREATE POLICY "Allow delete salary_transactions" ON public.salary_transactions FOR DELETE USING (true);
