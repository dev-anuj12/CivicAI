-- =============================================================================
-- CIVICAI: Supabase PostgreSQL Database Schema
-- "One Platform. Every Civic Issue."
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'authority', 'admin')),
    department TEXT, -- E.g. 'Roads & Transportation', 'Water Supply & Sewage', 'Electricity Board', etc.
    profile_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. REPORTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT NOT NULL UNIQUE, -- Human-friendly ID: CIV-2026-XXXXX
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN (
        'Roads & Transportation',
        'Water & Drainage',
        'Electricity & Lighting',
        'Sanitation & Waste',
        'Public Infrastructure',
        'Construction',
        'Traffic & Signage',
        'Environment',
        'Other Civic Issues'
    )),
    subcategory TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    landmark TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected')),
    image_url TEXT NOT NULL,
    
    -- AI Diagnostics Fields
    ai_detected_issue TEXT,
    ai_category TEXT,
    ai_confidence DOUBLE PRECISION,
    ai_severity TEXT,
    ai_explanation TEXT,
    ai_generated_description TEXT,
    citizen_confirmed_category BOOLEAN DEFAULT true,
    
    -- Authority Assignment
    assigned_authority TEXT,
    assigned_to_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    
    -- Category-specific extra parameters (JSONB)
    category_metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- -----------------------------------------------------------------------------
-- 3. AI_ANALYSIS AUDIT TABLE
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

-- -----------------------------------------------------------------------------
-- 4. REPORT STATUS HISTORY TABLE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. REPORT IMAGES TABLE (Multi-attachment / Resolution Proof)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'original_issue', -- 'original_issue', 'resolution_proof', 'progress_update'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. NOTIFICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    report_id TEXT REFERENCES public.reports(report_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'status_update' CHECK (type IN ('status_update', 'assignment', 'resolution', 'alert', 'system')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_report_id ON public.reports(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON public.reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_authority ON public.reports(assigned_authority);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_status_history_report_id ON public.report_status_history(report_id);

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- Reports Policies
-- 1. Anyone (even unauthenticated) can view public report tracker by report_id
CREATE POLICY "Public report tracking allows viewing basic report details"
    ON public.reports FOR SELECT
    USING (true);

-- 2. Citizens can insert reports
CREATE POLICY "Authenticated users can create reports"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. Citizens can update only their own draft reports, Authorities can update any report
CREATE POLICY "Authorities and owners can update reports"
    ON public.reports FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('authority', 'admin'))
    );

-- Notifications Policies
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications read state"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 9. TRIGGER: AUTO-LOG STATUS HISTORY ON REPORT STATUS CHANGE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_report_status_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.report_status_history (report_id, old_status, new_status, comment)
        VALUES (NEW.report_id, OLD.status, NEW.status, 'Status updated to ' || NEW.status);
        
        -- Create notification for the report creator
        IF NEW.user_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, report_id, title, message, type)
            VALUES (
                NEW.user_id,
                NEW.report_id,
                'Report Status Updated',
                'Your report ' || NEW.report_id || ' status changed from ' || OLD.status || ' to ' || NEW.status || '.',
                CASE WHEN NEW.status = 'Resolved' THEN 'resolution' ELSE 'status_update' END
            );
        END IF;

        IF NEW.status = 'Resolved' THEN
            NEW.resolved_at = timezone('utc'::text, now());
        END IF;
    END IF;
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_report_status_change ON public.reports;
CREATE TRIGGER on_report_status_change
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_report_status_update();
