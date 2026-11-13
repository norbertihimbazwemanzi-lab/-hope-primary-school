import React from 'react';
import { AgeCalculator } from '../components/AgeCalculator';
import { PageId } from '../types';
import { BookOpen, Laptop, Languages } from 'lucide-react';

interface AcademicsPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApplyWithGrade: (gradeCode: string) => void;
}

export const AcademicsPage: React.FC<AcademicsPageProps> = ({
  onOpenApplyWithGrade,
}) => {

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* 1. Header & Curriculum Vision */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Academic Program
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          Rwanda National Curriculum with Practical ICT & Trilingual Literacy
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Compliant with Rwanda Basic Education Board (REB) standards, enriched with hands-on computer science, STEM inquiry, English conversational fluency, and foundational numeracy.
        </p>
      </div>

      {/* 2. Interactive Age Calculator Widget */}
      <section id="age-calculator-section" className="scroll-mt-24">
        <AgeCalculator onSelectGradeForApplication={onOpenApplyWithGrade} />
      </section>

      {/* 3. Curriculum Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-blue-900 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Competency-Based Syllabus
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Directly implements the MINEDUC framework emphasizing critical thinking, problem-solving, and practical mastery of core concepts.
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-blue-900 flex items-center justify-center">
            <Laptop className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Dedicated ICT Computer Lab
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Individual workstations equipped for digital literacy, interactive mathematics software, and early keyboarding skills.
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="w-9 h-9 rounded-md bg-slate-100 text-blue-900 flex items-center justify-center">
            <Languages className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Trilingual Foundations
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            English medium instruction reinforced with French language introduction and rich Kinyarwanda cultural grammar and heritage.
          </p>
        </div>
      </div>
    </div>
  );
};
