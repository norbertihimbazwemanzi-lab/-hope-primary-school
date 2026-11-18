import React, { useEffect, useState } from 'react';
import { AdminApplication, setAdminNotificationEmail } from '../services/adminStore';
import { getStaffAuthToken } from '../services/authService';
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Send,
  FileText,
  Save,
  ShieldCheck,
} from 'lucide-react';

interface EmailLogItem {
  id: string;
  recipientEmail: string;
  emailType: string;
  subject: string;
  status: 'Sent' | 'Failed';
  errorMessage?: string;
  retryCount: number;
  relatedRef?: string;
  sentAt: string;
  sanitizedSummary: string;
}

interface EmailTemplateConfig {
  id: 'admission_approved' | 'admission_rejected' | 'admission_more_info' | 'password_reset';
  label: string;
  subject: string;
  introParagraph: string;
  instructionsParagraph: string;
  footerSignature: string;
  updatedAt: string;
}

interface AdminEmailNotificationsModuleProps {
  adminEmail: string;
  onUpdateAdminEmail: (email: string) => void;
  applications: AdminApplication[];
  onRefreshApplications: () => Promise<void>;
}

const TEMPLATE_LABELS: Record<EmailTemplateConfig['id'], string> = {
  admission_approved: 'Admission Application Approved',
  admission_rejected: 'Admission Application Rejected',
  admission_more_info: 'Request More Information',
  password_reset: 'Password Reset Instructions',
};

