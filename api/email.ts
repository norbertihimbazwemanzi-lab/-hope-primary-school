import nodemailer from 'nodemailer';

const GMAIL_USER = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s+/g, '');
const EMAIL_FROM_ENV = (process.env.EMAIL_FROM || process.env.SCHOOL_GMAIL || GMAIL_USER || 'norbertihimbazwemanzi@gmail.com').trim();

interface ApiRequest {
  method?: string;
  body?: any;
}

interface ApiResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    json: (body: any) => void;
    end: () => void;
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { to, subject, html, type } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'to, subject, and html are required fields' });
    }

    // Configure SMTP if credentials are provided in Vercel environment
    let transporter: any;
    if (GMAIL_USER && GMAIL_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER,
          pass: GMAIL_APP_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    const fromHeader = EMAIL_FROM_ENV.includes('<')
      ? EMAIL_FROM_ENV
      : `"Mugina Hope Primary School" <${EMAIL_FROM_ENV}>`;

    const info = await transporter.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
    });

    return res.status(200).json({
      success: true,
      message: 'Email processed successfully',
      messageId: info.messageId || 'dispatched',
      type: type || 'notification',
    });
  } catch (error: any) {
    console.error('[Vercel Serverless Email] Error:', error);
    const rawMsg = String(error?.message || 'Failed to dispatch email via serverless function');
    const friendlyMsg =
      /535|BadCredentials|Username and Password not accepted/i.test(rawMsg)
        ? `${rawMsg} — Google Gmail rejected GMAIL_USER/GMAIL_APP_PASSWORD. Enable 2-Step Verification on your Gmail account, generate a new 16-character App Password, and update GMAIL_USER and GMAIL_APP_PASSWORD (no spaces) in environment variables.`
        : rawMsg;
    return res.status(500).json({
      error: friendlyMsg,
    });
  }
}
