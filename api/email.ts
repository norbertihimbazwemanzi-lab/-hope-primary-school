import nodemailer from 'nodemailer';

const SCHOOL_OFFICIAL_EMAIL = process.env.SCHOOL_GMAIL || 'norbertihimbazwemanzi@gmail.com';

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
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    const info = await transporter.sendMail({
      from: `"Mugina Hope Academy" <${SCHOOL_OFFICIAL_EMAIL}>`,
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
    return res.status(500).json({
      error: error.message || 'Failed to dispatch email via serverless function',
    });
  }
}
