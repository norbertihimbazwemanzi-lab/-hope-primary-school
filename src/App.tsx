import React, { useState, useEffect } from 'react';
import { PageId } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { AcademicsPage } from './pages/AcademicsPage';
import { AdmissionsPage } from './pages/AdmissionsPage';
import { CampusLifePage } from './pages/CampusLifePage';
import { ContactPage } from './pages/ContactPage';
import { AdminPage } from './pages/AdminPage';
import { ApplicationModal } from './components/ApplicationModal';
import { CampusTourModal } from './components/CampusTourModal';
import { PrintableApplicationModal } from './components/PrintableApplicationModal';
import { ApplicantChatTrackerModal } from './components/ApplicantChatTrackerModal';
import { Sparkles, Phone, ArrowUp, Megaphone, X, MessageSquare } from 'lucide-react';
import { SCHOOL_INFO } from './data/schoolData';
import {
  getAnnouncements,
  getGalleryItems,
  saveGalleryItems,
  getWebsiteSettings,
  saveWebsiteSettings,
  syncServerGalleryItems,
  syncServerDocuments,
  saveAnnouncements,
} from './services/adminStore';
import {
  fetchSchoolLogoFromFirebase,
  fetchSchoolGalleryFromFirebase,
  fetchSchoolDocumentsFromFirebase,
  fetchSchoolAnnouncementsFromFirebase,
  fetchWebsiteSettingsFromFirebase,
  subscribeToSchoolLogo,
  subscribeToSchoolGallery,
  subscribeToSchoolDocuments,
  subscribeToSchoolAnnouncements,
  subscribeToWebsiteSettings,
} from './services/firebaseStore';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [isPrintableModalOpen, setIsPrintableModalOpen] = useState(false);
  const [isChatTrackerOpen, setIsChatTrackerOpen] = useState(false);
  const [chatTrackerRefCode, setChatTrackerRefCode] = useState('');
  const [preselectedGrade, setPreselectedGrade] = useState<string>('N-BABY');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState(() => {
    const list = getAnnouncements();
    return list.find((a) => a.isActive) || null;
  });
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  // Monitor scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Multi-Device Real-Time Sync & Public Data Ingestion
  // Ensures all public visitors (unauthenticated) and authenticated users see identical data across devices
  useEffect(() => {
    // 1. Initial Logo Fetch & Real-time Subscription
    fetchSchoolLogoFromFirebase().then((firebaseLogoUrl) => {
      if (firebaseLogoUrl) {
        const settings = getWebsiteSettings();
        if (settings.schoolLogoUrl !== firebaseLogoUrl) {
          const updated = { ...settings, schoolLogoUrl: firebaseLogoUrl };
          localStorage.setItem('mugina_website_settings_v3', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('mugina-settings-updated', { detail: updated }));
        }
      }
    }).catch((e) => console.warn('Logo fetch notice:', e));

    const unsubLogo = subscribeToSchoolLogo((newLogoUrl) => {
      if (newLogoUrl) {
        const settings = getWebsiteSettings();
        if (settings.schoolLogoUrl !== newLogoUrl) {
          const updated = { ...settings, schoolLogoUrl: newLogoUrl };
          localStorage.setItem('mugina_website_settings_v3', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('mugina-settings-updated', { detail: updated }));
        }
      }
    });

    // Helper to sanitize static image URLs
    const sanitizeItem = (item: any) => {
      if (!item) return item;
      if (item.imageSrc && typeof item.imageSrc === 'string' && item.imageSrc.startsWith('/src/assets/images/')) {
        return {
          ...item,
          imageSrc: `/images/${item.imageSrc.replace('/src/assets/images/', '')}`,
        };
      }
      return item;
    };

    // 2. Initial Gallery Sync from Firebase Storage/Firestore & Server
    Promise.all([
      syncServerGalleryItems(),
      fetchSchoolGalleryFromFirebase(),
    ]).then(([serverItems, firestoreItems]) => {
      const local = getGalleryItems();
      const map = new Map();
      [...local, ...serverItems, ...firestoreItems].forEach((rawItem) => {
        const item = sanitizeItem(rawItem);
        if (item && item.id) map.set(item.id, item);
      });
      const merged = Array.from(map.values());
      if (merged.length > 0) {
        saveGalleryItems(merged);
      }
    }).catch((e) => console.warn('Gallery sync notice:', e));

    // Real-time Gallery Subscription for instant photo display across all devices
    const unsubGallery = subscribeToSchoolGallery((liveItems) => {
      if (Array.isArray(liveItems) && liveItems.length > 0) {
        const local = getGalleryItems();
        const map = new Map();
        [...local, ...liveItems].forEach((rawItem) => {
          const item = sanitizeItem(rawItem);
          if (item && item.id) map.set(item.id, item);
        });
        const merged = Array.from(map.values());
        saveGalleryItems(merged);
      }
    });

    // 3. Initial Documents Sync from Firebase Firestore & Server
    Promise.all([
      syncServerDocuments(),
      fetchSchoolDocumentsFromFirebase(),
    ]).then(([serverDocs, firestoreDocs]) => {
      const map = new Map();
      [...serverDocs, ...firestoreDocs].forEach((doc) => {
        if (doc && doc.id) map.set(doc.id, doc);
      });
      const merged = Array.from(map.values());
      if (merged.length > 0) {
        localStorage.setItem('mugina_registration_documents_v3', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('mugina-documents-updated', { detail: merged }));
      }
    }).catch((e) => console.warn('Document sync notice:', e));

    // Real-time Documents Subscription
    const unsubDocs = subscribeToSchoolDocuments((liveDocs) => {
      if (Array.isArray(liveDocs) && liveDocs.length > 0) {
        localStorage.setItem('mugina_registration_documents_v3', JSON.stringify(liveDocs));
        window.dispatchEvent(new CustomEvent('mugina-documents-updated', { detail: liveDocs }));
      }
    });

    // 4. Initial Announcements Sync & Real-time Subscription
    fetchSchoolAnnouncementsFromFirebase().then((annList) => {
      if (Array.isArray(annList) && annList.length > 0) {
        saveAnnouncements(annList);
        const active = annList.find((a) => a.isActive);
        if (active) setActiveAnnouncement(active);
      }
    }).catch((e) => console.warn('Announcement sync notice:', e));

    const unsubAnn = subscribeToSchoolAnnouncements((liveAnn) => {
      if (Array.isArray(liveAnn) && liveAnn.length > 0) {
        saveAnnouncements(liveAnn);
        const active = liveAnn.find((a) => a.isActive);
        setActiveAnnouncement(active || null);
      }
    });

    // 5. Real-time Website Settings Subscription
    const unsubSettings = subscribeToWebsiteSettings((liveSettings) => {
      if (liveSettings) {
        const current = getWebsiteSettings();
        const updated = { ...current, ...liveSettings };
        localStorage.setItem('mugina_website_settings_v3', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('mugina-settings-updated', { detail: updated }));
      }
    });

    return () => {
      unsubLogo();
      unsubGallery();
      unsubDocs();
      unsubAnn();
      unsubSettings();
    };
  }, []);

  const handleNavigate = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenApply = (grade?: string) => {
    if (grade) {
      setPreselectedGrade(grade);
    }
    setIsApplyModalOpen(true);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-amber-200 selection:text-amber-950">
      {/* Optional Top Active Announcement Bar */}
      {activeAnnouncement && !announcementDismissed && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white text-xs py-2 px-4 border-b border-blue-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate">
              <Megaphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300">{activeAnnouncement.badge || 'Notice'}:</span>
              <span className="truncate">{activeAnnouncement.title} — {activeAnnouncement.content}</span>
            </div>
            <button
              onClick={() => setAnnouncementDismissed(true)}
              className="text-slate-300 hover:text-white p-0.5"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Global Header Navigation Bar */}
      <Header
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenApply={() => handleOpenApply()}
        onOpenTour={() => setIsTourModalOpen(true)}
        onOpenChatTracker={() => setIsChatTrackerOpen(true)}
      />

      {/* Main Page Content */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onOpenApply={() => handleOpenApply()}
            onOpenTour={() => setIsTourModalOpen(true)}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            onNavigate={handleNavigate}
            onOpenApply={() => handleOpenApply()}
            onOpenTour={() => setIsTourModalOpen(true)}
          />
        )}

        {currentPage === 'academics' && (
          <AcademicsPage
            onNavigate={handleNavigate}
            onOpenApplyWithGrade={(grade) => handleOpenApply(grade)}
          />
        )}

        {currentPage === 'admissions' && (
          <AdmissionsPage
            onNavigate={handleNavigate}
            onOpenApply={() => handleOpenApply()}
            onOpenPrintableForm={() => setIsPrintableModalOpen(true)}
            onOpenTour={() => setIsTourModalOpen(true)}
            onOpenChatTracker={(refCode) => {
              setChatTrackerRefCode(refCode || '');
              setIsChatTrackerOpen(true);
            }}
          />
        )}

        {currentPage === 'campus-life' && (
          <CampusLifePage
            onNavigate={handleNavigate}
            onOpenApply={() => handleOpenApply()}
            onOpenTour={() => setIsTourModalOpen(true)}
          />
        )}

        {currentPage === 'contact' && (
          <ContactPage
            onNavigate={handleNavigate}
            onOpenTour={() => setIsTourModalOpen(true)}
          />
        )}

        {currentPage === 'admin' && (
          <AdminPage
            onNavigate={handleNavigate}
            onGalleryUpdated={() => {
              // Trigger reload of announcements or gallery
              const list = getAnnouncements();
              setActiveAnnouncement(list.find((a) => a.isActive) || null);
            }}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenApply={() => handleOpenApply()}
        onOpenTour={() => setIsTourModalOpen(true)}
      />

      {/* Bright Floating "Apply Now" & Quick Dial Action Stack */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end gap-2 sm:gap-3 print:hidden">
        {/* Scroll To Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="p-2.5 sm:p-3 bg-white text-slate-700 hover:text-slate-950 rounded-full shadow-lg border border-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Floating Call Button */}
        <a
          href={`tel:${SCHOOL_INFO.contact.phone.replace(/\s+/g, '')}`}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-900/90 hover:bg-slate-900 text-white text-[11px] sm:text-xs font-bold rounded-full shadow-lg backdrop-blur-md border border-slate-700 transition-all hover:scale-105"
          title="Direct Call to School"
        >
          <Phone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">{SCHOOL_INFO.contact.phone}</span>
          <span className="sm:hidden">Call School</span>
        </a>

        {/* Floating Applicant Chat & Status Tracker Button */}
        <button
          onClick={() => setIsChatTrackerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-900/95 hover:bg-blue-950 text-white text-[11px] sm:text-xs font-bold rounded-full shadow-lg backdrop-blur-md border border-blue-700/80 transition-all hover:scale-105 cursor-pointer"
          title="Track Application Status & View Chat History"
        >
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Track Status & Chat</span>
          <span className="sm:hidden">Chat</span>
        </button>

        {/* Bright Floating "Apply Now" Button */}
        <button
          onClick={() => handleOpenApply()}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3.5 bg-gradient-to-r from-amber-500 via-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:from-amber-700 active:to-amber-800 text-slate-950 font-black text-xs sm:text-sm tracking-wide rounded-full shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/45 ring-2 sm:ring-4 ring-amber-400/30 transition-all transform hover:-translate-y-1 active:translate-y-0"
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 animate-pulse" />
          <span>Apply Now</span>
        </button>
      </div>

      {/* Interactive Admissions Application Modal */}
      <ApplicationModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        preselectedGrade={preselectedGrade}
        onOpenPrintableForm={() => {
          setIsApplyModalOpen(false);
          setIsPrintableModalOpen(true);
        }}
        onOpenChatTracker={(refCode) => {
          setChatTrackerRefCode(refCode || '');
          setIsChatTrackerOpen(true);
        }}
      />

      {/* Interactive Campus Tour Modal */}
      <CampusTourModal
        isOpen={isTourModalOpen}
        onClose={() => setIsTourModalOpen(false)}
      />

      {/* Printable / Downloadable Application Form Modal */}
      <PrintableApplicationModal
        isOpen={isPrintableModalOpen}
        onClose={() => setIsPrintableModalOpen(false)}
      />

      {/* Live Applicant Status & Admin Chat Modal */}
      <ApplicantChatTrackerModal
        isOpen={isChatTrackerOpen}
        onClose={() => setIsChatTrackerOpen(false)}
        initialRefCode={chatTrackerRefCode}
      />
    </div>
  );
}
