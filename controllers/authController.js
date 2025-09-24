import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import TempUser from "../models/TempUser.js";
import Otp from "../models/Otp.js";
import { sendOtp } from "../utils/sendOtp.js";

// ---------------- REGISTER ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, gender, age, location, instald, instaId, hobby, password, confirmPassword } = req.body;
    
    // Normalize name: collapse multiple spaces and trim
    const sanitizedName = name ? name.replace(/\s+/g, ' ').trim() : name;
    
    // Sanitize gender field - trim whitespace and ensure proper case
    const sanitizedGender = gender ? gender.trim() : gender;
    
    // Normalize email and phone
    const normalizedEmail = email ? email.toLowerCase().trim() : email;
    const normalizedPhone = phone ? phone.trim() : phone;

    // Validate gender
    if (sanitizedGender && !["Male", "Female"].includes(sanitizedGender)) {
      return res.status(400).json({ 
        message: "Invalid gender value. Must be 'Male' or 'Female'" 
      });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        message: "Passwords do not match" 
      });
    }

    // Check if user already exists in User collection
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // Check if user already exists in TempUser collection
    const tempUserExists = await TempUser.findOne({ email: normalizedEmail });
    if (tempUserExists) {
      // Delete existing temp user and OTP
      await TempUser.deleteOne({ email: normalizedEmail });
      await Otp.deleteMany({ userId: tempUserExists._id });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle profilePic from multer memory (req.file)
    let profilePicDoc = undefined;
    if (req.file) {
      profilePicDoc = {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      };
    }

    // Create temporary user (not in User collection yet)
    const tempUser = await TempUser.create({
      name: sanitizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      gender: sanitizedGender,
      age,
      location,
      instaId: instald || instaId || undefined, // Use instald from form data, fallback to instaId, or undefined if empty
      hobby,
      profilePic: profilePicDoc,
      password: hashedPassword,
    });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await Otp.create({
      userId: tempUser._id,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // expires in 5 min
    });

    // Send OTP via email/SMS
    await sendOtp(email, otp);

    res.status(201).json({
      message: "OTP sent for verification",
      tempUserId: tempUser._id,
      // No file path now; image is stored in DB
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- VERIFY OTP ----------------
export const verifyOtp = async (req, res) => {
  try {
    const { tempUserId, otp } = req.body;
    
    // Validate required fields
    if (!tempUserId || !otp) {
      return res.status(400).json({ 
        message: "Temp User ID and OTP are required" 
      });
    }

    // Find temporary user by ID
    const tempUser = await TempUser.findById(tempUserId);
    if (!tempUser) return res.status(404).json({ message: "Temporary user not found or expired" });

    const otpRecord = await Otp.findOne({ userId: tempUser._id });
    if (!otpRecord) return res.status(400).json({ message: "OTP expired or not found" });

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) return res.status(400).json({ message: "Invalid OTP" });

    // Check if user already exists in User collection (double check)
    const existingUser = await User.findOne({ email: tempUser.email });
    if (existingUser) {
      // Clean up temp data
      await TempUser.deleteOne({ _id: tempUser._id });
      await Otp.deleteMany({ userId: tempUser._id });
      return res.status(400).json({ message: "User already exists" });
    }

    // Create actual user in User collection
    const user = await User.create({
      name: tempUser.name,
      email: tempUser.email,
      phone: tempUser.phone,
      gender: tempUser.gender,
      age: tempUser.age,
      location: tempUser.location,
      instaId: tempUser.instaId,
      hobby: tempUser.hobby,
      profilePic: tempUser.profilePic,
      password: tempUser.password,
      isVerified: true, // Set as verified since OTP is confirmed
    });

    // Clean up temporary data
    await TempUser.deleteOne({ _id: tempUser._id });
    await Otp.deleteMany({ userId: tempUser._id });

    res.json({ 
      message: "Account Created Successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        age: user.age,
        location: user.location,
        instaId: user.instaId,
        hobby: user.hobby,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ---------------- LOGIN ----------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Trim email to handle newline characters
    const trimmedEmail = email ? email.toLowerCase().trim() : email;
    
    // Search for user with trimmed email or email with newline
    const user = await User.findOne({ 
      $or: [
        { email: trimmedEmail },
        { email: trimmedEmail + '\n' }
      ]
    });
    
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (!user.isVerified) return res.status(403).json({ message: "User not verified" });
    if (user.isBlocked) return res.status(403).json({ message: "User blocked" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name ? user.name.replace(/\s+/g, ' ').trim() : user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        age: user.age,
        location: user.location,
        instaId: user.instaId,
        hobby: user.hobby,
        profilePic: user.profilePic ? {
          data: user.profilePic.data.toString('base64'),
          contentType: user.profilePic.contentType
        } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- FORGOT PASSWORD ----------------
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Trim email to handle newline characters
    const trimmedEmail = email ? email.trim() : email;
    
    // Find user by email
    const user = await User.findOne({ 
      $or: [
        { email: trimmedEmail },
        { email: trimmedEmail + '\n' }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ message: "User not verified" });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Delete any existing OTP for this user
    await Otp.deleteMany({ userId: user._id });

    // Create new OTP
    await Otp.create({
      userId: user._id,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // expires in 5 min
    });

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Send OTP via email
    await sendOtp(email, otp);

    res.json({
      message: "OTP sent to your email for password reset",
      resetToken: resetToken,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, otp, newPassword, confirmNewPassword } = req.body;
    
    // Validate required fields
    if (!resetToken) {
      return res.status(400).json({ message: "Reset token is required" });
    }
    
    // Validate password confirmation
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ 
        message: "New passwords do not match" 
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({ userId: user._id });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    // Verify OTP
    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if new password is different from current password
    const isCurrentPassword = await bcrypt.compare(newPassword, user.password);
    if (isCurrentPassword) {
      return res.status(400).json({ 
        message: "New password must be different from your current password" 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Delete OTP record
    await Otp.deleteMany({ userId: user._id });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
