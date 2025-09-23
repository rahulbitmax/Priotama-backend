import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
export const sendOtp = async (email, otp) => {
  try {
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
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });

  } catch (error) {
    throw new Error("Email could not be sent");
  }
};
