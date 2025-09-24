import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import User from "../models/User.js";

// ---------------- ADMIN LOGIN ----------------
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Trim email to handle newline characters
    const trimmedEmail = email ? email.toLowerCase().trim() : email;
    
    // Find admin by email
    const admin = await Admin.findOne({ email: trimmedEmail });
    
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!admin.isActive) {
      return res.status(403).json({ message: "Admin account is deactivated" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- CHANGE ADMIN PASSWORD ----------------
export const changeAdminPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    
    // Validate password confirmation
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ 
        message: "New passwords do not match" 
      });
    }

    // Get admin with password
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Verify old password
    const isOldPassword = await bcrypt.compare(oldPassword, admin.password);
    if (!isOldPassword) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: "New password must be different from your old password" 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    admin.password = hashedPassword;
    await admin.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- GET ALL USERS ----------------
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get users with pagination only - select only required fields
    const users = await User.find({})
      .select('name age gender email phone location isBlocked')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Transform users to match frontend table order: name, age, gender, email, phone, location, isBlocked
    const transformedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      age: user.age,
      gender: user.gender,
      email: user.email,
      phone: user.phone,
      location: user.location,
      isBlocked: user.isBlocked
    }));

    // Get total count for pagination
    const totalUsers = await User.countDocuments({});

    // Get blocked users count
    const blockedUsers = await User.countDocuments({ isBlocked: true });

    res.json({
      users: transformedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        blockedUsers,
        hasNextPage: skip + parseInt(limit) < totalUsers,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- BLOCK/UNBLOCK USER ----------------
export const toggleUserBlock = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Toggle the current block status
    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

