import React from 'react';
import { PageId } from '../types';
import { SCHOOL_INFO } from '../data/schoolData';
import { HeroSlider } from '../components/HeroSlider';
import { DualPathGateway } from '../components/DualPathGateway';
import { DailyTimeline } from '../components/DailyTimeline';
import { TestimonialsSlider } from '../components/TestimonialsSlider';
import {
  Calendar,
  Sparkles,
  GraduationCap,
  Users,
  ShieldCheck,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenApply,
  onOpenTour,
}) => {
  return (
    <div className="space-y-16">
      {/* 1. Hero Section & Visual Slider (Matching Capture.PNG) */}
      <HeroSlider
        onNavigate={onNavigate}
        onOpenApply={onOpenApply}
        onOpenTour={onOpenTour}
      />

      {/* 2. Quick Facts Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Fact 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Year Established
              </span>
              <Calendar className="w-5 h-5 text-blue-700" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-display">
              {SCHOOL_INFO.establishedYear}
            </div>
            <p className="text-xs text-slate-600">
              Over 12 years of steadfast academic and moral foundation in the Southern Province.
            </p>
          </div>

          {/* Fact 2: Safe Location */}
          <div className="bg-white p-6 rounded-2xl border border-emerald-200/90 shadow-2xs space-y-2 bg-gradient-to-br from-emerald-50/40 to-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Maximum Security
              </span>
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 font-display">
              Near Police Station
            </div>
            <p className="text-xs text-slate-600">
              Situated right beside Mugina Police Station, offering 24/7 peace of mind for every family.
            </p>
          </div>

          {/* Fact 3: Levels */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Grade Levels
              </span>
              <GraduationCap className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-display">
              Nursery to P6
            </div>
            <p className="text-xs text-slate-600">
              Baby, Middle, Pre-Primary, through Primary 6 with national REB curriculum excellence.
            </p>
          </div>

          {/* Fact 4: Student Focused */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mentorship Ratio
              </span>
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-3xl font-black text-slate-900 font-display">
              18 : 1 Ratio
            </div>
            <p className="text-xs text-slate-600">
              Intimate classroom sizes ensuring every child receives individualized attention and guidance.
            </p>
          </div>
        </div>
      </section>

      {/* 3. The Dual-Path Gateway */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DualPathGateway
          onNavigate={onNavigate}
          onOpenApply={onOpenApply}
        />
      </section>

      {/* 4. "Day in the Life" Interactive Timeline */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-50/70 rounded-3xl p-6 sm:p-10 lg:p-12 border border-slate-200 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Daily Campus Rhythm
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
              A Day in the Life of a Mugina Hope Pupil
            </h2>
            <p className="text-sm text-slate-600">
              From arrival through guarded security gates at 7:00 AM to afternoon creative arts, each hour is thoughtfully balanced with academics, nutrition, and joy.
            </p>
          </div>

          <DailyTimeline />
        </div>
      </section>

      {/* 5. Testimonial Slider Featuring Parents & Students */}
      <TestimonialsSlider onOpenApply={onOpenApply} />

      {/* 6. Bottom Banner / CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-blue-800 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-center md:justify-start gap-1.5">
              <Sparkles className="w-4 h-4" />
              Admissions Open for 2026 / 2027
            </span>
            <h3 className="text-2xl sm:text-3xl font-black font-display text-white">
              Give Your Child the Foundation They Deserve
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Limited slots available across Baby Class, Middle Class, Pre-Primary, and Primary 1 through 6. Register online or visit our admissions office today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenTour}
              className="w-full sm:w-auto px-5 py-3 text-xs sm:text-sm font-semibold text-slate-200 bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20"
            >
              Book Campus Tour
            </button>
            <button
              type="button"
              onClick={onOpenApply}
              className="w-full sm:w-auto px-6 py-3 text-xs sm:text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg transition-colors"
            >
              Apply Online Now
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
