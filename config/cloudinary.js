import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage (we'll upload to Cloudinary manually)
const storage = multer.memoryStorage();

// Create multer upload middleware
export const uploadProfilePic = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024, // 500KB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type - only allow JPEG and PNG
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG are allowed!'), false);
    }
  }
});

// Helper function to upload to Cloudinary
export const uploadToCloudinary = (buffer, folder = 'priotama/profile-pics') => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const publicId = `profile_${timestamp}_${randomString}`;
    
    cloudinary.uploader.upload_stream(
      {
        folder: folder,
        public_id: publicId,
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

export default cloudinary;
