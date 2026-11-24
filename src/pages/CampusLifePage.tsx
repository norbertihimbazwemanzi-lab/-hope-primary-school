import React, { useState, useEffect } from 'react';
import { FacilityItem, PageId } from '../types';
import { GalleryLightbox } from '../components/GalleryLightbox';
import { ReadMoreText } from '../components/ReadMoreBlock';
import {
  getGalleryItems,
  syncServerGalleryItems,
  filterGalleryAgainstTombstones,
} from '../services/adminStore';
import {
  Maximize2,
  Image as ImageIcon,
} from 'lucide-react';

interface CampusLifePageProps {
  onNavigate: (page: PageId) => void;
  onOpenApply: () => void;
  onOpenTour: () => void;
}

export const CampusLifePage: React.FC<CampusLifePageProps> = ({
  onNavigate,
  onOpenApply,
  onOpenTour,
}) => {
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [facilities, setFacilities] = useState<FacilityItem[]>(getGalleryItems());

  useEffect(() => {
    // 1. Load initial cache
    setFacilities(getGalleryItems());

    // 2. Authoritative tombstone- and timestamp-aware cloud sync (Supabase + Firebase + Express)
    let isMounted = true;
    syncServerGalleryItems()
      .then((cleaned) => {
        if (isMounted) setFacilities(cleaned);
      })
      .catch((err) => console.warn('Gallery sync notice:', err));

    const galleryHandler = (e: any) => {
      if (Array.isArray(e.detail)) {
        setFacilities(filterGalleryAgainstTombstones(e.detail));
      } else {
        setFacilities(getGalleryItems());
      }
    };
    const settingsHandler = () => {
      setFacilities(getGalleryItems());
    };
    window.addEventListener('mugina-gallery-updated', galleryHandler);
    window.addEventListener('mugina-settings-updated', settingsHandler);

    return () => {
      isMounted = false;
      window.removeEventListener('mugina-gallery-updated', galleryHandler);
      window.removeEventListener('mugina-settings-updated', settingsHandler);
    };
  }, []);

  const filteredFacilities = facilities.filter((fac) => {
    if (activeCategory === 'all') return true;
    return fac.category === activeCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

      {/* 4. Facilities Gallery & Lightbox */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Campus Spaces
            </span>
            <h2 className="text-2xl font-bold text-slate-900 font-display">
              Facilities & Learning Environment Gallery
            </h2>
            <p className="text-xs text-slate-500">
              Click any photo for high-resolution details and location notes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Spaces
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('classrooms')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'classrooms'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Classrooms
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('technology')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'technology'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ICT Lab
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('culture')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'culture'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Culture Field
            </button>
          </div>
        </div>

        {/* Gallery Grid / Empty State */}
        {filteredFacilities.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 sm:p-12 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Gallery Photos Available</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeCategory === 'all'
                ? 'School gallery photos uploaded by the administrator will appear here immediately.'
                : 'No photos found in this category right now. Try selecting "All Spaces".'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFacilities.map((fac) => (
              <div
                key={fac.id}
                onClick={() => setSelectedFacility(fac)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col"
              >
                <div className="relative h-56 bg-slate-100 overflow-hidden">
                  <img
                    src={fac.imageSrc}
                    alt={fac.altText || fac.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src.includes('/src/assets/images/')) {
                        const filename = target.src.split('/').pop();
                        target.src = `/images/${filename}`;
                      } else if (!target.dataset.triedFallback) {
                        target.dataset.triedFallback = '1';
                        target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                    <span className="text-xs text-white font-medium flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" /> View Photo
                    </span>
                    <span className="text-[11px] text-amber-300 capitalize font-mono">
                      {fac.category}
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-display group-hover:text-blue-700 transition-colors">
                      {fac.title}
                    </h3>
                    <ReadMoreText
                      text={fac.description}
                      maxChars={88}
                      stopPropagation={true}
                      className="mt-1"
                      paragraphClassName="text-xs text-slate-600 leading-relaxed"
                      readMoreLabel="Read More"
                      showLessLabel="Show Less"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Mugina Campus, Kamonyi</span>
                    <span className="text-blue-700 font-semibold">Inspect →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <GalleryLightbox
        item={selectedFacility}
        onClose={() => setSelectedFacility(null)}
      />

      {/* 5. Bottom Invitation */}
      <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center space-y-4">
        <h3 className="text-xl font-bold text-slate-900 font-display">
          Want to see our students and classrooms in person?
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          We invite you and your child for a scheduled campus tour. Experience our nurturing atmosphere, meet teachers, and tour our computer lab.
        </p>
        <button
          onClick={onOpenTour}
          className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm rounded-lg shadow-sm transition-colors"
        >
          Book a Campus Tour
        </button>
      </div>
    </div>
  );
};
