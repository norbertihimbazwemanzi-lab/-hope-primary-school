import React from 'react';
import { PageId } from '../types';
import { SchoolFeesSection } from '../components/SchoolFeesSection';
import { SCHOOL_INFO } from '../data/schoolData';
import { CreditCard, ShieldCheck, HelpCircle, Phone, Mail, ArrowRight, FileText } from 'lucide-react';

interface SchoolFeesPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply?: () => void;
  onOpenTour?: () => void;
}

export const SchoolFeesPage: React.FC<SchoolFeesPageProps> = ({
  onNavigate,
  onOpenApply,
  onOpenTour,
}) => {
  return (
    <div className="w-full bg-slate-50 min-h-screen">
      {/* Page Hero Banner */}
      <div className="bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/60 text-blue-200 text-xs font-semibold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            <span>Academic Year 2026/2027</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black font-display tracking-tight text-white">
            Official School Fee Schedule
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Transparent, predictable tuition and term fee structures for all academic terms.
          </p>
        </div>
      </div>

      {/* Main School Fees Section (Matching Capture_fff547f5.PNG) */}
      <SchoolFeesSection
        onOpenApply={onOpenApply}
        onOpenTour={onOpenTour}
        className="pt-12 pb-16"
      />

      {/* Payment Options & Guidelines */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Payment Methods & Official Channels
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              All term payments must be completed via official school banking channels or registered merchant numbers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* BK Bank Slip */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-sm">
                <CreditCard className="w-4 h-4" />
                <span>Bank of Kigali (BK)</span>
              </div>
              <p className="text-xs text-slate-600">
                Deposit directly at any Bank of Kigali branch nationwide or through BK App.
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900">
                Account: 00040-0694852-33
              </div>
              <span className="text-[11px] text-slate-500 block">
                Reference: Child&apos;s Full Name & Grade
              </span>
            </div>

            {/* MTN Mobile Money */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <CreditCard className="w-4 h-4" />
                <span>MTN MoMo Pay Merchant</span>
              </div>
              <p className="text-xs text-slate-600">
                Dial *182*8*1# and enter the official school merchant code:
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900">
                Merchant Code: 788258
              </div>
              <span className="text-[11px] text-slate-500 block">
                Save SMS transaction confirmation for registry
              </span>
            </div>

            {/* Bursar & Accounting Desk */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Bursar Accounting Desk</span>
              </div>
              <p className="text-xs text-slate-600">
                Submit payment receipts or bank slips at the campus administrative building.
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 font-medium">
                Mon - Fri: 7:30 AM - 4:30 PM
              </div>
              <span className="text-[11px] text-slate-500 block">
                Official printed receipts issued on the spot
              </span>
            </div>
          </div>

          {/* Quick Contact & Action CTA */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-bold font-display">
                Need Flexible Installment Plans?
              </h3>
              <p className="text-xs sm:text-sm text-blue-200 max-w-xl">
                Our finance office works with families requiring tailored term installment structures. Contact our accounts desk today.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={`tel:${SCHOOL_INFO.contact.phone.replace(/\s+/g, '')}`}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Bursar Desk</span>
              </a>
              {onOpenApply && (
                <button
                  onClick={onOpenApply}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-blue-950 text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Apply for Admission</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
