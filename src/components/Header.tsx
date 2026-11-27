import React, { useState } from 'react';
import { PageId } from '../types';
import { Menu, X, Shield, Lock, LogOut } from 'lucide-react';
import { setCurrentSessionUser, getCurrentSessionUser } from '../services/adminStore';
import { SchoolLogo } from './SchoolLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenApply?: () => void;
  onOpenTour?: () => void;
  onOpenChatTracker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sessionUser = getCurrentSessionUser();

  const navItems: { id: PageId; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'staff', label: 'School Staff' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'fees', label: 'School Fees' },
    { id: 'campus-life', label: 'Campus Life' },
    { id: 'contact', label: 'Contact Us' },
  ];

  const handleNavClick = (id: PageId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const handleAdminLogout = () => {
    setCurrentSessionUser(null);
    setMobileMenuOpen(false);
    onNavigate('home');
  };

  const portalRoleLabel = sessionUser
    ? sessionUser.role === 'Parent'
      ? 'Parent Portal'
      : sessionUser.role === 'Student'
      ? 'Student Portal'
      : `${sessionUser.role} Portal`
    : 'School Portal';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/98 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200/90 dark:border-slate-800 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-4 h-14 sm:h-20">
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className="flex items-center gap-2 sm:gap-3 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-900 rounded-md group min-w-0 flex-1 sm:flex-initial"
            >
              <SchoolLogo size="md" className="shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm sm:text-lg lg:text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-900 dark:group-hover:text-amber-400 transition-colors truncate">
                  Mugina Hope Academy
                </span>
                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium tracking-normal truncate">
                  Primary &amp; Nursery School
                </span>
              </div>
            </button>

            <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1.5 xl:gap-3 text-[13px] font-semibold text-slate-700 dark:text-slate-300">
              {navItems.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative px-2.5 py-2 transition-colors whitespace-nowrap shrink-0 hover:text-blue-950 dark:hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-900 rounded-md cursor-pointer ${
                      isActive
                        ? 'text-blue-950 dark:text-amber-400 font-bold bg-blue-50/90 dark:bg-blue-950/60'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-900 dark:bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              <div className="hidden sm:block">
                <PWAInstallButton variant="header" />
              </div>
              {sessionUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => handleNavClick('admin')}
                    className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[40px] text-xs font-semibold rounded-md transition-all border whitespace-nowrap shrink-0 ${
                      currentPage === 'admin'
                        ? 'bg-blue-950 text-white border-blue-950 dark:border-amber-400'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                    title={`${portalRoleLabel} Dashboard`}
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="hidden sm:inline">{portalRoleLabel}</span>
                    <span className="sm:hidden">{sessionUser.role}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminLogout}
                    className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[40px] text-xs font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 rounded-md transition-colors whitespace-nowrap shrink-0"
                    title="Sign out of portal session"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[40px] text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 ${
                    currentPage === 'admin'
                      ? 'bg-blue-950 text-white'
                      : 'text-slate-800 dark:text-slate-100 hover:text-blue-950 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700'
                  }`}
                  title="School Management Portal (Staff, Parents & Students)"
                >
                  <Lock className="w-3.5 h-3.5 text-blue-900 dark:text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">School Portal</span>
                  <span className="sm:hidden">Portal</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="cursor-pointer lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-900 shrink-0"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 sm:px-4 pt-3 pb-5 shadow-md max-h-[82vh] overflow-y-auto animate-in slide-in-from-top duration-150">
            {sessionUser && (
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="w-4 h-4 text-blue-900 dark:text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{sessionUser.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">{portalRoleLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 min-h-[40px] text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-md shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`cursor-pointer text-left px-3 py-3 min-h-[44px] text-sm transition-colors rounded-md ${
                      isActive
                        ? 'text-blue-950 dark:text-amber-400 font-semibold bg-blue-50 dark:bg-blue-950/60'
                        : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                aria-current={currentPage === 'admin' ? 'page' : undefined}
                className={`cursor-pointer text-left px-3 py-3 min-h-[44px] text-sm flex items-center gap-2 rounded-md ${
                  currentPage === 'admin'
                    ? 'text-blue-950 dark:text-amber-400 font-semibold bg-blue-50 dark:bg-blue-950/60'
                    : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                <span>{sessionUser ? `${portalRoleLabel}` : 'School Portal (Staff, Parents & Students)'}</span>
              </button>
              <PWAInstallButton variant="mobile-menu" />
            </div>
          </div>
        )}
      </header>
      <div className="h-[57px] sm:h-[81px] shrink-0 print:hidden" aria-hidden="true" />
    </>
  );
};

