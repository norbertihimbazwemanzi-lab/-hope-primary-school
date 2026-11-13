import React from 'react';
import { PageId } from '../types';
import {
  MessageSquare,
  Clock,
  Download,
} from 'lucide-react';

interface AdmissionsPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenPrintableForm: () => void;
  onOpenTour: () => void;
  onOpenChatTracker?: (refCode?: string) => void;
}

export const AdmissionsPage: React.FC<AdmissionsPageProps> = ({
  onOpenApply,
  onOpenPrintableForm,
  onOpenChatTracker,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Admissions & Enrollment
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Admissions Procedure for Academic Year 2026 / 2027
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
          We welcome applications for Nursery (Baby, Middle, Pre-Primary) and Primary (P1 through P6). Apply online or download the official registration form below.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenApply}
            className="cursor-pointer px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs rounded-md shadow-xs transition-colors"
          >
            Start Online Application
          </button>
          {onOpenChatTracker && (
            <button
              onClick={() => onOpenChatTracker()}
              className="cursor-pointer px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs rounded-md border border-slate-300 transition-colors inline-flex items-center gap-2"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-900" />
              <span>Track Application Status</span>
            </button>
          )}
          <button
            onClick={onOpenPrintableForm}
            className="cursor-pointer px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-md border border-slate-300 transition-colors inline-flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download Form (PDF)</span>
          </button>
        </div>

        {/* Live Admin Confirmation & Chat Reassurance Banner */}
        {onOpenChatTracker && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-amber-300" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Awaiting Administrative Review?
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enter your reference code to view live enrollment status or message the admissions office directly.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChatTracker()}
              className="cursor-pointer px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-blue-900 font-semibold text-xs rounded-md transition-colors shrink-0 flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Check Status</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
