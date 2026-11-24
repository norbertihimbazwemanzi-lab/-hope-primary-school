/**
 * Mugina Hope Academy - Multi-Tier Hosted Email Dispatch Service
 * Works seamlessly in local development, on Vercel Serverless Functions,
 * and includes automatic fallback logging and direct mailto link generators.
 */

export const SCHOOL_OFFICIAL_EMAIL = 'norbertihimbazwemanzi@gmail.com';

export interface EmailDispatchOptions {
  to: string;
  subject: string;
  html: string;
  type?: 'admission_confirm' | 'attendance_alert' | 'contact_inquiry' | 'registration_receipt';
  details?: Record<string, any>;
}

export interface EmailDispatchResult {
  success: boolean;
  message: string;
  provider: 'vercel-serverless' | 'local-express' | 'error' | 'mailto-fallback';
}

const getStaffHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const staffToken = sessionStorage.getItem('mugina_staff_bearer_token');
    if (staffToken) headers.Authorization = `Bearer ${staffToken}`;
  }
  return headers;
};

/**
 * Dispatches an email notification via Vercel serverless /api/email or backend Express /api endpoints
 */
export const dispatchOfficialEmail = async (
  options: EmailDispatchOptions
): Promise<EmailDispatchResult> => {
  const { to, subject, html, type, details } = options;
  let lastError = 'SMTP mail server is unavailable or not configured.';

  // 1. Try /api/email endpoint
  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      credentials: 'include',
      headers: getStaffHeaders(),
      body: JSON.stringify({
        to,
        subject,
        html,
        type,
        details,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      return {
        success: true,
        message: 'Email dispatched successfully via hosted mail gateway.',
        provider: 'vercel-serverless',
      };
    }
    if (data?.error) lastError = data.error;
  } catch (err: any) {
    lastError = err?.message || lastError;
  }

  // 2. Try type-specific fallback endpoints if available
  if (type === 'admission_confirm') {
    try {
      const res = await fetch('/api/admissions/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: getStaffHeaders(),
        body: JSON.stringify(details || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        return {
          success: true,
          message: 'Admission confirmation dispatched successfully.',
          provider: 'local-express',
        };
      }
      if (data?.error) lastError = data.error;
    } catch {}
  } else if (type === 'attendance_alert') {
    try {
      const res = await fetch('/api/attendance/notify', {
        method: 'POST',
        credentials: 'include',
        headers: getStaffHeaders(),
        body: JSON.stringify(details || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        return {
          success: true,
          message: 'Attendance notice dispatched successfully.',
          provider: 'local-express',
        };
      }
      if (data?.error) lastError = data.error;
    } catch {}
  }

  return {
    success: false,
    message: lastError,
    provider: 'error',
  };
};

/**
 * Creates an instant mailto URI for emergency 1-click email client opening
 */
export const createDirectMailtoLink = (
  to: string,
  subject: string,
  plainTextBody: string
): string => {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(plainTextBody)}`;
};
