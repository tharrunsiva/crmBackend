import nodemailer from 'nodemailer';

const createTransporter = () => {
  // Check if SMTP configs exist, else create a mock resolver
  if (
    !process.env.SMTP_HOST ||
    process.env.SMTP_USER === 'your_smtp_user' ||
    !process.env.SMTP_USER
  ) {
    console.log('Using mock console mail transport because SMTP values are unconfigured.');
    return {
      sendMail: async (mailOptions) => {
        console.log('--- Mock Mail Outbound ---');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Body:\n${mailOptions.text || mailOptions.html}`);
        console.log('--------------------------');
        return { messageId: 'mock-id-' + Date.now() };
      },
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '5887'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Enterprise CRM" <noreply@enterprise-crm.com>',
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Do not crash the server on email failure
    return null;
  }
};

export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Enterprise CRM - Account Created';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563EB;">Welcome to the Company, ${user.name}!</h2>
      <p>Thank you for registering on Enterprise Employee CRM.</p>
      <p><strong>Your Account Details:</strong></p>
      <ul>
        <li><strong>Email:</strong> ${user.email}</li>
        <li><strong>Employee ID:</strong> ${user.employeeId || 'Pending Generation'}</li>
        <li><strong>Role:</strong> ${user.role}</li>
        <li><strong>Status:</strong> Pending Approval</li>
      </ul>
      <p>Your account is currently awaiting administrator approval. You will receive an email confirmation once the administrator approves your profile.</p>
      <p>Best regards,<br>HR Operations Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
};

export const sendApprovalEmail = async (user) => {
  const subject = 'Account Approved - Access Activated';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #22C55E;">Congratulations, ${user.name}!</h2>
      <p>Your account on Enterprise Employee CRM has been approved and activated.</p>
      <p>You can now log in using your credentials and complete your onboarding profile.</p>
      <p><strong>Employee ID:</strong> ${user.employeeId}</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Login to Dashboard</a></p>
      <p>Best regards,<br>HR Operations Team</p>
    </div>
  `;
  return sendEmail({ to: user.email, subject, html });
};

export const sendOTPEmail = async (email, otpCode) => {
  const subject = 'Enterprise CRM - Account Recovery OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #2563EB;">Account Verification</h2>
      <p>You requested a password reset verification code. Use the OTP below to proceed:</p>
      <div style="background-color: #f8fafc; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 4px; padding: 15px; margin: 20px 0; border: 1px dashed #cbd5e1; color: #0f172a;">
        ${otpCode}
      </div>
      <p>This code will expire in 10 minutes. If you did not make this request, please secure your credentials immediately.</p>
      <p>Best regards,<br>IT Security Team</p>
    </div>
  `;
  return sendEmail({ to: email, subject, html });
};
