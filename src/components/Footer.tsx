import React from 'react';
import { PageId } from '../types';
import { SCHOOL_INFO } from '../data/schoolData';
import { ShieldCheck, Phone, Mail, MapPin, Clock } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface FooterProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenApply, onOpenTour }) => {
  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      {/* Upper Institutional Trust Banner */}
      <div className="bg-slate-900 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Campus Security & Location</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              Guarded Campus Adjacent to Mugina Police Station
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Learners study in a peaceful, secure environment in Kamonyi District with full perimeter security and verified gate protocols.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenTour}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700 cursor-pointer"
            >
              Schedule a Visit
            </button>
            <button
              onClick={onOpenApply}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 rounded-md transition-colors shadow-xs cursor-pointer"
            >
              Apply for Admission
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Column 1: School Identity with Crest */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <SchoolLogo size="md" />
              <div>
                <h4 className="text-base font-bold text-white">
                  Mugina Hope Academy
                </h4>
                <p className="text-xs text-slate-400">Primary & Nursery School</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Founded in {SCHOOL_INFO.establishedYear} in Kamonyi District. Dedicated to holistic educational excellence, Christian values, and Rwanda national curriculum standards.
            </p>
            <div className="pt-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block mb-0.5">School Motto:</span>
              <span className="italic font-serif">&ldquo;Nurturing Minds, Building Character, Inspiring Hope.&rdquo;</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Quick Navigation
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Home Overview
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About Our School
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('academics')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Academic Curriculum
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admissions')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Admissions & Enrollment
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('fees')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  School Fees Schedule
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('campus-life')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Campus Life & Facilities
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Contact & Campus Location
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('admin')}
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
                >
                  Staff & Management Portal
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Academic Levels */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Academic Levels
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Nursery: Baby Class (Ages 3)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Nursery: Middle Class (Ages 4)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span>Nursery: Pre-Primary Top Class (Ages 5)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Lower Primary: Primary 1 to Primary 3</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Upper Primary: Primary 4 to Primary 6</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>National Examination Preparation (PLE)</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Location & Official Contacts */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Campus & Registry Office
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>Mugina Center, Next to Police Post, Kamonyi District, Rwanda</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href={`tel:${SCHOOL_INFO.contact.phone.replace(/\s+/g, '')}`} className="hover:text-white transition-colors">
                  {SCHOOL_INFO.contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href={`mailto:${SCHOOL_INFO.contact.email}`} className="hover:text-white transition-colors">
                  {SCHOOL_INFO.contact.email}
                </a>
              </div>
              <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>Office Hours: Monday – Friday, 7:00 AM – 5:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & MINEDUC Attribution Bar */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} Mugina Hope Academy. Registered under the Rwanda Ministry of Education (MINEDUC).
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Kamonyi District · Southern Province</span>
            <span>·</span>
            <button
              onClick={() => onNavigate('admin')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
