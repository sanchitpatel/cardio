# Patient Tracking & Automated WhatsApp Reminder System

## 1. Project Background & Problem Statement

My client is a doctor. The issue she was facing was that patients often give her good feedback and acknowledge her after receiving a service/treatment, but those positive experiences never reach the doctor's Google Reviews.

Therefore, the system we are building will solve two primary problems:

1. **Patient tracking and appointment/follow-up management**
   - Track new and existing patients.
   - Track patient visits.
   - Track treatment progress.
   - Track doctor-defined follow-up dates.
   - Help the doctor and assistant know which patients are expected to visit and when.

2. **Automated WhatsApp communication**
   - Automatically remind patients about their upcoming appointment/follow-up date.
   - Identify patients who did not arrive for their scheduled follow-up.
   - Allow the doctor to decide whether a follow-up WhatsApp message should be sent to those patients.
   - After treatment is completed, automatically send the patient a WhatsApp message asking them to rate/review the doctor on Google Reviews.

WhatsApp communication will use the **WhatsApp API through a platform such as WATI or another suitable WhatsApp API provider**.

---

# 2. Users of the Application

The application will only be used by **three individuals**:

1. **Developer**
   - Responsible for development and bug fixing.

2. **Doctor / Client**
   - Uses the dashboard primarily to manage patient treatment status, follow-up dates, and treatment completion.
   - Reviews patients who did not arrive for scheduled follow-ups.
   - Decides whether follow-up communication should be sent.

3. **Doctor's Assistant**
   - Main handler/operator of the application.
   - Adds new patients.
   - Searches existing patients.
   - Marks patients as having arrived today.
   - Assigns token numbers.
   - Handles the day-to-day patient tracking workflow.

---

# 3. Authentication

The application must have an authentication/login system.

After login, all three users will see the **exact same dashboard UI**.

There will be **no role-based UI differences**.

The UI should therefore remain identical for:

- Developer
- Doctor
- Doctor's Assistant

Role-based restrictions should not be introduced into the UI unless required later.

---

# 4. Overall UI / Design Direction

The application should have a **Supabase-style theme**.

The visual style should be:

- Simple
- Minimal
- Clean
- Professional
- White + green based
- Easy to understand
- Not visually cluttered
- Suitable for a medical/clinic environment

The interface should prioritize usability over visual complexity.

---

# 5. Main Sidebar Navigation

After login, the application should have a sidebar containing exactly three primary options:

1. **New Patient**
2. **Existing Patient**
3. **Dashboard**

The sidebar should remain simple and easy to navigate.

---

# 6. Patient Categories / Treatment Status

Every patient must belong to one of the following three categories:

### A. Under Process

This is the default category for a **new patient**.

When a patient visits for the first time and is added to the system:

```text
New Patient → Under Process
```

---

### B. Actively Getting Treated

This category is for an already existing patient who has returned for a follow-up visit and is actively undergoing treatment.

The patient's status changes from:

```text
Under Process
        ↓
Actively Getting Treated
```

This status change happens when the patient returns for their first follow-up visit and the assistant clicks:

**"Arrived Today"**

---

### C. Treatment Done

This category is for patients whose treatment has been completed.

The doctor will manually mark the patient's treatment as completed.

This is important because the system will use this event to trigger the Google Review workflow.

---

# 7. New Patient Flow

When the assistant clicks:

**New Patient**

a patient registration form should appear.

The form should collect the patient's basic information.

Required information includes:

- Patient Name
- Age
- Mobile Number
- Type of Concern / Disease
- Problem / Issue

The exact form structure can be optimized during implementation, but these core details must be captured.

---

## New Patient Creation Logic

When the assistant submits the form:

1. Create a patient record in the database.
2. Assign the patient to:

```text
Under Process
```

by default.

3. Create the relevant visit record for the current date.
4. Assign a token number for that day's visit.
5. Display the patient in the appropriate dashboard/date section for that day.

The newly created patient must immediately become visible in the doctor's dashboard for the current date.

---

# 8. Token Number & Permanent Patient ID System

The system operates on a dual-identifier architecture:

