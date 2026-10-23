import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  WhatsappLogo,
  CheckCircle,
  XCircle,
  Clock,
  ArrowClockwise,
  MagnifyingGlass,
  Check,
  WarningCircle,
  Copy,
  Star,
  CalendarCheck,
  CalendarX,
  ChatCircleDots,
  User,
  Phone,
  Eye,
  PaperPlaneTilt,
  CaretDown,
  CaretUp,
  X,
  ArrowRight,
  UserList
} from '@phosphor-icons/react';
import {
  fetchNotificationQueue,
  updateNotificationStatus,
  bulkUpdateNotificationStatus,
  buildNotificationMessage,
  subscribeToClinicRealtime
} from '../../services/clinicService';

export const GoogleIcon = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.28 14.24a7.17 7.17 0 0 1 0-4.48V6.61H1.29a11.96 11.96 0 0 0 0 10.78l3.99-3.15z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
      fill="#EA4335"
    />
  </svg>
);

export const NotificationView = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'appointment_reminder', 'missed_followup', 'google_review'
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'sent', 'skipped', 'all'
  const [expandedMessageId, setExpandedMessageId] = useState(null);
  const [toastNotification, setToastNotification] = useState(null);
  const [actionInProgressId, setActionInProgressId] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'approve' | 'skip', item }
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (confirmAction) {
          setConfirmAction(null);
        } else if (selectedPatient) {
          setSelectedPatient(null);
        }
      }
    };
    if (confirmAction || selectedPatient) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmAction, selectedPatient]);

  // Close type dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setTypeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setTypeDropdownOpen(false);
    };
    if (typeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [typeDropdownOpen]);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => setToastNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Load Queue Data
  const loadQueue = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetchNotificationQueue();
      if (res.success) {
        setQueue(res.data);
      } else {
        setToastNotification({
          type: 'error',
          title: 'Load Failed',
          message: res.error || 'Failed to load notifications'
        });
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();

    // Subscribe to realtime changes on whatsapp_logs, visits, and patients
    const unsubscribe = subscribeToClinicRealtime(() => {
      loadQueue(true);
    });

    return () => unsubscribe();
  }, [loadQueue]);

  // Stats calculation
  const metrics = useMemo(() => {
    const validItems = queue.filter(
      (item) => item.message_type === 'google_review' || item.message_type === 'missed_followup'
    );

    const pending = validItems.filter((item) => item.status === 'pending');
    const sent = validItems.filter((item) => item.status === 'sent');
    const skipped = validItems.filter((item) => item.status === 'skipped');

    const reviewsPending = pending.filter(
      (item) => item.message_type === 'google_review'
    ).length;

    const missedPending = pending.filter(
      (item) => item.message_type === 'missed_followup'
    ).length;

    // Card 3: Sum from the top two cards
    const awaitingPermission = reviewsPending + missedPending;

    return {
      reviewsPending,
      missedPending,
      awaitingPermission,
      sentTotal: sent.length,
      skippedTotal: skipped.length,
      total: validItems.length
    };
  }, [queue]);

  // Type Counts based on current status filter
  const typeCounts = useMemo(() => {
    const base = queue.filter((item) => {
      if (item.message_type !== 'google_review' && item.message_type !== 'missed_followup') {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      return true;
    });

    return {
      all: base.length,
      google_review: base.filter((i) => i.message_type === 'google_review').length,
      missed_followup: base.filter((i) => i.message_type === 'missed_followup').length
    };
  }, [queue, statusFilter]);

  // Check if any filter is active (different from default)
  const isAnyFilterActive = useMemo(() => {
    return searchQuery.trim() !== '' || statusFilter !== 'pending' || typeFilter !== 'all';
  }, [searchQuery, statusFilter, typeFilter]);

  // Reset all filters back to default
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('pending');
    setTypeFilter('all');
  }, []);

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && item.message_type !== typeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const patientName = (item.patient?.name || '').toLowerCase();
        const patientMobile = (item.patient?.mobile || '');
        const patientCode = (item.patient?.patient_id_code || '').toLowerCase();
        return patientName.includes(q) || patientMobile.includes(q) || patientCode.includes(q);
      }

      return true;
    });
  }, [queue, statusFilter, typeFilter, searchQuery]);

  // Action: Approve & Send via WhatsApp
  const handleApproveAndSend = async (item) => {
    const mobile = item.patient?.mobile?.replace(/\D/g, '');
    if (!mobile || mobile.length < 10) {
      setToastNotification({
        type: 'error',
        title: 'Invalid Mobile Number',
        message: 'Patient does not have a valid 10-digit mobile number.'
      });
      return;
    }

    const messageText = buildNotificationMessage(
      item.message_type,
      item.patient?.name,
      item.scheduled_for
    );

    // Format phone with Indian country code prefix 91 if not present
    const fullPhone = mobile.length === 10 ? `91${mobile}` : mobile;
    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(messageText)}`;

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    // Update status in Supabase
    setActionInProgressId(item.id);
    try {
      const res = await updateNotificationStatus(item.id, 'sent');
      if (res.success) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'sent', sent_at: new Date().toISOString() } : q))
        );
        setToastNotification({
          type: 'success',
          title: 'Authorized & Sent',
          message: `Notification approved and WhatsApp launched for ${item.patient?.name || 'patient'}.`
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'Status Update Failed',
        message: err.message || 'Could not update status to sent.'
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Action: Skip / Dismiss
  const handleSkip = async (item) => {
    setActionInProgressId(item.id);
    try {
      const res = await updateNotificationStatus(item.id, 'skipped');
      if (res.success) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'skipped' } : q))
        );
        setToastNotification({
          type: 'info',
          title: 'Notification Skipped',
          message: `Dismissed notification for ${item.patient?.name || 'patient'}.`
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not dismiss notification.'
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Action: Unskip / Restore to Pending Queue
  const handleUnskip = async (item) => {
    setActionInProgressId(item.id);
    try {
      const res = await updateNotificationStatus(item.id, 'pending');
      if (res.success) {
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'pending' } : q))
        );
        setToastNotification({
          type: 'success',
          title: 'Restored to Pending',
          message: `Restored reminder for ${item.patient?.name || 'patient'} back to pending queue.`
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not restore notification.'
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Action: Trigger Approve All Confirmation
  const handleApproveAll = () => {
    const pendingItems = queue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;
    setConfirmAction({
      type: 'approve_all',
      count: pendingItems.length,
      ids: pendingItems.map((item) => item.id)
    });
  };

  // Action: Execute Bulk Approve
  const handleConfirmApproveAll = async (ids) => {
    setActionInProgressId('bulk_approve');
    try {
      const res = await bulkUpdateNotificationStatus(ids, 'sent');
      if (res.success) {
        setQueue((prev) =>
          prev.map((q) =>
            ids.includes(q.id) ? { ...q, status: 'sent', sent_at: new Date().toISOString() } : q
          )
        );
        setToastNotification({
          type: 'success',
          title: 'All Approved',
          message: `Successfully approved all ${ids.length} pending notification${ids.length !== 1 ? 's' : ''}.`
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      setToastNotification({
        type: 'error',
        title: 'Bulk Approval Failed',
        message: err.message || 'Could not approve all notifications.'
      });
    } finally {
      setActionInProgressId(null);
    }
  };

  // Action: Copy Message
  const handleCopyMessage = (item) => {
    const text = buildNotificationMessage(
      item.message_type,
      item.patient?.name,
      item.scheduled_for
    );
    navigator.clipboard.writeText(text);
    setToastNotification({
      type: 'success',
      title: 'Copied to Clipboard',
      message: 'WhatsApp message template copied.'
    });
  };

  // Badge stylings
  const getTypeBadge = (type) => {
    switch (type) {
      case 'missed_followup':
        return {
          label: 'Missed Appointment',
          icon: CalendarX,
          className:
            'bg-white/40 text-rose-700 border-white/60 shadow-[inset_1.5px_1.5px_3px_#ffffff,inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.2)]'
        };
      case 'google_review':
        return {
          label: 'Google Review Request',
          icon: GoogleIcon,
          className:
            'bg-white/60 text-zinc-800 border-white/60 shadow-[inset_1.5px_1.5px_3px_#ffffff,inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.2)]'
        };
      default:
        return {
          label: 'General Notice',
          icon: ChatCircleDots,
          className:
            'bg-white/60 text-sky-800 border-white/60 shadow-[inset_1.5px_1.5px_3px_#ffffff,inset_-1.5px_-1.5px_3px_rgba(0,0,0,0.2)]'
        };
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto pb-12 font-sans">
      {/* Toast Notification via Portal */}
      {mounted && toastNotification && createPortal(
        <div className="fixed top-3.5 sm:top-5 left-1/2 -translate-x-1/2 z-[1000] w-[92%] sm:w-auto max-w-md bg-[#e6ebf2]/95 backdrop-blur-xl border border-white/90 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 shadow-[8px_8px_24px_rgba(0,0,0,0.18),-4px_-4px_16px_#ffffff] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toastNotification.type === 'error'
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-700'
              : toastNotification.type === 'info'
                ? 'bg-zinc-500/10 border border-zinc-500/20 text-zinc-700'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700'
              }`}>
              {toastNotification.type === 'error' ? (
                <WarningCircle size={18} weight="bold" />
              ) : (
                <Check size={18} weight="bold" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 leading-tight">{toastNotification.title}</h4>
              <p className="text-[11px] text-zinc-600 leading-tight mt-0.5">{toastNotification.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="w-6 h-6 rounded-md bg-[#e6ebf2] shadow-[1px_1px_3px_#c5ccd6,-1px_-1px_3px_#ffffff] flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors shrink-0 cursor-pointer"
          >
            <XCircle size={15} />
          </button>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="pb-4 sm:pb-6 border-b border-zinc-300/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#e6ebf2] shadow-[4px_4px_8px_#c2c9d4,-4px_-4px_8px_#ffffff] border border-white/70 flex items-center justify-center text-emerald-700 shrink-0">
              <Bell size={26} className="sm:hidden" weight="duotone" />
              <Bell size={30} className="hidden sm:block" weight="duotone" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 leading-tight">
                Notification
              </h2>
              <p className="hidden sm:block text-xs sm:text-sm text-zinc-500 mt-0.5">
                Appointment reminders and post-treatment Google review requests
              </p>
            </div>
          </div>

          {/* Header Actions: Refresh & Approve All Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Refresh Button on the left */}
            <button
              type="button"
              onClick={() => loadQueue(false)}
              disabled={refreshing}
              className="px-2.5 sm:px-2.5 py-2 rounded-xl bg-[#e6ebf2] text-xs font-bold text-zinc-700 hover:text-emerald-700 shadow-[inset_0_2px_4px_#ffffff,inset_0_-2px_4px_rgba(0,0,0,0.25)] hover:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_-2px_4px_#ffffff] active:scale-95 border border-white/80 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Refresh notification queue"
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                className={refreshing ? 'animate-spin text-emerald-700' : ''}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Approve All Button on the right */}
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={metrics.awaitingPermission === 0 || actionInProgressId === 'bulk_approve'}
              className="px-2.5 sm:px-3.5 py-2 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 text-white text-xs font-bold shadow-[2px_2px_6px_#c5ccd6,-2px_-2px_6px_#ffffff] hover:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.4)] active:scale-95 transition-all border border-emerald-500/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
              title={metrics.awaitingPermission === 0 ? "No pending notifications to approve" : "Approve all pending notifications at once"}
            >
              <CheckCircle size={17} weight="bold" className="group-hover:scale-110 transition-transform" />
              <span>Approve All</span>
            </button>
          </div>
        </div>

        {/* Mobile Subtitle (aligned with Notification heading) */}
        <p className="sm:hidden text-xs text-zinc-500 mt-0.5 ml-[50px] leading-relaxed">
          Appointment reminders and post-treatment Google review requests
        </p>
      </div>

      {/* 4 Summary Metric Cards (Horizontal scroll snap on mobile, 4-col grid on laptop) */}
      <div className="flex lg:grid lg:grid-cols-4 gap-3 sm:gap-5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
        {/* Card 1: Awaiting Permission (Sum of Review Requests + Missed Visits) */}
        <div className="w-[52vw] max-w-[260px] sm:w-[260px] lg:w-auto shrink-0 lg:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.75rem] lg:rounded-[1rem] p-4 sm:p-5 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] border border-white/80 flex items-center justify-center text-amber-600/80 shrink-0">
              <Clock size={20} weight="bold" />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-wider truncate">
              Awaiting Permission
            </span>
          </div>
          <div className="text-2xl ml-1 sm:text-3xl font-extrabold text-zinc-800 tracking-tight">
            {metrics.awaitingPermission}
          </div>
          <div className="text-[11px] ml-1 text-zinc-500">Requires your review to send</div>
        </div>

        {/* Card 2: Sent / Completed */}
        <div className="w-[52vw] max-w-[260px] sm:w-[260px] lg:w-auto shrink-0 lg:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.75rem] lg:rounded-[1rem] p-4 sm:p-5 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] border border-white/80 flex items-center justify-center text-sky-600/80 shrink-0">
              <CheckCircle size={20} weight="bold" />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-wider truncate">
              Sent / Completed
            </span>
          </div>
          <div className="text-2xl ml-1 sm:text-3xl font-extrabold text-zinc-800 tracking-tight">
            {metrics.sentTotal}
          </div>
          <div className="text-[11px] ml-1 text-zinc-500">Logged in whatsapp_logs</div>
        </div>

        {/* Card 3: Review Requests (Treatment Done + 2 Days Passed) */}
        <div className="w-[52vw] max-w-[260px] sm:w-[260px] lg:w-auto shrink-0 lg:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.75rem] lg:rounded-[1rem] p-4 sm:p-5 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] border border-white/80 flex items-center justify-center shrink-0">
              <GoogleIcon size={18} />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-wider truncate">
              Review Requests
            </span>
          </div>
          <div className="text-2xl ml-1 sm:text-3xl font-extrabold text-zinc-800 tracking-tight">
            {metrics.reviewsPending}
          </div>
          <div className="text-[11px] ml-1 text-zinc-500">Treatment done 2+ days ago</div>
        </div>

        {/* Card 4: Missed Appointments (Reminder Sent, Never Arrived) */}
        <div className="w-[52vw] max-w-[260px] sm:w-[260px] lg:w-auto shrink-0 lg:shrink snap-center bg-[#e6ebf2] border border-white/80 rounded-[0.75rem] lg:rounded-[1rem] p-4 sm:p-5 relative overflow-hidden shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] border border-white/80 flex items-center justify-center text-rose-600/70 shrink-0">
              <CalendarX size={20} weight="bold" />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-wider truncate">
              Missed Visits
            </span>
          </div>
          <div className="text-2xl sm:text-3xl ml-1 font-extrabold text-zinc-800 tracking-tight">
            {metrics.missedPending}
          </div>
          <div className="text-[11px] ml-1 text-zinc-500">Reminder sent, never arrived</div>
        </div>
      </div>

      {/* Filter & Search Bar Container (Inward Inset Neumorphic Shell) */}
      <div className="bg-[#e6ebf2] border border-white/80 rounded-[0.5rem] p-4 sm:p-6 shadow-[inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          {/* 1. Search Box */}
          <div className="md:col-span-5 relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-700 transition-colors">
              <MagnifyingGlass size={16} weight="bold" />
            </div>
            <input
              type="text"
              placeholder="Search patient name, mobile or PM-ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[38px] pl-9 pr-3 bg-[#e6ebf2] rounded-[0.8rem] text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] focus:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-all font-medium"
            />
          </div>

          {/* 2. Status Segmented Switch */}
          <div className="md:col-span-4">
            <div className="w-full h-[38px] p-1 bg-[#e6ebf2] rounded-[0.8rem] shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] relative flex items-center select-none overflow-hidden">
              {/* Active Sliding Pill Indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-[0.75rem] bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/20 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  left:
                    statusFilter === 'pending'
                      ? '4px'
                      : statusFilter === 'sent'
                        ? 'calc(4px + (100% - 8px) / 3)'
                        : 'calc(4px + (100% - 8px) * 2 / 3)',
                }}
              />

              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`relative z-10 flex-1 h-full rounded-[0.75rem] text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer ${statusFilter === 'pending'
                  ? 'text-emerald-800 font-black'
                  : 'text-zinc-600 hover:text-zinc-900'
                  }`}
              >
                Pending ({metrics.awaitingPermission})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('sent')}
                className={`relative z-10 flex-1 h-full rounded-[0.75rem] text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer ${statusFilter === 'sent'
                  ? 'text-emerald-800 font-black'
                  : 'text-zinc-600 hover:text-zinc-900'
                  }`}
              >
                Sent ({metrics.sentTotal})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`relative z-10 flex-1 h-full rounded-[0.75rem] text-[11px] sm:text-xs font-bold transition-all duration-200 flex items-center justify-center cursor-pointer ${statusFilter === 'all'
                  ? 'text-emerald-900 font-black'
                  : 'text-zinc-600 hover:text-zinc-900'
                  }`}
              >
                All Logs
              </button>
            </div>
          </div>

          {/* 3. Custom Type Filter Pill Dropdown */}
          <div className="md:col-span-3 relative" ref={typeDropdownRef}>
            <button
              type="button"
              onClick={() => setTypeDropdownOpen((prev) => !prev)}
              className={`w-full h-[38px] px-3.5 bg-[#e6ebf2] rounded-[0.8rem] text-xs font-bold transition-all duration-150 flex items-center justify-between gap-2 cursor-pointer select-none ${typeDropdownOpen
                ? 'shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] text-zinc-900 ring-2 ring-emerald-500/20'
                : 'shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] text-zinc-700 hover:text-zinc-900 active:scale-[0.99]'
                }`}
              aria-haspopup="listbox"
              aria-expanded={typeDropdownOpen}
            >
              <div className="flex items-center gap-2 truncate">
                {typeFilter === 'all' && (
                  <ChatCircleDots size={17} weight="bold" className="text-zinc-600 shrink-0" />
                )}
                {typeFilter === 'google_review' && (
                  <GoogleIcon size={15} className="shrink-0" />
                )}
                {typeFilter === 'missed_followup' && (
                  <CalendarX size={16} weight="bold" className="text-rose-600/80 shrink-0" />
                )}
                <span className="truncate">
                  {typeFilter === 'all' && 'All Request Types'}
                  {typeFilter === 'google_review' && 'Review Requests'}
                  {typeFilter === 'missed_followup' && 'Missed Visits'}
                </span>
                <span className="text-[10px] font-extrabold text-zinc-500 shrink-0">
                  ({typeCounts[typeFilter] ?? 0})
                </span>
              </div>
              <CaretDown
                size={12}
                weight="bold"
                className={`text-zinc-500 transition-transform duration-200 shrink-0 ${typeDropdownOpen ? 'rotate-180 text-emerald-700' : ''
                  }`}
              />
            </button>

            {/* Custom Neumorphic Dropdown Menu Popover */}
            {typeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 w-full mt-1.5 z-40 bg-[#e6ebf2] border border-white/90 rounded-2xl p-1.5 shadow-[3px_3px_8px_#c2c9d4,-3px_-3px_8px_#ffffff] animate-in fade-in zoom-in-95 duration-150 space-y-1">
                {/* Option 1: All Message Types */}
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('all');
                    setTypeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-all cursor-pointer ${typeFilter === 'all'
                    ? 'bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/30 text-emerald-900 font-bold'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/50 font-medium active:scale-[0.99]'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] border border-white/80 flex items-center justify-center shrink-0 text-zinc-600">
                      <ChatCircleDots size={15} weight="bold" />
                    </div>
                    <span className="truncate">All Request Types</span>
                  </div>
                  <div className="flex items-center shrink-0">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                      {typeCounts.all}
                    </span>
                  </div>
                </button>

                {/* Option 2: Google Review Requests */}
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('google_review');
                    setTypeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-all cursor-pointer ${typeFilter === 'google_review'
                    ? 'bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/30 text-emerald-900 font-bold'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/50 font-medium active:scale-[0.99]'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] border border-white/80 flex items-center justify-center shrink-0">
                      <GoogleIcon size={14} />
                    </div>
                    <div className="truncate flex flex-col text-left">
                      <span className="truncate">Review Requests</span>
                      <span className="text-[9.5px] text-zinc-500 font-normal">Treatment done 2+ days ago</span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                      {typeCounts.google_review}
                    </span>
                  </div>
                </button>

                {/* Option 3: Missed Follow-ups */}
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter('missed_followup');
                    setTypeDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2.5 transition-all cursor-pointer ${typeFilter === 'missed_followup'
                    ? 'bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_rgba(0,0,0,0.22)] border border-white/30 text-emerald-900 font-bold'
                    : 'text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/50 font-medium active:scale-[0.99]'
                    }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-6 h-6 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#c5ccd6,-1.5px_-1.5px_3px_#ffffff] border border-white/80 flex items-center justify-center shrink-0 text-rose-600/80">
                      <CalendarX size={15} weight="bold" />
                    </div>
                    <div className="truncate flex flex-col text-left">
                      <span className="truncate">Missed Visits</span>
                      <span className="text-[9.5px] text-zinc-500 font-normal">Reminded, never arrived</span>
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6ebf2] text-emerald-800 shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] border border-white/60">
                      {typeCounts.missed_followup}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Count Bar & Reset Filter */}
      <div className="mt-4 sm:mt-6 mb-2 sm:mb-2.5 -mx-1 sm:mx-0 px-0 sm:px-3 text-xs text-zinc-500 w-auto sm:w-full flex flex-row items-center justify-between gap-2">
        <div className="flex items-center justify-start">
          {isAnyFilterActive ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer px-3 py-1 rounded-full bg-[#e6ebf2] shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6]"
            >
              <X size={12} weight="bold" />
              <span>Reset Filters</span>
            </button>
          ) : (
            statusFilter === 'pending' && filteredQueue.length > 0 && (
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Requires Doctor's Permission
              </span>
            )
          )}
        </div>

        <div className="flex items-center justify-end font-medium text-zinc-500 text-[11px] sm:text-xs text-right whitespace-nowrap ml-auto">
          <span>
            Showing <strong className="text-zinc-800">{filteredQueue.length}</strong> of <strong className="text-emerald-700 font-bold">{metrics.total}</strong> entries
          </span>
        </div>
      </div>

      {/* Main Queue List */}
      <div className="space-y-5 sm:space-y-4">

        {loading ? (
          <div className="bg-[#e6ebf2] border border-white/80 rounded-[1rem] p-12 text-center shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600/10 flex items-center justify-center animate-spin text-emerald-700">
              <ArrowClockwise size={20} weight="bold" />
            </div>
            <p className="text-xs text-zinc-500 font-medium">Scanning clinic queues & logs...</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="bg-[#e6ebf2] border border-white/80 rounded-[1rem] p-12 text-center shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c5ccd6] flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700">
              <CheckCircle size={26} weight="duotone" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">No Pending Notifications Found</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                {statusFilter === 'pending'
                  ? 'Once Treatments are marked as done or scheduled for follow-up, they will appear here for the Approval.'
                  : 'No records match the selected filters.'}
              </p>
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-3 px-4 py-1.5 bg-[#e6ebf2] text-xs font-bold text-emerald-700 rounded-full shadow-[2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 transition-all cursor-pointer border border-white/70"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredQueue.map((item) => {
            const typeInfo = getTypeBadge(item.message_type);
            const isExpanded = expandedMessageId === item.id;
            const messagePreview = buildNotificationMessage(
              item.message_type,
              item.patient?.name,
              item.scheduled_for
            );
            const isPending = item.status === 'pending';
            const isSent = item.status === 'sent';

            return (
              <div
                key={item.id}
                className="bg-[#e6ebf2] border border-white/80 rounded-[1rem] p-4 sm:p-5 shadow-[inset_3px_3px_8px_#ffffff,inset_-3px_-3px_8px_#c5ccd6] transition-all hover:border-white space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Patient Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedPatient({
                          ...item.patient,
                          visit: item.visit,
                          scheduled_for: item.scheduled_for
                        })
                      }
                      title="Click to view patient clinical details"
                      className="w-10 h-10 rounded-xl bg-[#e6ebf2] shadow-[2px_2px_4px_#c2c9d4,-2px_-2px_4px_#ffffff] hover:shadow-[inset_1px_1px_2px_#c2c9d4] active:scale-95 border border-white/80 flex items-center justify-center text-emerald-800 font-bold shrink-0 text-sm cursor-pointer transition-all select-none"
                    >
                      {item.patient?.name ? item.patient.name.charAt(0).toUpperCase() : 'P'}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="font-bold text-sm text-zinc-900 shrink-0">
                          {item.patient?.name || 'Patient'}
                        </span>
                        {item.patient?.patient_id_code && (
                          <span className="hidden sm:inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#e6ebf2] shadow-[inset_1px_1px_2px_#c2c9d4,inset_-1px_-1px_2px_#ffffff] text-emerald-800 shrink-0">
                            {item.patient.patient_id_code}
                          </span>
                        )}
                        <span
                          className={`text-[10px] sm:text-[10.5px] font-bold px-2 sm:px-2.5 py-1 rounded-full border flex items-center gap-1 min-w-0 shrink overflow-hidden ${typeInfo.className}`}
                        >
                          <typeInfo.icon size={14} weight="bold" className="shrink-0" />
                          <span className="truncate">{typeInfo.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1 flex-wrap">
                        <span className="hidden sm:flex items-center gap-1">
                          <Phone size={12} weight="bold" />
                          <span>+91 {item.patient?.mobile || 'No Mobile'}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span>
                          {item.message_type === 'google_review' ? 'Treatment Date: ' : 'Scheduled Date: '}
                          <strong className="text-zinc-700">
                            {new Date(
                              (item.message_type === 'google_review' && item.visit?.visit_date
                                ? item.visit.visit_date
                                : item.scheduled_for) + 'T00:00:00'
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedMessageId(isExpanded ? null : item.id)}
                      className="px-3 py-1.5 rounded-full bg-[#e6ebf2] border border-white/70 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] text-[11px] font-bold text-zinc-600 hover:text-emerald-800 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={15} weight="bold" className="text-emerald-800" />
                      <span>{isExpanded ? 'Hide' : 'Preview'}</span>
                      {isExpanded ? <CaretUp size={11} /> : <CaretDown size={11} />}
                    </button>

                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: 'skip', item })}
                          disabled={actionInProgressId === item.id}
                          className="h-[30px] w-[72px] rounded-full bg-[#e6ebf2] border border-white/70 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] text-[11px] font-bold text-zinc-600 hover:text-rose-600 transition-all inline-flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                          title="Skip and do not send"
                        >
                          <XCircle size={15} weight="bold" />
                          <span>Skip</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: 'approve', item })}
                          disabled={actionInProgressId === item.id}
                          className="px-4 py-2 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold text-[11.5px] rounded-full shadow-[2px_2px_6px_#c5ccd6,-2px_-2px_6px_#ffffff] hover:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(255,255,255,0.4)] active:scale-95 transition-all duration-150 ease-out inline-flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/40 group/btn disabled:opacity-50"
                        >
                          <span>Approve</span>
                          <ArrowRight size={13} weight="bold" className="group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      </>
                    ) : isSent ? (
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-400/15 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <CheckCircle size={16} weight="bold" className="text-emerald-600" />
                        <span>Sent {item.sent_at ? new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </span>
                    ) : (
                      <>
                        <span className="h-[30px] w-[72px] text-[11px] font-bold text-zinc-500 bg-zinc-200/60 border border-zinc-300/60 rounded-full inline-flex items-center justify-center shrink-0">
                          Skipped
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnskip(item)}
                          disabled={actionInProgressId === item.id}
                          className="px-4 py-1.5 rounded-full bg-[#e6ebf2] border border-white/70 shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] text-[11px] font-bold text-zinc-600 hover:text-emerald-700 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Restore to pending queue"
                        >
                          <ArrowClockwise
                            size={14}
                            weight="bold"
                            className={`text-emerald-700 ${actionInProgressId === item.id ? 'animate-spin' : ''}`}
                          />
                          <span>Unskip</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Collapsible Message Template Preview */}
                {isExpanded && (
                  <div className="pt-2 border-t border-zinc-300/50 animate-in fade-in duration-200">
                    <div className="bg-[#edf1f7] p-3 rounded-xl border border-white/90 shadow-[inset_2px_2px_4px_#c8d0db,inset_-2px_-2px_4px_#ffffff] relative">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-300/50">
                        <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1">
                          <WhatsappLogo size={17} className="text-emerald-600" />
                          <span>WhatsApp Template</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(item)}
                          className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy size={12} weight="bold" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <pre className="text-xs text-zinc-800 font-sans whitespace-pre-wrap leading-relaxed select-text">
                        {messagePreview}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Patient Clinical Profile Details Modal via Portal (Exact match to Dashboard page) */}
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
                  title={selectedPatient.last_visit_at || selectedPatient.visit?.visit_date || selectedPatient.scheduled_for}
                >
                  {selectedPatient.last_visit_at || selectedPatient.visit?.visit_date || selectedPatient.scheduled_for || new Date().toISOString().split('T')[0]}
                </div>

                {/* 2. Token No. */}
                <div
                  className="absolute font-bold text-emerald-700 truncate leading-none text-[10px] sm:text-[11px] text-left"
                  style={{ top: '20.4%', left: '68.5%', maxWidth: '24%' }}
                >
                  {selectedPatient.visit?.token_number
                    ? `#${selectedPatient.visit.token_number}`
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
            <div className="shrink-0 flex items-center justify-center pt-3 border-t border-zinc-300/50 w-full">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="w-full sm:w-44 py-2.5 rounded-full text-xs font-bold text-zinc-600 hover:text-rose-600 bg-[#e6ebf2] shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 border border-white/80 transition-all duration-150 ease-out flex items-center justify-center cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Action Confirmation Modal via Portal (Are You Sure for Skip / Approve) */}
      {mounted && confirmAction && createPortal(
        <div
          onClick={() => setConfirmAction(null)}
          className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e6ebf2] border border-white rounded-[1.5rem] p-5 sm:p-6 max-w-md w-full shadow-[8px_8px_28px_rgba(0,0,0,0.3),inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)] relative animate-in zoom-in-95 duration-200 space-y-4"
          >
            {confirmAction.type === 'approve_all' ? (
              <>
                {/* Bulk Approve Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-300/60">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] border border-white/80 flex items-center justify-center shrink-0 text-emerald-700">
                      <CheckCircle size={24} weight="duotone" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
                        Approve All Notifications?
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        Bulk approve {confirmAction.count} pending reminder{confirmAction.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>

                {/* Bulk Info Summary Card */}
                <div className="p-4 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_5px_#c8d0db,inset_-2px_-2px_5px_#ffffff] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700">Notifications To Approve:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 font-extrabold text-xs">
                      {confirmAction.count} Pending
                    </span>
                  </div>
                </div>

                <p className="text-[12px] text-zinc-700 px-1 leading-snug">
                  Are you sure you want to approve all <strong>{confirmAction.count}</strong> notifications?{' '}
                  <span className="text-[10px] text-zinc-500/90 font-normal italic">
                    This will update their status to sent in the database.
                  </span>
                </p>

                {/* Confirmation Actions */}
                <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 pt-3 border-t border-zinc-300/50 w-full">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="flex-[0.85] sm:flex-none sm:w-36 py-2.5 rounded-full text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-[#e6ebf2] shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 border border-white/80 transition-all duration-150 ease-out flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const ids = confirmAction.ids;
                      setConfirmAction(null);
                      handleConfirmApproveAll(ids);
                    }}
                    className="flex-[1.25] sm:flex-none sm:w-48 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 group whitespace-nowrap"
                  >
                    <CheckCircle size={16} weight="bold" className="group-hover:scale-110 transition-transform" />
                    <span>Yes, Approve All ({confirmAction.count})</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Confirmation Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-300/60">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-11 h-11 rounded-2xl bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] border border-white/80 flex items-center justify-center shrink-0 ${
                        confirmAction.type === 'approve' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {confirmAction.type === 'approve' ? (
                        <CheckCircle size={24} weight="duotone" />
                      ) : (
                        <XCircle size={24} weight="duotone" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-zinc-900 leading-tight">
                        {confirmAction.type === 'approve' ? 'Approve & Send?' : 'Skip Notification?'}
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        {confirmAction.type === 'approve'
                          ? 'Mark as sent'
                          : 'Dismiss from reminder queue'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[2px_2px_4px_#c5ccd6,-2px_-2px_4px_#ffffff] active:shadow-[inset_1px_1px_2px_#c5ccd6] border border-white/70 flex items-center justify-center text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>

                {/* Patient Info Summary Card */}
                <div className="p-4 bg-[#e6ebf2] rounded-2xl shadow-[inset_2px_2px_5px_#c8d0db,inset_-2px_-2px_5px_#ffffff] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {confirmAction.item.patient?.patient_id_code && (
                        <span className="font-mono text-[11px] font-extrabold text-emerald-800 px-2 py-0.5 rounded-md bg-[#e6ebf2] shadow-[1px_1px_2px_#c2c9d4,-1px_-1px_2px_#ffffff] border border-white/80">
                          {confirmAction.item.patient.patient_id_code}
                        </span>
                      )}
                      <h4 className="text-sm font-bold text-zinc-900">
                        {confirmAction.item.patient?.name || 'Patient'}
                      </h4>
                    </div>
                    {confirmAction.item.patient?.age && (
                      <span className="text-xs font-semibold text-zinc-500">
                        {confirmAction.item.patient.age} yrs
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-zinc-600 pt-2 border-t border-zinc-300/40">
                    <span className="flex items-center gap-1.5 font-sans font-semibold text-[12px] text-zinc-700 tracking-wide">
                      <Phone size={13} weight="bold" className="text-zinc-500 shrink-0" />
                      <span>+91 {confirmAction.item.patient?.mobile || 'No contact'}</span>
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500">
                      {confirmAction.item.message_type === 'google_review' ? 'Google Review' : 'Missed Appointment'}
                    </span>
                  </div>
                </div>

                <p className="text-[12px] text-zinc-700 px-1 leading-snug">
                  {confirmAction.type === 'approve' ? (
                    <>
                      Are you sure you want to approve this reminder for{' '}
                      <strong className="text-zinc-900">{confirmAction.item.patient?.name || 'this patient'}</strong>?{' '}
                      <span className="text-[10px] text-zinc-500/90 font-normal italic">
                        This will send personalized WhatsApp message to the patient.
                      </span>
                    </>
                  ) : (
                    <>
                      Are you sure you want to skip this notification for{' '}
                      <strong className="text-zinc-900">{confirmAction.item.patient?.name || 'this patient'}</strong>?{' '}
                      <span className="text-[10px] text-zinc-500/90 font-normal italic">
                        You can still unskip it anytime from All Logs.
                      </span>
                    </>
                  )}
                </p>

                {/* Confirmation Actions */}
                <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 pt-3 border-t border-zinc-300/50 w-full">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="flex-[0.85] sm:flex-none sm:w-36 py-2.5 rounded-full text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-[#e6ebf2] shadow-[3px_3px_7px_#c5ccd6,-3px_-3px_7px_#ffffff] hover:shadow-[inset_1px_1px_3px_#c5ccd6] active:scale-95 border border-white/80 transition-all duration-150 ease-out flex items-center justify-center cursor-pointer"
                  >
                    Cancel
                  </button>

                  {confirmAction.type === 'approve' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const item = confirmAction.item;
                        setConfirmAction(null);
                        handleApproveAndSend(item);
                      }}
                      className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 group whitespace-nowrap"
                    >
                      <CheckCircle size={16} weight="bold" className="group-hover:scale-110 transition-transform" />
                      <span>Yes, Approve</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const item = confirmAction.item;
                        setConfirmAction(null);
                        handleSkip(item);
                      }}
                      className="flex-[1.25] sm:flex-none sm:w-44 py-2.5 bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-700 text-white font-bold text-xs rounded-full shadow-[3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[4px_4px_10px_#c0c8d4,-4px_-4px_10px_#ffffff] active:scale-95 transition-all duration-150 ease-out flex items-center justify-center gap-2 cursor-pointer border border-rose-500/40 group whitespace-nowrap"
                    >
                      <XCircle size={17} weight="bold" className="group-hover:scale-110 transition-transform" />
                      <span>Yes, Skip</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
