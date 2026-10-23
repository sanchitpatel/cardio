- **Frontend Framework**: Astro page at `src/pages/dashboard/index.astro` hosting a modular React Application (`client:only="react"`) with pure client-side routing & instant state transitions.
- **UI Design System**: Supabase Design Engineering standard (Dark/Light zinc `#09090b`/`#ffffff`, emerald green accents `#10b981`, crisp borders `#27272a`/`#e4e4e7`, micro-interactions, responsive touch targets).
- **Backend / Database**: Supabase PostgreSQL with strict RLS (Row-Level Security), indexed queries, and daily-scoped token numbers.

### **🗄️ Database Schema Design (Supabase PostgreSQL)**

```
sql
-- 1. Patients Table (Permanent Record)
create table public.patients (
    id uuid primary key default gen_random_uuid(),
    patient_id_code text unique not null, -- Permanent ID (e.g., PM-1001), printed on slip/prescription
    name text not null,
    age integer not null check (age >= 0 and age <= 125),
    mobile text not null,
    concern text not null,
    current_category text not null check (current_category in ('under_process','actively_treated','treatment_done')) default 'under_process',
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    last_visit_at date default current_date not null
);
create index idx_patients_code on public.patients (patient_id_code);
create index idx_patients_mobile on public.patients (mobile);
create index idx_patients_name on public.patients (name);
create index idx_patients_category on public.patients (current_category);
create index idx_patients_last_visit on public.patients (last_visit_at);

-- 2. Visits Table (Historical & Daily Scoped Record)
create table public.visits (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references public.patients(id) on delete cascade not null,
    visit_date date default current_date not null,
    token_number integer not null, -- Resets daily every morning (1, 2, 3...)
    visit_type text not null check (visit_type in ('new_patient','existing_patient')),
    follow_up_days integer check (follow_up_days between 1 and 15),
    next_follow_up_date date,
    is_treatment_done boolean default false not null,
    notes text,
    created_at timestamptz default now() not null,
    unique(visit_date, token_number),
    unique(visit_date, patient_id) -- Prevents duplicate check-ins on the same calendar date
);
create index idx_visits_date on public.visits (visit_date desc);
create index idx_visits_patient on public.visits (patient_id);
create index idx_visits_next_follow_up on public.visits (next_follow_up_date);

-- 3. WhatsApp & Automated Message Logs
create table public.whatsapp_logs (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references public.patients(id) on delete cascade not null,
    visit_id uuid references public.visits(id) on delete set null,
    message_type text not null check (message_type in ('appointment_reminder','missed_followup','missing_followup_fallback','google_review')),
    scheduled_for date not null,
    status text not null check (status in ('pending','sent','failed','skipped')) default 'pending',
    sent_at timestamptz,
    error_message text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    unique(patient_id, message_type, scheduled_for) -- Prevents duplicate automated notifications
);
```

---

### **📋 Master Implementation Checklist**

#### **Phase 1: Project Foundation & Supabase Setup**

- [x] Configure Supabase client utility (`src/utils/supabase.js`) using environment variables.
- [x] Implement Session & Auth Provider context for persistent doctor/assistant login (`src/components/dashboard/AuthContext.jsx`).
- [x] Create base Dashboard Shell with clean Supabase-inspired typography, theme variables, and responsive layout (`src/components/dashboard/DashboardShell.jsx`).
- [x] Implement the fixed 3-tab Sidebar:
    1. **New Patient**
    2. **Existing Patient**
    3. **Dashboard**
- [x] Add quick stats header with user logout & live sync indicator.

#### **Phase 2: Authentication Screen**

- [x] Build clean, minimal Supabase-style Login screen (Email/Password login with smooth error feedback, `src/components/dashboard/LoginView.jsx`).
- [x] Setup Auth Gate in dashboard root (redirect unauthenticated sessions immediately, `src/components/dashboard/DashboardApp.jsx` + `src/pages/dashboard/index.astro`).

#### **Phase 3: "New Patient" Module**

- [x] Registration form with fields: Name, Age, Mobile Number, Disease/Concern, Problem details.
- [x] Strict input sanitization (alphabets for name, digits for age/mobile, punctuation rules for concern) & clean inline error states.
- [ ] Atomic database transaction:
    - Generate unique permanent `patient_id_code` (e.g. `PM-1001`).
    - Create patient record (`current_category = 'under_process'`).
    - Compute next daily `token_number` for `current_date` (resets daily every morning).
    - Insert initial visit record for today.
- [ ] Success banner with assigned Daily Token Number and Permanent Patient ID.

#### **Phase 4: "Existing Patient" Module**

- [ ] **Multi-Field Dynamic Search Bar**:
    - Input sequence:
      1. `Patient ID` (Permanent ID, exact/prefix)
      2. `Mobile Number` (10-digit WhatsApp phone)
      3. `Patient Name` (Case-insensitive fuzzy match)
      4. `Age` (Exact numeric filter)
      5. `Last Visit Date` (Calendar picker filter)
    - Dynamic instant DB querying on any input, compound precision refinement as more fields are populated.
- [ ] **Responsive Dual-View Output Layout**:
    - **Desktop / Laptop View**: Clean Data Table (`Patient ID`, `Name`, `Age`, `Mobile (WhatsApp)`, `Concern`, `Last Visit Date`, `Status`, `Action`).
    - **Mobile View**: Responsive Patient Cards with avatar, full details, and prominent action button.
- [ ] **Date-Aware "Arrived Today" Action Button**:
    - Automatically computes & assigns next chronological Daily Token Number for today.
    - Transitions `under_process` $\rightarrow$ `actively_treated` (retains `actively_treated` if already ongoing).
    - Date-aware lock: changes state to `✅ Checked-in for Today (Token #X)` and disables to prevent accidental duplicate clicks on the same calendar day.
    - Re-enables automatically when patient visits on future calendar dates.

#### **Phase 5: Doctor Dashboard & Analytics Overview**

- **Summary Metric Cards**:
    - *Lifetime Patients* (Total, Treatment Done, Actively Getting Treated).
    - *Current Month* (Total Visited, Treatment Done, Actively Getting Treated).
    - *Today's Patients* (Total Visited Today).
- **Chronological Date Cards List**:
    - Today's date pinned at the top with patient count.
    - Past dates grouped chronologically.
    - Search/Filter dates.

#### **Phase 6: Daily Patient Interactive Table**

- Table columns: `Token / S.No.` | `Patient Name` | `Age` | `Issue / Concern` | `Status (New/Existing)` | `Follow-Up` | `Is Treatment Done?`.
- **Follow-Up Dropdown**: 1 to 15 days selector with instant calculation of `next_follow_up_date = visit_date + days`.
- **Treatment Done Checkbox / Toggle**:
    - Completes patient treatment cycle.
    - Moves status to `Treatment Done`.
    - Enqueues Google Review workflow.

#### **Phase 7: Doctor Missed Follow-ups & Fallback Watchlist**

- Missed Follow-up queue (patients whose scheduled follow-up was 2 days ago and didn't arrive).
- Fallback queue (Under Process patients with no follow-up entered after 10 days).
- Direct action buttons: `Send WhatsApp Follow-up` / `Dismiss`.

#### **Phase 8: Edge Functions & Automated WhatsApp Engine (WATI / Webhook)**

- Database triggers / Edge functions for daily cron processing.
- Appointment reminder queue (morning of scheduled date).
- Google Review request trigger (2–3 days after `Treatment Done`).
- Duplicate message safety locks.