### A. Daily Sequential Token Number (`Token #1, #2, #3...`)
- **Daily Scope**: Resets every morning to `1`.
- **Purpose**: Controls the chronological queue for patients meeting the doctor throughout that specific day.
- **Identification**: Uniquely identifies a patient visit within that calendar day (`Token Number + Date`), serving as the S.NO. in the Doctor's daily table.

### B. Permanent Patient ID (`e.g. PM-1001` / Lifelong ID)
- **Global & Lifelong**: A unique identifier assigned upon initial registration.
- **Printed on Patient Slip/Form**: Stored permanently in the database and printed on the physical slip/prescription form given to the patient, as well as delivered via WhatsApp.
- **Instant Access**: Enables instant 1-to-1 lookup when the patient returns, even months or years later.

---

# 9. Existing Patient Lookup & Multi-Field Search

When the assistant clicks **Existing Patient**, the system displays a dynamic multi-field search and filter interface.

### Input Fields Sequence:
1. **Patient ID** (Lifelong Permanent ID, e.g. `PM-1001` or digits)
2. **Mobile Number** (10-digit WhatsApp number, exact or partial match)
3. **Patient Name** (Case-insensitive fuzzy/contains match)
4. **Age** (Numeric age filter)
5. **Last Visit Date Filter (Calendar Picker)**: A dedicated date picker allowing the assistant to filter patients who visited on a specific past date.

### Dynamic Real-Time Query Architecture:
- **Instant Live Search**: Filling **any single field** dynamically queries the database and renders matches immediately.
- **Compound Multi-Field Refinement**: Filling multiple fields compounds the query filters, significantly narrowing down results and maximizing precision and accuracy.

---

# 10. Responsive Output Display

The search results adapt seamlessly to screen size:

1. **Laptop / Desktop View**:
   - Renders a clean, interactive **Data Table**.
   - Columns: `Patient ID` | `Patient Name` | `Age` | `Mobile (WhatsApp)` | `Type of Concern` | `Last Visit Date` | `Current Status` | `Action ("Arrived Today")`.

2. **Mobile View**:
   - Renders responsive **Patient Cards**.
   - Each card displays avatar badge, Name, Age, ID, Phone, Diagnosis/Concern, Last Visit Date, Status badge, and the full-width action button.

---

# 11. Date-Aware "Arrived Today" Action Logic

When the assistant clicks **"Arrived Today"** for a patient:

1. **Next Daily Token Computation**: Automatically calculates and assigns the next chronological daily token number for today's date (e.g., if highest today is 4, assigns Token #5).
2. **Visit Creation**: Inserts a new visit record for today (`visit_type = 'existing_patient'`, `visit_date = current_date`).
3. **Status Transition**:
   - If currently `Under Process` $\rightarrow$ transitions to **`Actively Getting Treated`**.
   - If already `Actively Getting Treated` $\rightarrow$ remains **`Actively Getting Treated`**.
4. **Date-Aware Duplicate Prevention (Button Lock)**:
   - Once checked in for the day, the button locks to **`✅ Checked-in for Today (Token #X)`** and is disabled.
   - Prevents accidental duplicate token generation or double entries on the same day.
   - Automatically unlocks on subsequent dates when the patient revisits.

---

### Important

The **"Arrived Today"** button must become disabled after it has been clicked for that patient on that particular day.

This does **NOT** mean that the data should be undone or removed.

The purpose of disabling the button is simply to prevent the assistant from accidentally marking the same patient as arrived multiple times on the same day.

For example:

```text
October 4
Patient searches → Arrived Today → button disabled
```

The next day:

```text
October 5
Patient searches → Arrived Today → button enabled again
```

Therefore, the button's disabled state must be **date-aware**.

The patient data itself must remain stored in the database.

---

# 12. Daily Patient Records

Every patient visit should be associated with a date.

The dashboard should therefore organize patient visits by date.

The main dashboard body should contain date cards arranged chronologically.

The order should be:

```text
Today's Date
↓
Previous Date
↓
Previous Date
↓
Previous Date
...
```

For example:

```text
October 4, 2026
October 3, 2026
October 2, 2026
October 1, 2026
...
```

