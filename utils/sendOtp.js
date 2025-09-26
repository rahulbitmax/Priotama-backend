import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
export const sendOtp = async (email, otp) => {
  try {
    // Check if required environment variables are present
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email configuration missing: EMAIL_USER and EMAIL_PASS must be set in environment variables");
    }

    const smtpSecure = process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : true; // default to true for port 465

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.bitmaxtest.com",
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Add timeout and connection settings for cloud deployment
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 60000,     // 60 seconds
      // Add TLS options for better compatibility
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
        ciphers: 'SSLv3'
      }
    });

    // Verify connection configuration
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SMTP connection verified successfully");

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });

  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};
