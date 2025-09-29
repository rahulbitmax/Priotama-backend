import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true }, // Format: "+91 7371832880"
    country: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    age: { type: Number, required: true },
    profession: { type: String, required: true, trim: true },
    hobby: { type: String, required: true, trim: true },
    instaId: { type: String, required: true, trim: true }, // Only this field is optional
    // Store Cloudinary URL for profile picture
    profilePic: {
      url: { type: String, required: true },
      publicId: { type: String, required: true }, // Cloudinary public ID for deletion
    },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
