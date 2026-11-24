import crypto from 'crypto';
import nodemailer from 'nodemailer';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

const escapeHtml = (unsafe: string): string =>
  String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isValidEmail = (email: string): boolean => {
  const clean = String(email || '').trim();
  if (!clean || clean.length > 254 || /[\r\n]/.test(clean)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
};

const getSessionSecret = (): string =>
  process.env.SESSION_SECRET || process.env.JWT_SECRET || EPHEMERAL_FALLBACK_SECRET;

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        cookies[k] = decodeURIComponent(v);
      } catch {
        cookies[k] = v;
      }
    }
  });
  return cookies;
};

const verifySignedToken = (token: string, expectedType: 'staff' | 'student'): any | null => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [b64, sig] = parts;
    if (!b64 || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(b64).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!payload || payload.type !== expectedType) return null;
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const getAllowedOrigins = (req: any): string[] => {
  const origins = new Set<string>();
  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (appUrl) origins.add(appUrl);
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) {
    origins.add(`${proto}://${host}`);
    origins.add(`https://${host}`);
  }
  return Array.from(origins);
};

export default async function handler(req: any, res: any) {
  const origin = String(req.headers?.origin || '').replace(/\/+$/, '');
  const allowedOrigins = getAllowedOrigins(req);

  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({ success: false, error: 'Cross-origin request blocked.' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const authHeader = String(req.headers?.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookies = parseCookies(req.headers?.cookie);
  const cookieToken = cookies.mha_session || '';

  const staffSession =
    verifySignedToken(bearerToken, 'staff') || verifySignedToken(cookieToken, 'staff');

  if (!staffSession) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Sign in as authorized school staff to dispatch emails.',
    });
  }

  // CSRF check when using cookie auth without Bearer header
  if (!bearerToken && cookieToken && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ success: false, error: 'Invalid request origin.' });
  }

  try {
    const { to, subject, html, text, replyTo } = req.body || {};

    if (!isValidEmail(to) || !subject || typeof subject !== 'string' || (!html && !text)) {
      return res.status(400).json({
        success: false,
        error: 'Valid recipient email (to), subject, and message content are required.',
      });
    }

    if (/[\r\n]/.test(subject)) {
      return res.status(400).json({ success: false, error: 'Invalid characters in email subject.' });
    }

    if (replyTo && !isValidEmail(replyTo)) {
      return res.status(400).json({ success: false, error: 'Invalid replyTo email address.' });
    }

    const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
    const emailFrom = (process.env.EMAIL_FROM || '').trim() || (gmailUser ? `Mugina Hope Primary School <${gmailUser}>` : '');

    if (!gmailUser || !gmailPass) {
      return res.status(503).json({
        success: false,
        configured: false,
        error:
          'Gmail SMTP is not configured on the server. Set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables.',
      });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    const safeHtml =
      typeof html === 'string' && html.trim()
        ? html
        : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;">${escapeHtml(String(text || '')).replace(/\n/g, '<br/>')}</div>`;

    const info = await transporter.sendMail({
      from: emailFrom,
      to: String(to).trim(),
      replyTo: replyTo ? String(replyTo).trim() : undefined,
      subject: subject.trim().slice(0, 200),
      text: typeof text === 'string' ? text : undefined,
      html: safeHtml,
    });

    return res.status(200).json({
      success: true,
      configured: true,
      messageId: info.messageId,
      message: 'Official school email delivered via Gmail SMTP.',
    });
  } catch (err: any) {
    console.error('[Vercel /api/email] SMTP Error:', err?.message || err);
    return res.status(500).json({
      success: false,
      configured: true,
      error: err?.message || 'Failed to deliver email via Gmail SMTP.',
    });
  }
}
