import React from 'react';
import { PageId } from '../types';
import { SchoolFeesSection } from '../components/SchoolFeesSection';
import { CreditCard, ShieldCheck, Phone, Mail, ArrowRight } from 'lucide-react';
import { SCHOOL_INFO } from '../data/schoolData';

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
    <div className="w-full bg-white min-h-screen">
      {/* Page Hero Header - Professional Institutional Banner */}
      <div className="bg-slate-900 text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            <span>Academic Year 2026 / 2027</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Official Tuition & Term Fee Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Transparent, predictable term fees established according to Rwanda Ministry of Education guidelines for Nursery and Primary education.
          </p>
        </div>
      </div>

      {/* Main School Fees Section */}
      <SchoolFeesSection
        onOpenApply={onOpenApply}
        onOpenTour={onOpenTour}
        className="pt-8 pb-12"
      />

      {/* Official Payment Channels & Guidelines */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-slate-50 rounded-lg p-6 sm:p-8 border border-slate-200 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Payment Channels & Official Instructions
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              All term payments must be completed via official school banking accounts or registered merchant numbers. Cash payments are accepted only at the campus bursar desk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* BK Bank Slip */}
            <div className="p-5 rounded-lg bg-white border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <CreditCard className="w-4 h-4" />
                <span>Bank of Kigali (BK)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deposit directly at any Bank of Kigali branch nationwide or through the BK Mobile Banking App.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs font-mono font-bold text-slate-900">
                Account: 00040-0694852-33
              </div>
              <span className="text-[11px] text-slate-500 block">
                Slip Reference: Student Full Name & Grade
              </span>
            </div>

            {/* MTN Mobile Money */}
            <div className="p-5 rounded-lg bg-white border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <CreditCard className="w-4 h-4" />
                <span>MTN MoMo Pay Merchant</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dial *182*8*1# and enter the verified official school merchant code:
              </p>
              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs font-mono font-bold text-slate-900">
                Merchant Code: 788258
              </div>
              <span className="text-[11px] text-slate-500 block">
                Retain SMS confirmation for bursar receipt verification
              </span>
            </div>

            {/* Bursar & Accounting Desk */}
            <div className="p-5 rounded-lg bg-white border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <ShieldCheck className="w-4 h-4" />
                <span>Campus Bursar Desk</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Present bank deposit slips or payment receipts directly at the school administrative building.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-800 font-medium">
                Monday – Friday: 7:30 AM – 4:30 PM
              </div>
              <span className="text-[11px] text-slate-500 block">
                Official stamped receipts issued immediately
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                Bursar Contact: {SCHOOL_INFO.contact.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                finance@muginahopeschool.com
              </span>
            </div>
            {onOpenApply && (
              <button
                onClick={onOpenApply}
                className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Proceed to Admission Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