The UI should remain simple and should not create confusion when many dates are present.

---

# 13. Daily Patient Table

When the doctor clicks a particular date card, the corresponding patient table should appear.

The table should contain the following columns:

| S.NO. / Token No. | Patient's Name | Age | Issue / Concern | Status (New Patient / Existing Patient) | Follow Up | Is Treatment Done? |
|---|---|---|---|---|---|---|

---

# 14. Meaning of Each Table Field

### S.NO. / Token No.

This is the token number assigned to the patient by the assistant.

The token number is unique for that particular day.

---

### Patient's Name

The patient's name.

---

### Age

The patient's age.

---

### Issue / Concern

The patient's problem, disease, concern, or reason for visiting the doctor.

---

### Status

This indicates whether the patient is:

- New Patient
- Existing Patient

This should represent the nature of the visit/patient entry.

---

### Follow Up

This field will be primarily managed by the doctor.

The doctor should be able to select how many days later the patient should return.

A dropdown should be provided containing:

```text
1 day
2 days
3 days
4 days
5 days
6 days
7 days
8 days
9 days
10 days
11 days
12 days
13 days
14 days
15 days
```

The selected value will determine the patient's next follow-up/appointment date.

---

### Is Treatment Done?

The doctor must be able to mark whether the patient's treatment has been completed.

This is a very important field.

For most patients, this should remain **unchecked/disabled by default**.

Only when the doctor determines that the patient's treatment is actually complete should she mark:

```text
Treatment Done = Yes
```

Once treatment is marked as done, the patient should move into:

```text
Treatment Done
```

and the Google Review workflow should become eligible for that patient.

---

# 15. Doctor Dashboard

The third sidebar option is:

**Dashboard**

This section is primarily intended for the doctor's use.

The dashboard should contain summary cards showing patient statistics.

The UI should contain at least the following cards/statistics.

---

## Card 1 — Lifetime Patients

Display:

**Total Patients Visited — Lifetime**

Along with a breakdown such as:

- Total patients with Treatment Done
- Total patients Actively Getting Treated

---

## Card 2 — Current Month

Display:

**Total Patients Visited — This Month**

Along with a breakdown such as:

- Total patients with Treatment Done
- Total patients Actively Getting Treated

---

## Card 3 — Patients Visited Today

Display:

**Patients Visited Today**

This should show the number of patients who visited on the current date.

---

# 16. Dashboard Date-Based Patient Lists

Below the summary cards, the dashboard should contain the date cards.

Each date card represents a day's patient list.

Today's date should appear first.

Previous dates should follow chronologically.

When the doctor clicks a date card, the patient table for that date should appear.

Example:

```text
┌─────────────────────────────┐
│ October 4, 2026             │
│ 24 Patients                 │
└─────────────────────────────┘

┌─────────────────────────────┐
│ October 3, 2026             │
│ 19 Patients                 │
└─────────────────────────────┘

┌─────────────────────────────┐
│ October 2, 2026             │
│ 21 Patients                 │
└─────────────────────────────┘
```

Clicking a card opens its corresponding patient table.

---

# 17. Core Patient Lifecycle

The overall patient lifecycle should work like this:

```text
NEW PATIENT
     ↓
UNDER PROCESS
     ↓
Doctor gives follow-up
     ↓
Automatic WhatsApp reminder
     ↓
Patient arrives
     ↓
"Arrived Today"
     ↓
ACTIVELY GETTING TREATED
     ↓
Doctor gives next follow-up
     ↓
Automatic WhatsApp reminder
     ↓
Patient arrives
     ↓
"Arrived Today"
     ↓
ACTIVELY GETTING TREATED
     ↓
...
     ↓
Doctor marks Treatment Done
     ↓
TREATMENT DONE
     ↓
Google Review WhatsApp message
```

---

# 18. Automated WhatsApp Reminder System

The second major purpose of the application is automated WhatsApp communication.

The system should send WhatsApp messages to patients at the appropriate times.

WhatsApp communication will be implemented using:

**WhatsApp API through a platform such as WATI or another suitable provider.**

The exact provider should be chosen during implementation based on:

