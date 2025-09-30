import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";

export const getProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
};
export const updateProfile = async (req, res) => {
  try {
    const { gender, profession, hobby, instaId } = req.body;
    const hasProfilePic = req.file;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = {};
    let hasChanges = false;
    
    if (gender) {
      const sanitizedGender = gender.trim();
      if (!["Male", "Female"].includes(sanitizedGender)) {
        return res.status(400).json({ 
          message: "Invalid gender value. Must be 'Male' or 'Female'" 
        });
      }
      if (sanitizedGender !== user.gender) {
        updates.gender = sanitizedGender;
        hasChanges = true;
      }
    }
    
    if (profession) {
      const trimmedProfession = profession.trim();
      if (trimmedProfession !== user.profession) {
        updates.profession = trimmedProfession;
        hasChanges = true;
      }
    }
    
    if (hobby) {
      const trimmedHobby = hobby.trim();
      if (trimmedHobby !== user.hobby) {
        updates.hobby = trimmedHobby;
        hasChanges = true;
      }
    }
    
    if (instaId !== undefined) {
      const trimmedInstaId = instaId ? instaId.trim() : undefined;
      if (trimmedInstaId !== user.instaId) {
        updates.instaId = trimmedInstaId;
        hasChanges = true;
      }
    }

    if (hasProfilePic) {
      const maxSize = 500 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({ 
          message: "Maximum profile picture size is 500KB" 
        });
      }

      if (user.profilePic && user.profilePic.publicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePic.publicId);
        } catch (error) {
          // Continue even if deletion fails
        }
      }

      const result = await uploadToCloudinary(req.file.buffer);
      updates.profilePic = {
        url: result.secure_url,
        publicId: result.public_id,
      };
      hasChanges = true;
    }

    if (!hasChanges && !hasProfilePic) {
      return res.json({
        message: "No changes detected. Profile remains unchanged.",
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
    }

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

export const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ 
        message: "New passwords do not match" 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPassword) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: "New password must be different from your current password" 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


