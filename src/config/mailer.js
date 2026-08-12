// src/config/mailer.js

const nodemailer = require('nodemailer')
const dns = require('dns')

// Paksa DNS menyelesaikan IP ke IPv4 terlebih dahulu (Mencegah ENETUNREACH IPv6 di Railway)
dns.setDefaultResultOrder('ipv4first')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Port 587 menggunakan TLS via STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4, // Paksa gunakan IPv4
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  tls: {
    rejectUnauthorized: false
  }
})

// ================================================
// KIRIM OTP REGISTER
// ================================================
const sendOtpRegister = async (email, otpCode) => {
  const mailOptions = {
    from: `"LMS Pancawaluya" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Kode Verifikasi Registrasi - LMS Pancawaluya',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 500px; margin: 0 auto; background-color: #ffffff;">
        <h2 style="color: #0F172A; text-align: center;">LMS Pancawaluya</h2>
        <p style="color: #475569; font-size: 14px; text-align: center;">Portal Pembelajaran Guru SMA</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="color: #334155; font-size: 14px;">Halo,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">
          Terima kasih telah mendaftar di LMS Pancawaluya. Gunakan kode verifikasi di bawah ini:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284C7; background-color: #F0F9FF; padding: 12px 24px; border-radius: 10px; border: 1px dashed #0284C7; display: inline-block;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748B; text-align: center;">
          Kode ini berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapapun.
        </p>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
}

// ================================================
// KIRIM OTP RESET PASSWORD
// ================================================
const sendOtpResetPassword = async (email, otpCode) => {
  const mailOptions = {
    from: `"LMS Pancawaluya" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Kode Reset Password - LMS Pancawaluya',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; max-width: 500px; margin: 0 auto; background-color: #ffffff;">
        <h2 style="color: #0F172A; text-align: center;">LMS Pancawaluya</h2>
        <p style="color: #475569; font-size: 14px; text-align: center;">Portal Pembelajaran Guru SMA</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;" />
        <p style="color: #334155; font-size: 14px;">Halo,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.5;">
          Kami menerima permintaan reset password untuk akun Anda. Gunakan kode di bawah ini:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #DC2626; background-color: #FEF2F2; padding: 12px 24px; border-radius: 10px; border: 1px dashed #DC2626; display: inline-block;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 12px; color: #64748B; text-align: center;">
          Kode ini berlaku selama <strong>10 menit</strong>. Jika kamu tidak merasa meminta reset password, abaikan email ini.
        </p>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
}

module.exports = { sendOtpRegister, sendOtpResetPassword }