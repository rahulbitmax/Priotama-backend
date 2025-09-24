import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";
import connectDB from "./config/db.js";

dotenv.config();

async function setupAdmin() {
    try {
        // Connect to database
        await connectDB();
        console.log("Connected to database");

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email: "admin@priotama.com" });
        if (existingAdmin) {
            console.log("Admin already exists with email: admin@priotama.com");
            return;
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        const admin = await Admin.create({
            name: "Admin",
            email: "admin@priotama.com",
            password: hashedPassword,
            isActive: true
        });

        console.log("Admin created successfully!");
        console.log("Email: admin@priotama.com");
        console.log("Password: admin9703");
        console.log("Admin ID:", admin._id);

    } catch (error) {
        console.error("Error setting up admin:", error.message);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
}

// Run the setup
setupAdmin();
