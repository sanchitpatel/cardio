import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import {
  UserCirclePlus,
  UserList,
  SquaresFour,
  SignOut,
  UserCircle,
  CalendarCheck,
  CaretUp,
  Bell
} from '@phosphor-icons/react';
import {
  getPendingNotificationCount,
  subscribeToClinicRealtime
} from '../../services/clinicService';

export const DashboardShell = ({ activeTab, onTabChange, children }) => {
  const { user, signOut } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const profileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const mobileProfileBtnRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCount = async () => {
      const res = await getPendingNotificationCount();
      if (isMounted && res.success) {
        setPendingCount(res.count);
      }
    };
    fetchCount();

    const unsubscribe = subscribeToClinicRealtime(() => {
      fetchCount();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
      if (
        mobileProfileRef.current &&
        !mobileProfileRef.current.contains(event.target) &&
        mobileProfileBtnRef.current &&
        !mobileProfileBtnRef.current.contains(event.target)
      ) {
        setMobileProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    {
      id: 'new-patient',
      label: 'New Patient',
      icon: UserCirclePlus,
      description: 'Register new patient',
    },
    {
      id: 'existing-patient',
      label: 'Existing Patient',
      icon: UserList,
      description: 'Search records',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: SquaresFour,
      description: 'Daily queues & statistics',
    },
    {
      id: 'notifications',
      label: 'Notification',
      icon: Bell,
      description: 'WhatsApp reminders',
      badge: pendingCount,
    },
  ];

  return (
    <div className="h-screen w-full bg-[#e6ebf2] text-zinc-800 flex flex-col md:flex-row font-sans selection:bg-emerald-500/20 selection:text-emerald-900 overflow-hidden">

      {/* ========================================================
          1. DESKTOP SIDEBAR (Soft Slate Neumorphic Theme)
          ======================================================== */}
      <aside className="hidden md:flex flex-col w-60 lg:w-64 bg-[#e6ebf2] border-r border-zinc-300/60 shrink-0 h-full z-30 shadow-[4px_0_16px_#c8d0db]">

        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-300/50 flex items-center gap-2.5">
          <div className="w-14 h-14 rounded-full bg-[#e6ebf2] shadow-[4px_4px_8px_#c2c9d4,-4px_-4px_8px_#ffffff] border border-white/60 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/logo.png" alt="Dr. Pragya Mishra Clinic Logo" className="w-full h-full object-contain" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-base font-bold tracking-tight text-zinc-900 truncate">
              Dr. Pragya Mishra
            </h1>
            <p className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase mt-0.5">
              Clinical Portal
            </p>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="flex-1 px-3 py-5 space-y-2 overflow-y-auto">
          <div className="px-3 pb-1.5 text-[10px] font-bold text-zinc-500 tracking-wider uppercase">
            Main Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left text-sm transition-all duration-200 group cursor-pointer ${isActive
                  ? 'bg-[#e6ebf2] text-emerald-900 shadow-[3px_3px_8px_#c6ced9,-3px_-3px_8px_#ffffff] border border-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900 hover:shadow-[inset_3px_3px_6px_#c8d0db,inset_-3px_-3px_6px_#ffffff] font-medium border border-transparent'
                  }`}
              >
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all shrink-0 ${isActive
                  ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]'
                  : 'bg-[#e6ebf2] text-zinc-500 shadow-[inset_1px_1px_3px_#c8d0db,inset_-1px_-1px_3px_#ffffff] group-hover:text-emerald-700'
                  }`}>
                  <Icon size={24} weight={isActive ? 'regular' : 'duotone'} />
                </div>
                <div className="flex-1 min-w-0 truncate">
                  <div className="leading-tight truncate">{item.label}</div>
                  <div className="text-[11px] text-zinc-500 font-normal truncate mt-0.5">{item.description}</div>
                </div>
                {item.badge > 0 && (
                  <span className="shrink-0 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-800 border border-amber-500/30 shadow-[inset_1px_1px_2px_#ffffff]">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Doctor / Assistant Session Profile & Expandable Signout */}
        <div
          ref={profileRef}
          className="m-3 p-3 rounded-2xl bg-[#e6ebf2] border border-white/80 shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6] transition-all duration-300 ease-out"
        >
          {/* Header Row Trigger */}
          <button
            type="button"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="w-full flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] border border-white/50 flex items-center justify-center text-emerald-800 text-xs font-bold shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-zinc-800 truncate">
                {user?.email || 'Authenticated User'}
              </div>
            </div>
            <div className="text-zinc-400 group-hover:text-zinc-600">
              <CaretUp size={14} weight="bold" className={`transition-transform duration-300 ease-out ${profileMenuOpen ? 'rotate-180 text-emerald-700' : ''}`} />
            </div>
          </button>

          {/* Smooth Connected Accordion Expansion for Sign Out */}
          <div
            className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${profileMenuOpen ? 'grid-rows-[1fr] opacity-100 mt-2.5 pt-2.5 border-t border-zinc-300/50' : 'grid-rows-[0fr] opacity-0 mt-0 pt-0 border-t-0 border-transparent'
              }`}
          >
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-100/50 hover:bg-rose-100/80 shadow-[inset_2px_2px_4px_#ddb6b6,inset_-2px_-2px_4px_#ffffff] hover:shadow-[inset_3px_3px_5px_#ddb6b6,inset_-3px_-3px_5px_#ffffff] active:scale-[0.98] transition-all cursor-pointer border border-rose-300/60"
              >
                <SignOut size={15} weight="bold" />
                <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================
          2. MOBILE BOTTOM APP BAR (Native Mobile App Experience)
          ======================================================== */}
      {/* Mobile Profile Drop-up Popup Menu */}
      {mobileProfileOpen && (
        <div
          ref={mobileProfileRef}
          className="md:hidden fixed bottom-20 right-3 z-50 w-64 bg-[#e6ebf2] border border-white/90 rounded-2xl p-4 shadow-[inset_3px_3px_6px_#ffffff,inset_-3px_-3px_6px_#c5ccd6,0_8px_20px_rgba(0,0,0,0.12)] transition-all duration-200 ease-out"
        >
          <div className="flex items-center gap-2.5 pb-3 mb-3 border-b border-zinc-300/60">
            <div className="w-8 h-8 rounded-full bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_#c2c9d4] border border-white/60 flex items-center justify-center text-emerald-800 text-xs font-bold shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-zinc-800 truncate">
                {user?.email || 'Authenticated User'}
              </div>
              <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">
                Active Session
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-100/60 hover:bg-rose-100/90 shadow-[inset_2px_2px_4px_#ddb6b6,inset_-2px_-2px_4px_#ffffff] hover:shadow-[inset_3px_3px_5px_#ddb6b6,inset_-3px_-3px_5px_#ffffff] active:scale-[0.98] transition-all cursor-pointer border border-rose-300/60"
          >
            <SignOut size={15} weight="bold" />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#e6ebf2]/95 backdrop-blur-lg border-t border-zinc-300/70 shadow-[0_-4px_16px_#c8d0db] px-2 py-1.5">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileProfileOpen(false);
                }}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${isActive
                    ? 'text-emerald-800 font-bold'
                    : 'text-zinc-500 font-medium hover:text-zinc-800'
                  }`}
              >
                <div className="relative">
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-200 mb-0.5 ${isActive
                        ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff]'
                        : 'bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_#c8d0db] text-zinc-500'
                      }`}
                  >
                    <Icon size={22} weight={isActive ? 'bold' : 'duotone'} />
                  </div>
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white font-extrabold text-[9px] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Profile Trigger Button on mobile */}
          <button
            ref={mobileProfileBtnRef}
            type="button"
            onClick={() => setMobileProfileOpen((prev) => !prev)}
            title="Profile"
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all duration-200 cursor-pointer ${mobileProfileOpen
                ? 'text-emerald-800 font-bold'
                : 'text-zinc-500 font-medium hover:text-zinc-800'
              }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-200 mb-0.5 ${mobileProfileOpen
                  ? 'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),2px_2px_5px_#c5ccd6,-2px_-2px_5px_#ffffff]'
                  : 'bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#ffffff,inset_-2px_-2px_4px_#c8d0db] text-zinc-500'
                }`}
            >
              <UserCircle size={22} weight={mobileProfileOpen ? 'bold' : 'duotone'} />
            </div>
            <span className="text-[10px] tracking-tight">Profile</span>
          </button>
        </div>
      </nav>

      {/* ========================================================
          3. MAIN CONTENT WORKSPACE
          ======================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-full bg-[#e6ebf2] overflow-y-scroll [scrollbar-gutter:stable] pb-20 md:pb-0">
        {/* Top Header info bar (Desktop only) */}
        <div className="hidden md:flex items-center justify-between px-8 py-3.5 border-b border-zinc-300/50 bg-[#e6ebf2]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              {navItems.find(i => i.id === activeTab)?.label}
            </span>
            <span className="text-zinc-400">/</span>
            <span className="text-xs text-zinc-600 font-medium">
              {navItems.find(i => i.id === activeTab)?.description}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-700 font-medium px-3.5 py-1.5 rounded-full bg-[#e6ebf2] shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] border border-white/40">
              <CalendarCheck size={18} className="text-emerald-700" weight="bold" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* View Container */}
        <div className="flex-1 px-4 pt-12 pb-6 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
