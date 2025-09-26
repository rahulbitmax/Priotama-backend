import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendOtp = async (email, otp) => {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Email attempt ${attempt}/${maxRetries} for ${email}`);
      
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
        connectionTimeout: 20000, // 20 seconds
        greetingTimeout: 15000,   // 15 seconds
        socketTimeout: 20000,     // 20 seconds
        // Add additional options for better reliability
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        }
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

      console.log(`OTP email sent successfully to ${email} on attempt ${attempt}`);
      return; // Success, exit the function

    } catch (error) {
      lastError = error;
      console.error(`Email attempt ${attempt} failed:`, error.message);
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`Waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  // If all attempts failed, throw the last error
  console.error("All email attempts failed");
  throw new Error(`Email could not be sent after ${maxRetries} attempts: ${lastError.message}`);
};