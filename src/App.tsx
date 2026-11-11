import React, { useState, useEffect } from 'react';
import { PageId } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { AcademicsPage } from './pages/AcademicsPage';
import { AdmissionsPage } from './pages/AdmissionsPage';
import { SchoolFeesPage } from './pages/SchoolFeesPage';
import { CampusLifePage } from './pages/CampusLifePage';
import { ContactPage } from './pages/ContactPage';
import { AdminPage } from './pages/AdminPage';
import { ApplicationModal } from './components/ApplicationModal';
import { CampusTourModal } from './components/CampusTourModal';
import { PrintableApplicationModal } from './components/PrintableApplicationModal';
import { ApplicantChatTrackerModal } from './components/ApplicantChatTrackerModal';
import { ArrowUp } from 'lucide-react';
import {
  getAnnouncements,
  getWebsiteSettings,
  saveGalleryItems,
  syncServerGalleryItems,
  syncServerDocuments,
  saveAnnouncements,
  syncServerStaff,
  syncServerStudents,
  getStaffMembers,
  getEnrolledStudents,
  getGalleryItems,
  syncAllStoresWithServerDatabase,
  syncServerWebsiteSettings,
  syncCurrentSessionUserFromFirestore,
  setCurrentSessionUser,
  getCurrentSessionUser,
  syncTombstonesFromSettings,
  filterGalleryAgainstTombstones,
  filterStaffAgainstTombstones,
  filterStudentsAgainstTombstones,
  isGalleryInitialized,
} from './services/adminStore';
import { initAuth, resolveStaffRoleForFirebaseUser } from './services/authService';
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
  subscribeToStaffMembers,
  subscribeToEnrolledStudents,
  subscribeToPaymentTransactions,
  subscribeToApplications,
  subscribeToDisciplineRecords,
  subscribeToInquiries,
} from './services/firebaseStore';
import {
  fetchWebsiteSettingsFromSupabase,
  fetchSchoolGalleryFromSupabase,
  subscribeToSupabaseWebsiteSettings,
  subscribeToSupabaseGallery,
  subscribeToSupabaseStaffMembers,
  subscribeToSupabaseEnrolledStudents,
  subscribeToSupabasePayments,
  subscribeToSupabaseApplications,
  subscribeToSupabaseAttendance,
  subscribeToSupabaseTeacherAttendance,
  subscribeToSupabaseDiscipline,
  subscribeToSupabaseAnnouncements,
  subscribeToSupabaseDocuments,
  subscribeToSupabaseInquiries,
  subscribeToSupabaseTourBookings,
} from './services/supabaseClient';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [isPrintableModalOpen, setIsPrintableModalOpen] = useState(false);
  const [isChatTrackerOpen, setIsChatTrackerOpen] = useState(false);
  const [chatTrackerRefCode, setChatTrackerRefCode] = useState('');
  const [preselectedGrade, setPreselectedGrade] = useState<string>('N-BABY');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [, setSessionRevision] = useState(0);

  // Sync user attributes from Firestore on session or Firebase Auth events
  useEffect(() => {
    const sessionHandler = () => setSessionRevision((r) => r + 1);
    window.addEventListener('mugina-session-updated', sessionHandler);

    const unsubAuth = initAuth(
      async (firebaseUser) => {
        if (firebaseUser) {
          const synced = await syncCurrentSessionUserFromFirestore(firebaseUser.uid);
          if (!synced && firebaseUser.email) {
            await syncCurrentSessionUserFromFirestore(firebaseUser.email);
          }
          if (!getCurrentSessionUser()) {
            const res = resolveStaffRoleForFirebaseUser(firebaseUser);
            if (res.authorized) {
              setCurrentSessionUser(res.session);
            }
          }
        }
      },
      () => {
        // Logged out
      }
    );

    return () => {
      window.removeEventListener('mugina-session-updated', sessionHandler);
      unsubAuth();
    };
  }, []);
  const [, setActiveAnnouncement] = useState(() => {
    const list = getAnnouncements();
    return list.find((a) => a.isActive) || null;
  });

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
    const applyLocalMirror = (storageKey: string, eventName: string, data: any) => {
      localStorage.setItem(storageKey, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
    };

    const getMaxTimestampMs = (items: any[] | null | undefined): number => {
      if (!Array.isArray(items) || items.length === 0) return 0;
      let maxMs = 0;
      for (const item of items) {
        const raw = item?.updatedAt || item?.updated_at || item?.recordedAt;
        if (raw) {
          const ms = Date.parse(raw);
          if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
        }
      }
      return maxMs;
    };

    const applyLiveWebsiteSettings = (liveSettings: any) => {
      if (!liveSettings) return;
      const current = getWebsiteSettings();
      const currentMs = current.updatedAt ? Date.parse(current.updatedAt) : 0;
      const liveMs = liveSettings.updatedAt ? Date.parse(liveSettings.updatedAt) : 0;
      if (!Number.isNaN(currentMs) && currentMs > 0 && (!liveMs || Number.isNaN(liveMs) || liveMs < currentMs)) {
        return;
      }
      const mergedDeletedGallery = Array.from(
        new Set([...(current.deletedGalleryIds || []), ...(liveSettings.deletedGalleryIds || [])])
      );
      const mergedDeletedStaff = Array.from(
        new Set([...(current.deletedStaffIds || []), ...(liveSettings.deletedStaffIds || [])])
      );
      const mergedDeletedStudents = Array.from(
        new Set([...(current.deletedStudentIds || []), ...(liveSettings.deletedStudentIds || [])])
      );
      const updated = {
        ...current,
        ...liveSettings,
        deletedGalleryIds: mergedDeletedGallery,
        galleryInitialized: Boolean(liveSettings.galleryInitialized || current.galleryInitialized),
        deletedStaffIds: mergedDeletedStaff,
        deletedStudentIds: mergedDeletedStudents,
      };
      syncTombstonesFromSettings(updated);
      applyLocalMirror('mugina_website_settings_v3', 'mugina-settings-updated', updated);

      // Re-filter local caches whenever updated tombstones arrive from another admin session
      const filteredGallery = filterGalleryAgainstTombstones(getGalleryItems());
      localStorage.setItem('mugina_gallery_items_v3', JSON.stringify(filteredGallery));
      window.dispatchEvent(new CustomEvent('mugina-gallery-updated', { detail: filteredGallery }));

      const filteredStaff = filterStaffAgainstTombstones(getStaffMembers());
      localStorage.setItem('mugina_staff_members_v3', JSON.stringify(filteredStaff));
      window.dispatchEvent(new CustomEvent('mugina-staff-updated', { detail: filteredStaff }));

      const filteredStudents = filterStudentsAgainstTombstones(getEnrolledStudents());
      localStorage.setItem('mugina_enrolled_students_v3', JSON.stringify(filteredStudents));
      window.dispatchEvent(new CustomEvent('mugina-students-updated', { detail: filteredStudents }));
    };

    const applyLiveStaff = (liveStaff: any[]) => {
      if (!Array.isArray(liveStaff) || liveStaff.length === 0) return;
      const filteredLive = filterStaffAgainstTombstones(liveStaff);
      const map = new Map<string, any>();
      filteredLive.forEach((s) => {
        if (s && s.username) map.set(String(s.username).toLowerCase(), s);
      });
      // Always preserve primary master admin logins even if omitted remotely
      const currentStaff = getStaffMembers();
      ['norbertihimbazwemanzi@gmail.com', 'hopeprimaryschool'].forEach((coreUser) => {
        if (!map.has(coreUser)) {
          const match = currentStaff.find((s) => s.username.toLowerCase() === coreUser);
          if (match) map.set(coreUser, match);
        }
      });
      applyLocalMirror('mugina_staff_members_v3', 'mugina-staff-updated', Array.from(map.values()));
    };

    const applyLiveStudents = (liveStudents: any[]) => {
      if (!Array.isArray(liveStudents)) return;
      applyLocalMirror(
        'mugina_enrolled_students_v3',
        'mugina-students-updated',
        filterStudentsAgainstTombstones(liveStudents)
      );
    };

    // Sync settings (and deletion tombstones) first, then sync all stores
    const settingsReady = syncServerWebsiteSettings()
      .then((s) => {
        if (s) syncTombstonesFromSettings(s);
        return s;
      })
      .catch(() => null);

    syncAllStoresWithServerDatabase().catch((e) => console.warn('Global store sync notice:', e));

    // 1. School Logo Fallback Fetch & Real-time Subscription
    fetchSchoolLogoFromFirebase()
      .then((firebaseLogoUrl) => {
        if (firebaseLogoUrl) {
          const settings = getWebsiteSettings();
          if (!settings.updatedAt && settings.schoolLogoUrl !== firebaseLogoUrl) {
            const updated = { ...settings, schoolLogoUrl: firebaseLogoUrl };
            applyLocalMirror('mugina_website_settings_v3', 'mugina-settings-updated', updated);
          }
        }
      })
      .catch((e) => console.warn('Logo fetch notice:', e));

    const unsubLogo = subscribeToSchoolLogo((newLogoUrl) => {
      if (newLogoUrl) {
        const settings = getWebsiteSettings();
        if (settings.schoolLogoUrl !== newLogoUrl) {
          const updated = { ...settings, schoolLogoUrl: newLogoUrl };
          applyLocalMirror('mugina_website_settings_v3', 'mugina-settings-updated', updated);
        }
      }
    });

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

    // 2. Gallery Sync (tombstone- & timestamp-aware between Supabase & Firebase) + Realtime
    settingsReady
      .then(() =>
        Promise.all([
          syncServerGalleryItems(),
          fetchSchoolGalleryFromFirebase(),
          fetchSchoolGalleryFromSupabase(),
        ])
      )
      .then(([serverItems, firestoreItems, supabaseItems]) => {
        const hasFb = Array.isArray(firestoreItems) && firestoreItems.length > 0;
        const hasSb = Array.isArray(supabaseItems) && supabaseItems.length > 0;
        let authoritative: any[] = [];
        if (hasSb && hasFb) {
          const sbMs = getMaxTimestampMs(supabaseItems);
          const fbMs = getMaxTimestampMs(firestoreItems);
          authoritative = fbMs > sbMs + 2500 ? firestoreItems : supabaseItems;
        } else if (hasSb) {
          authoritative = supabaseItems;
        } else if (hasFb) {
          authoritative = firestoreItems;
        } else if (Array.isArray(serverItems) && serverItems.length > 0) {
          authoritative = serverItems;
        }
        const cleaned = filterGalleryAgainstTombstones(authoritative).map(sanitizeItem);
        if (cleaned.length > 0 || isGalleryInitialized()) {
          saveGalleryItems(cleaned);
        }
      })
      .catch((e) => console.warn('Gallery sync notice:', e));

    let fbGallerySeen = false;
    const unsubGallery = subscribeToSchoolGallery((liveItems) => {
      if (Array.isArray(liveItems) && (liveItems.length > 0 || fbGallerySeen || isGalleryInitialized())) {
        if (liveItems.length > 0) fbGallerySeen = true;
        saveGalleryItems(filterGalleryAgainstTombstones(liveItems).map(sanitizeItem));
      }
    });

    const unsubSupabaseGallery = subscribeToSupabaseGallery((liveItems) => {
      if (Array.isArray(liveItems)) {
        const cleaned = filterGalleryAgainstTombstones(liveItems).map(sanitizeItem);
        if (cleaned.length > 0 || isGalleryInitialized()) {
          saveGalleryItems(cleaned);
        }
      }
    });

    // 3. Documents Sync & Realtime
    Promise.all([syncServerDocuments(), fetchSchoolDocumentsFromFirebase()])
      .then(([serverDocs, firestoreDocs]) => {
        const map = new Map();
        [...serverDocs, ...firestoreDocs].forEach((doc) => {
          if (doc && doc.id) map.set(doc.id, doc);
        });
        const merged = Array.from(map.values());
        if (merged.length > 0) {
          applyLocalMirror('mugina_registration_documents_v3', 'mugina-documents-updated', merged);
        }
      })
      .catch((e) => console.warn('Document sync notice:', e));

    let fbDocsSeen = false;
    const unsubDocs = subscribeToSchoolDocuments((liveDocs) => {
      if (Array.isArray(liveDocs) && (liveDocs.length > 0 || fbDocsSeen)) {
        if (liveDocs.length > 0) fbDocsSeen = true;
        applyLocalMirror('mugina_registration_documents_v3', 'mugina-documents-updated', liveDocs);
      }
    });

    const unsubSupabaseDocs = subscribeToSupabaseDocuments((liveDocs) => {
      if (Array.isArray(liveDocs)) {
        applyLocalMirror('mugina_registration_documents_v3', 'mugina-documents-updated', liveDocs);
      }
    });

    // 4. Announcements Sync & Realtime
    fetchSchoolAnnouncementsFromFirebase()
      .then((annList) => {
        if (Array.isArray(annList) && annList.length > 0) {
          saveAnnouncements(annList);
          setActiveAnnouncement(annList.find((a) => a.isActive) || null);
        }
      })
      .catch((e) => console.warn('Announcement sync notice:', e));

    let fbAnnSeen = false;
    const unsubAnn = subscribeToSchoolAnnouncements((liveAnn) => {
      if (Array.isArray(liveAnn) && (liveAnn.length > 0 || fbAnnSeen)) {
        if (liveAnn.length > 0) fbAnnSeen = true;
        saveAnnouncements(liveAnn);
        setActiveAnnouncement(liveAnn.find((a) => a.isActive) || null);
      }
    });

    const unsubSupabaseAnn = subscribeToSupabaseAnnouncements((liveAnn) => {
      if (Array.isArray(liveAnn)) {
        saveAnnouncements(liveAnn);
        setActiveAnnouncement(liveAnn.find((a) => a.isActive) || null);
      }
    });

    const handleLocalAnnUpdate = () => {
      const list = getAnnouncements();
      setActiveAnnouncement(list.find((a) => a.isActive) || null);
    };
    window.addEventListener('mugina-announcements-updated', handleLocalAnnUpdate);

    // 5. Website Settings Sync & Realtime (timestamp-guarded)
    Promise.all([fetchWebsiteSettingsFromFirebase(), fetchWebsiteSettingsFromSupabase()])
      .then(([fbSettings, sbSettings]) => {
        const candidates = [fbSettings, sbSettings].filter(Boolean) as any[];
        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const aMs = a?.updatedAt ? Date.parse(a.updatedAt) : 0;
            const bMs = b?.updatedAt ? Date.parse(b.updatedAt) : 0;
            return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs);
          });
          applyLiveWebsiteSettings(candidates[0]);
        }
      })
      .catch((e) => console.warn('Website settings initial fetch notice:', e));

    const unsubSettings = subscribeToWebsiteSettings(applyLiveWebsiteSettings);
    const unsubSupabaseSettings = subscribeToSupabaseWebsiteSettings(applyLiveWebsiteSettings);

    // 6. Staff Directory Sync & Realtime
    syncServerStaff().catch((e) => console.warn('Staff initial sync notice:', e));
    let fbStaffSeen = false;
    const unsubStaff = subscribeToStaffMembers((liveStaff) => {
      if (Array.isArray(liveStaff) && (liveStaff.length > 0 || fbStaffSeen)) {
        if (liveStaff.length > 0) fbStaffSeen = true;
        applyLiveStaff(liveStaff);
      }
    });
    const unsubSupabaseStaff = subscribeToSupabaseStaffMembers(applyLiveStaff);

    // 7. Enrolled Students Sync & Realtime
    syncServerStudents().catch((e) => console.warn('Student initial sync notice:', e));
    let fbStudentsSeen = false;
    const unsubStudents = subscribeToEnrolledStudents((liveStudents) => {
      if (Array.isArray(liveStudents) && (liveStudents.length > 0 || fbStudentsSeen)) {
        if (liveStudents.length > 0) fbStudentsSeen = true;
        applyLiveStudents(liveStudents);
      }
    });
    const unsubSupabaseStudents = subscribeToSupabaseEnrolledStudents(applyLiveStudents);

    // 8. Operational Modules Realtime (Payments, Applications, Attendance, Discipline, Inquiries, Tours)
    let fbPaymentsSeen = false;
    const unsubPayments = subscribeToPaymentTransactions((items) => {
      if (Array.isArray(items) && (items.length > 0 || fbPaymentsSeen)) {
        if (items.length > 0) fbPaymentsSeen = true;
        applyLocalMirror('mugina_payment_transactions_v3', 'mugina-payments-updated', items);
      }
    });
    const unsubSupabasePayments = subscribeToSupabasePayments((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_payment_transactions_v3', 'mugina-payments-updated', items);
      }
    });

    let fbAppsSeen = false;
    const unsubApps = subscribeToApplications((items) => {
      if (Array.isArray(items) && (items.length > 0 || fbAppsSeen)) {
        if (items.length > 0) fbAppsSeen = true;
        applyLocalMirror('mugina_applications_v3', 'mugina-applications-updated', items);
      }
    });
    const unsubSupabaseApps = subscribeToSupabaseApplications((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_applications_v3', 'mugina-applications-updated', items);
      }
    });

    const unsubSupabaseAttendance = subscribeToSupabaseAttendance((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_attendance_records_v3', 'mugina-attendance-updated', items);
      }
    });

    const unsubSupabaseTeacherAtt = subscribeToSupabaseTeacherAttendance((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_teacher_attendance_v3', 'mugina-teacher-attendance-updated', items);
      }
    });

    let fbDisciplineSeen = false;
    const unsubDiscipline = subscribeToDisciplineRecords((items) => {
      if (Array.isArray(items) && (items.length > 0 || fbDisciplineSeen)) {
        if (items.length > 0) fbDisciplineSeen = true;
        applyLocalMirror('mugina_discipline_records_v3', 'mugina-discipline-updated', items);
      }
    });
    const unsubSupabaseDiscipline = subscribeToSupabaseDiscipline((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_discipline_records_v3', 'mugina-discipline-updated', items);
      }
    });

    let fbInquiriesSeen = false;
    const unsubInquiries = subscribeToInquiries((items) => {
      if (Array.isArray(items) && (items.length > 0 || fbInquiriesSeen)) {
        if (items.length > 0) fbInquiriesSeen = true;
        applyLocalMirror('mugina_inquiries_v3', 'mugina-inquiries-updated', items);
      }
    });
    const unsubSupabaseInquiries = subscribeToSupabaseInquiries((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_inquiries_v3', 'mugina-inquiries-updated', items);
      }
    });

    const unsubSupabaseTours = subscribeToSupabaseTourBookings((items) => {
      if (Array.isArray(items)) {
        applyLocalMirror('mugina_tours_v3', 'mugina-tours-updated', items);
      }
    });

    return () => {
      window.removeEventListener('mugina-announcements-updated', handleLocalAnnUpdate);
      unsubLogo();
      unsubGallery();
      unsubSupabaseGallery();
      unsubDocs();
      unsubSupabaseDocs();
      unsubAnn();
      unsubSupabaseAnn();
      unsubSettings();
      unsubSupabaseSettings();
      unsubStaff();
      unsubSupabaseStaff();
      unsubStudents();
      unsubSupabaseStudents();
      unsubPayments();
      unsubSupabasePayments();
      unsubApps();
      unsubSupabaseApps();
      unsubSupabaseAttendance();
      unsubSupabaseTeacherAtt();
      unsubDiscipline();
      unsubSupabaseDiscipline();
      unsubInquiries();
      unsubSupabaseInquiries();
      unsubSupabaseTours();
    };
  }, []);

  // Scroll-spy to automatically highlight active nav item when scrolling through sections
  useEffect(() => {
    if (currentPage === 'admin') return;

    const sectionIds: PageId[] = [
      'home',
      'about',
      'staff',
      'academics',
      'admissions',
      'fees',
      'campus-life',
      'contact',
    ];

    const handleScrollSpy = () => {
      const scrollPosition = window.scrollY + 240;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i];
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setCurrentPage((prev) => (prev === id || prev === 'admin' ? prev : id));
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScrollSpy, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [currentPage]);

  const handleNavigate = (page: PageId) => {
    if (page === 'admin') {
      setCurrentPage('admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (currentPage === 'admin') {
      setCurrentPage(page);
      setTimeout(() => {
        const targetId = page === 'staff' ? 'staff' : page;
        const el = document.getElementById(targetId) || document.getElementById('about');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
      return;
    }

    setCurrentPage(page);
    const targetId = page === 'staff' ? 'staff' : page;
    const el = document.getElementById(targetId) || document.getElementById('about');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        {currentPage === 'admin' ? (
          <AdminPage
            onNavigate={handleNavigate}
            onGalleryUpdated={() => {
              const list = getAnnouncements();
              setActiveAnnouncement(list.find((a) => a.isActive) || null);
            }}
          />
        ) : (
          <div className="space-y-12">
            {/* 1. Home Section */}
            <section id="home" className="scroll-mt-20">
              <HomePage
                onNavigate={handleNavigate}
                onOpenApply={() => handleOpenApply()}
                onOpenTour={() => setIsTourModalOpen(true)}
              />
            </section>

            {/* 2. About Us Section */}
            <section id="about" className="scroll-mt-20 border-t border-slate-200/80 pt-6">
              <AboutPage
                onNavigate={handleNavigate}
                onOpenApply={() => handleOpenApply()}
                onOpenTour={() => setIsTourModalOpen(true)}
              />
            </section>

            {/* 3. Academics Section */}
            <section id="academics" className="scroll-mt-20 border-t border-slate-200/80 pt-6">
              <AcademicsPage
                onNavigate={handleNavigate}
                onOpenApplyWithGrade={(grade) => handleOpenApply(grade)}
              />
            </section>

            {/* 4. Admissions Section */}
            <section id="admissions" className="scroll-mt-20 border-t border-slate-200/80 pt-6">
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
            </section>

            {/* 5. School Fees Section */}
            <section id="fees" className="scroll-mt-20 border-t border-slate-200/80 pt-6">
              <SchoolFeesPage
                onNavigate={handleNavigate}
                onOpenApply={() => handleOpenApply()}
                onOpenTour={() => setIsTourModalOpen(true)}
              />
            </section>

            {/* 6. Campus Life Section */}
            <section id="campus-life" className="scroll-mt-20 border-t border-slate-200/80 pt-6">
              <CampusLifePage
                onNavigate={handleNavigate}
                onOpenApply={() => handleOpenApply()}
                onOpenTour={() => setIsTourModalOpen(true)}
              />
            </section>

            {/* 7. Contact Us Section */}
            <section id="contact" className="scroll-mt-20 border-t border-slate-200/80 pt-6 pb-6">
              <ContactPage
                onNavigate={handleNavigate}
                onOpenTour={() => setIsTourModalOpen(true)}
              />
            </section>
          </div>
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenApply={() => handleOpenApply()}
        onOpenTour={() => setIsTourModalOpen(true)}
      />

      {/* Floating Scroll-To-Top Control (Call, Chat Tracker, and Floating Apply Now disabled per user request) */}
      {showScrollTop && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 print:hidden">
          <button
            onClick={scrollToTop}
            className="p-2.5 sm:p-3 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-950 rounded-full shadow-lg border border-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer backdrop-blur-xs"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      )}

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
