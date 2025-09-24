# Admin Panel API Setup Guide

## Overview
This admin panel provides essential user management functionality for the Priotama application. It includes admin authentication and basic user management features.

## Features

### Admin Authentication
- Secure admin login with email and password
- JWT-based authentication
- Password change functionality with old password verification
- Admin session management

### User Management
- View all users in a paginated table format
- Search users by name, email, phone, or location
- Sort users by various fields (date, name, email)
- Block/unblock users

## Setup Instructions

### 1. Install Dependencies
Make sure all required dependencies are installed:
```bash
npm install
```

### 2. Environment Variables
Ensure your `.env` file contains:
```
JWT_SECRET=your_jwt_secret_here
MONGODB_URI=your_mongodb_connection_string
```

### 3. Create Initial Admin User
Run the setup script to create the initial admin user:
```bash
node setup-admin.js
```

This will create an admin user with:
- Email: `admin@priotama.com`
- Password: `admin123`

**Important**: Change the default password after first login!

### 4. Start the Server
```bash
npm start
```

### 5. Test the API
Use tools like Postman or curl to test the API endpoints.

## API Endpoints

### Authentication
- `POST /api/admin/login` - Admin login

### User Management
- `GET /api/admin/users` - Get all users with pagination and search
- `PUT /api/admin/users/:userId/block` - Block/unblock user

### Admin Management
- `POST /api/admin/change-password` - Change admin password

## Usage

### Login
1. Send POST request to `/api/admin/login` with email and password
2. Store the returned JWT token for authenticated requests

### User Management
1. Send GET request to `/api/admin/users` to retrieve all users
2. Use query parameters for pagination, search, and sorting
3. Send PUT request to `/api/admin/users/:userId/block` to block/unblock users

### Change Password
1. Send POST request to `/api/admin/change-password` with old and new passwords
2. Include JWT token in Authorization header

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Admin role verification
- Secure API endpoints
- Session management

## File Structure

```
├── models/
│   └── Admin.js                 # Admin data model
├── controllers/
│   └── adminController.js       # Admin API logic
├── middleware/
│   └── adminAuthMiddleware.js   # Admin authentication middleware
├── routes/
│   └── adminRoutes.js           # Admin API routes
├── setup-admin.js              # Initial admin setup script
└── ADMIN_SETUP.md              # This documentation
```

## Customization

### Modifying User Fields
To add or modify user fields, update:
1. The User model in `models/User.js`
2. The API response in `controllers/adminController.js`

## Troubleshooting

### Common Issues

1. **Admin login fails**
   - Check if admin user exists in database
   - Verify JWT_SECRET is set in environment variables
   - Run setup-admin.js to create initial admin

2. **Users not loading**
   - Check MongoDB connection
   - Verify user data exists in database
   - Check API responses for errors

3. **Authentication errors**
   - Ensure JWT token is included in Authorization header
   - Check if token has expired
   - Verify admin account is active

### Support
For technical support or questions about the admin panel API, please check the API responses for detailed error messages.
