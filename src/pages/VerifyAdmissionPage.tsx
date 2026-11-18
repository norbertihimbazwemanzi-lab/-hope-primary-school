import React, { useEffect, useState } from 'react';
import { PageId } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  ShieldCheck,
  ArrowRight,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';

interface VerifyAdmissionPageProps {
  onNavigate: (page: PageId) => void;
}

interface VerifiedResult {
  message: string;
  application: {
    refCode: string;
    studentName: string;
    gradeCode: string;
    assignedStudentId: string;
    verificationStatus: string;
    verifiedAt: string;
  };
  nextSteps: string[];
}

export const VerifyAdmissionPage: React.FC<VerifyAdmissionPageProps> = ({ onNavigate }) => {
  const [refCode, setRefCode] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerifiedResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = (params.get('ref') || '').trim().toUpperCase();
    if (refParam) setRefCode(refParam);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResendMsg(null);

    const cleanRef = refCode.trim().toUpperCase();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanRef || !cleanCode) {
      setErrorMsg('Please enter both your Admission Reference Number and the 6-digit Verification Code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admissions/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: cleanRef, code: cleanCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setVerifiedData({
          message: data.message,
          application: data.application,
          nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        });
        setRemainingAttempts(null);
      } else {
        setErrorMsg(data.error || 'Could not verify admission code. Please check your details.');
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
    } catch {
      setErrorMsg('Network error while connecting to verification server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMsg(null);
    setResendMsg(null);
    const cleanRef = refCode.trim().toUpperCase();
    if (!cleanRef) {
      setErrorMsg('Enter your Admission Reference Number first so we can resend your verification code.');
      return;
    }

    setResending(true);
    try {
      const res = await fetch('/api/admissions/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refCode: cleanRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setResendMsg(data.message || 'A fresh verification code has been emailed to the registered parent email.');
        setRemainingAttempts(null);
      } else {
        setErrorMsg(data.error || 'Could not resend verification code at this time.');
      }
    } catch {
      setErrorMsg('Network error while resending verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[75vh] py-12 px-4 sm:px-6 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <div className="bg-blue-950 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-blue-950 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Admission Confirmation &amp; Verification</h1>
              <p className="text-xs text-amber-300 italic">
                Mugina Hope Primary School &bull; &ldquo;We learn for our better future&rdquo;
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-blue-100 leading-relaxed">
            Enter your Admission Reference Number and the 6-digit verification code from your approval email to finalize enrollment.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {verifiedData ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Admission Verified &amp; Confirmed
                  </h2>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    {verifiedData.message}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-semibold">Student Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{verifiedData.application.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-semibold">Enrolled Grade</span>
                  <span className="font-bold text-blue-800 dark:text-sky-400">{verifiedData.application.gradeCode}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-semibold">Admission Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {verifiedData.application.refCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block font-semibold">Assigned Student ID</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {verifiedData.application.assignedStudentId}
                  </span>
                </div>
              </div>

              {verifiedData.nextSteps.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Next Enrollment Steps
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {verifiedData.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-700 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="flex-1 py-2.5 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Open Student &amp; Parent Portal
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Return Home
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">{errorMsg}</p>
                    {remainingAttempts !== null && (
                      <p className="text-[11px] tabular-nums">
                        Remaining verification attempts: <strong>{remainingAttempts}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {resendMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resendMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Admission Reference Number *
                </label>
                <input
                  type="text"
                  required
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MHA-2026-4812"
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                  placeholder="Enter 6-digit code from email"
                  className="w-full text-sm sm:text-base tracking-widest bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono text-center uppercase focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Verifying Admission...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <span>Verify Admission &amp; Confirm Seat</span>
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-blue-800 dark:text-amber-400 hover:underline font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                  <span>{resending ? 'Sending new code...' : 'Resend Verification Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('admissions')}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Admissions</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
