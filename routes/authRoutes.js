import express from "express";
import { registerUser, verifyOtp, loginUser, forgotPassword, resetPassword } from "../controllers/authController.js";
import { uploadProfilePic } from "../config/cloudinary.js";

const router = express.Router();

router.post("/register", uploadProfilePic.single('profilePic'), registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
