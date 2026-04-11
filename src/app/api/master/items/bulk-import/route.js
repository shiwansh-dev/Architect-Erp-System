import { NextResponse } from "next/server";
// import { ObjectId } from "mongodb"; // Unused import
import clientPromise, { databaseName } from "@/lib/mongodb";

// Helper function to normalize item names for comparison
function normalizeItemName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove symbols and special characters
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

// Helper function to find all duplicate items at once
async function findAllDuplicates(db, itemNames) {
  try {
    // Get all existing items
    const existingItems = await db.collection("items").find({}).toArray();
    
    // Create a map of normalized names to items
    const existingItemsMap = new Map();
    existingItems.forEach(item => {
      const normalizedName = normalizeItemName(item.itemName);
      if (normalizedName) {
        existingItemsMap.set(normalizedName, item);
      }
    });
    
    // Check for duplicates in incoming items
    const duplicatesMap = new Map();
    itemNames.forEach((itemName, index) => {
      const normalizedName = normalizeItemName(itemName);
      if (normalizedName && existingItemsMap.has(normalizedName)) {
        duplicatesMap.set(index, existingItemsMap.get(normalizedName));
      }
    });
    
    return duplicatesMap;
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return new Map();
  }
}

// POST bulk import items
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const items = await request.json();
    
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Expected array of items" },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No items to import" },
        { status: 400 }
      );
    }

    console.log(`Starting bulk import of ${items.length} items`);
    const startTime = Date.now();

    // Validate all items first
    const validItems = [];
    const errors = [];
    
    items.forEach((itemData, index) => {
      if (!itemData.itemName || !itemData.itemName.trim()) {
        errors.push(`Item ${index + 1}: Item name is required`);
      } else {
        validItems.push({
          ...itemData,
          index: index + 1 // Keep track of original position
        });
      }
    });

    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No valid items to import",
        errors,
        summary: {
          total: items.length,
          processed: 0,
          created: 0,
          updated: 0,
          failed: errors.length
        }
      }, { status: 400 });
    }

    // Find all duplicates at once
    const itemNames = validItems.map(item => item.itemName);
    const duplicatesMap = await findAllDuplicates(db, itemNames);
    
    console.log(`Found ${duplicatesMap.size} duplicate items`);

    // Separate items into creates and updates
    const itemsToCreate = [];
    const itemsToUpdate = [];
    const results = [];

    validItems.forEach((itemData, validIndex) => {
      const processedItem = {
        itemName: itemData.itemName.trim(),
        unit: itemData.unit || 'Piece',
        type: itemData.type || 'General',
        machines: itemData.machines || 'Not Specified',
        stock: parseInt(itemData.stock) || 0,
        photo: itemData.photo || '',
        
        // Preserve any additional fields
        ...Object.keys(itemData).reduce((acc, key) => {
          if (!['itemName', 'unit', 'type', 'machines', 'stock', 'photo', 'index'].includes(key)) {
            acc[key] = itemData[key];
          }
          return acc;
        }, {}),
        
        updatedAt: new Date()
      };

      if (duplicatesMap.has(validIndex)) {
        // Item exists - prepare for update
        const existingItem = duplicatesMap.get(validIndex);
        processedItem.createdAt = existingItem.createdAt; // Preserve creation date
        
        itemsToUpdate.push({
          existingItem,
          newData: processedItem,
          originalIndex: itemData.index
        });
      } else {
        // New item - prepare for insert
        processedItem.createdAt = new Date();
        processedItem._originalIndex = itemData.index;
        itemsToCreate.push(processedItem);
      }
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = errors.length;

    // Bulk insert new items
    if (itemsToCreate.length > 0) {
      try {
        console.log(`Bulk inserting ${itemsToCreate.length} new items...`);
        
        const insertResult = await db.collection("items").insertMany(itemsToCreate, { 
          ordered: false // Continue even if some insertions fail
        });
        
        totalCreated = insertResult.insertedCount;
        console.log(`Successfully inserted ${totalCreated} new items`);
        
        // Add to results
        Object.entries(insertResult.insertedIds).forEach(([index, id]) => {
          const item = itemsToCreate[parseInt(index)];
          results.push({
            action: 'created',
            id: id,
            itemName: item.itemName,
            row: item._originalIndex
          });
        });
        
      } catch (insertError) {
        console.error('Bulk insert error:', insertError);
        
        // Handle partial success
        if (insertError.result && insertError.result.insertedCount > 0) {
          totalCreated = insertError.result.insertedCount;
          console.log(`Partially successful: ${totalCreated} items inserted`);
          
          // Add successful insertions to results
          Object.entries(insertError.result.insertedIds).forEach(([index, id]) => {
            const item = itemsToCreate[parseInt(index)];
            results.push({
              action: 'created',
              id: id,
              itemName: item.itemName,
              row: item._originalIndex
            });
          });
        }
        
        // Add failed insertions to errors
        const failedCount = itemsToCreate.length - totalCreated;
        totalFailed += failedCount;
        errors.push(`${failedCount} items failed to insert: ${insertError.message}`);
      }
    }

    // Bulk update existing items
    if (itemsToUpdate.length > 0) {
      try {
        console.log(`Bulk updating ${itemsToUpdate.length} existing items...`);
        
        const bulkOps = itemsToUpdate.map(({ existingItem, newData }) => ({
          replaceOne: {
            filter: { _id: existingItem._id },
            replacement: newData
          }
        }));
        
        const updateResult = await db.collection("items").bulkWrite(bulkOps, { 
          ordered: false // Continue even if some updates fail
        });
        
        totalUpdated = updateResult.modifiedCount;
        console.log(`Successfully updated ${totalUpdated} existing items`);
        
        // Add to results
        itemsToUpdate.forEach(({ existingItem, newData, originalIndex }, index) => {
          if (index < totalUpdated) {
            results.push({
              action: 'updated',
              id: existingItem._id,
              itemName: newData.itemName,
              originalName: existingItem.itemName,
              row: originalIndex
            });
          }
        });
        
      } catch (updateError) {
        console.error('Bulk update error:', updateError);
        
        // Handle partial success
        if (updateError.result && updateError.result.modifiedCount > 0) {
          totalUpdated = updateError.result.modifiedCount;
          console.log(`Partially successful: ${totalUpdated} items updated`);
        }
        
        // Add failed updates to errors
        const failedCount = itemsToUpdate.length - totalUpdated;
        totalFailed += failedCount;
        errors.push(`${failedCount} items failed to update: ${updateError.message}`);
      }
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;
    const itemsPerSecond = Math.round((validItems.length * 1000) / processingTime);

    // Generate summary message
    const summaryParts = [];
    if (totalCreated > 0) summaryParts.push(`${totalCreated} created`);
    if (totalUpdated > 0) summaryParts.push(`${totalUpdated} updated`);
    if (totalFailed > 0) summaryParts.push(`${totalFailed} failed`);
    
    const message = summaryParts.length > 0 
      ? `Bulk import completed: ${summaryParts.join(', ')}`
      : 'Bulk import completed with no changes';

    console.log(`Bulk import finished in ${processingTime}ms: ${message}`);

    return NextResponse.json({
      success: true,
      message,
      results,
      errors,
      summary: {
        total: items.length,
        processed: validItems.length,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
        processingTime: processingTime
      },
      performance: {
        itemsPerSecond: itemsPerSecond,
        bulkOperations: {
          newItems: itemsToCreate.length,
          existingItems: itemsToUpdate.length,
          duplicatesFound: duplicatesMap.size
        },
        totalTimeMs: processingTime
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error in bulk import:", error);
    return NextResponse.json(
      { 
        error: "Failed to process bulk import",
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET bulk import status/info
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    // Get collection stats
    const itemsCount = await db.collection("items").countDocuments();
    
    return NextResponse.json({
      info: "Bulk import endpoint for items - Uses MongoDB bulk operations",
      currentItemsCount: itemsCount,
      features: {
        bulkInsert: "Uses insertMany for new items",
        bulkUpdate: "Uses bulkWrite for existing items",
        duplicateDetection: "Smart normalization (case, spacing, symbols ignored)",
        performance: "Optimized for large datasets with bulk operations",
        errorHandling: "Partial success handling with detailed error reporting"
      },
      supportedFields: [
        "itemName (required)",
        "unit (default: Piece)",
        "type (default: General)",
        "machines (default: Not Specified)",
        "stock (default: 0)",
        "photo (optional)"
      ]
    }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json({
      info: "Bulk import endpoint for items",
      error: "Could not fetch stats",
      details: error.message
    }, { status: 200 });
  }
}
