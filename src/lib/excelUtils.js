import * as XLSX from 'xlsx';

// Export items to Excel with all fields
export const exportToExcel = (items, filename = 'items-export.xlsx') => {
  try {
    // Prepare data for export by including all fields except uploads
    const exportData = items.map((item, index) => {
      // Create a copy of the item excluding uploads field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { uploads: _unused, ...itemWithoutUploads } = item;
      
      // Convert MongoDB ObjectId to string for Excel compatibility
      const processedItem = {
        'S.No': index + 1,
        'Document ID': item._id ? item._id.toString() : '',
        ...itemWithoutUploads
      };

      // Convert date fields to readable format if they exist
      if (processedItem.createdAt) {
        processedItem['Created Date'] = new Date(processedItem.createdAt).toLocaleDateString();
        processedItem['Created Time'] = new Date(processedItem.createdAt).toLocaleTimeString();
        delete processedItem.createdAt;
      }
      
      if (processedItem.updatedAt) {
        processedItem['Updated Date'] = new Date(processedItem.updatedAt).toLocaleDateString();
        processedItem['Updated Time'] = new Date(processedItem.updatedAt).toLocaleTimeString();
        delete processedItem.updatedAt;
      }

      // Convert ObjectId _id to string and rename for clarity
      if (processedItem._id) {
        delete processedItem._id; // Remove original _id as we already have Document ID
      }

      // Ensure commonly used fields have proper headers and order
      const orderedItem = {
        'S.No': processedItem['S.No'],
        'Document ID': processedItem['Document ID'],
        'Item Name': processedItem.itemName || '',
        'Unit': processedItem.unit || '',
        'Type': processedItem.type || '',
        'Machines': processedItem.machines || '',
        'Stock': processedItem.stock || 0,
        'Photo URL': processedItem.photo || '',
      };

      // Add remaining fields (excluding the ones we've already handled)
      const handledFields = ['S.No', 'Document ID', 'itemName', 'unit', 'type', 'machines', 'stock', 'photo'];
      Object.keys(processedItem).forEach(key => {
        if (!handledFields.includes(key) && key !== 'S.No' && key !== 'Document ID') {
          orderedItem[key] = processedItem[key];
        }
      });

      return orderedItem;
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns based on content
    const columnWidths = [];
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      headers.forEach(header => {
        const maxLength = Math.max(
          header.length,
          ...exportData.map(row => 
            row[header] ? row[header].toString().length : 0
          )
        );
        columnWidths.push({ wch: Math.min(Math.max(maxLength + 2, 10), 50) });
      });
    }
    
    worksheet['!cols'] = columnWidths;

    // Add some styling to headers
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      headers.forEach((header, index) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
        if (!worksheet[cellAddress]) return;
        
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "CCCCCC" } },
          alignment: { horizontal: "center" }
        };
      });
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');

    // Add metadata sheet with export info
    const metadataSheet = XLSX.utils.json_to_sheet([
      {
        'Export Information': 'Value',
        'Export Date': new Date().toLocaleDateString(),
        'Export Time': new Date().toLocaleTimeString(),
        'Total Records': items.length,
        'Exported By': 'Item Management System',
        'Fields Included': 'All fields except uploads'
      }
    ]);
    
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Export Info');

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, filename);

    return { 
      success: true, 
      message: `Excel file exported successfully! ${items.length} records exported with all available fields.` 
    };
  } catch (error) {
    console.error('Export error:', error);
    return { 
      success: false, 
      message: 'Failed to export Excel file: ' + error.message 
    };
  }
};

// Import items from Excel (updated to handle _id field)
export const importFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get first worksheet
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Validate and transform data
          const validItems = [];
          const errors = [];
          
          jsonData.forEach((row, index) => {
            const rowNum = index + 2; // Excel row number (accounting for header)
            
            // Create item object with all available fields
            const item = {};
            
            // Map standard fields
            item.itemName = row['Item Name'] || row['itemName'] || '';
            item.unit = row['Unit'] || row['unit'] || '';
            item.type = row['Type'] || row['type'] || '';
            item.machines = row['Machines'] || row['machines'] || '';
            item.stock = parseInt(row['Stock'] || row['stock'] || 0);
            item.photo = row['Photo URL'] || row['photo'] || row['Photo'] || '';
            
            // Handle Document ID if present (for updates)
            if (row['Document ID'] || row['_id']) {
              item._id = row['Document ID'] || row['_id'];
            }
            
            // Add any additional fields from the Excel that aren't standard
            Object.keys(row).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (!['s.no', 'document id', '_id', 'item name', 'itemname', 'unit', 'type', 'machines', 'stock', 'photo url', 'photo', 'created date', 'created time', 'updated date', 'updated time'].includes(lowerKey)) {
                // Add custom fields as-is
                item[key] = row[key];
              }
            });
            
            // Validate required fields
            const fieldErrors = [];
            if (!item.itemName.trim()) {
              fieldErrors.push(`Row ${rowNum}: Item Name is required`);
            }
            if (!item.unit.trim()) {
              fieldErrors.push(`Row ${rowNum}: Unit is required`);
            }
            if (!item.type.trim()) {
              fieldErrors.push(`Row ${rowNum}: Type is required`);
            }
            if (!item.machines.trim()) {
              fieldErrors.push(`Row ${rowNum}: Machines is required`);
            }
            if (isNaN(item.stock) || item.stock < 0) {
              fieldErrors.push(`Row ${rowNum}: Stock must be a valid number >= 0`);
            }
            
            // Add field errors to main errors array
            errors.push(...fieldErrors);
            
            // If no errors for this item, add it to valid items
            if (fieldErrors.length === 0) {
              validItems.push(item);
            }
          });
          
          resolve({
            success: true,
            data: validItems,
            errors: errors,
            totalRows: jsonData.length,
            validRows: validItems.length,
            hasDocumentIds: validItems.some(item => item._id)
          });
          
        } catch (parseError) {
          reject({
            success: false,
            message: 'Failed to parse Excel file. Please check the file format.',
            error: parseError
          });
        }
      };
      
      reader.onerror = () => {
        reject({
          success: false,
          message: 'Failed to read file',
          error: reader.error
        });
      };
      
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      reject({
        success: false,
        message: 'Failed to process file',
        error: error
      });
    }
  });
};

