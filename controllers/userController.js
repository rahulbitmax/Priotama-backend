import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";

// Get own profile
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
};

// Update profile (name, profession, hobby, and profile picture can be edited)
export const updateProfile = async (req, res) => {
  try {
    const { name, profession, hobby } = req.body;
    const hasProfilePic = req.file;
    
    // Validate that at least one field is provided for update
    if (!name && !profession && !hobby && !hasProfilePic) {
      return res.status(400).json({ 
        message: "At least one field (name, profession, hobby, or profile picture) must be provided for update" 
      });
    }

    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare updates object
    const updates = {};
    
    // Update name if provided
    if (name) {
      updates.name = name.trim();
    }
    
    // Update profession if provided
    if (profession) {
      updates.profession = profession.trim();
    }
    
    // Update hobby if provided
    if (hobby) {
      updates.hobby = hobby.trim();
    }

    // Handle profile picture update if provided
    if (hasProfilePic) {
      // Check file size (500KB limit)
      const maxSize = 500 * 1024; // 500KB in bytes
      if (req.file.size > maxSize) {
        return res.status(400).json({ 
          message: "Maximum profile picture size is 500KB" 
        });
      }

      // Delete old profile picture from Cloudinary if exists
      if (user.profilePic && user.profilePic.publicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePic.publicId);
        } catch (error) {
          console.log("Error deleting old profile picture:", error.message);
          // Continue even if deletion fails
        }
      }

      // Upload new profile picture to Cloudinary
      const result = await uploadToCloudinary(req.file.buffer);
      
      // Update profile picture
      updates.profilePic = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    // Update user with all changes
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, 
      updates, 
      { new: true, runValidators: true }
    ).select("-password");

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        country: updatedUser.country,
        state: updatedUser.state,
        gender: updatedUser.gender,
        age: updatedUser.age,
        profession: updatedUser.profession,
        hobby: updatedUser.hobby,
        instaId: updatedUser.instaId,
        profilePic: updatedUser.profilePic ? {
          url: updatedUser.profilePic.url,
          publicId: updatedUser.profilePic.publicId
        } : null,
        isVerified: updatedUser.isVerified
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


