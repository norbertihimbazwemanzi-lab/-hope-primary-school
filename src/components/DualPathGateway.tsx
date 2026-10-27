import React from 'react';
import { SCHOOL_INFO } from '../data/schoolData';
import { PageId } from '../types';
import { Baby, BookOpen, Check, ArrowRight } from 'lucide-react';

interface DualPathGatewayProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
}

export const DualPathGateway: React.FC<DualPathGatewayProps> = ({ onNavigate, onOpenApply }) => {
  return (
    <section className="py-8 sm:py-12">
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Academic Structure
        </span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
          Nursery & Primary Academic Pathways
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-2xl mx-auto leading-relaxed">
          From early childhood development through Primary 6 graduation, Mugina Hope Academy provides dedicated, age-appropriate learning tracks under one secure campus in Kamonyi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Pathway 1: Nursery Academy */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs hover:shadow-sm transition-shadow flex flex-col">
          <div className="relative h-60 overflow-hidden bg-slate-100">
            <img
              src={SCHOOL_INFO.images.nursery}
              alt="Mugina Hope Nursery classroom with children learning through play"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedBackup) {
                  target.dataset.triedBackup = '1';
                  target.src = '/images/nursery_play_learning_1791823267251.jpg';
                }
              }}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/60 flex items-end p-6">
              <div>
                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Baby className="w-3.5 h-3.5" />
                  Ages 3 to 5 Years
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Nursery Academy (Early Childhood)
                </h3>
              </div>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                A warm, nurturing sanctuary focused on early cognitive development, socialization, and foundational discovery. We cultivate curiosity, bilingual language introduction, and emotional well-being.
              </p>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Three progressive levels:</strong> Baby Class (3y), Middle Class (4y), and Pre-Primary Top Class (5y).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Play-based learning & Montessori tools:</strong> Sensorial discovery, physical coordination, and early phonics.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Childcare & nutrition:</strong> Caring educators, mid-morning porridge, and clean dedicated nap areas.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('academics')}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <span>Nursery Curriculum Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenApply}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap"
              >
                Enroll in Nursery
              </button>
            </div>
          </div>
        </div>

        {/* Pathway 2: Primary School */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs hover:shadow-sm transition-shadow flex flex-col">
          <div className="relative h-60 overflow-hidden bg-slate-100">
            <img
              src={SCHOOL_INFO.images.primaryStem}
              alt="Mugina Hope Primary students in computer lab learning ICT in Kamonyi"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.dataset.triedBackup) {
                  target.dataset.triedBackup = '1';
                  target.src = '/images/primary_stem_computer_lab_1791823280335.jpg';
                }
              }}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/60 flex items-end p-6">
              <div>
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Primary 1 through Primary 6
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Primary School (Grades P1–P6)
                </h3>
              </div>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Rigorous academic foundation aligned with the Rwanda National Curriculum (REB). We empower pupils with English fluency, advanced mathematics, science experimentation, and computer literacy.
              </p>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                  <span>
                    <strong>Rwanda National Standards:</strong> Comprehensive coverage of P1–P6 curricula preparing students for Primary Leaving Examinations (PLE).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                  <span>
                    <strong>Computer Literacy & STEM:</strong> Hands-on workstation practice, digital fundamentals, and science experimentation.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                  <span>
                    <strong>Trilingual Literacy:</strong> English instruction supported with French enrichment and Kinyarwanda cultural heritage.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('academics')}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <span>View P1–P6 Curriculum</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenApply}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-md transition-colors whitespace-nowrap"
              >
                Enroll in Primary
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