// Generate Excel template with all standard fields
export const downloadTemplate = () => {
  const templateData = [
    {
      'Item Name': 'Sample Item 1',
      'Unit': 'Piece',
      'Type': 'Electronics',
      'Machines': 'Machine 1, Machine 2',
      'Stock': 100,
      'Photo URL': 'https://example.com/image1.jpg'
    },
    {
      'Item Name': 'Sample Item 2', 
      'Unit': 'Kg',
      'Type': 'Raw Material',
      'Machines': 'Machine 3, Machine 4',
      'Stock': 50,
      'Photo URL': 'https://example.com/image2.jpg'
    }
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Item Name
    { wch: 12 }, // Unit
    { wch: 15 }, // Type
    { wch: 20 }, // Machines
    { wch: 10 }, // Stock
    { wch: 35 }  // Photo URL
  ];
  worksheet['!cols'] = colWidths;

  // Add instructions sheet
  const instructionsData = [
    {
      'Field Name': 'Item Name',
      'Description': 'Name of the item (Required)',
      'Example': 'MacBook Pro, Steel Rod, etc.'
    },
    {
      'Field Name': 'Unit',
      'Description': 'Unit of measurement (Required)',
      'Example': 'Piece, Kg, Liter, Meter, Box, Set, Dozen'
    },
    {
      'Field Name': 'Type',
      'Description': 'Category or type of item (Required)',
      'Example': 'Electronics, Raw Material, Finished Goods'
    },
    {
      'Field Name': 'Machines',
      'Description': 'Related machines or equipment (Required)',
      'Example': 'CNC Machine, Lathe, Press Machine'
    },
    {
      'Field Name': 'Stock',
      'Description': 'Current stock quantity (Required, must be number >= 0)',
      'Example': '100, 50, 0'
    },
    {
      'Field Name': 'Photo URL',
      'Description': 'Web URL of item photo (Optional)',
      'Example': 'https://example.com/image.jpg'
    }
  ];

  const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [
    { wch: 15 }, // Field Name
    { wch: 40 }, // Description  
    { wch: 30 }  // Example
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
  
  XLSX.writeFile(workbook, 'items-template.xlsx');
};

// Advanced export function with custom field selection
export const exportToExcelAdvanced = (items, selectedFields = null, filename = 'items-export.xlsx') => {
  try {
    if (!items || items.length === 0) {
      return { success: false, message: 'No data to export' };
    }

    const exportData = items.map((item, index) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { uploads: _unused, ...itemWithoutUploads } = item;
      
      // Convert ObjectId to string
      const processedItem = {
        'S.No': index + 1,
        'Document ID': item._id ? item._id.toString() : '',
        ...itemWithoutUploads
      };

      // If specific fields are selected, only include those
      if (selectedFields && selectedFields.length > 0) {
        const filteredItem = { 'S.No': processedItem['S.No'] };
        selectedFields.forEach(field => {
          if (processedItem.hasOwnProperty(field)) {
            filteredItem[field] = processedItem[field];
          }
        });
        return filteredItem;
      }

      return processedItem;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    if (exportData.length > 0) {
      const headers = Object.keys(exportData[0]);
      const columnWidths = headers.map(header => {
        const maxLength = Math.max(
          header.length,
          ...exportData.map(row => 
            row[header] ? row[header].toString().length : 0
          )
        );
        return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
      });
      worksheet['!cols'] = columnWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
    XLSX.writeFile(workbook, filename);

    return { 
      success: true, 
      message: `Excel file exported successfully! ${items.length} records exported.` 
    };
  } catch (error) {
    console.error('Advanced export error:', error);
    return { 
      success: false, 
      message: 'Failed to export Excel file: ' + error.message 
    };
  }
};
