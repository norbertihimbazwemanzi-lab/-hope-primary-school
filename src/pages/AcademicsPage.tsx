import React, { useState } from 'react';
import { ACADEMIC_GRADES, SCHOOL_INFO } from '../data/schoolData';
import { AgeCalculator } from '../components/AgeCalculator';
import { PageId, AcademicGrade } from '../types';
import {
  BookOpen,
  Laptop,
  CheckCircle2,
  Calendar,
  ArrowRight,
  GraduationCap,
  Baby,
  Languages,
} from 'lucide-react';

interface AcademicsPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApplyWithGrade: (gradeCode: string) => void;
}

export const AcademicsPage: React.FC<AcademicsPageProps> = ({
  onNavigate,
  onOpenApplyWithGrade,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'nursery' | 'primary'>('all');

  const filteredGrades = ACADEMIC_GRADES.filter((grade) => {
    if (activeTab === 'nursery') return grade.level === 'Nursery';
    if (activeTab === 'primary') return grade.level === 'Primary';
    return true;
  });

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

      {/* 4. Detailed Program Breakdown: Nursery vs Primary */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Grade Cohorts
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Class Levels & Learning Outcomes
            </h2>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Levels (9)
            </button>
            <button
              onClick={() => setActiveTab('nursery')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
                activeTab === 'nursery'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nursery (Baby to Top)
            </button>
            <button
              onClick={() => setActiveTab('primary')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors ${
                activeTab === 'primary'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Primary (P1 to P6)
            </button>
          </div>
        </div>

        {/* Grades Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGrades.map((grade) => {
            const isNursery = grade.level === 'Nursery';
            return (
              <div
                key={grade.code}
                className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                        isNursery
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : 'bg-blue-50 text-blue-950 border-blue-200'
                      }`}
                    >
                      {grade.level} · {grade.ageRange}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      {grade.code}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">
                    {grade.name}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {grade.description}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                      Core Subjects:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {grade.keySubjects.map((s) => (
                        <span
                          key={s}
                          className="text-[11px] bg-slate-50 text-slate-700 px-2 py-0.5 rounded-sm border border-slate-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                      Key Competencies:
                    </span>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {grade.learningGoals.map((goal, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {grade.schedule}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenApplyWithGrade(grade.code)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-950 hover:text-blue-800 cursor-pointer"
                  >
                    <span>Apply for {grade.code}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Academic Year Calendar / Term Dates */}
      <div className="bg-slate-900 text-white rounded-lg p-6 sm:p-8 border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-white">
                Academic Year Term Schedule
              </h3>
              <p className="text-xs text-slate-400">Aligned with the Rwanda Ministry of Education (MINEDUC) School Calendar</p>
            </div>
          </div>
          <span className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded-sm border border-slate-700">
            Official 3-Term Structure
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div className="bg-slate-800 p-4 rounded-md border border-slate-700 space-y-1.5">
            <div className="flex justify-between font-bold text-amber-300 text-sm">
              <span>First Term (Term 1)</span>
              <span>Jan – Apr</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              New learner orientation, diagnostic phonics & arithmetic assessments, syllabus commencement.
            </p>
          </div>

          <div className="bg-slate-800 p-4 rounded-md border border-slate-700 space-y-1.5">
            <div className="flex justify-between font-bold text-amber-300 text-sm">
              <span>Second Term (Term 2)</span>
              <span>May – Jul</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Mid-year assessments, STEM laboratory inquiry, Itorero traditional cultural dance, and reading competitions.
            </p>
          </div>

          <div className="bg-slate-800 p-4 rounded-md border border-slate-700 space-y-1.5">
            <div className="flex justify-between font-bold text-amber-300 text-sm">
              <span>Third Term (Term 3)</span>
              <span>Sep – Nov</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Primary Leaving Examination (PLE) candidate preparation for P6, promotion assessments, and end-of-year ceremonies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
