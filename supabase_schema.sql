-- =========================================================================
-- MUGINA HOPE PRIMARY & NURSERY ACADEMY - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- Project: https://egwzhnzpsgwkhvhesode.supabase.co
-- =========================================================================

-- 1. Table: website_settings
-- Stores all public school branding, hero slides, manager details, and tuition fees
CREATE TABLE IF NOT EXISTS public.website_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and create public read/write policy for school settings
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read Website Settings" 
    ON public.website_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Write Website Settings" 
    ON public.website_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Table: school_gallery
-- Stores all campus photos, categories, alt texts, captions, and descriptions
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
  CREATE POLICY "Public Read Gallery" 
    ON public.school_gallery FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Write Gallery" 
    ON public.school_gallery FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Table: staff_members
-- Stores staff credentials, roles (Admin, DOS, Finance, etc.), and contact information
CREATE TABLE IF NOT EXISTS public.staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  assigned_subject_or_grade TEXT,
  status TEXT DEFAULT 'Active',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read Staff" 
    ON public.staff_members FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Write Staff" 
    ON public.staff_members FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Table: enrolled_students
-- Stores student roster, registration numbers, grade levels, and parent contact details
CREATE TABLE IF NOT EXISTS public.enrolled_students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  reg_number TEXT UNIQUE NOT NULL,
  grade_code TEXT NOT NULL,
  status TEXT DEFAULT 'Active',
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.enrolled_students ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Read Students" 
    ON public.enrolled_students FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Public Write Students" 
    ON public.enrolled_students FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Enable Real-Time Replication on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.website_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_gallery;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrolled_students;
