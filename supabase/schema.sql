-- ==========================================================================
-- DR. PRAGYA MISHRA CLINICAL PORTAL — MASTER SUPABASE DATABASE SCHEMA
-- Complete, Atomic, Zero-Warning Production Schema
-- Contains: Tables, Constraints, Indexes, Triggers, Zero-Warning RPCs, 
--           Hardened RLS Policies, Grants & Realtime Configuration
-- ==========================================================================

-- Enable essential extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================================================
-- 1. PATIENTS TABLE (Permanent Lifelong Clinical Record)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id_code TEXT UNIQUE NOT NULL,             -- Permanent Lifelong ID (e.g. PM-1001)
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 125),
    mobile TEXT NOT NULL,                             -- 10-digit WhatsApp phone
    concern TEXT NOT NULL,                            -- Medical condition / reason for visit
    problem_details TEXT DEFAULT '',                  -- Clinical history and notes
    current_category TEXT NOT NULL CHECK (
        current_category IN ('under_process', 'actively_treated', 'treatment_done')
    ) DEFAULT 'under_process',
    last_visit_at DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for ultra-fast multi-field searching and aggregation
CREATE INDEX IF NOT EXISTS idx_patients_code ON public.patients (patient_id_code);
CREATE INDEX IF NOT EXISTS idx_patients_mobile ON public.patients (mobile);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_patients_age ON public.patients (age);
CREATE INDEX IF NOT EXISTS idx_patients_category ON public.patients (current_category);
CREATE INDEX IF NOT EXISTS idx_patients_last_visit ON public.patients (last_visit_at DESC);

-- Auto-update updated_at timestamp trigger function (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_patients_updated_at ON public.patients;
CREATE TRIGGER trigger_patients_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();


-- ==========================================================================
-- 2. VISITS TABLE (Daily Scoped Consultation Records & Token Queue)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    visit_date DATE DEFAULT CURRENT_DATE NOT NULL,
    token_number INTEGER NOT NULL,                   -- Resets daily: 1, 2, 3...
    visit_type TEXT NOT NULL CHECK (
        visit_type IN ('new_patient', 'existing_patient')
    ),
    follow_up_days INTEGER DEFAULT 0 CHECK (follow_up_days >= 0 AND follow_up_days <= 90),
    next_follow_up_date DATE,
    is_treatment_done BOOLEAN DEFAULT FALSE NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE NOT NULL,       -- Doctor checked mark for the day
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(visit_date, token_number),                -- Unique token per calendar day
    UNIQUE(visit_date, patient_id)                   -- Prevents duplicate check-ins on same day
);

