-- =============================================================================
-- CivicAI shared cloud database (Supabase)
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- It is safe for a fresh project and migrates the original CivicAI schema.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Accounts. Supabase Auth owns passwords; this table only stores application data.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    ward TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'authority', 'admin')),
    department TEXT,
    profile_image TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- Civic reports. The upper-case values deliberately match src/types.ts.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'Roads & Transportation', 'Water & Drainage', 'Electricity & Lighting',
        'Sanitation & Waste', 'Public Infrastructure', 'Construction',
        'Traffic & Signage', 'Environment', 'Other Civic Issues'
    )),
    subcategory TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    landmark TEXT,
    ward TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'UNDER REVIEW', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'REJECTED')),
    image_url TEXT NOT NULL,
    ai_detected_issue TEXT,
    ai_category TEXT,
    ai_confidence DOUBLE PRECISION,
    ai_severity TEXT,
    ai_explanation TEXT,
    ai_generated_description TEXT,
    citizen_confirmed_category BOOLEAN DEFAULT true,
    assigned_authority TEXT,
    assigned_to_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    assigned_crew TEXT,
    category_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb,
    comments JSONB NOT NULL DEFAULT '[]'::jsonb,
    upvotes INTEGER NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Migration from the original schema. Drop its incompatible check constraints
-- before converting old title-case status/severity values.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS assigned_crew TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS audit_trail JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_severity_check;
UPDATE public.reports
SET status = CASE status
    WHEN 'Submitted' THEN 'REPORTED'
    WHEN 'Under Review' THEN 'UNDER REVIEW'
    WHEN 'Assigned' THEN 'ASSIGNED'
    WHEN 'In Progress' THEN 'IN PROGRESS'
    WHEN 'Resolved' THEN 'RESOLVED'
    WHEN 'Rejected' THEN 'REJECTED'
    ELSE status
END;
UPDATE public.reports
SET severity = UPPER(severity);
ALTER TABLE public.reports ALTER COLUMN status SET DEFAULT 'REPORTED';
ALTER TABLE public.reports ALTER COLUMN severity SET DEFAULT 'MEDIUM';
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
    CHECK (status IN ('REPORTED', 'UNDER REVIEW', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'REJECTED'));
ALTER TABLE public.reports ADD CONSTRAINT reports_severity_check
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- -----------------------------------------------------------------------------
-- Audit/supporting tables retained for future reporting and notifications.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    detected_issue TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    explanation TEXT NOT NULL,
    generated_description TEXT,
    model_name TEXT DEFAULT 'gemini-1.5-flash',
    raw_payload JSONB,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.report_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    changed_by_name TEXT DEFAULT 'System',
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'status_update',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_authority ON public.reports(assigned_authority);

-- -----------------------------------------------------------------------------
-- Auth bootstrap. Every Supabase Auth sign-up gets a citizen profile automatically.
-- No browser can assign itself an administrator role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, ward, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'ward', ''),
    'citizen'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_municipal_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role IN ('authority', 'admin') AND status = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security. Authenticated citizens create reports under their own UUID;
-- only the report owner or a municipal admin can update an existing report.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public reports are viewable" ON public.reports;
DROP POLICY IF EXISTS "Public report tracking allows viewing basic report details" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authorities and owners can update reports" ON public.reports;
DROP POLICY IF EXISTS "Citizens create their own reports" ON public.reports;
DROP POLICY IF EXISTS "Owners and administrators update reports" ON public.reports;
CREATE POLICY "Public reports are viewable" ON public.reports
  FOR SELECT USING (true);
CREATE POLICY "Citizens create their own reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners and administrators update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_municipal_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_municipal_admin());

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications read state" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications read state" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Storage for report photos. The bucket is public for image rendering, but an
-- authenticated user may upload only inside their own UUID folder.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('civic-reports', 'civic-reports', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users upload their own civic evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users delete their own civic evidence" ON storage.objects;
CREATE POLICY "Users upload their own civic evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete their own civic evidence" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'civic-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- Status audit and timestamps.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_report_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_status_history (report_id, old_status, new_status, changed_by, changed_by_name)
    VALUES (NEW.report_id, OLD.status, NEW.status, auth.uid(), COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'System'));
  END IF;
  IF NEW.status = 'RESOLVED' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = timezone('utc'::text, now());
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_report_status_change ON public.reports;
CREATE TRIGGER on_report_status_change
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_status_update();

-- After creating your own Supabase Auth account, promote it once in this SQL
-- editor. Replace the email, then remove this comment (do not put passwords here):
-- UPDATE public.profiles
-- SET role = 'admin', is_super_admin = true, department = 'Municipal Administration'
-- WHERE email = 'your-admin-email@example.com';
