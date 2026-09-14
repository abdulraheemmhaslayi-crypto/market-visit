'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/providers/theme-provider';
import { canModifyMasterData } from '@/lib/roles';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FileSpreadsheet,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown,
  Map,
  FileBarChart2,
  Settings,
  RefreshCw,
  Activity,
  ArrowLeft,
  Camera,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
      { name: 'Visit Logs', path: '/admin/visits', icon: CalendarCheck },
      { name: 'Supervisors', path: '/admin/supervisors', icon: Users },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { name: 'Audit Photo Gallery', path: '/admin/photos', icon: Camera },
      { name: 'Reports', path: '/admin/reports', icon: FileBarChart2 },
      { name: 'Routes', path: '/admin/routes', icon: Map },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Master Import', path: '/admin/import', icon: FileSpreadsheet },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noVisitCount, setNoVisitCount] = useState(0);
  
  const canGoBack = pathname !== '/admin';
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const adminNavActions = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Audit Photo Gallery', path: '/admin/photos', icon: Camera },
    { name: 'Visits Log', path: '/admin/visits', icon: CalendarCheck },
    { name: 'Supervisors List', path: '/admin/supervisors', icon: Users },
    { name: 'Reports & Stats', path: '/admin/reports', icon: FileBarChart2 },
    { name: 'Import Master Data', path: '/admin/import', icon: FileSpreadsheet },
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
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'A';
  const userName = user?.name || 'Administrator';
  const userRole = user?.role || 'Admin';
  const canEditMaster = canModifyMasterData(userRole);

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.path !== '/admin/import' || canEditMaster),
    }))
    .filter((group) => group.items.length > 0);

  const filteredAdminNavActions = adminNavActions.filter(
    (action) => action.path !== '/admin/import' || canEditMaster
  );

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
    path === '/admin' ? pathname === '/admin' : pathname.startsWith(path);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="h-full flex overflow-hidden"
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
            A
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-none truncate" style={{ color: 'var(--text-primary)' }}>
              Field Visit
            </p>
            <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              Admin Console
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
          {filteredNavGroups.map((group) => (
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
                      {(item.path === '/admin' || item.path === '/admin/reports') && (
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
                {adminNavActions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                  <p className="px-2.5 py-3 text-[11px] italic text-[var(--text-muted)]">No results match "{searchQuery}"</p>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {adminNavActions
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
                    <button
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 w-full px-4 h-9 text-[13px] transition-colors cursor-pointer"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
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

        {/* ── Bottom Sticky Tab-Bar (Mobile Devices Only) ── */}
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
            href="/admin"
            className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
            style={{
              color: pathname === '/admin' ? 'var(--accent)' : 'var(--text-muted)',
              width: canEditMaster ? '20%' : '25%',
            }}
          >
            <LayoutDashboard className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname === '/admin' ? 'scale(1.1)' : 'scale(1)' }} />
            <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname === '/admin' ? 700 : 500 }}>Dashboard</span>
            {pathname === '/admin' && (
              <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
            )}
          </Link>

          {/* Visits Tab */}
          <Link
            href="/admin/visits"
            className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
            style={{
              color: pathname.startsWith('/admin/visits') ? 'var(--accent)' : 'var(--text-muted)',
              width: canEditMaster ? '20%' : '25%',
            }}
          >
            <CalendarCheck className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/admin/visits') ? 'scale(1.1)' : 'scale(1)' }} />
            <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/admin/visits') ? 700 : 500 }}>Visits</span>
            {pathname.startsWith('/admin/visits') && (
              <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
            )}
          </Link>

          {/* Supervisors Tab */}
          <Link
            href="/admin/supervisors"
            className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
            style={{
              color: pathname.startsWith('/admin/supervisors') ? 'var(--accent)' : 'var(--text-muted)',
              width: canEditMaster ? '20%' : '25%',
            }}
          >
            <Users className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/admin/supervisors') ? 'scale(1.1)' : 'scale(1)' }} />
            <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/admin/supervisors') ? 700 : 500 }}>Supervisors</span>
            {pathname.startsWith('/admin/supervisors') && (
              <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
            )}
          </Link>

          {/* Reports Tab */}
          <Link
            href="/admin/reports"
            className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
            style={{
              color: pathname.startsWith('/admin/reports') ? 'var(--accent)' : 'var(--text-muted)',
              width: canEditMaster ? '20%' : '25%',
            }}
          >
            <FileBarChart2 className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/admin/reports') ? 'scale(1.1)' : 'scale(1)' }} />
            <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/admin/reports') ? 700 : 500 }}>Reports</span>
            {pathname.startsWith('/admin/reports') && (
              <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
            )}
          </Link>

          {/* Import Tab */}
          {canEditMaster && (
            <Link
              href="/admin/import"
              className="flex flex-col items-center justify-center gap-0.5 transition-all relative py-1"
              style={{
                color: pathname.startsWith('/admin/import') ? 'var(--accent)' : 'var(--text-muted)',
                width: canEditMaster ? '20%' : '25%',
              }}
            >
              <FileSpreadsheet className="h-5 w-5 transition-transform duration-200" style={{ transform: pathname.startsWith('/admin/import') ? 'scale(1.1)' : 'scale(1)' }} />
              <span className="text-[9px] tracking-wide font-semibold" style={{ fontWeight: pathname.startsWith('/admin/import') ? 700 : 500 }}>Import</span>
              {pathname.startsWith('/admin/import') && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          )}
        </footer>
      </div>
    </div>
  );
}