- API availability
- Template/message support
- Reliability
- Cost
- Ease of integration
- Webhook support
- Scheduling capabilities

---

# 19. Follow-Up Reminder Workflow

Consider the following example.

### Day 1 — First Visit

A patient visits for the first time.

The assistant creates the patient:

```text
Patient = New
Category = Under Process
```

The doctor meets the patient and decides:

```text
Follow Up = 5 days
```

The system calculates:

```text
Next Follow-Up Date = Day 1 + 5 days
```

---

# 20. Appointment Reminder

On the morning of the patient's follow-up date, the patient should automatically receive a WhatsApp message.

For example:

```text
Today is your appointment/follow-up day.
We hope you will be visiting the doctor today.
```

The exact wording/template can be finalized later.

The important requirement is:

**The patient should receive an automated WhatsApp reminder on the morning of the scheduled follow-up date.**

---

# 21. Patient Arrives After Reminder

If the patient comes to the clinic:

The assistant searches for the patient under:

**Existing Patient**

The patient record appears.

The assistant clicks:

**Arrived Today**

The system then:

1. Updates the patient's latest visit date/time.
2. Creates/updates today's visit record.
3. Updates the patient's category according to the category rules.
4. Makes the patient part of today's patient list.
5. Disables the "Arrived Today" button for that patient for the remainder of that day.

The doctor then decides the next follow-up.

The system should calculate the next reminder based on the newly selected follow-up date.

---

# 22. Patient Does Not Arrive

If a patient does **not** arrive on their scheduled follow-up date:

The system should not immediately send another automatic patient message.

Instead, after:

```text
Scheduled Follow-Up Date + 2 days
```

the patient should appear in a list that is sent/displayed to the doctor.

The doctor should then decide what to do.

For each such patient, the doctor should have the ability to decide whether she wants to send a follow-up WhatsApp message.

For example:

```text
Patient did not arrive.

Doctor's options:

[Leave Patient]
[Send WhatsApp Follow-Up]
```

The WhatsApp message could ask the patient something like:

```text
Is everything okay?
We noticed that you were unable to visit for your scheduled follow-up.
```

The exact message wording can be finalized later.

---

# 23. Follow-Up Missing / 10-Day Fallback

There must also be a fallback mechanism.

Sometimes the doctor may accidentally forget to enter a follow-up period.

For example:

```text
Patient Category = Under Process
Follow Up = Not Entered
```

In this situation, the system should not leave the patient without any follow-up monitoring.

A fallback period of:

```text
10 days
```

should be used.

Therefore, if a patient is:

```text
Under Process
```

and no follow-up date has been specified, then:

```text
Last Visit Date + 10 days
```

should trigger the patient to be included in the relevant list sent/displayed to the doctor.

The purpose is to make sure patients are not forgotten because the doctor accidentally left the follow-up field empty.

---

# 24. Actively Getting Treated Patients

The same follow-up workflow should apply to patients whose category is:

```text
Actively Getting Treated
```

The doctor can specify the next follow-up period using the dropdown.

For example:

```text
Follow Up = 7 days
```

The system calculates:

```text
Next Appointment = Last Visit Date + 7 days
```

Then:

### On appointment date

Automatically send WhatsApp reminder.

### If patient arrives

Assistant clicks:

**Arrived Today**

The system updates the visit information and keeps the patient:

```text
Actively Getting Treated
```

unless the doctor later marks treatment as completed.

### If patient does not arrive

After:

```text
Appointment Date + 2 days
```

the patient should appear in the doctor's missed-follow-up list.

The doctor can then decide whether to send a WhatsApp follow-up message.

---

# 25. Treatment Completed Workflow

When the doctor determines that a patient's treatment is complete, she marks:

```text
Treatment Done = Yes
```

This is a critical event.

The patient's category should then become:

```text
Treatment Done
```

The system should record the treatment completion information.

The system should then make this patient eligible for the Google Review workflow.

---

# 26. Google Review Request

For patients whose treatment is completed, the system should send a WhatsApp message asking them to provide a Google Review.

The review request should be sent approximately:

```text
2–3 days after the patient's last visit / treatment completion.
```

