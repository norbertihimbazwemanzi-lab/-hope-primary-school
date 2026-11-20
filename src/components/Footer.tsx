import React, { useEffect, useState } from 'react';
import { PageId } from '../types';
import { SCHOOL_INFO } from '../data/schoolData';
import { getWebsiteSettings } from '../services/adminStore';

interface FooterProps {
  onNavigate?: (page: PageId) => void;
  onOpenApply?: () => void;
  onOpenTour?: () => void;
}

export const Footer: React.FC<FooterProps> = () => {
  const [contactInfo, setContactInfo] = useState(() => {
    const settings = getWebsiteSettings();
    return {
      phone: settings.phone || SCHOOL_INFO.contact.phone,
      email: settings.officialEmail || SCHOOL_INFO.contact.email,
    };
  });

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      const updated = e?.detail || getWebsiteSettings();
      setContactInfo({
        phone: updated.phone || SCHOOL_INFO.contact.phone,
        email: updated.officialEmail || SCHOOL_INFO.contact.email,
      });
    };
    window.addEventListener('mugina-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('mugina-settings-updated', handleSettingsUpdate);
  }, []);

  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="max-w-md space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            School Information
          </h3>

          <h4 className="text-xl sm:text-2xl font-black text-blue-950 dark:text-blue-200 tracking-tight font-display">
            Mugina Hope Primary School
          </h4>

          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>Mugina, Kamonyi District</p>
            <p>Southern Province, Rwanda</p>
          </div>

          <div className="pt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Phone:</span>{' '}
              <a
                href={`tel:${contactInfo.phone.replace(/\s+/g, '')}`}
                className="text-blue-900 dark:text-blue-300 hover:underline font-medium"
              >
                {contactInfo.phone}
              </a>
            </p>
            <p>
              <span className="font-semibold text-slate-900 dark:text-white">Email:</span>{' '}
              <a
                href={`mailto:${contactInfo.email}`}
                className="text-blue-900 dark:text-blue-300 hover:underline font-medium break-all"
              >
                {contactInfo.email}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
