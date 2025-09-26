import mongoose from "mongoose";
// hello worldm 
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    location: { type: String },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    age: { type: Number, required: true },
    instaId: { type: String },
    hobby: { type: String },

    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
