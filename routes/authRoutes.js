import express from "express";
import { registerUser, verifyOtp, loginUser, forgotPassword, resetPassword } from "../controllers/authController.js";
import { uploadProfilePic, handleUploadError } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/register", uploadProfilePic, handleUploadError, registerUser);
router.post("/verify-otp", verifyOtp);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Test endpoint for debugging email issues
router.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    const { sendOtp } = await import("../utils/sendOtp.js");
    await sendOtp(email, "123456");
    res.json({ message: "Test email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


export default router;
