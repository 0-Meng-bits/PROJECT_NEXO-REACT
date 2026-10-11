import { supabaseAdmin } from './_supabase.js';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'CTU ID is required.' });

  const { data: profile, error } = await supabaseAdmin
    .from('accounts').select('email').eq('ctu_id', studentId).single();

  if (error || !profile) return res.status(404).json({ message: 'CTU ID not found.' });

  const siteUrl = process.env.SITE_URL || 'https://project-nexo-react.vercel.app';

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
    options: { redirectTo: `${siteUrl}/reset-password` },
  });

  if (linkError) {
    console.error('[FORGOT PASSWORD] Link error:', linkError.message);
    return res.status(400).json({ message: linkError.message });
  }

  // Try Resend first (works on cloud/Render), fall back to Gmail locally
  if (process.env.RESEND_API_KEY) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'NEXO Connect <onboarding@resend.dev>',
        to: profile.email,
        subject: 'Reset your NEXO Connect password',
        html: buildEmailHtml(linkData.properties.action_link),
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.json().catch(() => ({}));
      console.error('[FORGOT PASSWORD] Resend error:', errBody);
      // Fall through to Gmail if Resend fails
      if (!process.env.GMAIL_USER) {
        return res.status(400).json({ message: errBody.message || 'Failed to send reset email.' });
      }
    } else {
      return res.status(200).json({ message: 'Password reset email sent.' });
    }
  }

  // Gmail fallback (works locally)
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.status(500).json({ message: 'Email service not configured.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"NEXO Connect" <${process.env.GMAIL_USER}>`,
      to: profile.email,
      subject: 'Reset your NEXO Connect password',
      html: buildEmailHtml(linkData.properties.action_link),
    });
  } catch (emailErr) {
    console.error('[FORGOT PASSWORD] Gmail error:', emailErr.message);
    return res.status(400).json({ message: emailErr.message || 'Failed to send reset email.' });
  }

  res.status(200).json({ message: 'Password reset email sent.' });
}

function buildEmailHtml(actionLink) {
  return `
    <div style="font-family:monospace;background:#0d0d12;color:white;padding:32px;border-radius:8px;">
      <h2 style="color:#00f0ff;letter-spacing:2px;">NEXO CONNECT</h2>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${actionLink}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#f5e642;color:#0d0d12;font-weight:bold;text-decoration:none;border-radius:4px;">
        RESET PASSWORD
      </a>
      <p style="color:#666;font-size:12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `;
}
