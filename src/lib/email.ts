import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailPassword = process.env.GMAIL_APP_PASSWORD;

// Create reusable transporter
const transporter =
  gmailUser && gmailPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
      })
    : null;

function ensureTransporter(to: string): void {
  if (!transporter) {
    console.warn("Email not configured. Unable to send email to:", to);
    throw new Error("Email transporter not configured");
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  try {
    ensureTransporter(to);
  } catch {
    return;
  }

  const verificationUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: `"Quick Way Car Wash" <${gmailUser}>`,
    to,
    subject: "Verify your email address",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563EB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Quick Way Car Wash!</h1>
            </div>
            <div class="content">
              <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
              <p>Click the button below to verify your email. This link will expire in <strong>30 minutes</strong>.</p>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563EB;">${verificationUrl}</p>
              <p>If you didn't create this account, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Quick Way Car Wash. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  if (!transporter) return;
  await transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  try {
    ensureTransporter(to);
  } catch {
    return;
  }

  const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${token}`;

  const mailOptions = {
    from: `"Quick Way Car Wash" <${gmailUser}>`,
    to,
    subject: "Reset your password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #2563EB; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>We received a request to reset your password for your Quick Way Car Wash account.</p>
              <p>Click the button below to reset your password. This link will expire in <strong>30 minutes</strong>.</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563EB;">${resetUrl}</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged. For security, consider changing your password if you suspect unauthorized access.
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Quick Way Car Wash. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  if (!transporter) return;
  await transporter.sendMail(mailOptions);
}

export async function sendFreeWashCouponEmail({
  to,
  name,
  couponCode,
  expiresAt,
  maxValueCents,
}: {
  to: string;
  name?: string | null;
  couponCode: string;
  expiresAt: Date;
  maxValueCents: number;
}): Promise<void> {
  try {
    ensureTransporter(to);
  } catch {
    return;
  }

  const displayName = name?.trim() || "there";
  const formattedAmount = (maxValueCents / 100).toFixed(2);
  const expiresOn = expiresAt.toLocaleDateString("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const mailOptions = {
    from: `"Quick Way Car Wash" <${gmailUser}>`,
    to,
    subject: "You've earned a free wash!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f8fafc; }
            .container { max-width: 640px; margin: 0 auto; padding: 24px; }
            .card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1); }
            .badge { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #0f172a; background: #e0f2fe; padding: 6px 14px; border-radius: 999px; font-weight: 600; }
            .code { font-size: 28px; font-weight: 700; letter-spacing: 0.2em; text-align: center; color: #0f172a; padding: 18px; border: 1px dashed #94a3b8; border-radius: 12px; margin: 20px 0; background: #f8fafc; }
            .steps { margin: 24px 0; padding: 0; list-style: none; }
            .steps li { display: flex; gap: 14px; margin-bottom: 12px; }
            .steps li span { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; background: #2563EB; color: white; font-weight: 600; }
            .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="badge">Free Wash Unlocked</div>
              <h1 style="margin-top: 16px; font-size: 24px;">Congrats, ${displayName}! 🎉</h1>
              <p style="font-size: 16px; color: #475569;">
                You just completed the required number of washes — enjoy a complimentary service on us.
                This reward covers <strong>100% of your next booking up to AED ${formattedAmount}</strong>.
              </p>
              <div class="code">${couponCode}</div>
              <p style="font-size: 14px; color: #475569; text-align: center; margin-top: -8px;">
                Valid through <strong>${expiresOn}</strong>
              </p>
              <h2 style="margin-top: 32px; font-size: 18px;">How to redeem:</h2>
              <ul class="steps">
                <li><span>1</span> Open the Quick Way Car Wash app or website and book your next service (up to AED ${formattedAmount}).</li>
                <li><span>2</span> On the payment step, tap “Add coupon” and enter the code above.</li>
                <li><span>3</span> Confirm your booking — the discount will cover 100% of the service price up to AED ${formattedAmount}.</li>
              </ul>
              <p style="font-size: 14px; color: #475569;">
                Need help or have questions? Reply to this email and our support team will take care of you.
              </p>
              <p style="margin-top: 24px; font-size: 16px; font-weight: 600;">Happy washing! 🚗✨</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} Quick Way Car Wash · Dubai, UAE
            </div>
          </div>
        </body>
      </html>
    `,
  };

  if (!transporter) return;
  await transporter.sendMail(mailOptions);
}
