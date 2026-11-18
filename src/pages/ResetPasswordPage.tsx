import React, { useEffect, useState } from 'react';
import { PageId } from '../types';
import { verifyResetToken, submitPasswordReset } from '../services/authService';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (page: PageId) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onNavigate }) => {
  const [token, setToken] = useState('');
  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = (params.get('token') || '').trim();
    setToken(t);

    if (!t) {
      setCheckingToken(false);
      setTokenValid(false);
      setTokenError('No password reset token was found in this link. Please request a new reset email from the Portal Login screen.');
      return;
    }

    let cancelled = false;
    verifyResetToken(t).then((res) => {
      if (cancelled) return;
      setCheckingToken(false);
      if (res.valid) {
        setTokenValid(true);
        setExpiresAt(res.expiresAt || null);
      } else {
        setTokenValid(false);
        setTokenError(res.reason || 'This password reset link is invalid or has expired.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (cleanNew.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setSubmitError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    const res = await submitPasswordReset(token, cleanNew, cleanConfirm);
    setSubmitting(false);

    if (res.success) {
      setResetSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setSubmitError(res.message);
    }
  };

  const passwordStrength =
    newPassword.length === 0
      ? null
      : newPassword.length >= 12 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)
      ? { label: 'Strong', color: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-600 w-full' }
      : newPassword.length >= 8
      ? { label: 'Adequate', color: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500 w-2/3' }
      : { label: 'Too short (min 8 chars)', color: 'text-rose-700 dark:text-rose-400', bar: 'bg-rose-600 w-1/3' };

  return (
    <div className="min-h-[75vh] py-12 px-4 sm:px-6 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
        <div className="bg-blue-950 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-blue-950 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Mugina Hope Primary School</h1>
              <p className="text-xs text-amber-300 italic">&ldquo;We learn for our better future&rdquo;</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-blue-100">
            Secure Account Password Reset &bull; Single-Use Verification
          </p>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {checkingToken ? (
            <div className="py-10 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-blue-800 dark:text-sky-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Validating your password reset link...
              </p>
            </div>
          ) : resetSuccess ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Password Reset Successful
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your account password has been updated securely and synchronized. Your reset link has now been marked as used.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="w-full py-2.5 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Return to Portal Login
              </button>
            </div>
          ) : !tokenValid ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    Reset Link Invalid or Expired
                  </h2>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                    {tokenError}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="w-full py-2.5 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Go to Portal Login to Request New Link</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Create Your New Password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter a strong password of at least 8 characters.
                  {expiresAt ? ` Link valid until ${new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : ''}
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordStrength && (
                  <div className="space-y-1 pt-0.5">
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all ${passwordStrength.bar}`} />
                    </div>
                    <p className={`text-[11px] font-semibold ${passwordStrength.color}`}>
                      Strength: {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 pr-10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Save New Password</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                Back to Portal Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
