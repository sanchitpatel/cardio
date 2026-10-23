-- ==========================================================================
-- DR. PRAGYA MISHRA CLINICAL PORTAL — MASTER SEED DATA
-- Fully Compatible with schema.sql (Dynamic Dates & Relational Integrity)
-- Populates: Historical Patients, Today's Live Queue (Tokens #1-17), and Logs
-- ==========================================================================

DO $$
DECLARE
    -- Historical Patient IDs
    v_p101 UUID; v_p105 UUID; v_p107 UUID; v_p108 UUID; v_p113 UUID;
    v_p114 UUID; v_p125 UUID; v_p126 UUID; v_p127 UUID; v_p128 UUID;
    
    -- Today's Live Queue Patient IDs
    v_p137 UUID; v_p138 UUID; v_p139 UUID; v_p140 UUID; v_p141 UUID;
    v_p142 UUID; v_p143 UUID; v_p144 UUID; v_p145 UUID; v_p146 UUID;
    v_p147 UUID; v_p148 UUID; v_p149 UUID; v_p150 UUID; v_p151 UUID;
    v_p152 UUID; v_p153 UUID;

    -- Visit reference for sample WhatsApp log
    v_visit_sample UUID;
BEGIN
    -- ======================================================================
    -- 1. HISTORICAL PATIENTS (Past Consultations from previous days/weeks)
    -- ======================================================================
    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1001', 'Priya Sharma', 28, '9876543210', 'PCOS & Hormonal Imbalance', 'Irregular cycles and weight management consultation.', 'actively_treated', CURRENT_DATE - INTERVAL '7 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p101;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1005', 'Kavita Singh', 29, '9934567812', 'Infertility Evaluation', 'Follicular tracking cycle 2.', 'actively_treated', CURRENT_DATE - INTERVAL '8 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p105;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1007', 'Divya Nair', 31, '9811223344', 'First Trimester Prenatal Check', 'Nausea, early pregnancy ultrasound confirmed heartbeat.', 'actively_treated', CURRENT_DATE - INTERVAL '5 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p107;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1008', 'Meera Kapoor', 34, '9877001122', 'Uterine Fibroid Follow-up', 'Mild pelvis pain, pelvic scan review scheduled.', 'under_process', CURRENT_DATE - INTERVAL '4 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p108;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1013', 'Rashmi Verma', 26, '9899112233', 'Routine Antenatal Checkup', '24 weeks gestation, growth scan normal.', 'actively_treated', CURRENT_DATE - INTERVAL '3 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p113;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1014', 'Sushmita Sen', 37, '9812998877', 'Cervical Screening & HPV', 'Routine pap smear and colposcopy review.', 'under_process', CURRENT_DATE - INTERVAL '2 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p114;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1025', 'Nisha Aggarwal', 30, '9871122334', 'Gestational Hypertension Review', 'BP 128/84, routine urine albumin negative.', 'actively_treated', CURRENT_DATE - INTERVAL '6 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p125;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1026', 'Tanvi Shah', 27, '9820556677', 'PCOS Follicular Tracking', 'Dominant follicle 18mm noted on Day 12.', 'actively_treated', CURRENT_DATE - INTERVAL '4 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p126;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1027', 'Shreya Ghosh', 33, '9831445566', 'Routine Antenatal Care', 'Third trimester wellness check, fetal movements brisk.', 'treatment_done', CURRENT_DATE - INTERVAL '5 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p127;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1028', 'Mansi Joshi', 25, '9890223344', 'Pre-conceptional Counseling', 'Rubella IgG positive, folic acid initiated.', 'treatment_done', CURRENT_DATE - INTERVAL '4 days')
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p128;


    -- ======================================================================
    -- 2. HISTORICAL VISITS (Provides Past Visit Records for Search & History)
    -- ======================================================================
    INSERT INTO public.visits (patient_id, visit_date, token_number, visit_type, follow_up_days, next_follow_up_date, is_treatment_done, is_checked)
    VALUES
        (v_p101, CURRENT_DATE - INTERVAL '7 days', 1, 'existing_patient', 14, CURRENT_DATE + INTERVAL '7 days', FALSE, TRUE),
        (v_p105, CURRENT_DATE - INTERVAL '8 days', 2, 'existing_patient', 7, CURRENT_DATE - INTERVAL '1 day', FALSE, TRUE),
        (v_p107, CURRENT_DATE - INTERVAL '5 days', 1, 'new_patient', 30, CURRENT_DATE + INTERVAL '25 days', FALSE, TRUE),
        (v_p108, CURRENT_DATE - INTERVAL '4 days', 3, 'existing_patient', 15, CURRENT_DATE + INTERVAL '11 days', FALSE, TRUE),
        (v_p113, CURRENT_DATE - INTERVAL '3 days', 2, 'existing_patient', 28, CURRENT_DATE + INTERVAL '25 days', FALSE, TRUE),
        (v_p114, CURRENT_DATE - INTERVAL '2 days', 4, 'new_patient', 0, NULL, FALSE, TRUE),
        (v_p125, CURRENT_DATE - INTERVAL '6 days', 5, 'existing_patient', 7, CURRENT_DATE + INTERVAL '1 day', FALSE, TRUE),
        (v_p126, CURRENT_DATE - INTERVAL '4 days', 6, 'existing_patient', 3, CURRENT_DATE - INTERVAL '1 day', FALSE, TRUE),
        (v_p127, CURRENT_DATE - INTERVAL '5 days', 7, 'existing_patient', 0, NULL, TRUE, TRUE),
        (v_p128, CURRENT_DATE - INTERVAL '4 days', 8, 'new_patient', 0, NULL, TRUE, TRUE)
    ON CONFLICT (visit_date, token_number) DO NOTHING;


    -- ======================================================================
    -- 3. TODAY'S LIVE QUEUE PATIENTS (Dynamic CURRENT_DATE)
    -- ======================================================================
    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1037', 'Kritika Roy', 30, '9830889900', 'Ovarian Dermoid Monitoring', 'Asymptomatic right adnexal mass review.', 'under_process', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p137;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1038', 'Ankita Trivedi', 27, '9825112233', 'Routine Postpartum Check', 'Exclusive breastfeeding going well, vitals normal.', 'treatment_done', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p138;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1039', 'Vandana Pandey', 36, '9891223344', 'Fibroid Surveillance', 'Subserosal fibroid 3cm without pressure symptoms.', 'under_process', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p139;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1040', 'Simran Chadha', 24, '9811445566', 'Severe Dysmenorrhea', 'Symptomatic pain relief and cycle tracking initiated.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p140;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1041', 'Shalini Mathur', 38, '9829334455', 'Pap Smear Follow-up', 'Cytology negative for intraepithelial lesion.', 'treatment_done', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p141;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1042', 'Ruchi Saxena', 32, '9810332211', 'Second Trimester Growth Scan', 'Fetal anatomy normal, amniotic fluid AFI 14.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p142;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1043', 'Bina Agarwal', 46, '9821009988', 'Climacteric Symptoms & Bone Health', 'DEXA scan advised, vitamin D & calcium prescribed.', 'treatment_done', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p143;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1044', 'Pooja Hegde', 29, '9845012345', 'First Trimester Viability Scan', 'Routine viability scan, 7 weeks gestation with good cardiac activity.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p144;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1045', 'Ananya Sen', 33, '9830123456', 'PCOS & Metabolic Health', 'Lifestyle modification review, fasting insulin and lipid profile ordered.', 'under_process', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p145;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1046', 'Meenakshi Sundaram', 41, '9840234567', 'Perimenopausal Vasomotor Symptoms', 'Irregular cycles with severe hot flashes, botanical support discussed.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p146;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1047', 'Ishita Banerjee', 26, '9831345678', 'Pre-conceptional Counseling', 'Hemoglobin screening, thyroid profile & rubella titer check.', 'treatment_done', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p147;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1048', 'Sneha Kulkarni', 31, '9822456789', 'Target Anomaly Scan Review', 'Target scan at 20 weeks normal, cervical length adequate.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p148;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1049', 'Taruna Kapoor', 35, '9811567890', 'Post-operative Healing Check', 'Laparoscopic ovarian cystectomy port sites healed cleanly.', 'treatment_done', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p149;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1050', 'Neha Chawla', 28, '9818678901', 'Chronic Pelvic Pain & Endometriosis', 'Severe cyclical pelvic discomfort, ultrasound scheduled.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p150;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1051', 'Sunita Rao', 52, '9849789012', 'Postmenopausal Bleeding Evaluation', 'TVS confirms endometrial thickness 6.5mm, hysteroscopy advised.', 'under_process', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p151;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1052', 'Riddhi Patel', 25, '9825890123', 'Recurrent UTI & Candidiasis', 'Dysuria with irritation, alkalinizer and culture-specific antibiotics.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p152;

    INSERT INTO public.patients (patient_id_code, name, age, mobile, concern, problem_details, current_category, last_visit_at)
    VALUES ('PM-1053', 'Divya Gopinath', 37, '9844901234', 'Gestational Diabetes Follow-up', 'Blood glucose log within fasting < 95 and post-prandial < 120 mg/dL.', 'actively_treated', CURRENT_DATE)
    ON CONFLICT (patient_id_code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_p153;


    -- ======================================================================
    -- 4. TODAY'S LIVE APPOINTMENT QUEUE (Tokens #1 to #17 on CURRENT_DATE)
    -- ======================================================================
    INSERT INTO public.visits (patient_id, visit_date, token_number, visit_type, follow_up_days, next_follow_up_date, is_treatment_done, is_checked)
    VALUES
        (v_p137, CURRENT_DATE, 1, 'new_patient', 0, NULL, FALSE, FALSE),
        (v_p138, CURRENT_DATE, 2, 'existing_patient', 0, NULL, TRUE, TRUE),
        (v_p139, CURRENT_DATE, 3, 'existing_patient', 0, NULL, FALSE, FALSE),
        (v_p140, CURRENT_DATE, 4, 'new_patient', 14, CURRENT_DATE + INTERVAL '14 days', FALSE, FALSE),
        (v_p141, CURRENT_DATE, 5, 'existing_patient', 0, NULL, TRUE, TRUE),
        (v_p142, CURRENT_DATE, 6, 'new_patient', 28, CURRENT_DATE + INTERVAL '28 days', FALSE, TRUE),
        (v_p143, CURRENT_DATE, 7, 'existing_patient', 0, NULL, TRUE, TRUE),
        (v_p144, CURRENT_DATE, 8, 'new_patient', 14, CURRENT_DATE + INTERVAL '14 days', FALSE, FALSE),
        (v_p145, CURRENT_DATE, 9, 'existing_patient', 0, NULL, FALSE, FALSE),
        (v_p146, CURRENT_DATE, 10, 'existing_patient', 7, CURRENT_DATE + INTERVAL '7 days', FALSE, FALSE),
        (v_p147, CURRENT_DATE, 11, 'new_patient', 0, NULL, TRUE, TRUE),
        (v_p148, CURRENT_DATE, 12, 'existing_patient', 21, CURRENT_DATE + INTERVAL '21 days', FALSE, TRUE),
        (v_p149, CURRENT_DATE, 13, 'existing_patient', 0, NULL, TRUE, TRUE),
        (v_p150, CURRENT_DATE, 14, 'new_patient', 7, CURRENT_DATE + INTERVAL '7 days', FALSE, FALSE),
        (v_p151, CURRENT_DATE, 15, 'existing_patient', 0, NULL, FALSE, FALSE),
        (v_p152, CURRENT_DATE, 16, 'new_patient', 5, CURRENT_DATE + INTERVAL '5 days', FALSE, FALSE),
        (v_p153, CURRENT_DATE, 17, 'existing_patient', 14, CURRENT_DATE + INTERVAL '14 days', FALSE, TRUE)
    ON CONFLICT (visit_date, token_number) DO NOTHING
    RETURNING id INTO v_visit_sample;


    -- ======================================================================
    -- 5. SAMPLE WHATSAPP NOTIFICATION LOGS (Demonstrates Idempotency)
    -- ======================================================================
    INSERT INTO public.whatsapp_logs (patient_id, visit_id, message_type, scheduled_for, status, sent_at, metadata)
    VALUES
        (v_p140, v_visit_sample, 'appointment_reminder', CURRENT_DATE, 'sent', NOW(), '{"template": "reminder_morning"}'::jsonb),
        (v_p144, v_visit_sample, 'appointment_reminder', CURRENT_DATE, 'sent', NOW(), '{"template": "reminder_morning"}'::jsonb),
        (v_p105, NULL, 'missed_followup', CURRENT_DATE - INTERVAL '1 day', 'sent', NOW() - INTERVAL '1 day', '{"days_overdue": 1}'::jsonb)
    ON CONFLICT (patient_id, message_type, scheduled_for) DO NOTHING;

END $$;
