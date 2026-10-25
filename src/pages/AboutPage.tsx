import React, { useState, useEffect } from 'react';
import { SCHOOL_INFO } from '../data/schoolData';
import { PageId } from '../types';
import {
  ShieldCheck,
  Target,
  Eye,
  Heart,
  Award,
  Sparkles,
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
} from 'lucide-react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { uploadSchoolAsset } from '../services/storageService';
import { SchoolStaffSection } from '../components/SchoolStaffSection';

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
  const [missionPointsText, setMissionPointsText] = useState(
    (settings.aboutMissionPoints || []).join('\n')
  );

  // Keep in sync with cross-device Firestore and Admin updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
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
        const uploadRes = await uploadSchoolAsset(file, 'rwanda_values_charter_board', 'branding');
        setEditFormData((prev) => ({
          ...prev,
          aboutValuesBannerUrl: uploadRes.url,
        }));
      } catch (err) {
        console.warn('Error uploading charter image:', err);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Admin Live Quick Edit Controls */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-700">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-400 text-blue-950 rounded-xl font-bold">
              <Edit3 className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                Administrator Live Editor
              </span>
              <p className="text-xs text-blue-100">
                You can change the Principal’s Photo, Welcome Letter, School Vision, Mission, and Rwandan Values Charter.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit About Page Content</span>
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-all active:scale-95 border border-blue-700"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
          About Our Institution
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-display tracking-tight">
          {settings.schoolName || 'Mugina Hope Primary & Nursery Academy'}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {settings.landmark
            ? `Located in Kamonyi District (${settings.landmark}), dedicated to academic excellence, discipline, and Rwandan values.`
            : 'Fostering excellence, character, and lifelong learning in Kamonyi District, Rwanda.'}
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. SCHOOL VISION, MISSION & EDUCATIONAL PILLARS */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Vision, Mission & Call to Action */}
          <div className="lg:col-span-6 space-y-6">
            {/* School Vision */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
                {settings.aboutVisionTitle || 'OUR VISION'}
              </span>
              <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed font-display">
                {settings.aboutVisionText ||
                  'To be a premier center of foundational and primary excellence in Rwanda, raising purposeful, morally grounded, and innovative young leaders prepared to excel and contribute to our nation.'}
              </p>
            </div>

            {/* School Mission */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 font-display">
                {settings.aboutMissionTitle || 'OUR MISSION'}
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed list-disc pl-5">
                {(settings.aboutMissionPoints && settings.aboutMissionPoints.length > 0
                  ? settings.aboutMissionPoints
                  : [
                      'Deliver high-quality, competency-based early childhood and primary education adhering strictly to Rwanda Basic Education Board (REB) standards.',
                      'Nurture Christian integrity, mutual respect, and cultural pride through Itorero ry’abato and traditional dance.',
                      'Equip learners with digital literacy, scientific inquiry, and English-Kinyarwanda bilingual fluency in a safe learning environment.',
                    ]
                ).map((point, idx) => (
                  <li key={idx} className="pl-1">
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Call to action buttons */}
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('academics')}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all border border-blue-600"
              >
                <span>View Academic Programs</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenApply}
                className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all border border-amber-400"
              >
                <span>Enroll for 2026</span>
              </button>
            </div>
          </div>

          {/* Right Column: Campus Showcase Banner */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-lg bg-slate-100 rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-2 group">
              <img
                src={settings.aboutValuesBannerUrl || '/images/hero_mugina_hope_campus_1791823254957.jpg'}
                alt="Mugina Hope Academy Campus"
                className="w-full h-72 sm:h-96 object-cover rounded-2xl group-hover:scale-102 transition-transform duration-500"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                }}
              />
              <div className="p-3 text-center">
                <span className="text-xs font-bold text-slate-900 block font-display">
                  Safe Learning Campus Next to Mugina Police Station
                </span>
                <span className="text-[11px] text-slate-500">
                  Kamonyi District · Southern Province · Founded in 2014
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MESSAGE FROM THE HEAD OF SCHOOL & LEADERSHIP */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Portrait Photo of Head of School */}
          <div className="md:col-span-5 flex justify-center">
            <div className="relative group max-w-sm w-full">
              <div className="w-full h-80 sm:h-[420px] rounded-3xl overflow-hidden bg-slate-100 border border-slate-200 shadow-md">
                <img
                  src={settings.aboutPrincipalPhotoUrl || '/images/hero_mugina_hope_campus_1791823254957.jpg'}
                  alt={settings.aboutPrincipalName || 'Head of School'}
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                  }}
                />
              </div>
              <div className="mt-3 text-center md:text-left">
                <span className="text-sm font-bold text-slate-900 block font-display">
                  {settings.aboutPrincipalName || 'Norbert Ihimbazwe Manzi'}
                </span>
                <span className="text-xs text-slate-500 block">
                  {settings.aboutPrincipalTitle || 'Head of School & Chief Administrator, Mugina Hope Academy'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Official Message Card */}
          <div className="md:col-span-7">
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-3xl p-6 sm:p-10 shadow-2xs space-y-5">
              {/* Kicker */}
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 block">
                {settings.aboutPrincipalKicker || 'MESSAGE FROM THE HEAD OF SCHOOL'}
              </span>

              {/* Welcome Title */}
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display tracking-tight">
                {settings.aboutPrincipalWelcome || 'Welcome to Mugina Hope Primary & Nursery Academy!'}
              </h2>

              {/* Message Paragraphs */}
              <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {messageParagraphs.length > 0 ? (
                  messageParagraphs.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))
                ) : (
                  <>
                    <p>
                      Welcome to Mugina Hope Primary &amp; Nursery Academy in Mugina Sector, Kamonyi District. Established in 2014, our school was founded on the fundamental belief that every child deserves a secure, joyful, and academically enriching foundation.
                    </p>
                    <p>
                      Our campus is securely situated adjacent to the Mugina Police Station, offering families unshakeable peace of mind. Here, dedicated teachers deliver the Rwanda Basic Education Board (REB) curriculum, enriched with early ICT literacy, English conversational fluency, and Rwandan cultural values through Itorero ry&apos;abato.
                    </p>
                    <p>
                      With an intimate 18:1 student-to-mentor ratio, we ensure that every single child is known, celebrated, and guided toward excellence, leadership, and moral integrity. Thank you for partnering with us in shaping the leaders of tomorrow!
                    </p>
                  </>
                )}
              </div>

              {/* Sign-off Signature */}
              <div className="pt-3 border-t border-blue-200/70 space-y-1">
                <p className="text-xs text-slate-600 font-medium">
                  {settings.aboutPrincipalSignoff || 'Sincerely and with warm regards,'}
                </p>
                <p className="text-sm font-bold text-slate-900 font-display">
                  {settings.aboutPrincipalName || 'Norbert Ihimbazwe Manzi'}
                </p>
                <p className="text-xs text-slate-600">
                  {settings.aboutPrincipalTitle || 'Head of School & Chief Administrator, Mugina Hope Academy'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Safety & Security Spotlight (Adjacent to Police Station) */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-8 sm:p-12 border border-emerald-800/60 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-800/60 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Peace of Mind for Every Parent & Learner
              </span>
              <h2 className="text-2xl font-bold font-display text-white">
                Safety & Security: Located Beside Mugina Police Station
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono bg-emerald-900/60 text-emerald-200 px-3 py-1.5 rounded-full border border-emerald-700/50">
            24/7 Protected Campus Zone
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm text-slate-300">
          <div className="space-y-1.5">
            <h3 className="font-bold text-white text-base">Direct Security Neighbor</h3>
            <p className="text-slate-400 leading-relaxed">
              Our campus shares its immediate boundary with the local Mugina Police Post in Kamonyi District, ensuring continuous protection, peace, and order.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-white text-base">Guarded Perimeter Walls</h3>
            <p className="text-slate-400 leading-relaxed">
              The entire academy grounds are enclosed with high masonry perimeter walls and secure checkpoints managed by trained security guards.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-white text-base">Verified Dismissal Protocol</h3>
            <p className="text-slate-400 leading-relaxed">
              No learner is released from campus without an authorized parent or guardian presenting their verified student ID badge.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Core Values (Indangagaciro Z'umuco nyarwanda) */}
      <div className="bg-slate-50 rounded-3xl p-8 sm:p-12 border border-slate-200 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Our Moral Foundation
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 font-display">
            Indangagaciro na Kirazira: The Pillars That Guide Our Learners
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Rooted in the official Rwandan national education framework of character development, patriotism, and diligence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>Gukunda Igihugu</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Patriotism & Duty</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instilling love for Rwanda, active citizenship, and dedication to national progress.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>Umurava no Gutsinda</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Diligence & Triumph</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Perseverance through difficult assignments, athletic discipline, and academic resilience.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>Kwihesha Agaciro</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Self-Worth & Dignity</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Honoring oneself through honesty, respect, clean presentation, and moral integrity.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span>Kugira Ikinyabupfura</span>
            </div>
            <h4 className="text-sm font-bold text-slate-900">Politeness & Respect</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Respectful behavior toward elders, supportive peer collaboration, and polite speech.
            </p>
          </div>
        </div>
      </div>

      {/* 6. School Staff Leadership Team (Matching Capture_cd3b07eb.PNG) */}
      <SchoolStaffSection />

      {/* 7. CTA Action Strip */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate('academics')}
          className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm"
        >
          View Academics & Grade Levels
        </button>
        <button
          type="button"
          onClick={onOpenApply}
          className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm border border-amber-400"
        >
          Apply for Admission
        </button>
        <button
          type="button"
          onClick={onOpenTour}
          className="cursor-pointer w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-all"
        >
          Schedule a School Visit
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ADMIN IN-PLACE EDIT MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-800 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg font-display">
                    Edit About Page Content
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes are saved to the database and Firebase, updating instantly across all devices.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveAboutContent} className="space-y-6 text-xs">
              {/* Section 1: Principal Message */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    1. Head of School / Administration Message
                  </h4>
                  <span className="text-[10px] text-blue-700 font-bold">Photo & Letter</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Head of School Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePrincipalPhotoUpload}
                      className="w-full bg-white border border-slate-300 p-1.5 rounded-lg text-xs cursor-pointer"
                    />
                    {isUploadingPhoto && (
                      <span className="text-[10px] text-blue-600 font-bold block mt-1">
                        Uploading photo to Firebase Storage...
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Or Image URL</label>
                    <input
                      type="text"
                      placeholder="e.g. /images/hero_mugina_hope_campus_1791823254957.jpg"
                      value={editFormData.aboutPrincipalPhotoUrl || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalPhotoUrl: e.target.value })
                      }
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Section Kicker</label>
                    <input
                      type="text"
                      value={editFormData.aboutPrincipalKicker || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalKicker: e.target.value })
                      }
                      placeholder="e.g. MESSAGE FROM THE HEAD OF SCHOOL"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Welcome Title</label>
                    <input
                      type="text"
                      value={editFormData.aboutPrincipalWelcome || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalWelcome: e.target.value })
                      }
                      placeholder="e.g. Welcome to Mugina Hope Primary & Nursery Academy!"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold block mb-1 text-slate-700">
                    Principal Message Letter (Separate paragraphs with a blank line)
                  </label>
                  <textarea
                    rows={6}
                    value={editFormData.aboutPrincipalMessage || ''}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, aboutPrincipalMessage: e.target.value })
                    }
                    placeholder="Enter the full letter text..."
                    className="w-full bg-white border border-slate-300 p-2.5 rounded-lg leading-relaxed text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Sign-off Greeting</label>
                    <input
                      type="text"
                      value={editFormData.aboutPrincipalSignoff || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalSignoff: e.target.value })
                      }
                      placeholder="e.g. Sincerely and with warm regards,"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Principal Full Name</label>
                    <input
                      type="text"
                      value={editFormData.aboutPrincipalName || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalName: e.target.value })
                      }
                      placeholder="e.g. Norbert Ihimbazwe Manzi"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Designation / Role Title</label>
                    <input
                      type="text"
                      value={editFormData.aboutPrincipalTitle || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutPrincipalTitle: e.target.value })
                      }
                      placeholder="e.g. Head of School & Chief Administrator, Mugina Hope Academy"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: School Vision, Mission & Values Charter */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    2. School Vision, Mission & Campus Visual
                  </h4>
                  <span className="text-[10px] text-blue-700 font-bold">Values & Goals</span>
                </div>

                <div>
                  <label className="font-bold block mb-1 text-slate-700">School Vision Text</label>
                  <textarea
                    rows={2}
                    value={editFormData.aboutVisionText || ''}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, aboutVisionText: e.target.value })
                    }
                    placeholder="Enter school vision..."
                    className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="font-bold block mb-1 text-slate-700">
                    School Mission Points (One point per line)
                  </label>
                  <textarea
                    rows={4}
                    value={missionPointsText}
                    onChange={(e) => setMissionPointsText(e.target.value)}
                    placeholder="Deliver high-quality REB curriculum...&#10;Nurture Christian integrity and cultural pride...&#10;Equip learners with digital literacy..."
                    className="w-full bg-white border border-slate-300 p-2 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Upload Values Board Graphic</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCharterUpload}
                      className="w-full bg-white border border-slate-300 p-1.5 rounded-lg text-xs cursor-pointer"
                    />
                    {isUploadingCharter && (
                      <span className="text-[10px] text-blue-600 font-bold block mt-1">
                        Uploading charter board to Firebase Storage...
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Or Board Graphic URL</label>
                    <input
                      type="text"
                      placeholder="e.g. /images/rwanda_school_values_charter.png"
                      value={editFormData.aboutValuesBannerUrl || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, aboutValuesBannerUrl: e.target.value })
                      }
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Changes to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
