import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendOtp } from "../utils/sendOtp.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

// Temporary storage for unverified users (in production, use Redis or database)
const tempUserStorage = new Map();

// Cleanup function to remove expired temporary data
const cleanupExpiredData = () => {
  const now = new Date();
  for (const [tempId, data] of tempUserStorage.entries()) {
    if (now > data.expiresAt) {
      tempUserStorage.delete(tempId);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredData, 5 * 60 * 1000);

// ---------------- REGISTER ----------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, country, state, code, phone, gender, age, profession, hobby, instaId, password, confirmPassword } = req.body;
    
    // Validate required fields (all fields required except instaId)
    if (!name || !email || !country || !state || !code || !phone || !gender || !age || !profession || !hobby || !password) {
      return res.status(400).json({ 
        message: " Only instaId is optional." 
      });
    }

    // Normalize name: collapse multiple spaces and trim
    const sanitizedName = name.replace(/\s+/g, ' ').trim();
    
    // Sanitize gender field - trim whitespace and ensure proper case
    const sanitizedGender = gender.trim();
    
    // Normalize email and phone
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();
    
    // Format phone number with country code: "+91 7371832881"
    const fullPhone = `${normalizedCode} ${normalizedPhone}`;

    // Validate gender
    if (!["Male", "Female"].includes(sanitizedGender)) {
      return res.status(400).json({ 
        message: "Invalid gender value. Must be 'Male' or 'Female'" 
      });
    }

    // Validate age
    if (isNaN(age) || age < 1 || age > 120) {
      return res.status(400).json({ 
        message: "Age must be a valid number between 1 and 120" 
      });
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        message: "Passwords do not match" 
      });
    }

    // Check if user already exists in User collection (by email and phone)
    const userExistsByEmail = await User.findOne({ email: normalizedEmail });
    const userExistsByPhone = await User.findOne({ phone: fullPhone });
    
    if (userExistsByEmail && userExistsByPhone) {
      return res.status(400).json({ message: "Email and phone number both already exist" });
    } else if (userExistsByEmail) {
      return res.status(400).json({ message: "Email already exists" });
    } else if (userExistsByPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle profilePic from Cloudinary (req.file) - now required
    if (!req.file) {
      return res.status(400).json({ 
        message: "Profile picture is required" 
      });
    }
    
    // Check file size (500KB limit)
    const maxSize = 500 * 1024; // 500KB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        message: "Maximum profile picture size is 500KB" 
      });
    }
    
    // Store image buffer temporarily (don't upload to Cloudinary yet)
    const imageBuffer = req.file.buffer;
    const imageMimetype = req.file.mimetype;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Generate temporary ID for this registration
    const tempId = Date.now().toString() + Math.random().toString(36).substring(2, 15);

    // Store user data temporarily (expires in 10 minutes)
    const tempUserData = {
      name: sanitizedName,
      email: normalizedEmail,
      phone: fullPhone, // Format: "+91 7371832881"
      country: country.trim(),
      state: state.trim(),
      gender: sanitizedGender,
      age: parseInt(age),
      profession: profession.trim(),
      hobby: hobby.trim(),
      instaId: instaId || undefined, // Only this field is optional
      imageBuffer: imageBuffer, // Store image buffer temporarily
      imageMimetype: imageMimetype, // Store image mimetype
      password: hashedPassword,
      otp: otp,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    };

    // Store in temporary storage
    tempUserStorage.set(tempId, tempUserData);

    // Send OTP via email
    await sendOtp(email, otp);

    res.status(201).json({
      message: "OTP sent for verification on your email",
      tempId: tempId
    });
  } catch (err) {
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      // Check which field caused the duplicate key error
      if (err.keyPattern && err.keyPattern.phone && err.keyPattern.email) {
        return res.status(400).json({ message: "Email and phone number both already exist" });
      } else if (err.keyPattern && err.keyPattern.phone) {
        return res.status(400).json({ message: "Phone number already exists" });
      } else if (err.keyPattern && err.keyPattern.email) {
        return res.status(400).json({ message: "Email already exists" });
      } else {
        return res.status(400).json({ message: "User with this information already exists" });
      }
    }
    
    // Handle other errors
    res.status(500).json({ message: err.message });
  }
};

// ---------------- VERIFY OTP ----------------
export const verifyOtp = async (req, res) => {
  try {
    const { tempId, otp } = req.body;
    
    // Validate required fields
    if (!tempId || !otp) {
      return res.status(400).json({ 
        message: "Temp ID and OTP are required" 
      });
    }

    // Get temporary user data
    const tempUserData = tempUserStorage.get(tempId);
    if (!tempUserData) {
      return res.status(404).json({ message: "Registration session not found or expired" });
    }

    // Check if registration session has expired
    if (new Date() > tempUserData.expiresAt) {
      tempUserStorage.delete(tempId);
      return res.status(400).json({ message: "Registration session expired. Please register again." });
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP format" });
    }

    // Verify OTP
    if (tempUserData.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Check if user already exists in database (double-check)
    const existingUserByEmail = await User.findOne({ email: tempUserData.email });
    const existingUserByPhone = await User.findOne({ phone: tempUserData.phone });
    
    if (existingUserByEmail || existingUserByPhone) {
      tempUserStorage.delete(tempId);
      return res.status(400).json({ message: "User already exists" });
    }

    // Upload image to Cloudinary only after successful OTP verification
    const result = await uploadToCloudinary(tempUserData.imageBuffer);
    
    const profilePicDoc = {
      url: result.secure_url, // Cloudinary URL
      publicId: result.public_id, // Cloudinary public ID
    };

    // Create user in database after successful OTP verification
    const user = await User.create({
      name: tempUserData.name,
      email: tempUserData.email,
      phone: tempUserData.phone,
      country: tempUserData.country,
      state: tempUserData.state,
      gender: tempUserData.gender,
      age: tempUserData.age,
      profession: tempUserData.profession,
      hobby: tempUserData.hobby,
      instaId: tempUserData.instaId,
      profilePic: profilePicDoc,
      password: tempUserData.password,
      isVerified: true, // User is verified after OTP confirmation
    });

    // Clean up temporary data
    tempUserStorage.delete(tempId);

    res.json({ 
      message: "Account verified and created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        state: user.state,
        gender: user.gender,
        age: user.age,
        profession: user.profession,
        hobby: user.hobby,
        instaId: user.instaId,
        profilePic: user.profilePic ? {
          url: user.profilePic.url,
          publicId: user.profilePic.publicId
        } : null,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({ message: "User already exists" });
    }
    
    res.status(500).json({ message: "Internal server error" });
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
        country: user.country,
        state: user.state,
        gender: user.gender,
        age: user.age,
        profession: user.profession,
        hobby: user.hobby,
        instaId: user.instaId,
        profilePic: user.profilePic ? {
          url: user.profilePic.url,
          publicId: user.profilePic.publicId
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

    // Generate OTP (but don't store in database)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Send OTP via email (without storing in database)
    await sendOtp(email, otp);

    res.json({
      message: "OTP sent to your email for password reset.",
      resetToken: resetToken // Still return for frontend to store temporarily
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPassword = async (req, res) => {
  try {
    const { otp, newPassword, confirmNewPassword } = req.body;
    
    // Get reset token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Reset token is required in Authorization header" });
    }
    
    const resetToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
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
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate OTP format
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Invalid OTP format" });
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

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
