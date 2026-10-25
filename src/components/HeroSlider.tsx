import React, { useState, useEffect } from 'react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { uploadSchoolAsset } from '../services/storageService';
import { PageId } from '../types';
import {
  Edit3,
  Check,
  X,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  imageUrl: string;
  title?: string;
}

interface HeroSliderProps {
  onNavigate?: (page: PageId) => void;
  onOpenApply?: () => void;
  onOpenTour?: () => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({
  onNavigate,
  onOpenApply,
  onOpenTour,
}) => {
  const [settings, setSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [sessionUser, setSessionUser] = useState(getCurrentSessionUser());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Modal editing form state
  const [editHeadline, setEditHeadline] = useState(
    settings.heroHeadline || 'Welcome to Runda Technical Secondary School'
  );
  const [editTagline, setEditTagline] = useState(
    settings.heroTagline ||
      "Welcome to Runda Technical Secondary School, located in Kamonyi District, South Rwanda. We're proud to offer a blend of academic and technical education, preparing students for success in the modern world."
  );
  const [editInterval, setEditInterval] = useState<number>(settings.heroIntervalSeconds || 5);
  const [editSlides, setEditSlides] = useState<HeroSlide[]>(
    settings.heroSlides && settings.heroSlides.length > 0
      ? settings.heroSlides
      : [
          {
            id: 'slide-1',
            imageUrl: '/images/hero_runda_campus.png',
            title: 'Runda Technical Secondary School Campus',
          },
          {
            id: 'slide-2',
            imageUrl: '/images/hero_mugina_hope_campus_1791823254957.jpg',
            title: 'Academic & Technical Campus Grounds',
          },
          {
            id: 'slide-3',
            imageUrl: '/images/primary_stem_computer_lab_1791823280335.jpg',
            title: 'ICT & Science Technology Labs',
          },
        ]
  );

  // Sync with global store & custom events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setEditHeadline(updated.heroHeadline || 'Welcome to Runda Technical Secondary School');
      setEditTagline(
        updated.heroTagline ||
          "Welcome to Runda Technical Secondary School, located in Kamonyi District, South Rwanda. We're proud to offer a blend of academic and technical education, preparing students for success in the modern world."
      );
      setEditInterval(updated.heroIntervalSeconds || 5);
      if (updated.heroSlides && updated.heroSlides.length > 0) {
        setEditSlides(updated.heroSlides);
      }
    };
    window.addEventListener('mugina-settings-updated', handleUpdate);
    return () => window.removeEventListener('mugina-settings-updated', handleUpdate);
  }, []);

  useEffect(() => {
    setSessionUser(getCurrentSessionUser());
  }, []);

  const isAdmin = sessionUser?.role === 'Admin' || sessionUser?.role === 'DOS';

  const slides: HeroSlide[] =
    settings.heroSlides && settings.heroSlides.length > 0
      ? settings.heroSlides
      : [
          {
            id: 'slide-1',
            imageUrl: '/images/hero_runda_campus.png',
            title: 'Runda Technical Secondary School Campus',
          },
          {
            id: 'slide-2',
            imageUrl: '/images/hero_mugina_hope_campus_1791823254957.jpg',
            title: 'Academic & Technical Campus Grounds',
          },
          {
            id: 'slide-3',
            imageUrl: '/images/primary_stem_computer_lab_1791823280335.jpg',
            title: 'ICT & Science Technology Labs',
          },
          {
            id: 'slide-4',
            imageUrl: '/images/campus_life_traditional_dance_1791823290926.jpg',
            title: 'Cultural Arts & Co-Curricular Excellence',
          },
        ];

  // Auto-advance slides every 5 seconds (configurable)
  useEffect(() => {
    if (slides.length <= 1) return;
    const intervalMs = (settings.heroIntervalSeconds || 5) * 1000;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, settings.heroIntervalSeconds]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

  const handleOpenEdit = () => {
    const cur = getWebsiteSettings();
    setEditHeadline(cur.heroHeadline || 'Welcome to Runda Technical Secondary School');
    setEditTagline(
      cur.heroTagline ||
        "Welcome to Runda Technical Secondary School, located in Kamonyi District, South Rwanda. We're proud to offer a blend of academic and technical education, preparing students for success in the modern world."
    );
    setEditInterval(cur.heroIntervalSeconds || 5);
    setEditSlides(cur.heroSlides && cur.heroSlides.length > 0 ? cur.heroSlides : slides);
    setIsEditModalOpen(true);
  };

  const handleAddSlide = () => {
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      imageUrl: '/images/hero_runda_campus.png',
      title: 'New Campus View',
    };
    setEditSlides([...editSlides, newSlide]);
  };

  const handleRemoveSlide = (idx: number) => {
    if (editSlides.length <= 1) {
      alert('You must have at least one hero image.');
      return;
    }
    setEditSlides(editSlides.filter((_, i) => i !== idx));
  };

  const handleSlideChange = (idx: number, field: keyof HeroSlide, val: string) => {
    const next = [...editSlides];
    next[idx] = { ...next[idx], [field]: val };
    setEditSlides(next);
  };

  const handleUploadImageForSlide = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const uploadRes = await uploadSchoolAsset(file, `hero_slide_${Date.now()}`, 'campus');
        handleSlideChange(idx, 'imageUrl', uploadRes.url);
      } catch (err) {
        console.warn('Error uploading hero slide:', err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSaveHero = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: WebsiteSettings = {
      ...settings,
      heroHeadline: editHeadline,
      heroTagline: editTagline,
      heroIntervalSeconds: Number(editInterval) || 5,
      heroSlides: editSlides,
    };
    saveWebsiteSettings(updatedSettings);
    setSettings(updatedSettings);
    setSaveSuccessMsg('Hero slider updated and saved permanently to database!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditModalOpen(false);
    }, 1200);
  };

  return (
    <div className="relative w-full">
      {/* Admin Quick Edit Bar */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-3 border border-blue-700">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-amber-400 text-blue-950 rounded-xl font-bold">
                <Edit3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  Hero Carousel Editor
                </span>
                <span className="text-xs text-blue-100">
                  Edit headline, description, 5-second interval, and add/remove background images (saved to database).
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Hero & Slides</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Container with Background Slider */}
      <section className="relative overflow-hidden bg-slate-950 text-white rounded-3xl mx-4 sm:mx-6 lg:mx-8 border border-slate-800 shadow-xl">
        <div className="relative min-h-[520px] sm:min-h-[580px] lg:min-h-[640px] w-full flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-hidden">
          {/* Background Images Carousel with 5-Second Crossfade */}
          {slides.map((slide, index) => (
            <div
              key={slide.id || index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? 'opacity-100 z-0' : 'opacity-0 -z-10'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.title || 'School Campus'}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = '1';
                    target.src = '/public/assets/aistudio/Capture_bbd3ed1e.PNG';
                  }
                }}
                className="w-full h-full object-cover object-center scale-105 transition-transform duration-[5000ms]"
              />
              {/* Subtle background scrim for contrast */}
              <div className="absolute inset-0 bg-black/30 backdrop-brightness-95" />
            </div>
          ))}

          {/* Center Box - Exact Visual Design Matching Capture.PNG */}
          <div className="relative z-10 w-full max-w-4xl mx-auto text-center px-4 sm:px-6">
            <div className="relative bg-black/40 backdrop-blur-xs border-2 border-[#3b82f6] rounded-none sm:rounded-lg px-6 sm:px-12 py-8 sm:py-14 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
              {/* Blue Horizontal Accent Line */}
              <div className="w-16 sm:w-20 h-1 bg-[#3b82f6] mx-auto mb-4 sm:mb-6 rounded-full" />

              {/* Title */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight font-display mb-4 drop-shadow-md leading-tight">
                {settings.heroHeadline || 'Welcome to Runda Technical Secondary School'}
              </h1>

              {/* Subtitle / Description */}
              <p className="text-xs sm:text-sm md:text-base text-white/95 max-w-2xl mx-auto font-normal leading-relaxed drop-shadow-sm">
                {settings.heroTagline ||
                  "Welcome to Runda Technical Secondary School, located in Kamonyi District, South Rwanda. We're proud to offer a blend of academic and technical education, preparing students for success in the modern world."}
              </p>

              {/* Action Buttons */}
              <div className="pt-6 flex flex-wrap items-center justify-center gap-3">
                {onOpenApply && (
                  <button
                    type="button"
                    onClick={onOpenApply}
                    className="cursor-pointer px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Enroll Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {onOpenTour && (
                  <button
                    type="button"
                    onClick={onOpenTour}
                    className="cursor-pointer px-5 py-2.5 bg-white/20 hover:bg-white/30 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-lg backdrop-blur-md border border-white/30 transition-all inline-flex items-center gap-1.5"
                  >
                    <Calendar className="w-4 h-4 text-amber-300" />
                    <span>Book Campus Tour</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Left / Right Arrow Navigation */}
          {slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/75 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/50 hover:bg-black/75 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                aria-label="Next Slide"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}

          {/* Bottom Slide Indicators (Dots & Timer Notice) */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentSlide ? 'w-6 bg-blue-500' : 'w-2 bg-white/50 hover:bg-white'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
            <span className="text-[10px] text-white/70 font-mono ml-2 border-l border-white/20 pl-2">
              0{currentSlide + 1} / 0{slides.length}
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ADMIN IN-PLACE LIVE EDIT MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-800 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg font-display">
                    Edit Hero Banner &amp; Image Slides
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes save permanently to Firebase and display across all devices for visitors and staff.
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

            <form onSubmit={handleSaveHero} className="space-y-6 text-xs">
              {/* Headline & Description */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Hero Text &amp; Timing
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Main Headline</label>
                    <input
                      type="text"
                      value={editHeadline}
                      onChange={(e) => setEditHeadline(e.target.value)}
                      placeholder="Welcome to Runda Technical Secondary School"
                      className="w-full bg-white border border-slate-300 p-2.5 rounded-lg font-bold text-slate-900 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Tagline / Description</label>
                    <textarea
                      rows={3}
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      placeholder="Welcome to Runda Technical Secondary School, located in Kamonyi District..."
                      className="w-full bg-white border border-slate-300 p-2.5 rounded-lg text-slate-900 text-xs"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="font-bold block mb-1 text-slate-700">
                        Slide Rotation Interval (Seconds)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={30}
                        value={editInterval}
                        onChange={(e) => setEditInterval(Number(e.target.value))}
                        className="w-32 bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                      />
                    </div>
                    <span className="text-slate-500 text-[11px] mt-5">
                      Recommended: 5 seconds for smooth browsing
                    </span>
                  </div>
                </div>
              </div>

              {/* Slides List Management */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    Interchanging Images ({editSlides.length} Images)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="cursor-pointer inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-blue-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Image</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {editSlides.map((slide, idx) => (
                    <div
                      key={slide.id || idx}
                      className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 relative shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px]">
                          Slide #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSlide(idx)}
                          className="cursor-pointer text-rose-500 hover:text-rose-700 p-1"
                          title="Remove slide"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-3">
                          <div className="h-16 w-full rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                            <img
                              src={slide.imageUrl}
                              alt={`Slide ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-5">
                          <label className="font-semibold block text-[11px] text-slate-600 mb-1">
                            Upload Photo
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadImageForSlide(idx, e)}
                            className="w-full text-xs"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="font-semibold block text-[11px] text-slate-600 mb-1">
                            Or Image URL
                          </label>
                          <input
                            type="text"
                            value={slide.imageUrl}
                            onChange={(e) => handleSlideChange(idx, 'imageUrl', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 p-1.5 rounded-lg text-slate-900 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="cursor-pointer px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="cursor-pointer px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
