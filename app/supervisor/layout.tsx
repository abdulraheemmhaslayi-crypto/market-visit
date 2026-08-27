'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/providers/theme-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardList,
  PlusCircle,
  User,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Activity,
  Plus,
  Home,
  MapPin,
  BarChart3,
  ArrowLeft,
  Thermometer,
  Camera,
} from 'lucide-react';
import { isFleetRole } from '@/lib/roles';

const FLEET_NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { name: 'Cold Chain Status', path: '/supervisor', icon: Thermometer },
    ],
  },
];

const navGroups = [
  {
    label: 'Operations',
    items: [
      { name: 'My Visits', path: '/supervisor', icon: ClipboardList },
      { name: 'New Audit', path: '/supervisor/visit', icon: PlusCircle },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { name: 'Reports', path: '/supervisor/reports', icon: BarChart3 },
      { name: 'Audit Photo Gallery', path: '/supervisor/photos', icon: Camera },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Profile', path: '/supervisor/profile', icon: User },
    ],
  },
];

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noVisitCount, setNoVisitCount] = useState(0);
  
  const canGoBack = pathname !== '/supervisor';
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const supervisorNavActions = [
    { name: 'Dashboard', path: '/supervisor', icon: Home },
    { name: 'My Visits', path: '/supervisor/my-visits', icon: MapPin },
    { name: 'New Audit Wizard', path: '/supervisor/visit', icon: Plus },
    { name: 'Reports & Stats', path: '/supervisor/reports', icon: BarChart3 },
    { name: 'Audit Photo Gallery', path: '/supervisor/photos', icon: Camera },
    { name: 'My Profile', path: '/supervisor/profile', icon: User },
    { name: 'Toggle Light/Dark Theme', action: 'theme', icon: Moon },
    { name: 'Log Out Session', action: 'logout', icon: LogOut },
  ];

  const handleNavigate = (item: any) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (item.path) {
      router.push(item.path);
    } else if (item.action === 'theme') {
      toggleTheme();
    } else if (item.action === 'logout') {
      handleSignOut();
    }
  };

  useEffect(() => {
    if (!session?.user) return;

    let active = true;
    const loadNoVisitCount = async () => {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        if (active && data?.success) {
          setNoVisitCount(Number(data.noVisitCount || 0));
        }
      } catch {
        if (active) setNoVisitCount(0);
      }
    };

    loadNoVisitCount();
    const timer = window.setInterval(loadNoVisitCount, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [session?.user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const user = session?.user as any;
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'S';
  const userName = user?.name || 'Supervisor';
  const userRole = user?.role || 'Supervisor';
  const isFleet = isFleetRole(userRole);
  const visibleNavGroups = isFleet ? FLEET_NAV_GROUPS : navGroups;

  // Close user menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleSignOut = () => signOut({ callbackUrl: '/login' });

  const isActive = (path: string) =>
    path === '/supervisor' ? pathname === '/supervisor' : pathname.startsWith(path);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="h-full flex overflow-hidden min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
    >
      {/* ═══════════ SIDEBAR ═══════════ */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        style={{
          width: 'var(--sidebar-w)',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          flexShrink: 0,
        }}
        className={`
          fixed md:sticky top-0 h-screen z-50
          flex flex-col overflow-hidden
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{
            height: 'var(--topbar-h)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            S
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-none truncate" style={{ color: 'var(--text-primary)' }}>
              Supervisor Portal
            </p>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              Field Operations
            </p>
          </div>
          <button
            className="ml-auto md:hidden p-1 rounded cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-grow overflow-y-auto px-3 py-4 space-y-5">
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              <p
                className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`nav-item ${active ? 'active' : ''}`}
                    >
                      <Icon
                        className="h-4 w-4 flex-shrink-0"
                        style={{ opacity: active ? 1 : 0.6 }}
                      />
                      <span>{item.name}</span>
                      {!isFleet && (item.path === '/supervisor' || item.path === '/supervisor/reports') && (
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                          No Visit {noVisitCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div
          className="flex-shrink-0 p-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* User Card */}
          <div
            className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg mb-2 cursor-default"
            style={{ background: 'var(--surface-2)' }}
          >
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white"
              style={{ background: 'var(--accent)' }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-grow">
              <p className="text-[12px] font-semibold leading-none truncate" style={{ color: 'var(--text-primary)' }}>
                {userName}
              </p>
              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {userRole}
              </p>
            </div>
          </div>

          <div className="space-y-0.5">
            <button
              onClick={toggleTheme}
              className="nav-item w-full text-left"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 flex-shrink-0" style={{ opacity: 0.6 }} />
              ) : (
                <Moon className="h-4 w-4 flex-shrink-0" style={{ opacity: 0.6 }} />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="nav-item w-full text-left"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════ MAIN AREA ═══════════ */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* ─── TOP BAR ─────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6"
          style={{
            height: 'var(--topbar-h)',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Hamburger (mobile) */}
          <button
            className="md:hidden p-1.5 rounded-lg cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Back button (on subpages, desktop & mobile) */}
          {canGoBack && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-solid border-[var(--border)] hover:bg-[var(--surface-2)] transition-all cursor-pointer"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}
              title="Go Back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider">Back</span>
            </button>
          )}

          {/* Search bar with dropdown actions */}
          <div
            className="flex items-center gap-2 flex-grow max-w-xs h-9 px-3 rounded-lg cursor-text relative"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search / Ctrl+K…"
              className="flex-grow bg-transparent outline-none text-[13px] placeholder:text-[var(--text-muted)]"
              style={{ color: 'var(--text-primary)' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            />
            <kbd
              className="hidden md:inline-flex items-center px-1.5 rounded text-[10px] font-mono"
              style={{
                background: 'var(--border)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              Ctrl+K
            </kbd>

            {searchOpen && (
              <div
                className="absolute left-0 right-0 top-11 z-50 p-2 rounded-xl shadow-xl border border-solid border-[var(--border)] overflow-hidden max-h-[280px] overflow-y-auto"
                style={{ background: 'var(--surface)', minWidth: '220px' }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-2.5 py-1 text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Quick Navigation
                </div>
                {supervisorNavActions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <p className="px-2.5 py-3 text-[11px] italic text-[var(--text-muted)]">No results match "{searchQuery}"</p>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {supervisorNavActions
                      .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.name}
                            onClick={() => handleNavigate(item)}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[12px] font-semibold transition-all hover:bg-[var(--surface-2)] text-[var(--text-primary)] hover:text-[var(--accent)]"
                          >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{item.name}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right cluster */}
          <div className="ml-auto flex items-center gap-2">
            {/* Date */}
            <span
              className="hidden lg:block text-[12px] font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {dateStr}
            </span>

            {/* Live indicator */}
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[11px] font-semibold"
              style={{
                background: 'var(--success-light)',
                color: 'var(--success)',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-dot" style={{ background: 'var(--success)' }} />
              Live
            </div>

            {/* Notifications */}
            <button
              className="relative h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--danger)' }}
              />
            </button>

            {/* Activity */}
            <button
              className="hidden md:flex h-8 w-8 rounded-lg items-center justify-center cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              title="Activity"
            >
              <Activity className="h-4 w-4" />
            </button>

            {/* Divider */}
            <div
              className="h-5 w-px mx-1"
              style={{ background: 'var(--border)' }}
            />

            {/* User profile menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                className="flex items-center gap-2 h-8 px-2 rounded-lg cursor-pointer transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  {initial}
                </div>
                <span
                  className="hidden md:block text-[13px] font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {userName.split(' ')[0]}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 hidden md:block transition-transform duration-150"
                  style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl py-1 z-50 animate-slide-up"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-dropdown)',
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{userName}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{user?.email || userRole}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { toggleTheme(); setUserMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-4 h-9 text-[13px] transition-colors cursor-pointer"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                    </button>
                  </div>
                  <div
                    className="py-1"
                    style={{ borderTop: '1px solid var(--border-soft)' }}
                  >
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 w-full px-4 h-9 text-[13px] transition-colors cursor-pointer"
                      style={{ color: 'var(--danger)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ─── PAGE CONTENT ─────────────────────────── */}
        <main className="flex-grow overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <div className="max-w-screen-2xl mx-auto p-5 md:p-6 pb-24 md:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* ── Bottom Sticky Tab-Bar (Mobile Devices Only) ── */}
      {isFleet ? (
        <footer
          className="md:hidden fixed bottom-0 left-0 right-0 z-45 py-2 px-3 flex items-center justify-center"
          style={{
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.05)',
            height: '64px',
          }}
        >
          <div className="flex flex-col items-center justify-center gap-0.5" style={{ color: 'var(--accent)' }}>
            <Thermometer className="h-5 w-5" />
            <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: 700 }}>Cold Chain Status</span>
          </div>
        </footer>
      ) : (
      <footer
        className="md:hidden fixed bottom-0 left-0 right-0 z-45 py-2 px-3 flex items-center justify-around"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.05)',
          height: '64px',
        }}
      >
        {/* Dashboard Tab */}
        <Link
          href="/supervisor"
          className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
          style={{
            color: pathname === '/supervisor' ? 'var(--accent)' : 'var(--text-muted)',
            width: '20%',
          }}
        >
          <Home className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname === '/supervisor' ? 'scale(1.1)' : 'scale(1)' }} />
          <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname === '/supervisor' ? 700 : 500 }}>Dashboard</span>
          {pathname === '/supervisor' && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
          )}
        </Link>

        {/* My Visits Tab */}
        <Link
          href="/supervisor/my-visits"
          className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
          style={{
            color: pathname.startsWith('/supervisor/my-visits') ? 'var(--accent)' : 'var(--text-muted)',
            width: '20%',
          }}
        >
          <MapPin className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/supervisor/my-visits') ? 'scale(1.1)' : 'scale(1)' }} />
          <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/supervisor/my-visits') ? 700 : 500 }}>My Visits</span>
          {pathname.startsWith('/supervisor/my-visits') && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
          )}
        </Link>

        {/* Central Raised Floating Action Button (FAB) for New Visit */}
        {(() => {
          const isVisitActive = pathname.startsWith('/supervisor/visit');
          return (
            <div className="flex flex-col items-center relative -top-3" style={{ width: '20%' }}>
              <Link
                href="/supervisor/visit"
                className="h-11 w-11 text-white rounded-full flex items-center justify-center transition-all active:scale-95 transform duration-200"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
                  border: '3px solid var(--surface)',
                  boxShadow: isVisitActive ? '0 0 0 4px var(--accent-soft), 0 6px 18px rgba(79,70,229,0.45)' : '0 4px 14px rgba(79,70,229,0.3)',
                  transform: isVisitActive ? 'scale(1.08)' : 'scale(1)',
                }}
                title="Start New Audit"
              >
                <Plus className="h-5 w-5 stroke-[3px]" />
              </Link>
              <span
                className="text-[9px] tracking-wide font-semibold mt-1 transition-colors"
                style={{
                  color: isVisitActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: isVisitActive ? 700 : 500,
                }}
              >
                New Audit
              </span>
            </div>
          );
        })()}

        {/* Reports Tab */}
        <Link
          href="/supervisor/reports"
          className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
          style={{
            color: pathname.startsWith('/supervisor/reports') ? 'var(--accent)' : 'var(--text-muted)',
            width: '20%',
          }}
        >
          <BarChart3 className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/supervisor/reports') ? 'scale(1.1)' : 'scale(1)' }} />
          <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/supervisor/reports') ? 700 : 500 }}>Reports</span>
          {pathname.startsWith('/supervisor/reports') && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
          )}
        </Link>

        {/* Profile Tab */}
        <Link
          href="/supervisor/profile"
          className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
          style={{
            color: pathname.startsWith('/supervisor/profile') ? 'var(--accent)' : 'var(--text-muted)',
            width: '20%',
          }}
        >
          <User className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/supervisor/profile') ? 'scale(1.1)' : 'scale(1)' }} />
          <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/supervisor/profile') ? 700 : 500 }}>Profile</span>
          {pathname.startsWith('/supervisor/profile') && (
            <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
          )}
        </Link>
      </footer>
      )}
    </div>
  );
}
