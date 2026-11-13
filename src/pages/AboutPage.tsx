import React from 'react';
import { PageId } from '../types';
import { SchoolStaffSection } from '../components/SchoolStaffSection';

interface AboutPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onOpenApply,
  onOpenTour,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10 sm:space-y-12">
      {/* School Vision, Mission, Core Values & Goals Banner */}
      <section className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200 shadow-xs overflow-hidden">
        <img
          src="/assets/aistudio/Mugina_Hope_Primary_School_Vision_and_Values_9630ad92.png"
          alt="Mugina Hope Primary School - Our Vision, Mission, Core Values, and Goals"
          className="w-full h-auto object-contain rounded-lg block"
        />
      </section>

      {/* School Staff Leadership Team */}
      <SchoolStaffSection />

      {/* Institutional CTA */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onOpenApply}
          className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-900 hover:text-blue-700 underline underline-offset-4 decoration-2 decoration-blue-900 hover:decoration-blue-700 transition-colors"
        >
          <span>Apply for Admission</span>
          <span aria-hidden="true" className="text-amber-600 font-bold">&rarr;</span>
        </button>
        <button
          type="button"
          onClick={onOpenTour}
          className="cursor-pointer w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-md transition-colors border border-slate-300"
        >
          Schedule a School Visit
        </button>
      </div>
    </div>
  );
};