The WhatsApp message should contain the doctor's:

**Google Review Link**

The exact message can be finalized later.

The important workflow is:

```text
Treatment Done
       ↓
Wait 2–3 days
       ↓
Send WhatsApp message
       ↓
Ask patient to rate/review
       ↓
Google Review Link
```

---

# 27. Daily Automated Processing

The application needs a mechanism that runs **every day at a fixed time**.

Each day, the system should query the database and identify patients who require an automated action.

The daily process should identify candidates such as:

### A. Today's follow-up patients

Patients whose next appointment/follow-up date is today.

Action:

```text
Send WhatsApp appointment reminder
```

---

### B. Missed follow-up patients

Patients whose scheduled appointment was:

```text
2 days ago
```

and who did not arrive.

Action:

```text
Add to doctor's missed-follow-up list
```

The doctor then decides whether to send a WhatsApp follow-up message.

---

### C. Missing follow-up patients

Patients in:

```text
Under Process
```

where the doctor forgot to specify a follow-up.

After:

```text
Last Visit + 10 days
```

they should appear in the relevant doctor's list.

---

### D. Treatment-completed patients

Patients whose treatment has been marked:

```text
Treatment Done
```

and whose last visit/treatment completion date was approximately:

```text
2–3 days ago
```

Action:

```text
Send Google Review WhatsApp message
```

---

# 28. Daily Automation Architecture

A daily scheduled process should be implemented.

Possible approaches include:

- Cloudflare Worker
- Supabase scheduled/cron functionality
- Backend scheduled job
- Another reliable server-side scheduler

The final implementation should choose the most appropriate architecture based on reliability, security, maintainability, and cost.

The important requirement is that:

**Every day at a fixed time, a server-side process must query the database and identify patients requiring reminders or other automated actions.**

The process must not depend on the doctor or assistant opening the application.

---

# 29. Important Automation Principle

The automated system must be **database-driven**.

Do not rely on frontend timers or the browser being open.

For example:

```text
Doctor closes application
        ↓
Application is not open
        ↓
Scheduled backend process still runs
        ↓
Database is checked
        ↓
Required WhatsApp actions are triggered
```

---

# 30. Suggested High-Level Database Concepts

The implementation should separate:

### Patient-level information

Information that belongs to the patient permanently, such as:

- Patient ID
- Name
- Age
- Mobile number
- Concern/problem
- Current treatment category
- Last visit date/time

### Visit-level information

Information that belongs to a particular visit, such as:

- Visit ID
- Patient ID
- Visit date
- Token number
- Visit status
- Follow-up selection
- Next follow-up date
- Treatment done status for that visit
- Other relevant visit information

This separation is important because the same patient can visit the clinic multiple times.

For example:

```text
Patient
   ├── Visit 1
   ├── Visit 2
   ├── Visit 3
   ├── Visit 4
   └── Visit 5
```

The implementation should avoid storing every visit as an overwrite of the patient's single record.

Historical visit information must remain available.

---

# 31. Data Integrity Requirements

The system must ensure:

1. A patient should not accidentally be created multiple times because of repeated searches/submissions.
2. Mobile number should be treated as an important patient identifier.
3. Token numbers should be unique per date.
4. A patient should only have one "Arrived Today" action per day.
5. Historical visits must never be overwritten.
6. Treatment status changes must be traceable.
7. Follow-up dates must be calculated consistently.
8. Automated WhatsApp messages must not be sent repeatedly for the same event.
9. The same Google Review request must not accidentally be sent multiple times.
10. Scheduled jobs must be idempotent wherever possible.

---

# 32. Important Automation Safety / Duplicate Prevention

The automation system must keep track of whether an automated action has already been performed.

For example:

```text
Appointment reminder for Patient X on October 10
```

must not be sent again if the daily scheduled job runs twice.

Similarly:

```text
Google Review request for Patient X
```

must not be sent repeatedly.

The system should therefore maintain appropriate message/action tracking.

Possible states can include:

```text
Pending
Sent
Failed
Skipped
```

The exact database implementation can be decided during development.

---

# 33. End-to-End Example

The complete system should support a flow similar to the following.

### Day 1

