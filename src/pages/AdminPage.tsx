import React, { useState, useEffect } from 'react';
import {
  UserRole,
  StaffMember,
  EnrolledStudent,
  AttendanceRecord,
  AdminInquiry,
  AdminApplication,
  AdminTourBooking,
  SchoolAnnouncement,
  getStaffMembers,
  enrollStaffMember,
  updateStaffMember,
  deleteStaffMember,
  getEnrolledStudents,
  enrollStudentByDOS,
  updateEnrolledStudent,
  deleteEnrolledStudent,
  deleteEnrolledStudentsBatch,
  detectImportedStudentBatches,
  getAttendanceRecords,
  saveAttendanceBatch,
  getGalleryItems,
  saveGalleryItems,
  addGalleryItemAsync,
  updateGalleryItemAsync,
  deleteGalleryItem,
  saveStaffMembers,
  saveEnrolledStudents,
  syncServerGalleryItems,
  getInquiries,
  updateInquiryStatus,
  getApplications,
  saveApplications,
  deleteApplication,
  confirmApplicationByDOSOrAdmin,
  getTourBookings,
  getAnnouncements,
  saveAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getCurrentSessionUser,
  setCurrentSessionUser,
  getAdminNotificationEmail,
  setAdminNotificationEmail,
  RegistrationDocument,
  getRequiredDocuments,
  saveRequiredDocuments,
  addRequiredDocument,
  updateRequiredDocument,
  deleteRequiredDocument,
  syncServerDocuments,
  WebsiteSettings,
  getWebsiteSettings,
  saveWebsiteSettings,
  PaymentTransaction,
  getPaymentTransactions,
  savePaymentTransactions,
  getTeacherAttendanceRecords,
  saveTeacherAttendanceBatch,
  getDisciplineRecords,
  saveDisciplineRecords,
  syncAllStoresWithServerDatabase,
  syncServerStaff,
  syncServerStudents,
  syncServerApplications,
  promoteStudentsBatch,
  waitForCredentialSync,
} from '../services/adminStore';
import { FacilityItem, PageId } from '../types';
import { ACADEMIC_GRADES } from '../data/schoolData';
import {
  initAuth,
  googleSignIn,
  consumeGoogleRedirectResult,
  logoutGoogle,
  resolveStaffRoleForFirebaseUser,
  ensureAdminFirebaseAuth,
  authenticateParentAccount,
  authenticateStudentWithBackend,
  setStudentAuthToken,
  authenticateStaffWithBackend,
  exchangeFirebaseTokenForStaffSession,
  getStaffAuthToken,
  setStaffAuthToken,
  requestPasswordReset,
  warmUpFirebaseAuth,
  publishGoogleOAuthHandoff,
  consumeGoogleOAuthHandoff,
} from '../services/authService';
import { uploadSchoolAsset, uploadSchoolDocument } from '../services/storageService';
import { SchoolLogo } from '../components/SchoolLogo';
import {
  fetchApplicantChatsFromFirebase,
  saveApplicantChatToFirebase,
} from '../services/firebaseStore';
import {
  testSupabaseConnection,
  syncAllDataToSupabase,
  fetchSchoolGalleryFromSupabase,
  fetchApplicantChatsFromSupabase,
  appendApplicantChatMessageToSupabase,
  subscribeToSupabaseApplicantChats,
} from '../services/supabaseClient';
import { dispatchOfficialEmail } from '../services/emailService';
import { AdminAttendanceTracker } from '../components/AdminAttendanceTracker';
import { ReadMoreText } from '../components/ReadMoreBlock';
import { FinancePortal } from '../components/FinancePortal';
import { TeacherPortal } from '../components/TeacherPortal';
import { RegistrarPortal } from '../components/RegistrarPortal';
import { TeacherAttendanceTracker } from '../components/TeacherAttendanceTracker';
import { DODDisciplinePortal } from '../components/DODDisciplinePortal';
import { PrincipalQueueModal } from '../components/PrincipalQueueModal';
import { BulkStudentImportModal } from '../components/BulkStudentImportModal';
import { AcademicManagementModule } from '../components/AcademicManagementModule';
import { ExaminationsModule } from '../components/ExaminationsModule';
import { ReportsAnalyticsModule } from '../components/ReportsAnalyticsModule';
import { SystemAuditAndBackupModule } from '../components/SystemAuditAndBackupModule';
import { ParentPortal } from '../components/ParentPortal';
import { StudentPortal } from '../components/StudentPortal';
import { StudentIdAndProfileModal } from '../components/StudentIdAndProfileModal';
import { AdminEmailNotificationsModule } from '../components/AdminEmailNotificationsModule';
import {
  hasPermission,
  getRoleDisplayLabel,
  isFullAdmin,
  normalizeUserRole,
  extractGradesFromAssignment,
} from '../services/rbac';
import { getTeacherAssignments, logAuditEvent } from '../services/smsStore';
import {
  Shield,
  Lock,
  UserCheck,
  GraduationCap,
  ClipboardList,
  Image as ImageIcon,
  FileText,
  BookOpen,
  Mail,
  Bell,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Download,
  CheckCircle2,
  Send,
  AlertTriangle,
  RefreshCw,
  LogOut,
  UploadCloud,
  Check,
  X,
  Search,
  Key,
  Users,
  Sliders,
  Settings,
  Globe,
  FileSpreadsheet,
  MessageSquare,
  BarChart2,
  PieChart,
  TrendingUp,
  Clock,
  ExternalLink,
  Phone,
  Coins,
  Sparkles,
  DollarSign,
  RotateCcw,
  ShieldAlert,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Database,
  Copy,
  FileDown,
  FolderArchive,
  HardDrive,
  FileUp,
  Sun,
  Moon,
  Award,
  Layers,
  CreditCard,
  ArrowUpRight,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface AdminPageProps {
  onNavigate: (page: PageId) => void;
  onGalleryUpdated?: () => void;
}

export type AdminTab =
  | 'finance'
  | 'teacher_classroom'
  | 'registrar'
  | 'staff'
  | 'students'
  | 'academics'
  | 'examinations'
  | 'attendance'
  | 'teacher_attendance'
  | 'discipline'
  | 'confirmations'
  | 'documents'
  | 'reports'
  | 'gallery'
  | 'news'
  | 'settings'
  | 'inquiries'
  | 'gmail'
  | 'system_audit';

const resolveDefaultTabForUser = (user: ReturnType<typeof getCurrentSessionUser>): AdminTab => {
  if (!user) return 'students';
  if (user.role === 'Registrar') return 'registrar';
  if (user.role === 'DOD') return 'discipline';
  const r = normalizeUserRole(user.role);
  if (r === 'Accountant') return 'finance';
  if (r === 'Teacher') return 'teacher_classroom';
  return 'students';
};

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate, onGalleryUpdated }) => {
  const [currentUser, setCurrentUser] = useState(getCurrentSessionUser());
  const [activeTab, setActiveTab] = useState<AdminTab>(() => resolveDefaultTabForUser(getCurrentSessionUser()));
  const [attendancePreselectGrade, setAttendancePreselectGrade] = useState<string | undefined>(undefined);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onSessionUpdated = (e: Event) => {
      const detail = (e as CustomEvent<ReturnType<typeof getCurrentSessionUser>>).detail;
      if (detail !== undefined) {
        setCurrentUser(detail);
        if (detail) {
          setActiveTab(resolveDefaultTabForUser(detail));
        }
      }
    };
    window.addEventListener('mugina-session-updated', onSessionUpdated);
    return () => window.removeEventListener('mugina-session-updated', onSessionUpdated);
  }, []);

  const toggleThemeMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        if (next) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('mugina_theme_mode', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('mugina_theme_mode', 'light');
        }
      } catch {}
      return next;
    });
  };

  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>(getPaymentTransactions());
  const [showPrincipalQueueModal, setShowPrincipalQueueModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentGradeFilter, setStudentGradeFilter] = useState<string>('ALL');
  const [inspectedStudent, setInspectedStudent] = useState<EnrolledStudent | null>(null);
  const [isUploadingStudentPhoto, setIsUploadingStudentPhoto] = useState(false);

  // Login form state - with reveal password and device persistence
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mha_remember_password') !== 'false';
    } catch {
      return true;
    }
  });
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [googlePopupBlocked, setGooglePopupBlocked] = useState(false);
  const [googleFullTabNotice, setGoogleFullTabNotice] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isVerifyingLogin, setIsVerifyingLogin] = useState(false);

  // Forgot Password inline state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotFeedback, setForgotFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-populate saved credentials on phone/browser mount if remember option was enabled
  useEffect(() => {
    try {
      const isRemembered = localStorage.getItem('mha_remember_password');
      if (isRemembered !== 'false') {
        const saved = localStorage.getItem('mha_saved_credentials_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            if (parsed.username) setLoginUsername(parsed.username);
            if (parsed.password) setLoginPassword(parsed.password);
            setHasSavedCredentials(true);
          }
        }
      }
    } catch (err) {
      console.warn('Could not read remembered credentials:', err);
    }
  }, []);

  const persistCredentialsIfEnabled = (username: string, pass: string) => {
    if (rememberPassword) {
      try {
        localStorage.setItem('mha_remember_password', 'true');
        localStorage.setItem(
          'mha_saved_credentials_v1',
          JSON.stringify({
            username,
            password: pass,
            savedAt: new Date().toISOString(),
          })
        );
        setHasSavedCredentials(true);
      } catch (err) {
        console.warn('Failed saving credentials to device storage:', err);
      }
    } else {
      try {
        localStorage.setItem('mha_remember_password', 'false');
        localStorage.removeItem('mha_saved_credentials_v1');
        setHasSavedCredentials(false);
      } catch (err) {
        console.warn('Failed clearing saved credentials:', err);
      }
    }
  };

  const handleForgetSavedCredentials = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      localStorage.removeItem('mha_saved_credentials_v1');
      localStorage.setItem('mha_remember_password', 'false');
      setRememberPassword(false);
      setHasSavedCredentials(false);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      console.warn('Failed clearing saved credentials:', err);
    }
  };

  // Staff Edit Modal State
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);

  // Student Edit Modal State
  const [editingStudent, setEditingStudent] = useState<EnrolledStudent | null>(null);

  // Website Settings State (Admin & Headteacher can edit everything)
  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [websiteSettingsSuccess, setWebsiteSettingsSuccess] = useState(false);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<{ testing: boolean; message: string; success?: boolean }>({
    testing: false,
    message: '',
  });
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<{ syncing: boolean; message: string; success?: boolean }>({
    syncing: false,
    message: '',
  });

  // Google user
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [, setAccessToken] = useState<string | null>(null);

  // Data states
  const [staffList, setStaffList] = useState<StaffMember[]>(getStaffMembers());
  const [studentList, setStudentList] = useState<EnrolledStudent[]>(getEnrolledStudents());
  const [galleryItems, setGalleryItems] = useState<FacilityItem[]>(getGalleryItems());
  const [inquiries, setInquiries] = useState<AdminInquiry[]>(getInquiries());
  const [applications, setApplications] = useState<AdminApplication[]>(getApplications());
  const [announcements, setAnnouncements] = useState<SchoolAnnouncement[]>(getAnnouncements());
  const [adminEmail, setAdminEmail] = useState<string>(getAdminNotificationEmail());
  const [docList, setDocList] = useState<RegistrationDocument[]>(getRequiredDocuments());

  // Registration Document Modal State
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RegistrationDocument | null>(null);
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [docUploadStatus, setDocUploadStatus] = useState<string>('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docFormData, setDocFormData] = useState({
    title: '',
    description: '',
    isRequired: true,
    applicableGrades: 'All Grades (Nursery & Primary)',
    formatHint: '',
    fileUrl: '',
    fileName: '',
    fileSize: '',
    fileType: '',
  });

  // Attendance tracker states
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceGrade, setAttendanceGrade] = useState<string>('P4');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: 'Present' | 'Absent' | 'Late' | 'Excused'; notes: string }>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSuccessMsg, setAttendanceSuccessMsg] = useState<string | null>(null);

  // Applicant Chat & Messaging states
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [activeChatRef, setActiveChatRef] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [confirmationsSubTab, setConfirmationsSubTab] = useState<'charts' | 'chats' | 'applications'>('charts');

  // Deletion Modal State (Reliable in-app confirmation avoiding blocked window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'staff' | 'student' | 'student-batch' | 'doc' | 'gallery' | 'news' | 'application';
    id: string;
    name: string;
    ids?: string[];
    batchScope?: 'all' | 'imported' | 'selected' | 'file' | 'grade';
    selectedImportFile?: string;
    selectedGradeFilter?: string;
    allIds?: string[];
    importedIds?: string[];
    importedFiles?: Array<{ fileName: string; ids: string[] }>;
  } | null>(null);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  // Staff Enrollment & Control Modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [staffActionNotice, setStaffActionNotice] = useState<string | null>(null);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    role: 'Teacher' as StaffMember['role'],
    email: '',
    phone: '+250 78',
    username: '',
    password: '',
    assignedSubjectOrGrade: '',
    status: 'Active' as StaffMember['status'],
  });

  // Student Enrollment Form Modal (DOS objective)
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showBulkStudentModal, setShowBulkStudentModal] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<EnrolledStudent | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('student@2026');
  const [studentFormData, setStudentFormData] = useState({
    regNumber: `MHA-2026-${Math.floor(100 + Math.random() * 900)}`,
    fullName: '',
    gender: 'Female' as 'Male' | 'Female',
    dob: '2017-05-10',
    gradeCode: 'P4',
    stream: 'A',
    address: 'Mugina Sector, Kamonyi District',
    admissionDate: new Date().toISOString().split('T')[0],
    previousSchool: '',
    photoUrl: '',
    parentName: '',
    parentPhone: '+250 78',
    parentEmail: '',
    studentUsername: '',
    studentPassword: 'student@2026',
    studentAccountActive: true,
    status: 'Active' as EnrolledStudent['status'],
  });

  // Confirm Application Modal (Wait for Admin/DOS Confirmation)
  const [confirmAppTarget, setConfirmAppTarget] = useState<AdminApplication | null>(null);
  const [confirmFeedbackNotes, setConfirmFeedbackNotes] = useState('Welcome to Mugina Hope Academy! Your admission is confirmed.');
  const [confirmStudentUser, setConfirmStudentUser] = useState('');
  const [confirmStudentPass, setConfirmStudentPass] = useState('mugina@2026');
  const [isConfirmingApp, setIsConfirmingApp] = useState(false);

  // Admissions Review Modal (Approve + Verification Code / Request More Info / Reject)
  const [reviewAppTarget, setReviewAppTarget] = useState<AdminApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'more_info'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Gallery Upload Modal
  const [showAddImageModal, setShowAddImageModal] = useState(false);
  const [editingImageItem, setEditingImageItem] = useState<FacilityItem | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageFormData, setImageFormData] = useState({
    title: '',
    category: 'outdoor' as FacilityItem['category'],
    description: '',
    caption: '',
    altText: '',
    imageSrc: '',
  });
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);

  // News / Announcement Modal
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [editingNewsItem, setEditingNewsItem] = useState<SchoolAnnouncement | null>(null);
  const [newsFormData, setNewsFormData] = useState({
    title: '',
    content: '',
    badge: 'Announcement',
    isActive: true,
  });

  const [staffFormError, setStaffFormError] = useState<string | null>(null);
  const [studentFormError, setStudentFormError] = useState<string | null>(null);
  const [confirmAppError, setConfirmAppError] = useState<string | null>(null);
  const [imageFormError, setImageFormError] = useState<string | null>(null);
  const [newsFormError, setNewsFormError] = useState<string | null>(null);
  const [docFormError, setDocFormError] = useState<string | null>(null);
  const [pendingBackupRestore, setPendingBackupRestore] = useState<{ fileName: string; data: any } | null>(null);

  // Filter student search
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Sync Google Auth
  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsub();
  }, []);

  // Sync all database stores from server, Supabase, and Firebase on mount for multi-device persistence
  useEffect(() => {
    syncAllStoresWithServerDatabase().then(() => {
      setStaffList(getStaffMembers());
      setStudentList(getEnrolledStudents());
      setApplications(getApplications());
      setPaymentTransactions(getPaymentTransactions());
      setInquiries(getInquiries());
      setAnnouncements(getAnnouncements());
      setWebsiteSettings(getWebsiteSettings());
      setDocList(getRequiredDocuments());
      setGalleryItems(getGalleryItems());
      if (onGalleryUpdated) onGalleryUpdated();
    });

    syncServerDocuments().then((docs) => {
      setDocList(docs);
    });

    syncServerGalleryItems()
      .then((cleaned) => {
        setGalleryItems(cleaned);
        if (onGalleryUpdated) onGalleryUpdated();
      })
      .catch((e) => console.warn('Gallery sync notice in admin:', e));

    const handleStaffUpdate = (e: any) => {
      setStaffList(e.detail && Array.isArray(e.detail) ? e.detail : getStaffMembers());
    };
    const handleStudentsUpdate = (e: any) => {
      setStudentList(e.detail && Array.isArray(e.detail) ? e.detail : getEnrolledStudents());
    };
    const handlePaymentsUpdate = () => setPaymentTransactions(getPaymentTransactions());
    const handleApplicationsUpdate = () => setApplications(getApplications());
    const handleInquiriesUpdate = () => setInquiries(getInquiries());
    const handleAnnouncementsUpdate = () => {
      setAnnouncements(getAnnouncements());
      if (onGalleryUpdated) onGalleryUpdated();
    };
    const handleDocumentsUpdate = () => setDocList(getRequiredDocuments());
    const handleGalleryUpdate = () => setGalleryItems(getGalleryItems());
    const handleSettingsUpdate = () => setWebsiteSettings(getWebsiteSettings());

    window.addEventListener('mugina-staff-updated', handleStaffUpdate);
    window.addEventListener('mugina-students-updated', handleStudentsUpdate);
    window.addEventListener('mugina-payments-updated', handlePaymentsUpdate);
    window.addEventListener('mugina-applications-updated', handleApplicationsUpdate);
    window.addEventListener('mugina-inquiries-updated', handleInquiriesUpdate);
    window.addEventListener('mugina-announcements-updated', handleAnnouncementsUpdate);
    window.addEventListener('mugina-documents-updated', handleDocumentsUpdate);
    window.addEventListener('mugina-gallery-updated', handleGalleryUpdate);
    window.addEventListener('mugina-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('mugina-staff-updated', handleStaffUpdate);
      window.removeEventListener('mugina-students-updated', handleStudentsUpdate);
      window.removeEventListener('mugina-payments-updated', handlePaymentsUpdate);
      window.removeEventListener('mugina-applications-updated', handleApplicationsUpdate);
      window.removeEventListener('mugina-inquiries-updated', handleInquiriesUpdate);
      window.removeEventListener('mugina-announcements-updated', handleAnnouncementsUpdate);
      window.removeEventListener('mugina-documents-updated', handleDocumentsUpdate);
      window.removeEventListener('mugina-gallery-updated', handleGalleryUpdate);
      window.removeEventListener('mugina-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const fetchChatThreads = async () => {
    try {
      const [sbThreads, fbThreads, serverThreads, latestApps] = await Promise.all([
        fetchApplicantChatsFromSupabase().catch(() => null),
        fetchApplicantChatsFromFirebase().catch(() => []),
        fetch('/api/chats')
          .then(async (res) => (res.ok ? (await res.json()).threads : []))
          .catch(() => []),
        syncServerApplications().catch(() => getApplications()),
      ]);

      const threadMap = new Map<string, any>();
      const ingest = (items: any[] | null | undefined) => {
        if (!Array.isArray(items)) return;
        items.forEach((t) => {
          if (!t || !t.refCode) return;
          const key = String(t.refCode).toUpperCase();
          const existing = threadMap.get(key);
          if (!existing) {
            threadMap.set(key, { ...t, refCode: key, messages: Array.isArray(t.messages) ? t.messages : [] });
          } else {
            const existingMsgs = Array.isArray(existing.messages) ? existing.messages : [];
            const incomingMsgs = Array.isArray(t.messages) ? t.messages : [];
            if (incomingMsgs.length > existingMsgs.length) {
              threadMap.set(key, { ...existing, ...t, refCode: key, messages: incomingMsgs });
            } else if (incomingMsgs.length === existingMsgs.length) {
              const exTs = Date.parse(existing.updatedAt || '') || 0;
              const inTs = Date.parse(t.updatedAt || '') || 0;
              if (inTs >= exTs) {
                threadMap.set(key, { ...existing, ...t, refCode: key, messages: incomingMsgs });
              }
            }
          }
        });
      };

      ingest(serverThreads);
      ingest(fbThreads);
      ingest(sbThreads);

      latestApps.forEach((app) => {
        const key = String(app.refCode || '').toUpperCase();
        if (key && !threadMap.has(key)) {
          threadMap.set(key, {
            refCode: key,
            studentName: app.studentName,
            parentName: app.parentName,
            parentEmail: app.parentEmail,
            parentPhone: app.parentPhone,
            gradeCode: app.gradeCode,
            status: app.status,
            messages: [
              {
                id: `init-${app.id}`,
                sender: 'system',
                senderName: 'Mugina Hope Administration Desk',
                text: `Application ${app.refCode} for ${app.studentName} logged (${app.status}).`,
                createdAt: app.createdAt || new Date().toISOString(),
              },
            ],
            updatedAt: app.confirmedAt || app.createdAt || new Date().toISOString(),
          });
        }
      });

      const merged = Array.from(threadMap.values()).sort((a, b) => {
        const aMs = Date.parse(a.updatedAt || '') || 0;
        const bMs = Date.parse(b.updatedAt || '') || 0;
        return bMs - aMs;
      });
      setChatThreads(merged);
    } catch (e) {
      console.warn('Failed to fetch chat threads:', e);
    }
  };

  useEffect(() => {
    fetchChatThreads();
    if (activeTab === 'confirmations') {
      const unsub = subscribeToSupabaseApplicantChats(() => {
        fetchChatThreads();
      });
      return () => unsub();
    }
  }, [activeTab]);

  // Update default tab based on user role to ensure only permitted views are visible
  useEffect(() => {
    if (currentUser) {
      setActiveTab(resolveDefaultTabForUser(currentUser));
    }
  }, [currentUser]);

  // Initialize attendance state for selected class and date
  useEffect(() => {
    const existing = getAttendanceRecords(attendanceDate, attendanceGrade);
    const studentsInClass = studentList.filter((s) => s.gradeCode === attendanceGrade);
    const newMap: Record<string, { status: 'Present' | 'Absent' | 'Late' | 'Excused'; notes: string }> = {};

    studentsInClass.forEach((s) => {
      const match = existing.find((r) => r.studentId === s.id);
      if (match) {
        newMap[s.id] = { status: match.status, notes: match.notes || '' };
      } else {
        newMap[s.id] = { status: 'Present', notes: '' };
      }
    });

    setAttendanceMap(newMap);
    setAttendanceSuccessMsg(null);
  }, [attendanceDate, attendanceGrade, studentList]);

  // Warm up Firebase Auth, support cross-tab Google OAuth handoff, and consume redirect sign-in results
  useEffect(() => {
    if (currentUser) return;
    let cancelled = false;
    warmUpFirebaseAuth();

    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('google_auth') === '1' && window.self === window.top) {
        setGoogleFullTabNotice(true);
        params.delete('google_auth');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      // ignore URL parsing errors
    }

    const applyCrossTabHandoff = () => {
      const handedOff = consumeGoogleOAuthHandoff();
      if (!handedOff || cancelled) return;
      setGooglePopupBlocked(false);
      setGoogleFullTabNotice(false);
      setLoginError('');
      setCurrentSessionUser(handedOff);
      setCurrentUser(handedOff);
      setActiveTab(resolveDefaultTabForUser(handedOff));
    };

    applyCrossTabHandoff();

    const handleStorageHandoff = (ev: StorageEvent) => {
      if (ev.key === 'mugina_google_oauth_handoff_v1' && ev.newValue) {
        applyCrossTabHandoff();
      }
    };
    window.addEventListener('storage', handleStorageHandoff);

    consumeGoogleRedirectResult()
      .then(async (res) => {
        if (cancelled || !res || !res.user) return;
        setIsGoogleLoading(true);
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        await Promise.all([syncServerStaff(), syncServerStudents()]).catch(() => {});
        if (cancelled) return;
        setStaffList(getStaffMembers());
        setStudentList(getEnrolledStudents());

        const resolution = resolveStaffRoleForFirebaseUser(res.user);
        if (resolution.authorized) {
          if (resolution.session.role !== 'Parent') {
            await exchangeFirebaseTokenForStaffSession(res.user).catch(() => {});
          }
          publishGoogleOAuthHandoff(resolution.session, getStaffAuthToken());
          setGooglePopupBlocked(false);
          setGoogleFullTabNotice(false);
          setCurrentSessionUser(resolution.session);
          setCurrentUser(resolution.session);
          setActiveTab(resolveDefaultTabForUser(resolution.session));
          logAuditEvent(
            'LOGIN',
            'Auth',
            resolution.session.id,
            `Google OAuth redirect sign-in by ${resolution.session.name} (${resolution.session.role})`
          );
        } else {
          await logoutGoogle();
          setGoogleUser(null);
          setAccessToken(null);
          setLoginError(
            `Access Denied: Google identity (${resolution.email}) is not registered in the Mugina Hope Academy staff or parent directory.`
          );
        }
      })
      .catch((err: any) => {
        if (!cancelled && err?.message) setLoginError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsGoogleLoading(false);
      });
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageHandoff);
    };
  }, [currentUser]);

  // Unified Username & Password Gate Handler (Automatically verifies Staff, Students, and Parents)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setGooglePopupBlocked(false);
    setGoogleFullTabNotice(false);
    setIsVerifyingLogin(true);
    ensureAdminFirebaseAuth().catch((err) => console.warn('Admin firebase auth init notice:', err));

    const cleanUser = loginUsername.trim();
    const cleanPass = loginPassword.trim();

    if (!cleanUser || !cleanPass) {
      setLoginError('Please enter both your username and password.');
      setIsVerifyingLogin(false);
      return;
    }

    try {
      // 1. Staff & Admin Authentication (Backend + Synced Cloud Directory)
      let staffRes = await authenticateStaffWithBackend(cleanUser, cleanPass);
      if (
        !staffRes.authorized &&
        !staffRes.reason.toLowerCase().includes('deactivated')
      ) {
        const syncedStaff = await syncServerStaff();
        setStaffList(syncedStaff);
        staffRes = await authenticateStaffWithBackend(cleanUser, cleanPass);
      }

      if (staffRes.authorized) {
        persistCredentialsIfEnabled(cleanUser || staffRes.session.username, cleanPass);
        setCurrentSessionUser(staffRes.session);
        setCurrentUser(staffRes.session);
        setActiveTab(resolveDefaultTabForUser(staffRes.session));
        logAuditEvent(
          'LOGIN',
          'Auth',
          staffRes.session.id,
          `${staffRes.session.name} (${staffRes.session.role}) signed in`
        );
        return;
      }

      if (staffRes.reason.toLowerCase().includes('deactivated')) {
        setLoginError(staffRes.reason);
        return;
      }

      // 2. Student Portal Authentication (Backend + Synced Cloud Directory)
      let studentRes = await authenticateStudentWithBackend(cleanUser, cleanPass);
      if (
        !studentRes.authorized &&
        !studentRes.reason.toLowerCase().includes('deactivated') &&
        !studentRes.reason.toLowerCase().includes('suspended') &&
        !studentRes.reason.toLowerCase().includes('transferred')
      ) {
        const syncedStudents = await syncServerStudents();
        setStudentList(syncedStudents);
        studentRes = await authenticateStudentWithBackend(cleanUser, cleanPass);
      }

      if (studentRes.authorized) {
        persistCredentialsIfEnabled(cleanUser, cleanPass);
        setCurrentSessionUser(studentRes.session);
        setCurrentUser(studentRes.session);
        logAuditEvent('LOGIN', 'Auth', studentRes.session.id, `${studentRes.session.name} signed into Student Portal`);
        return;
      }

      if (
        studentRes.reason.toLowerCase().includes('deactivated') ||
        studentRes.reason.toLowerCase().includes('suspended') ||
        studentRes.reason.toLowerCase().includes('transferred')
      ) {
        setLoginError(studentRes.reason);
        return;
      }

      // 3. Parent / Guardian Authentication against synced student records
      const parentSession = authenticateParentAccount(cleanUser, cleanPass);
      if (parentSession) {
        persistCredentialsIfEnabled(cleanUser, cleanPass);
        setCurrentSessionUser(parentSession);
        setCurrentUser(parentSession);
        logAuditEvent('LOGIN', 'Auth', parentSession.id, `${parentSession.name} signed into Parent Portal`);
        return;
      }

      setLoginError('Invalid username, email, or password. Please verify your credentials or click Forgot Password.');
    } catch (err: any) {
      console.warn('Login verification notice:', err);
      setLoginError('Could not verify credentials across database. Please check your connection and try again.');
    } finally {
      setIsVerifyingLogin(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotFeedback(null);
    if (!forgotEmail.trim()) {
      setForgotFeedback({ type: 'error', text: 'Please enter your registered email address.' });
      return;
    }
    setForgotSending(true);
    const res = await requestPasswordReset(forgotEmail);
    setForgotSending(false);
    setForgotFeedback({
      type: res.success ? 'success' : 'error',
      text: res.message,
    });
  };

  // Firebase Google Sign-In with Strict Identity-Based Access Control (Staff & Registered Parents)
  const handleGoogleConnect = async () => {
    setIsGoogleLoading(true);
    setLoginError('');
    setGooglePopupBlocked(false);
    try {
      const res = await googleSignIn();
      if (res?.redirected) {
        return;
      }
      if (res?.popupBlockedInIframe) {
        setGooglePopupBlocked(true);
        setLoginError(
          'Your browser blocked the Google sign-in popup inside this embedded window. Open Google Sign-In in a full browser tab below or sign in using your Username & Password.'
        );
        return;
      }
      if (res?.cancelled) {
        setLoginError('Google sign-in was closed before completing. Please try again.');
        return;
      }
      if (res && res.user) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);

        // Ensure staff and student/parent directories from Supabase/Firebase are fresh before authorizing
        await Promise.all([syncServerStaff(), syncServerStudents()]).catch(() => {});
        setStaffList(getStaffMembers());
        setStudentList(getEnrolledStudents());

        const resolution = resolveStaffRoleForFirebaseUser(res.user);
        if (resolution.authorized) {
          if (resolution.session.role !== 'Parent') {
            await exchangeFirebaseTokenForStaffSession(res.user).catch(() => {});
          }
          publishGoogleOAuthHandoff(resolution.session, getStaffAuthToken());
          setGooglePopupBlocked(false);
          setGoogleFullTabNotice(false);
          setCurrentSessionUser(resolution.session);
          setCurrentUser(resolution.session);
          setActiveTab(resolveDefaultTabForUser(resolution.session));
          logAuditEvent(
            'LOGIN',
            'Auth',
            resolution.session.id,
            `Google OAuth sign-in by ${resolution.session.name} (${resolution.session.role})`
          );
        } else {
          await logoutGoogle();
          setGoogleUser(null);
          setAccessToken(null);
          setLoginError(
            resolution.reason ||
              `Access Denied: Google identity (${resolution.email}) is not registered in the Mugina Hope Academy staff or parent directory.`
          );
        }
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Failed to authenticate with Google & Firebase.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      logAuditEvent('LOGOUT', 'Auth', currentUser.id, `${currentUser.name} signed out`);
    }
    setStudentAuthToken(null);
    setStaffAuthToken(null);
    setCurrentSessionUser(null);
    setCurrentUser(null);
    setGoogleUser(null);
    setAccessToken(null);
    await logoutGoogle();
  };

  // 1. Staff Enrollment & Edit (Admin only)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError(null);
    const cleanName = staffFormData.name.trim();
    const cleanUsername = staffFormData.username.trim();
    const cleanPassword = staffFormData.password.trim();
    if (!cleanName || !cleanUsername) {
      setStaffFormError('Please fill out full name and username.');
      return;
    }
    if (!editingStaffMember && cleanPassword.length < 6) {
      setStaffFormError('Initial password for a new staff member must be at least 6 characters.');
      return;
    }

    const cleanEmail = staffFormData.email.trim() || `${cleanUsername}@muginahopeschool.com`;
    setIsSavingStaff(true);
    try {
      if (editingStaffMember) {
        const updates: Partial<StaffMember> = {
          name: cleanName,
          role: staffFormData.role,
          email: cleanEmail,
          phone: staffFormData.phone.trim(),
          username: cleanUsername,
          assignedSubjectOrGrade: staffFormData.assignedSubjectOrGrade.trim(),
          status: staffFormData.status,
        };
        if (cleanPassword) {
          updates.password = cleanPassword;
        }
        updateStaffMember(editingStaffMember.id, updates);
        await waitForCredentialSync();
        setEditingStaffMember(null);
        setStaffActionNotice(
          `Updated staff account for ${cleanName} (${staffFormData.role}) — Sign-in Username: "${cleanUsername}".`
        );
      } else {
        const created = enrollStaffMember({
          name: cleanName,
          role: staffFormData.role,
          email: cleanEmail,
          phone: staffFormData.phone.trim(),
          username: cleanUsername,
          password: cleanPassword,
          assignedSubjectOrGrade: staffFormData.assignedSubjectOrGrade.trim(),
        });
        if (staffFormData.status === 'Inactive') {
          updateStaffMember(created.id, { status: 'Inactive' });
        }
        await waitForCredentialSync();
        setStaffActionNotice(
          `Enrolled ${cleanName} (${staffFormData.role}) — Sign-in Username: "${cleanUsername}" or Email: "${cleanEmail}".`
        );
      }
      setTimeout(() => setStaffActionNotice(null), 6000);

      setStaffList(getStaffMembers());
      setShowAddStaffModal(false);
      setStaffFormData({
        name: '',
        role: 'Teacher',
        email: '',
        phone: '+250 78',
        username: '',
        password: '',
        assignedSubjectOrGrade: '',
        status: 'Active',
      });
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (st: StaffMember) => {
    const nextStatus: StaffMember['status'] = st.status === 'Active' ? 'Inactive' : 'Active';
    const updated = updateStaffMember(st.id, { status: nextStatus });
    setStaffList(updated);
    await waitForCredentialSync();
    setStaffList(getStaffMembers());
    setStaffActionNotice(`${st.name} status set to ${nextStatus}.`);
    setTimeout(() => setStaffActionNotice(null), 4000);
  };

  const handleSendStaffPasswordReset = async (st: StaffMember) => {
    const targetEmail = (st.email || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setStaffActionNotice(`Staff member ${st.name} does not have a valid email address.`);
      return;
    }
    const res = await requestPasswordReset(targetEmail);
    setStaffActionNotice(res.message);
    setTimeout(() => setStaffActionNotice(null), 5000);
  };

  // 2. Student Enrollment & Edit (DOS primary objective & Admin)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentFormError(null);
    if (!studentFormData.fullName.trim() || !studentFormData.gradeCode) {
      setStudentFormError('Please provide student full name and grade level.');
      return;
    }

    const cleanSlug = studentFormData.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    const username = studentFormData.studentUsername.trim() || cleanSlug || studentFormData.regNumber.toLowerCase();
    const cleanNewPw = studentFormData.studentPassword.trim();

    setIsSavingStudent(true);
    try {
      if (editingStudent) {
        const updates: Partial<EnrolledStudent> = {
          regNumber: studentFormData.regNumber.trim(),
          fullName: studentFormData.fullName.trim(),
          gender: studentFormData.gender,
          dob: studentFormData.dob,
          gradeCode: studentFormData.gradeCode,
          stream: studentFormData.stream || 'A',
          address: studentFormData.address,
          admissionDate: studentFormData.admissionDate,
          previousSchool: studentFormData.previousSchool,
          photoUrl: studentFormData.photoUrl,
          parentName: studentFormData.parentName,
          parentPhone: studentFormData.parentPhone,
          parentEmail: studentFormData.parentEmail,
          studentUsername: username,
          studentAccountActive: studentFormData.studentAccountActive,
          status: studentFormData.status,
        };
        if (cleanNewPw && cleanNewPw !== '••••••') {
          updates.studentPassword = cleanNewPw;
        }
        updateEnrolledStudent(editingStudent.id, updates);
        await waitForCredentialSync();
        logAuditEvent('UPDATE', 'Student', editingStudent.id, `Updated student record ${studentFormData.fullName.trim()}`);
        setDeleteSuccessMsg(
          `Saved changes for ${studentFormData.fullName.trim()} — Student Username: "${username}" (Reg ID: ${studentFormData.regNumber.trim()}).`
        );
        setEditingStudent(null);
      } else {
        const initialPw = cleanNewPw && cleanNewPw !== '••••••' ? cleanNewPw : 'student@2026';
        const created = enrollStudentByDOS({
          regNumber: studentFormData.regNumber.trim(),
          fullName: studentFormData.fullName.trim(),
          gender: studentFormData.gender,
          dob: studentFormData.dob,
          gradeCode: studentFormData.gradeCode,
          stream: studentFormData.stream || 'A',
          address: studentFormData.address,
          admissionDate: studentFormData.admissionDate,
          previousSchool: studentFormData.previousSchool,
          photoUrl: studentFormData.photoUrl,
          parentName: studentFormData.parentName,
          parentPhone: studentFormData.parentPhone,
          parentEmail: studentFormData.parentEmail,
          studentUsername: username,
          studentPassword: initialPw,
          studentAccountActive: studentFormData.studentAccountActive,
          enrolledBy: currentUser?.name || 'DOS',
          status: studentFormData.status,
        });
        await waitForCredentialSync();
        logAuditEvent('CREATE', 'Student', created.id, `Enrolled student ${created.fullName} into ${created.gradeCode}`);
        setDeleteSuccessMsg(
          `Enrolled ${created.fullName} (${created.regNumber}) — Portal Username: "${username}".`
        );
      }
      setTimeout(() => setDeleteSuccessMsg(null), 6000);

      setStudentList(getEnrolledStudents());
      setShowAddStudentModal(false);
      setStudentFormData({
        regNumber: `MHA-2026-${Math.floor(100 + Math.random() * 900)}`,
        fullName: '',
        gender: 'Female',
        dob: '2017-05-10',
        gradeCode: 'P4',
        stream: 'A',
        address: 'Mugina Sector, Kamonyi District',
        admissionDate: new Date().toISOString().split('T')[0],
        previousSchool: '',
        photoUrl: '',
        parentName: '',
        parentPhone: '+250 78',
        parentEmail: '',
        studentUsername: '',
        studentPassword: 'student@2026',
        studentAccountActive: true,
        status: 'Active',
      });
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Website Settings Save Handler (Admin & Headteacher can edit everything)
  const handleSaveWebsiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveWebsiteSettings(websiteSettings);
    setWebsiteSettingsSuccess(true);
    setTimeout(() => setWebsiteSettingsSuccess(false), 3500);
  };

  const handleTestSupabase = async () => {
    setSupabaseTestStatus({ testing: true, message: 'Testing Supabase connection...' });
    const res = await testSupabaseConnection(websiteSettings.supabaseUrl, websiteSettings.supabaseAnonKey);
    setSupabaseTestStatus({ testing: false, message: res.message, success: res.success });
  };

  const handleSyncToSupabase = async () => {
    setSupabaseSyncStatus({ syncing: true, message: 'Synchronizing school gallery, staff, and student records to Supabase...' });
    const res = await syncAllDataToSupabase(websiteSettings.supabaseUrl, websiteSettings.supabaseAnonKey);
    setSupabaseSyncStatus({ syncing: false, message: res.message, success: res.success });
  };

  const [copiedSql, setCopiedSql] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const handleCopySupabaseSQL = () => {
    const sql = `-- MUGINA HOPE PRIMARY & NURSERY ACADEMY - COMPLETE 15-TABLE SUPABASE SCHEMA
-- Run in your Supabase SQL Editor: https://supabase.com/dashboard

CREATE TABLE IF NOT EXISTS public.website_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Website Settings" ON public.website_settings FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Website Settings" ON public.website_settings FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.school_gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'outdoor',
  description TEXT,
  image_src TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.school_gallery ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Gallery" ON public.school_gallery FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Gallery" ON public.school_gallery FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  assigned_subject_or_grade TEXT,
  enrolled_at TEXT,
  status TEXT DEFAULT 'Active',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS enrolled_at TEXT;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Staff" ON public.staff_members FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Staff" ON public.staff_members FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.enrolled_students (
  id TEXT PRIMARY KEY,
  reg_number TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT DEFAULT 'Female',
  dob TEXT,
  grade_code TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  student_username TEXT,
  student_password TEXT,
  enrolled_by TEXT,
  enrolled_at TEXT,
  status TEXT DEFAULT 'Active',
  feedback_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Female';
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS student_username TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS student_password TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS enrolled_by TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS enrolled_at TEXT;
ALTER TABLE public.enrolled_students ADD COLUMN IF NOT EXISTS feedback_notes TEXT;
ALTER TABLE public.enrolled_students ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Students" ON public.enrolled_students FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Students" ON public.enrolled_students FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id TEXT PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT NOT NULL,
  grade_code TEXT NOT NULL,
  payment_type TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL,
  bank_slip_ref TEXT,
  recorded_by TEXT,
  recorded_at TEXT NOT NULL,
  term TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  status TEXT DEFAULT 'Completed',
  refund_reason TEXT,
  refund_requested_at TEXT,
  refund_requested_by TEXT,
  refund_reviewed_at TEXT,
  refund_reviewed_by TEXT,
  refund_review_note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Payments" ON public.payment_transactions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Payments" ON public.payment_transactions FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admissions_applications (
  id TEXT PRIMARY KEY,
  ref_code TEXT NOT NULL,
  student_name TEXT NOT NULL,
  gender TEXT,
  dob TEXT,
  grade_code TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT,
  sector TEXT,
  wants_lunch BOOLEAN DEFAULT false,
  wants_transport BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pending Confirmation',
  feedback_notes TEXT,
  assigned_student_id TEXT,
  created_at TEXT,
  confirmed_at TEXT,
  confirmed_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.admissions_applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Applications" ON public.admissions_applications FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Applications" ON public.admissions_applications FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  grade_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  parent_email TEXT,
  parent_phone TEXT,
  status TEXT NOT NULL,
  marked_by TEXT,
  notes TEXT,
  email_notified BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Attendance" ON public.attendance_records FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Attendance" ON public.attendance_records FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.teacher_attendance_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  assigned_subject_or_grade TEXT,
  status TEXT NOT NULL,
  arrival_check_in_time TEXT,
  marked_by TEXT,
  topics_covered TEXT,
  duty_signature TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.teacher_attendance_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Teacher Attendance" ON public.teacher_attendance_records FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Teacher Attendance" ON public.teacher_attendance_records FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.discipline_records (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL,
  date TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT,
  grade_code TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  incident_description TEXT,
  action_taken TEXT,
  parent_notified BOOLEAN DEFAULT false,
  parent_contact TEXT,
  status TEXT DEFAULT 'Open',
  recorded_by TEXT,
  resolution_notes TEXT,
  follow_up_date TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.discipline_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Discipline" ON public.discipline_records FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Discipline" ON public.discipline_records FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.student_progress_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  reg_number TEXT,
  grade_code TEXT NOT NULL,
  stream TEXT,
  date TEXT NOT NULL,
  teacher_id TEXT,
  teacher_name TEXT,
  subject TEXT NOT NULL,
  academic_performance TEXT,
  academic_score NUMERIC,
  academic_notes TEXT,
  behavior_rating TEXT,
  behavioral_notes TEXT,
  action_or_recommendation TEXT,
  parent_notified BOOLEAN DEFAULT false,
  created_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.student_progress_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Progress Logs" ON public.student_progress_logs FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Progress Logs" ON public.student_progress_logs FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.school_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  badge TEXT,
  is_active BOOLEAN DEFAULT true,
  published_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Announcements" ON public.school_announcements FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Announcements" ON public.school_announcements FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.registration_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT true,
  applicable_grades TEXT,
  format_hint TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size TEXT,
  file_type TEXT,
  uploaded_at TEXT,
  sort_order INTEGER DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.registration_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Documents" ON public.registration_documents FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Documents" ON public.registration_documents FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.visitor_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT,
  status TEXT DEFAULT 'New',
  email_sent_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.visitor_inquiries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Inquiries" ON public.visitor_inquiries FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Inquiries" ON public.visitor_inquiries FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.campus_tour_bookings (
  id TEXT PRIMARY KEY,
  parent_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  grade_interest TEXT,
  guests_count TEXT,
  status TEXT DEFAULT 'Confirmed',
  created_at TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.campus_tour_bookings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Tours" ON public.campus_tour_bookings FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Tours" ON public.campus_tour_bookings FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.applicant_chats (
  ref_code TEXT PRIMARY KEY,
  student_name TEXT,
  parent_name TEXT,
  parent_email TEXT,
  parent_phone TEXT,
  grade_code TEXT,
  status TEXT DEFAULT 'Pending Confirmation',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.applicant_chats ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Public Read Chats" ON public.applicant_chats FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Write Chats" ON public.applicant_chats FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('school-media', 'school-media', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Read School Media" ON storage.objects FOR SELECT USING (bucket_id = 'school-media'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Public Upload School Media" ON storage.objects FOR ALL USING (bucket_id = 'school-media') WITH CHECK (bucket_id = 'school-media'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'website_settings','school_gallery','staff_members','enrolled_students','payment_transactions',
    'admissions_applications','attendance_records','teacher_attendance_records','discipline_records',
    'student_progress_logs','school_announcements','registration_documents','visitor_inquiries',
    'campus_tour_bookings','applicant_chats'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3500);
  };

  const handleExportDatabaseBackup = () => {
    try {
      const backupData = {
        metadata: {
          school: 'Mugina Hope Primary & Nursery Academy',
          district: 'Kamonyi District, Rwanda',
          exportedAt: new Date().toISOString(),
          version: '3.1',
        },
        websiteSettings: getWebsiteSettings(),
        staffMembers: getStaffMembers(),
        enrolledStudents: getEnrolledStudents(),
        galleryItems: getGalleryItems(),
        attendanceRecords: getAttendanceRecords(),
        teacherAttendanceRecords: getTeacherAttendanceRecords(),
        disciplineRecords: getDisciplineRecords(),
        paymentTransactions: getPaymentTransactions(),
        inquiries: getInquiries(),
        applications: getApplications(),
        requiredDocuments: getRequiredDocuments(),
        announcements: getAnnouncements(),
        tourBookings: getTourBookings(),
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `mugina_hope_database_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMsg('Complete database snapshot exported successfully (JSON)!');
      setTimeout(() => setBackupMsg(null), 4500);
    } catch (err: any) {
      setBackupMsg(`Error exporting backup: ${err?.message || 'Failed'}`);
    }
  };

  const handleExportStudentsCSV = () => {
    try {
      const students = getEnrolledStudents();
      const headers = ['ID', 'Reg Number', 'Full Name', 'Gender', 'Date of Birth', 'Grade Code', 'Parent Name', 'Parent Phone', 'Parent Email', 'Status'];
      const rows = students.map((s) => [
        s.id,
        s.regNumber,
        `"${(s.fullName || '').replace(/"/g, '""')}"`,
        s.gender || 'N/A',
        s.dob || 'N/A',
        s.gradeCode,
        `"${(s.parentName || '').replace(/"/g, '""')}"`,
        s.parentPhone || '',
        s.parentEmail || '',
        s.status || 'Active',
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `mugina_hope_students_roster_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMsg('Pupils enrollment roster exported as CSV (Ready for MINEDUC / District)!');
      setTimeout(() => setBackupMsg(null), 4500);
    } catch (err: any) {
      setBackupMsg(`Error exporting CSV: ${err?.message || 'Failed'}`);
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.websiteSettings && !parsed.enrolledStudents && !parsed.staffMembers) {
          setBackupMsg('Invalid backup file format. Expected a Mugina Hope Academy database backup JSON file.');
          return;
        }
        setPendingBackupRestore({ fileName: file.name, data: parsed });
      } catch (err: any) {
        setBackupMsg(`Error reading backup file: ${err?.message || 'Invalid JSON'}`);
      }
    };
    reader.readAsText(file);
  };

  const executeRestoreBackup = async () => {
    if (!pendingBackupRestore) return;
    const { fileName, data: parsed } = pendingBackupRestore;
    try {
      if (parsed.websiteSettings) saveWebsiteSettings(parsed.websiteSettings);
      if (Array.isArray(parsed.staffMembers)) saveStaffMembers(parsed.staffMembers);
      if (Array.isArray(parsed.enrolledStudents)) saveEnrolledStudents(parsed.enrolledStudents);
      if (Array.isArray(parsed.galleryItems)) saveGalleryItems(parsed.galleryItems, true);
      if (Array.isArray(parsed.announcements)) saveAnnouncements(parsed.announcements, true);
      if (Array.isArray(parsed.requiredDocuments)) saveRequiredDocuments(parsed.requiredDocuments);
      if (Array.isArray(parsed.applications)) saveApplications(parsed.applications);
      if (Array.isArray(parsed.paymentTransactions)) savePaymentTransactions(parsed.paymentTransactions);
      if (Array.isArray(parsed.attendanceRecords)) saveAttendanceBatch(parsed.attendanceRecords);
      if (Array.isArray(parsed.teacherAttendanceRecords)) saveTeacherAttendanceBatch(parsed.teacherAttendanceRecords);
      if (Array.isArray(parsed.disciplineRecords)) saveDisciplineRecords(parsed.disciplineRecords);

      setWebsiteSettings(getWebsiteSettings());
      setStaffList(getStaffMembers());
      setStudentList(getEnrolledStudents());
      setGalleryItems(getGalleryItems());
      setAnnouncements(getAnnouncements());
      setDocList(getRequiredDocuments());
      setApplications(getApplications());
      setPaymentTransactions(getPaymentTransactions());
      if (onGalleryUpdated) onGalleryUpdated();

      await syncAllDataToSupabase(parsed.websiteSettings?.supabaseUrl || websiteSettings.supabaseUrl, parsed.websiteSettings?.supabaseAnonKey || websiteSettings.supabaseAnonKey).catch(() => {});

      setPendingBackupRestore(null);
      setBackupMsg(`Database restored successfully from ${fileName} and synchronized across cloud stores.`);
      setTimeout(() => setBackupMsg(null), 5000);
    } catch (err: any) {
      setPendingBackupRestore(null);
      setBackupMsg(`Error restoring backup: ${err?.message || 'Failed'}`);
    }
  };

  // 3. Confirm Admissions Application (Admin & DOS)
  const handleConfirmApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmAppTarget) return;
    setConfirmAppError(null);
    setIsConfirmingApp(true);
    try {
      const { student } = confirmApplicationByDOSOrAdmin(
        confirmAppTarget.id,
        confirmFeedbackNotes,
        currentUser?.name || 'Director of Studies',
        confirmStudentUser || `stu.${confirmAppTarget.studentName.toLowerCase().replace(/\s+/g, '')}`,
        confirmStudentPass || 'mugina@2026'
      );

      // Dispatch multi-tier confirmation email (Vercel serverless / Express / Cloud notification)
      if (student.parentEmail) {
        dispatchOfficialEmail({
          to: student.parentEmail,
          subject: `[Mugina Hope Academy] Official Admission Confirmation: ${student.fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #93c5fd; border-radius: 8px;">
              <h2 style="color: #1e3a8a;">Mugina Hope Primary & Nursery Academy</h2>
              <p>Dear ${student.parentName || 'Parent / Guardian'},</p>
              <p>Registration for <strong>${student.fullName}</strong> (${student.gradeCode}) has been officially <strong>CONFIRMED & APPROVED</strong>.</p>
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin: 15px 0;">
                <p><strong>Registration ID:</strong> <code>${student.regNumber}</code></p>
                <p><strong>Student Portal Username:</strong> <code>${student.studentUsername}</code></p>
                <p><strong>Temporary Password:</strong> <code>${student.studentPassword}</code></p>
              </div>
              ${confirmFeedbackNotes ? `<p><strong>Feedback from Administration:</strong> ${confirmFeedbackNotes}</p>` : ''}
              <p style="font-size: 11px; color: #64748b;">Mugina Sector, Kamonyi District, Rwanda · Adjacent to Mugina Police Station</p>
            </div>
          `,
          type: 'admission_confirm',
          details: {
            refCode: confirmAppTarget.refCode,
            studentName: student.fullName,
            studentId: student.regNumber,
            grade: student.gradeCode,
            parentName: student.parentName,
            parentEmail: student.parentEmail,
            studentUsername: student.studentUsername,
            studentPassword: student.studentPassword,
            feedbackNotes: confirmFeedbackNotes,
          },
        }).catch((e) => console.warn('Admission email dispatch notice:', e));
      }

      // Update local states
      setApplications(getApplications());
      setStudentList(getEnrolledStudents());
      setConfirmAppTarget(null);
      setDeleteSuccessMsg(
        `Admission approved! ${student.fullName} enrolled (ID: ${student.regNumber}). Feedback dispatched to ${student.parentEmail || 'parent'}.`
      );
      setTimeout(() => setDeleteSuccessMsg(null), 5000);
    } catch (err: any) {
      setConfirmAppError(`Error approving application: ${err?.message || 'Failed'}`);
    } finally {
      setIsConfirmingApp(false);
    }
  };

  // 3b. Official Admissions Review Handler (Approve + Verification Code / Reject / Request More Info)
  const handleReviewApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAppTarget) return;
    setReviewError(null);
    setIsReviewSubmitting(true);
    try {
      const token = getStaffAuthToken();
      const res = await fetch('/api/admissions/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          appId: reviewAppTarget.id,
          action: reviewAction,
          notes: reviewNotes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setReviewError(data.error || 'Could not process admission review.');
        setIsReviewSubmitting(false);
        return;
      }

      const syncedApps = await syncServerApplications();
      setApplications(syncedApps);
      await fetchChatThreads();
      setReviewAppTarget(null);
      setReviewNotes('');
      setDeleteSuccessMsg(
        reviewAction === 'approve'
          ? `Approved ${reviewAppTarget.studentName}! Email status: ${data.emailDeliveryStatus}. Parent verification code sent.`
          : reviewAction === 'reject'
          ? `Application for ${reviewAppTarget.studentName} marked Rejected and parent notified.`
          : `More information requested from ${reviewAppTarget.parentName || 'parent'} via email.`
      );
      setTimeout(() => setDeleteSuccessMsg(null), 6000);
    } catch (err: any) {
      setReviewError(err?.message || 'Network error submitting review.');
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const handleSendAdminReply = async (refCode: string) => {
    const cleanText = adminReplyText.trim();
    if (!cleanText) return;
    setIsSendingReply(true);
    const senderName = `${currentUser?.name || 'Norbert Ihimbazwe Manzi'} (Admin)`;
    const createdAt = new Date().toISOString();
    const adminMsg = {
      id: `adm-${Date.now()}`,
      sender: 'admin' as const,
      senderName,
      text: cleanText,
      createdAt,
    };

    const currentThread = chatThreads.find((t) => t.refCode === refCode);
    const updatedMessages = [...(currentThread?.messages || []), adminMsg];
    const updatedThread = {
      refCode,
      studentName: currentThread?.studentName || 'Applicant',
      parentName: currentThread?.parentName || 'Parent / Guardian',
      parentEmail: currentThread?.parentEmail || '',
      parentPhone: currentThread?.parentPhone || '',
      gradeCode: currentThread?.gradeCode || '',
      status: currentThread?.status || 'Pending Confirmation',
      messages: updatedMessages,
      updatedAt: createdAt,
    };

    // Optimistic UI update
    setChatThreads((prev) =>
      prev.map((t) => (t.refCode === refCode ? { ...t, messages: updatedMessages, updatedAt: createdAt } : t))
    );
    setAdminReplyText('');

    try {
      await Promise.allSettled([
        appendApplicantChatMessageToSupabase(refCode, adminMsg, updatedThread),
        saveApplicantChatToFirebase(updatedThread),
        fetch(`/api/chats/${encodeURIComponent(refCode)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: 'admin',
            senderName,
            text: cleanText,
          }),
        }),
      ]);

      if (updatedThread.parentEmail) {
        dispatchOfficialEmail({
          to: updatedThread.parentEmail,
          subject: `[Mugina Hope Academy] Message regarding Application ${refCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h3 style="color: #1e3a8a;">Mugina Hope Primary & Nursery Academy</h3>
              <p>Dear ${updatedThread.parentName},</p>
              <p>Administration reply regarding applicant <strong>${updatedThread.studentName}</strong> (${refCode}):</p>
              <blockquote style="background: #f8fafc; padding: 12px 16px; border-left: 4px solid #1e3a8a; margin: 12px 0;">${cleanText}</blockquote>
              <p style="font-size: 12px; color: #64748b;">Sent by ${senderName}</p>
            </div>
          `,
          type: 'contact_inquiry',
          details: { refCode, studentName: updatedThread.studentName, reply: cleanText },
        }).catch(() => {});
      }
      await fetchChatThreads();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingReply(false);
    }
  };

  // 4. Save Attendance Batch & Notify Absent Parents via Gmail
  const handleSaveAttendance = async () => {
    setAttendanceSaving(true);
    setAttendanceSuccessMsg(null);

    const studentsInClass = studentList.filter((s) => s.gradeCode === attendanceGrade);
    const recordsToSave: AttendanceRecord[] = [];
    const absentStudentsToNotify: { student: EnrolledStudent; notes: string }[] = [];

    studentsInClass.forEach((s) => {
      const entry = attendanceMap[s.id] || { status: 'Present', notes: '' };
      recordsToSave.push({
        id: `att-${s.id}-${attendanceDate}`,
        date: attendanceDate,
        gradeCode: attendanceGrade,
        studentId: s.id,
        studentName: s.fullName,
        parentEmail: s.parentEmail,
        parentPhone: s.parentPhone,
        status: entry.status,
        markedBy: currentUser?.name || 'Staff Member',
        notes: entry.notes,
        emailNotified: entry.status === 'Absent',
      });

      if (entry.status === 'Absent' && s.parentEmail) {
        absentStudentsToNotify.push({ student: s, notes: entry.notes });
      }
    });

    saveAttendanceBatch(recordsToSave);

    // Send notifications to absent parents via backend /api/attendance/notify
    let notifiedCount = 0;
    for (const item of absentStudentsToNotify) {
      try {
        await fetch('/api/attendance/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: item.student.fullName,
            studentId: item.student.regNumber,
            grade: item.student.gradeCode,
            parentEmail: item.student.parentEmail,
            parentName: item.student.parentName,
            date: attendanceDate,
            status: 'Absent',
            notes: item.notes,
          }),
        });
        notifiedCount++;
      } catch (err) {
        console.error('Attendance email error:', err);
      }
    }

    setAttendanceSaving(false);
    setAttendanceSuccessMsg(
      `Attendance saved! Recorded ${recordsToSave.length} students (${recordsToSave.filter(r => r.status === 'Present').length} Present, ${recordsToSave.filter(r => r.status === 'Absent').length} Absent). Dispatched ${notifiedCount} Gmail alert(s) to absent student parents.`
    );
  };

  // 5. Gallery Upload / Edit (Firebase Storage & Cloud Assets)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      setImageUploadStatus(`Selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB). Ready for Firebase Storage.`);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImageFormData((prev) => ({
          ...prev,
          imageSrc: base64,
          title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveGalleryImage = async (e: React.FormEvent) => {
    e.preventDefault();
    setImageFormError(null);
    if (!imageFormData.title.trim() || (!imageFormData.imageSrc && !selectedImageFile)) {
      setImageFormError('Please provide an image title and select an image file or URL.');
      return;
    }

    setIsUploadingImage(true);
    let finalImageUrl = imageFormData.imageSrc;

    try {
      if (selectedImageFile) {
        setImageUploadStatus('Optimizing & uploading image to Cloud Storage...');
        const uploadRes = await uploadSchoolAsset(selectedImageFile, imageFormData.title, imageFormData.category);
        finalImageUrl = uploadRes.url;
        setImageUploadStatus(
          `Ready via ${
            uploadRes.source === 'firebase-storage'
              ? 'Firebase Storage'
              : uploadRes.source === 'supabase-storage'
                ? 'Supabase Storage'
                : 'Cloud Synced Asset'
          }`
        );
      } else if (imageFormData.imageSrc && imageFormData.imageSrc.startsWith('data:')) {
        setImageUploadStatus('Optimizing image for multi-device display...');
        const uploadRes = await uploadSchoolAsset(imageFormData.imageSrc, imageFormData.title, imageFormData.category);
        finalImageUrl = uploadRes.url;
      }

      if (editingImageItem) {
        await updateGalleryItemAsync(editingImageItem.id, {
          title: imageFormData.title,
          category: imageFormData.category,
          description: imageFormData.description || imageFormData.title,
          caption: imageFormData.caption || imageFormData.title,
          altText: imageFormData.altText || imageFormData.title,
          imageSrc: finalImageUrl,
        });
      } else {
        await addGalleryItemAsync({
          title: imageFormData.title,
          category: imageFormData.category,
          description: imageFormData.description || imageFormData.title,
          caption: imageFormData.caption || imageFormData.title,
          altText: imageFormData.altText || imageFormData.title,
          imageSrc: finalImageUrl,
        });
      }

      setGalleryItems(getGalleryItems());
      if (onGalleryUpdated) onGalleryUpdated();
      setShowAddImageModal(false);
      setEditingImageItem(null);
      setSelectedImageFile(null);
      setImageFormData({ title: '', category: 'outdoor', description: '', caption: '', altText: '', imageSrc: '' });
    } catch (err: any) {
      console.warn('Gallery image save notice:', err);
      setImageFormError('Failed to save gallery image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // 6. News / Announcement CRUD
  const handleSaveNews = (e: React.FormEvent) => {
    e.preventDefault();
    setNewsFormError(null);
    if (!newsFormData.title.trim() || !newsFormData.content.trim()) {
      setNewsFormError('Both announcement title and content are required.');
      return;
    }

    if (editingNewsItem) {
      updateAnnouncement(editingNewsItem.id, newsFormData);
    } else {
      addAnnouncement(newsFormData);
    }

    setAnnouncements(getAnnouncements());
    setShowNewsModal(false);
    setEditingNewsItem(null);
    setNewsFormData({ title: '', content: '', badge: 'Announcement', isActive: true });
    if (onGalleryUpdated) onGalleryUpdated();
  };

  // 7. Required Registration Documents CRUD (Admin & DOS) with Cloud Storage file upload
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedDocFile(file);
      const sizeStr =
        file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(0)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      setDocUploadStatus(`Selected: ${file.name} (${sizeStr}). Ready for upload.`);
      setDocFormData((prev) => ({
        ...prev,
        fileName: file.name,
        fileSize: sizeStr,
        fileType: file.type || 'application/pdf',
      }));
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocFormError(null);
    if (!docFormData.title.trim()) {
      setDocFormError('Please provide a document title.');
      return;
    }

    setIsUploadingDoc(true);
    let finalFileUrl = docFormData.fileUrl;
    let finalFileName = docFormData.fileName;
    let finalFileSize = docFormData.fileSize;
    let finalFileType = docFormData.fileType;

    if (selectedDocFile) {
      setDocUploadStatus('Uploading official document to Firebase Storage...');
      try {
        const uploadRes = await uploadSchoolDocument(selectedDocFile, docFormData.title);
        finalFileUrl = uploadRes.url;
        finalFileName = uploadRes.fileName || selectedDocFile.name;
        finalFileSize = uploadRes.fileSize || finalFileSize;
        finalFileType = uploadRes.fileType || finalFileType;
        setDocUploadStatus('Uploaded successfully to Firebase Storage!');
      } catch (err: any) {
        console.warn('Document storage upload notice:', err);
      }
    }

    if (editingDoc) {
      updateRequiredDocument(editingDoc.id, {
        title: docFormData.title,
        description: docFormData.description,
        isRequired: docFormData.isRequired,
        applicableGrades: docFormData.applicableGrades,
        formatHint: docFormData.formatHint,
        fileUrl: finalFileUrl,
        fileName: finalFileName,
        fileSize: finalFileSize,
        fileType: finalFileType,
      });
    } else {
      addRequiredDocument({
        title: docFormData.title,
        description: docFormData.description,
        isRequired: docFormData.isRequired,
        applicableGrades: docFormData.applicableGrades,
        formatHint: docFormData.formatHint,
        fileUrl: finalFileUrl,
        fileName: finalFileName,
        fileSize: finalFileSize,
        fileType: finalFileType,
        uploadedAt: new Date().toISOString(),
      });
    }

    setDocList(getRequiredDocuments());
    setIsUploadingDoc(false);
    setSelectedDocFile(null);
    setDocUploadStatus('');
    setShowDocModal(false);
    setEditingDoc(null);
    setDocFormData({
      title: '',
      description: '',
      isRequired: true,
      applicableGrades: 'All Grades (Nursery & Primary)',
      formatHint: '',
      fileUrl: '',
      fileName: '',
      fileSize: '',
      fileType: '',
    });
  };

  const handleDeleteDoc = (id: string) => {
    const doc = docList.find((d) => d.id === id);
    setDeleteTarget({
      type: 'doc',
      id,
      name: doc?.title || 'Registration Document Requirement',
    });
  };

  const executeDelete = () => {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;

    try {
      if (type === 'staff') {
        const updated = deleteStaffMember(id);
        setStaffList(updated);
        setDeleteSuccessMsg(`Staff account for ${name} deleted successfully.`);
      } else if (type === 'student') {
        const updated = deleteEnrolledStudent(id);
        setStudentList(updated);
        setSelectedStudentIds((prev) => prev.filter((sid) => sid !== id));
        setDeleteSuccessMsg(`Student ${name} removed from enrollment roster.`);
      } else if (type === 'student-batch') {
        const targetIds = deleteTarget.ids || [];
        const idSet = new Set(targetIds);
        const updated = deleteEnrolledStudentsBatch(targetIds);
        setStudentList(updated);
        setSelectedStudentIds((prev) => prev.filter((sid) => !idSet.has(sid)));
        logAuditEvent(
          'BULK_DELETE',
          'Student',
          'batch',
          `Deleted ${targetIds.length} learner(s) (${name})`
        );
        setDeleteSuccessMsg(`Removed ${targetIds.length} learner(s) (${name}) from enrollment roster.`);
      } else if (type === 'doc') {
        const updated = deleteRequiredDocument(id);
        setDocList(updated);
        setDeleteSuccessMsg(`Registration requirement "${name}" deleted.`);
      } else if (type === 'gallery') {
        const updated = deleteGalleryItem(id);
        setGalleryItems(updated);
        if (onGalleryUpdated) onGalleryUpdated();
        setDeleteSuccessMsg(`Photo "${name}" removed from school gallery.`);
      } else if (type === 'news') {
        const updated = deleteAnnouncement(id);
        setAnnouncements(updated);
        if (onGalleryUpdated) onGalleryUpdated();
        setDeleteSuccessMsg(`Announcement "${name}" deleted.`);
      } else if (type === 'application') {
        const updated = deleteApplication(id);
        setApplications(updated);
        setDeleteSuccessMsg(`Application for ${name} removed.`);
      }
    } catch (err: any) {
      console.error('Delete execution error:', err);
      setDeleteSuccessMsg(`Error deleting ${name}: ${err?.message || 'Action failed'}`);
    }

    setDeleteTarget(null);
    setTimeout(() => setDeleteSuccessMsg(null), 4000);
  };

  // If not logged in, render Unified Portal Login Gate (Username + Password + Google Sign-In)
  if (!currentUser) {
    return (
      <div className="w-full max-w-md mx-auto px-3.5 sm:px-4 py-6 sm:py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 p-6 text-white text-center space-y-2">
            <SchoolLogo size="lg" className="mx-auto" />
            <h1 className="text-lg sm:text-xl font-black font-display tracking-tight text-white mt-1">
              Mugina Hope School Management Portal
            </h1>
          </div>

          <div className="p-5 sm:p-8 space-y-5">
            {googleFullTabNotice && !loginError && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-700 dark:text-amber-400" />
                <span>
                  Full browser tab ready. Click <strong>Sign in with Google Account</strong> below to sign in without frame popup restrictions.
                </span>
              </div>
            )}

            {loginError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
                {googlePopupBlocked && (
                  <a
                    href="/admin?google_auth=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition-colors"
                  >
                    <span>Continue with Google in New Tab</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  </a>
                )}
              </div>
            )}

            {/* Password-Protected Security Gate OR Forgot Password Flow */}
            {showForgotPassword ? (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Reset Your Account Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter the email address registered on your Student, Teacher, or Staff account to receive a secure single-use reset link via Gmail.
                  </p>
                </div>

                {forgotFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      forgotFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {forgotFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{forgotFeedback.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com"
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotSending}
                  className="w-full py-3 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {forgotSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>Send Password Reset Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotFeedback(null);
                  }}
                  className="w-full py-2 text-xs font-semibold text-blue-800 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Back to Portal Sign In
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Enter your username or email"
                      autoComplete="username"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="text-xs text-blue-700 dark:text-amber-400 hover:text-blue-900 font-semibold inline-flex items-center gap-1 focus:outline-hidden cursor-pointer"
                      >
                        {showLoginPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>Reveal</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-11 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-hidden cursor-pointer"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        title={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4 text-blue-700 dark:text-amber-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="remember-password-check" className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="remember-password-check"
                        checked={rememberPassword}
                        onChange={(e) => {
                          setRememberPassword(e.target.checked);
                          if (!e.target.checked) {
                            try {
                              localStorage.setItem('mha_remember_password', 'false');
                              localStorage.removeItem('mha_saved_credentials_v1');
                              setHasSavedCredentials(false);
                            } catch {}
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Remember login
                      </span>
                    </label>

                    <div className="flex items-center gap-3">
                      {hasSavedCredentials && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-emerald-600 font-bold inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Saved
                          </span>
                          <button
                            type="button"
                            onClick={handleForgetSavedCredentials}
                            className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                            title="Clear saved login from device"
                          >
                            Forget
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotFeedback(null);
                          if (loginUsername.includes('@')) setForgotEmail(loginUsername.trim());
                        }}
                        className="text-xs font-bold text-blue-800 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingLogin}
                    className="w-full py-3 px-4 bg-blue-950 hover:bg-blue-900 active:bg-slate-950 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isVerifyingLogin ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                        <span>Verifying Account...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-400" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-slate-700 w-full" />
                  <span className="bg-white dark:bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold absolute">
                    or continue with Google
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleConnect}
                  disabled={isGoogleLoading}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-100 font-semibold text-xs rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-75"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isGoogleLoading ? 'Connecting...' : 'Sign in with Google Account'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Strictly Scoped Parent & Student Portals (Zero Access to Staff/Admin Tabs)
  if (currentUser.role === 'Parent' || currentUser.role === 'Student') {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <SchoolLogo size="md" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-display">
                  {currentUser.role === 'Parent' ? 'Parent & Guardian Portal' : 'Student Academic Portal'}
                </h1>
                <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-amber-400 border border-blue-200 dark:border-blue-800">
                  {getRoleDisplayLabel(currentUser.role)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Signed in as <strong>{currentUser.name}</strong> ({currentUser.email || currentUser.username})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleThemeMode}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle color mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer"
            >
              View Public Site
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {currentUser.role === 'Parent' ? (
          <ParentPortal sessionUser={currentUser} students={studentList} />
        ) : (
          <StudentPortal sessionUser={currentUser} students={studentList} onLogout={handleLogout} />
        )}
      </div>
    );
  }

  // Filter students
  const filteredStudents = studentList.filter((s) => {
    const matchesGrade = studentGradeFilter === 'ALL' || s.gradeCode === studentGradeFilter;
    if (!matchesGrade) return false;
    if (!studentSearchQuery) return true;
    const q = studentSearchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.regNumber.toLowerCase().includes(q) ||
      s.gradeCode.toLowerCase().includes(q) ||
      s.parentName.toLowerCase().includes(q) ||
      (s.stream || '').toLowerCase().includes(q)
    );
  });

  const handleBulkPromoteSelected = () => {
    if (selectedStudentIds.length === 0) return;
    const promotedCount = promoteStudentsBatch(selectedStudentIds, currentUser?.name || 'Administrator');
    setStudentList(getEnrolledStudents());
    setSelectedStudentIds([]);
    logAuditEvent(
      'PROMOTE',
      'Student',
      'batch',
      `Promoted ${promotedCount} student(s) to next academic class`
    );
    setDeleteSuccessMsg(`Successfully promoted ${promotedCount} learner(s) to their next class level.`);
    setTimeout(() => setDeleteSuccessMsg(null), 4500);
  };

  const canManageAcademics = hasPermission(currentUser, 'manage_academics');
  const canConfigureExams = hasPermission(currentUser, 'configure_exam_rules');
  const canViewExams =
    hasPermission(currentUser, 'approve_exam_results') ||
    hasPermission(currentUser, 'enter_assigned_marks');
  const canAccessFinance = hasPermission(currentUser, 'access_accounting');
  const canAccessTeacherPortal =
    normalizeUserRole(currentUser.role) === 'Teacher' || isFullAdmin(currentUser.role);
  const canAccessRegistrar =
    currentUser.role === 'Registrar' || isFullAdmin(currentUser.role);
  const canManageStudents = hasPermission(currentUser, 'manage_students');
  const canManageAdmissions = hasPermission(currentUser, 'manage_admissions');
  const canMarkAttendance =
    hasPermission(currentUser, 'manage_all_attendance') ||
    hasPermission(currentUser, 'manage_assigned_attendance');
  const canManageTeacherAtt = hasPermission(currentUser, 'manage_teacher_attendance');
  const canManageDiscipline = hasPermission(currentUser, 'manage_discipline');
  const canManageDocuments = hasPermission(currentUser, 'manage_documents');
  const canViewReports = hasPermission(currentUser, 'view_school_reports');
  const canManageStaff = hasPermission(currentUser, 'manage_staff_roles');
  const canManageWebsite = hasPermission(currentUser, 'manage_website_content');
  const canManageGallery = hasPermission(currentUser, 'manage_gallery');
  const canManageNews = hasPermission(currentUser, 'manage_announcements');
  const canManageInquiries = hasPermission(currentUser, 'manage_inquiries');
  const canManageGmail = hasPermission(currentUser, 'manage_system_settings');
  const canViewAuditBackup =
    hasPermission(currentUser, 'view_audit_logs') || hasPermission(currentUser, 'manage_backups');

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">
      {/* Top Banner with Active Staff Persona */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SchoolLogo size="md" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-slate-900 dark:text-white font-display">
                Mugina Hope Academy Portal
              </h1>
              <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md border ${
                isFullAdmin(currentUser.role) ? 'bg-blue-100 text-blue-900 border-blue-300' :
                canAccessFinance ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                currentUser.role === 'Teacher' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                currentUser.role === 'Registrar' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                currentUser.role === 'DOS' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                'bg-slate-100 text-slate-900 border-slate-300'
              }`}>
                {getRoleDisplayLabel(currentUser.role)}
              </span>

              {isFullAdmin(currentUser.role) && (
                <button
                  type="button"
                  onClick={() => setShowPrincipalQueueModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                  <span>Principal Queue</span>
                  {paymentTransactions.filter((t) => t.status === 'Refund Requested').length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white font-mono text-[10px] font-black tabular-nums">
                      {paymentTransactions.filter((t) => t.status === 'Refund Requested').length}
                    </span>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Logged in as <strong>{currentUser.name}</strong> ({currentUser.username})
              {currentUser.assignedSubjectOrGrade && (
                <span> • Assigned: <strong>{currentUser.assignedSubjectOrGrade}</strong></span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 px-3 py-1.5 rounded-lg text-[11px]">
            <div className="w-2 h-2 rounded-full bg-emerald-600" />
            <span className="text-emerald-900 dark:text-emerald-200 font-mono text-[10px] truncate max-w-[160px] sm:max-w-none">
              {currentUser.email || currentUser.username}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleThemeMode}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle light or dark theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-2xs rounded-xl cursor-pointer transition-all"
            title="Return to the public school website"
          >
            View Public Site
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs border border-rose-700 transition-all cursor-pointer"
            title="Sign out of administrative session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Role-Based Dynamic Navigation Tabs (18 Complete SMS Modules) */}
      <div className="flex overflow-x-auto no-scrollbar scroll-smooth items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 text-xs font-semibold -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {canAccessFinance && (
          <button
            onClick={() => setActiveTab('finance')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-emerald-800 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Accounting &amp; Ledger Portal</span>
          </button>
        )}

        {canAccessTeacherPortal && (
          <button
            onClick={() => setActiveTab('teacher_classroom')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'teacher_classroom'
                ? 'bg-indigo-800 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span>My Classroom &amp; Streams</span>
          </button>
        )}

        {canAccessRegistrar && (
          <button
            onClick={() => setActiveTab('registrar')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'registrar'
                ? 'bg-purple-800 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4 text-purple-300" />
            <span>Admissions &amp; Enrollment Suite</span>
          </button>
        )}

        {canManageStudents && (
          <button
            onClick={() => setActiveTab('students')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'students' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="tabular-nums">Students &amp; Credentials ({studentList.length})</span>
          </button>
        )}

        {canManageAcademics && (
          <button
            onClick={() => setActiveTab('academics')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'academics' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Academics, Timetables &amp; Grading Formula</span>
          </button>
        )}

        {canViewExams && (
          <button
            onClick={() => setActiveTab('examinations')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'examinations' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Examinations &amp; Report Cards</span>
          </button>
        )}

        {canManageAdmissions && (
          <button
            onClick={() => setActiveTab('confirmations')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'confirmations' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-amber-400" />
            <span className="tabular-nums">Admissions &amp; Chat History ({applications.length})</span>
          </button>
        )}

        {canMarkAttendance && (
          <button
            onClick={() => setActiveTab('attendance')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'attendance' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-400" />
            <span>{currentUser.role === 'Teacher' ? 'Daily Class Attendance' : 'School Attendance Tracker'}</span>
          </button>
        )}

        {canManageTeacherAtt && (
          <button
            onClick={() => setActiveTab('teacher_attendance')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'teacher_attendance' ? 'bg-indigo-800 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Teacher Duty Roll-Call</span>
          </button>
        )}

        {canManageDiscipline && (
          <button
            onClick={() => setActiveTab('discipline')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'discipline' ? 'bg-rose-800 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-300" />
            <span>Discipline &amp; Conduct (DOD)</span>
          </button>
        )}

        {canManageDocuments && (
          <button
            onClick={() => setActiveTab('documents')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'documents' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-300" />
            <span className="tabular-nums">Registration Docs ({docList.length})</span>
          </button>
        )}

        {canViewReports && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'reports' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>Reports &amp; Analytics</span>
          </button>
        )}

        {canManageStaff && (
          <button
            onClick={() => setActiveTab('staff')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'staff' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span className="tabular-nums">Staff &amp; Roles ({staffList.length})</span>
          </button>
        )}

        {canManageWebsite && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Update Website Content</span>
          </button>
        )}

        {canManageGallery && (
          <button
            onClick={() => setActiveTab('gallery')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'gallery' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span className="tabular-nums">Gallery ({galleryItems.length})</span>
          </button>
        )}

        {canManageNews && (
          <button
            onClick={() => setActiveTab('news')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'news' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span className="tabular-nums">News ({announcements.length})</span>
          </button>
        )}

        {canManageInquiries && (
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'inquiries' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span className="tabular-nums">Inquiries ({inquiries.length})</span>
          </button>
        )}

        {canManageGmail && (
          <button
            onClick={() => setActiveTab('gmail')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'gmail' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Email &amp; Verification Logs</span>
          </button>
        )}

        {canViewAuditBackup && (
          <button
            onClick={() => setActiveTab('system_audit')}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'system_audit' ? 'bg-slate-900 text-amber-400 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Audit Logs, RBAC &amp; Backup</span>
          </button>
        )}
      </div>

      {activeTab === 'finance' && canAccessFinance && (
        <FinancePortal
          students={studentList}
          onTransactionsUpdated={() => setPaymentTransactions(getPaymentTransactions())}
        />
      )}

      {activeTab === 'teacher_classroom' && canAccessTeacherPortal && (
        <TeacherPortal
          students={studentList}
          onTakeAttendance={(gradeCode) => {
            setAttendancePreselectGrade(gradeCode);
            setActiveTab('attendance');
          }}
        />
      )}

      {activeTab === 'registrar' && canAccessRegistrar && (
        <RegistrarPortal
          students={studentList}
          onStudentsUpdated={() => setStudentList(getEnrolledStudents())}
        />
      )}

      {activeTab === 'academics' && canManageAcademics && (
        <AcademicManagementModule
          canConfigureExam={canConfigureExams}
          canManageFees={isFullAdmin(currentUser.role) || canAccessFinance}
        />
      )}

      {activeTab === 'examinations' && canViewExams && (
        <ExaminationsModule
          currentUser={currentUser}
          scopedToTeacher={normalizeUserRole(currentUser.role) === 'Teacher'}
        />
      )}

      {activeTab === 'reports' && canViewReports && <ReportsAnalyticsModule />}

      {activeTab === 'system_audit' && canViewAuditBackup && <SystemAuditAndBackupModule />}

      <PrincipalQueueModal
        isOpen={showPrincipalQueueModal}
        onClose={() => setShowPrincipalQueueModal(false)}
        onTransactionsUpdated={() => setPaymentTransactions(getPaymentTransactions())}
      />

      {/* ========================================================================= */}
      {/* TAB 1: STAFF ENROLLMENT (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && canManageStaff && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  Staff Directory: Roles, Credentials &amp; Access Control
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Add, control, activate/deactivate, and reset credentials for Teachers, DOS, DOD, Registrar, Finance &amp; Admin staff
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingStaffMember(null);
                  setStaffFormError(null);
                  setStaffFormData({
                    name: '',
                    role: 'Teacher',
                    email: '',
                    phone: '+250 78',
                    username: '',
                    password: '',
                    assignedSubjectOrGrade: '',
                    status: 'Active',
                  });
                  setShowAddStaffModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Enroll New Staff Member</span>
              </button>
            </div>

            {staffActionNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{staffActionNotice}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  placeholder="Search staff by name, email, username, or department..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={staffRoleFilter}
                onChange={(e) => setStaffRoleFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Roles ({staffList.length})</option>
                <option value="Teacher">Teachers</option>
                <option value="DOS">DOS (Director of Studies)</option>
                <option value="DOD">DOD (Director of Discipline)</option>
                <option value="Registrar">Registrars</option>
                <option value="Finance">Finance / Accountants</option>
                <option value="Admin">Administrators / Headteachers</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[780px] tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3.5">Staff Member</th>
                  <th className="p-3.5">Assigned Role</th>
                  <th className="p-3.5">Username &amp; Email</th>
                  <th className="p-3.5">Assigned Subject / Class</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {staffList
                  .filter((st) => {
                    if (staffRoleFilter !== 'ALL') {
                      if (staffRoleFilter === 'Admin' && !isFullAdmin(st.role)) return false;
                      if (staffRoleFilter === 'Finance' && st.role !== 'Finance' && st.role !== 'Accountant') return false;
                      if (staffRoleFilter !== 'Admin' && staffRoleFilter !== 'Finance' && st.role !== staffRoleFilter) return false;
                    }
                    if (staffSearchQuery.trim()) {
                      const q = staffSearchQuery.toLowerCase();
                      return (
                        st.name.toLowerCase().includes(q) ||
                        st.username.toLowerCase().includes(q) ||
                        (st.email || '').toLowerCase().includes(q) ||
                        (st.assignedSubjectOrGrade || '').toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 dark:text-white block">{st.name}</span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{st.phone}</span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] ${
                        isFullAdmin(st.role) ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                        st.role === 'Finance' || st.role === 'Accountant' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                        st.role === 'Teacher' ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' :
                        st.role === 'Registrar' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                        st.role === 'DOS' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                        st.role === 'DOD' ? 'bg-rose-100 text-rose-900 border border-rose-200' :
                        'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {getRoleDisplayLabel(st.role)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-blue-700 dark:text-sky-400 font-semibold block">{st.username}</span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 block">{st.email}</span>
                      {st.password || st.hasPassword || st.clientPasswordHash ? (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          Password Active
                        </span>
                      ) : (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                          No Password Set — Click Edit
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{st.assignedSubjectOrGrade || 'General School Duties'}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          st.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right flex items-center justify-end gap-1">
                      {!isFullAdmin(st.role) && (
                        <button
                          type="button"
                          onClick={() => handleToggleStaffStatus(st)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                            st.status === 'Active'
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
                          }`}
                          title={st.status === 'Active' ? 'Deactivate Staff Account' : 'Activate Staff Account'}
                        >
                          {st.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSendStaffPasswordReset(st)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Send Password Reset Email"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaffMember(st);
                          setStaffFormError(null);
                          setStaffFormData({
                            name: st.name,
                            role: st.role,
                            email: st.email,
                            phone: st.phone,
                            username: st.username,
                            password: '',
                            assignedSubjectOrGrade: st.assignedSubjectOrGrade || '',
                            status: st.status,
                          });
                          setShowAddStaffModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Staff Member & Role"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {!isFullAdmin(st.role) && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'staff', id: st.id, name: st.name })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Staff Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && canManageStudents && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Student Enrollment, Class Promotion &amp; Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage learner profiles, issue ID cards, promote classes in bulk, or import Word/PDF rosters
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student, ID, stream..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="w-full sm:w-48 min-h-[40px] pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
                />
              </div>

              <select
                value={studentGradeFilter}
                onChange={(e) => setStudentGradeFilter(e.target.value)}
                aria-label="Filter students by class"
                className="min-h-[40px] px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white"
              >
                <option value="ALL">All Classes ({studentList.length})</option>
                {ACADEMIC_GRADES.map((g) => (
                  <option key={g.code} value={g.code}>{g.code} — {g.name}</option>
                ))}
              </select>

              {selectedStudentIds.length > 0 && hasPermission(currentUser, 'promote_transfer_students') && (
                <button
                  type="button"
                  onClick={handleBulkPromoteSelected}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="tabular-nums">Promote Selected ({selectedStudentIds.length})</span>
                </button>
              )}

              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const { importedIds, importedFiles } = detectImportedStudentBatches(studentList);
                    setDeleteTarget({
                      type: 'student-batch',
                      id: 'selected-students',
                      name: `${selectedStudentIds.length} Selected Learner(s)`,
                      ids: selectedStudentIds,
                      batchScope: 'selected',
                      allIds: studentList.map((s) => s.id),
                      importedIds,
                      importedFiles,
                    });
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="tabular-nums">Delete Selected ({selectedStudentIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  let provisioned = 0;
                  for (const st of studentList) {
                    const needsUsername = !String(st.studentUsername || '').trim();
                    const hasAnyPw = Boolean(
                      String(st.studentPassword || '').trim() ||
                        st.hasPasswordHash ||
                        st.clientPasswordHash
                    );
                    const needsActive = st.studentAccountActive === undefined;
                    if (needsUsername || !hasAnyPw || needsActive) {
                      const slug = st.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
                      const patch: Partial<EnrolledStudent> = {};
                      if (needsUsername) {
                        patch.studentUsername = slug || st.regNumber.toLowerCase();
                      }
                      if (!hasAnyPw) {
                        patch.studentPassword = 'student@2026';
                      }
                      if (needsActive) {
                        patch.studentAccountActive = true;
                      }
                      updateEnrolledStudent(st.id, patch);
                      provisioned++;
                    }
                  }
                  await waitForCredentialSync();
                  setStudentList(getEnrolledStudents());
                  logAuditEvent('PROVISION', 'StudentAccount', 'batch', `Provisioned/verified ${provisioned} student login accounts`);
                  setDeleteSuccessMsg(
                    provisioned > 0
                      ? `Provisioned ${provisioned} student login account(s).`
                      : 'All enrolled students already have active portal credentials.'
                  );
                  setTimeout(() => setDeleteSuccessMsg(null), 4000);
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Ensure every enrolled student has a generated username & password"
              >
                <Key className="w-3.5 h-3.5 text-blue-700 dark:text-amber-400 shrink-0" />
                <span>Auto-Provision Accounts</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBulkStudentModal(true)}
                className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileUp className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Import Word / PDF</span>
              </button>

              {(() => {
                const { importedIds, importedFiles } = detectImportedStudentBatches(studentList);

                return (
                  <>
                    {importedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'student-batch',
                            id: 'imported-word-pdf',
                            name: `${importedIds.length} Imported Word/PDF Learner(s)`,
                            ids: importedIds,
                            batchScope: 'imported',
                            allIds: studentList.map((s) => s.id),
                            importedIds,
                            importedFiles,
                            selectedImportFile: importedFiles[0]?.fileName || '',
                            selectedGradeFilter: '',
                          })
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title="Delete learners imported from Word (.docx) or PDF (.pdf) lists"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="tabular-nums">Delete Imported Word/PDF ({importedIds.length})</span>
                      </button>
                    )}

                    {studentList.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'student-batch',
                            id: 'all-learners',
                            name: `All ${studentList.length} Enrolled Learner(s)`,
                            ids: studentList.map((s) => s.id),
                            batchScope: 'all',
                            allIds: studentList.map((s) => s.id),
                            importedIds,
                            importedFiles,
                            selectedImportFile: importedFiles[0]?.fileName || '',
                            selectedGradeFilter: '',
                          })
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title="Delete all learners or clear imported Word/PDF lists"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="tabular-nums">Delete All Learners ({studentList.length})</span>
                      </button>
                    )}
                  </>
                );
              })()}

              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setStudentFormData({
                    regNumber: `MHA-2026-${Math.floor(100 + Math.random() * 900)}`,
                    fullName: '',
                    gender: 'Female',
                    dob: '2017-05-10',
                    gradeCode: 'P4',
                    stream: 'A',
                    address: 'Mugina Sector, Kamonyi District',
                    admissionDate: new Date().toISOString().split('T')[0],
                    previousSchool: '',
                    photoUrl: '',
                    parentName: '',
                    parentPhone: '+250 78',
                    parentEmail: '',
                    studentUsername: '',
                    studentPassword: 'student@2026',
                    studentAccountActive: true,
                    status: 'Active',
                  });
                  setShowAddStudentModal(true);
                }}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Enroll Student</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[820px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all filtered students"
                      checked={filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudentIds.includes(s.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds(filteredStudents.map((s) => s.id));
                        } else {
                          setSelectedStudentIds([]);
                        }
                      }}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">Reg ID</th>
                  <th className="p-3.5">Learner Name &amp; Status</th>
                  <th className="p-3.5">Class / Stream</th>
                  <th className="p-3.5">Portal Credentials</th>
                  <th className="p-3.5">Guardian Contact</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(st.id)}
                        onChange={(e) => {
                          setSelectedStudentIds((prev) =>
                            e.target.checked ? [...prev, st.id] : prev.filter((id) => id !== st.id)
                          );
                        }}
                        aria-label={`Select ${st.fullName}`}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 font-mono font-bold text-blue-700 dark:text-sky-400 tabular-nums">{st.regNumber}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        {st.photoUrl ? (
                          <img src={st.photoUrl} alt={st.fullName} referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-amber-300 font-bold flex items-center justify-center shrink-0">
                            {st.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{st.fullName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {st.gender} · Status: <span className={st.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 font-semibold'}>{st.status}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-sm font-bold text-[10px]">
                        {st.gradeCode} {st.stream ? `· Stream ${st.stream}` : ''}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <div className="text-indigo-700 dark:text-indigo-300 font-semibold">
                        {st.studentUsername || st.regNumber}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {st.studentPassword
                          ? st.studentPassword
                          : st.hasPasswordHash || st.clientPasswordHash
                          ? '•••••• (Password Active)'
                          : 'No password set'}
                      </div>
                      <div className={`text-[10px] font-sans font-bold mt-0.5 ${st.studentAccountActive !== false ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        Login: {st.studentAccountActive !== false ? 'Active' : 'Deactivated'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{st.parentName}</div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {st.parentPhone} {st.parentEmail ? `· ${st.parentEmail}` : ''}
                      </div>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectedStudent(st)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-900 dark:text-amber-300 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          title="View Student Profile, History & Digital ID Card"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>ID / Profile</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextActive = st.studentAccountActive === false;
                            updateEnrolledStudent(st.id, { studentAccountActive: nextActive });
                            await waitForCredentialSync();
                            setStudentList(getEnrolledStudents());
                            logAuditEvent('UPDATE_ACCOUNT', 'Student', st.id, `${nextActive ? 'Activated' : 'Deactivated'} student portal account for ${st.fullName}`);
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border cursor-pointer ${
                            st.studentAccountActive !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title={st.studentAccountActive !== false ? 'Deactivate Student Portal Login' : 'Activate Student Portal Login'}
                        >
                          {st.studentAccountActive !== false ? 'Active' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordStudent(st);
                            setResetPasswordInput(st.studentPassword || '');
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Reset Student Portal Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudent(st);
                            setStudentFormData({
                              regNumber: st.regNumber,
                              fullName: st.fullName,
                              gender: st.gender,
                              dob: st.dob,
                              gradeCode: st.gradeCode,
                              stream: st.stream || 'A',
                              address: st.address || '',
                              admissionDate: st.admissionDate || '',
                              previousSchool: st.previousSchool || '',
                              photoUrl: st.photoUrl || '',
                              parentName: st.parentName,
                              parentPhone: st.parentPhone,
                              parentEmail: st.parentEmail || '',
                              studentUsername: st.studentUsername,
                              studentPassword: st.studentPassword,
                              studentAccountActive: st.studentAccountActive !== false,
                              status: st.status,
                            });
                            setShowAddStudentModal(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Edit Student Profile"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'student',
                              id: st.id,
                              name: `${st.fullName} (${st.regNumber})`,
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Student from Enrollment Roster"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REGISTRATION CONFIRMATIONS, ADMISSION CHARTS & APPLICANT CHATS */}
      {/* ========================================================================= */}
      {activeTab === 'confirmations' && canManageAdmissions && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Admissions Management, Analytics & Applicant Communications
                </h2>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                  Admin Action Console
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Track enrollment intake charts, confirm student applications, and chat directly with parents awaiting confirmation via Gmail
              </p>
            </div>

            {/* Sub-tab view toggle with distinct Charts, Chat History, and Applications views */}
            <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setConfirmationsSubTab('charts')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  confirmationsSubTab === 'charts'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Intake & Analytics Charts</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmationsSubTab('chats');
                  if (!activeChatRef && chatThreads.length > 0) {
                    setActiveChatRef(chatThreads[0].refCode);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  confirmationsSubTab === 'chats'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Applicant Chat History ({chatThreads.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmationsSubTab('applications')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  confirmationsSubTab === 'applications'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                <span>Applications ({applications.length})</span>
              </button>
            </div>
          </div>

          {/* 1. VISUAL ADMISSIONS ANALYTICS & INTAKE CHARTS (Rendered when 'charts' subtab is active) */}
          {confirmationsSubTab === 'charts' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-blue-700" />
                    <span>School Admissions & Intake Chart Analytics</span>
                  </h3>
                  <p className="text-xs text-slate-500">Live visual breakdowns generated from registration databases and learner records</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmationsSubTab('chats')}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                    <span>View Chat History ({chatThreads.length})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Chart 1: Admissions Pipeline Status Breakdown */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-blue-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Admissions Pipeline</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">{applications.length} Total</span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-amber-800">Pending Confirmation</span>
                        <span className="font-mono font-bold text-amber-900">
                          {applications.filter((a) => a.status === 'Pending Confirmation').length} ({applications.length > 0 ? Math.round((applications.filter((a) => a.status === 'Pending Confirmation').length / applications.length) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${applications.length > 0 ? (applications.filter((a) => a.status === 'Pending Confirmation').length / applications.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-emerald-800">Confirmed & Enrolled</span>
                        <span className="font-mono font-bold text-emerald-900">
                          {applications.filter((a) => a.status === 'Confirmed & Enrolled').length} ({applications.length > 0 ? Math.round((applications.filter((a) => a.status === 'Confirmed & Enrolled').length / applications.length) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${applications.length > 0 ? (applications.filter((a) => a.status === 'Confirmed & Enrolled').length / applications.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Direct Gmail automated notifications</span>
                    <span className="text-emerald-700 font-bold">Live Active</span>
                  </div>
                </div>

                {/* Chart 2: Grade Level Intake Demand Bar Chart */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-indigo-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Class Intake Demand</h3>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">
                      Nursery & Primary
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {['N-BABY', 'N-MID', 'N-TOP', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((gCode) => {
                      const count = applications.filter((a) => a.gradeCode === gCode).length;
                      const maxCount = Math.max(1, ...applications.map(() => 4));
                      return (
                        <div key={gCode} className="flex items-center gap-2 text-[11px]">
                          <span className="w-12 font-mono font-bold text-slate-600 shrink-0">{gCode}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-700 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <span className="w-5 text-right font-mono font-bold text-slate-700">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart 3: Campus Amenities Demand Chart (Lunch & Transport) */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Boarding & Amenities</h3>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">Service Requests</span>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-amber-950">Hot Nutritious Lunch</span>
                        <span className="font-mono font-bold text-amber-800">
                          {applications.filter((a) => a.wantsLunch).length} / {applications.length} pupils
                        </span>
                      </div>
                      <div className="h-2 w-full bg-amber-200/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-600 rounded-full"
                          style={{
                            width: `${applications.length > 0 ? (applications.filter((a) => a.wantsLunch).length / applications.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-2xl space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-blue-950">School Van Transport</span>
                        <span className="font-mono font-bold text-blue-800">
                          {applications.filter((a) => a.wantsTransport).length} / {applications.length} pupils
                        </span>
                      </div>
                      <div className="h-2 w-full bg-blue-200/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{
                            width: `${applications.length > 0 ? (applications.filter((a) => a.wantsTransport).length / applications.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Catering & van logistics coordinated at Mugina Police Station campus hub.
                  </p>
                </div>
              </div>

              {/* Chart 4: School Enrollment Demographics & Capacity Growth Overview */}
              <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 rounded-3xl text-white shadow-md border border-blue-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                    Growth Trends & Enrollment Health
                  </span>
                  <h4 className="text-base font-bold font-display">Learner Population & Attendance Distribution</h4>
                  <p className="text-xs text-slate-300 max-w-xl">
                    Official demographic balance across Nursery and Primary classes. All student records are synced live with backend database stores.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                    <span className="block text-xl font-black text-amber-300 font-mono">{studentList.length}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-300">Total Enrolled</span>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                    <span className="block text-xl font-black text-emerald-300 font-mono">
                      {studentList.filter((s) => s.gender === 'Female').length}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-300">Girls</span>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                    <span className="block text-xl font-black text-sky-300 font-mono">
                      {studentList.filter((s) => s.gender === 'Male').length}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-300">Boys</span>
                  </div>
                  <div className="p-3 bg-white/10 rounded-2xl border border-white/10 text-center">
                    <span className="block text-xl font-black text-purple-300 font-mono">98.4%</span>
                    <span className="text-[10px] uppercase font-bold text-slate-300">Avg Presence</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. SUB-TAB VIEW: APPLICATIONS LIST */}
          {confirmationsSubTab === 'applications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Registered Pupils Awaiting & Confirmed ({applications.length})
                </h3>
                <span className="text-xs text-slate-400">Click &ldquo;Chat with Parent&rdquo; or &ldquo;Review & Confirm&rdquo;</span>
              </div>

              {applications.map((app) => {
                const isPendingState =
                  app.status === 'Pending Confirmation' ||
                  app.status === 'Pending' ||
                  app.status === 'More Info Requested';
                return (
                <div
                  key={app.id}
                  className={`p-6 rounded-3xl border transition-all ${
                    isPendingState
                      ? 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900 shadow-2xs'
                      : app.status === 'Rejected'
                      ? 'bg-rose-50/30 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{app.studentName}</span>
                      <span className="text-xs font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 px-2 py-0.5 rounded-md font-bold">
                        {app.gradeCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          app.status === 'Confirmed & Enrolled' || app.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : app.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {app.status}
                      </span>
                      {app.verificationStatus && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            app.verificationStatus === 'Verified'
                              ? 'bg-emerald-700 text-white'
                              : app.verificationStatus === 'Pending Verification'
                              ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {app.verificationStatus}
                        </span>
                      )}
                      {app.emailDeliveryStatus && (
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Email: {app.emailDeliveryStatus}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-400">Ref: {app.refCode} · Submitted: {app.createdAt}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block">Parent / Guardian:</span>
                      <span>{app.parentName}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block">Parent Email:</span>
                      <span className="font-mono text-blue-700 dark:text-sky-400">{app.parentEmail || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block">Parent Phone:</span>
                      <span className="font-mono">{app.parentPhone}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block">Residence / Services:</span>
                      <span>{app.sector} · {app.wantsLunch ? 'Lunch' : 'No lunch'} · {app.wantsTransport ? 'Bus' : 'No bus'}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatRef(app.refCode);
                          setConfirmationsSubTab('chats');
                        }}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
                        <span>Chat with Parent</span>
                      </button>

                      {app.approvalDate && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Approved: {new Date(app.approvalDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isPendingState && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAppTarget(app);
                            setReviewAction('approve');
                            setReviewNotes('Your application meets our academic and age placement requirements.');
                            setReviewError(null);
                          }}
                          className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          <span>Review Application</span>
                        </button>
                      )}

                      {app.status !== 'Confirmed & Enrolled' && app.status !== 'Rejected' && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAppTarget(app);
                            setConfirmStudentUser(`stu.${app.studentName.toLowerCase().replace(/\s+/g, '')}`);
                            setConfirmStudentPass('mugina@2026');
                          }}
                          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Direct Enroll &amp; Assign ID
                        </button>
                      )}

                      {app.status === 'Confirmed & Enrolled' && (
                        <div className="text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <span>
                            Enrolled {app.confirmedAt ? `on ${app.confirmedAt}` : ''}. ID: <code>{app.assignedStudentId}</code>
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'application',
                            id: app.id,
                            name: `${app.studentName} (Ref: ${app.refCode})`,
                          })
                        }
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Application Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* 3. SUB-TAB VIEW: APPLICANT LIVE CHATS & DIRECT GMAIL DISPATCH CONSOLE */}
          {confirmationsSubTab === 'chats' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px] animate-in fade-in duration-150">
              {/* Left Column: Thread List */}
              <div className="md:col-span-4 border-r border-slate-200 flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Applicant Threads ({chatThreads.length})
                  </h4>
                  <button
                    onClick={fetchChatThreads}
                    className="p-1 text-slate-500 hover:text-slate-800 rounded-md transition-colors"
                    title="Refresh threads"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[540px]">
                  {chatThreads.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                      <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                      <p>No chat conversations initiated yet.</p>
                    </div>
                  ) : (
                    chatThreads.map((t) => {
                      const isSelected = activeChatRef === t.refCode;
                      const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
                      return (
                        <button
                          key={t.refCode}
                          type="button"
                          onClick={() => setActiveChatRef(t.refCode)}
                          className={`w-full text-left p-3.5 transition-colors block ${
                            isSelected ? 'bg-blue-50/70 border-l-4 border-blue-700' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">{t.studentName}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase ${
                                t.status === 'Confirmed & Enrolled'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {t.status === 'Confirmed & Enrolled' ? 'Confirmed' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                            {t.refCode} · {t.gradeCode} · Parent: {t.parentName}
                          </p>
                          {lastMsg && (
                            <p className="text-[11px] text-slate-600 italic mt-1 line-clamp-1">
                              &ldquo;{lastMsg.text}&rdquo;
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Active Conversation Thread */}
              <div className="md:col-span-8 flex flex-col justify-between bg-slate-50/30">
                {activeChatRef && chatThreads.find((t) => t.refCode === activeChatRef) ? (
                  (() => {
                    const currentThread = chatThreads.find((t) => t.refCode === activeChatRef)!;
                    const linkedApp = applications.find((a) => a.refCode === currentThread.refCode);
                    return (
                      <>
                        {/* Conversation Header */}
                        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">
                                {currentThread.studentName} ({currentThread.gradeCode})
                              </h4>
                              <span className="text-xs font-mono text-slate-500">Ref: {currentThread.refCode}</span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Parent: <strong>{currentThread.parentName}</strong> · Phone: {currentThread.parentPhone} · Gmail: <code>{currentThread.parentEmail || 'N/A'}</code>
                            </p>
                          </div>

                          {linkedApp && linkedApp.status === 'Pending Confirmation' && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmAppTarget(linkedApp);
                                setConfirmStudentUser(`stu.${linkedApp.studentName.toLowerCase().replace(/\s+/g, '')}`);
                                setConfirmStudentPass('mugina@2026');
                              }}
                              className="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
                            >
                              Review & Confirm
                            </button>
                          )}
                        </div>

                        {/* Messages Area */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 max-h-[440px]">
                          {currentThread.messages.map((m: any) => {
                            const isAdmin = m.sender === 'admin';
                            const isSystem = m.sender === 'system';

                            if (isSystem) {
                              return (
                                <div
                                  key={m.id}
                                  className="p-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs text-center border border-slate-200"
                                >
                                  <p className="font-semibold">{m.text}</p>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={m.id}
                                className={`flex gap-2.5 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                              >
                                {!isAdmin && (
                                  <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    P
                                  </div>
                                )}

                                <div
                                  className={`max-w-[80%] rounded-2xl p-3.5 space-y-1 shadow-2xs ${
                                    isAdmin
                                      ? 'bg-blue-900 text-white'
                                      : 'bg-white text-slate-900 border border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3 text-[10px] opacity-80">
                                    <span className="font-bold">{m.senderName}</span>
                                    <span className="font-mono">
                                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                    {m.text}
                                  </p>
                                </div>

                                {isAdmin && (
                                  <div className="w-8 h-8 rounded-full bg-blue-950 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    NM
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Reply Form (Emails Parent Automatically) */}
                        <div className="p-4 bg-white border-t border-slate-200">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendAdminReply(currentThread.refCode);
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              value={adminReplyText}
                              onChange={(e) => setAdminReplyText(e.target.value)}
                              placeholder={`Type response to ${currentThread.parentName || 'parent'} (dispatches to their Gmail)...`}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="submit"
                              disabled={isSendingReply || !adminReplyText.trim()}
                              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                            >
                              {isSendingReply ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Send & Email Parent</span>
                                </>
                              )}
                            </button>
                          </form>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-600" />
                            <span>
                              Your message automatically sends an email to <code>{currentThread.parentEmail || 'the parent’s Gmail'}</code>.
                            </span>
                          </p>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                    <h5 className="text-sm font-bold text-slate-600">No Thread Selected</h5>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Select an applicant from the left list to read messages and reply directly via parent Gmail.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STUDENT ATTENDANCE TRACKER & PARENT GMAIL ALERT */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && canMarkAttendance && (
        <AdminAttendanceTracker
          initialGrade={attendancePreselectGrade}
          allowedGrades={
            normalizeUserRole(currentUser?.role) === 'Teacher'
              ? (() => {
                  const matrix = getTeacherAssignments()
                    .filter(
                      (a) =>
                        (currentUser?.id && a.teacherId === currentUser.id) ||
                        (currentUser?.name && a.teacherName.toLowerCase() === currentUser.name.toLowerCase())
                    )
                    .map((a) => a.gradeCode);
                  const fromProfile = extractGradesFromAssignment(currentUser?.assignedSubjectOrGrade);
                  const combined = Array.from(new Set([...matrix, ...fromProfile]));
                  return combined.length > 0 ? combined : ['P1', 'P4'];
                })()
              : undefined
          }
          onRecordSaved={() => setStudentList(getEnrolledStudents())}
        />
      )}

      {activeTab === 'teacher_attendance' && canManageTeacherAtt && (
        <TeacherAttendanceTracker staffList={staffList} />
      )}

      {activeTab === 'discipline' && canManageDiscipline && (
        <DODDisciplinePortal students={studentList} />
      )}

      {/* ========================================================================= */}
      {/* TAB: REQUIRED REGISTRATION DOCUMENTATION (ADMIN & DOS SETTINGS) */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && canManageDocuments && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Required Registration Documentation Checklist
                </h2>
                <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                  Admin & DOS Configuration
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Set and manage required enrollment documents. New or modified requirements appear live on the public Admissions page and application form.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingDoc(null);
                setDocFormData({
                  title: '',
                  description: '',
                  isRequired: true,
                  applicableGrades: 'All Grades (Nursery & Primary)',
                  formatHint: '',
                  fileUrl: '',
                  fileName: '',
                  fileSize: '',
                  fileType: '',
                });
                setShowDocModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Registration Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docList.map((doc, idx) => (
              <div key={doc.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      doc.isRequired ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {doc.isRequired ? 'Mandatory' : 'Optional'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{doc.description}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md">
                      Grades: {doc.applicableGrades}
                    </span>
                    {doc.formatHint && (
                      <span className="text-slate-500 italic">
                        Format: {doc.formatHint}
                      </span>
                    )}
                  </div>

                  {/* Firebase Storage Document File Attachment */}
                  {doc.fileUrl ? (
                    <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-950 truncate">
                            {doc.fileName || 'Official School Form'}
                          </p>
                          <p className="text-[10px] text-emerald-700 flex items-center gap-1.5">
                            <span>{doc.fileSize || 'PDF Document'}</span>
                            <span>•</span>
                            <span className="font-semibold text-emerald-800">Stored on Firebase Storage</span>
                          </p>
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ) : (
                    <div className="mt-3 p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-between text-[11px] text-slate-500">
                      <span>No document file attached</span>
                      <span className="text-[10px] text-blue-600 font-semibold">Click Edit to upload to Firebase</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingDoc(doc);
                      setSelectedDocFile(null);
                      setDocUploadStatus(
                        doc.fileUrl ? `Current file: ${doc.fileName || 'Attached document'} (${doc.fileSize || 'Stored on Firebase'})` : ''
                      );
                      setDocFormData({
                        title: doc.title,
                        description: doc.description,
                        isRequired: doc.isRequired,
                        applicableGrades: doc.applicableGrades,
                        formatHint: doc.formatHint || '',
                        fileUrl: doc.fileUrl || '',
                        fileName: doc.fileName || '',
                        fileSize: doc.fileSize || '',
                        fileType: doc.fileType || '',
                      });
                      setShowDocModal(true);
                    }}
                    className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1 text-xs font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Requirement</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SCHOOL IMAGES & GALLERY MANAGER (UPLOAD & FIREBASE STORAGE) */}
      {/* ========================================================================= */}
      {activeTab === 'gallery' && canManageGallery && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                School Images & Gallery Manager
              </h2>
              <p className="text-xs text-slate-500">
                Upload new photos directly from your device or manage school assets. Images update live in the public gallery.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingImageItem(null);
                setImageFormData({ title: '', category: 'outdoor', description: '', caption: '', altText: '', imageSrc: '' });
                setShowAddImageModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span>Upload New School Image</span>
            </button>
          </div>

          {/* Gallery Items Grid */}
          {galleryItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Gallery Is Empty</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Deleted photos remain permanently removed across page refreshes and visitor browsers until you upload new campus images.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingImageItem(null);
                  setImageFormData({ title: '', category: 'outdoor', description: '', caption: '', altText: '', imageSrc: '' });
                  setShowAddImageModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-amber-400" />
                <span>Upload First School Image</span>
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    <img
                      src={item.imageSrc}
                      alt={item.title}
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
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase bg-slate-900/80 text-white px-2 py-0.5 rounded-sm">
                      {item.category}
                    </span>
                    {item.altText && (
                      <span className="absolute bottom-2.5 left-2.5 text-[9px] font-semibold bg-slate-900/85 text-emerald-300 backdrop-blur-xs px-2 py-0.5 rounded-sm max-w-[180px] truncate">
                        Alt: {item.altText}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    {item.altText && (
                      <p className="text-[11px] text-blue-800 bg-blue-50/80 px-2 py-0.5 rounded-sm font-mono truncate">
                        Alt: {item.altText}
                      </p>
                    )}
                    <ReadMoreText
                      text={item.description}
                      maxChars={88}
                      paragraphClassName="text-xs text-slate-500 leading-relaxed"
                      readMoreLabel="Read More"
                      showLessLabel="Show Less"
                    />
                    <p className="text-[11px] text-slate-400 italic mt-1">{item.caption}</p>
                  </div>
                </div>

                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">ID: {item.id}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingImageItem(item);
                        setImageFormData({
                          title: item.title,
                          category: item.category,
                          description: item.description,
                          caption: item.caption,
                          altText: item.altText || item.title,
                          imageSrc: item.imageSrc,
                        });
                        setShowAddImageModal(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                      title="Edit Image Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'gallery',
                          id: item.id,
                          name: item.title,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: NEWS & ANNOUNCEMENTS (FULL CRUD & EDIT) */}
      {/* ========================================================================= */}
      {activeTab === 'news' && canManageNews && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Website News & Public Announcements
              </h2>
              <p className="text-xs text-slate-500">
                Add, edit, or toggle marquee news alerts displayed on the top of the school website
              </p>
            </div>
            <button
              onClick={() => {
                setEditingNewsItem(null);
                setNewsFormData({ title: '', content: '', badge: 'Admissions Alert', isActive: true });
                setShowNewsModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Announcement</span>
            </button>
          </div>

          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md uppercase">
                      {ann.badge || 'News'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ann.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {ann.isActive ? 'Live on Website' : 'Draft / Inactive'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <ReadMoreText
                    text={ann.content}
                    maxChars={150}
                    paragraphClassName="text-xs text-slate-600 leading-relaxed"
                    readMoreLabel="Read More"
                    showLessLabel="Show Less"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">Published: {ann.publishedAt}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingNewsItem(ann);
                        setNewsFormData({
                          title: ann.title,
                          content: ann.content,
                          badge: ann.badge || 'Announcement',
                          isActive: ann.isActive,
                        });
                        setShowNewsModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200"
                    >
                      Edit Announcement
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'news',
                          id: ann.id,
                          name: ann.title,
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: INCOMING INQUIRIES & CONTACT MESSAGES */}
      {/* ========================================================================= */}
      {activeTab === 'inquiries' && canManageInquiries && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Contact Inquiries from Website
              </h2>
              <p className="text-xs text-slate-500">
                Inquiries forwarded automatically to official Gmail ({adminEmail})
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">Total: {inquiries.length}</span>
          </div>

          <div className="space-y-4">
            {inquiries.map((inq) => (
              <div key={inq.id} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{inq.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inq.status === 'Replied'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inq.status === 'Closed'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {inq.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{inq.createdAt}</span>
                    {inq.status !== 'Replied' && (
                      <button
                        type="button"
                        onClick={() => {
                          updateInquiryStatus(inq.id, 'Replied');
                          setInquiries(getInquiries());
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Mark Contacted
                      </button>
                    )}
                    {inq.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => {
                          updateInquiryStatus(inq.id, 'Closed');
                          setInquiries(getInquiries());
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Close Inquiry
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                  <div><strong>Phone:</strong> {inq.phone}</div>
                  <div><strong>Email:</strong> {inq.email || 'N/A'}</div>
                  <div><strong>Subject:</strong> {inq.subject}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700">{inq.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: GMAIL DELIVERY LOGS, ADMISSION VERIFICATIONS & TEMPLATES */}
      {/* ========================================================================= */}
      {activeTab === 'gmail' && canManageGmail && (
        <AdminEmailNotificationsModule
          adminEmail={adminEmail}
          onUpdateAdminEmail={setAdminEmail}
          applications={applications}
          onRefreshApplications={async () => {
            const synced = await syncServerApplications();
            setApplications(synced);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB: UPDATE WEBSITE CONTENT & SCHOOL LOGO */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && canManageWebsite && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-sky-100 text-sky-800">
                  <Globe className="w-5 h-5" />
                </span>
                <h2 className="text-xl font-bold text-slate-900 font-display">
                  Update Public Website Content & School Logo
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Change official school logo, names, mottos, contact numbers, email, tuition fees, and homepage text. All updates are saved automatically and appear for all visitors.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Live Website</span>
            </button>
          </div>

          {websiteSettingsSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-emerald-950">
                  <strong className="block font-bold">School Logo & Website Updated Successfully!</strong>
                  <span>Your changes have been saved and are now live for all visitors.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                View Live
              </button>
            </div>
          )}

          {/* School Logo & Emblem Customizer */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Official School Logo & Crest Customization</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Customize the official logo shown on top navigation bars, search queries, application receipts, and printable badges.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                Live & Synchronized
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Logo Previews */}
              <div className="md:col-span-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Live Logo Preview</span>
                <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-100 flex items-center justify-center">
                  <SchoolLogo size="lg" customLogoUrl={websiteSettings.schoolLogoUrl} />
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-900">
                    {websiteSettings.schoolLogoUrl ? 'Custom School Logo Active' : 'Official Crest Emblem Active'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {websiteSettings.schoolLogoUrl ? 'Custom Image Stored' : 'Mugina Hope Golden Sun & Crest'}
                  </p>
                </div>
              </div>

              {/* Logo Controls */}
              <div className="md:col-span-8 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Upload New School Logo File (PNG, JPG, SVG, WebP)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const uploadRes = await uploadSchoolAsset(file, 'official_school_logo', 'branding');
                          const finalUrl = uploadRes.url;
                          const latest = getWebsiteSettings();
                          const updated = { ...latest, ...websiteSettings, schoolLogoUrl: finalUrl };
                          setWebsiteSettings(updated);
                          await saveWebsiteSettings(updated);
                          setWebsiteSettingsSuccess(true);
                          setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                        } catch (err) {
                          console.warn('Logo upload error:', err);
                        }
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-900 file:text-white hover:file:bg-blue-950 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Upload your school logo image. It is saved to cloud storage and synced automatically across all visitor browsers and devices.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Or Enter Direct Logo Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/school-logo.png"
                    value={websiteSettings.schoolLogoUrl || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, schoolLogoUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await saveWebsiteSettings(websiteSettings);
                      setWebsiteSettingsSuccess(true);
                      setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                    }}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save School Logo</span>
                  </button>
                  {websiteSettings.schoolLogoUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = { ...websiteSettings, schoolLogoUrl: '' };
                        setWebsiteSettings(updated);
                        await saveWebsiteSettings(updated);
                        setWebsiteSettingsSuccess(true);
                        setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Reset to Default Crest
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveWebsiteSettings} className="space-y-6">
            {/* 1. School Identity & Branding */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>1. School Identity & Official Names</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Defines how the academy appears in the header, footer, admissions letters, and printable forms.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Official Full School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.schoolName}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, schoolName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Short Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.shortName}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, shortName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Motto (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.motto}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, motto: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Motto (Kinyarwanda) *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.mottoKinyarwanda}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, mottoKinyarwanda: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Welcome / Headteacher Message (Shown on Public Homepage & About Us)
                  </label>
                  <textarea
                    rows={3}
                    value={websiteSettings.welcomeMessage}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, welcomeMessage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* 2. Top Banner Announcements & Term Notices */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <span>2. Top Announcement Bar & Admissions Notices</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Displayed at the very top of all pages and in the Admissions header.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Top Website Announcement Bar Text
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.announcementBarText || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, announcementBarText: e.target.value })}
                    placeholder="e.g. Term 1 2026 Admissions Open · Nursery & Primary Excellence in Kamonyi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Current Academic Term Dates & Schedule
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.termDatesNotice || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, termDatesNotice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Registration & Application Fee Notice
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.registrationFeeNotice || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, registrationFeeNotice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 3. Official Contact Numbers, Emails & Physical Address */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  <span>3. Official Contact Details & Physical Location</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Powers the click-to-call buttons, WhatsApp links, contact page, and map directions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={websiteSettings.phone}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Official School Email (Admin Gmail) *
                  </label>
                  <input
                    type="email"
                    required
                    value={websiteSettings.officialEmail}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, officialEmail: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Admissions Desk Email
                  </label>
                  <input
                    type="email"
                    value={websiteSettings.admissionsEmail}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, admissionsEmail: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Landmark / Security Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.landmark}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, landmark: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Physical Campus Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={websiteSettings.fullAddress}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, fullAddress: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 4. Tuition & Fee Schedule */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>4. School Fees & Tuition Structure (Publicly Displayed)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Displayed on the admissions page and fee estimator for prospective parents.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nursery Tuition Fee (Per Term)
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.nurseryTuition || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, nurseryTuition: e.target.value })}
                    placeholder="e.g. 45,000 RWF / Term"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Primary Tuition Fee (Per Term)
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.primaryTuition || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, primaryTuition: e.target.value })}
                    placeholder="e.g. 60,000 RWF / Term"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Lunch & Hot Porridge Fee
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.lunchFee || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, lunchFee: e.target.value })}
                    placeholder="e.g. 25,000 RWF / Term"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Bus Transport Pickup Fee
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.transportFee || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, transportFee: e.target.value })}
                    placeholder="e.g. 30,000 RWF / Term"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 5. Public Homepage Hero Section */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>5. Public Homepage Hero Section</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Customizes the main headline and introduction displayed on the home page.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Homepage Hero Main Headline
                  </label>
                  <input
                    type="text"
                    value={websiteSettings.heroHeadline || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, heroHeadline: e.target.value })}
                    placeholder="e.g. Welcome to Mugina Hope Primary & Nursery Academy"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Homepage Hero Subtitle / Tagline
                  </label>
                  <textarea
                    rows={2}
                    value={websiteSettings.heroTagline || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, heroTagline: e.target.value })}
                    placeholder="e.g. Nurturing purposeful, confident, and compassionate young leaders in Kamonyi District since 2014."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* 5B. Homepage: School Manager & Administration Message (Leadership Card) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-700" />
                    <span>5B. Homepage: School Manager & Administration Leadership Message</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize the School Manager’s portrait image, name, title, administration greeting, and core institutional checkpoints shown on the Homepage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View on Homepage</span>
                </button>
              </div>

              {/* School Manager Image Management */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                    School Manager Portrait Image
                  </h4>
                  {websiteSettings.schoolManagerPhotoUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        const updatedShowcase = Array.isArray(websiteSettings.staffShowcase)
                          ? websiteSettings.staffShowcase.map((m) =>
                              m.id === 'staff-lead-1' || m.role.toLowerCase().includes('manager')
                                ? { ...m, imageUrl: '' }
                                : m
                            )
                          : websiteSettings.staffShowcase;
                        const updated = {
                          ...websiteSettings,
                          schoolManagerPhotoUrl: '',
                          ...(updatedShowcase ? { staffShowcase: updatedShowcase } : {}),
                        };
                        setWebsiteSettings(updated);
                        await saveWebsiteSettings(updated);
                        setWebsiteSettingsSuccess(true);
                        setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                      }}
                      className="cursor-pointer text-rose-600 hover:text-rose-800 text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove / Clear Image</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 text-center">
                    {websiteSettings.schoolManagerPhotoUrl ? (
                      <img
                        src={websiteSettings.schoolManagerPhotoUrl}
                        alt="School Manager Portrait"
                        referrerPolicy="no-referrer"
                        className="w-28 h-28 object-cover rounded-xl shadow-xs border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 p-2">
                        <GraduationCap className="w-8 h-8 text-slate-300 mb-1" />
                        <span className="text-[10px] text-center leading-tight">No Image Set</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-bold mt-2">Active Manager Photo</span>
                  </div>

                  <div className="md:col-span-9 space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Upload School Manager Image from Device (PNG, JPG, WebP)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const uploadRes = await uploadSchoolAsset(file, 'school_manager_portrait', 'branding');
                              const latest = getWebsiteSettings();
                              const base = { ...latest, ...websiteSettings };
                              const updatedShowcase = Array.isArray(base.staffShowcase)
                                ? base.staffShowcase.map((m) =>
                                    m.id === 'staff-lead-1' || m.role.toLowerCase().includes('manager')
                                      ? { ...m, imageUrl: uploadRes.url }
                                      : m
                                  )
                                : base.staffShowcase;
                              const updated = {
                                ...base,
                                schoolManagerPhotoUrl: uploadRes.url,
                                ...(updatedShowcase ? { staffShowcase: updatedShowcase } : {}),
                              };
                              setWebsiteSettings(updated);
                              await saveWebsiteSettings(updated);
                              setWebsiteSettingsSuccess(true);
                              setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                            } catch (err) {
                              console.warn('School manager image upload error:', err);
                            }
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Or Enter Direct Image URL
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.schoolManagerPhotoUrl || ''}
                        onChange={(e) =>
                          setWebsiteSettings({ ...websiteSettings, schoolManagerPhotoUrl: e.target.value })
                        }
                        placeholder="https://... or /images/..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Accessibility Alt-Text (SEO & Screen Readers) *
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.schoolManagerAlt || ''}
                        onChange={(e) =>
                          setWebsiteSettings({ ...websiteSettings, schoolManagerAlt: e.target.value })
                        }
                        placeholder="e.g. HAKIZIMANA Protais - School Manager at Mugina Hope Primary School"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Manager Name, Role & Message Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">School Manager Full Name *</label>
                  <input
                    type="text"
                    value={websiteSettings.schoolManagerName || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, schoolManagerName: e.target.value })
                    }
                    placeholder="e.g. HAKIZIMANA Protais"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Manager Role / Designation *</label>
                  <input
                    type="text"
                    value={websiteSettings.schoolManagerRole || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, schoolManagerRole: e.target.value })
                    }
                    placeholder="e.g. School Manager & Administrative Head"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section Subtitle / Kicker</label>
                  <input
                    type="text"
                    value={websiteSettings.adminMessageKicker || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, adminMessageKicker: e.target.value })
                    }
                    placeholder="e.g. Message from the Administration"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 uppercase font-semibold text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section Main Headline *</label>
                  <input
                    type="text"
                    value={websiteSettings.adminMessageHeading || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, adminMessageHeading: e.target.value })
                    }
                    placeholder="e.g. Providing a Strong Foundation for Every Child in Kamonyi"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Message Body - Paragraph 1 *</label>
                  <textarea
                    rows={2}
                    value={websiteSettings.adminMessageParagraph1 || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, adminMessageParagraph1: e.target.value })
                    }
                    placeholder="Established in 2014, Mugina Hope Academy was founded on a simple conviction..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Message Body - Paragraph 2</label>
                  <textarea
                    rows={2}
                    value={websiteSettings.adminMessageParagraph2 || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, adminMessageParagraph2: e.target.value })
                    }
                    placeholder="Operating directly under the guidance of the Rwanda Ministry of Education (MINEDUC)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">School Motto Banner Text</label>
                  <input
                    type="text"
                    value={websiteSettings.adminMessageMotto || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, adminMessageMotto: e.target.value })
                    }
                    placeholder="e.g. Nurturing Minds, Building Character, Inspiring Hope."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 italic"
                  />
                </div>
              </div>
            </div>

            {/* 6. Public About Page: Principal Message, School Vision & Rwandan Values Charter (Screenshots 1 & 2) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-700" />
                    <span>6. Public About Page: Principal Message, Vision & Rwandan Charter</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize the Principal’s photo and welcome letter, School Vision, Mission bullet points, and the Rwandan Values Charter board shown on the About page.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View About Page</span>
                </button>
              </div>

              {/* Sub-section A: Principal Portrait & Welcome Message (Screenshot 1) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                    Head of School Letter &amp; Portrait
                  </h4>
                  <div className="flex items-center gap-2">
                    {websiteSettings.aboutPrincipalPhotoUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...websiteSettings, aboutPrincipalPhotoUrl: '' };
                          setWebsiteSettings(updated);
                          await saveWebsiteSettings(updated);
                          setWebsiteSettingsSuccess(true);
                          setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                        }}
                        className="cursor-pointer text-rose-600 hover:text-rose-800 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove / Clear Image</span>
                      </button>
                    )}
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                      Official Message Card
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-3 flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200 text-center">
                    {websiteSettings.aboutPrincipalPhotoUrl ? (
                      <img
                        src={websiteSettings.aboutPrincipalPhotoUrl}
                        alt="Head of School Portrait"
                        referrerPolicy="no-referrer"
                        className="w-24 h-28 object-cover rounded-xl shadow-xs border border-slate-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-24 h-28 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 p-2">
                        <GraduationCap className="w-8 h-8 text-slate-300 mb-1" />
                        <span className="text-[10px] text-center leading-tight">No Image Set</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-bold mt-2">Active Portrait</span>
                  </div>

                  <div className="md:col-span-9 space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Upload New Principal Portrait Photo (PNG, JPG, WebP)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const uploadRes = await uploadSchoolAsset(file, 'principal_headmaster_portrait', 'branding');
                              const updated = {
                                ...getWebsiteSettings(),
                                ...websiteSettings,
                                aboutPrincipalPhotoUrl: uploadRes.url,
                              };
                              setWebsiteSettings(updated);
                              await saveWebsiteSettings(updated);
                              setWebsiteSettingsSuccess(true);
                              setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                            } catch (err) {
                              console.warn('Principal portrait upload error:', err);
                            }
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Or Enter Direct Image URL
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.aboutPrincipalPhotoUrl || ''}
                        onChange={(e) =>
                          setWebsiteSettings({ ...websiteSettings, aboutPrincipalPhotoUrl: e.target.value })
                        }
                        placeholder="e.g. /images/principal_headmaster_portrait.png"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kicker Label (Blue Uppercase Headline)
                    </label>
                    <input
                      type="text"
                      value={websiteSettings.aboutPrincipalKicker || ''}
                      onChange={(e) =>
                        setWebsiteSettings({ ...websiteSettings, aboutPrincipalKicker: e.target.value })
                      }
                      placeholder="e.g. MESSAGE FROM THE HEAD OF SCHOOL"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Welcome Title
                    </label>
                    <input
                      type="text"
                      value={websiteSettings.aboutPrincipalWelcome || ''}
                      onChange={(e) =>
                        setWebsiteSettings({ ...websiteSettings, aboutPrincipalWelcome: e.target.value })
                      }
                      placeholder="e.g. Welcome to Mugina Hope Primary & Nursery Academy!"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-bold text-slate-700 mb-1">
                    Principal Letter Text (Leave an empty line between paragraphs)
                  </label>
                  <textarea
                    rows={6}
                    value={websiteSettings.aboutPrincipalMessage || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, aboutPrincipalMessage: e.target.value })
                    }
                    placeholder="Enter the official message from the school head..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Sign-off Greeting</label>
                    <input
                      type="text"
                      value={websiteSettings.aboutPrincipalSignoff || ''}
                      onChange={(e) =>
                        setWebsiteSettings({ ...websiteSettings, aboutPrincipalSignoff: e.target.value })
                      }
                      placeholder="e.g. Sincerely and with warm regards,"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Head of School Name</label>
                    <input
                      type="text"
                      value={websiteSettings.aboutPrincipalName || ''}
                      onChange={(e) =>
                        setWebsiteSettings({ ...websiteSettings, aboutPrincipalName: e.target.value })
                      }
                      placeholder="e.g. Norbert Ihimbazwe Manzi"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Designation / Role Title</label>
                    <input
                      type="text"
                      value={websiteSettings.aboutPrincipalTitle || ''}
                      onChange={(e) =>
                        setWebsiteSettings({ ...websiteSettings, aboutPrincipalTitle: e.target.value })
                      }
                      placeholder="e.g. Head of School & Chief Administrator, Mugina Hope Academy"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-section B: School Vision, Mission & Values Charter (Screenshot 2) */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs">
                    School Vision, Mission & Rwandan Values Charter (Screenshot 2)
                  </h4>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full">
                    Vision & Charter Board
                  </span>
                </div>

                <div className="text-xs">
                  <label className="block font-bold text-slate-700 mb-1">
                    School Vision Text
                  </label>
                  <textarea
                    rows={2}
                    value={websiteSettings.aboutVisionText || ''}
                    onChange={(e) =>
                      setWebsiteSettings({ ...websiteSettings, aboutVisionText: e.target.value })
                    }
                    placeholder="Enter school vision..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 leading-relaxed"
                  />
                </div>

                <div className="text-xs">
                  <label className="block font-bold text-slate-700 mb-1">
                    School Mission Points (Enter one bullet point per line)
                  </label>
                  <textarea
                    rows={4}
                    value={(websiteSettings.aboutMissionPoints || []).join('\n')}
                    onChange={(e) => {
                      const points = e.target.value.split('\n');
                      setWebsiteSettings({ ...websiteSettings, aboutMissionPoints: points });
                    }}
                    placeholder="Deliver high-quality REB curriculum...&#10;Nurture Christian integrity and cultural pride...&#10;Equip learners with digital literacy..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-4 p-2 bg-white rounded-xl border border-slate-200 flex justify-center">
                    <img
                      src={websiteSettings.aboutValuesBannerUrl || '/images/hero_mugina_hope_campus_1791823254957.jpg'}
                      alt="Campus Visual Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-36 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                      }}
                    />
                  </div>

                  <div className="md:col-span-8 space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Upload Custom Values Charter Graphic / Poster
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const uploadRes = await uploadSchoolAsset(file, 'rwanda_values_charter_board', 'branding');
                              const updated = {
                                ...getWebsiteSettings(),
                                ...websiteSettings,
                                aboutValuesBannerUrl: uploadRes.url,
                              };
                              setWebsiteSettings(updated);
                              await saveWebsiteSettings(updated);
                              setWebsiteSettingsSuccess(true);
                              setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                            } catch (err) {
                              console.warn('Charter upload error:', err);
                            }
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Or Direct Charter Image URL
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.aboutValuesBannerUrl || ''}
                        onChange={(e) =>
                          setWebsiteSettings({ ...websiteSettings, aboutValuesBannerUrl: e.target.value })
                        }
                        placeholder="e.g. /images/rwanda_school_values_charter.png"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. School Staff Leadership Showcase (Matching esr.PNG) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-700" />
                    <span>7. School Staff Leadership Showcase</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure the key school leadership team members displayed across the website (Head Teacher, DoS, DoD, Bursar).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const current = websiteSettings.staffShowcase || [];
                    const newMember = {
                      id: `staff-${Date.now()}`,
                      name: 'New Staff Member',
                      role: 'Teacher / Staff',
                      email: 'staff@muginahopeschool.com',
                      phone: '+250 788 000 000',
                      imageUrl: '',
                      order: current.length + 1,
                    };
                    setWebsiteSettings({
                      ...websiteSettings,
                      staffShowcase: [...current, newMember],
                    });
                  }}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff Member</span>
                </button>
              </div>

              <div className="space-y-4">
                {(websiteSettings.staffShowcase || []).map((staff, sIdx) => (
                  <div
                    key={staff.id || sIdx}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Staff #{sIdx + 1}: {staff.name}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const updatedShowcase = (websiteSettings.staffShowcase || []).filter((_, i) => i !== sIdx);
                          const updated = { ...websiteSettings, staffShowcase: updatedShowcase };
                          setWebsiteSettings(updated);
                          await saveWebsiteSettings(updated);
                          setWebsiteSettingsSuccess(true);
                          setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                        }}
                        className="cursor-pointer text-rose-600 hover:text-rose-800 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={staff.name}
                          onChange={(e) => {
                            const updated = [...(websiteSettings.staffShowcase || [])];
                            updated[sIdx] = { ...updated[sIdx], name: e.target.value };
                            setWebsiteSettings({ ...websiteSettings, staffShowcase: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Role / Position</label>
                        <input
                          type="text"
                          value={staff.role}
                          onChange={(e) => {
                            const updated = [...(websiteSettings.staffShowcase || [])];
                            updated[sIdx] = { ...updated[sIdx], role: e.target.value };
                            setWebsiteSettings({ ...websiteSettings, staffShowcase: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={staff.email || ''}
                          onChange={(e) => {
                            const updated = [...(websiteSettings.staffShowcase || [])];
                            updated[sIdx] = { ...updated[sIdx], email: e.target.value };
                            setWebsiteSettings({ ...websiteSettings, staffShowcase: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Phone</label>
                        <input
                          type="text"
                          value={staff.phone || ''}
                          onChange={(e) => {
                            const updated = [...(websiteSettings.staffShowcase || [])];
                            updated[sIdx] = { ...updated[sIdx], phone: e.target.value };
                            setWebsiteSettings({ ...websiteSettings, staffShowcase: updated });
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                      <div className="sm:col-span-2 flex items-center gap-2">
                        {staff.imageUrl ? (
                          <img
                            src={staff.imageUrl}
                            alt={staff.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#003380]"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-950 text-amber-300 font-bold text-xs flex items-center justify-center border-2 border-slate-300 shrink-0">
                            {(staff.name || 'ST').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 font-medium">Avatar</span>
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const uploadRes = await uploadSchoolAsset(file, `staff_${staff.id}`, 'branding');
                                const base = { ...getWebsiteSettings(), ...websiteSettings };
                                const updatedShowcase = [...(base.staffShowcase || [])];
                                updatedShowcase[sIdx] = { ...updatedShowcase[sIdx], imageUrl: uploadRes.url };
                                const isMgr = updatedShowcase[sIdx]?.id === 'staff-lead-1' || updatedShowcase[sIdx]?.role?.toLowerCase().includes('manager');
                                const updated = {
                                  ...base,
                                  staffShowcase: updatedShowcase,
                                  ...(isMgr ? { schoolManagerPhotoUrl: uploadRes.url } : {}),
                                };
                                setWebsiteSettings(updated);
                                await saveWebsiteSettings(updated);
                                setWebsiteSettingsSuccess(true);
                                setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                              } catch (err) {
                                console.warn('Upload error:', err);
                              }
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs cursor-pointer"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          value={staff.imageUrl}
                          onChange={(e) => {
                            const updated = [...(websiteSettings.staffShowcase || [])];
                            updated[sIdx] = { ...updated[sIdx], imageUrl: e.target.value };
                            setWebsiteSettings({ ...websiteSettings, staffShowcase: updated });
                          }}
                          placeholder="Cleared / Image URL"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-mono text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        {staff.imageUrl && (
                          <button
                            type="button"
                            onClick={async () => {
                              const updatedShowcase = [...(websiteSettings.staffShowcase || [])];
                              const isMgr = updatedShowcase[sIdx]?.id === 'staff-lead-1' || updatedShowcase[sIdx]?.role?.toLowerCase().includes('manager');
                              updatedShowcase[sIdx] = { ...updatedShowcase[sIdx], imageUrl: '' };
                              const updated = {
                                ...websiteSettings,
                                staffShowcase: updatedShowcase,
                                ...(isMgr ? { schoolManagerPhotoUrl: '' } : {}),
                              };
                              setWebsiteSettings(updated);
                              await saveWebsiteSettings(updated);
                              setWebsiteSettingsSuccess(true);
                              setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                            }}
                            className="cursor-pointer text-rose-600 hover:text-rose-800 text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Clear Photo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Cultural Heritage Spotlight Image & Alt-Text (Campus Life & Public Pages) */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>8. Cultural Heritage Spotlight Image & Alt-Text</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customize the traditional Rwandan dance / Itorero showcase photo, caption, and accessibility alt-text featured on Campus Life.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('campus-life')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Campus Life</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                <div className="md:col-span-4 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <div className="h-44 rounded-xl overflow-hidden border border-slate-200 bg-white">
                    <img
                      src={websiteSettings.culturalDancePhotoUrl || '/images/campus_life_traditional_dance_1791823290926.jpg'}
                      alt={websiteSettings.culturalDanceAlt || 'Mugina Hope Traditional Dance Troupe'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.dataset.triedFallback) {
                          target.dataset.triedFallback = '1';
                          target.src = '/images/campus_life_traditional_dance_1791823290926.jpg';
                        }
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 block">Active Showcase Image</span>
                </div>

                <div className="md:col-span-8 space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Upload New Cultural Spotlight Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const uploadRes = await uploadSchoolAsset(file, 'cultural_dance_spotlight', 'gallery');
                            const updated = {
                              ...getWebsiteSettings(),
                              ...websiteSettings,
                              culturalDancePhotoUrl: uploadRes.url,
                            };
                            setWebsiteSettings(updated);
                            await saveWebsiteSettings(updated);
                            setWebsiteSettingsSuccess(true);
                            setTimeout(() => setWebsiteSettingsSuccess(false), 3000);
                          } catch (err) {
                            console.warn('Cultural image upload error:', err);
                          }
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Or Direct Image URL / Path
                    </label>
                    <input
                      type="text"
                      value={websiteSettings.culturalDancePhotoUrl || ''}
                      onChange={(e) => setWebsiteSettings({ ...websiteSettings, culturalDancePhotoUrl: e.target.value })}
                      placeholder="/images/campus_life_traditional_dance_1791823290926.jpg"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Showcase Title
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.culturalDanceTitle || ''}
                        onChange={(e) => setWebsiteSettings({ ...websiteSettings, culturalDanceTitle: e.target.value })}
                        placeholder="Traditional Rwandan Dance & Cultural Itorero"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Accessibility Alt-Text (SEO & Screen Readers) *
                      </label>
                      <input
                        type="text"
                        value={websiteSettings.culturalDanceAlt || ''}
                        onChange={(e) => setWebsiteSettings({ ...websiteSettings, culturalDanceAlt: e.target.value })}
                        placeholder="Mugina Hope primary pupils performing traditional Rwandan dance in traditional attire"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Showcase Description / Summary
                    </label>
                    <textarea
                      rows={2}
                      value={websiteSettings.culturalDanceDesc || ''}
                      onChange={(e) => setWebsiteSettings({ ...websiteSettings, culturalDanceDesc: e.target.value })}
                      placeholder="Nurturing national identity, cultural artistry, and traditional dance choreography across all year groups."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 9. Supabase Database Integration & Real-Time Sync */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>9. Supabase Database Integration & Real-Time Cloud Sync</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connect your Supabase project to mirror all 15 school modules (settings, gallery, staff, students, fees, attendance, discipline, progress logs, applications, chats, docs, news, inquiries &amp; tours) to a PostgreSQL cloud database alongside Firebase Firestore.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Dual Database Architecture Active</span>
                </span>
              </div>

              {/* Data Persistence Explanation Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Permanent Multi-Browser Sync Across All 15 School Modules</span>
                </div>
                <p>
                  Every administrator, bursar, registrar, DOS, DOD, or teacher update saves across both Supabase PostgreSQL and Firebase Firestore with timestamp-aware resolution and real-time listeners, so public visitors and staff in other browsers see identical live updates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={websiteSettings.supabaseUrl || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, supabaseUrl: e.target.value })}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Found in your Supabase project dashboard under Settings &rarr; API &rarr; Project URL.
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Supabase Anonymous (Public) Key
                  </label>
                  <input
                    type="password"
                    value={websiteSettings.supabaseAnonKey || ''}
                    onChange={(e) => setWebsiteSettings({ ...websiteSettings, supabaseAnonKey: e.target.value })}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Found under Settings &rarr; API &rarr; Project API keys &rarr; anon / public.
                  </span>
                </div>
              </div>

              {/* Status Messages */}
              {supabaseTestStatus.message && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                    supabaseTestStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {supabaseTestStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{supabaseTestStatus.message}</span>
                </div>
              )}

              {supabaseSyncStatus.message && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                    supabaseSyncStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {supabaseSyncStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{supabaseSyncStatus.message}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={supabaseTestStatus.testing}
                  onClick={handleTestSupabase}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  {supabaseTestStatus.testing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test Supabase Connection</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={supabaseSyncStatus.syncing}
                  onClick={handleSyncToSupabase}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  {supabaseSyncStatus.syncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Data...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Sync All Records to Supabase</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopySupabaseSQL}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-2 border border-slate-300 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  <span>{copiedSql ? 'Copied SQL Setup Script!' : 'Copy Supabase SQL Setup Script'}</span>
                </button>
              </div>
            </div>

            {/* 10. Automated Database Backup & Disaster Recovery */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-indigo-600" />
                    <span>10. Automated Database Backup & Disaster Recovery</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Export offline snapshots of your school database (staff, students, applications, fees, settings) or restore from an earlier backup.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 text-[11px] font-bold rounded-lg border border-indigo-200 inline-flex items-center gap-1.5 self-start sm:self-auto">
                  <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Disaster Recovery Ready</span>
                </span>
              </div>

              {backupMsg && (
                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{backupMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackupMsg(null)}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-bold px-2 py-0.5 rounded cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                      <FileDown className="w-4 h-4 text-blue-600" />
                      <span>Full Database Snapshot</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Exports all website settings, staff profiles, student records, fee transactions, and admissions applications in structured JSON format.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportDatabaseBackup}
                    className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>MINEDUC Pupils Roster (CSV)</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Exports enrolled pupils with registration numbers, grade levels, and emergency guardian contacts for official Kamonyi district reporting.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportStudentsCSV}
                    className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV Roster</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                      <span>Restore from JSON File</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Upload a previously exported backup file to restore school settings, gallery items, and records to your database.
                    </p>
                  </div>
                  <label className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload & Restore Backup</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleRestoreBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Sticky Save Bar */}
            <div className="sticky bottom-6 z-20 bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs space-y-0.5">
                <strong className="block text-sm font-bold text-white">Save Changes to Public Website</strong>
                <span className="text-slate-400">Updates will be synced to server and published immediately to all visitors.</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel / View Site
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2 cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>Save Website Updates & Publish Live</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Modal: Add Staff Member */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">
                {editingStaffMember
                  ? `Edit Staff Member (${editingStaffMember.name})`
                  : 'Enroll Staff Member (Teacher / Finance / Registrar / DOS / DOD)'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddStaffModal(false);
                  setEditingStaffMember(null);
                  setStaffFormError(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveStaff} className="space-y-3 text-xs">
              {staffFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{staffFormError}</span>
                </div>
              )}
              <div>
                <label className="font-bold block mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jean Damascene Murwanashyaka"
                  value={staffFormData.name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Role *</label>
                  <select
                    value={staffFormData.role}
                    onChange={(e) => setStaffFormData({ ...staffFormData, role: e.target.value as StaffMember['role'] })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  >
                    <option value="Teacher">Teacher (Assigned Classes &amp; Marks)</option>
                    <option value="DOS">DOS (Director of Studies)</option>
                    <option value="DOD">DOD (Director of Discipline)</option>
                    <option value="Registrar">Registrar (Admissions &amp; Enrollment)</option>
                    <option value="Accountant">Accountant / Bursar</option>
                    <option value="Finance">Finance Officer (Accounting &amp; Ledger)</option>
                    <option value="HeadTeacher">Head Teacher / Principal</option>
                    <option value="SchoolAdmin">School Administrator</option>
                    <option value="SuperAdmin">Super Administrator (Full Access)</option>
                    <option value="Admin">Headmaster / Admin</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. staff.name@gmail.com"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Account Status *</label>
                  <select
                    value={staffFormData.status}
                    onChange={(e) =>
                      setStaffFormData({ ...staffFormData, status: e.target.value as StaffMember['status'] })
                    }
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-semibold"
                  >
                    <option value="Active">Active (Allowed Login)</option>
                    <option value="Inactive">Inactive (Suspended Login)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Assigned Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. finance.mugina"
                    value={staffFormData.username}
                    onChange={(e) => setStaffFormData({ ...staffFormData, username: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold block">
                      {editingStaffMember ? 'New Password (leave blank to keep current)' : 'Password *'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 focus:outline-hidden cursor-pointer"
                    >
                      {showStaffPassword ? (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3 h-3" />
                          <span>Reveal</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required={!editingStaffMember}
                      placeholder={editingStaffMember ? 'Leave blank to preserve existing password' : 'Min 6 characters'}
                      value={staffFormData.password}
                      onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                      className="w-full bg-slate-50 border p-2.5 pr-10 rounded-xl font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 focus:outline-hidden cursor-pointer"
                      title={showStaffPassword ? 'Hide password' : 'Show password'}
                    >
                      {showStaffPassword ? <EyeOff className="w-4 h-4 text-blue-700" /> : <Eye className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="font-bold block mb-1">Assigned Subject, Class, or Department</label>
                <input
                  type="text"
                  placeholder="e.g. Primary 4 STEM, Academics (DOS), Discipline (DOD), or Finance"
                  value={staffFormData.assignedSubjectOrGrade}
                  onChange={(e) => setStaffFormData({ ...staffFormData, assignedSubjectOrGrade: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStaffModal(false);
                    setEditingStaffMember(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="px-5 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-70 text-white font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  {isSavingStaff ? 'Saving Credentials...' : editingStaffMember ? 'Save Changes' : 'Enroll Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Enroll / Edit Student */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  {editingStudent ? `Edit Student Profile — ${editingStudent.fullName}` : 'DOS Student Enrollment & Credentials Creation'}
                </h3>
                <p className="text-[11px] text-slate-500">Assign class, stream, demographic details, and student portal credentials</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddStudentModal(false);
                  setEditingStudent(null);
                  setStudentFormError(null);
                }}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!editingStudent && (
              <button
                type="button"
                onClick={() => {
                  setShowAddStudentModal(false);
                  setStudentFormError(null);
                  setShowBulkStudentModal(true);
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-bold text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-left">
                  <FileUp className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Have a Word (.docx) or PDF (.pdf) student list?</span>
                </span>
                <span className="text-blue-700 underline whitespace-nowrap shrink-0">Import Table →</span>
              </button>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              {studentFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{studentFormError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {studentFormData.photoUrl ? (
                  <img src={studentFormData.photoUrl} alt="Student portrait" referrerPolicy="no-referrer" className="w-12 h-12 rounded-xl object-cover border border-slate-300 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-900 font-bold flex items-center justify-center shrink-0">
                    Photo
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <label className="font-bold text-slate-700 block">Student Passport Photo</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3 py-1 bg-blue-900 hover:bg-blue-950 text-white font-semibold rounded-lg">
                      {isUploadingStudentPhoto ? 'Uploading...' : 'Upload Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingStudentPhoto}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingStudentPhoto(true);
                          try {
                            const res = await uploadSchoolAsset(file, 'student_profile', 'students');
                            setStudentFormData((prev) => ({ ...prev, photoUrl: res.url }));
                          } finally {
                            setIsUploadingStudentPhoto(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {studentFormData.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setStudentFormData((prev) => ({ ...prev, photoUrl: '' }))}
                        className="text-rose-600 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold block mb-1">Registration ID *</label>
                  <input
                    type="text"
                    required
                    value={studentFormData.regNumber}
                    onChange={(e) => setStudentFormData({ ...studentFormData, regNumber: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Class Grade *</label>
                  <select
                    value={studentFormData.gradeCode}
                    onChange={(e) => setStudentFormData({ ...studentFormData, gradeCode: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  >
                    {ACADEMIC_GRADES.map((g) => (
                      <option key={g.code} value={g.code}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold block mb-1">Stream</label>
                  <input
                    type="text"
                    value={studentFormData.stream}
                    onChange={(e) => setStudentFormData({ ...studentFormData, stream: e.target.value })}
                    placeholder="e.g. A, B, East"
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold block mb-1">Learner Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Keza Aline Manzi"
                    value={studentFormData.fullName}
                    onChange={(e) => setStudentFormData({ ...studentFormData, fullName: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Gender</label>
                  <select
                    value={studentFormData.gender}
                    onChange={(e) => setStudentFormData({ ...studentFormData, gender: e.target.value as 'Male' | 'Female' })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={studentFormData.dob}
                    onChange={(e) => setStudentFormData({ ...studentFormData, dob: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Admission Date</label>
                  <input
                    type="date"
                    value={studentFormData.admissionDate}
                    onChange={(e) => setStudentFormData({ ...studentFormData, admissionDate: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Enrollment Status</label>
                  <select
                    value={studentFormData.status}
                    onChange={(e) => setStudentFormData({ ...studentFormData, status: e.target.value as EnrolledStudent['status'] })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  >
                    <option value="Active">Active</option>
                    <option value="Awaiting Approval">Awaiting Approval</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Transferred">Transferred</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Home Address / Sector</label>
                  <input
                    type="text"
                    placeholder="e.g. Mugina, Kamonyi"
                    value={studentFormData.address}
                    onChange={(e) => setStudentFormData({ ...studentFormData, address: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Previous School (if transferring)</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={studentFormData.previousSchool}
                    onChange={(e) => setStudentFormData({ ...studentFormData, previousSchool: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Parent / Guardian Name</label>
                  <input
                    type="text"
                    placeholder="Parent / Guardian"
                    value={studentFormData.parentName}
                    onChange={(e) => setStudentFormData({ ...studentFormData, parentName: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Parent Phone *</label>
                  <input
                    type="tel"
                    required
                    value={studentFormData.parentPhone}
                    onChange={(e) => setStudentFormData({ ...studentFormData, parentPhone: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Parent Email (Links Parent Portal &amp; Alerts)</label>
                <input
                  type="email"
                  placeholder="parent@gmail.com"
                  value={studentFormData.parentEmail}
                  onChange={(e) => setStudentFormData({ ...studentFormData, parentEmail: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-amber-900">Student Portal Login Credentials:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const slug = studentFormData.fullName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '.')
                        .replace(/^\.+|\.+$/g, '');
                      const suffix = Math.floor(10 + Math.random() * 89);
                      setStudentFormData((prev) => ({
                        ...prev,
                        studentUsername: slug ? `${slug}` : `stu.${suffix}`,
                        studentPassword: `Mha@${Math.floor(1000 + Math.random() * 9000)}`,
                      }));
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Credentials</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-amber-800">Student Username:</label>
                    <input
                      type="text"
                      placeholder="e.g. keza.aline"
                      value={studentFormData.studentUsername}
                      onChange={(e) => setStudentFormData({ ...studentFormData, studentUsername: e.target.value })}
                      className="w-full bg-white border border-amber-300 p-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-800">Student Password:</label>
                    <input
                      type="text"
                      value={studentFormData.studentPassword}
                      onChange={(e) => setStudentFormData({ ...studentFormData, studentPassword: e.target.value })}
                      className="w-full bg-white border border-amber-300 p-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={studentFormData.studentAccountActive}
                    onChange={(e) => setStudentFormData({ ...studentFormData, studentAccountActive: e.target.checked })}
                    className="w-4 h-4 rounded border-amber-400 text-blue-900"
                  />
                  <span className="text-[11px] font-semibold text-amber-900">
                    Student Portal Account Active (Uncheck to suspend student login access)
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowAddStudentModal(false); setEditingStudent(null); }} className="px-4 py-2 font-semibold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSavingStudent} className="px-5 py-2 bg-amber-500 disabled:opacity-70 text-slate-950 font-bold rounded-xl cursor-pointer">
                  {isSavingStudent ? 'Saving Credentials...' : editingStudent ? 'Save Student Changes' : 'Enroll & Issue Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Reset Student Portal Password */}
      {resetPasswordStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Reset Student Portal Password</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {resetPasswordStudent.fullName} ({resetPasswordStudent.regNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordStudent(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = resetPasswordInput.trim();
                if (clean.length < 4) return;
                updateEnrolledStudent(resetPasswordStudent.id, { studentPassword: clean });
                await waitForCredentialSync();
                setStudentList(getEnrolledStudents());
                logAuditEvent('RESET_PASSWORD', 'Student', resetPasswordStudent.id, `Admin reset portal password for ${resetPasswordStudent.fullName}`);
                setDeleteSuccessMsg(`Updated portal password for ${resetPasswordStudent.fullName}.`);
                setTimeout(() => setDeleteSuccessMsg(null), 4000);
                setResetPasswordStudent(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                  Username (Sign-in ID)
                </label>
                <input
                  type="text"
                  readOnly
                  value={resetPasswordStudent.studentUsername || resetPasswordStudent.regNumber}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-mono text-slate-600 dark:text-slate-300"
                />
              </div>
              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                  New Portal Password *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  placeholder="Enter new password (min 4 chars)"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordStudent(null)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl cursor-pointer"
                >
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admissions Decision & Email Verification Code Review */}
      {reviewAppTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Admissions Review: {reviewAppTarget.studentName}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ref: {reviewAppTarget.refCode} &bull; Class: {reviewAppTarget.gradeCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewAppTarget(null);
                  setReviewError(null);
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewApplication} className="space-y-4 text-xs">
              {reviewError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 space-y-1">
                <p><strong>Parent / Guardian:</strong> {reviewAppTarget.parentName} ({reviewAppTarget.parentPhone})</p>
                <p><strong>Parent Email:</strong> <span className="font-mono text-blue-700 dark:text-sky-400">{reviewAppTarget.parentEmail || 'Not provided'}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold block text-slate-700 dark:text-slate-200">Select Administrative Decision *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-colors ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Approve &amp; Email Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('more_info')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-colors ${
                      reviewAction === 'more_info'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Request More Info
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-colors ${
                      reviewAction === 'reject'
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Reject Application
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                  {reviewAction === 'approve'
                    ? 'Approval Notes / Welcome Message'
                    : reviewAction === 'more_info'
                    ? 'Requested Documents or Details *'
                    : 'Rejection Reason / Guidance *'}
                </label>
                <textarea
                  rows={3}
                  required={reviewAction !== 'approve'}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewAction === 'approve'
                      ? 'Optional note included in official approval records...'
                      : reviewAction === 'more_info'
                      ? 'Specify missing documents or clarifications required...'
                      : 'Provide respectful admissions feedback...'
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {reviewAction === 'approve' && (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl">
                  Approving will send an official Gmail confirmation containing a unique 6-digit verification code and direct verification link so the parent can confirm admission.
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAppTarget(null)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReviewSubmitting}
                  className="px-5 py-2.5 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {isReviewSubmitting ? 'Dispatching Email...' : 'Submit Decision & Notify Parent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Application (Direct Enrollment & Credentials) */}
      {confirmAppTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Confirm Registration: {confirmAppTarget.studentName}</h3>
                <p className="text-[11px] text-slate-500">Provide official feedback and assign student credentials</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmAppTarget(null);
                  setConfirmAppError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmApplication} className="space-y-3 text-xs">
              {confirmAppError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{confirmAppError}</span>
                </div>
              )}
              <div className="p-3 bg-slate-50 rounded-xl text-slate-700 space-y-1">
                <p><strong>Applying Grade:</strong> {confirmAppTarget.gradeCode}</p>
                <p><strong>Parent:</strong> {confirmAppTarget.parentName} ({confirmAppTarget.parentPhone})</p>
                <p><strong>Parent Email:</strong> {confirmAppTarget.parentEmail || 'None'}</p>
              </div>

              <div>
                <label className="font-bold block mb-1">Official Feedback to Parent *</label>
                <textarea
                  rows={3}
                  required
                  value={confirmFeedbackNotes}
                  onChange={(e) => setConfirmFeedbackNotes(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Student Portal Username *</label>
                  <input
                    type="text"
                    required
                    value={confirmStudentUser}
                    onChange={(e) => setConfirmStudentUser(e.target.value)}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Temporary Password *</label>
                  <input
                    type="text"
                    required
                    value={confirmStudentPass}
                    onChange={(e) => setConfirmStudentPass(e.target.value)}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmAppTarget(null)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button
                  type="submit"
                  disabled={isConfirmingApp}
                  className="px-5 py-2.5 bg-blue-800 text-white font-bold rounded-xl"
                >
                  {isConfirmingApp ? 'Confirming & Dispatching Email...' : 'Confirm Registration & Send Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gallery Image Upload & Edit */}
      {showAddImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">{editingImageItem ? 'Edit School Photo Details' : 'Upload School Photo (Gallery Asset)'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddImageModal(false);
                  setImageFormError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveGalleryImage} className="space-y-3 text-xs">
              {imageFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{imageFormError}</span>
                </div>
              )}
              <div>
                <label className="font-bold block mb-1">Image Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hope Primary Campus Grounds"
                  value={imageFormData.title}
                  onChange={(e) => setImageFormData({ ...imageFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Category *</label>
                <select
                  value={imageFormData.category}
                  onChange={(e) => setImageFormData({ ...imageFormData, category: e.target.value as FacilityItem['category'] })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                >
                  <option value="outdoor">Campus Grounds & Safety</option>
                  <option value="classrooms">Classrooms & Learning</option>
                  <option value="technology">ICT & Computer Lab</option>
                  <option value="culture">Traditional Dance & Itorero</option>
                  <option value="sports">Sports & Playground</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <UploadCloud className="w-4 h-4 text-blue-700" />
                  <span>Official Image Upload</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Photos uploaded here are securely saved and instantly displayed across all campus gallery views.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="w-full bg-white border border-amber-300 p-2 rounded-xl text-xs"
                />
                {imageUploadStatus && <p className="text-[11px] font-semibold text-emerald-700 mt-1">{imageUploadStatus}</p>}
              </div>

              <div>
                <label className="font-bold block mb-1">Or Paste Existing Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={imageFormData.imageSrc}
                  onChange={(e) => setImageFormData({ ...imageFormData, imageSrc: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl font-mono text-[11px]"
                />
              </div>

              {imageFormData.imageSrc && (
                <div className="h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={imageFormData.imageSrc} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
              )}

              <div>
                <label className="font-bold block mb-1">Description / Caption</label>
                <textarea
                  rows={2}
                  placeholder="Caption for school visitors..."
                  value={imageFormData.description}
                  onChange={(e) => setImageFormData({ ...imageFormData, description: e.target.value, caption: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Accessibility Alt-Text (SEO & Screen Readers)</label>
                <input
                  type="text"
                  placeholder="e.g. Mugina Hope Primary pupils engaged in collaborative group work in classroom"
                  value={imageFormData.altText || ''}
                  onChange={(e) => setImageFormData({ ...imageFormData, altText: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Descriptive alternative text for screen readers (web accessibility) and Google image search SEO.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddImageModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded-xl flex items-center gap-2"
                >
                  {isUploadingImage ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading &amp; Publishing...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Save &amp; Publish to Gallery</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: News & Announcement Form */}
      {showNewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900">{editingNewsItem ? 'Edit Announcement' : 'New Website Announcement'}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewsModal(false);
                  setNewsFormError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveNews} className="space-y-3 text-xs">
              {newsFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{newsFormError}</span>
                </div>
              )}
              <div>
                <label className="font-bold block mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Term 1 Registration Open"
                  value={newsFormData.title}
                  onChange={(e) => setNewsFormData({ ...newsFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Badge Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. Important Notice"
                    value={newsFormData.badge}
                    onChange={(e) => setNewsFormData({ ...newsFormData, badge: e.target.value })}
                    className="w-full bg-slate-50 border p-2.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Status</label>
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newsFormData.isActive}
                      onChange={(e) => setNewsFormData({ ...newsFormData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>Active on Website</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Content Prose *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Announcement text..."
                  value={newsFormData.content}
                  onChange={(e) => setNewsFormData({ ...newsFormData, content: e.target.value })}
                  className="w-full bg-slate-50 border p-2.5 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowNewsModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-800 text-white font-bold rounded-xl">Save Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Required Registration Document Form */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingDoc ? 'Edit Registration Document Requirement' : 'Add Required Registration Document'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowDocModal(false);
                  setDocFormError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="space-y-3.5 text-xs">
              {docFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{docFormError}</span>
                </div>
              )}
              <div>
                <label className="font-bold block mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Immunization & Vaccination Card"
                  value={docFormData.title}
                  onChange={(e) => setDocFormData({ ...docFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Description & Purpose *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this document is required and where parents can obtain it (e.g. Irembo, health center)..."
                  value={docFormData.description}
                  onChange={(e) => setDocFormData({ ...docFormData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Applicable Grades</label>
                  <select
                    value={docFormData.applicableGrades}
                    onChange={(e) => setDocFormData({ ...docFormData, applicableGrades: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800"
                  >
                    <option value="All Grades (Nursery & Primary)">All Grades (Nursery & Primary)</option>
                    <option value="Nursery Only (Baby, Middle, Pre-Primary)">Nursery Only (Baby, Middle, Pre-Primary)</option>
                    <option value="Primary 1 to Primary 6">Primary 1 to Primary 6</option>
                    <option value="Transfer Students (P1 - P6)">Transfer Students (P1 - P6)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">Requirement Status</label>
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={docFormData.isRequired}
                      onChange={(e) => setDocFormData({ ...docFormData, isRequired: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="font-semibold text-slate-800">Mandatory</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Acceptable Format Hint</label>
                <input
                  type="text"
                  placeholder="e.g. Certified Irembo printout or original booklet copy"
                  value={docFormData.formatHint}
                  onChange={(e) => setDocFormData({ ...docFormData, formatHint: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-700"
                />
              </div>

              {/* Document Attachment */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <UploadCloud className="w-4 h-4 text-blue-700" />
                  <span>Attach Official Document File</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Upload the official PDF form, checklist, or template. It is securely saved and downloadable by applicants across any device.
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleDocFileChange}
                  className="w-full bg-white border border-slate-300 p-2 rounded-xl text-xs"
                />
                {docUploadStatus && (
                  <p className="text-[11px] font-semibold text-emerald-700">{docUploadStatus}</p>
                )}
                {docFormData.fileUrl && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                    <span className="truncate max-w-[260px]">
                      Current: <strong>{docFormData.fileName || 'Attached Form'}</strong> {docFormData.fileSize ? `(${docFormData.fileSize})` : ''}
                    </span>
                    <a
                      href={docFormData.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 font-bold hover:underline"
                    >
                      Preview File ↗
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-5 py-2.5 bg-blue-800 hover:bg-blue-900 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {isUploadingDoc
                      ? 'Uploading...'
                      : editingDoc
                      ? 'Update Requirement & File'
                      : 'Save Document'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP RECORD DELETION CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-rose-100 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Confirm Permanent Deletion
                </h3>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  {deleteTarget.type === 'staff'
                    ? 'Staff Member'
                    : deleteTarget.type === 'student'
                    ? 'Enrolled Student'
                    : deleteTarget.type === 'student-batch'
                    ? 'Bulk Learner Deletion'
                    : deleteTarget.type === 'doc'
                    ? 'Registration Requirement'
                    : deleteTarget.type === 'gallery'
                    ? 'Gallery Image'
                    : deleteTarget.type === 'news'
                    ? 'Announcement'
                    : 'Application Record'}
                </span>
              </div>
            </div>

            {deleteTarget.type === 'student-batch' && deleteTarget.batchScope !== 'selected' && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Choose What to Delete:
                </span>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget((prev) =>
                        prev && prev.allIds
                          ? {
                              ...prev,
                              batchScope: 'all',
                              selectedGradeFilter: '',
                              ids: prev.allIds,
                              name: `All ${prev.allIds.length} Enrolled Learner(s)`,
                            }
                          : prev
                      )
                    }
                    className={`w-full text-left px-3 py-2 rounded-xl border font-semibold transition-colors cursor-pointer ${
                      deleteTarget.batchScope === 'all'
                        ? 'bg-rose-600 text-white border-rose-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Delete All Learners ({deleteTarget.allIds?.length || 0})
                  </button>
                  {(deleteTarget.importedIds?.length || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget((prev) =>
                          prev && prev.importedIds
                            ? {
                                ...prev,
                                batchScope: 'imported',
                                selectedGradeFilter: '',
                                ids: prev.importedIds,
                                name: `${prev.importedIds.length} Imported Word/PDF Learner(s) (keeps manual enrollments)`,
                              }
                            : prev
                        )
                      }
                      className={`w-full text-left px-3 py-2 rounded-xl border font-semibold transition-colors cursor-pointer ${
                        deleteTarget.batchScope === 'imported'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Delete Only Imported Word / PDF Learners ({deleteTarget.importedIds?.length || 0})
                    </button>
                  )}
                  {(deleteTarget.importedFiles?.length || 0) > 0 && (
                    <div className="pt-1 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Or Delete a Specific Imported Word / PDF File / Batch:
                      </label>
                      <select
                        value={deleteTarget.batchScope === 'file' ? deleteTarget.selectedImportFile || '' : ''}
                        onChange={(e) => {
                          const fileName = e.target.value;
                          if (!fileName) return;
                          const matched = deleteTarget.importedFiles?.find((f) => f.fileName === fileName);
                          if (matched) {
                            setDeleteTarget((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    batchScope: 'file',
                                    selectedImportFile: fileName,
                                    selectedGradeFilter: '',
                                    ids: matched.ids,
                                    name: `${matched.ids.length} Learner(s) from "${fileName}"`,
                                  }
                                : prev
                            );
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="">-- Select imported .docx / .pdf file --</option>
                        {deleteTarget.importedFiles?.map((f) => (
                          <option key={f.fileName} value={f.fileName}>
                            {f.fileName} ({f.ids.length} learners)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="pt-1 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Or Delete All Learners in a Specific Class:
                    </label>
                    <select
                      value={deleteTarget.batchScope === 'grade' ? deleteTarget.selectedGradeFilter || '' : ''}
                      onChange={(e) => {
                        const grade = e.target.value;
                        if (!grade) return;
                        const classStudents = studentList.filter((s) => s.gradeCode === grade);
                        if (classStudents.length > 0) {
                          setDeleteTarget((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  batchScope: 'grade',
                                  selectedGradeFilter: grade,
                                  ids: classStudents.map((s) => s.id),
                                  name: `${classStudents.length} Learner(s) in Class ${grade}`,
                                }
                              : prev
                          );
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                      <option value="">-- Select a class roster to delete --</option>
                      {ACADEMIC_GRADES.map((g) => {
                        const count = studentList.filter((s) => s.gradeCode === g.code).length;
                        if (count === 0) return null;
                        return (
                          <option key={g.code} value={g.code}>
                            {g.code} — {g.name} ({count} learners)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 text-xs text-slate-600">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                Item to be permanently deleted:
              </span>
              <p className="font-bold text-sm text-slate-900 break-words">{deleteTarget.name}</p>
              <p className="text-[11px] text-rose-600 font-medium pt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>This record will be permanently purged from the school database.</span>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP DATABASE BACKUP RESTORE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {pendingBackupRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-amber-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Confirm Database Backup Restore
                </h3>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  Snapshot Recovery
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs text-slate-700">
              <p className="font-bold text-slate-900 break-all">File: {pendingBackupRestore.fileName}</p>
              <p className="text-[11px] text-slate-600">
                Existing settings, staff accounts, student records, gallery media, applications, and ledgers will be updated and re-synced to cloud stores.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingBackupRestore(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestoreBackup}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restore &amp; Sync Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Deletion Success Notification */}
      {deleteSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-slate-100 flex-1">{deleteSuccessMsg}</p>
          <button
            type="button"
            onClick={() => setDeleteSuccessMsg(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Student Profile, History & Digital ID Card Modal */}
      <StudentIdAndProfileModal
        student={inspectedStudent}
        onClose={() => setInspectedStudent(null)}
        onStudentUpdated={() => setStudentList(getEnrolledStudents())}
        canTransfer={hasPermission(currentUser, 'promote_transfer_students')}
      />

      {/* Bulk Student List Import Modal (.docx / .pdf) */}
      <BulkStudentImportModal
        isOpen={showBulkStudentModal}
        defaultGradeCode={studentFormData.gradeCode || 'P1'}
        defaultAttendanceDate={attendanceDate}
        enrolledBy={currentUser?.name || 'DOS'}
        onClose={() => setShowBulkStudentModal(false)}
        onImported={(created, importedGrade) => {
          setStudentList(getEnrolledStudents());
          setShowBulkStudentModal(false);
          setDeleteSuccessMsg(
            `Enrolled ${created.length} learners into ${importedGrade} and synchronized with the Attendance Tracker.`
          );
          setTimeout(() => setDeleteSuccessMsg(null), 5000);
        }}
      />
    </div>
  );
};
