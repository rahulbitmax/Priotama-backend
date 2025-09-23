import User from "../models/User.js";
import bcrypt from "bcryptjs";

// Get own profile
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
};

// Update profile (name, phone, instaId only)
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, instaId } = req.body;
    
    // Validate required fields
    if (!name && !phone && !instaId) {
      return res.status(400).json({ 
        message: "At least one field (name, phone, or instaId) is required" 
      });
    }

    // Prepare updates object
    const updates = {};
    
    // Update name if provided
    if (name) {
      updates.name = name.trim();
    }
    
    // Update phone if provided
    if (phone) {
      // Check if phone already exists for another user
      const existingPhone = await User.findOne({ 
        phone: phone.trim(), 
        _id: { $ne: req.user.id } 
      });
      
      if (existingPhone) {
        return res.status(400).json({ 
          message: "Phone number already exists for another user" 
        });
      }
      
      updates.phone = phone.trim();
    }
    
    // Update instaId if provided (can be empty string to clear it)
    if (instaId !== undefined) {
      updates.instaId = instaId.trim() || undefined;
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id, 
      updates, 
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
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
        profilePic: user.profilePic ? {
          data: user.profilePic.data.toString('base64'),
          contentType: user.profilePic.contentType
        } : null,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    // Validate password confirmation
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ 
        message: "New passwords do not match" 
      });
    }

    // Get user with password
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPassword) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: "New password must be different from your current password" 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Opposite gender profiles
export const getOppositeGenderUsers = async (req, res) => {
  const currentUser = await User.findById(req.user.id);
  const oppositeGender = currentUser.gender === "Male" ? "Female" : "Male";

  const users = await User.find({ gender: oppositeGender, isVerified: true, isBlocked: false })
    .select("name age location profilePic");

  res.json(users);
};
