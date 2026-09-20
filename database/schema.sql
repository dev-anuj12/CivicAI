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
-- 4. SMART CIVIC ISSUE CONSOLIDATION & INTELLIGENCE TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.civic_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    department TEXT NOT NULL,
    location TEXT NOT NULL,
    ward TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    coordinates TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'UNDER REVIEW', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'REJECTED')),
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    priority_score INTEGER NOT NULL DEFAULT 50,
    priority_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    severity_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    reports_count INTEGER NOT NULL DEFAULT 1,
    linked_report_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    primary_image_url TEXT NOT NULL,
    assigned_crew TEXT,
    verifications_count INTEGER NOT NULL DEFAULT 0,
    still_present_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_civic_issues_category ON public.civic_issues(category);
CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON public.civic_issues(status);
CREATE INDEX IF NOT EXISTS idx_civic_issues_priority ON public.civic_issues(priority);

-- Link individual reports to consolidated CivicIssues
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS issue_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_issue_id ON public.reports(issue_id);

-- -----------------------------------------------------------------------------
-- 3. DUPLICATE COMPLAINT DETECTION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duplicate_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    target_issue_id TEXT NOT NULL,
    target_report_id TEXT,
    similarity_score INTEGER NOT NULL CHECK (similarity_score BETWEEN 0 AND 100),
    geo_distance_meters DOUBLE PRECISION,
    visual_similarity INTEGER,
    text_similarity INTEGER,
    category_match BOOLEAN DEFAULT true,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'possible_duplicate' CHECK (status IN ('possible_duplicate', 'linked_to_issue', 'confirmed_distinct')),
    matched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_duplicate_matches_source ON public.duplicate_matches(source_report_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_matches_target ON public.duplicate_matches(target_issue_id);

-- -----------------------------------------------------------------------------
-- 11. COMMUNITY VERIFICATION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id TEXT NOT NULL,
    report_id TEXT,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('confirm', 'still_present', 'resolved_for_me')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verifications_issue ON public.community_verifications(issue_id);

-- -----------------------------------------------------------------------------
-- 16. RESOLUTION EVIDENCE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resolution_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT,
    issue_id TEXT,
    before_image_url TEXT NOT NULL,
    after_image_url TEXT NOT NULL,
    resolved_by TEXT NOT NULL,
    resolution_notes TEXT NOT NULL,
    citizen_confirmed BOOLEAN DEFAULT false,
    citizen_feedback TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 10. REPORT INTEGRITY TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_integrity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT NOT NULL REFERENCES public.reports(report_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'REVIEW', 'FLAGGED')),
    flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score INTEGER NOT NULL DEFAULT 95,
    submission_velocity INTEGER DEFAULT 1,
    image_duplicate_risk INTEGER DEFAULT 0,
    geo_radius_density INTEGER DEFAULT 1,
    admin_reviewed BOOLEAN DEFAULT false,
    admin_action_note TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.civic_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolution_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_integrity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public civic issues are viewable" ON public.civic_issues;
CREATE POLICY "Public civic issues are viewable" ON public.civic_issues FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authorities update civic issues" ON public.civic_issues;
CREATE POLICY "Authorities update civic issues" ON public.civic_issues FOR ALL TO authenticated USING (public.is_municipal_admin()) WITH CHECK (public.is_municipal_admin());

DROP POLICY IF EXISTS "Public duplicate matches viewable" ON public.duplicate_matches;
CREATE POLICY "Public duplicate matches viewable" ON public.duplicate_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authorities update duplicate matches" ON public.duplicate_matches;
CREATE POLICY "Authorities update duplicate matches" ON public.duplicate_matches FOR ALL TO authenticated USING (public.is_municipal_admin()) WITH CHECK (public.is_municipal_admin());

DROP POLICY IF EXISTS "Public community verifications viewable" ON public.community_verifications;
CREATE POLICY "Public community verifications viewable" ON public.community_verifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users add community verifications" ON public.community_verifications;
CREATE POLICY "Authenticated users add community verifications" ON public.community_verifications FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public resolution evidence viewable" ON public.resolution_evidence;
CREATE POLICY "Public resolution evidence viewable" ON public.resolution_evidence FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authorities insert resolution evidence" ON public.resolution_evidence;
CREATE POLICY "Authorities insert resolution evidence" ON public.resolution_evidence FOR INSERT TO authenticated WITH CHECK (public.is_municipal_admin());


-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- Auth bootstrap & Auto-Confirm Email
-- Every Supabase Auth sign-up gets email confirmed automatically and a citizen profile.
-- No browser can assign itself an administrator role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, timezone('utc'::text, now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user_email();

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

ALTER TABLE public.reports ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by all" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Public profiles are viewable by all" ON public.profiles
  FOR SELECT USING (true);
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
DROP POLICY IF EXISTS "Allow report creation" ON public.reports;
DROP POLICY IF EXISTS "Allow report updates" ON public.reports;

CREATE POLICY "Public reports are viewable" ON public.reports
  FOR SELECT USING (true);
CREATE POLICY "Allow report creation" ON public.reports
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow report updates" ON public.reports
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications read state" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own notifications read state" ON public.notifications
  FOR UPDATE USING (true) WITH CHECK (true);

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

-- -----------------------------------------------------------------------------
-- Enable Supabase Realtime safely without throwing ERROR 42710
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'civic_issues'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.civic_issues;
  END IF;
END $$;

-- After creating your own Supabase Auth account, promote it once in this SQL
-- editor. Replace the email, then remove this comment (do not put passwords here):
-- UPDATE public.profiles
-- SET role = 'admin', is_super_admin = true, department = 'Municipal Administration'
-- WHERE email = 'anujvishwakarm1308@gmail.com';

