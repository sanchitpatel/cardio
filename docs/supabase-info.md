# production url's 
Public website:
https://drpragyamishra.com

Dashboard:
https://dashboard.drpragyamishra.com



### 1. Automatically expose new tables

Suppose later we create:

```
patients
appointments
settings
```

If this is **ON**, Supabase automatically makes those tables available through its API.

So:

```
Your React app
      ↓
Supabase API
      ↓
patients table
```

The problem is that we want to decide **exactly who can access each table and what they can do**.

So we'll keep it **OFF** and explicitly configure access.

---

### 2. Automatic RLS

**RLS = Row Level Security.**

Think of it as a security guard sitting in front of every database table.

For example, imagine:

```
patients
--------------------------------
id | doctor_id | patient_name
1  | doctor-A  | Rahul
2  | doctor-B  | Priya
```

With RLS, we can say:

> Doctor A can only see rows where `doctor_id = doctor-A`.
> 

So even if someone somehow sends a database request manually, Supabase says:

```
"You're authenticated, but you're not allowed to see this row."
```

**Automatic RLS** simply means Supabase automatically turns RLS on for newly created tables.

We're keeping that **OFF** because we'll explicitly decide the security rules ourselves as we create each table.

### In one sentence

**Automatically expose tables = "Should new tables automatically be available through the API?"**

**Automatic RLS = "Should Supabase automatically turn on row-level security for new tables?"**

We'll manually control both because this is a dashboard containing potentially sensitive patient/doctor data.

---

```
STEP 1  ✅ Create Supabase project
STEP 2  → Configure Auth
STEP 3  → Install Supabase in your project
STEP 4  → Create dashboard app/routes
STEP 5  → Build Login page
STEP 6  → Connect Login → Supabase Auth
STEP 7  → Create protected dashboard
STEP 8  → Test logout/session handling
STEP 9  → Configure dashboard.yourdomain.com
STEP 10 → Configure production Auth redirects
STEP 11 → Design database
STEP 12 → Enable/configure RLS
STEP 13 → Add application/business logic
STEP 14 → Add Edge Functions only where genuinely needed
```
---