Assistant adds:

```text
Name: Patient A
Age: 35
Mobile: XXXXXXXX
Concern: Example concern
```

System creates:

```text
Category = Under Process
Token = 1
Visit Date = Day 1
```

Doctor sees Patient A in the Day 1 table.

Doctor selects:

```text
Follow Up = 5 days
Treatment Done = No
```

System calculates:

```text
Next Follow-Up = Day 6
```

---

### Day 6 — Morning

Daily automation runs.

System finds Patient A:

```text
Next Follow-Up = Today
```

System sends WhatsApp reminder.

---

### Day 6 — Patient Arrives

Assistant:

```text
Existing Patient
↓
Search Mobile Number
↓
Patient A found
↓
Arrived Today
```

System:

```text
Last Visit = Day 6
Category = Actively Getting Treated
Token = New token for Day 6
```

The doctor sees Patient A in the Day 6 patient list.

Doctor selects:

```text
Follow Up = 7 days
Treatment Done = No
```

System calculates:

```text
Next Follow-Up = Day 13
```

---

### Day 13 — Morning

System sends another WhatsApp appointment reminder.

---

### Day 13 — Patient Does Not Arrive

No "Arrived Today" action occurs.

Two days later:

```text
Day 15
```

the system identifies Patient A as a missed follow-up.

Patient A appears in the doctor's missed-follow-up list.

Doctor can choose:

```text
Leave Patient
```

or:

```text
Send WhatsApp Follow-Up
```

---

### Later — Patient Returns

The assistant searches Patient A and clicks:

```text
Arrived Today
```

The system records the visit.

The patient remains:

```text
Actively Getting Treated
```

Doctor again specifies the next follow-up.

---

### Final Visit

Eventually, the doctor determines:

```text
Treatment Done = Yes
```

The patient category becomes:

```text
Treatment Done
```

---

### 2–3 Days Later

The daily automation finds the patient as eligible for a review request.

The system sends a WhatsApp message containing:

```text
Google Review Link
```

The patient can then leave a Google Review.

---

# 34. Implementation Order

The Copilot agent should implement the project in the following order.

## Phase 1 — Project Foundation

1. Set up the application structure.
2. Configure the frontend.
3. Configure Supabase.
4. Configure environment variables.
5. Configure Supabase authentication.
6. Create the basic application layout.
7. Implement the Supabase-style visual theme.
8. Implement the sidebar.

Sidebar:

```text
New Patient
Existing Patient
Dashboard
```

---

# Phase 2 — Database Architecture

Design and create the database schema.

At minimum, the architecture should support:

```text
Users
Patients
Visits
Follow-Ups
Automated Messages / Notification Logs
```

The exact table structure should be designed carefully before implementing the frontend workflows.

Important database requirements:

- Proper primary keys
- Foreign keys
- Appropriate indexes
- Mobile-number lookup
- Date-based visit queries
- Token uniqueness per date
- Treatment status
- Follow-up date
- Message/action tracking
- Timestamps
- Appropriate constraints

---

# Phase 3 — Authentication

Implement:

```text
Login
Logout
Session persistence
Protected application routes
```

All three users should see the same UI after authentication.

---

# Phase 4 — New Patient Module

Implement:

```text
New Patient
    ↓
Patient Form
    ↓
Validation
    ↓
Create Patient
    ↓
Create Today's Visit
    ↓
Assign Today's Token
    ↓
Category = Under Process
    ↓
Display in Today's Dashboard
```

---

# Phase 5 — Existing Patient Module

Implement:

```text
Existing Patient
    ↓
Search
    ↓
Display Patient
    ↓
Arrived Today
```

Implement the complete:

**Arrived Today**

logic.

Ensure the button becomes disabled only for that date and becomes available again on the next date.

---

# Phase 6 — Dashboard

Implement:

### Summary cards

- Lifetime patients
- Lifetime treatment done
- Lifetime actively treated
- Monthly patients
- Monthly treatment done
- Monthly actively treated
- Today's patients

### Date cards

Today's date first, followed by previous dates.

### Daily patient table

With:

