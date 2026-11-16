-- Optional Seed Data: Insert initial Admin and Demo Staff into Supabase

INSERT INTO public.employees (mobile_number, full_name, role, designation, base_salary, salary_type, bank_upi_id)
VALUES 
  ('9876543210', 'Vikram Mehta (Admin)', 'admin', 'Operations Director', 75000, 'monthly', 'vikram@okaxis'),
  ('9811122233', 'Ramesh Kumar', 'employee', 'Senior Electrician', 28000, 'monthly', 'ramesh.kumar@upi'),
  ('9822233344', 'Priya Sharma', 'employee', 'Assembly Supervisor', 32000, 'monthly', 'priya.sharma@paytm'),
  ('9833344455', 'Amit Patel', 'employee', 'Logistics Handler', 950, 'daily', 'amit.patel@okhdfcbank')
ON CONFLICT (mobile_number) DO NOTHING;
