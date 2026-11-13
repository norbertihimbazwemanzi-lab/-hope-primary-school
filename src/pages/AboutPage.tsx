import React, { useState, useEffect } from 'react';
import { SCHOOL_INFO } from '../data/schoolData';
import { PageId } from '../types';
import {
  Target,
  Eye,
  Heart,
  Award,
  BookOpen,
  MapPin,
  Clock,
  ArrowRight,
  GraduationCap,
  Edit3,
  Check,
  X,
  Upload,
  Globe,
  Star,
  CheckCircle2,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { uploadSchoolAsset } from '../services/storageService';
import { SchoolStaffSection } from '../components/SchoolStaffSection';
import { ReadMoreText, ReadMorePanel } from '../components/ReadMoreBlock';

interface AboutPageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  onNavigate,
  onOpenApply,
  onOpenTour,
}) => {
  const [settings, setSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [sessionUser, setSessionUser] = useState(getCurrentSessionUser());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<WebsiteSettings>(settings);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCharter, setIsUploadingCharter] = useState(false);
  const [principalImgError, setPrincipalImgError] = useState(false);
  const [missionPointsText, setMissionPointsText] = useState(
    (settings.aboutMissionPoints || []).join('\n')
  );

  // Keep in sync with cross-device Firestore and Admin updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setPrincipalImgError(false);
      setEditFormData(updated);
      setMissionPointsText((updated.aboutMissionPoints || []).join('\n'));
    };
    window.addEventListener('mugina-settings-updated', handleUpdate);
    return () => window.removeEventListener('mugina-settings-updated', handleUpdate);
  }, []);

  useEffect(() => {
    setSessionUser(getCurrentSessionUser());
  }, []);

  const isAdmin = sessionUser?.role === 'Admin';

  const handleOpenEdit = () => {
    const current = getWebsiteSettings();
    setEditFormData(current);
    setMissionPointsText((current.aboutMissionPoints || []).join('\n'));
    setIsEditModalOpen(true);
  };

  const handlePrincipalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      try {
        const uploadRes = await uploadSchoolAsset(file, 'principal_portrait_headmaster', 'branding');
        setEditFormData((prev) => ({
          ...prev,
          aboutPrincipalPhotoUrl: uploadRes.url,
        }));
      } catch (err) {
        console.warn('Error uploading principal photo:', err);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  const handleCharterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingCharter(true);
      try {
        const uploadRes = await uploadSchoolAsset(file, 'values_charter_board', 'branding');
        setEditFormData((prev) => ({
          ...prev,
          aboutValuesBannerUrl: uploadRes.url,
        }));
      } catch (err) {
        console.warn('Error uploading values charter banner:', err);
      } finally {
        setIsUploadingCharter(false);
      }
    }
  };

  const handleSaveAboutContent = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMissionPoints = missionPointsText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const updated: WebsiteSettings = {
      ...editFormData,
      aboutMissionPoints: parsedMissionPoints,
    };
    saveWebsiteSettings(updated);
    setSettings(updated);
    setSaveSuccessMsg('About page updated & synced permanently to database!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditModalOpen(false);
    }, 1500);
  };

  // Helper to render multiline message into paragraphs
  const messageParagraphs = (settings.aboutPrincipalMessage || '')
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Admin Live Quick Edit Controls */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-lg p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-blue-900 text-white rounded-md font-bold">
              <Edit3 className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-white block">
                Administrator Live Editor
              </span>
              <p className="text-[11px] text-slate-400">
                You can change the Principal’s Photo, Welcome Letter, School Vision, Mission, and Rwandan Values Charter.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs rounded-md shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit About Page Content</span>
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-md transition-colors border border-slate-700"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Title */}
      <div className="text-center max-w-3xl mx-auto space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          About Our Institution
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
          {settings.schoolName || 'Mugina Hope Primary & Nursery Academy'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">
          {settings.landmark
            ? `Located in Kamonyi District (${settings.landmark}), dedicated to foundational academic excellence, moral integrity, and Rwandan cultural values.`
            : 'Fostering excellence, character, and lifelong learning in Kamonyi District, Rwanda.'}
        </p>
      </div>

      {/* 2. School Vision, Mission & Core Commitments */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-10 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Vision, Mission & Action */}
          <div className="lg:col-span-7 space-y-6">
            {/* School Vision */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-900 block">
                {settings.aboutVisionTitle || 'OUR VISION'}
              </span>
              <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed font-serif">
                &ldquo;{settings.aboutVisionText ||
                  'To be a premier center of foundational and primary excellence in Rwanda, raising purposeful, morally grounded, and innovative young leaders prepared to excel and contribute to our nation.'}&rdquo;
              </p>
            </div>

            {/* School Mission */}
            {(() => {
              const allPoints =
                settings.aboutMissionPoints && settings.aboutMissionPoints.length > 0
                  ? settings.aboutMissionPoints
                  : [
                      'Deliver high-quality, competency-based early childhood and primary education adhering strictly to Rwanda Basic Education Board (REB) standards.',
                      'Nurture Christian integrity, mutual respect, and cultural pride through Itorero ry’abato and traditional arts.',
                      'Equip learners with digital literacy, scientific inquiry, and English-Kinyarwanda bilingual fluency in a safe learning environment.',
                    ];
              const firstPoint = allPoints[0];
              const restPoints = allPoints.slice(1);
              return (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {settings.aboutMissionTitle || 'OUR MISSION'}
                  </h3>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {firstPoint && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <span>{firstPoint}</span>
                      </li>
                    )}
                  </ul>
                  {restPoints.length > 0 && (
                    <ReadMorePanel readMoreLabel="Read More Mission Pillars" showLessLabel="Show Less">
                      <ul className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {restPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </ReadMorePanel>
                  )}
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('academics')}
                className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs rounded-md shadow-xs transition-colors"
              >
                <span>View Academic Programs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenApply}
                className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-md transition-colors border border-slate-300"
              >
                <span>Enroll for 2026</span>
              </button>
            </div>
          </div>

          {/* Right Column: Campus Showcase Banner */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full bg-slate-50 rounded-lg border border-slate-200 overflow-hidden p-2">
              <img
                src={settings.aboutValuesBannerUrl || '/images/hero_mugina_hope_campus_1791823254957.jpg'}
                alt="Mugina Hope Academy Campus"
                className="w-full h-64 sm:h-80 object-cover rounded-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                }}
              />
              <div className="p-2.5 text-center">
                <span className="text-xs font-bold text-slate-900 block">
                  Guarded Campus Adjacent to Mugina Police Station
                </span>
                <span className="text-[11px] text-slate-500">
                  Kamonyi District · Southern Province · Established 2014
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Message from the Head of School & Leadership */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-10 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Portrait Photo or Dignified Placeholder */}
          <div className="md:col-span-5 flex justify-center">
            <div className="max-w-xs w-full">
              <div className="w-full h-80 sm:h-96 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
                {settings.aboutPrincipalPhotoUrl && !principalImgError ? (
                  <img
                    src={settings.aboutPrincipalPhotoUrl}
                    alt={settings.aboutPrincipalName || 'Head of School'}
                    className="w-full h-full object-cover object-top"
                    onError={() => setPrincipalImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
                      <GraduationCap className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300 block">
                        Office of the Head of School
                      </span>
                      <span className="text-base font-bold text-white block mt-1">
                        {settings.aboutPrincipalName || 'Norbert Ihimbazwe Manzi'}
                      </span>
                      <span className="text-xs text-slate-300 block mt-0.5">
                        Mugina Hope Academy
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2.5 text-center md:text-left">
                <span className="text-sm font-bold text-slate-900 block">
                  {settings.aboutPrincipalName || 'Norbert Ihimbazwe Manzi'}
                </span>
                <span className="text-xs text-slate-500 block">
                  {settings.aboutPrincipalTitle || 'Head of School & Chief Administrator'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Official Message Text */}
          <div className="md:col-span-7">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 sm:p-8 space-y-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-900 block">
                {settings.aboutPrincipalKicker || 'MESSAGE FROM THE HEAD OF SCHOOL'}
              </span>

              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {settings.aboutPrincipalWelcome || 'Welcome to Mugina Hope Primary & Nursery Academy!'}
              </h2>

              <ReadMoreText
                paragraphs={
                  messageParagraphs.length > 0
                    ? messageParagraphs
                    : [
                        'Welcome to Mugina Hope Primary & Nursery Academy in Mugina Sector, Kamonyi District. Established in 2014, our school was founded on the fundamental belief that every child deserves a secure, joyful, and academically enriching foundation.',
                        "Our campus is securely situated adjacent to the Mugina Police Station, offering families unshakeable peace of mind. Here, dedicated teachers deliver the Rwanda Basic Education Board (REB) curriculum, enriched with early ICT literacy, English conversational fluency, and Rwandan cultural values through Itorero ry'abato.",
                        'With an intimate 18:1 student-to-mentor ratio, we ensure that every single child is known, celebrated, and guided toward excellence, leadership, and moral integrity. Thank you for partnering with us in shaping the leaders of tomorrow!',
                      ]
                }
                maxChars={190}
                paragraphClassName="text-xs sm:text-sm text-slate-700 leading-relaxed"
                readMoreLabel="Read Full Letter"
                showLessLabel="Show Less"
              />

              <div className="pt-3 border-t border-slate-200 space-y-0.5">
                <p className="text-xs text-slate-500">
                  {settings.aboutPrincipalSignoff || 'Sincerely and with warm regards,'}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {settings.aboutPrincipalName || 'Norbert Ihimbazwe Manzi'}
                </p>
                <p className="text-xs text-slate-500">
                  {settings.aboutPrincipalTitle || 'Head of School & Chief Administrator'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. School Vision, Mission, Core Values & Goals Information Banner */}
      <section className="bg-white rounded-xl p-2 sm:p-4 border border-slate-200 shadow-xs overflow-hidden">
        <img
          src="/assets/aistudio/Mugina_Hope_School_Information_Banner_a1d5b0d8.png"
          alt="Mugina Hope Primary School - Vision, Mission, Core Values, and Goals"
          className="w-full h-auto object-contain rounded-lg block"
        />
      </section>

      {/* 6. School Staff Leadership Team */}
      <SchoolStaffSection />

      {/* 7. Institutional CTA */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('academics')}
          className="cursor-pointer w-full sm:w-auto px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs rounded-md transition-colors shadow-xs"
        >
          View Academics & Grade Levels
        </button>
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

      {/* Admin In-Place Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-4 sm:p-8 space-y-5 shadow-xl border border-slate-200 my-4 sm:my-8 max-h-[92vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-900 rounded-md">
                  <Edit3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Edit About Page Content
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes are saved to the database and sync instantly across all devices.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-md flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAboutContent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Principal / Head of School Full Name
                </label>
                <input
                  type="text"
                  value={editFormData.aboutPrincipalName || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, aboutPrincipalName: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                  placeholder="e.g. Norbert Ihimbazwe Manzi"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Principal Portrait Photo
                  </label>
                  {editFormData.aboutPrincipalPhotoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditFormData((prev) => ({ ...prev, aboutPrincipalPhotoUrl: '' }))
                      }
                      className="cursor-pointer text-rose-600 hover:text-rose-800 font-semibold text-[11px] inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    value={editFormData.aboutPrincipalPhotoUrl || ''}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, aboutPrincipalPhotoUrl: e.target.value }))
                    }
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                    placeholder="Image URL (or leave empty for placeholder)..."
                  />
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-medium rounded-md inline-flex items-center justify-center gap-1 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingPhoto ? 'Uploading...' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingPhoto}
                      onChange={handlePrincipalPhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Welcome Letter from Head of School
                </label>
                <textarea
                  value={editFormData.aboutPrincipalMessage || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, aboutPrincipalMessage: e.target.value }))
                  }
                  rows={4}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-hidden leading-relaxed"
                  placeholder="Principal's message paragraphs..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Vision Statement
                </label>
                <textarea
                  value={editFormData.aboutVisionText || ''}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, aboutVisionText: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School Mission Points (One per line)
                </label>
                <textarea
                  value={missionPointsText}
                  onChange={(e) => setMissionPointsText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-950 hover:bg-blue-900 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save About Content</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
