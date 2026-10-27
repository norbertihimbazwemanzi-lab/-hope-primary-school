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
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  GraduationCap,
} from 'lucide-react';

interface HeroSlide {
  id: string;
  imageUrl: string;
  title?: string;
  altText?: string;
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

  const defaultHeadline = 'Welcome to Mugina Hope Academy';
  const defaultTagline =
    'Dedicated to foundational academic excellence, moral integrity, and Rwanda national curriculum standards. Preparing nursery and primary pupils for lifelong success in Kamonyi District.';

  const [editHeadline, setEditHeadline] = useState(settings.heroHeadline || defaultHeadline);
  const [editTagline, setEditTagline] = useState(settings.heroTagline || defaultTagline);
  const [editInterval, setEditInterval] = useState<number>(settings.heroIntervalSeconds || 5);
  const [editSlides, setEditSlides] = useState<HeroSlide[]>(
    settings.heroSlides && settings.heroSlides.length > 0
      ? settings.heroSlides
      : [
          {
            id: 'slide-1',
            imageUrl: '/images/hero_runda_campus.png',
            title: 'School Campus & Administration Grounds',
          },
          {
            id: 'slide-2',
            imageUrl: '/images/hero_mugina_hope_campus_1791823254957.jpg',
            title: 'Classroom Blocks & Safe Perimeter',
          },
          {
            id: 'slide-3',
            imageUrl: '/images/primary_stem_computer_lab_1791823280335.jpg',
            title: 'ICT & Science Learning Laboratory',
          },
        ]
  );

