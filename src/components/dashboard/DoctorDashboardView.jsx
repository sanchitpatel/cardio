import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  SquaresFour,
  UsersThree,
  CalendarBlank,
  HourglassHigh,
  ClockAfternoon,
  CheckCircle,
  Ticket,
  CaretLeft,
  CaretRight,
  Eye,
  ArrowLeft,
  ArrowRight,
  DeviceMobile,
  User,
  MagnifyingGlass,
  X,
  Stethoscope,
  Check,
  UserList,
  CircleNotch,
  ArrowClockwise,
  WarningCircle
} from '@phosphor-icons/react';
import {
  fetchDashboardMetrics,
  fetchMonthDateRecords,
  fetchAvailableMonths,
  fetchPatientsForDate,
  updateVisitFollowUp,
  toggleVisitTreatmentDone,
  toggleVisitChecked,
  checkinExistingPatient,
  subscribeToClinicRealtime
} from '../../services/clinicService';

// Standard clinical follow-up intervals in days (0 indicates no follow-up needed / treatment done)
const FOLLOW_UP_INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 18, 20, 24, 30];

export const DoctorDashboardView = ({
  selectedDate: propSelectedDate,
  onSelectDate: propOnSelectDate
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Current Date & Month Keys
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthKey = useMemo(() => todayDateStr.slice(0, 7), [todayDateStr]);
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, []);

  // 2. Metrics & Date Records State (Live from Database)
  const [metrics, setMetrics] = useState({
    lifetime: { total: 0, done: 0, active: 0, underProcess: 0 },
    thisMonth: { total: 0, done: 0, active: 0, underProcess: 0 },
    today: { count: 0, maxToken: 0, visits: [] }
  });
  const [availableMonths, setAvailableMonths] = useState([currentMonthKey]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [monthDateRecords, setMonthDateRecords] = useState([]);

  // Loading & Error States
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingMonthRecords, setLoadingMonthRecords] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  // 3. Selected Date State (null = Dashboard Overview; dateKey = Date Patient Table)
  const [internalSelectedDate, setInternalSelectedDate] = useState(null);
  const selectedDate = propSelectedDate !== undefined ? propSelectedDate : internalSelectedDate;
  const setSelectedDate = propOnSelectDate || setInternalSelectedDate;
  const [dateVisits, setDateVisits] = useState([]);
  const [loadingDateVisits, setLoadingDateVisits] = useState(false);
  const [dateVisitsError, setDateVisitsError] = useState(null);

  // 4. Modals & Notifications
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [confirmingPatient, setConfirmingPatient] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // 5. Search Filter Fields
  const [searchFilters, setSearchFilters] = useState({
    token_no: '',
    status: '',
    name: '',
    age: '',
    checked_status: ''
  });

  // Map of patients checked in today: { [patientId]: { tokenNumber, visitId, isChecked, isTreatmentDone } }
  const todayCheckins = useMemo(() => {
    const map = {};
    (metrics.today?.visits || []).forEach((v) => {
      map[v.patient_id] = {
        tokenNumber: v.token_number,
        visitId: v.id,
        isChecked: v.is_checked,
        isTreatmentDone: v.is_treatment_done
      };
    });
    return map;
  }, [metrics.today?.visits]);

  // Daily token counter based on live today's queue
  const dailyTokenCounter = useMemo(() => {
    return metrics.today?.maxToken || metrics.today?.count || 0;
  }, [metrics.today]);

  // -------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------
  const loadMetricsAndMonths = useCallback(async (isSilent = false) => {
    const silent = typeof isSilent === 'boolean' ? isSilent : false;
    if (!silent) {
      setLoadingMetrics(true);
      setDashboardError(null);
    }
    try {
      const minDelay = silent ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));
      const [mRes, monthsRes] = await Promise.all([
        fetchDashboardMetrics(),
        fetchAvailableMonths(),
        minDelay
      ]);

      if (mRes.success && mRes.data) {
        setMetrics(mRes.data);
      } else if (mRes.error && !silent) {
        setDashboardError('Unable to load dashboard records. Please check your internet connection and try again.');
      }

      if (monthsRes.success && monthsRes.data?.length > 0) {
        setAvailableMonths(monthsRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      if (!silent) {
        setDashboardError('Unable to connect to the clinic records. Please check your internet connection and try again.');
      }
    } finally {
      if (!silent) setLoadingMetrics(false);
    }
  }, []);

  const loadMonthRecords = useCallback(async (monthKey, isSilent = false) => {
    const silent = typeof isSilent === 'boolean' ? isSilent : false;
    if (!silent) setLoadingMonthRecords(true);
    try {
      const minDelay = silent ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));
      const [res] = await Promise.all([fetchMonthDateRecords(monthKey), minDelay]);
      if (res.success && res.data) {
        setMonthDateRecords(res.data);
      }
    } catch (err) {
      console.error('Failed to load month records:', err);
    } finally {
      if (!silent) setLoadingMonthRecords(false);
    }
  }, []);

  const loadDateVisits = useCallback(async (dateKey, isSilent = false) => {
    const silent = typeof isSilent === 'boolean' ? isSilent : false;
    if (!silent) {
      setLoadingDateVisits(true);
      setDateVisitsError(null);
    }
    try {
      const minDelay = silent ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));
      const [res] = await Promise.all([fetchPatientsForDate(dateKey), minDelay]);
      if (res.success && res.data) {
        // Flatten nested patient data for table display
        const flattened = res.data.map((visit) => ({
          visit_id: visit.id,
          token_number: visit.token_number,
          visit_type: visit.visit_type,
          follow_up_days: visit.follow_up_days ?? 0,
          next_follow_up_date: visit.next_follow_up_date,
          is_treatment_done: Boolean(visit.is_treatment_done),
          is_checked: Boolean(visit.is_checked),
          visit_date: visit.visit_date,
          notes: visit.notes || '',
          // Patient Demographic & Clinical Info
          id: visit.patient?.id || visit.patient_id,
          patient_id_code: visit.patient?.patient_id_code || 'PM-XXXX',
          name: visit.patient?.name || 'Unknown Patient',
          age: visit.patient?.age ?? 0,
          mobile: visit.patient?.mobile || '',
          concern: visit.patient?.concern || '',
          problem_details: visit.patient?.problem_details || '',
          current_category: visit.patient?.current_category || 'under_process',
          last_visit_at: visit.patient?.last_visit_at || visit.visit_date,
          entry_type: visit.visit_type,
          is_new_patient: visit.visit_type === 'new_patient'
        }));
        setDateVisits(flattened);
      } else if (!silent) {
        setDateVisitsError('Unable to load consultation records for this date. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load date visits:', err);
      if (!silent) {
        setDateVisitsError('Unable to load consultation records for this date. Please try again.');
      }
    } finally {
      if (!silent) setLoadingDateVisits(false);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    loadMetricsAndMonths();
  }, [loadMetricsAndMonths]);

  // Load Month Records whenever selectedMonth changes
  useEffect(() => {
    if (selectedMonth) {
      loadMonthRecords(selectedMonth);
    }
  }, [selectedMonth, loadMonthRecords]);

  // Load Date Visits when a date is selected
  useEffect(() => {
    if (selectedDate) {
      setDateVisits([]);
      loadDateVisits(selectedDate);
    } else {
      setDateVisits([]);
    }
  }, [selectedDate, loadDateVisits]);

  // Real-time Database Subscription for Cross-device synchronization
  useEffect(() => {
    const unsubscribe = subscribeToClinicRealtime(() => {
      // Refresh metrics silently in background without re-fetching or reloading the active table
      loadMetricsAndMonths(true);
      if (selectedMonth) {
        loadMonthRecords(selectedMonth, true);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedMonth, loadMetricsAndMonths, loadMonthRecords]);

  // -------------------------------------------------------------
  // Filter Handlers
  // -------------------------------------------------------------
  const handleTokenNoChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setSearchFilters((prev) => ({ ...prev, token_no: digitsOnly }));
  };

  const handleStatusFilterToggle = (statusVal) => {
    setSearchFilters((prev) => ({
      ...prev,
      status: prev.status === statusVal ? '' : statusVal
    }));
  };

  const handleCheckedStatusFilterToggle = (statusVal) => {
    setSearchFilters((prev) => ({
      ...prev,
      checked_status: prev.checked_status === statusVal ? '' : statusVal
    }));
  };

  const handleNameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');
    if (val.length <= 50) {
      setSearchFilters((prev) => ({ ...prev, name: val }));
    }
  };

  const handleAgeChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 3);
    if (digitsOnly === '' || Number(digitsOnly) <= 120) {
      setSearchFilters((prev) => ({ ...prev, age: digitsOnly }));
    }
  };

  const handleClearFilters = () => {
    setSearchFilters({
      token_no: '',
      status: '',
      name: '',
      age: '',
      checked_status: ''
    });
  };

  const isAnyFilterActive = Object.values(searchFilters).some((val) => val.trim() !== '');

  // Month navigation
  const currentMonthIndex = availableMonths.indexOf(selectedMonth);
  const hasNewerMonth = currentMonthIndex > 0;
  const hasOlderMonth = currentMonthIndex !== -1 && currentMonthIndex < availableMonths.length - 1;

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonth) return currentMonthName;
    const [y, mon] = selectedMonth.split('-');
    const date = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [selectedMonth, currentMonthName]);

  const handlePrevMonth = () => {
    if (hasOlderMonth) {
      setSelectedMonth(availableMonths[currentMonthIndex + 1]);
    }
  };

  const handleNextMonth = () => {
    if (hasNewerMonth) {
      setSelectedMonth(availableMonths[currentMonthIndex - 1]);
    }
  };

  // Grouped Historical Date Records (Excludes today if viewing current month)
  const historicalDateRecords = useMemo(() => {
    return monthDateRecords.filter((record) => {
      if (selectedMonth === currentMonthKey && record.dateKey === todayDateStr) {
        return false;
      }
      return true;
    });
  }, [monthDateRecords, selectedMonth, currentMonthKey, todayDateStr]);

  // Selected Date Info for Table Header
  const selectedDateInfo = useMemo(() => {
    if (!selectedDate) return null;
    const dateObj = new Date(selectedDate + 'T00:00:00');
    return {
      formatted: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      weekday: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
      isToday: selectedDate === todayDateStr
    };
  }, [selectedDate, todayDateStr]);

  const isPastDate = useMemo(() => {
    if (!selectedDate) return false;
    return selectedDate < todayDateStr;
  }, [selectedDate, todayDateStr]);

  // Dynamic Patient Filter for the Selected Date
  const filteredPatients = useMemo(() => {
    if (!selectedDate) return [];
    return dateVisits.filter((patient) => {
      const patientToken = patient.token_number ? String(patient.token_number) : '';
      const tokenQuery = searchFilters.token_no.trim();
      const matchToken = !tokenQuery || patientToken === tokenQuery;

      const isNewPatient = patient.entry_type === 'new_patient' || Boolean(patient.is_new_patient);
      let matchStatus = true;
      if (searchFilters.status === 'new') {
        matchStatus = isNewPatient;
      } else if (searchFilters.status === 'existing') {
        matchStatus = !isNewPatient;
      }

      const matchName =
        !searchFilters.name.trim() ||
        patient.name.toLowerCase().includes(searchFilters.name.trim().toLowerCase());

      const matchAge =
        !searchFilters.age.trim() ||
        String(patient.age) === searchFilters.age.trim();

      const isChecked = Boolean(patient.is_checked);
      let matchChecked = true;
      if (searchFilters.checked_status === 'checked') {
        matchChecked = isChecked;
      } else if (searchFilters.checked_status === 'not_checked') {
        matchChecked = !isChecked;
      }

      return matchToken && matchStatus && matchName && matchAge && matchChecked;
    });
  }, [dateVisits, searchFilters, selectedDate]);

  // Navigation Handlers
  const handleOpenDateTable = (dateKey) => {
    setSelectedDate(dateKey);
    handleClearFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDashboard = () => {
    setSelectedDate(null);
    handleClearFilters();
  };

  // -------------------------------------------------------------
  // Live Database Action Handlers
  // -------------------------------------------------------------
  const handleAdjustFollowUp = async (patient, direction) => {
    if (isPastDate) return;
    const currentDays = patient.follow_up_days ?? 0;
    let currentIndex = FOLLOW_UP_INTERVALS.indexOf(currentDays);
    if (currentIndex === -1) {
      currentIndex = FOLLOW_UP_INTERVALS.reduce(
        (closestIdx, val, idx) =>
          Math.abs(val - currentDays) < Math.abs(FOLLOW_UP_INTERVALS[closestIdx] - currentDays)
            ? idx
            : closestIdx,
        0
      );
    }
    const newIndex = Math.max(0, Math.min(FOLLOW_UP_INTERVALS.length - 1, currentIndex + direction));
    const newDays = FOLLOW_UP_INTERVALS[newIndex];
    if (newDays === currentDays) return;

    // Optimistic UI update
    setDateVisits((prev) =>
      prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, follow_up_days: newDays } : p))
    );

    const res = await updateVisitFollowUp(patient.visit_id, newDays);
    if (!res.success) {
      // Revert on error
      setDateVisits((prev) =>
        prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, follow_up_days: currentDays } : p))
      );
      setToastNotification({
        type: 'error',
        title: 'Update Failed',
        message: res.error || 'Failed to update follow-up interval'
      });
    }
  };

  const handleToggleTreatmentDone = async (patient) => {
    if (isPastDate) return;
    const newStatus = !patient.is_treatment_done;

    // Optimistic UI update
    setDateVisits((prev) =>
      prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, is_treatment_done: newStatus } : p))
    );

    const res = await toggleVisitTreatmentDone(patient.visit_id, newStatus);
    if (res.success) {
      // Refresh metrics silently in background without UI flash
      loadMetricsAndMonths(true);
      if (selectedMonth) {
        loadMonthRecords(selectedMonth, true);
      }
    } else {
      // Revert on error
      setDateVisits((prev) =>
        prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, is_treatment_done: !newStatus } : p))
      );
      setToastNotification({
        type: 'error',
        title: 'Update Failed',
        message: res.error || 'Failed to update treatment status'
      });
    }
  };

  const handleToggleChecked = async (patient) => {
    if (isPastDate) return;
    const newStatus = !patient.is_checked;

    // Optimistic UI update
    setDateVisits((prev) =>
      prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, is_checked: newStatus } : p))
    );

    const res = await toggleVisitChecked(patient.visit_id, newStatus);
    if (!res.success) {
      // Revert on error
      setDateVisits((prev) =>
        prev.map((p) => (p.visit_id === patient.visit_id ? { ...p, is_checked: !newStatus } : p))
      );
      setToastNotification({
        type: 'error',
        title: 'Update Failed',
        message: res.error || 'Failed to update checked status'
      });
    }
  };

  const handleConfirmArrival = async (patient) => {
    if (!patient || todayCheckins[patient.id]) return;

    try {
      const res = await checkinExistingPatient(patient.id);
      if (res.success) {
        // Refresh live datasets silently in background
        await loadMetricsAndMonths(true);
        if (selectedMonth) {
          await loadMonthRecords(selectedMonth, true);
        }
        if (selectedDate === todayDateStr) {
          await loadDateVisits(todayDateStr, true);
        }

        setConfirmingPatient(null);
        setSelectedPatient(null);

        setToastNotification({
          type: 'success',
          patientName: patient.name,
          patientCode: patient.patient_id_code,
          tokenNumber: res.data?.token_number || (dailyTokenCounter + 1)
        });
      } else {
        setToastNotification({
          type: 'error',
          title: 'Check-in Failed',
          message: res.error || 'Unable to check in patient'
        });
      }
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'Check-in Error',
        message: err.message || 'Unexpected check-in error'
      });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-10">
      {/* Toast Notification via Portal */}
      {mounted && toastNotification && createPortal(
        <div className="fixed bottom-6 right-6 z-[1000] max-w-md bg-[#e6ebf2] border border-white/80 rounded-2xl p-4 shadow-[6px_6px_16px_#c2c9d4,-6px_-6px_16px_#ffffff] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              toastNotification.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-700'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700'
            }`}>
              {toastNotification.type === 'error' ? (
                <WarningCircle size={20} weight="bold" />
              ) : (
                <Check size={20} weight="bold" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900">
                {toastNotification.type === 'error'
                  ? (toastNotification.title || 'Action Failed')
                  : `Check-in Confirmed: Token #${toastNotification.tokenNumber}`}
              </h4>
              <p className="text-[11px] text-zinc-500">
                {toastNotification.type === 'error'
                  ? toastNotification.message
                  : `${toastNotification.patientName} (${toastNotification.patientCode}) checked in today.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg"
            title="Dismiss notification"
          >
            <X size={16} weight="bold" />
          </button>
        </div>,
        document.body
      )}

      {selectedDate === null ? (
        /* ========================================================
           VIEW 1: DASHBOARD OVERVIEW & DATE CARDS
           ======================================================== */
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-5 sm:pb-6 border-b border-zinc-300/60">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5 sm:gap-3">
                <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#e6ebf2] shadow-[4px_4px_8px_#c2c9d4,-4px_-4px_8px_#ffffff] border border-white/70 flex items-center justify-center text-emerald-700 shrink-0">
                  <SquaresFour size={26} className="sm:hidden" weight="duotone" />
                  <SquaresFour size={30} className="hidden sm:block" weight="duotone" />
                </span>
                <span>Dashboard & Daily Queue</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1 sm:mt-0.5 ml-[50px] sm:ml-14">
                Overview of today's visits, daily queues, and patient records.
              </p>
            </div>

            {/* Mobile-only Refresh Button (compact, same line as heading) */}
            <button
              type="button"
              onClick={() => {
                loadMetricsAndMonths();
                if (selectedMonth) loadMonthRecords(selectedMonth);
              }}
              disabled={loadingMetrics || loadingMonthRecords}
              className="sm:hidden w-8 h-8 rounded-xl bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[inset_0_2px_4px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.25)] hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_-2px_4px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer mt-1"
              title="Refresh dashboard metrics"
            >
              <ArrowClockwise
                size={14}
                weight="bold"
                className={loadingMetrics || loadingMonthRecords ? 'animate-spin text-emerald-700' : ''}
              />
            </button>

            {/* Desktop-only Refresh Button */}
            <div className="hidden sm:flex items-center gap-2 self-center">
              <button
                type="button"
                onClick={() => {
                  loadMetricsAndMonths();
                  if (selectedMonth) loadMonthRecords(selectedMonth);
                }}
                disabled={loadingMetrics || loadingMonthRecords}
                className="px-3 py-1.5 rounded-xl bg-[#e6ebf2] text-xs font-bold text-zinc-700 hover:text-emerald-700 shadow-[inset_0_2px_4px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.25)] hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_-2px_4px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                title="Refresh dashboard metrics"
              >
                <ArrowClockwise
                  size={15}
                  weight="bold"
                  className={loadingMetrics || loadingMonthRecords ? 'animate-spin text-emerald-700' : ''}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Error Banner with Inward Neumorphic Shadow */}
          {dashboardError && (
            <div className="bg-[#fceeed] border border-rose-300/70 rounded-2xl p-3.5 sm:p-4 shadow-[inset_3px_3px_6px_#f5c6cb,inset_-3px_-3px_6px_#ffffff] flex items-center justify-between gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[inset_1.5px_1.5px_3px_#f5c6cb,inset_-1.5px_-1.5px_3px_#ffffff] border border-rose-300/50 flex items-center justify-center text-rose-600 shrink-0">
                  <WarningCircle size={18} weight="fill" />
                </div>
                <div>
                  <span className="font-bold text-rose-900 block sm:inline">Notice: </span>
                  <span className="text-rose-800 text-[11px] sm:text-xs">{dashboardError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={loadMetricsAndMonths}
                className="px-3.5 py-1.5 bg-[#e6ebf2] rounded-xl shadow-[2px_2px_4px_#f5c6cb,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#f5c6cb] border border-rose-200 text-xs font-bold text-rose-700 hover:text-rose-900 transition-all cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Summary Cards Grid (Horizontal scroll snap on mobile, 3-col grid on laptop) */}
          <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-4 px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">

            {/* Card 1: Total Patients Visited Lifetime */}
            <div className="w-[56vw] max-w-[235px] sm:max-w-none sm:w-[290px] md:w-auto shrink-0 md:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] md:rounded-[1rem] p-3 sm:p-4 md:p-6 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-1.5 md:space-y-2.5">
              <div className="flex items-center gap-2.5 md:justify-between">
                <div className="order-1 md:order-2 w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] md:shadow-[3px_3px_7px_#c2c9d4,-3px_-3px_7px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <UsersThree size={24} className="md:hidden" weight="duotone" />
                  <UsersThree size={28} className="hidden md:block" weight="duotone" />
                </div>
                <span className="order-2 md:order-1 text-[10px] sm:text-[10.5px] md:text-[11px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                  Patient Visited <strong className="text-zinc-700 font-bold ml-0.5 md:ml-1 text-[10.5px] md:text-[12px]">(Lifetime)</strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 md:block md:mt-0 md:-mt-1">
                <div className="ml-1 sm:ml-0 text-[26px] sm:text-2xl md:text-3xl font-bold text-zinc-800 tracking-tight shrink-0 flex items-center gap-2">
                  {loadingMetrics ? (
                    <CircleNotch size={22} className="animate-spin text-emerald-700" />
                  ) : (
                    metrics.lifetime.total
                  )}
                </div>

                <div className="pt-0 md:pt-3.5 border-t-0 md:border-t md:border-zinc-300/50 flex flex-col md:flex-row md:flex-wrap items-end md:items-center justify-end md:justify-between gap-1 md:gap-2 text-xs text-zinc-600">
                  <span className="flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 text-[9px] sm:text-[9.5px] md:text-[11px] font-medium whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span>Treatment Done:</span>
                    <b className="text-emerald-700 text-[10px] md:text-[12.5px] font-bold ml-0.5">{metrics.lifetime.done}</b>
                  </span>
                  <span className="flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 text-[9px] sm:text-[9.5px] md:text-[11px] font-medium whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Actively Treated:</span>
                    <b className="text-emerald-700 text-[10px] md:text-[12.5px] font-bold ml-0.5">{metrics.lifetime.active}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Patients Visited This Month */}
            <div className="w-[58vw] max-w-[235px] sm:max-w-none sm:w-[290px] md:w-auto shrink-0 md:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] md:rounded-[1rem] p-3 sm:p-4 md:p-6 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-1.5 md:space-y-2.5">
              <div className="flex items-center gap-2.5 md:justify-between">
                <div className="order-1 md:order-2 w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] md:shadow-[3px_3px_7px_#c2c9d4,-3px_-3px_7px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <CalendarBlank size={20} className="md:hidden" weight="duotone" />
                  <CalendarBlank size={26} className="hidden md:block" weight="duotone" />
                </div>
                <span className="order-2 md:order-1 text-[10px] sm:text-[10.5px] md:text-[11px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                  Patient Visited <strong className="text-zinc-700 font-bold ml-0.5 md:ml-1 text-[10.5px] md:text-[12px]">({currentMonthName})</strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 md:block md:mt-0 md:-mt-1">
                <div className="ml-1 sm:ml-0 text-[26px] sm:text-2xl md:text-3xl font-bold text-zinc-800 tracking-tight shrink-0 flex items-center gap-2">
                  {loadingMetrics ? (
                    <CircleNotch size={22} className="animate-spin text-emerald-700" />
                  ) : (
                    metrics.thisMonth.total
                  )}
                </div>

                <div className="pt-0 md:pt-3.5 border-t-0 md:border-t md:border-zinc-300/50 flex flex-col md:flex-row md:flex-wrap items-end md:items-center justify-end md:justify-between gap-1 md:gap-2 text-xs text-zinc-600">
                  <span className="flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 text-[9px] sm:text-[9.5px] md:text-[11px] font-medium whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    <span>Treatment Done:</span>
                    <b className="text-emerald-700 text-[10px] md:text-[12.5px] font-bold ml-0.5">{metrics.thisMonth.done}</b>
                  </span>
                  <span className="flex items-center gap-1 md:gap-1.5 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 text-[9px] sm:text-[9.5px] md:text-[11px] font-medium whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span>Actively Treated:</span>
                    <b className="text-emerald-700 text-[10px] md:text-[12.5px] font-bold ml-0.5">{metrics.thisMonth.active}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Patients Visited Today */}
            <div className="w-[56vw] max-w-[235px] sm:max-w-none sm:w-[290px] md:w-auto shrink-0 md:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] md:rounded-[1rem] p-3 sm:p-4 md:p-6 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-1.5 md:space-y-2.5">
              <div className="flex items-center gap-2.5 md:justify-between">
                <div className="order-1 md:order-2 w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] md:shadow-[3px_3px_7px_#c2c9d4,-3px_-3px_7px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <HourglassHigh size={20} className="md:hidden" weight="duotone" />
                  <HourglassHigh size={28} className="hidden md:block" weight="duotone" />
                </div>
                <span className="order-2 md:order-1 text-[10px] sm:text-[10.5px] md:text-[11px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                  Patient Visited <strong className="text-zinc-700 font-bold ml-0.5 md:ml-1 text-[10.5px] md:text-[12px]">(Today)</strong>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 md:block md:mt-0 md:-mt-1">
                <div className="ml-1 sm:ml-0 text-[26px] sm:text-2xl md:text-3xl font-bold text-zinc-800 tracking-tight shrink-0 flex items-center gap-2">
                  {loadingMetrics ? (
                    <CircleNotch size={22} className="animate-spin text-emerald-700" />
                  ) : (
                    metrics.today.count
                  )}
                </div>

                <div className="pt-0 md:pt-3.5 border-t-0 md:border-t md:border-zinc-300/50 flex flex-col md:flex-row md:flex-wrap items-end md:items-center justify-end md:justify-between gap-1 md:gap-2 text-xs text-zinc-700 font-medium">
                  <span className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] md:text-[12.5px] whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium">Active Queue</span>
                  </span>
                  <span className="px-2 py-0.5 md:px-2.5 md:py-0.5 rounded-full bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-emerald-500/20 text-[9.5px] sm:text-[10px] md:text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap">
                    <Ticket size={12} weight="fill" className="text-emerald-700" />
                    <span>Next Token: #{dailyTokenCounter + 1}</span>
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Date-Based Patient Lists Preview Section */}
          <div className="space-y-5 pt-2">
            <div className="flex items-center">
              <span className="px-3 py-1 text-[11px] font-bold uppercase rounded-full bg-[#e6ebf2] text-zinc-700 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 flex items-center gap-1.5">
                <ClockAfternoon size={15} className="text-emerald-700" weight="bold" />
                Today
              </span>
            </div>

            {/* 1. Today's Active Date Card */}
            <div
              onClick={() => handleOpenDateTable(todayDateStr)}
              className="bg-[#e6ebf2] border border-white/80 rounded-2xl md:rounded-[1.75rem] p-4 sm:p-6 shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c2c9d4] hover:shadow-[inset_4px_4px_10px_#c2c9d4,inset_-4px_-4px_10px_#ffffff] hover:border-white/80 active:scale-[0.99] transition-all duration-200 group cursor-pointer"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between gap-2.5">
                  <h4 className="text-base sm:text-xl font-bold text-zinc-900 tracking-tight group-hover:text-emerald-800 transition-colors">
                    {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </h4>

                  <span className="text-[11px] sm:text-xs text-emerald-800 font-bold bg-[#e6ebf2] px-3 sm:px-3 py-1 sm:py-1 rounded-full shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 inline-flex items-center gap-1.5 shrink-0">
                    <UsersThree size={22} weight="duotone" className="text-emerald-700 sm:w-[22px] sm:h-[22px]" />
                    <span>{metrics.today.count}</span>
                    <span>Patient{metrics.today.count !== 1 ? 's' : ''}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[11px] sm:text-xs text-zinc-500 ml-0.5">
                    Patients visiting today will be assigned daily token numbers sequentially.
                  </p>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-zinc-700 group-hover:text-emerald-700">
                    <span>Open Records</span>
                    <ArrowRight size={13} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Previous Dates (Filtered by Selected Month) */}
            <div className="space-y-4 pt-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  Previous Consultation Dates
                </h4>

                {/* Month Switcher Pill */}
                <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff] border border-white/60">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={!hasOlderMonth}
                    className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-zinc-600 disabled:active:shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <CaretLeft size={13} weight="bold" />
                  </button>

                  <span className="font-mono font-extrabold text-[11px] sm:text-xs text-zinc-800 text-center inline-block tabular-nums select-none whitespace-nowrap px-1">
                    {selectedMonthLabel}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    disabled={!hasNewerMonth}
                    className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-zinc-600 disabled:active:shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <CaretRight size={13} weight="bold" />
                  </button>
                </div>
              </div>

              {loadingMonthRecords ? (
                <div className="bg-[#e6ebf2] border border-white/80 rounded-2xl p-8 text-center shadow-[inset_2px_2px_5px_#c2c9d4,inset_-2px_-2px_5px_#ffffff] flex items-center justify-center gap-2 text-xs text-zinc-500 font-medium">
                  <CircleNotch size={18} className="animate-spin text-emerald-700" />
                  <span>Loading records for {selectedMonthLabel}...</span>
                </div>
              ) : historicalDateRecords.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
                  {historicalDateRecords.map((record) => (
                    <div
                      key={record.dateKey}
                      onClick={() => handleOpenDateTable(record.dateKey)}
                      className="bg-[#e6ebf2] border border-white/80 rounded-2xl p-3 sm:p-4 shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c2c9d4] hover:shadow-[inset_4px_4px_10px_#c2c9d4,inset_-4px_-4px_10px_#ffffff] hover:border-white/80 active:scale-[0.98] transition-all duration-200 flex flex-col justify-between space-y-2 sm:space-y-2.5 group cursor-pointer"
                    >
                      {/* Top: Day Tag & Patient Count */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-bold uppercase rounded-full bg-[#e6ebf2] text-zinc-600 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                          {record.dayName}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-bold text-emerald-800 bg-[#e6ebf2] px-2 py-0.5 rounded-full shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 whitespace-nowrap">
                          <span>{record.total}</span>
                          <span>Patient{record.total !== 1 ? 's' : ''}</span>
                        </span>
                      </div>

                      {/* Middle: Date Title */}
                      <div>
                        <h5 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight truncate group-hover:text-emerald-800 transition-colors">
                          {record.formattedDate}
                        </h5>
                      </div>

                      {/* Bottom: Sub-metrics Breakdown */}
                      <div className="pt-2 border-t border-zinc-300/50 flex items-center justify-between text-[9px] sm:text-[10px] text-zinc-600">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                          <span>Done: <b className="text-emerald-700 font-bold">{record.done}</b></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active: <b className="text-emerald-700 font-bold">{record.active}</b></span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#e6ebf2] border border-white/80 rounded-2xl p-6 text-center shadow-[inset_2px_2px_5px_#c2c9d4,inset_-2px_-2px_5px_#ffffff]">
                  <p className="text-xs text-zinc-500 font-medium">
                    No consultation dates recorded for {selectedMonthLabel}.
                  </p>
                </div>
              )}
            </div>

          </div>
        </>
      ) : (
        /* ========================================================
           VIEW 2: DATE RECORDS & SEARCH TABLE
           ======================================================== */
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {/* Header & Back Navigation */}
          <div className="flex flex-row items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-zinc-300/60">
            <div className="min-w-0 sm:space-y-2">
              <div className="hidden sm:block">
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="px-2.5 py-1 rounded-xl bg-[#e6ebf2] text-[11px] font-bold text-zinc-600 hover:text-emerald-800 shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c5ccd6] active:scale-95 border border-white/80 transition-all inline-flex items-center gap-1.5 cursor-pointer mb-1"
                  title="Back to Dashboard Overview"
                >
                  <ArrowLeft size={14} weight="bold" />
                  <span>Back to Dashboard</span>
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2 truncate">
                <span className="truncate">{selectedDateInfo?.formatted}</span>
                <span className="hidden md:inline-block text-[12px] font-semibold px-3 rounded-full bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                  {filteredPatients.length} Records
                </span>
                {selectedDateInfo?.isToday ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e6ebf2] text-emerald-800 border border-emerald-500/30 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] leading-tight">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Today
                  </span>
                ) : isPastDate ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e6ebf2] text-zinc-600 border border-zinc-300 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] leading-tight select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    Past Record (Inactive)
                  </span>
                ) : null}
              </h2>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Consultation records for <strong>{selectedDateInfo?.weekday}, {selectedDateInfo?.formatted}</strong>.
              </p>
            </div>

            {/* Token Summary & Refresh */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadDateVisits(selectedDate, false)}
                disabled={loadingDateVisits}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#e6ebf2] text-xs font-bold text-zinc-700 hover:text-emerald-700 shadow-[inset_0_2px_4px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.25)] hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_-2px_4px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Refresh visits for this date"
              >
                <ArrowClockwise size={15} weight="bold" className={loadingDateVisits ? 'animate-spin text-emerald-700' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 bg-[#e6ebf2] px-3.5 py-1.5 rounded-2xl shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6]">
                <Ticket size={20} weight="duotone" className="text-emerald-700" />
                <span>Next Token: <strong className="text-emerald-700 font-bold">#{dailyTokenCounter + 1}</strong></span>
              </div>
            </div>
          </div>

          {/* Date Visits Error with Inward Neumorphic Shadow */}
          {dateVisitsError && (
            <div className="bg-[#fceeed] border border-rose-300/70 rounded-2xl p-3.5 sm:p-4 shadow-[inset_3px_3px_6px_#f5c6cb,inset_-3px_-3px_6px_#ffffff] flex items-center justify-between gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[inset_1.5px_1.5px_3px_#f5c6cb,inset_-1.5px_-1.5px_3px_#ffffff] border border-rose-300/50 flex items-center justify-center text-rose-600 shrink-0">
                  <WarningCircle size={18} weight="fill" />
                </div>
                <div>
                  <span className="font-bold text-rose-900 block sm:inline">Notice: </span>
                  <span className="text-rose-800 text-[11px] sm:text-xs">{dateVisitsError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadDateVisits(selectedDate)}
                className="px-3.5 py-1.5 bg-[#e6ebf2] rounded-xl shadow-[2px_2px_4px_#f5c6cb,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#f5c6cb] border border-rose-200 text-xs font-bold text-rose-700 hover:text-rose-900 transition-all cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* 5-Field Sequential Search Filter Form */}
          <div className="bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] p-5 sm:p-7 shadow-[inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)]">
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
              {/* 1. Token No. */}
              <div className="col-span-1 lg:col-span-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  1. Token No.
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center gap-1.5 pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors select-none">
                    <Ticket size={15} weight="bold" />
                    <span className="font-bold text-[13px] sm:text-[12px] text-zinc-500/80 group-focus-within:text-emerald-600 transition-colors">#</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 1"
                    value={searchFilters.token_no}
                    onChange={handleTokenNoChange}
                    style={{ outline: 'none' }}
                    className="w-full pl-[46px] sm:pl-[48px] pr-2.5 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-2xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>

              {/* 2. Status Filter */}
              <div className="col-span-1 lg:col-span-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  2. Status
                </label>
                <div className="w-full h-[36px] sm:h-[40px] p-1 bg-[#e6ebf2] rounded-2xl shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] relative flex items-center select-none overflow-hidden">
                  {/* Subtle active background track highlight */}
                  <div
                    className={`absolute top-1 bottom-1 rounded-2xl transition-all duration-300 pointer-events-none ${
                      searchFilters.status === 'new'
                        ? 'left-1 w-[calc(50%-4px)] bg-emerald-500/15 border border-emerald-500/30 opacity-100'
                        : searchFilters.status === 'existing'
                        ? 'left-[calc(50%+2px)] w-[calc(50%-4px)] bg-sky-500/15 border border-sky-500/30 opacity-100'
                        : 'opacity-0 scale-95'
                    }`}
                  />

                  {/* Circle Thumb (Inward inset shadow: white on top, black at bottom) */}
                  <div
                    className="absolute top-1.5 bottom-1.5 aspect-square rounded-2xl bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/20 pointer-events-none z-20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      left:
                        searchFilters.status === 'new'
                          ? '5px'
                          : searchFilters.status === 'existing'
                          ? 'calc(100% - 3px)'
                          : '50%',
                      transform:
                        searchFilters.status === 'new'
                          ? 'translateX(0)'
                          : searchFilters.status === 'existing'
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    }}
                  />

                  {/* Left Button: New */}
                  <button
                    type="button"
                    onClick={() => handleStatusFilterToggle('new')}
                    className={`relative z-10 flex-1 h-full rounded-2xl text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer select-none text-center ${
                      searchFilters.status === 'new'
                        ? 'text-emerald-800 font-black pl-4'
                        : 'text-zinc-600 hover:text-zinc-900 active:scale-[0.98]'
                    }`}
                  >
                    <span>New</span>
                  </button>

                  {/* Right Button: Existing */}
                  <button
                    type="button"
                    onClick={() => handleStatusFilterToggle('existing')}
                    className={`relative z-10 flex-1 h-full rounded-2xl text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer select-none text-center ${
                      searchFilters.status === 'existing'
                        ? 'text-sky-800 font-black pr-3.5'
                        : 'text-zinc-600 hover:text-zinc-900 active:scale-[0.98]'
                    }`}
                  >
                    <span>Existing</span>
                  </button>
                </div>
              </div>

              {/* 3. Patient Name */}
              <div className="col-span-1 lg:col-span-3">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  3. Patient Name
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                    <User size={16} weight="bold" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Priya"
                    value={searchFilters.name}
                    onChange={handleNameChange}
                    style={{ outline: 'none' }}
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-2xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>

              {/* 4. Age */}
              <div className="col-span-1 lg:col-span-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  4. Age
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                    <HourglassHigh size={16} weight="bold" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 28"
                    value={searchFilters.age}
                    onChange={handleAgeChange}
                    style={{ outline: 'none' }}
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-2xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>

              {/* 5. Checked Status Filter */}
              <div className="col-span-2 lg:col-span-3">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  5. Checked Status
                </label>
                <div className="w-full h-[36px] sm:h-[40px] p-1 bg-[#e6ebf2] rounded-2xl shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] relative flex items-center select-none overflow-hidden">
                  {/* Subtle active background track highlight */}
                  <div
                    className={`absolute top-1 bottom-1 rounded-2xl transition-all duration-300 pointer-events-none ${
                      searchFilters.checked_status === 'checked'
                        ? 'left-1 w-[calc(50%-4px)] bg-emerald-500/15 border border-emerald-500/30 opacity-100'
                        : searchFilters.checked_status === 'not_checked'
                        ? 'left-[calc(50%+2px)] w-[calc(50%-4px)] bg-rose-500/15 border border-rose-500/30 opacity-100'
                        : 'opacity-0 scale-95'
                    }`}
                  />

                  {/* Circle Thumb (Inward inset shadow: white on top, black at bottom) */}
                  <div
                    className="absolute top-1.5 bottom-1.5 aspect-square rounded-2xl bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/20 pointer-events-none z-20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      left:
                        searchFilters.checked_status === 'checked'
                          ? '6px'
                          : searchFilters.checked_status === 'not_checked'
                          ? 'calc(100% - 4px)'
                          : '50%',
                      transform:
                        searchFilters.checked_status === 'checked'
                          ? 'translateX(0)'
                          : searchFilters.checked_status === 'not_checked'
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                    }}
                  />

                  {/* Left Button: Checked */}
                  <button
                    type="button"
                    onClick={() => handleCheckedStatusFilterToggle('checked')}
                    className={`relative z-10 flex-1 h-full rounded-2xl text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer select-none text-center ${
                      searchFilters.checked_status === 'checked'
                        ? 'text-emerald-800 font-black pl-4'
                        : 'text-zinc-600 hover:text-zinc-900 active:scale-[0.98]'
                    }`}
                  >
                    <span>Checked</span>
                  </button>

                  {/* Right Button: Not Checked */}
                  <button
                    type="button"
                    onClick={() => handleCheckedStatusFilterToggle('not_checked')}
                    className={`relative z-10 flex-1 h-full rounded-2xl text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer select-none text-center ${
                      searchFilters.checked_status === 'not_checked'
                        ? 'text-rose-800 font-black pr-3.5'
                        : 'text-zinc-600 hover:text-zinc-900 active:scale-[0.98]'
                    }`}
                  >
                    <span>Not Checked</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Count Bar & Reset Filter */}
          <div className="mt-4 sm:mt-6 mb-2 sm:mb-2.5 -mx-1 sm:mx-0 px-0 sm:px-3 text-xs text-zinc-500 w-auto sm:w-full flex flex-row items-center justify-between gap-2">
            <div className="flex items-center justify-start">
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer px-3 py-1 rounded-full bg-[#e6ebf2] shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6]"
                >
                  <X size={12} weight="bold" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end font-medium text-zinc-500 text-[11px] sm:text-xs text-right whitespace-nowrap ml-auto">
              <span>
                Showing <strong className="text-emerald-700 font-bold">{filteredPatients.length}</strong> patient record{filteredPatients.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Results Table Section */}
          {loadingDateVisits && dateVisits.length === 0 ? (
            <div className="bg-[#e6ebf2] border border-white/80 rounded-[2rem] p-12 text-center shadow-[6px_6px_16px_#d2d8e2,-6px_-6px_16px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center gap-3">
              <CircleNotch size={32} className="animate-spin text-emerald-700" />
              <p className="text-xs font-bold text-zinc-700">Loading consultation records from database...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            /* Empty State */
            <div className="bg-[#e6ebf2] border border-white/80 rounded-[2rem] p-10 text-center shadow-[6px_6px_16px_#d2d8e2,-6px_-6px_16px_rgba(255,255,255,0.7)]">
              <div className="w-14 h-14 rounded-2xl bg-[#e6ebf2] shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center text-zinc-400 mx-auto mb-3">
                <MagnifyingGlass size={26} weight="duotone" />
              </div>
              <h4 className="text-base font-bold text-zinc-800 mb-1">No Matching Patients Found</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
                No patient records match the search criteria for this date.
              </p>
              {isAnyFilterActive && (
                <button
                  onClick={handleClearFilters}
                  className="px-5 py-2 bg-[#e6ebf2] text-xs font-bold text-emerald-700 rounded-full shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 transition-all cursor-pointer border border-white/70"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            /* DATA TABLE */
            <div className="relative -mx-1.5 sm:mx-0 bg-[#e6ebf2] border border-white/80 rounded-2xl sm:rounded-[1rem] p-0 sm:p-1 sm:pt-0 shadow-[inset_4px_4px_12px_#c8d0db,inset_-4px_-4px_12px_#ffffff] overflow-hidden">
              {/* Centered Refreshing Animation Overlay when manually clicking Refresh on active table */}
              {loadingDateVisits && dateVisits.length > 0 && (
                <div className="absolute inset-0 bg-[#e6ebf2]/70 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-2.5 animate-in fade-in duration-150">
                  <CircleNotch size={32} className="animate-spin text-emerald-700" />
                  <p className="text-xs font-bold text-zinc-700">Refreshing records from database...</p>
                </div>
              )}
              <div className="overflow-x-auto no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <table className="w-full text-left border-collapse table-fixed min-w-[1050px]">
                  <thead>
                    <tr className="bg-[#d5dde8] text-[11px] font-black text-zinc-800 uppercase tracking-wider rounded-none sm:rounded-xl border-b border-zinc-300/80 shadow-[inset_0_1px_2px_#bcc4d0]">
                      <th className="w-[10%] py-3 px-3 rounded-l-xl">Token No.</th>
                      <th className="w-[14%] py-3 px-3">Patient Name</th>
                      <th className="w-[6%] py-3 px-2 text-center">Age</th>
                      <th className="w-[16%] py-3 px-3 text-center">View Details</th>
                      <th className="w-[15%] py-3 px-3 text-center">Status</th>
                      <th className="w-[15%] py-3 px-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 group/info relative cursor-help select-none">
                          <span>Follow Up</span>
                          <span className="w-4 h-4 rounded-full bg-[#e6ebf2] text-zinc-500 group-hover/info:text-emerald-700 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/80 flex items-center justify-center text-[10px] font-sans font-bold italic cursor-help transition-colors">
                            i
                          </span>

                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 hidden group-hover/info:block z-50 w-56 p-2.5 bg-[#e6ebf2] text-zinc-700 text-[11px] normal-case font-medium rounded-2xl shadow-[inset_2.5px_2.5px_6px_#ffffff,inset_-2.5px_-2.5px_6px_#c2c9d4] border border-white/90 pointer-events-none text-center leading-snug animate-in fade-in zoom-in-95 duration-150">
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-[#e6ebf2] border-t border-l border-white/90" />
                            <p className="relative z-10 text-zinc-700 font-medium text-[11px] leading-snug">
                              When the doctor wants the patient to re-visit (i.e, after how many days).
                            </p>
                          </div>
                        </div>
                      </th>
                      <th className="w-[14%] py-3 px-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 group/doneinfo relative cursor-help select-none">
                          <span>Is Treatment Done</span>
                          <span className="w-4 h-4 rounded-full bg-[#e6ebf2] text-zinc-500 group-hover/doneinfo:text-emerald-700 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/80 flex items-center justify-center text-[10px] font-sans font-bold italic cursor-help transition-colors">
                            i
                          </span>

                          <div className="absolute top-full right-0 mt-2.5 hidden group-hover/doneinfo:block z-50 w-56 p-2.5 bg-[#e6ebf2] text-zinc-700 text-[11px] normal-case font-medium rounded-2xl shadow-[inset_2.5px_2.5px_6px_#ffffff,inset_-2.5px_-2.5px_6px_#c2c9d4] border border-white/90 pointer-events-none text-center leading-snug animate-in fade-in zoom-in-95 duration-150">
                            <div className="absolute -top-1.5 right-6 w-3 h-3 rotate-45 bg-[#e6ebf2] border-t border-l border-white/90" />
                            <p className="relative z-10 text-zinc-700 font-medium text-[11px] leading-snug">
                              (i.e, was that visit - patient's last visit, as per doctor)
                            </p>
                          </div>
                        </div>
                      </th>
                      <th className="w-[10%] py-3 px-3 text-center rounded-r-xl">
                        <span>Checked</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 text-xs">
                    {filteredPatients.map((patient) => {
                      return (
                        <tr
                          key={patient.visit_id || patient.id}
                          className="hover:bg-zinc-200/35 transition-colors group"
                        >
                          {/* Token Number */}
                          <td className="py-3 px-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                            <span className="px-2 py-1 text-[14px] rounded-lg bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 inline-flex items-center gap-1 font-bold text-emerald-800">
                              Token #{patient.token_number ?? '-'}
                            </span>
                          </td>

                          {/* Patient Name */}
                          <td className="py-3 px-3 font-bold text-zinc-900 text-[13px] whitespace-nowrap">
                            {patient.name}
                          </td>

                          {/* Age */}
                          <td className="py-3 px-2 text-center font-semibold text-zinc-600 text-[13px] whitespace-nowrap">
                            {patient.age} yrs
                          </td>

                          {/* View Details Button */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setSelectedPatient(patient)}
                                className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer group/dt"
                              >
                                <Eye size={14} weight="bold" className="text-emerald-600 group-hover/dt:scale-110 transition-transform" />
                                <span>View Details</span>
                              </button>
                            </div>
                          </td>

                          {/* Status Pill */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {patient.entry_type === 'new_patient' || patient.is_new_patient ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/30 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] inline-flex items-center justify-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span>New Patient</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#e6ebf2] text-zinc-700 border border-white/70 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] inline-flex items-center justify-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                                <span>Existing Patient</span>
                              </span>
                            )}
                          </td>

                          {/* Follow-up Days Counter */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <div className={`inline-flex items-center justify-center gap-1 ${isPastDate ? 'cursor-not-allowed' : ''}`}>
                              <button
                                type="button"
                                disabled={isPastDate}
                                onClick={() => handleAdjustFollowUp(patient, -1)}
                                title={isPastDate ? 'Past records are inactive' : 'Decrease follow-up days'}
                                className={`w-6 h-6 rounded-lg bg-[#e6ebf2] text-zinc-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] border border-white/70 flex items-center justify-center transition-all select-none ${
                                  isPastDate
                                    ? 'opacity-35 cursor-not-allowed'
                                    : 'hover:text-emerald-700 active:shadow-[inset_1px_1px_2px_#c5ccd6] cursor-pointer active:scale-90'
                                }`}
                              >
                                <CaretLeft size={11} weight="bold" />
                              </button>

                              <span className={`min-w-[64px] px-2 py-0.5 text-[12px] font-bold font-mono text-emerald-800 bg-[#e6ebf2] rounded-lg shadow-[inset_1.5px_1.5px_3px_#c2c9d4,inset_-1.5px_-1.5px_3px_#ffffff] text-center select-none ${isPastDate ? 'cursor-not-allowed opacity-75' : ''}`}>
                                {patient.follow_up_days} Day{patient.follow_up_days !== 1 ? 's' : ''}
                              </span>

                              <button
                                type="button"
                                disabled={isPastDate}
                                onClick={() => handleAdjustFollowUp(patient, 1)}
                                title={isPastDate ? 'Past records are inactive' : 'Increase follow-up days'}
                                className={`w-6 h-6 rounded-lg bg-[#e6ebf2] text-zinc-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] border border-white/70 flex items-center justify-center transition-all select-none ${
                                  isPastDate
                                    ? 'opacity-35 cursor-not-allowed'
                                    : 'hover:text-emerald-700 active:shadow-[inset_1px_1px_2px_#c5ccd6] cursor-pointer active:scale-90'
                                }`}
                              >
                                <CaretRight size={11} weight="bold" />
                              </button>
                            </div>
                          </td>

                          {/* Is Treatment Done Switch */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className={`flex items-center justify-center ${isPastDate ? 'cursor-not-allowed' : ''}`}>
                              <button
                                type="button"
                                role="switch"
                                disabled={isPastDate}
                                aria-checked={Boolean(patient.is_treatment_done)}
                                onClick={() => handleToggleTreatmentDone(patient)}
                                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out border items-center ${
                                  isPastDate ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                                } ${
                                  patient.is_treatment_done
                                    ? 'bg-gradient-to-tr from-emerald-300 to-emerald-700 border-emerald-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]'
                                    : 'bg-gray-300/50 border-gray-400/60 shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff]'
                                }`}
                                title={
                                  isPastDate
                                    ? `Treatment was ${patient.is_treatment_done ? 'Done' : 'Not Done'} (Inactive)`
                                    : patient.is_treatment_done
                                    ? 'Treatment marked as Done'
                                    : 'Mark Treatment as Done'
                                }
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ease-in-out ${
                                    patient.is_treatment_done
                                      ? 'translate-x-[21px] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.3)]'
                                      : 'translate-x-0.5 bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff]'
                                  }`}
                                />
                              </button>
                            </div>
                          </td>

                          {/* Checked Checkbox */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className={`flex items-center justify-center ${isPastDate ? 'cursor-not-allowed' : ''}`}>
                              <button
                                type="button"
                                role="checkbox"
                                disabled={isPastDate}
                                aria-checked={Boolean(patient.is_checked)}
                                onClick={() => handleToggleChecked(patient)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 select-none border ${
                                  isPastDate ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-90'
                                } ${
                                  patient.is_checked
                                    ? 'bg-gradient-to-tr from-emerald-400 to-emerald-700 border-emerald-400 text-white shadow-[0_2px_5px_rgba(16,185,129,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                                    : 'bg-[#e6ebf2] border-gray-400/60 text-transparent shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff] hover:border-emerald-500/40'
                                }`}
                                title={
                                  isPastDate
                                    ? `Patient was ${patient.is_checked ? 'Checked' : 'Not Checked'} (Inactive)`
                                    : patient.is_checked
                                    ? 'Patient Checked Today'
                                    : 'Mark Patient as Checked'
                                }
                              >
                                <Check size={18} weight="bold" className={`transition-transform duration-150 ${patient.is_checked ? 'scale-100 stroke-[3]' : 'scale-75 opacity-0'}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patient Clinical Profile Details Modal via Portal */}
      {mounted && selectedPatient && createPortal(
        <div
          onClick={() => setSelectedPatient(null)}
          className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e6ebf2] border border-white rounded-[1.5rem] sm:rounded-[1.5rem] p-4 sm:p-7 max-w-md sm:max-w-[500px] w-full shadow-[8px_8px_28px_rgba(0,0,0,0.3),inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)] relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-zinc-300/60">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <UserList size={24} weight="duotone" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">Patient Clinical Details</h3>
                  <p className="text-[11px] text-zinc-500">Comprehensive patient history & clinical record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            {/* Scrollable Middle Section: Consultation Form Preview */}
            <div className="flex-1 overflow-y-auto no-scrollbar my-3 sm:my-4 p-2 sm:p-3 bg-[#e6ebf2] rounded-3xl shadow-[inset_3px_3px_6px_#c2c9d4,inset_-3px_-3px_6px_#ffffff] border border-white/70 w-full max-w-[340px] sm:max-w-[400px] mx-auto">
              <div className="relative mx-auto w-full aspect-[1055/1491] bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden select-none border border-zinc-200/80">
                {/* Pre-printed Letterhead Background Template */}
                <img
                  src="/form.png"
                  alt="Doctor Consultation Form"
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Overlaid Data Entries on Designated Pre-Printed Lines */}
                {/* 0. Top Right: Patient ID */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8.5px] sm:text-[10.5px] text-right pointer-events-none"
                  style={{ top: '3.6%', right: '5.2%' }}
                >
                  <span className="text-zinc-500 font-semibold text-[7.5px] sm:text-[9.5px] mr-1">Patient ID:</span>
                  <span className="text-emerald-700 font-extrabold">{selectedPatient.patient_id_code || 'PM-XXXX'}</span>
                </div>

                {/* 1. Date */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8px] sm:text-[10px] text-left"
                  style={{ top: '20.6%', left: '15.5%', maxWidth: '35%' }}
                  title={selectedPatient.last_visit_at}
                >
                  {selectedPatient.last_visit_at || new Date().toISOString().split('T')[0]}
                </div>

                {/* 2. Token No. */}
                <div
                  className="absolute font-bold text-emerald-700 truncate leading-none text-[10px] sm:text-[11px] text-left"
                  style={{ top: '20.4%', left: '68.5%', maxWidth: '24%' }}
                >
                  {todayCheckins[selectedPatient.id]?.tokenNumber
                    ? `#${todayCheckins[selectedPatient.id].tokenNumber}`
                    : '—'}
                </div>

                {/* 3. Patient Name */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none text-[11px] sm:text-[12px] text-left"
                  style={{ top: '23.5%', left: '23.5%', maxWidth: '69%' }}
                  title={selectedPatient.name}
                >
                  {selectedPatient.name}
                </div>

                {/* 4. Age */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8.5px] sm:text-[10px] text-left"
                  style={{ top: '27.5%', left: '15.5%', maxWidth: '24%' }}
                >
                  {selectedPatient.age ? `${selectedPatient.age} Yrs` : '—'}
                </div>

                {/* 5. Mobile No. */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none tracking-tight text-[9px] sm:text-[10.5px] text-left"
                  style={{ top: '27.4%', left: '59.0%', maxWidth: '34%' }}
                >
                  +91 {selectedPatient.mobile}
                </div>

                {/* 6. Concern / Problem */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none text-[9.5px] sm:text-[11px] text-left"
                  style={{ top: '31.0%', left: '29.0%', maxWidth: '64%' }}
                  title={selectedPatient.concern}
                >
                  {selectedPatient.concern || '—'}
                </div>

                {/* 7. Symptoms Details */}
                <div
                  className="absolute font-semibold text-zinc-800 overflow-hidden text-[9.5px] sm:text-[11px] text-left"
                  style={{
                    top: '34.0%',
                    left: '29.0%',
                    width: '64%',
                    height: '13.5%',
                    lineHeight: '1.75',
                  }}
                  title={selectedPatient.problem_details}
                >
                  {selectedPatient.problem_details || '—'}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="shrink-0 flex items-center justify-center gap-2.5 sm:gap-3.5 pt-3 border-t border-zinc-300/50 w-full">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="flex-[0.85] sm:flex-none sm:w-44 py-2.5 rounded-full text-xs font-bold text-zinc-600 hover:text-rose-600 bg-[#e6ebf2] shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 border border-white/80 transition-all duration-150 ease-out flex items-center justify-center cursor-pointer"
              >
                Close
              </button>

              {todayCheckins[selectedPatient.id] ? (
                <button
                  type="button"
                  disabled
                  className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 rounded-full text-xs font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] border border-emerald-500/30 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-95"
                >
                  <CheckCircle size={15} weight="fill" className="text-emerald-600" />
                  <span>Checked-in (Token #{todayCheckins[selectedPatient.id].tokenNumber})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingPatient(selectedPatient);
                  }}
                  className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 group whitespace-nowrap"
                >
                  <span>Arrived Today</span>
                  <ArrowRight size={14} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* "Arrived Today" Confirmation Pop-up Modal via Portal */}
      {mounted && confirmingPatient && createPortal(
        <div
          onClick={() => setConfirmingPatient(null)}
          className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e6ebf2] border border-white/90 rounded-[2rem] p-6 sm:p-7 max-w-lg w-full shadow-[8px_8px_28px_rgba(0,0,0,0.3)] relative animate-in zoom-in-95 duration-200 space-y-4"
          >
            {/* Confirmation Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-300/60">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <Ticket size={24} weight="duotone" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">Confirm Check-in</h3>
                  <p className="text-[11px] text-zinc-500">Add patient to today's doctor queue</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingPatient(null)}
                className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            {/* Patient Info Summary Card */}
            <div className="p-4 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_5px_#c8d0db,inset_-2px_-2px_5px_#ffffff] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-extrabold text-emerald-800 px-2 py-0.5 rounded-md bg-[#e6ebf2] shadow-[1px_1px_2px_#c2c9d4,-1px_-1px_2px_#ffffff] border border-white/80">
                    {confirmingPatient.patient_id_code}
                  </span>
                  <h4 className="text-sm font-bold text-zinc-900">
                    {confirmingPatient.name}
                  </h4>
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {confirmingPatient.age} yrs
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-zinc-300/40">
                <span className="flex items-center gap-1.5 font-sans font-semibold text-[12px] text-zinc-700 tracking-wide">
                  <DeviceMobile size={15} weight="bold" className="text-zinc-500 shrink-0" />
                  <span>{confirmingPatient.mobile && confirmingPatient.mobile.length === 10 ? `${confirmingPatient.mobile.slice(0, 5)} ${confirmingPatient.mobile.slice(5)}` : (confirmingPatient.mobile || 'No contact')}</span>
                </span>
                <span className="truncate max-w-[170px] text-[12px] font-medium text-zinc-600" title={confirmingPatient.concern}>
                  {confirmingPatient.concern}
                </span>
              </div>

              {/* Next Token To Be Assigned */}
              <div className="flex items-center justify-between pt-8 border-t border-zinc-300/50">
                <span className="text-xs font-semibold text-zinc-700">Assigning Token Today:</span>
                <span className="px-3 py-1 bg-emerald-200/20 text-emerald-800 font-extrabold text-xs rounded-full border border-emerald-400/40 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] flex items-center gap-1.5">
                  <Ticket size={14} weight="fill" className="text-emerald-700" />
                  Daily Token #{dailyTokenCounter + 1}
                </span>
              </div>
            </div>

            <p className="text-[11.5px] text-zinc-500 px-1 leading-snug">
              Confirming will generate <strong>Token #{dailyTokenCounter + 1}</strong> for Today & update their last visit date to today.
            </p>

            {/* Confirmation Actions */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 pt-4 border-t border-zinc-300/50 w-full">
              <button
                type="button"
                onClick={() => setConfirmingPatient(null)}
                className="flex-[0.85] sm:flex-none sm:w-44 py-2.5 rounded-full text-xs font-bold text-zinc-600 hover:text-rose-600 bg-[#e6ebf2] shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 border border-white/80 transition-all duration-150 ease-out flex items-center justify-center cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmArrival(confirmingPatient)}
                className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 group whitespace-nowrap"
              >
                <CheckCircle size={16} weight="bold" className="group-hover:scale-110 transition-transform" />
                <span>Confirm Check-in</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
