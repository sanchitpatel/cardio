import { supabase } from '../utils/supabase';

/**
 * ==========================================================================
 * CLINIC DATABASE SERVICE (PostgreSQL Integration)
 * High-performance, type-safe database API layer with error resilience.
 * ==========================================================================
 */

/**
 * Fallback: Direct database insert if RPC is unavailable or encounters an error
 */
async function directRegisterPatientFallback({ name, age, mobile, concern, problem_details = '' }) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Calculate next patient_id_code
    const { data: codeData } = await supabase
      .from('patients')
      .select('patient_id_code')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: codeDataByCode } = await supabase
      .from('patients')
      .select('patient_id_code')
      .order('patient_id_code', { ascending: false })
      .limit(20);

    let maxNum = 1000;
    const scanCodes = (list) => {
      if (!list) return;
      list.forEach((row) => {
        if (row.patient_id_code && row.patient_id_code.startsWith('PM-')) {
          const num = parseInt(row.patient_id_code.replace('PM-', ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
    };
    scanCodes(codeData);
    scanCodes(codeDataByCode);
    const nextPatientCode = `PM-${maxNum + 1}`;

    // 2. Insert into patients table
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .insert({
        patient_id_code: nextPatientCode,
        name: name.trim(),
        age: Number(age),
        mobile: mobile.trim(),
        concern: concern.trim(),
        problem_details: (problem_details || '').trim(),
        current_category: 'under_process',
        last_visit_at: today
      })
      .select()
      .single();

    if (patientErr) throw patientErr;

    // 3. Calculate today's next token number
    const { data: visitsToday } = await supabase
      .from('visits')
      .select('token_number')
      .eq('visit_date', today)
      .order('token_number', { ascending: false })
      .limit(1);

    const nextToken = (visitsToday && visitsToday.length > 0 && visitsToday[0].token_number)
      ? visitsToday[0].token_number + 1
      : 1;

    // 4. Insert into visits table
    const { data: visit, error: visitErr } = await supabase
      .from('visits')
      .insert({
        patient_id: patient.id,
        visit_date: today,
        token_number: nextToken,
        visit_type: 'new_patient',
        is_checked: false,
        is_treatment_done: false
      })
      .select()
      .single();

    if (visitErr) throw visitErr;

    return {
      success: true,
      data: {
        success: true,
        patient_id: patient.id,
        patient_id_code: nextPatientCode,
        token_number: nextToken,
        visit_id: visit.id,
        name: patient.name,
        message: `Patient registered successfully with Daily Token #${nextToken}`
      }
    };
  } catch (fallbackErr) {
    console.error('Fallback direct registration failed:', fallbackErr);
    return {
      success: false,
      error: fallbackErr.message || 'Failed to register patient in database'
    };
  }
}

/**
 * 1. Register a new patient and atomically generate today's daily token
 */
export async function registerNewPatient({ name, age, mobile, concern, problem_details = '' }) {
  try {
    const { data, error } = await supabase.rpc('register_new_patient', {
      p_name: name.trim(),
      p_age: Number(age),
      p_mobile: mobile.trim(),
      p_concern: concern.trim(),
      p_problem_details: (problem_details || '').trim()
    });

    if (error) {
      console.warn('RPC register_new_patient error, trying direct fallback:', error.message);
      return await directRegisterPatientFallback({ name, age, mobile, concern, problem_details });
    }

    if (data && data.success === false) {
      console.warn('RPC returned success: false, trying direct fallback:', data.error);
      return await directRegisterPatientFallback({ name, age, mobile, concern, problem_details });
    }

    return { success: true, data };
  } catch (error) {
    console.warn('registerNewPatient RPC failed, attempting direct fallback:', error);
    return await directRegisterPatientFallback({ name, age, mobile, concern, problem_details });
  }
}

/**
 * 2. Multi-field search for existing patients with active filters
 */
export async function searchExistingPatients({
  patient_id_code = '',
  mobile = '',
  name = '',
  age = '',
  last_visit_at = ''
} = {}) {
  try {
    let query = supabase
      .from('patients')
      .select(`
        id,
        patient_id_code,
        name,
        age,
        mobile,
        concern,
        problem_details,
        current_category,
        last_visit_at,
        created_at,
        visits (
          id,
          visit_date,
          token_number,
          visit_type,
          follow_up_days,
          next_follow_up_date,
          is_treatment_done,
          is_checked
        )
      `)
      .order('last_visit_at', { ascending: false });

    // Compound dynamic filters
    if (patient_id_code.trim()) {
      query = query.ilike('patient_id_code', `%${patient_id_code.trim()}%`);
    }

    if (mobile.trim()) {
      query = query.like('mobile', `%${mobile.trim()}%`);
    }

    if (name.trim()) {
      query = query.ilike('name', `%${name.trim()}%`);
    }

    if (age.trim()) {
      query = query.eq('age', Number(age.trim()));
    }

    if (last_visit_at) {
      query = query.eq('last_visit_at', last_visit_at);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in searchExistingPatients:', error);
    return { success: false, error: error.message || 'Failed to search patients', data: [] };
  }
}

/**
 * 3. Check-in an existing patient for today ("Arrived Today" Action)
 */
export async function checkinExistingPatient(patientId) {
  try {
    const { data, error } = await supabase.rpc('checkin_existing_patient', {
      p_patient_id: patientId
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error in checkinExistingPatient:', error);
    return { success: false, error: error.message || 'Failed to check-in patient' };
  }
}

/**
 * 4. Fetch Lifetime, Monthly, and Today's Overview Statistics
 */
export async function fetchDashboardMetrics() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const monthKey = todayStr.slice(0, 7);

    // Fetch all patients count and status
    const { data: allPatients, error: pError } = await supabase
      .from('patients')
      .select('id, current_category, last_visit_at');

    if (pError) throw pError;

    // Fetch today's visits
    const { data: todayVisits, error: vError } = await supabase
      .from('visits')
      .select('id, token_number, patient_id, visit_date, is_treatment_done, is_checked')
      .eq('visit_date', todayStr)
      .order('token_number', { ascending: true });

    if (vError) throw vError;

    // Lifetime aggregation
    const lifetime = {
      total: allPatients.length,
      done: allPatients.filter((p) => p.current_category === 'treatment_done').length,
      active: allPatients.filter((p) => p.current_category === 'actively_treated').length,
      underProcess: allPatients.filter((p) => p.current_category === 'under_process').length
    };

    // Monthly aggregation
    const monthPatients = allPatients.filter((p) => p.last_visit_at?.startsWith(monthKey));
    const thisMonth = {
      total: monthPatients.length,
      done: monthPatients.filter((p) => p.current_category === 'treatment_done').length,
      active: monthPatients.filter((p) => p.current_category === 'actively_treated').length,
      underProcess: monthPatients.filter((p) => p.current_category === 'under_process').length
    };

    // Today's queue
    const today = {
      count: todayVisits.length,
      maxToken: todayVisits.reduce((max, v) => Math.max(max, v.token_number || 0), 0),
      visits: todayVisits || []
    };

    return {
      success: true,
      data: { lifetime, thisMonth, today }
    };
  } catch (error) {
    console.error('Error in fetchDashboardMetrics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 5. Fetch consultation dates for a specific month
 */
export async function fetchMonthDateRecords(monthKey) {
  try {
    const [year, month] = monthKey.split('-');
    const startDate = `${monthKey}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('visits')
      .select(`
        id,
        visit_date,
        token_number,
        is_treatment_done,
        patient:patients (
          id,
          name,
          current_category
        )
      `)
      .gte('visit_date', startDate)
      .lte('visit_date', endDate)
      .order('visit_date', { ascending: false });

    if (error) throw error;

    // Group by visit_date
    const grouped = {};
    (data || []).forEach((visit) => {
      const dateKey = visit.visit_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          dateKey,
          total: 0,
          done: 0,
          active: 0,
          visits: []
        };
      }
      grouped[dateKey].total += 1;
      if (visit.is_treatment_done || visit.patient?.current_category === 'treatment_done') {
        grouped[dateKey].done += 1;
      } else {
        grouped[dateKey].active += 1;
      }
      grouped[dateKey].visits.push(visit);
    });

    const records = Object.values(grouped)
      .map((rec) => {
        const dateObj = new Date(rec.dateKey + 'T00:00:00');
        return {
          ...rec,
          formattedDate: dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' })
        };
      })
      .sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));

    return { success: true, data: records };
  } catch (error) {
    console.error('Error in fetchMonthDateRecords:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * 5b. Fetch available consultation months from visits history
 */
export async function fetchAvailableMonths() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = todayStr.slice(0, 7);
    const { data, error } = await supabase
      .from('visits')
      .select('visit_date')
      .order('visit_date', { ascending: false });

    if (error) throw error;

    const monthsSet = new Set();
    monthsSet.add(currentMonth);
    (data || []).forEach((row) => {
      if (row.visit_date && row.visit_date.length >= 7) {
        monthsSet.add(row.visit_date.slice(0, 7));
      }
    });

    return { success: true, data: Array.from(monthsSet).sort().reverse() };
  } catch (err) {
    console.error('Error fetching available months:', err);
    return { success: false, data: [new Date().toISOString().split('T')[0].slice(0, 7)] };
  }
}

/**
 * 6. Fetch all patient consultations for a single date
 */
export async function fetchPatientsForDate(dateStr) {
  try {
    const { data, error } = await supabase
      .from('visits')
      .select(`
        id,
        visit_date,
        token_number,
        visit_type,
        follow_up_days,
        next_follow_up_date,
        is_treatment_done,
        is_checked,
        notes,
        patient:patients (
          id,
          patient_id_code,
          name,
          age,
          mobile,
          concern,
          problem_details,
          current_category,
          last_visit_at
        )
      `)
      .eq('visit_date', dateStr)
      .order('token_number', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in fetchPatientsForDate:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * 7. Update Follow-up Days for a Visit
 */
export async function updateVisitFollowUp(visitId, days) {
  try {
    const { data, error } = await supabase.rpc('update_patient_visit_followup', {
      p_visit_id: visitId,
      p_follow_up_days: Number(days)
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error in updateVisitFollowUp:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 8. Toggle Treatment Done for a Visit
 */
export async function toggleVisitTreatmentDone(visitId, isDone) {
  try {
    const { data, error } = await supabase.rpc('toggle_treatment_done', {
      p_visit_id: visitId,
      p_is_done: Boolean(isDone)
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error in toggleVisitTreatmentDone:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 9. Toggle Checked Status for a Visit
 */
export async function toggleVisitChecked(visitId, isChecked) {
  try {
    const { data, error } = await supabase.rpc('toggle_patient_checked', {
      p_visit_id: visitId,
      p_is_checked: Boolean(isChecked)
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error in toggleVisitChecked:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 10. Subscribe to Realtime Updates (Cross-device instant sync)
 */
export function subscribeToClinicRealtime(onUpdate) {
  const channelId = `clinic_realtime_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'visits' },
      (payload) => {
        if (onUpdate) onUpdate({ table: 'visits', payload });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'patients' },
      (payload) => {
        if (onUpdate) onUpdate({ table: 'patients', payload });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'whatsapp_logs' },
      (payload) => {
        if (onUpdate) onUpdate({ table: 'whatsapp_logs', payload });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 11. WhatsApp Message Templates Generator
 */
export function buildNotificationMessage(type, patientName, scheduledDate, extra = {}) {
  const cleanName = (patientName || 'Patient').trim();
  const dateFormatted = scheduledDate
    ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : 'today';

  if (type === 'google_review') {
    return `Namaste ${cleanName} ji,

We are very glad that your treatment has been successfully completed at dHealth!

Your feedback helps us continue providing the highest standard of care to our patients. Could you please take 30 seconds to share your experience on Google?

🌟 Leave your review here:
https://g.page/r/dr-pragya-mishra/review

Wishing you wonderful health and wellness always!
— Dr. Pragya Mishra Clinic (Bareilly)
📞 +91 8006 460 900`;
  }

  if (type === 'missed_followup') {
    return `Namaste ${cleanName} ji,

We noticed that your scheduled follow-up consultation on ${dateFormatted} at Dr. Pragya Mishra Clinic was missed.

Your recovery and post-treatment progress are very important to us. Please visit us during clinic hours or call us if you'd like to reschedule.

— Dr. Pragya Mishra Clinic (Bareilly)
📞 +91 8006 460 900`;
  }

  // Default: appointment_reminder
  return `Namaste ${cleanName} ji,

This is a gentle reminder from Dr. Pragya Mishra Clinic that your scheduled follow-up consultation is on ${dateFormatted}.

Please visit during clinic hours to review your recovery progress. If you need any assistance, feel free to reply to this message.

— Dr. Pragya Mishra Clinic (Bareilly)
📞 +91 8006 460 900`;
}

/**
 * 12. Synchronize Dynamic Notification Queues into whatsapp_logs
 * Filters strictly to doctor-authorized items:
 *   a) Treatment Done -> Enqueues google_review ONLY AFTER 2 days have passed
 *   b) Missed Follow-ups -> Patients with reminder scheduled in past who never visited (no "Arrived Today" check-in)
 */
export async function syncNotificationQueues() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Treatment Done visits -> Google Review requests (AFTER 2 days have passed)
    const { data: doneVisits } = await supabase
      .from('visits')
      .select('id, patient_id, visit_date, is_treatment_done')
      .eq('is_treatment_done', true);

    if (doneVisits && doneVisits.length > 0) {
      for (const v of doneVisits) {
        if (!v.visit_date) continue;
        const vDate = new Date(v.visit_date + 'T00:00:00');
        vDate.setDate(vDate.getDate() + 2);
        const eligibleDate = vDate.toISOString().split('T')[0];

        // Counting/scheduling is only activated after 2 days have passed
        if (todayStr >= eligibleDate) {
          await supabase
            .from('whatsapp_logs')
            .upsert(
              {
                patient_id: v.patient_id,
                visit_id: v.id,
                message_type: 'google_review',
                scheduled_for: eligibleDate,
                status: 'pending'
              },
              {
                onConflict: 'patient_id,message_type,scheduled_for',
                ignoreDuplicates: true
              }
            );
        }
      }
    }

    // 2. Scheduled follow-ups past due -> Check if patient was ever marked "Arrived Today"
    const { data: followUpVisits } = await supabase
      .from('visits')
      .select('id, patient_id, next_follow_up_date, visit_date')
      .not('next_follow_up_date', 'is', null)
      .lt('next_follow_up_date', todayStr);

    if (followUpVisits && followUpVisits.length > 0) {
      const patientIds = [...new Set(followUpVisits.map((v) => v.patient_id))];

      // Fetch all visits for these patients to check if they arrived on or after next_follow_up_date
      const { data: allPatientVisits } = await supabase
        .from('visits')
        .select('patient_id, visit_date')
        .in('patient_id', patientIds);

      for (const v of followUpVisits) {
        const nextDate = v.next_follow_up_date;

        // Has patient arrived / visited on or after the scheduled follow-up date?
        const hasArrived = (allPatientVisits || []).some(
          (pv) => pv.patient_id === v.patient_id && pv.visit_date >= nextDate
        );

        if (!hasArrived) {
          // Patient never visited: queue for doctor's permission to follow up
          await supabase
            .from('whatsapp_logs')
            .upsert(
              {
                patient_id: v.patient_id,
                visit_id: v.id,
                message_type: 'missed_followup',
                scheduled_for: nextDate,
                status: 'pending'
              },
              {
                onConflict: 'patient_id,message_type,scheduled_for',
                ignoreDuplicates: true
              }
            );
        } else {
          // If patient arrived later, resolve any pending missed_followup
          await supabase
            .from('whatsapp_logs')
            .update({ status: 'skipped', metadata: { resolved: 'patient_arrived' } })
            .eq('visit_id', v.id)
            .eq('message_type', 'missed_followup')
            .eq('status', 'pending');
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error syncing notification queues:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 13. Fetch Notification Queue from whatsapp_logs
 */
export async function fetchNotificationQueue() {
  try {
    // Run background sync first
    await syncNotificationQueues();

    const { data, error } = await supabase
      .from('whatsapp_logs')
      .select(`
        id,
        patient_id,
        visit_id,
        message_type,
        scheduled_for,
        status,
        sent_at,
        error_message,
        metadata,
        created_at,
        patient:patients (
          id,
          patient_id_code,
          name,
          mobile,
          age,
          concern,
          problem_details,
          last_visit_at,
          current_category
        ),
        visit:visits (
          id,
          visit_date,
          token_number,
          follow_up_days,
          next_follow_up_date,
          is_treatment_done
        )
      `)
      .in('message_type', ['google_review', 'missed_followup'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error fetching notification queue:', err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * 14. Update Single Notification Status (e.g. 'sent' or 'skipped')
 */
export async function updateNotificationStatus(logId, newStatus, errorMessage = null) {
  try {
    const updatePayload = {
      status: newStatus,
      error_message: errorMessage
    };
    if (newStatus === 'sent') {
      updatePayload.sent_at = new Date().toISOString();
    } else if (newStatus === 'pending') {
      updatePayload.sent_at = null;
    }

    const { data, error } = await supabase
      .from('whatsapp_logs')
      .update(updatePayload)
      .eq('id', logId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error in updateNotificationStatus:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 15. Bulk Update Notification Statuses
 */
export async function bulkUpdateNotificationStatus(logIds, newStatus) {
  try {
    const updatePayload = {
      status: newStatus
    };
    if (newStatus === 'sent') {
      updatePayload.sent_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('whatsapp_logs')
      .update(updatePayload)
      .in('id', logIds);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error in bulkUpdateNotificationStatus:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 16. Get Pending Notification Count for Navigation Badge
 * Sum of pending Review Requests and pending Missed Follow-ups
 */
export async function getPendingNotificationCount() {
  try {
    const { count, error } = await supabase
      .from('whatsapp_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .in('message_type', ['google_review', 'missed_followup']);

    if (error) throw error;
    return { success: true, count: count || 0 };
  } catch (err) {
    return { success: false, count: 0 };
  }
}