- Token/S.NO.
- Patient Name
- Age
- Issue/Concern
- Status
- Follow Up
- Treatment Done

---

# Phase 7 — Doctor Actions

Implement:

### Follow-Up Dropdown

```text
1–15 days
```

When selected:

```text
next_follow_up_date = last_visit_date + selected_days
```

---

### Treatment Done

Implement the treatment completion action.

When selected:

```text
Treatment Done = Yes
```

the patient's category must become:

```text
Treatment Done
```

and the patient should become eligible for the review workflow.

---

# Phase 8 — WhatsApp Integration

Choose and integrate the WhatsApp API provider.

Potential provider:

```text
WATI
```

or another suitable WhatsApp API platform.

Implement:

1. API credentials/configuration.
2. Message templates.
3. Sending service.
4. Error handling.
5. Message status tracking.
6. Duplicate prevention.
7. Logging.

Do not hard-code API credentials.

Use environment variables/secrets.

---

# Phase 9 — Daily Scheduled Automation

Implement a reliable server-side scheduled process.

Every day it should:

1. Find today's follow-up patients.
2. Send appointment reminders.
3. Find patients whose follow-up was missed by 2 days.
4. Add them to the doctor's missed-follow-up list.
5. Find Under Process patients with no follow-up after 10 days.
6. Add them to the doctor's relevant list.
7. Find Treatment Done patients eligible for a review request after 2–3 days.
8. Send the Google Review WhatsApp message.
9. Record every automated action.
10. Prevent duplicate messages.

---

# Phase 10 — Doctor Missed-Follow-Up Workflow

Create a UI section where the doctor can see patients who:

```text
Missed their scheduled follow-up by 2 days
```

and patients who:

```text
Have no follow-up configured and reached the 10-day fallback
```

For each patient, provide an appropriate action such as:

```text
Send WhatsApp Follow-Up
```

or:

```text
Leave Patient
```

The exact UI placement can be finalized during implementation while preserving this functionality.

---

# Phase 11 — Google Review Workflow

Implement:

```text
Treatment Done
        ↓
Wait 2–3 days
        ↓
Daily automation identifies patient
        ↓
Send WhatsApp message
        ↓
Google Review Link
```

Track the message so that the same review request is not accidentally sent multiple times.

---

# Phase 12 — Testing

The Copilot agent should test the complete system end-to-end.

Testing must cover at least:

### Authentication

- Login
- Logout
- Protected routes
- Session persistence

### New Patient

- Valid patient creation
- Invalid data
- Duplicate patient handling
- Token assignment

### Existing Patient

- Search by mobile
- Patient not found
- Patient found
- Arrived Today
- Duplicate Arrived Today prevention
- Next-day button re-enabling

### Categories

- New → Under Process
- Under Process → Actively Getting Treated
- Actively Getting Treated → Actively Getting Treated
- Treatment Done

### Follow-Up

- 1-day follow-up
- 5-day follow-up
- 15-day follow-up
- Missing follow-up
- 10-day fallback

### Daily Automation

- Today's reminder
- Missed appointment +2 days
- Missing follow-up +10 days
- Treatment Done +2–3 days
- Duplicate execution prevention
- Failed WhatsApp message handling

### Dashboard

- Lifetime statistics
- Monthly statistics
- Today's statistics
- Daily patient tables
- Historical dates
- Token numbers

---

# 13. Final Expected Architecture

The final system should conceptually work like this:

```text
                    ┌─────────────────────┐
                    │   Authentication    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Dashboard      │
                    │                     │
                    │ New Patient         │
                    │ Existing Patient    │
                    │ Dashboard           │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼──────────────────┐
             │                 │                  │
             ▼                 ▼                  ▼
      ┌────────────┐    ┌──────────────┐   ┌─────────────┐
      │ New Patient│    │Existing      │   │ Dashboard   │
      │            │    │Patient       │   │             │
      └─────┬──────┘    └──────┬───────┘   └──────┬──────┘
            │                   │                  │
            ▼                   ▼                  ▼
      Create Patient       Search Patient    Date Cards
            │                   │                  │
            ▼                   ▼                  ▼
      Under Process        Arrived Today       Daily Table
                                │                  │
                                ▼                  ▼
                     Actively Getting       Doctor Actions
                         Treated             │
                                │            ├── Follow Up
                                │            └── Treatment Done
                                │
                                ▼
                         Treatment Done
                                │
                                ▼
                       Google Review Flow
```

