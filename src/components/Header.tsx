import React, { useState } from 'react';
import { PageId } from '../types';
import { Menu, X, Shield, Lock, LogOut, Phone, Mail, MapPin } from 'lucide-react';
import { isAdminAuthenticated, setCurrentSessionUser, getCurrentSessionUser } from '../services/adminStore';
import { SchoolLogo } from './SchoolLogo';
import { SCHOOL_INFO } from '../data/schoolData';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
  onOpenChatTracker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  onOpenApply,
  onOpenTour,
  onOpenChatTracker,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sessionUser = getCurrentSessionUser();
  const isAdmin = isAdminAuthenticated();

  const navItems: { id: PageId; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'academics', label: 'Academics' },
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
    onNavigate('home');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
      {/* Institutional Top Bar (Official Contact & Authority) */}
      <div className="hidden md:block bg-slate-900 text-slate-300 text-[11px] py-1.5 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3 h-3 text-amber-400" />
              Mugina Sector, Kamonyi District · Southern Province, Rwanda
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">
              MINEDUC Registered School
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`tel:${SCHOOL_INFO.contact.phone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Phone className="w-3 h-3 text-emerald-400" />
              <span>{SCHOOL_INFO.contact.phone}</span>
            </a>
            <span className="text-slate-500">|</span>
            <a
              href={`mailto:${SCHOOL_INFO.contact.email}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Mail className="w-3 h-3 text-blue-400" />
              <span>{SCHOOL_INFO.contact.email}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16 sm:h-20">
          {/* Brand Wordmark with Official School Crest Logo */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 text-left focus:outline-hidden group shrink-0 min-w-0"
          >
            <SchoolLogo size="md" />
            <div className="flex flex-col min-w-0">
              <span className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-900 transition-colors truncate">
                Mugina Hope Academy
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 font-medium tracking-normal truncate">
                Primary & Nursery School · Kamonyi
              </span>
            </div>
          </button>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-7 text-[13px] font-semibold text-slate-700">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`relative py-2 transition-colors whitespace-nowrap shrink-0 hover:text-blue-950 ${
                    isActive ? 'text-blue-900 font-bold' : 'text-slate-600'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-900" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Primary Actions (Admin Portal + Apply Now) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Role-Based Portal Button */}
            {sessionUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavClick('admin')}
                  className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all border ${
                    currentPage === 'admin'
                      ? 'bg-blue-950 text-white border-blue-950'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                  }`}
                  title={`${sessionUser.role} Dashboard`}
                >
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">{sessionUser.role} Portal</span>
                  <span className="sm:hidden">{sessionUser.role}</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                  title="Sign out of staff account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleNavClick('admin')}
                className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-medium rounded-md transition-all ${
                  currentPage === 'admin'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300'
                }`}
                title="Staff & Management Portal"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Staff Portal</span>
                <span className="sm:hidden">Staff</span>
              </button>
            )}

            {/* Official Admissions Button */}
            <button
              onClick={onOpenApply}
              className="cursor-pointer px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] font-semibold text-white bg-blue-950 hover:bg-blue-900 active:bg-blue-950 rounded-md transition-all shadow-xs border border-blue-900 whitespace-nowrap shrink-0"
            >
              <span className="hidden sm:inline">Apply for Admission</span>
              <span className="sm:hidden">Apply</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="cursor-pointer lg:hidden p-2 text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100 focus:outline-hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 shadow-md animate-in slide-in-from-top duration-150">
          {sessionUser && (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-900 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate">{sessionUser.name}</span>
                  <span className="text-[11px] text-slate-500 font-medium">{sessionUser.role} Console</span>
                </div>
              </div>
              <button
                onClick={handleAdminLogout}
                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          <div className="flex flex-col divide-y divide-slate-100">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`cursor-pointer text-left px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-900 font-bold bg-slate-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              onClick={() => handleNavClick('admin')}
              className={`cursor-pointer text-left px-3 py-3 text-sm font-medium flex items-center gap-2 ${
                currentPage === 'admin'
                  ? 'text-blue-950 font-bold bg-slate-50'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>{sessionUser ? `${sessionUser.role} Dashboard` : 'Staff Portal'}</span>
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenApply();
              }}
              className="cursor-pointer w-full py-2.5 text-center text-sm font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-md transition-colors shadow-xs"
            >
              Apply for Admission
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
