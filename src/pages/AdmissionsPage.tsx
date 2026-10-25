import React from 'react';
import { PageId } from '../types';
import {
  ArrowRight,
  MessageSquare,
  Clock,
  Download,
  GraduationCap,
  Users,
} from 'lucide-react';
import { SCHOOL_INFO } from '../data/schoolData';
import { SchoolStaffSection } from '../components/SchoolStaffSection';

interface AdmissionsPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenPrintableForm: () => void;
  onOpenTour: () => void;
  onOpenChatTracker?: (refCode?: string) => void;
}

export const AdmissionsPage: React.FC<AdmissionsPageProps> = ({
  onNavigate,
  onOpenApply,
  onOpenPrintableForm,
  onOpenTour,
  onOpenChatTracker,
}) => {
  const steps = [
    {
      num: '01',
      title: 'Inquire & Campus Tour',
      desc: 'Book a campus tour to walk through our safe learning facilities next to Mugina Police Station and meet teachers.',
      cta: 'Book Tour',
      action: onOpenTour,
    },
    {
      num: '02',
      title: 'Complete Application',
      desc: 'Fill out our quick online application or download and complete the official registration PDF packet.',
      cta: 'Apply Online',
      action: onOpenApply,
    },
    {
      num: '03',
      title: 'Document Submission & Placement',
      desc: 'Submit student documents (Birth certificate, photos, previous records). A brief friendly placement check is conducted.',
      cta: 'Apply Now',
      action: onOpenApply,
    },
    {
      num: '04',
      title: 'Acceptance & Enrollment',
      desc: 'Receive your formal acceptance letter, obtain the school uniform kit, and welcome your child to Mugina Hope Academy!',
      cta: 'Enroll Child',
      action: onOpenApply,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* 1. Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
          Admissions & Enrollment
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-display">
          Join the Mugina Hope Academy Family
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          We welcome applications year-round for Nursery (Baby, Middle, Pre-Primary) and Primary (P1 to P6). Learn about our admissions journey and meet our dedicated school leadership team below.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onOpenApply}
            className="cursor-pointer px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all border border-amber-400"
          >
            Start Online Application
          </button>
          {onOpenChatTracker && (
            <button
              onClick={() => onOpenChatTracker()}
              className="cursor-pointer px-5 py-3 bg-blue-900 hover:bg-blue-950 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all inline-flex items-center gap-2 border border-blue-800"
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>Track Application & Chat with Admin</span>
            </button>
          )}
          <button
            onClick={onOpenPrintableForm}
            className="cursor-pointer px-5 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition-all inline-flex items-center gap-2 border border-slate-200"
          >
            <Download className="w-4 h-4" />
            <span>Download Application PDF</span>
          </button>
        </div>

        {/* Live Admin Confirmation & Chat Reassurance Banner */}
        {onOpenChatTracker && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 via-slate-50 to-amber-50 rounded-2xl border border-blue-200/80 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Waiting for Administrator Confirmation?
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enter your reference code to view live status or message Administrator Norbert Ihimbazwe Manzi directly while awaiting verification.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChatTracker()}
              className="cursor-pointer px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-blue-900 font-bold text-xs rounded-xl shadow-2xs transition-colors shrink-0 flex items-center gap-1.5 active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-700" />
              <span>Open Chat</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Step-by-Step Registration Checklist */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Admissions Journey
          </span>
          <h2 className="text-2xl font-bold text-slate-900 font-display">
            Four Simple Steps to Register Your Child
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st) => (
            <div
              key={st.num}
              className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <span className="text-2xl font-black text-blue-700 font-mono">
                  {st.num}
                </span>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  {st.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {st.desc}
                </p>
              </div>

              <button
                type="button"
                onClick={st.action}
                className="cursor-pointer self-start text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>{st.cta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. School Staff Leadership Section - Exact match to user's Capture_cd3b07eb.PNG */}
      <SchoolStaffSection />

    </div>
  );
};
