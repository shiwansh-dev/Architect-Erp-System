# Admin Role Feature

## Overview
Users with the "admin" role now have full access to all pages in the application, bypassing the normal permission restrictions based on `allowedPaths`.

## Changes Made

### 1. Admin Layout (`src/app/(admin)/layout.tsx`)
- **Updated**: Authorization guard now checks for admin role
- **Logic**: If `userRole === 'admin'`, the user is granted access to all pages
- **Fallback**: Non-admin users still follow the existing `allowedPaths` logic

### 2. Root Page (`src/app/page.tsx`)
- **Updated**: Login redirect logic now handles admin users
- **Logic**: Admin users are redirected to `/ecommerce` (dashboard) regardless of `allowedPaths`
- **Fallback**: Non-admin users follow existing redirect logic

### 3. App Sidebar (`src/layout/AppSidebar.tsx`)
- **Updated**: Menu item filtering now checks for admin role
- **Logic**: Admin users see all menu items (set `allowedPaths` to `null`)
- **Fallback**: Non-admin users see only items matching their `allowedPaths`

### 4. Allowed Path Hook (`src/hooks/useAllowedPath.ts`)
- **Updated**: Hook now checks for admin role
- **Logic**: Admin users get `/ecommerce` as their allowed path
- **Fallback**: Non-admin users follow existing path logic

## How It Works

### For Admin Users:
1. **Login**: Admin users are redirected to `/ecommerce` (dashboard)
2. **Navigation**: All menu items are visible in the sidebar
3. **Access**: Can access any page in the application
4. **Permissions**: Bypass all `allowedPaths` restrictions

### For Non-Admin Users:
1. **Login**: Redirected to their first `allowedPaths` entry
2. **Navigation**: Only see menu items matching their `allowedPaths`
3. **Access**: Limited to pages in their `allowedPaths`
4. **Permissions**: Follow existing permission system

## User Role Assignment

### Creating Admin Users:
1. Go to User Management (`/users`)
2. Create or edit a user
3. Set Role to "Admin" in the dropdown
4. Save the user

### Available Roles:
- **User**: Standard user with restricted access based on `allowedPaths`
- **Admin**: Full access to all pages and features
- **Manager**: Standard user with restricted access based on `allowedPaths`

## Database Structure

Users are stored in the `users` collection with the following structure:
```javascript
{
  _id: ObjectId,
  firstName: string,
  lastName: string,
  username: string,
  email: string,
  role: "user" | "admin" | "manager",
  allowedPaths: string[], // Ignored for admin users
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Role-based Access**: Admin role is checked in multiple places for security
2. **Client-side Logic**: Role checking happens on the client side
3. **Server-side Validation**: Consider adding server-side role validation for production
4. **Permission Override**: Admin role overrides all permission restrictions

## Testing Admin Access

### To test admin functionality:
1. Create a user with role "admin"
2. Login with that user
3. Verify:
   - All menu items are visible in sidebar
   - Can navigate to any page
   - No permission errors occur
   - Redirected to `/ecommerce` on login

### To test non-admin functionality:
1. Create a user with role "user" and specific `allowedPaths`
2. Login with that user
3. Verify:
   - Only allowed menu items are visible
   - Cannot access restricted pages
   - Redirected to first allowed path on login

## Backward Compatibility

- Existing users with no role specified default to "user" role
- Existing permission system remains unchanged for non-admin users
- No breaking changes to existing functionality
