import React, { useState, useEffect } from 'react';
import { PageId } from '../types';
import { SCHOOL_INFO } from '../data/schoolData';
import { HeroSlider } from '../components/HeroSlider';
import { DualPathGateway } from '../components/DualPathGateway';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  getAnnouncements,
  SchoolAnnouncement,
  WebsiteSettings,
} from '../services/adminStore';
import { isAdminOrExecutive } from '../services/rbac';
import { uploadSchoolAsset } from '../services/storageService';
import { ReadMoreText, ReadMorePanel } from '../components/ReadMoreBlock';
import {
  GraduationCap,
  Users,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Edit3,
  Upload,
  Trash2,
  X,
  Check,
  RefreshCw,
  Camera,
  Search,
  Bell,
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
  const [settings, setSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [sessionUser, setSessionUser] = useState(getCurrentSessionUser());
  const [isEditingLeadershipModal, setIsEditingLeadershipModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [managerImgError, setManagerImgError] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>(() =>
    getAnnouncements().filter((a) => a.isActive)
  );
  const [newsSearch, setNewsSearch] = useState('');
  const [newsCategory, setNewsCategory] = useState<string>('All');

  // Form states for in-place leadership editing
  const [managerPhotoUrl, setManagerPhotoUrl] = useState(settings.schoolManagerPhotoUrl || '');
  const [managerName, setManagerName] = useState(settings.schoolManagerName || 'HAKIZIMANA Protais');
  const [managerRole, setManagerRole] = useState(settings.schoolManagerRole || 'School Manager & Administrative Head');
  const [managerAlt, setManagerAlt] = useState(settings.schoolManagerAlt || 'HAKIZIMANA Protais - School Manager at Mugina Hope Primary School');
  const [messageKicker, setMessageKicker] = useState(settings.adminMessageKicker || 'Message from the Administration');
  const [messageHeading, setMessageHeading] = useState(settings.adminMessageHeading || 'Providing a Strong Foundation for Every Child in Kamonyi');
  const [messagePara1, setMessagePara1] = useState(
    settings.adminMessageParagraph1 ||
      `Established in ${SCHOOL_INFO.establishedYear}, Mugina Hope Academy was founded on a simple, enduring conviction: that every child in Rwanda deserves access to high-quality education rooted in discipline, moral integrity, and modern competence.`
  );
  const [messagePara2, setMessagePara2] = useState(
    settings.adminMessageParagraph2 ||
      'Operating directly under the guidance of the Rwanda Ministry of Education (MINEDUC), our dual nursery and primary curriculum prepares learners not only for national examination excellence (PLE) but also for responsible citizenship, creative problem-solving, and fluent trilingual communication.'
  );
  const [messageMotto, setMessageMotto] = useState(settings.adminMessageMotto || SCHOOL_INFO.motto);
  const [commitments, setCommitments] = useState<string[]>(
    settings.adminCommitments && settings.adminCommitments.length > 0
      ? settings.adminCommitments
      : [
          'Competency-Based Curriculum: Aligned with Rwanda REB standards.',
          '24/7 Campus Security: Direct boundary with Mugina Police Station.',
          '18:1 Low Pupil Ratio: Individualized attention for every learner.',
          'STEM & Computer Lab: Practical hands-on ICT education.',
        ]
  );

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setManagerImgError(false);
      setManagerPhotoUrl(updated.schoolManagerPhotoUrl || '');
      setManagerName(updated.schoolManagerName || 'HAKIZIMANA Protais');
      setManagerRole(updated.schoolManagerRole || 'School Manager & Administrative Head');
      setManagerAlt(updated.schoolManagerAlt || 'HAKIZIMANA Protais - School Manager at Mugina Hope Primary School');
      setMessageKicker(updated.adminMessageKicker || 'Message from the Administration');
      setMessageHeading(updated.adminMessageHeading || 'Providing a Strong Foundation for Every Child in Kamonyi');
      if (updated.adminMessageParagraph1) setMessagePara1(updated.adminMessageParagraph1);
      if (updated.adminMessageParagraph2) setMessagePara2(updated.adminMessageParagraph2);
      if (updated.adminMessageMotto) setMessageMotto(updated.adminMessageMotto);
      if (updated.adminCommitments) setCommitments(updated.adminCommitments);
    };
    const handleAnnUpdate = () => {
      setAnnouncements(getAnnouncements().filter((a) => a.isActive));
    };
    window.addEventListener('mugina-settings-updated', handleUpdate);
    window.addEventListener('mugina-announcements-updated', handleAnnUpdate);
    return () => {
      window.removeEventListener('mugina-settings-updated', handleUpdate);
      window.removeEventListener('mugina-announcements-updated', handleAnnUpdate);
    };
  }, []);

  useEffect(() => {
    setSessionUser(getCurrentSessionUser());
  }, []);

  const isAdmin = isAdminOrExecutive(sessionUser?.role);

  const handleOpenEditModal = () => {
    const cur = getWebsiteSettings();
    setManagerPhotoUrl(cur.schoolManagerPhotoUrl || '');
    setManagerName(cur.schoolManagerName || 'HAKIZIMANA Protais');
    setManagerRole(cur.schoolManagerRole || 'School Manager & Administrative Head');
    setManagerAlt(cur.schoolManagerAlt || 'HAKIZIMANA Protais - School Manager at Mugina Hope Primary School');
    setMessageKicker(cur.adminMessageKicker || 'Message from the Administration');
    setMessageHeading(cur.adminMessageHeading || 'Providing a Strong Foundation for Every Child in Kamonyi');
    setMessagePara1(
      cur.adminMessageParagraph1 ||
        `Established in ${SCHOOL_INFO.establishedYear}, Mugina Hope Academy was founded on a simple, enduring conviction: that every child in Rwanda deserves access to high-quality education rooted in discipline, moral integrity, and modern competence.`
    );
    setMessagePara2(
      cur.adminMessageParagraph2 ||
        'Operating directly under the guidance of the Rwanda Ministry of Education (MINEDUC), our dual nursery and primary curriculum prepares learners not only for national examination excellence (PLE) but also for responsible citizenship, creative problem-solving, and fluent trilingual communication.'
    );
    setMessageMotto(cur.adminMessageMotto || 'Nurturing Minds, Building Character, Inspiring Hope.');
    setCommitments(
      cur.adminCommitments && cur.adminCommitments.length > 0
        ? cur.adminCommitments
        : [
            'Competency-Based Curriculum: Aligned with Rwanda REB standards.',
            '24/7 Campus Security: Direct boundary with Mugina Police Station.',
            '18:1 Low Pupil Ratio: Individualized attention for every learner.',
            'STEM & Computer Lab: Practical hands-on ICT education.',
          ]
    );
    setIsEditingLeadershipModal(true);
  };

  const handleManagerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      try {
        const uploadRes = await uploadSchoolAsset(file, 'school_manager_portrait', 'branding');
        setManagerPhotoUrl(uploadRes.url);
      } catch (err) {
        console.warn('Error uploading manager photo:', err);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const syncManagerShowcaseImage = (base: WebsiteSettings, nextPhotoUrl: string) => {
    if (!Array.isArray(base.staffShowcase)) return undefined;
    return base.staffShowcase.map((m) =>
      m.id === 'staff-lead-1' || m.role.toLowerCase().includes('manager')
        ? { ...m, imageUrl: nextPhotoUrl }
        : m
    );
  };

  const handleSaveLeadership = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = managerPhotoUrl.trim();
    const latest = getWebsiteSettings();
    const updatedShowcase = syncManagerShowcaseImage(latest, cleanUrl);
    const updated: WebsiteSettings = {
      ...latest,
      schoolManagerPhotoUrl: cleanUrl,
      schoolManagerName: managerName.trim(),
      schoolManagerRole: managerRole.trim(),
      schoolManagerAlt: managerAlt.trim(),
      adminMessageKicker: messageKicker.trim(),
      adminMessageHeading: messageHeading.trim(),
      adminMessageParagraph1: messagePara1.trim(),
      adminMessageParagraph2: messagePara2.trim(),
      adminMessageMotto: messageMotto.trim(),
      adminCommitments: commitments,
      ...(updatedShowcase ? { staffShowcase: updatedShowcase } : {}),
    };
    saveWebsiteSettings(updated);
    setSettings(updated);
    setManagerImgError(false);
    setSaveToast('Leadership message and School Manager image saved permanently!');
    setTimeout(() => {
      setSaveToast(null);
      setIsEditingLeadershipModal(false);
    }, 1200);
  };

  return (
    <div className="space-y-14 sm:space-y-20 pb-12">
      {/* 1. Hero Section & Visual Presentation */}
      <HeroSlider
        onNavigate={onNavigate}
        onOpenApply={onOpenApply}
        onOpenTour={onOpenTour}
      />

      {/* 2. Welcome from Leadership & Institutional Purpose */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-10 lg:p-12 shadow-xs relative">
          {/* Admin In-Place Quick Edit Button */}
          {isAdmin && (
            <div className="mb-6 flex justify-end">
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs rounded-lg transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Leadership Message & Manager Image</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: School Manager Leadership Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100 shadow-2xs">
                {settings.schoolManagerPhotoUrl && !managerImgError ? (
                  <>
                    <img
                      src={settings.schoolManagerPhotoUrl}
                      alt={
                        settings.schoolManagerAlt ||
                        `${settings.schoolManagerName || 'School Manager'} - Mugina Hope Academy`
                      }
                      className="w-full h-full object-cover object-top"
                      onError={() => setManagerImgError(true)}
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/85 backdrop-blur-xs p-3 text-white text-xs border-t border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold block truncate">
                            {settings.schoolManagerName || 'HAKIZIMANA Protais'}
                          </span>
                          <span className="text-slate-300 text-[11px] block truncate">
                            {settings.schoolManagerRole || 'School Manager & Administrative Head'}
                          </span>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={handleOpenEditModal}
                            className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-md transition-colors cursor-pointer shrink-0"
                            title="Edit Manager Photo & Details"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Dignified Institutional Leadership Placeholder when image is cleared/empty */
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shadow-inner">
                      <GraduationCap className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300 block">
                        Office of Administration
                      </span>
                      <span className="text-base font-bold text-white block mt-0.5">
                        {settings.schoolManagerName || 'HAKIZIMANA Protais'}
                      </span>
                      <span className="text-xs text-slate-300 block">
                        {settings.schoolManagerRole || 'School Manager & Administrative Head'}
                      </span>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleOpenEditModal}
                        className="cursor-pointer mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Add School Manager Image</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* School Motto Banner */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-800 dark:text-white block mb-0.5">Official School Motto:</span>
                <span className="italic text-slate-700 dark:text-amber-300 font-serif">
                  &ldquo;{settings.adminMessageMotto || settings.motto || SCHOOL_INFO.motto}&rdquo;
                </span>
              </div>
            </div>

            {/* Right Column: Editorial Message */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  {settings.adminMessageKicker || 'Message from the Administration'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
                  {settings.adminMessageHeading || 'Providing a Strong Foundation for Every Child in Kamonyi'}
                </h2>
              </div>

              <ReadMoreText
                paragraphs={[
                  settings.adminMessageParagraph1 ||
                    `Established in ${SCHOOL_INFO.establishedYear}, Mugina Hope Academy was founded on a simple, enduring conviction: that every child in Rwanda deserves access to high-quality education rooted in discipline, moral integrity, and modern competence.`,
                  settings.adminMessageParagraph2 ||
                    'Operating directly under the guidance of the Rwanda Ministry of Education (MINEDUC), our dual nursery and primary curriculum prepares learners not only for national examination excellence (PLE) but also for responsible citizenship, creative problem-solving, and fluent trilingual communication.',
                ]}
                maxChars={190}
                paragraphClassName="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
                readMoreLabel="Read More"
                showLessLabel="Show Less"
              />

              {/* Core Institutional Commitments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {(settings.adminCommitments && settings.adminCommitments.length > 0
                  ? settings.adminCommitments
                  : [
                      'Competency-Based Curriculum: Aligned with Rwanda REB standards.',
                      '24/7 Campus Security: Direct boundary with Mugina Police Station.',
                      '18:1 Low Pupil Ratio: Individualized attention for every learner.',
                      'STEM & Computer Lab: Practical hands-on ICT education.',
                    ]
                ).map((commitment, cIdx) => (
                  <div key={cIdx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-700 dark:text-slate-300">{commitment}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => onNavigate('about')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  <span>Read About Our Heritage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenApply}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-900 dark:text-amber-400 hover:text-blue-700 dark:hover:text-amber-300 underline underline-offset-4 decoration-2 decoration-blue-900 dark:decoration-amber-400 hover:decoration-blue-700 transition-colors cursor-pointer"
                >
                  <span>Apply for Admission</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal: Edit Leadership & School Manager Information */}
      {isEditingLeadershipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-900 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Edit Leadership Message & School Manager Image
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Changes are saved permanently to the database and update across all visitor screens.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingLeadershipModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveToast && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveToast}</span>
              </div>
            )}

            <form onSubmit={handleSaveLeadership} className="space-y-4 text-xs">
              {/* Image Upload Block */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    School Manager Portrait Photo
                  </span>
                  {managerPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setManagerPhotoUrl('');
                        const latest = getWebsiteSettings();
                        const updatedShowcase = syncManagerShowcaseImage(latest, '');
                        const clearedSettings: WebsiteSettings = {
                          ...latest,
                          schoolManagerPhotoUrl: '',
                          ...(updatedShowcase ? { staffShowcase: updatedShowcase } : {}),
                        };
                        saveWebsiteSettings(clearedSettings);
                        setSettings(clearedSettings);
                        setManagerImgError(false);
                        setSaveToast('School Manager photo removed permanently across all browsers.');
                        setTimeout(() => setSaveToast(null), 2500);
                      }}
                      className="cursor-pointer text-rose-600 hover:text-rose-800 font-semibold text-[11px] inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-4 h-32 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                    {managerPhotoUrl ? (
                      <img
                        src={managerPhotoUrl}
                        alt="School Manager Preview"
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <GraduationCap className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <span className="text-[10px] block">No image selected (placeholder active)</span>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-8 space-y-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Upload Image from Device (PNG, JPG, WebP)
                      </label>
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-lg text-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingPhoto ? 'Uploading...' : 'Choose Image File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingPhoto}
                          onChange={handleManagerPhotoUpload}
                          className="hidden"
                        />
                      </label>
                      {isUploadingPhoto && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 ml-2">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Uploading to storage...
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Or Enter Direct Image URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://... or /images/..."
                        value={managerPhotoUrl}
                        onChange={(e) => setManagerPhotoUrl(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Manager Name & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">School Manager Full Name *</label>
                  <input
                    type="text"
                    required
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Manager Role / Title *</label>
                  <input
                    type="text"
                    required
                    value={managerRole}
                    onChange={(e) => setManagerRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Accessibility Alt-Text (SEO) *</label>
                  <input
                    type="text"
                    value={managerAlt}
                    onChange={(e) => setManagerAlt(e.target.value)}
                    placeholder="e.g. HAKIZIMANA Protais - School Manager & Administrative Head at Mugina Hope Primary School"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {/* Section Headlines */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section Kicker / Subtitle</label>
                  <input
                    type="text"
                    value={messageKicker}
                    onChange={(e) => setMessageKicker(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold uppercase tracking-wider text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Main Heading *</label>
                  <input
                    type="text"
                    required
                    value={messageHeading}
                    onChange={(e) => setMessageHeading(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Paragraph 1 *</label>
                  <textarea
                    rows={3}
                    required
                    value={messagePara1}
                    onChange={(e) => setMessagePara1(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Paragraph 2</label>
                  <textarea
                    rows={3}
                    value={messagePara2}
                    onChange={(e) => setMessagePara2(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Official School Motto (Displayed in Quote Card)</label>
                  <input
                    type="text"
                    value={messageMotto}
                    onChange={(e) => setMessageMotto(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 italic"
                  />
                </div>
              </div>

              {/* Institutional Commitments */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700">Core Commitments (4 Checkpoints)</label>
                {commitments.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-bold text-slate-400 w-5">#{idx + 1}</span>
                    <input
                      type="text"
                      value={c}
                      onChange={(e) => {
                        const updated = [...commitments];
                        updated[idx] = e.target.value;
                        setCommitments(updated);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingLeadershipModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Save Leadership Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Key Pillars / Quick Institutional Facts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Curriculum
                </span>
                <BookOpen className="w-4 h-4 text-blue-900 dark:text-blue-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                MINEDUC CBC
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Standard Rwanda national educational syllabus focusing on critical thinking, literacy, and numeracy.
              </p>
            </div>
            <ReadMorePanel readMoreLabel="Read More" showLessLabel="Show Less">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                Instruction is delivered in English alongside structured French and Kinyarwanda mastery, equipping learners for Primary Leaving Examinations (PLE) and practical problem solving.
              </p>
            </ReadMorePanel>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Campus Safety
                </span>
                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                Guarded Perimeter
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Adjacent to Mugina Police Station with perimeter walls and strictly verified family dismissal protocols.
              </p>
            </div>
            <ReadMorePanel readMoreLabel="Read More" showLessLabel="Show Less">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                Trained security personnel monitor every entry gate 24/7, logging all visitors and verifying authorized guardian credentials before any pupil departs campus.
              </p>
            </ReadMorePanel>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Grade Scope
                </span>
                <GraduationCap className="w-4 h-4 text-blue-900 dark:text-blue-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                Nursery to P6
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Comprehensive educational continuity from Baby Class (3y) through Primary 6 graduation examinations.
              </p>
            </div>
            <ReadMorePanel readMoreLabel="Read More" showLessLabel="Show Less">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                Learners progress seamlessly across Baby, Middle, and Top Nursery classes into Lower Primary (P1–P3) and Upper Primary (P4–P6) under one supportive roof.
              </p>
            </ReadMorePanel>
          </div>

          {/* Pillar 4 */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mentorship
                </span>
                <Users className="w-4 h-4 text-slate-700 dark:text-amber-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                18 : 1 Pupil Ratio
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Carefully managed class cohorts ensuring individualized attention and regular teacher-parent feedback.
              </p>
            </div>
            <ReadMorePanel readMoreLabel="Read More" showLessLabel="Show Less">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2 border-t border-slate-100 dark:border-slate-800">
                Small class sizes allow educators to spot learning strengths early, offer daily remedial guidance, and share timely academic and attendance updates with families.
              </p>
            </ReadMorePanel>
          </div>
        </div>
      </section>

      {/* 4. News & Official Announcements (Searchable & Filterable) */}
      {announcements.length > 0 && (() => {
        const categories = ['All', ...Array.from(new Set(announcements.map((a) => a.badge || 'Notice')))];
        const filteredNews = announcements.filter((item) => {
          const matchesCat = newsCategory === 'All' || (item.badge || 'Notice') === newsCategory;
          const q = newsSearch.trim().toLowerCase();
          const matchesSearch =
            !q ||
            item.title.toLowerCase().includes(q) ||
            item.content.toLowerCase().includes(q);
          return matchesCat && matchesSearch;
        });

        return (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-amber-400">
                    <Bell className="w-4 h-4" />
                    <span>School Noticeboard &amp; Updates</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Latest News &amp; Official Announcements
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={newsSearch}
                      onChange={(e) => setNewsSearch(e.target.value)}
                      placeholder="Search notices..."
                      aria-label="Search school announcements"
                      className="w-full sm:w-52 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewsCategory(cat)}
                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          newsCategory === cat
                            ? 'bg-blue-900 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredNews.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                  No announcements match your filter.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNews.slice(0, 6).map((item) => (
                    <article
                      key={item.id}
                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                            {item.badge || 'Notice'}
                          </span>
                          <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            {item.publishedAt}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* 5. Academic Pathways */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DualPathGateway
          onNavigate={onNavigate}
          onOpenApply={onOpenApply}
        />
      </section>
    </div>
  );
};
