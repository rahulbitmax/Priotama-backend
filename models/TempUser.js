import mongoose from "mongoose";

const tempUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    location: { type: String },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    age: { type: Number, required: true },
    // Store image directly in MongoDB as binary Buffer with content type
    profilePic: {
      data: Buffer,
      contentType: String,
    },
    instaId: { type: String },
    hobby: { type: String },
    password: { type: String, required: true },
    // Auto-delete after 10 minutes if not verified
    expiresAt: { type: Date, default: Date.now, expires: 600 } // 10 minutes
  },
  { timestamps: true }
);

export default mongoose.model("TempUser", tempUserSchema);
