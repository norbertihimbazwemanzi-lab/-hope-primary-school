-- =========================================================================
-- MUGINA HOPE PRIMARY & NURSERY ACADEMY - COMPLETE SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: https://egwzhnzpsgwkhvhesode.supabase.co
-- Safe to run multiple times (idempotent DDL + column upgrades)
-- =========================================================================

-- 1. Table: website_settings
CREATE TABLE IF NOT EXISTS public.website_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Website Settings" ON public.website_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Website Settings" ON public.website_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table: school_gallery
CREATE TABLE IF NOT EXISTS public.school_gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'outdoor',
  description TEXT,
  image_src TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.school_gallery ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Gallery" ON public.school_gallery FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Gallery" ON public.school_gallery FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Table: staff_members
CREATE TABLE IF NOT EXISTS public.staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  assigned_subject_or_grade TEXT,
  enrolled_at TEXT,
  status TEXT DEFAULT 'Active',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS enrolled_at TEXT;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Staff" ON public.staff_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Staff" ON public.staff_members FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Table: enrolled_students
CREATE TABLE IF NOT EXISTS public.enrolled_students (
  id TEXT PRIMARY KEY,
  reg_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT DEFAULT 'Female',
  dob TEXT,
  grade_code TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  student_username TEXT,
  student_password TEXT,
  enrolled_by TEXT,
  enrolled_at TEXT,
  status TEXT DEFAULT 'Active',
  feedback_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Female';
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS student_username TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS student_password TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS enrolled_by TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS enrolled_at TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS feedback_notes TEXT;
ALTER TABLE public.enrolled_students ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Students" ON public.enrolled_students FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Students" ON public.enrolled_students FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_students_grade ON public.enrolled_students (grade_code);

-- 5. Table: payment_transactions (Accounting & Fee Ledger)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id TEXT PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT NOT NULL,
  grade_code TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL,
  bank_slip_ref TEXT,
  recorded_by TEXT,
  recorded_at TEXT NOT NULL,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  status TEXT DEFAULT 'Completed',
  refund_reason TEXT,
  refund_requested_at TEXT,
  refund_requested_by TEXT,
  refund_reviewed_at TEXT,
  refund_reviewed_by TEXT,
  refund_review_note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Payments" ON public.payment_transactions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Payments" ON public.payment_transactions FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payment_transactions (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_reg ON public.payment_transactions (reg_number);

-- 6. Table: admissions_applications
CREATE TABLE IF NOT EXISTS public.admissions_applications (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL,
  student_name TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  grade_code TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  sector TEXT,
  wants_lunch BOOLEAN DEFAULT false,
  wants_transport BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pending Confirmation',
  feedback_notes TEXT,
  assigned_student_id TEXT,
  created_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.admissions_applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Applications" ON public.admissions_applications FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Applications" ON public.admissions_applications FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_applications_ref ON public.admissions_applications (ref_code);

-- 7. Table: attendance_records (Daily Student Roll Call)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  grade_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  parent_email TEXT,
  parent_phone TEXT,
  status TEXT NOT NULL,
  marked_by TEXT,
  notes TEXT,
  email_notified BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Attendance" ON public.attendance_records FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Attendance" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_attendance_date_grade ON public.attendance_records (date, grade_code);

-- 8. Table: teacher_attendance_records
CREATE TABLE IF NOT EXISTS public.teacher_attendance_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  assigned_subject_or_grade TEXT,
  status TEXT NOT NULL,
  arrival_check_in_time TEXT,
  marked_by TEXT,
  topics_covered TEXT,
  duty_signature TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.teacher_attendance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Teacher Attendance" ON public.teacher_attendance_records FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Teacher Attendance" ON public.teacher_attendance_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_teacher_att_date ON public.teacher_attendance_records (date);

-- 9. Table: discipline_records (DOD Conduct Control)
CREATE TABLE IF NOT EXISTS public.discipline_records (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL,
  date TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT,
  grade_code TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  incident_description TEXT,
  action_taken TEXT,
  parent_notified BOOLEAN DEFAULT false,
  parent_contact TEXT,
  status TEXT DEFAULT 'Open',
  recorded_by TEXT,
  resolution_notes TEXT,
  follow_up_date TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Discipline" ON public.discipline_records FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Discipline" ON public.discipline_records FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_discipline_student ON public.discipline_records (student_id);

-- 10. Table: student_progress_logs
CREATE TABLE IF NOT EXISTS public.student_progress_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT,
  grade_code TEXT NOT NULL,
  stream TEXT,
  date TEXT NOT NULL,
  teacher_id TEXT,
  teacher_name TEXT,
  subject TEXT NOT NULL,
  academic_performance TEXT,
  academic_score NUMERIC,
  academic_notes TEXT,
  behavior_rating TEXT,
  behavioral_notes TEXT,
  action_or_recommendation TEXT,
  parent_notified BOOLEAN DEFAULT false,
  created_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.student_progress_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Progress Logs" ON public.student_progress_logs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Progress Logs" ON public.student_progress_logs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_progress_grade ON public.student_progress_logs (grade_code);

-- 11. Table: school_announcements
CREATE TABLE IF NOT EXISTS public.school_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  badge TEXT,
  is_active BOOLEAN DEFAULT true,
  published_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Announcements" ON public.school_announcements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Announcements" ON public.school_announcements FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 12. Table: registration_documents
CREATE TABLE IF NOT EXISTS public.registration_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  applicable_grades TEXT,
  format_hint TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size TEXT,
  file_type TEXT,
  uploaded_at TEXT,
  sort_order INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.registration_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Documents" ON public.registration_documents FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Documents" ON public.registration_documents FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 13. Table: visitor_inquiries
CREATE TABLE IF NOT EXISTS public.visitor_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT,
  status TEXT DEFAULT 'New',
  email_sent_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.visitor_inquiries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Inquiries" ON public.visitor_inquiries FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Inquiries" ON public.visitor_inquiries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 14. Table: campus_tour_bookings
CREATE TABLE IF NOT EXISTS public.campus_tour_bookings (
  id TEXT PRIMARY KEY,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  grade_interest TEXT,
  guests_count TEXT,
  status TEXT DEFAULT 'Confirmed',
  created_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.campus_tour_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Tours" ON public.campus_tour_bookings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Tours" ON public.campus_tour_bookings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 15. Table: applicant_chats
CREATE TABLE IF NOT EXISTS public.applicant_chats (
  ref_code TEXT PRIMARY KEY,
  student_name TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  grade_code TEXT,
  status TEXT DEFAULT 'Pending Confirmation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.applicant_chats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public Read Chats" ON public.applicant_chats FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Public Write Chats" ON public.applicant_chats FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 16. Public Media Storage Bucket (school-media)
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('school-media', 'school-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Read School Media"
    ON storage.objects FOR SELECT USING (bucket_id = 'school-media');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Upload School Media"
    ON storage.objects FOR ALL USING (bucket_id = 'school-media') WITH CHECK (bucket_id = 'school-media');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 17. Enable Real-Time Replication safely across ALL 15 tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'website_settings',
    'school_gallery',
    'staff_members',
    'enrolled_students',
    'payment_transactions',
    'admissions_applications',
    'attendance_records',
    'teacher_attendance_records',
    'discipline_records',
    'student_progress_logs',
    'school_announcements',
    'registration_documents',
    'visitor_inquiries',
    'campus_tour_bookings',
    'applicant_chats'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
