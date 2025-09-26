import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendOtp = async (email, otp) => {
  try {
    // Check if required environment variables are present
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email configuration missing: EMAIL_USER and EMAIL_PASS must be set in environment variables");
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.bitmaxtest.com",
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 15000,     // 15 seconds
    });

    // Verify connection before sending
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SMTP connection verified successfully");

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });

    console.log(`OTP email sent successfully to ${email}`);

  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};