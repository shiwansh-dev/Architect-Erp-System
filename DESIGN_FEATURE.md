# Design Section Feature

## Overview
A new "Design" section has been added above the "Master" section in the navigation menu. This section allows users to upload and manage design files for items from the Master/Items page.

## Features

### 1. Design Section Navigation
- Added "Design" section in the sidebar navigation above "Master" section
- Contains "Part Design" page accessible at `/Design/part-design`
- Updated permission system to include Design section

### 2. Part Design Page
- **Location**: `/Design/part-design`
- **Functionality**:
  - Displays all items from Master/Items page
  - Shows item details including name, type, unit, and machines
  - Displays existing design files for each item
  - Allows uploading multiple design files per item
  - Supports file deletion
  - Search functionality to filter items

### 3. File Upload Support
- **Supported file types**: PDF, DWG, DXF, STEP, STP, JPG, JPEG, PNG
- **Multiple file upload**: Users can select and upload multiple files at once
- **File storage**: Files are stored in `/public/uploads/designs/` directory
- **Unique naming**: Files are saved with unique names to prevent conflicts

### 4. API Endpoints

#### Upload Design Files
- **Endpoint**: `POST /api/design/upload`
- **Body**: FormData with `itemId` and `designFiles`
- **Response**: Updated design files array

#### Delete Design File
- **Endpoint**: `DELETE /api/design/delete`
- **Body**: JSON with `itemId` and `fileIndex`
- **Response**: Updated design files array

### 5. Database Changes
- Added `designFiles` field to items collection
- Stores array of file URLs for each item
- Updates `updatedAt` timestamp when files are modified

## Usage

1. Navigate to Design > Part Design from the sidebar
2. Browse through items from Master/Items
3. For each item:
   - View existing design files (if any)
   - Select new design files using the file input
   - Click "Upload" to upload selected files
   - Delete existing files using the delete button
4. Use the search bar to filter items by name, type, or machines

## File Structure
```
src/
├── app/
│   ├── (admin)/(others-pages)/Design/part-design/
│   │   └── page.tsx
│   └── api/design/
│       ├── upload/route.js
│       └── delete/route.js
├── layout/AppSidebar.tsx (updated)
└── components/user-management/PermissionSelector.tsx (updated)

public/
└── uploads/designs/ (created)
```

## Security Considerations
- File uploads are restricted to specific file types
- Files are stored in a dedicated directory
- Unique filenames prevent conflicts and unauthorized access
- File deletion removes both database references and physical files
