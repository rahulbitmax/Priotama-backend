import express from "express";
import { getProfile, updateProfile, updatePassword } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProfilePic } from "../config/cloudinary.js";

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, uploadProfilePic.single('profilePic'), updateProfile); // For name, profession, hobby, and profile picture
router.put("/password", protect, updatePassword);

export default router;