export const AdminEmailNotificationsModule: React.FC<AdminEmailNotificationsModuleProps> = ({
  adminEmail,
  onUpdateAdminEmail,
  applications,
  onRefreshApplications,
}) => {
  const [subTab, setSubTab] = useState<'logs' | 'verifications' | 'templates'>('logs');
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Sent' | 'Failed'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [templates, setTemplates] = useState<Record<string, EmailTemplateConfig>>({});
  const [activeTemplateId, setActiveTemplateId] = useState<EmailTemplateConfig['id']>('admission_approved');
  const [templateDraft, setTemplateDraft] = useState<EmailTemplateConfig | null>(null);

  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [resendingRef, setResendingRef] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackBanner({ type, text });
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  const fetchLogsAndTemplates = async () => {
    const token = getStaffAuthToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    setLoadingLogs(true);
    try {
      const [logsRes, tplRes] = await Promise.all([
        fetch('/api/admin/email-logs', { headers }),
        fetch('/api/admin/email-templates', { headers }),
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        if (Array.isArray(data.logs)) setLogs(data.logs);
      }
      if (tplRes.ok) {
        const tData = await tplRes.json();
        if (tData.templates) {
          setTemplates(tData.templates);
          if (tData.templates[activeTemplateId]) {
            setTemplateDraft(tData.templates[activeTemplateId]);
          }
        }
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogsAndTemplates();
  }, []);

  useEffect(() => {
    if (templates[activeTemplateId]) {
      setTemplateDraft(templates[activeTemplateId]);
    }
  }, [activeTemplateId, templates]);

  const handleRetryEmail = async (logId: string) => {
    const token = getStaffAuthToken();
    setRetryingLogId(logId);
    try {
      const res = await fetch(`/api/admin/email-logs/${encodeURIComponent(logId)}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showFeedback('success', 'Email delivery retry completed successfully.');
        await fetchLogsAndTemplates();
        await onRefreshApplications();
      } else {
        showFeedback('error', data.error || 'Email retry failed. Verify Gmail SMTP settings.');
      }
    } catch {
      showFeedback('error', 'Network error while retrying email delivery.');
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleResendAdmissionCode = async (refCode: string) => {
    const token = getStaffAuthToken();
    setResendingRef(refCode);
    try {
      const res = await fetch('/api/admissions/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ refCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showFeedback('success', `Fresh verification code dispatched to parent for ${refCode}.`);
        await fetchLogsAndTemplates();
        await onRefreshApplications();
      } else {
        showFeedback('error', data.error || 'Failed to resend verification code.');
      }
    } catch {
      showFeedback('error', 'Network error while resending verification code.');
    } finally {
      setResendingRef(null);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateDraft) return;
    const token = getStaffAuthToken();
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: activeTemplateId,
          subject: templateDraft.subject,
          introParagraph: templateDraft.introParagraph,
          instructionsParagraph: templateDraft.instructionsParagraph,
          footerSignature: templateDraft.footerSignature,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.templates) setTemplates(data.templates);
        showFeedback('success', `Saved template for "${TEMPLATE_LABELS[activeTemplateId]}".`);
      } else {
        showFeedback('error', data.error || 'Failed to save email template.');
      }
    } catch {
      showFeedback('error', 'Network error while saving template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && log.emailType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.recipientEmail.toLowerCase().includes(q) ||
        log.subject.toLowerCase().includes(q) ||
        (log.relatedRef || '').toLowerCase().includes(q) ||
        log.sanitizedSummary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const approvedOrVerifiedApps = applications.filter(
    (a) =>
      a.status === 'Approved' ||
      a.status === 'Confirmed & Enrolled' ||
      a.status === 'Rejected' ||
      a.status === 'More Info Requested'
  );

  return (
    <div className="space-y-6">
      {/* Header & Official Notification Email Control */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 text-amber-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                Gmail Email Engine, Delivery History &amp; Verification Monitor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track Gmail notifications, retry failed deliveries, monitor parent admission verifications, and customize templates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => onUpdateAdminEmail(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-800 dark:text-slate-200 w-64"
              aria-label="Official notification Gmail"
            />
            <button
              type="button"
              onClick={() => {
                setAdminNotificationEmail(adminEmail);
                showFeedback('success', `Updated school notification email to ${adminEmail}`);
              }}
              className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              Save Gmail
            </button>
          </div>
        </div>

        {feedbackBanner && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackBanner.text}</span>
          </div>
        )}

        {/* Sub-Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('logs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                subTab === 'logs'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sent Email History ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('verifications')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                subTab === 'verifications'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Admission Verifications ({approvedOrVerifiedApps.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('templates')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                subTab === 'templates'
                  ? 'bg-blue-950 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Email Templates
            </button>
          </div>

          <button
            type="button"
            onClick={fetchLogsAndTemplates}
            className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </button>
        </div>

        {/* SUB-TAB 1: SENT EMAIL HISTORY */}
        {subTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipient email, reference number, or subject..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'Sent' | 'Failed')}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="Sent">Sent Only</option>
                <option value="Failed">Failed Only</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="ALL">All Email Types</option>
                <option value="password_reset">Password Reset</option>
                <option value="admission_approved">Admission Approved</option>
                <option value="admission_verification">Admission Verification</option>
                <option value="admission_rejected">Admission Rejected</option>
                <option value="admission_more_info">More Info Request</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs min-w-[720px] tabular-nums">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Sanitized Summary</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No email delivery logs match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.sentAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-semibold text-blue-800 dark:text-sky-400">
                          {log.recipientEmail}
                        </td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                          {log.emailType}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{log.subject}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{log.sanitizedSummary}</p>
                          {log.errorMessage && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{log.errorMessage}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'Sent'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {log.status} {log.retryCount > 0 ? `(Retry x${log.retryCount})` : ''}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {log.status === 'Failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetryEmail(log.id)}
                              disabled={retryingLogId === log.id}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                            >
                              <Send className="w-3 h-3" />
                              <span>{retryingLogId === log.id ? 'Retrying...' : 'Retry'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: ADMISSION VERIFICATION MONITOR */}
        {subTab === 'verifications' && (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs min-w-[740px] tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Ref #</th>
                  <th className="p-3">Applicant &amp; Grade</th>
                  <th className="p-3">Parent Email</th>
                  <th className="p-3">Decision &amp; Email Status</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {approvedOrVerifiedApps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No reviewed or approved admission applications recorded yet.
                    </td>
                  </tr>
                ) : (
                  approvedOrVerifiedApps.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">{app.refCode}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">{app.studentName}</span>
                        <span className="text-[11px] text-slate-500">{app.gradeCode}</span>
                      </td>
                      <td className="p-3 font-mono text-blue-800 dark:text-sky-400">{app.parentEmail || 'N/A'}</td>
                      <td className="p-3 space-y-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{app.status}</span>
                        <span className="text-[11px] text-slate-500 block">
                          Email: {app.emailDeliveryStatus || 'Sent'}
                          {app.approvalDate ? ` · ${new Date(app.approvalDate).toLocaleDateString()}` : ''}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            app.verificationStatus === 'Verified'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : app.verificationStatus === 'Pending Verification'
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {app.verificationStatus === 'Verified' && <ShieldCheck className="w-3 h-3" />}
                          <span>{app.verificationStatus || 'Unverified'}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {(app.status === 'Approved' || app.status === 'Confirmed & Enrolled') &&
                          app.verificationStatus !== 'Verified' && (
                            <button
                              type="button"
                              onClick={() => handleResendAdmissionCode(app.refCode)}
                              disabled={resendingRef === app.refCode}
                              className="px-2.5 py-1 bg-blue-950 hover:bg-blue-900 text-white font-bold text-[11px] rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                            >
                              <RefreshCw className={`w-3 h-3 ${resendingRef === app.refCode ? 'animate-spin' : ''}`} />
                              <span>{resendingRef === app.refCode ? 'Sending...' : 'Resend Code'}</span>
                            </button>
                          )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUB-TAB 3: EMAIL TEMPLATES EDITOR */}
        {subTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 space-y-2">
              {(Object.keys(TEMPLATE_LABELS) as EmailTemplateConfig['id'][]).map((tplId) => (
                <button
                  key={tplId}
                  type="button"
                  onClick={() => setActiveTemplateId(tplId)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs transition-colors flex items-center gap-2.5 cursor-pointer ${
                    activeTemplateId === tplId
                      ? 'bg-blue-950 text-white border-blue-950 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>{TEMPLATE_LABELS[tplId]}</span>
                </button>
              ))}
            </div>

            <div className="md:col-span-8">
              {templateDraft ? (
                <form
                  onSubmit={handleSaveTemplate}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5 text-xs"
                >
                  <div>
                    <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={templateDraft.subject}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, subject: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                      Introduction Paragraph
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={templateDraft.introParagraph}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, introParagraph: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                      Instructions / Next Steps Paragraph
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={templateDraft.instructionsParagraph}
                      onChange={(e) =>
                        setTemplateDraft({ ...templateDraft, instructionsParagraph: e.target.value })
                      }
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700 dark:text-slate-200">
                      Official Footer Signature
                    </label>
                    <input
                      type="text"
                      required
                      value={templateDraft.footerSignature}
                      onChange={(e) => setTemplateDraft({ ...templateDraft, footerSignature: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingTemplate}
                      className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingTemplate ? 'Saving...' : 'Save Template Changes'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">Loading templates...</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
