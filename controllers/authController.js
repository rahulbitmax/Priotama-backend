import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendOtp } from "../utils/sendOtp.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

const getPhoneVariations = (phone) => [
  phone,
  phone.replace(/\s/g, ''),
  phone.replace(/\+/g, ''),
  phone.replace(/\+|\s/g, ''),
];

const tempUserStorage = new Map();

const cleanupExpiredData = () => {
  const now = new Date();
  for (const [tempId, data] of tempUserStorage.entries()) {
    if (now > data.expiresAt) {
      tempUserStorage.delete(tempId);
    }
  }
};

setInterval(cleanupExpiredData, 5 * 60 * 1000);
export const registerUser = async (req, res) => {
  try {
    const { name, email, country, state, code, phone, gender, age, profession, hobby, instaId, password, confirmPassword } = req.body;
    
    if (!name || !email || !country || !state || !code || !phone || !gender || !age || !profession || !hobby || !instaId || !password) {
      return res.status(400).json({ 
        message: "All fields are required." 
      });
    }

    const sanitizedName = name.replace(/\s+/g, ' ').trim();
    const sanitizedGender = gender.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.replace(/\D/g, ''); // Remove all non-digits
    const normalizedCode = code.replace(/\D/g, ''); // Remove all non-digits
    
    // Validate phone number format (8-15 digits)
    if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
      return res.status(400).json({ 
        message: "Phone number must be between 8 to 15 digits" 
      });
    }
    
    // Format phone number consistently: "+91 7371832881"
    const fullPhone = `+${normalizedCode} ${normalizedPhone}`;

    if (!["Male", "Female"].includes(sanitizedGender)) {
      return res.status(400).json({ 
        message: "Invalid gender value. Must be 'Male' or 'Female'" 
      });
    }

    if (isNaN(age) || age < 18 || age > 100) {
      return res.status(400).json({ 
        message: "Age must be a valid number between 18 and 100" 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        message: "Passwords do not match" 
      });
    }

    const userExistsByEmail = await User.findOne({ email: normalizedEmail });
    
    const phoneVariations = [
      ...getPhoneVariations(fullPhone),
      normalizedPhone,
      `${normalizedCode}${normalizedPhone}`,
    ];
    
    const userExistsByPhone = await User.findOne({ 
      phone: { $in: phoneVariations } 
    });
    
    if (userExistsByEmail && userExistsByPhone) {
      return res.status(400).json({ message: "Email and phone number both already exist" });
    } else if (userExistsByEmail) {
      return res.status(400).json({ message: "Email already exists" });
    } else if (userExistsByPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (!req.file) {
      return res.status(400).json({ 
        message: "Profile picture is required" 
      });
    }
    
    const maxSize = 500 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        message: "Maximum profile picture size is 500KB" 
      });
    }
    
    const imageBuffer = req.file.buffer;
    const imageMimetype = req.file.mimetype;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tempId = Date.now().toString() + Math.random().toString(36).substring(2, 15);

    const tempUserData = {
      name: sanitizedName,
      email: normalizedEmail,
      phone: fullPhone,
      country: country.trim(),
      state: state.trim(),
      gender: sanitizedGender,
      age: parseInt(age),
      profession: profession.trim(),
      hobby: hobby.trim(),
      instaId: instaId.trim(),
      imageBuffer: imageBuffer,
      imageMimetype: imageMimetype,
      password: hashedPassword,
      otp: otp,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    };

    tempUserStorage.set(tempId, tempUserData);
    await sendOtp(email, otp);

    res.status(201).json({
      message: "OTP sent for verification on your email",
      tempId: tempId
    });
  } catch (err) {
    if (err.code === 11000) {
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
    
    res.status(500).json({ message: err.message });
  }
};

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

    const existingUserByEmail = await User.findOne({ email: tempUserData.email });
    const existingUserByPhone = await User.findOne({ 
      phone: { $in: getPhoneVariations(tempUserData.phone) } 
    });
    
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

// Temporary storage for password reset OTPs
const resetOtpStorage = new Map();

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

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Store OTP temporarily with expiration (15 minutes)
    resetOtpStorage.set(resetToken, {
      otp: otp,
      userId: user._id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
    });

    // Send OTP via email
    await sendOtp(email, otp);

    res.json({
      message: "OTP sent to your email for password reset.",
      resetToken: resetToken
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

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

    // Get stored OTP data
    const resetOtpData = resetOtpStorage.get(resetToken);
    if (!resetOtpData) {
      return res.status(404).json({ message: "Reset session not found or expired" });
    }

    // Check if reset session has expired
    if (new Date() > resetOtpData.expiresAt) {
      resetOtpStorage.delete(resetToken);
      return res.status(400).json({ message: "Reset session expired. Please request a new password reset." });
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

    // Verify OTP matches the one sent
    if (resetOtpData.otp !== otp) {
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

    // Clean up the reset session
    resetOtpStorage.delete(resetToken);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
