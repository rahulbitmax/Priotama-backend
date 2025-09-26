import express from "express";
import { 
  adminLogin, 
  changeAdminPassword, 
  getAllUsers, 
  toggleUserBlock
} from "../controllers/adminController.js";
import { adminProtect } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/login", adminLogin);

// Protected routes (require admin authentication)
router.post("/change-password", adminProtect, changeAdminPassword);
router.get("/users", adminProtect, getAllUsers);
router.put("/users/:userId/block", adminProtect, toggleUserBlock);

export default router;