Alongside the application:

```text
                ┌────────────────────────┐
                │ Daily Scheduled Job    │
                └────────────┬───────────┘
                             │
             ┌───────────────┼────────────────┐
             │               │                │
             ▼               ▼                ▼
       Today's Follow-Up  Missed +2 Days   Treatment Done
             │               │                │
             ▼               ▼                ▼
       WhatsApp Reminder  Doctor List     Review Request
                                             │
                                             ▼
                                      Google Review Link
```

---

# 14. Critical Development Rules for the Copilot Agent

The implementation agent must follow these rules throughout development:

1. **Do not change the business logic described in this specification without first asking for confirmation.**

2. **Do not simplify away the patient visit history.**
   
   A patient can have multiple visits and those visits must remain historically available.

3. **Do not rely on frontend/browser timers for critical automation.**

4. **Automated WhatsApp actions must be server-side and reliable.**

5. **Prevent duplicate WhatsApp messages.**

6. **Prevent duplicate daily "Arrived Today" actions.**

7. **Token numbers are unique per day, not globally.**

8. **The same patient can have multiple visit records.**

9. **The patient category and individual visit status must be handled carefully so historical data is not lost.**

10. **Treatment Done is a critical business event because it triggers the Google Review workflow.**

11. **Follow-up dates must be calculated from the appropriate visit date.**

12. **A missing follow-up must trigger the 10-day fallback workflow.**

13. **Missed follow-ups must be identified at +2 days.**

14. **Google Review requests should be triggered approximately 2–3 days after treatment completion/last visit.**

15. **All API keys and secrets must remain outside the frontend code.**

16. **Database access must be secured using appropriate Supabase authentication and Row Level Security policies.**

17. **The three authenticated users should see the same UI.**

18. **The UI should remain simple, clean, white/green, and Supabase-inspired.**

19. **Do not build unnecessary features that are not required by this specification.**

20. **Implement and test the system incrementally rather than attempting the entire application in one step.**

21. **After completing each major phase, verify that the existing functionality still works before moving to the next phase.**

22. **Before implementing the WhatsApp integration, first complete and test the patient tracking system independently.**

23. **Before deploying scheduled automation, test the automation logic using safe/test modes so that real patients do not accidentally receive messages during development.**

24. **Use clear separation between patient data, visit data, follow-up/appointment data, and automated message/action history wherever appropriate.**

25. **The final implementation should be production-oriented, maintainable, secure, and easy for a developer to debug later.**

---

# 15. Final Goal

The final application should provide a complete workflow where:

```text
Assistant adds patient
        ↓
Patient receives treatment
        ↓
Doctor enters follow-up
        ↓
System calculates next appointment
        ↓
Patient automatically receives WhatsApp reminder
        ↓
Patient arrives
        ↓
Assistant clicks Arrived Today
        ↓
Visit is recorded
        ↓
Patient treatment status is updated
        ↓
Doctor enters next follow-up
        ↓
Cycle repeats
        ↓
Doctor marks Treatment Done
        ↓
System waits 2–3 days
        ↓
Patient receives WhatsApp Google Review request
        ↓
Patient leaves Google Review
```

At the same time, if a patient does not arrive:

```text
Scheduled Follow-Up
        ↓
Patient does not arrive
        ↓
+2 days
        ↓
Patient appears in Doctor's missed-follow-up list
        ↓
Doctor decides:
        ├── Leave Patient
        └── Send WhatsApp Follow-Up
```

And if the doctor forgets to enter a follow-up:

```text
Under Process
        ↓
No Follow-Up Entered
        ↓
+10 days from last visit
        ↓
Patient appears in Doctor's fallback list
```

The system should therefore function as a **patient tracking + follow-up management + automated WhatsApp reminder + treatment completion + Google Review request system**, while keeping the actual day-to-day operation extremely simple for the doctor's assistant and doctor.