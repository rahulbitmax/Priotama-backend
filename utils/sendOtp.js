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

    // Try alternative configuration if primary fails
    const primaryConfig = {
      host: process.env.SMTP_HOST || "mail.bitmaxtest.com",
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Optimized timeout settings for better reliability
      connectionTimeout: 20000, // 20 seconds
      greetingTimeout: 15000,   // 15 seconds
      socketTimeout: 20000,     // 20 seconds
      // Improved TLS configuration
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
        minVersion: 'TLSv1.2',    // Use modern TLS version
        ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
      },
      // Additional connection options for stability
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
      rateLimit: 10 // max 10 emails per second
    };

    // Alternative configuration for better compatibility
    const alternativeConfig = {
      host: process.env.SMTP_HOST || "mail.bitmaxtest.com",
      port: 587, // Try port 587 with STARTTLS
      secure: false, // false for 587, true for 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    };

    let transporter;
    let configUsed = 'primary';

    // Try primary configuration first, then alternative
    console.log("Verifying SMTP connection...");
    let connectionEstablished = false;
    
    // Try primary configuration (port 465 with SSL)
    try {
      transporter = nodemailer.createTransport(primaryConfig);
      await transporter.verify();
      console.log("SMTP connection verified successfully with primary config (port 465)");
      connectionEstablished = true;
    } catch (primaryError) {
      console.log("Primary SMTP config failed, trying alternative...");
      console.log("Primary error:", primaryError.message);
      
      // Try alternative configuration (port 587 with STARTTLS)
      try {
        transporter = nodemailer.createTransport(alternativeConfig);
        await transporter.verify();
        console.log("SMTP connection verified successfully with alternative config (port 587)");
        configUsed = 'alternative';
        connectionEstablished = true;
      } catch (alternativeError) {
        console.log("Alternative SMTP config also failed:", alternativeError.message);
        throw new Error(`Both SMTP configurations failed. Primary: ${primaryError.message}, Alternative: ${alternativeError.message}`);
      }
    }

    // Send email with retry logic
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Your OTP Code",
          text: `Your OTP code is: ${otp}`,
        });
        console.log(`OTP email sent successfully to ${email} using ${configUsed} config`);
        break;
      } catch (sendError) {
        retryCount++;
        console.log(`Email send attempt ${retryCount} failed:`, sendError.message);
        if (retryCount >= maxRetries) {
          throw new Error(`Email sending failed after ${maxRetries} attempts: ${sendError.message}`);
        }
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};
