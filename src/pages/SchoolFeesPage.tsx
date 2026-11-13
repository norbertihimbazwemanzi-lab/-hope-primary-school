import React from 'react';
import { PageId } from '../types';
import { SchoolFeesSection } from '../components/SchoolFeesSection';
import { CreditCard } from 'lucide-react';

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
        className="pt-8 pb-16"
      />
    </div>
  );
};
