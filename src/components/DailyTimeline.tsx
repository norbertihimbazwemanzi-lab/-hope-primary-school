import React, { useState } from 'react';
import { DAILY_TIMELINE } from '../data/schoolData';
import { Clock, Sun, BookOpen, Apple, Palette } from 'lucide-react';

export const DailyTimeline: React.FC = () => {
  const [activeTrack, setActiveTrack] = useState<'both' | 'nursery' | 'primary'>('both');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'arrival':
        return <Sun className="w-4 h-4 text-amber-600" />;
      case 'academic':
        return <BookOpen className="w-4 h-4 text-blue-900" />;
      case 'nutrition':
        return <Apple className="w-4 h-4 text-emerald-700" />;
      case 'arts':
        return <Palette className="w-4 h-4 text-slate-700" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Track Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Display Schedule:
          </span>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setActiveTrack('both')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTrack === 'both'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Levels
          </button>
          <button
            type="button"
            onClick={() => setActiveTrack('nursery')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTrack === 'nursery'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nursery (Ages 3–5)
          </button>
          <button
            type="button"
            onClick={() => setActiveTrack('primary')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors whitespace-nowrap shrink-0 ${
              activeTrack === 'primary'
                ? 'bg-white text-blue-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Primary (Grades P1–P6)
          </button>
        </div>
      </div>

      {/* Visual Timeline Cards */}
      <div className="relative border-l-2 border-slate-300 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-6">
        {DAILY_TIMELINE.map((item, idx) => (
          <div key={idx} className="relative">
            {/* Timeline Node Icon */}
            <div className="absolute -left-[35px] sm:-left-[43px] top-1.5 w-8 h-8 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center shadow-xs">
              {getCategoryIcon(item.category)}
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg p-4 sm:p-5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-mono font-bold text-blue-900">
                  {item.time}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Period 0{idx + 1}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                {item.title}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {item.description}
              </p>

              {/* Conditional track breakdown */}
              {(activeTrack === 'both' || activeTrack === 'nursery') && item.nurseryDetail && (
                <div className="pt-2 border-t border-slate-100 flex items-start gap-2">
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200 shrink-0">
                    Nursery Track:
                  </span>
                  <span className="text-xs text-slate-600">{item.nurseryDetail}</span>
                </div>
              )}

              {(activeTrack === 'both' || activeTrack === 'primary') && item.primaryDetail && (
                <div className="pt-1.5 flex items-start gap-2">
                  <span className="text-[10px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200 shrink-0">
                    Primary Track:
                  </span>
                  <span className="text-xs text-slate-600">{item.primaryDetail}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