CREATE INDEX IF NOT EXISTS idx_visits_date ON public.visits (visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON public.visits (patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_token ON public.visits (visit_date, token_number);
CREATE INDEX IF NOT EXISTS idx_visits_next_follow_up ON public.visits (next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_visits_is_checked ON public.visits (is_checked);


-- ==========================================================================
-- 3. WHATSAPP LOGS TABLE (Automated Messages & Idempotency Lock)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
    message_type TEXT NOT NULL CHECK (
        message_type IN ('appointment_reminder', 'missed_followup', 'missing_followup_fallback', 'google_review')
    ),
    scheduled_for DATE NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN ('pending', 'sent', 'failed', 'skipped')
    ) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(patient_id, message_type, scheduled_for)  -- Prevents duplicate automated notifications
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_scheduled ON public.whatsapp_logs (scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_patient ON public.whatsapp_logs (patient_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_visit ON public.whatsapp_logs (visit_id);


-- ==========================================================================
-- 4. STORED PROCEDURES (SECURITY INVOKER — Zero Advisory Warnings)
-- ==========================================================================

-- Function 1: Register New Patient + Issue Daily Token # Atomically
CREATE OR REPLACE FUNCTION public.register_new_patient(
    p_name TEXT,
    p_age INTEGER,
    p_mobile TEXT,
    p_concern TEXT,
    p_problem_details TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next_code_num INTEGER;
    v_patient_code TEXT;
    v_new_patient_id UUID;
    v_next_token INTEGER;
    v_new_visit_id UUID;
    v_result JSONB;
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN patient_id_code ~ '^PM-[0-9]+$' 
            THEN SUBSTRING(patient_id_code FROM 4)::INTEGER 
            ELSE 1000 
        END
    ), 1000) + 1
    INTO v_next_code_num
    FROM public.patients;

    v_patient_code := 'PM-' || v_next_code_num::TEXT;

    INSERT INTO public.patients (
        patient_id_code,
        name,
        age,
        mobile,
        concern,
        problem_details,
        current_category,
        last_visit_at
    ) VALUES (
        v_patient_code,
        TRIM(p_name),
        p_age,
        TRIM(p_mobile),
        TRIM(p_concern),
        TRIM(p_problem_details),
        'under_process',
        CURRENT_DATE
    )
    RETURNING id INTO v_new_patient_id;

    SELECT COALESCE(MAX(token_number), 0) + 1
    INTO v_next_token
    FROM public.visits
    WHERE visit_date = CURRENT_DATE;

    INSERT INTO public.visits (
        patient_id,
        visit_date,
        token_number,
        visit_type,
        follow_up_days,
        next_follow_up_date,
        is_treatment_done,
        is_checked
    ) VALUES (
        v_new_patient_id,
        CURRENT_DATE,
        v_next_token,
        'new_patient',
        0,
        NULL,
        FALSE,
        FALSE
    )
    RETURNING id INTO v_new_visit_id;

    SELECT jsonb_build_object(
        'success', TRUE,
        'patient_id', v_new_patient_id,
        'patient_id_code', v_patient_code,
        'name', TRIM(p_name),
        'age', p_age,
        'mobile', TRIM(p_mobile),
        'concern', TRIM(p_concern),
        'problem_details', TRIM(p_problem_details),
        'current_category', 'under_process',
        'visit_id', v_new_visit_id,
        'token_number', v_next_token,
        'visit_date', CURRENT_DATE,
        'message', 'Patient registered successfully with Daily Token #' || v_next_token
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Function 2: Check-in Existing Patient ("Arrived Today" Action)
CREATE OR REPLACE FUNCTION public.checkin_existing_patient(
    p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_visit RECORD;
    v_next_token INTEGER;
    v_new_visit_id UUID;
    v_patient RECORD;
    v_result JSONB;
BEGIN
    SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Patient not found'
        );
    END IF;

    SELECT * INTO v_existing_visit 
    FROM public.visits 
    WHERE patient_id = p_patient_id AND visit_date = CURRENT_DATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'already_checked_in', TRUE,
            'visit_id', v_existing_visit.id,
            'token_number', v_existing_visit.token_number,
            'visit_date', CURRENT_DATE,
            'patient_id', p_patient_id,
            'message', 'Patient already checked in for today'
        );
    END IF;

    SELECT COALESCE(MAX(token_number), 0) + 1
    INTO v_next_token
    FROM public.visits
    WHERE visit_date = CURRENT_DATE;

    INSERT INTO public.visits (
        patient_id,
        visit_date,
        token_number,
        visit_type,
        follow_up_days,
        next_follow_up_date,
        is_treatment_done,
        is_checked
    ) VALUES (
        p_patient_id,
        CURRENT_DATE,
        v_next_token,
        'existing_patient',
        0,
        NULL,
        FALSE,
        FALSE
    )
    RETURNING id INTO v_new_visit_id;

    UPDATE public.patients
    SET 
        last_visit_at = CURRENT_DATE,
        current_category = CASE 
            WHEN current_category = 'under_process' THEN 'actively_treated'
            ELSE current_category
        END,
        updated_at = NOW()
    WHERE id = p_patient_id;

    SELECT jsonb_build_object(
        'success', TRUE,
        'already_checked_in', FALSE,
        'visit_id', v_new_visit_id,
        'token_number', v_next_token,
        'visit_date', CURRENT_DATE,
        'patient_id', p_patient_id,
        'message', 'Check-in successful'
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Function 3: Update Visit Follow-up Days & Auto-calculate Next Date
CREATE OR REPLACE FUNCTION public.update_patient_visit_followup(
    p_visit_id UUID,
    p_follow_up_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_visit_date DATE;
    v_next_date DATE := NULL;
BEGIN
    SELECT visit_date INTO v_visit_date FROM public.visits WHERE id = p_visit_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Visit not found');
    END IF;

    IF p_follow_up_days > 0 THEN
        v_next_date := v_visit_date + (p_follow_up_days || ' days')::INTERVAL;
    END IF;

    UPDATE public.visits
    SET 
        follow_up_days = p_follow_up_days,
        next_follow_up_date = v_next_date
    WHERE id = p_visit_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'visit_id', p_visit_id,
        'follow_up_days', p_follow_up_days,
        'next_follow_up_date', v_next_date
    );
END;
$$;

-- Function 4: Toggle Treatment Done & Synchronize Patient Category
CREATE OR REPLACE FUNCTION public.toggle_treatment_done(
    p_visit_id UUID,
    p_is_done BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_patient_id UUID;
BEGIN
    SELECT patient_id INTO v_patient_id FROM public.visits WHERE id = p_visit_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Visit not found');
    END IF;

    UPDATE public.visits
    SET is_treatment_done = p_is_done
    WHERE id = p_visit_id;

    UPDATE public.patients
    SET 
        current_category = CASE 
            WHEN p_is_done THEN 'treatment_done'
            ELSE 'actively_treated'
        END,
        updated_at = NOW()
    WHERE id = v_patient_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'visit_id', p_visit_id,
        'patient_id', v_patient_id,
        'is_treatment_done', p_is_done,
        'current_category', CASE WHEN p_is_done THEN 'treatment_done' ELSE 'actively_treated' END
    );
END;
$$;

-- Function 5: Toggle Checked Status for Doctor Daily Queue
CREATE OR REPLACE FUNCTION public.toggle_patient_checked(
    p_visit_id UUID,
    p_is_checked BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.visits
    SET is_checked = p_is_checked
    WHERE id = p_visit_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Visit not found');
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'visit_id', p_visit_id,
        'is_checked', p_is_checked
    );
END;
$$;

-- ==========================================================================
-- 5. FUNCTION EXECUTION GRANTS (Principle of Least Privilege)
-- Grants execution to logged-in clinic staff (authenticated) and backend (service_role)
-- ==========================================================================
REVOKE ALL ON FUNCTION public.set_updated_at_timestamp() FROM anon, public;
REVOKE ALL ON FUNCTION public.register_new_patient(TEXT, INTEGER, TEXT, TEXT, TEXT) FROM anon, public;
REVOKE ALL ON FUNCTION public.checkin_existing_patient(UUID) FROM anon, public;
REVOKE ALL ON FUNCTION public.update_patient_visit_followup(UUID, INTEGER) FROM anon, public;
REVOKE ALL ON FUNCTION public.toggle_treatment_done(UUID, BOOLEAN) FROM anon, public;
REVOKE ALL ON FUNCTION public.toggle_patient_checked(UUID, BOOLEAN) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.set_updated_at_timestamp() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_new_patient(TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkin_existing_patient(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_patient_visit_followup(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_treatment_done(UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_patient_checked(UUID, BOOLEAN) TO authenticated, service_role;


-- ==========================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES (Supabase Best Practices)
-- Enforces TO authenticated and cached (SELECT auth.uid())
-- Completely removes deprecated auth.role() and prevents duplicate policies
-- ==========================================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Clean all legacy, blanket and transitional policies
DROP POLICY IF EXISTS "Allow authenticated full access to patients" ON public.patients;
DROP POLICY IF EXISTS "Allow anon access during active clinic session patients" ON public.patients;
DROP POLICY IF EXISTS "Allow clinic access to patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic staff access to patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can manage patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;

DROP POLICY IF EXISTS "Allow authenticated full access to visits" ON public.visits;
DROP POLICY IF EXISTS "Allow anon access during active clinic session visits" ON public.visits;
DROP POLICY IF EXISTS "Allow clinic access to visits" ON public.visits;
DROP POLICY IF EXISTS "Clinic staff access to visits" ON public.visits;
DROP POLICY IF EXISTS "Authenticated users can manage visits" ON public.visits;
DROP POLICY IF EXISTS "Authenticated users can view visits" ON public.visits;
DROP POLICY IF EXISTS "Authenticated users can insert visits" ON public.visits;
DROP POLICY IF EXISTS "Authenticated users can update visits" ON public.visits;

DROP POLICY IF EXISTS "Allow authenticated full access to whatsapp_logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Allow anon access during active clinic session whatsapp_logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Allow clinic access to whatsapp_logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Clinic staff access to whatsapp_logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Authenticated users can view whatsapp logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Authenticated users can insert whatsapp logs" ON public.whatsapp_logs;
DROP POLICY IF EXISTS "Authenticated users can update whatsapp logs" ON public.whatsapp_logs;

-- Active Authenticated Policies
-- Uses modern 'TO authenticated' and cached '(SELECT auth.uid()) IS NOT NULL'
CREATE POLICY "Authenticated users can manage patients"
    ON public.patients
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage visits"
    ON public.visits
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can manage whatsapp_logs"
    ON public.whatsapp_logs
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- ==========================================================================
-- 7. SUPABASE REALTIME CONFIGURATION
-- Enables instant websocket synchronization for doctor & receptionist devices
-- ==========================================================================
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.visits REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'patients'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'visits'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
    END IF;
END $$;