  // Sync with global store & custom events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setEditHeadline(updated.heroHeadline || defaultHeadline);
      setEditTagline(updated.heroTagline || defaultTagline);
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
            title: 'School Campus & Administration Grounds',
          },
          {
            id: 'slide-2',
            imageUrl: '/images/hero_mugina_hope_campus_1791823254957.jpg',
            title: 'Classroom Blocks & Safe Perimeter',
          },
          {
            id: 'slide-3',
            imageUrl: '/images/primary_stem_computer_lab_1791823280335.jpg',
            title: 'ICT & Science Learning Laboratory',
          },
        ];

  // Auto-advance slides every interval (configurable)
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
    setEditHeadline(cur.heroHeadline || defaultHeadline);
    setEditTagline(cur.heroTagline || defaultTagline);
    setEditInterval(cur.heroIntervalSeconds || 5);
    setEditSlides(cur.heroSlides && cur.heroSlides.length > 0 ? cur.heroSlides : slides);
    setIsEditModalOpen(true);
  };

  const handleAddSlide = () => {
    const newSlide: HeroSlide = {
      id: `slide-${Date.now()}`,
      imageUrl: '/images/hero_runda_campus.png',
      title: 'New Campus Photograph',
    };
    setEditSlides([...editSlides, newSlide]);
  };

  const handleRemoveSlide = (idx: number) => {
    setEditSlides(editSlides.filter((_, i) => i !== idx));
  };

  const handleSlideChange = (idx: number, field: keyof HeroSlide, value: string) => {
    const updated = [...editSlides];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditSlides(updated);
  };

  const handleSlideUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const uploadRes = await uploadSchoolAsset(file, `hero_slide_${Date.now()}`, 'gallery');
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
    const updated: WebsiteSettings = {
      ...settings,
      heroHeadline: editHeadline,
      heroTagline: editTagline,
      heroIntervalSeconds: Number(editInterval) || 5,
      heroSlides: editSlides.filter((s) => s.imageUrl && s.imageUrl.trim().length > 0),
    };
    saveWebsiteSettings(updated);
    setSettings(updated);
    setSaveSuccessMsg('Hero section updated and saved permanently to database!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditModalOpen(false);
    }, 1200);
  };

  return (
    <div className="relative">
      {/* Admin Quick Edit Bar */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2">
          <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xs flex items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-blue-900 text-white rounded-md">
                <Edit3 className="w-3.5 h-3.5" />
              </span>
              <div>
                <span className="text-xs font-bold text-slate-100 block">
                  Hero Presentation Editor
                </span>
                <span className="text-[11px] text-slate-400">
                  Logged in as {sessionUser?.name || 'Administrator'}. Changes sync across all devices.
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs rounded-md shadow-xs transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Hero Content</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Hero Container */}
      <section className="relative overflow-hidden bg-slate-950 text-white mx-2 sm:mx-6 lg:mx-8 rounded-xl border border-slate-800 shadow-sm">
        <div className="relative min-h-[440px] sm:min-h-[520px] lg:min-h-[580px] w-full flex items-center justify-center p-3 sm:p-8 lg:p-12 overflow-hidden">
          {/* Background Images Carousel with Clean Crossfade */}
          {slides.map((slide, index) => (
            <div
              key={slide.id || index}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                index === currentSlide ? 'opacity-100 z-0' : 'opacity-0 -z-10'
              }`}
            >
              <img
                src={slide.imageUrl}
                alt={slide.altText || slide.title || 'Mugina Hope Primary and Nursery School Campus'}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = '1';
                    target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                  }
                }}
                className="w-full h-full object-cover object-center"
              />
              {/* Dignified dark scrim for maximum legibility */}
              <div className="absolute inset-0 bg-slate-950/65" />
            </div>
          ))}

          {/* Center Box - Dignified Educational Framing */}
          <div className="relative z-10 w-full max-w-3xl mx-auto text-center px-1 sm:px-4">
            <div className="bg-slate-900/85 backdrop-blur-xs border border-slate-700/80 rounded-xl px-4 sm:px-10 py-6 sm:py-12 shadow-xl">
              {/* Authority Kicker */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase mb-3 sm:mb-4">
                <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                <span>Nursery & Primary School · Kamonyi</span>
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-snug sm:leading-tight mb-3 sm:mb-4">
                {settings.heroHeadline || defaultHeadline}
              </h1>

              {/* Subtitle / Description */}
              <p className="text-xs sm:text-sm lg:text-base text-slate-200 max-w-2xl mx-auto font-normal leading-relaxed mb-5 sm:mb-6">
                {settings.heroTagline || defaultTagline}
              </p>

              {/* Action Buttons - Stacked on small mobile (375px-480px) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 max-w-md mx-auto">
                {onOpenApply && (
                  <button
                    type="button"
                    onClick={onOpenApply}
                    className="cursor-pointer justify-center px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold text-xs sm:text-sm rounded-md shadow-xs transition-colors inline-flex items-center gap-2"
                  >
                    <span>Apply for Admission</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {onOpenTour && (
                  <button
                    type="button"
                    onClick={onOpenTour}
                    className="cursor-pointer justify-center px-4 sm:px-5 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-medium text-xs sm:text-sm rounded-md border border-slate-600 transition-colors inline-flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Schedule Campus Visit</span>
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
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-md bg-slate-900/70 hover:bg-slate-900 text-white border border-slate-700 transition-colors cursor-pointer"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-md bg-slate-900/70 hover:bg-slate-900 text-white border border-slate-700 transition-colors cursor-pointer"
                aria-label="Next Slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Bottom Slide Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-900/80 px-3 py-1 rounded-md border border-slate-700 text-xs text-slate-400">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-sm transition-all duration-300 cursor-pointer ${
                  idx === currentSlide ? 'w-5 bg-blue-500' : 'w-2 bg-slate-600 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
            <span className="font-mono text-[10px] ml-1 text-slate-400">
              0{currentSlide + 1} / 0{slides.length}
            </span>
          </div>
        </div>
      </section>

      {/* Admin Live Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-900 rounded-md">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Edit Hero Presentation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes save permanently to the database and sync instantly to all devices.
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

            <form onSubmit={handleSaveHero} className="space-y-5">
              {/* Headline */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Main Headline
                </label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-hidden"
                  placeholder="e.g. Welcome to Mugina Hope Academy"
                  required
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Subtitle / Mission Statement
                </label>
                <textarea
                  value={editTagline}
                  onChange={(e) => setEditTagline(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-hidden leading-relaxed"
                  placeholder="School description..."
                  required
                />
              </div>

              {/* Rotation Interval */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Image Rotation Interval (Seconds)
                </label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={editInterval}
                  onChange={(e) => setEditInterval(Number(e.target.value) || 5)}
                  className="w-32 px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-hidden"
                />
              </div>

              {/* Slides List */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Hero Slide Images ({editSlides.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slide</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {editSlides.map((slide, idx) => (
                    <div
                      key={slide.id || idx}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Slide #{idx + 1}</span>
                        {editSlides.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSlide(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Image URL / Path</label>
                          <input
                            type="text"
                            value={slide.imageUrl}
                            onChange={(e) => handleSlideChange(idx, 'imageUrl', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Caption / Title</label>
                          <input
                            type="text"
                            value={slide.title || ''}
                            onChange={(e) => handleSlideChange(idx, 'title', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-slate-600 mb-1">Accessibility Alt-Text (SEO & Screen Readers)</label>
                          <input
                            type="text"
                            placeholder="e.g. Mugina Hope Primary students engaged in classroom learning activity"
                            value={slide.altText || ''}
                            onChange={(e) => handleSlideChange(idx, 'altText', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-md">
                          <Upload className="w-3 h-3 text-slate-500" />
                          <span>Upload New File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSlideUpload(idx, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
