import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserList,
  MagnifyingGlass,
  CheckCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Hash,
  Phone,
  User,
  HourglassHigh,
  CalendarBlank,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  CaretDown,
  FirstAid,
  X,
  Check,
  Ticket,
  Eye,
  FileText,
  Stethoscope,
  Users,
  Sparkle,
  Globe,
  DeviceMobile,
  CircleNotch,
  WarningCircle,
  ArrowClockwise
} from '@phosphor-icons/react';
import { searchExistingPatients, checkinExistingPatient, subscribeToClinicRealtime } from '../../services/clinicService';
import { supabase } from '../../utils/supabase';

// Live clinical database integration

// Helper to construct month metadata object dynamically
const formatMonthMeta = (key) => {
  if (!key || key.length < 7) return null;
  const [yearStr, monthStr] = key.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum)) return null;
  const date = new Date(year, monthNum - 1, 1);
  const name = date.toLocaleDateString('en-US', { month: 'long' });
  const shortName = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return { monthNum, key, name, year, shortName };
};

export const ExistingPatientView = ({
  selectedMonth: propSelectedMonth,
  onSelectMonth: propOnSelectMonth
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Current date & month keys (computed dynamically)
  const currentMonthKey = useMemo(() => new Date().toISOString().split('T')[0].slice(0, 7), []);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Navigation & Monthly Cards Selection State (null = show Monthly Cards grid)
  const [internalSelectedMonth, setInternalSelectedMonth] = useState(null);
  const selectedMonth = propSelectedMonth !== undefined ? propSelectedMonth : internalSelectedMonth;
  const setSelectedMonth = propOnSelectMonth || setInternalSelectedMonth;
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // 1. Search filter fields sequence as per architecture plan
  const [searchFilters, setSearchFilters] = useState({
    patient_id: '',
    mobile: '',
    name: '',
    age: '',
    last_visit_date: ''
  });

  // Live patient records list state
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Daily token generation state (synced with visits table)
  const [dailyTokenCounter, setDailyTokenCounter] = useState(0);

  // Map of patients checked in today: { [patientId]: { tokenNumber: number, checkedInAt: string } }
  const [todayCheckins, setTodayCheckins] = useState({});
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Function to load all patients and today's visits
  const loadPatientsData = async (isSilent = false) => {
    const silent = typeof isSilent === 'boolean' ? isSilent : false;
    try {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      const todayStr = new Date().toISOString().split('T')[0];

      // Smooth perceptible rotation delay (min 600ms) on manual user refresh
      const minDelay = silent ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));

      // 1. Fetch real patients from database
      const [res] = await Promise.all([searchExistingPatients(), minDelay]);
      if (!res.success) {
        throw new Error(res.error || 'Failed to load clinical records from the database');
      }
      setPatients(res.data || []);

      // 2. Fetch today's visits to track today's queue & tokens
      const { data: todayVisits, error: vErr } = await supabase
        .from('visits')
        .select('id, token_number, patient_id, visit_date, created_at')
        .eq('visit_date', todayStr);

      const checkinsMap = {};
      let maxToken = 0;
      if (todayVisits && todayVisits.length > 0) {
        todayVisits.forEach((v) => {
          checkinsMap[v.patient_id] = {
            tokenNumber: v.token_number,
            checkedInAt: v.created_at
              ? new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Today'
          };
          if (v.token_number > maxToken) maxToken = v.token_number;
        });
      }
      setTodayCheckins(checkinsMap);
      setDailyTokenCounter(maxToken);
    } catch (err) {
      console.error('Error loading existing patients:', err);
      if (!isSilent) {
        setLoadError('Unable to load patient records. Please check your internet connection and try again.');
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPatientsData();

    // Realtime subscription for cross-device live sync
    const unsubscribe = subscribeToClinicRealtime(() => {
      loadPatientsData(true);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Feedback notification state
  const [toastNotification, setToastNotification] = useState(null);

  // Selected patient for View Details Pop-up Modal
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Selected patient for "Arrived Today" Confirmation Pop-up Modal
  const [confirmingPatient, setConfirmingPatient] = useState(null);

  // Custom Calendar State
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const [viewDate, setViewDate] = useState(() => {
    return searchFilters.last_visit_date
      ? new Date(searchFilters.last_visit_date + 'T00:00:00')
      : new Date(2026, 9, 1); // Oct 2026 default
  });

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
    };
    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [calendarOpen]);

  const currentMonthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleFilterChange = (key, val) => {
    setSearchFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleSelectDay = (day) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${d}`;
    handleFilterChange('last_visit_date', dateStr);
    setCalendarOpen(false);
  };

  const handleSelectToday = (e) => {
    e.stopPropagation();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${d}`;
    handleFilterChange('last_visit_date', dateStr);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setCalendarOpen(false);
  };

  const handleClearDate = (e) => {
    e.stopPropagation();
    setSearchFilters((prev) => ({ ...prev, last_visit_date: '' }));
  };

  // 1. Patient ID: Digits only with fixed PM- prefix, max 6 digits
  const handlePatientIdChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setSearchFilters((prev) => ({ ...prev, patient_id: digitsOnly }));
  };

  // 2. Mobile (WhatsApp): Digits only, max 10 digits (matches NewPatientView)
  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setSearchFilters((prev) => ({ ...prev, mobile: digitsOnly }));
  };

  // 3. Patient Name: Alphabets and spaces only, max 50 chars (matches NewPatientView)
  const handleNameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');
    if (val.length <= 50) {
      setSearchFilters((prev) => ({ ...prev, name: val }));
    }
  };

  // 4. Age: Numbers only, max 3 digits, realistic age (1-120) (matches NewPatientView)
  const handleAgeChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 3);
    if (digitsOnly === '' || Number(digitsOnly) <= 120) {
      setSearchFilters((prev) => ({ ...prev, age: digitsOnly }));
    }
  };

  const handleClearFilters = () => {
    setSearchFilters({
      patient_id: '',
      mobile: '',
      name: '',
      age: '',
      last_visit_date: ''
    });
  };

  const isAnyFilterActive = Object.values(searchFilters).some((val) => val.trim() !== '');

  // Dynamically extract only months that have patient records in the database
  const dynamicMonthsList = useMemo(() => {
    const monthsMap = new Map();

    // Add only months that actually have patient records in the database
    patients.forEach((p) => {
      if (p.last_visit_at && p.last_visit_at.length >= 7) {
        const key = p.last_visit_at.slice(0, 7);
        if (!monthsMap.has(key)) {
          const meta = formatMonthMeta(key);
          if (meta) monthsMap.set(key, meta);
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [patients]);

  // Compute monthly statistics from patient dataset
  const monthlyStats = useMemo(() => {
    const map = {};
    dynamicMonthsList.forEach((m) => {
      map[m.key] = {
        total: 0,
        active: 0,
        underProcess: 0,
        done: 0,
        latestDate: null
      };
    });

    patients.forEach((p) => {
      if (!p.last_visit_at) return;
      const monthKey = p.last_visit_at.slice(0, 7);
      if (map[monthKey]) {
        map[monthKey].total += 1;
        if (p.current_category === 'actively_treated') map[monthKey].active += 1;
        if (p.current_category === 'under_process') map[monthKey].underProcess += 1;
        if (p.current_category === 'treatment_done') map[monthKey].done += 1;
        if (!map[monthKey].latestDate || p.last_visit_at > map[monthKey].latestDate) {
          map[monthKey].latestDate = p.last_visit_at;
        }
      }
    });

    return map;
  }, [patients, dynamicMonthsList]);

  const monthsForSelectedYear = useMemo(() => {
    return dynamicMonthsList.filter((m) => m.year === selectedYear);
  }, [dynamicMonthsList, selectedYear]);

  const selectedMonthInfo = useMemo(() => {
    if (!selectedMonth) return null;
    if (selectedMonth === 'all') {
      return { name: 'All Records', year: '', shortName: 'ALL', key: 'all' };
    }
    const found = dynamicMonthsList.find((m) => m.key === selectedMonth);
    return found || formatMonthMeta(selectedMonth) || {
      name: selectedMonth,
      year: '',
      shortName: selectedMonth,
      key: selectedMonth
    };
  }, [selectedMonth, dynamicMonthsList]);

  // Dynamic real-time compound search filter
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      // 1. Month constraint (if selectedMonth is set and not 'all')
      if (selectedMonth && selectedMonth !== 'all') {
        if (!patient.last_visit_at.startsWith(selectedMonth)) {
          return false;
        }
      }

      const matchId =
        !searchFilters.patient_id.trim() ||
        patient.patient_id_code.toLowerCase().includes(searchFilters.patient_id.trim().toLowerCase());

      const matchMobile =
        !searchFilters.mobile.trim() ||
        patient.mobile.includes(searchFilters.mobile.trim());

      const matchName =
        !searchFilters.name.trim() ||
        patient.name.toLowerCase().includes(searchFilters.name.trim().toLowerCase());

      const matchAge =
        !searchFilters.age.trim() ||
        patient.age.toString() === searchFilters.age.trim();

      const matchDate =
        !searchFilters.last_visit_date.trim() ||
        patient.last_visit_at === searchFilters.last_visit_date.trim();

      return matchId && matchMobile && matchName && matchAge && matchDate;
    });
  }, [patients, searchFilters, selectedMonth]);

  // Pagination State (20 records per page)
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-reset pagination to page 1 whenever filters or selected month change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilters, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredPatients.length);

  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice(startIndex, endIndex);
  }, [filteredPatients, startIndex, endIndex]);

  const handleSelectMonthCard = (monthKey) => {
    setSelectedMonth(monthKey);
    // Auto-set calendar view month
    if (monthKey !== 'all') {
      const [y, m] = monthKey.split('-');
      setViewDate(new Date(parseInt(y), parseInt(m) - 1, 1));
    }
  };

  const handleBackToMonths = () => {
    setSelectedMonth(null);
    handleClearFilters();
  };

  const handlePrevMonthToggle = () => {
    if (selectedMonth === 'all' || !selectedMonth) return;
    const currentIndex = dynamicMonthsList.findIndex((m) => m.key === selectedMonth);
    if (currentIndex < dynamicMonthsList.length - 1) {
      const nextM = dynamicMonthsList[currentIndex + 1];
      setSelectedMonth(nextM.key);
      setViewDate(new Date(nextM.year, nextM.monthNum - 1, 1));
      handleClearFilters();
    }
  };

  const handleNextMonthToggle = () => {
    if (selectedMonth === 'all' || !selectedMonth) return;
    const currentIndex = dynamicMonthsList.findIndex((m) => m.key === selectedMonth);
    if (currentIndex > 0) {
      const prevM = dynamicMonthsList[currentIndex - 1];
      setSelectedMonth(prevM.key);
      setViewDate(new Date(prevM.year, prevM.monthNum - 1, 1));
      handleClearFilters();
    }
  };

  // 1. Open "Arrived Today" Confirmation Pop-up Modal
  const handleMarkArrivedToday = (patient) => {
    if (todayCheckins[patient.id]) return; // Already checked in today
    setConfirmingPatient(patient);
  };

  // 2. Finalize confirmation: Assign next sequential token & check in via database
  const handleConfirmArrival = async (patient) => {
    if (!patient || todayCheckins[patient.id] || isCheckingIn) return;

    setIsCheckingIn(true);
    try {
      const res = await checkinExistingPatient(patient.id);
      if (res.success && res.data) {
        const nextToken = res.data.token_number;
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const todayDate = new Date().toISOString().split('T')[0];

        setDailyTokenCounter((prev) => Math.max(prev, nextToken));
        setTodayCheckins((prev) => ({
          ...prev,
          [patient.id]: { tokenNumber: nextToken, checkedInAt: nowTime }
        }));

        setPatients((prevList) =>
          prevList.map((p) => {
            if (p.id === patient.id) {
              return {
                ...p,
                current_category: p.current_category === 'under_process' ? 'actively_treated' : p.current_category,
                last_visit_at: todayDate
              };
            }
            return p;
          })
        );

        setConfirmingPatient(null);

        setToastNotification({
          patientName: patient.name,
          patientCode: patient.patient_id_code,
          tokenNumber: nextToken
        });

        setTimeout(() => {
          setToastNotification(null);
        }, 4500);
      } else {
        alert(res.error || 'Failed to check-in patient in database.');
      }
    } catch (err) {
      console.error('Check-in failed:', err);
      alert(err.message || 'Failed to complete check-in.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Helper for category badge styling
  const renderCategoryBadge = (category) => {
    switch (category) {
      case 'actively_treated':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 shadow-[inset_1px_1px_2px_#d1fae5]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Actively Treated
          </span>
        );
      case 'treatment_done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-300/60">
            <Check size={12} weight="bold" className="text-teal-700" />
            Treatment Done
          </span>
        );
      case 'under_process':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Under Process
          </span>
        );
    }
  };

  return (
    <div className="space-y-2 sm:space-y-6 max-w-6xl mx-auto pb-10">
      {/* Sleek Minimalist Success Banner via Portal */}
      {mounted && toastNotification && createPortal(
        <div className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[1000] flex items-center justify-between sm:justify-start gap-2 sm:gap-2.5 w-[92%] sm:w-auto max-w-md sm:max-w-none px-3.5 sm:px-5 py-2 sm:py-2.5 bg-[#e6ebf2]/95 backdrop-blur-xl border border-emerald-500/50 rounded-full shadow-[4px_4px_20px_rgba(0,0,0,0.25),-2px_-2px_10px_#ffffff] text-[11.5px] sm:text-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <CheckCircle size={20} weight="fill" className="text-emerald-600 shrink-0" />
            <span className="text-zinc-700 font-medium leading-snug">
              <strong className="text-emerald-800 font-bold">Success:</strong> {toastNotification.patientName} checked-in as{' '}
              <strong className="text-emerald-700 font-extrabold whitespace-nowrap">Token #{toastNotification.tokenNumber}</strong>
            </span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="ml-1.5 sm:ml-2 text-zinc-400 hover:text-zinc-700 p-1 -mr-1 transition-colors cursor-pointer shrink-0"
            title="Dismiss notification"
          >
            <X size={16} weight="bold" />
          </button>
        </div>,
        document.body
      )}

      {selectedMonth === null ? (
        /* ========================================================
           VIEW 1: MONTHLY CARDS GRID
           ======================================================== */
        <div className="space-y-5">
          {/* Month Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-300/60">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-[#e6ebf2] shadow-[4px_4px_8px_#c2c9d4,-4px_-4px_8px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
                  <UserList size={30} weight="duotone" className="mt-0.5" />
                </span>
                <span>Existing Patient Records</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 ml-[60px] mt-1 sm:mt-0.5">
                Select the patient's <strong>last visit month</strong> to load & search records.
              </p>
            </div>

            {/* Year Switcher & Global Search Pill */}
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto ml-0">
              {/* Year Toggle */}
              <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff] border border-white/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 transition-colors cursor-pointer"
                  title="Previous Year"
                >
                  <CaretLeft size={13} weight="bold" />
                </button>
                <span className="font-mono font-extrabold text-xs sm:text-sm text-zinc-800 w-11 sm:w-12 text-center inline-block tabular-nums select-none">
                  {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => Math.min(new Date().getFullYear(), y + 1))}
                  disabled={selectedYear >= new Date().getFullYear()}
                  className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-zinc-600 disabled:active:shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] transition-colors cursor-pointer"
                  title="Next Year"
                >
                  <CaretRight size={13} weight="bold" />
                </button>
              </div>

              {/* Global Lifetime Search Button */}
              <button
                type="button"
                onClick={() => handleSelectMonthCard('all')}
                className="px-3 sm:px-3.5 py-2 rounded-2xl text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6] hover:shadow-[inset_3px_3px_6px_#c5ccd6,inset_-3px_-3px_6px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center gap-1.5 cursor-pointer group/gb shrink-0"
                title="Search all registered patients across all dates"
              >
                <Globe size={18} className="text-emerald-700 group-hover/gb:rotate-12 transition-transform shrink-0" weight="duotone" />
                <span className="whitespace-nowrap">Global Search</span>
              </button>

              {/* Refresh Database Records */}
              <button
                type="button"
                onClick={() => loadPatientsData(false)}
                disabled={isLoading}
                className="w-9 h-9 rounded-2xl bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6] hover:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                title="Refresh database records"
              >
                <ArrowClockwise size={16} weight="bold" className={`text-emerald-700 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Error Banner with Inward Neumorphic Shadow */}
          {loadError && (
            <div className="bg-[#fceeed] border border-rose-300/70 rounded-2xl p-3.5 sm:p-4 shadow-[inset_3px_3px_6px_#f5c6cb,inset_-3px_-3px_6px_#ffffff] flex items-center justify-between gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[inset_1.5px_1.5px_3px_#f5c6cb,inset_-1.5px_-1.5px_3px_#ffffff] border border-rose-300/50 flex items-center justify-center text-rose-600 shrink-0">
                  <WarningCircle size={18} weight="fill" />
                </div>
                <div>
                  <span className="font-bold text-rose-900 block sm:inline">Notice: </span>
                  <span className="text-rose-800 text-[11px] sm:text-xs">{loadError}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={loadPatientsData}
                className="px-3.5 py-1.5 bg-[#e6ebf2] rounded-xl shadow-[2px_2px_4px_#f5c6cb,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#f5c6cb] border border-rose-200 text-xs font-bold text-rose-700 hover:text-rose-900 transition-all cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Dynamic Monthly View: Mutually exclusive Loading vs Empty vs Cards */}
          {isLoading && patients.length === 0 ? (
            <div className="flex items-center justify-center gap-2.5 py-12 text-xs sm:text-sm text-zinc-500 font-medium bg-[#e6ebf2] rounded-3xl border border-white/80 shadow-[inset_2px_2px_5px_#c8d0db,inset_-2px_-2px_5px_#ffffff]">
              <CircleNotch size={20} className="animate-spin text-emerald-600" />
              <span>Loading clinical records from database...</span>
            </div>
          ) : patients.length === 0 ? (
            <div className="bg-[#e6ebf2] border border-white/80 rounded-[2rem] p-8 sm:p-12 text-center shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c2c9d4] space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#e6ebf2] shadow-[4px_4px_10px_#c2c9d4,-4px_-4px_10px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 mx-auto">
                <CalendarCheck size={32} weight="duotone" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-bold text-zinc-900">
                  No Patient Records Found
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
                  There are currently no consultation records in the database. When new patients are registered, their records will automatically appear here organized by consultation month.
                </p>
              </div>
            </div>
          ) : monthsForSelectedYear.length === 0 ? (
            <div className="bg-[#e6ebf2] border border-white/80 rounded-[2rem] p-8 text-center shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c2c9d4] space-y-3">
              <h4 className="text-sm font-bold text-zinc-800">
                No Records Found for {selectedYear}
              </h4>
              <p className="text-xs text-zinc-500">
                There are no consultation records recorded for the year {selectedYear}.
              </p>
              <button
                type="button"
                onClick={() => setSelectedYear(currentYear)}
                className="px-4 py-1.5 bg-[#e6ebf2] text-xs font-bold text-emerald-700 rounded-full shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] border border-white/70 hover:shadow-[inset_1px_1px_2px_#c5ccd6] cursor-pointer"
              >
                Go to Current Year ({currentYear})
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {monthsForSelectedYear.map((m) => {
                const stats = monthlyStats[m.key] || { total: 0, active: 0, underProcess: 0, done: 0 };
                const isCurrentMonth = m.key === currentMonthKey;

                return (
                  <div
                    key={m.key}
                    onClick={() => handleSelectMonthCard(m.key)}
                    className="bg-[#e6ebf2] border border-white/80 rounded-3xl p-5 shadow-[inset_4px_4px_8px_#ffffff,inset_-4px_-4px_8px_#c5ccd6] hover:shadow-[inset_3px_3px_7px_#c8d0db,inset_-3px_-3px_7px_#ffffff] active:scale-[0.99] transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    {/* Card Top: Month Name & Current Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_7px_#c2c9d4,-3px_-3px_7px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0 group-hover:scale-105 transition-all">
                          <CalendarCheck size={26} weight="duotone" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight group-hover:text-emerald-800 transition-colors">
                            {m.name} {m.year}
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Monthly clinical visits
                          </p>
                        </div>
                      </div>

                      {isCurrentMonth && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e6ebf2] text-emerald-800 border border-emerald-500/30 shadow-[inset_1.5px_1.5px_3px_#c8d0db,inset_-1.5px_-1.5px_3px_#ffffff]">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 shadow-[0_0_6px_rgba(16,185,129,0.6)]"></span>
                          </span>
                          <span>Current</span>
                        </span>
                      )}
                    </div>

                    {/* Card Action Button */}
                    <div className="pt-3 border-t border-zinc-300/40 flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-800 group-hover:text-emerald-800 transition-colors">
                        {stats.total > 0 ? `${stats.total} Patient${stats.total !== 1 ? 's' : ''} visited` : 'No records yet'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
                        <span>Open Records</span>
                        <ArrowRight size={13} weight="bold" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================
           VIEW 2: SELECTED MONTH RECORDS & SEARCH TABLE
           ======================================================== */
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {/* Header & Back Navigation */}
          <div className="flex flex-row items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-zinc-300/60">
            <div className="space-y-1.5 md:space-y-3 min-w-0">
              <div>
                <button
                  type="button"
                  onClick={handleBackToMonths}
                  className="px-2.5 py-1 rounded-xl bg-[#e6ebf2] text-[11px] font-bold text-zinc-600 hover:text-emerald-800 shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c5ccd6] active:scale-95 border border-white/80 transition-all inline-flex items-center gap-1.5 cursor-pointer mb-1"
                  title="Back to Monthly Cards"
                >
                  <ArrowLeft size={14} weight="bold" />
                  <span>Back to Months</span>
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2 truncate">
                <span className="truncate">{selectedMonthInfo?.name} {selectedMonthInfo?.year}</span>
                <span className="hidden md:inline-block text-[12px] font-semibold px-3 rounded-full bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                  {filteredPatients.length} Records
                </span>
              </h2>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Multi-field searching within <strong>{selectedMonthInfo?.name}</strong>. Mark <strong>"Arrived Today"</strong> to assign today's token.
              </p>
            </div>

            {/* Quick Month Switcher & Token Summary */}
            <div className="flex items-center gap-2 shrink-0">
              {selectedMonth !== 'all' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff] border border-white/60 text-xs">
                  <button
                    type="button"
                    onClick={handlePrevMonthToggle}
                    className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="Previous Month"
                  >
                    <CaretLeft size={12} weight="bold" />
                  </button>
                  <span className="font-bold text-zinc-800 px-1 select-none font-mono">
                    {selectedMonthInfo?.shortName} 20{String(selectedMonthInfo?.year).slice(2)}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonthToggle}
                    className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 transition-colors cursor-pointer"
                    title="Next Month"
                  >
                    <CaretRight size={12} weight="bold" />
                  </button>
                </div>
              )}

              {/* Status indicator summary */}
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-600 bg-[#e6ebf2] px-3.5 py-1.5 rounded-2xl shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6]">
                <Ticket size={20} weight="duotone" className="text-emerald-700" />
                <span>Next Token: <strong className="text-emerald-700 font-bold">#{dailyTokenCounter + 1}</strong></span>
              </div>
            </div>
          </div>

          {/* 5-Field Sequential Search Filter Form */}
          <div className="bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] p-5 sm:p-7 shadow-[inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)]">
            {/* Input Fields Sequence: 
                Mobile: [1. Patient ID + 5. Last Visit Date] -> [2. Mobile No] -> [3. Patient Name + 4. Age]
                Desktop: 1 -> 2 -> 3 -> 4 -> 5 in a 5-column row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* 1. Patient ID (Mobile Row 1 Col 1 / Desktop Col 1) */}
              <div className="col-span-1 lg:order-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  1. Patient ID
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center gap-1 pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors select-none">
                    <Hash size={15} weight="bold" />
                    <span className="font-mono font-bold text-[13px] sm:text-[12px] text-zinc-500 group-focus-within:text-emerald-700 transition-colors">PM-</span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1001"
                    value={searchFilters.patient_id}
                    onChange={handlePatientIdChange}
                    style={{ outline: 'none' }}
                    className="w-full pl-[54px] sm:pl-[54px] pr-2.5 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium font-mono"
                  />
                </div>
              </div>

              {/* 5. Last Visit Date (Mobile Row 1 Col 2 / Desktop Col 5) */}
              <div className="col-span-1 lg:order-5 relative" ref={calendarRef}>
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1 truncate">
                  5. Last Visit Date
                </label>
                <div
                  onClick={() => setCalendarOpen((prev) => !prev)}
                  role="button"
                  tabIndex={0}
                  className={`w-full pl-8 sm:pl-9 pr-2.5 sm:pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-xl text-xs sm:text-sm text-zinc-800 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] ${calendarOpen ? 'shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.3)]' : ''
                    } transition-[box-shadow] duration-150 ease-out font-medium cursor-pointer flex items-center justify-between select-none relative group`}
                >
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-zinc-400 group-hover:text-emerald-600 transition-colors">
                    <CalendarBlank size={16} weight="bold" className={searchFilters.last_visit_date ? 'text-emerald-700' : ''} />
                  </div>

                  <span className={`truncate text-[11px] sm:text-[13px] mr-1 ${searchFilters.last_visit_date ? 'text-zinc-900 font-bold' : 'text-zinc-400 font-normal'}`}>
                    {searchFilters.last_visit_date ? (
                      new Date(searchFilters.last_visit_date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                    ) : (
                      'dd-mm-yyyy'
                    )}
                  </span>

                  {searchFilters.last_visit_date ? (
                    <button
                      type="button"
                      onClick={handleClearDate}
                      title="Clear selected date"
                      className="text-zinc-400 hover:text-rose-600 p-0.5 rounded-xl hover:bg-zinc-200/60 transition-colors cursor-pointer shrink-0"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  ) : (
                    <CaretDown size={11} weight="bold" className={`text-zinc-400 transition-transform duration-200 shrink-0 ${calendarOpen ? 'rotate-180 text-emerald-700' : ''}`} />
                  )}
                </div>

                {/* Custom Neumorphic Calendar Popover Modal */}
                {calendarOpen && (
                  <div className="absolute top-full -right-7 sm:right-0 mt-1 sm:mt-1.5 z-30 w-56 sm:w-full sm:max-w-none sm:min-w-[200px] bg-[#e6ebf2] border border-white/90 rounded-2xl p-2 sm:p-2.5 shadow-[2px_2px_5px_#c8d0db,-2px_-2px_5px_#ffffff] animate-in fade-in zoom-in-95 duration-150">
                    {/* Month & Year Header Navigation */}
                    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-zinc-300/60 px-0.5">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        title="Previous Month"
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <CaretLeft size={11} weight="bold" />
                      </button>
                      <span className="text-[10.5px] sm:text-[11px] font-bold text-zinc-800 tracking-tight select-none">
                        {currentMonthLabel}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        title="Next Month"
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      >
                        <CaretRight size={11} weight="bold" />
                      </button>
                    </div>

                    {/* Day-of-Week Headers */}
                    <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5 select-none">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                        <span key={day} className="text-[8.5px] sm:text-[9px] font-bold text-zinc-400 uppercase py-0.5">
                          {day}
                        </span>
                      ))}
                    </div>

                    {/* Calendar Days Matrix */}
                    <div className="grid grid-cols-7 gap-0.5">
                      {/* Empty offset days */}
                      {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="w-full aspect-square" />
                      ))}

                      {/* Month Days */}
                      {Array.from({ length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate() }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const year = viewDate.getFullYear();
                        const month = String(viewDate.getMonth() + 1).padStart(2, '0');
                        const d = String(dayNum).padStart(2, '0');
                        const thisDateStr = `${year}-${month}-${d}`;
                        const isSelected = searchFilters.last_visit_date === thisDateStr;
                        const isToday = new Date().toISOString().split('T')[0] === thisDateStr;

                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => handleSelectDay(dayNum)}
                            className={`w-full aspect-square max-w-[28px] mx-auto rounded-md sm:rounded-lg text-[10px] sm:text-[10.5px] font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer ${isSelected
                              ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1px_1px_3px_#c5ccd6]'
                              : isToday
                                ? 'bg-[#e6ebf2] text-emerald-800 font-bold border border-emerald-500/50 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff]'
                                : 'text-zinc-700 hover:bg-zinc-200/60 active:scale-95'
                              }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* Calendar Footer Quick Controls */}
                    <div className="mt-2 pt-1.5 border-t border-zinc-300/60 flex items-center justify-between px-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={handleSelectToday}
                        className="font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        Today
                      </button>
                      {searchFilters.last_visit_date && (
                        <button
                          type="button"
                          onClick={handleClearDate}
                          className="font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Mobile Number (Mobile Row 2 Full Width / Desktop Col 2) */}
              <div className="col-span-2 lg:col-span-1 lg:order-2">
                <label className="block text-[10px] sm:text-[10.5px] font-bold text-zinc-600 uppercase tracking-wider mt-1 sm:mt-0 mb-1.5 ml-1">
                  2. Mobile No.(WhatsApp)
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                    <Phone size={16} weight="bold" />
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="10-digit number"
                    value={searchFilters.mobile}
                    onChange={handlePhoneChange}
                    style={{ outline: 'none' }}
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>

              {/* 3. Patient Name (Mobile Row 3 Col 1 / Desktop Col 3) */}
              <div className="col-span-1 lg:order-3">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mt-1 sm:mt-0 mb-1.5 ml-1 truncate">
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
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>

              {/* 4. Age (Mobile Row 3 Col 2 / Desktop Col 4) */}
              {/* 4. Age (Mobile Row 3 Col 2 / Desktop Col 4) */}
              <div className="col-span-1 lg:order-4">
                <label className="block text-[10px] sm:text-[11px] font-bold text-zinc-600 uppercase tracking-wider mt-1 sm:mt-0 mb-1.5 ml-1 truncate">
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
                    className="w-full pl-8 sm:pl-9 pr-3 py-2 sm:py-2.5 bg-[#e6ebf2] rounded-xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 sm:placeholder:text-[13px] border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Outside Meta & Results Count Bar (with Pagination Controls) */}
          <div className="mt-4 sm:mt-7 mb-2 sm:mb-2.5 -mx-1 sm:mx-0 px-0 sm:px-3 text-xs text-zinc-500 w-auto sm:w-full flex flex-row items-center justify-between gap-1.5 sm:gap-2 sm:grid sm:grid-cols-3">
            {/* Left (Desktop Col 1 / Mobile Left when filter active): Reset Filters */}
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

            {/* Mobile Left (when no filter active) / Desktop Center (Desktop Col 2): Pagination Buttons */}
            <div className={`flex items-center ${isAnyFilterActive ? 'hidden sm:flex sm:justify-center' : 'justify-start sm:justify-center'}`}>
              {totalPages > 1 && (
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Previous Button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] sm:shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer transition-all"
                    title="Previous Page"
                  >
                    <CaretLeft size={10} weight="bold" className="sm:w-3 sm:h-3" />
                    <span>Prev</span>
                  </button>

                  {/* Numbered Page Pills: Desktop shows all pills, Mobile shows max 2 buttons + ellipsis */}
                  {/* 1. Desktop Pills (sm:flex) */}
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === page
                          ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),2px_2px_4px_#c2c9d4]'
                          : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                          }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* 2. Mobile Pills (flex sm:hidden): strictly buttons 1 & 2 then '...' */}
                  <div className="flex sm:hidden items-center gap-1">
                    {totalPages <= 2 ? (
                      Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === page
                            ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                            : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                            }`}
                        >
                          {page}
                        </button>
                      ))
                    ) : currentPage <= 2 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(1)}
                          className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === 1
                            ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                            : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                            }`}
                        >
                          1
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(2)}
                          className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === 2
                            ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                            : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                            }`}
                        >
                          2
                        </button>
                        <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                          ...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                          ...
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentPage(currentPage)}
                          className="w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]"
                        >
                          {currentPage}
                        </button>
                        {currentPage < totalPages && (
                          <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                            ...
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Next Button */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] sm:shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer transition-all"
                    title="Next Page"
                  >
                    <span>Next</span>
                    <CaretRight size={10} weight="bold" className="sm:w-3 sm:h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Right / Desktop Right (Desktop Col 3): Showing Summary Line */}
            <div className="flex items-center justify-end font-medium text-zinc-500 text-[11px] sm:text-xs text-right whitespace-nowrap ml-auto">
              {filteredPatients.length > ITEMS_PER_PAGE ? (
                <span>
                  Showing <strong className="text-zinc-800">{startIndex + 1}–{endIndex}</strong> of <strong className="text-emerald-700">{filteredPatients.length}</strong> records <span className="hidden sm:inline-block ml-2 text-zinc-500 font-normal">(Page <strong className="text-zinc-700 font-semibold">{currentPage}</strong> of {totalPages})</span>
                </span>
              ) : (
                <span>
                  Showing <strong className="text-emerald-700 font-bold">{filteredPatients.length}</strong> patient record{filteredPatients.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* RESULTS DISPLAY SECTION */}
          {filteredPatients.length === 0 ? (
            /* Empty State */
            <div className="bg-[#e6ebf2] border border-white/80 rounded-[2rem] p-10 text-center shadow-[6px_6px_16px_#d2d8e2,-6px_-6px_16px_rgba(255,255,255,0.7)]">
              <div className="w-14 h-14 rounded-2xl bg-[#e6ebf2] shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center text-zinc-400 mx-auto mb-3">
                <MagnifyingGlass size={26} weight="duotone" />
              </div>
              <h4 className="text-base font-bold text-zinc-800 mb-1">No Matching Patients Found</h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
                Try adjusting your search criteria or register them as a new patient if this is their first visit.
              </p>
              <button
                onClick={handleClearFilters}
                className="px-5 py-2 bg-[#e6ebf2] text-xs font-bold text-emerald-700 rounded-full shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 transition-all cursor-pointer border border-white/70"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              {/* 1. LAPTOP / DESKTOP VIEW: Clean Data Table (hidden on mobile) */}
              <div className="hidden md:block bg-[#e6ebf2] border border-white/80 rounded-[1rem] p-4 sm:p-1 sm:pt-0 shadow-[inset_4px_4px_12px_#c8d0db,inset_-4px_-4px_12px_#ffffff] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-[#d5dde8] text-[11px] font-black text-zinc-800 uppercase tracking-wider rounded-xl border-b border-zinc-300/80 shadow-[inset_0_1px_2px_#bcc4d0]">
                        <th className="w-[10%] py-3 px-3 rounded-l-xl">Patient ID</th>
                        <th className="w-[11%] py-3 px-3">Patient Name</th>
                        <th className="w-[6%] py-3 px-2 text-center">Age</th>
                        <th className="w-[18%] py-3 px-3 text-center">Mobile No.(WhatsApp)</th>
                        <th className="w-[12%] py-3 px-3">Last Visit</th>
                        <th className="w-[15%] py-3 px-3 text-center">View Details</th>
                        <th className="w-[20%] py-3 px-3 text-center rounded-r-xl">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 text-xs">
                      {paginatedPatients.map((patient) => {
                        const checkinData = todayCheckins[patient.id];
                        const isCheckedInToday = Boolean(checkinData);

                        return (
                          <tr
                            key={patient.id}
                            className="hover:bg-zinc-200/35 transition-colors group"
                          >
                            {/* Permanent Patient ID */}
                            <td className="py-3 px-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                              <span className="px-2.5 py-1 text-[13px] rounded-lg bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                                {patient.patient_id_code}
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

                            {/* Mobile Number */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span className="inline-flex items-center justify-center gap-1.5 font-sans font-semibold text-zinc-700 text-[12px] tracking-wide">
                                <DeviceMobile size={15} weight="bold" className="text-zinc-500 shrink-0" />
                                <span>{patient.mobile.length === 10 ? `${patient.mobile.slice(0, 5)} ${patient.mobile.slice(5)}` : patient.mobile}</span>
                              </span>
                            </td>

                            {/* Last Visit Date */}
                            <td className="py-3 px-3 font-semibold text-zinc-500 text-[12px] whitespace-nowrap">
                              {patient.last_visit_at}
                            </td>

                            {/* View Details Button Column */}
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

                            {/* Action Column: Date-Aware "Arrived Today" */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {isCheckedInToday ? (
                                  <button
                                    disabled
                                    className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] border border-emerald-500/30 inline-flex items-center justify-center gap-1.5 cursor-not-allowed opacity-95"
                                  >
                                    <CheckCircle size={14} weight="fill" className="text-emerald-600 shrink-0" />
                                    <span>Checked-in Today (Token #{checkinData.tokenNumber})</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleMarkArrivedToday(patient)}
                                    className="px-4 py-2 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold text-[11.5px] rounded-full shadow-[2px_2px_6px_#c5ccd6,-2px_-2px_6px_#ffffff] hover:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.4)] active:scale-95 transition-all duration-150 ease-out inline-flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/40 group/btn"
                                  >
                                    <span>Arrived Today</span>
                                    <ArrowRight size={13} weight="bold" className="group-hover/btn:translate-x-0.5 transition-transform" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. MOBILE VIEW: Responsive Patient Cards (block on mobile, hidden on desktop) */}
              <div className="block md:hidden space-y-4">
                {paginatedPatients.map((patient) => {
                  const checkinData = todayCheckins[patient.id];
                  const isCheckedInToday = Boolean(checkinData);

                  return (
                    <div
                      key={patient.id}
                      className="bg-[#e6ebf2] border border-white/80 rounded-3xl p-4 shadow-[inset_4px_4px_8px_#ffffff,inset_-4px_-4px_8px_#c5ccd6] space-y-3.5"
                    >
                      {/* Card Header: Square Eye Details Button on left + Patient Info */}
                      <div className="flex items-center gap-3 border-b border-zinc-300/50 pb-3">
                        {/* Square Detail Button with Eye Icon */}
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(patient)}
                          title="Click to view patient clinical details"
                          className="w-10 h-10 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2c9d4] active:scale-95 border border-white/80 flex items-center justify-center text-emerald-700 shrink-0 cursor-pointer transition-all select-none"
                        >
                          <Eye size={20} weight="bold" className="text-emerald-700" />
                        </button>

                        {/* Patient Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden mb-1">
                            <span className="font-mono text-[11px] font-extrabold text-emerald-800 px-2 py-0.5 rounded-md bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60 shrink-0">
                              {patient.patient_id_code}
                            </span>
                            <h4 className="text-[13.5px] font-bold text-zinc-900 leading-tight truncate">
                              {patient.name},
                            </h4>
                            <span className="text-[12.5px] font-semibold text-zinc-500 shrink-0">
                              {patient.age} yrs
                            </span>
                          </div>
                          <div className="ml-1 flex items-center gap-1 text-[10px] font-bold text-zinc-500/90 truncate">
                            <CalendarBlank size={14} weight="bold" className="text-zinc-500 shrink-0" />
                            <span>Last Visit: <strong className="font-black text-zinc-600/90">{patient.last_visit_at}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Button */}
                      <div className="pt-0 border-t border-zinc-300/40">
                        {isCheckedInToday ? (
                          <button
                            disabled
                            className="-mt-2 w-full py-2.5 px-4 rounded-full text-xs font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] border border-emerald-500/30 flex items-center justify-center gap-2 cursor-not-allowed opacity-95"
                          >
                            <CheckCircle size={17} weight="fill" className="text-emerald-600 shrink-0" />
                            <span>Checked-in for Today (Token #{checkinData.tokenNumber})</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkArrivedToday(patient)}
                            className="-mt-2 w-full py-2.5 px-4 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold text-xs rounded-full shadow-[2px_2px_6px_#c5ccd6,-2px_-2px_6px_#ffffff] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40"
                          >
                            <span>Arrived Today</span>
                            <ArrowRight size={14} weight="bold" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. PAGINATION TOOLBAR (20 records per page) */}
              {totalPages > 1 && (
                <div className="pt-3 -mx-1 sm:mx-0 px-0 sm:px-3 text-xs text-zinc-500 w-auto sm:w-full flex flex-row items-center justify-between gap-1.5 sm:gap-2 sm:grid sm:grid-cols-3">
                  {/* Left: Spacer on Desktop */}
                  <div className="hidden sm:block"></div>

                  {/* Mobile Left / Desktop Center: Pagination Switching Buttons */}
                  <div className="flex items-center justify-start sm:justify-center">
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {/* Previous Button */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] sm:shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer transition-all"
                        title="Previous Page"
                      >
                        <CaretLeft size={10} weight="bold" className="sm:w-3 sm:h-3" />
                        <span>Prev</span>
                      </button>

                      {/* Numbered Page Pills: Desktop shows all pills, Mobile shows max 2 buttons + ellipsis */}
                      {/* 1. Desktop Pills (sm:flex) */}
                      <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === page
                              ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),2px_2px_4px_#c2c9d4]'
                              : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      {/* 2. Mobile Pills (flex sm:hidden): strictly buttons 1 & 2 then '...' */}
                      <div className="flex sm:hidden items-center gap-1">
                        {totalPages <= 2 ? (
                          Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === page
                                ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                                : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                                }`}
                            >
                              {page}
                            </button>
                          ))
                        ) : currentPage <= 2 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setCurrentPage(1)}
                              className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === 1
                                ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                                : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                                }`}
                            >
                              1
                            </button>
                            <button
                              type="button"
                              onClick={() => setCurrentPage(2)}
                              className={`w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === 2
                                ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]'
                                : 'bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70'
                                }`}
                            >
                              2
                            </button>
                            <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                              ...
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                              ...
                            </span>
                            <button
                              type="button"
                              onClick={() => setCurrentPage(currentPage)}
                              className="w-5 h-5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),1.5px_1.5px_3px_#c2c9d4]"
                            >
                              {currentPage}
                            </button>
                            {currentPage < totalPages && (
                              <span className="px-0.5 text-zinc-400 font-extrabold text-[9px] select-none tracking-tight">
                                ...
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Next Button */}
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-md sm:rounded-xl text-[10px] sm:text-xs font-bold bg-[#e6ebf2] text-zinc-700 hover:text-emerald-700 shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] sm:shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center gap-0.5 sm:gap-1 cursor-pointer transition-all"
                        title="Next Page"
                      >
                        <span>Next</span>
                        <CaretRight size={10} weight="bold" className="sm:w-3 sm:h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile Right / Desktop Right: Showing Summary Line */}
                  <div className="flex items-center justify-end font-medium text-zinc-500 text-[11px] sm:text-xs text-right whitespace-nowrap">
                    {filteredPatients.length > ITEMS_PER_PAGE ? (
                      <span>
                        Showing <strong className="text-zinc-800">{startIndex + 1}–{endIndex}</strong> of <strong className="text-emerald-700">{filteredPatients.length}</strong> records <span className="hidden sm:inline-block ml-2 text-zinc-500 font-normal">(Page <strong className="text-zinc-700 font-semibold">{currentPage}</strong> of {totalPages})</span>
                      </span>
                    ) : (
                      <span>
                        Showing <strong className="text-emerald-700 font-bold">{filteredPatients.length}</strong> patient record{filteredPatients.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
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
                  {selectedPatient.mobile ? `+91 ${selectedPatient.mobile}` : '—'}
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
                  onClick={() => handleConfirmArrival(selectedPatient)}
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
                  <span>{confirmingPatient.mobile.length === 10 ? `${confirmingPatient.mobile.slice(0, 5)} ${confirmingPatient.mobile.slice(5)}` : confirmingPatient.mobile}</span>
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
                disabled={isCheckingIn}
                onClick={() => handleConfirmArrival(confirmingPatient)}
                className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 group whitespace-nowrap"
              >
                {isCheckingIn ? (
                  <CircleNotch size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} weight="bold" className="group-hover:scale-110 transition-transform" />
                )}
                <span>{isCheckingIn ? 'Checking in...' : 'Confirm Check-in'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
