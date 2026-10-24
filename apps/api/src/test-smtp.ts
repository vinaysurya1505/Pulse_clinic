import nodemailer from 'nodemailer';

async function main() {
  console.log('Testing SMTP connection...');
  console.log('Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
  console.log('User:', process.env.SMTP_USER);
  console.log('Target Superadmin:', process.env.SUPER_ADMIN_EMAIL);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    console.log('Verifying transporter credentials...');
    await transporter.verify();
    console.log('Transporter verified successfully!');

    console.log('Sending test email to:', process.env.SUPER_ADMIN_EMAIL);
    const info = await transporter.sendMail({
      from: `"PulseClinic Pharmacy" <${process.env.SMTP_USER}>`,
      to: process.env.SUPER_ADMIN_EMAIL,
      subject: 'PulseClinic SMTP Setup Verified Successfully',
      text: 'Congratulations! Your PulseClinic SMTP mailer has been configured successfully with Gmail App Password.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
          <h2 style="color: #2563eb; margin: 0 0 16px 0; font-size: 20px;">PulseClinic Security & Approvals</h2>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <p style="color: #166534; font-weight: bold; margin: 0 0 8px 0; font-size: 15px;">✓ SMTP Configuration Live & Verified</p>
            <p style="color: #15803d; margin: 0; font-size: 13px;">
              Your SMTP sender <strong>${process.env.SMTP_USER}</strong> is now authenticated and successfully sending alerts to <strong>${process.env.SUPER_ADMIN_EMAIL}</strong>.
            </p>
          </div>
          <p style="font-size: 13px; color: #475569; line-height: 1.5;">
            Refund approval OTPs, critical inventory breach alerts, and schedule H1 narcotics transaction audit summaries will now be delivered to your inbox in real time.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">PulseClinic Pharmacy Management System • Automated Diagnostic</p>
        </div>
      `,
    });

    console.log('Email sent successfully! Message ID:', info.messageId);
    process.exit(0);
  } catch (error: any) {
    console.error('SMTP Verification or Delivery Failed:', error);
    process.exit(1);
  }
}

main();
