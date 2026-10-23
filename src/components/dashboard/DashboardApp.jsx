import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginView } from './LoginView';
import { DashboardShell } from './DashboardShell';
import { NewPatientView } from './NewPatientView';
import { ExistingPatientView } from './ExistingPatientView';
import { DoctorDashboardView } from './DoctorDashboardView';
import { NotificationView } from './NotificationView';
import { CircleNotch } from '@phosphor-icons/react';

// Unified Hash Parser for PWA & Browser History navigation
const parseDashboardHash = (hash) => {
  const clean = (hash || '').replace(/^#\/?/, '').trim();
  if (!clean || clean === 'dashboard') {
    return { tab: 'dashboard', date: null, month: null };
  }
  if (clean.startsWith('dashboard/date/')) {
    const date = clean.replace('dashboard/date/', '').trim();
    return { tab: 'dashboard', date: date || null, month: null };
  }
  if (clean === 'existing-patient') {
    return { tab: 'existing-patient', date: null, month: null };
  }
  if (clean.startsWith('existing-patient/month/')) {
    const month = clean.replace('existing-patient/month/', '').trim();
    return { tab: 'existing-patient', date: null, month: month || null };
  }
  if (clean === 'new-patient') {
    return { tab: 'new-patient', date: null, month: null };
  }
  if (clean === 'notifications' || clean === 'notification') {
    return { tab: 'notifications', date: null, month: null };
  }
  return { tab: 'dashboard', date: null, month: null };
};

// Unified Hash Builder
const buildDashboardHash = (tab, date, month) => {
  if (tab === 'dashboard') {
    return date ? `#dashboard/date/${date}` : '#dashboard';
  }
  if (tab === 'existing-patient') {
    return month ? `#existing-patient/month/${month}` : '#existing-patient';
  }
  if (tab === 'new-patient') {
    return '#new-patient';
  }
  if (tab === 'notifications') {
    return '#notifications';
  }
  return '#dashboard';
};

const DashboardContent = () => {
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return parseDashboardHash(window.location.hash).tab;
    }
    return 'dashboard';
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return parseDashboardHash(window.location.hash).date;
    }
    return null;
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return parseDashboardHash(window.location.hash).month;
    }
    return null;
  });

  // Synchronize state when browser navigation occurs (e.g. Android back button or gesture)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only initialize and synchronize hash history if user is authenticated
    if (!user) return;

    const handleSyncFromHash = () => {
      const parsed = parseDashboardHash(window.location.hash);
      setActiveTab(parsed.tab);
      setSelectedDate(parsed.date);
      setSelectedMonth(parsed.month);
    };

    // Initialize root in browser history if starting cold
    const currentHash = window.location.hash;
    if (!currentHash || currentHash === '#' || currentHash === '#/') {
      window.history.replaceState(null, '', '#dashboard');
      handleSyncFromHash();
    } else if (currentHash !== '#dashboard') {
      // Ensure #dashboard is the root in history stack so back button can reach it
      window.history.replaceState(null, '', '#dashboard');
      window.history.pushState(null, '', currentHash);
      handleSyncFromHash();
    } else {
      handleSyncFromHash();
    }

    window.addEventListener('popstate', handleSyncFromHash);
    window.addEventListener('hashchange', handleSyncFromHash);

    return () => {
      window.removeEventListener('popstate', handleSyncFromHash);
      window.removeEventListener('hashchange', handleSyncFromHash);
    };
  }, [user]);

  // Handlers that update history entries
  const handleTabChange = (newTab) => {
    const parsed = parseDashboardHash(window.location.hash);

    // If tapping current tab while in a detail sub-view, reset back to overview
    if (newTab === parsed.tab) {
      if (newTab === 'dashboard' && parsed.date) {
        window.location.hash = '#dashboard';
        return;
      }
      if (newTab === 'existing-patient' && parsed.month) {
        window.location.hash = '#existing-patient';
        return;
      }
      return;
    }

    const targetHash = buildDashboardHash(newTab, null, null);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleSelectDate = (dateKey) => {
    if (dateKey) {
      const targetHash = buildDashboardHash('dashboard', dateKey, null);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    } else {
      if (window.location.hash.includes('/date/')) {
        window.history.back();
      } else {
        window.location.hash = '#dashboard';
      }
    }
  };

  const handleSelectMonth = (monthKey) => {
    if (monthKey) {
      const targetHash = buildDashboardHash('existing-patient', null, monthKey);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    } else {
      if (window.location.hash.includes('/month/')) {
        window.history.back();
      } else {
        window.location.hash = '#existing-patient';
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#e6ebf2] text-zinc-900 flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white border border-zinc-200 flex items-center justify-center shadow-[0_4px_20px_rgba(16,185,129,0.15)] animate-pulse overflow-hidden">
            <img src="/logo.png" alt="Clinic Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 font-medium">
            <CircleNotch size={18} className="animate-spin text-emerald-600" />
            <span>Connecting...</span>
          </div>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render the Login screen
  if (!user) {
    return <LoginView />;
  }

  // Authenticated: Render Main Dashboard Shell with preserved tab views
  return (
    <DashboardShell activeTab={activeTab} onTabChange={handleTabChange}>
      <div className={activeTab === 'new-patient' ? 'block' : 'hidden'}>
        <NewPatientView onNavigate={handleTabChange} />
      </div>
      <div className={activeTab === 'existing-patient' ? 'block' : 'hidden'}>
        <ExistingPatientView
          selectedMonth={selectedMonth}
          onSelectMonth={handleSelectMonth}
        />
      </div>
      <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
        <DoctorDashboardView
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      </div>
      <div className={activeTab === 'notifications' ? 'block' : 'hidden'}>
        <NotificationView />
      </div>
    </DashboardShell>
  );
};

export default function DashboardApp() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
