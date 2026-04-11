import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
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

// Helper function to check for duplicate item names
async function findDuplicateItem(db, itemName, excludeId = null) {
  const normalizedName = normalizeItemName(itemName);
  
  if (!normalizedName) return null;
  
  // Find items with similar normalized names
  const items = await db.collection("items").find({}).toArray();
  
  for (const item of items) {
    if (excludeId && item._id.toString() === excludeId) continue;
    
    const existingNormalizedName = normalizeItemName(item.itemName);
    if (existingNormalizedName === normalizedName) {
      return item;
    }
  }
  
  return null;
}

// GET all items with machine usage information
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    // Get all items first (fast)
    const items = await db.collection("items").find({}).toArray();
    
    // Get all machines first, then filter those with linked items
    const allMachines = await db.collection("machines").find({}).toArray();
    const machinesWithLinkedItems = allMachines.filter(machine => 
      machine.linkedItems && machine.linkedItems.length > 0
    );
    
    // Create a map of itemId -> machine usage for fast lookup
    const machineUsageMap = new Map();
    
    machinesWithLinkedItems.forEach(machine => {
      machine.linkedItems.forEach(linkedItem => {
        const itemId = linkedItem.itemId.toString();
        if (!machineUsageMap.has(itemId)) {
          machineUsageMap.set(itemId, []);
        }
        machineUsageMap.get(itemId).push({
          machineId: machine._id,
          machineName: machine.machineName,
          quantity: linkedItem.quantity || 0
        });
      });
    });
    
    // Add machine usage to each item
    const itemsWithMachineUsage = items.map(item => ({
      ...item,
      machineUsage: machineUsageMap.get(item._id.toString()) || []
    }));
    
    return NextResponse.json({ items: itemsWithMachineUsage }, { status: 200 });
  } catch (error) {
    console.error("Error fetching items:", error);
    return NextResponse.json(
      { error: "Failed to fetch items" },
      { status: 500 }
    );
  }
}

// POST new item (handles both manual creation and bulk import)
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const requestBody = await request.json();
    
    // Check if this is a bulk import request
    const isBulkImport = Array.isArray(requestBody);
    
    if (isBulkImport) {
      // Handle bulk import - overwrite duplicates
      const results = [];
      const errors = [];
      
      for (let i = 0; i < requestBody.length; i++) {
        const itemData = requestBody[i];
        
        try {
          if (!itemData.itemName || !itemData.itemName.trim()) {
            errors.push(`Item ${i + 1}: Item name is required`);
            continue;
          }
          
          // Check for existing item with same normalized name
          const existingItem = await findDuplicateItem(db, itemData.itemName);
          
          const processedItem = {
            ...itemData,
            itemName: itemData.itemName.trim(), // Keep original formatting but trimmed
            updatedAt: new Date()
          };
          
          if (existingItem) {
            // Update existing item (overwrite)
            processedItem.createdAt = existingItem.createdAt; // Preserve original creation date
            
            const updateResult = await db.collection("items").replaceOne(
              { _id: existingItem._id },
              processedItem
            );
            
            if (updateResult.modifiedCount > 0) {
              results.push({
                action: 'updated',
                id: existingItem._id,
                itemName: itemData.itemName,
                originalName: existingItem.itemName
              });
            }
          } else {
            // Create new item
            processedItem.createdAt = new Date();
            
            const insertResult = await db.collection("items").insertOne(processedItem);
            
            results.push({
              action: 'created',
              id: insertResult.insertedId,
              itemName: itemData.itemName
            });
          }
        } catch (itemError) {
          console.error(`Error processing item ${i + 1}:`, itemError);
          errors.push(`Item ${i + 1}: ${itemError.message}`);
        }
      }
      
      return NextResponse.json({
        message: `Bulk import completed. ${results.filter(r => r.action === 'created').length} created, ${results.filter(r => r.action === 'updated').length} updated.`,
        results,
        errors,
        summary: {
          total: requestBody.length,
          created: results.filter(r => r.action === 'created').length,
          updated: results.filter(r => r.action === 'updated').length,
          failed: errors.length
        }
      }, { status: 200 });
      
    } else {
      // Handle single item creation (manual) - strict validation
      const itemData = requestBody;
      
      if (!itemData.itemName || !itemData.itemName.trim()) {
        return NextResponse.json(
          { error: "Item name is required" },
          { status: 400 }
        );
      }
      
      // Check for duplicate item name (strict for manual creation)
      const existingItem = await findDuplicateItem(db, itemData.itemName);
      
      if (existingItem) {
        return NextResponse.json(
          { 
            error: `Item with similar name already exists: "${existingItem.itemName}". Please use a different name or update the existing item.`,
            existingItem: {
              id: existingItem._id,
              name: existingItem.itemName,
              created: existingItem.createdAt
            }
          },
          { status: 409 } // Conflict status code
        );
      }
      
      // Create new item
      const newItem = {
        ...itemData,
        itemName: itemData.itemName.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection("items").insertOne(newItem);
      
      return NextResponse.json(
        { message: "Item created successfully", id: result.insertedId },
        { status: 201 }
      );
    }
    
  } catch (error) {
    console.error("Error in POST /api/items:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

// PUT update item (for individual updates)
export async function PUT(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');
    
    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required for update" },
        { status: 400 }
      );
    }
    
    const updateData = await request.json();
    
    // Check for duplicate name if item name is being updated
    if (updateData.itemName) {
      const existingItem = await findDuplicateItem(db, updateData.itemName, itemId);
      
      if (existingItem) {
        return NextResponse.json(
          { 
            error: `Item with similar name already exists: "${existingItem.itemName}". Please use a different name.`,
            existingItem: {
              id: existingItem._id,
              name: existingItem.itemName
            }
          },
          { status: 409 }
        );
      }
    }
    
    const updatedItem = {
      ...updateData,
      itemName: updateData.itemName?.trim(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("items").updateOne(
      { _id: new ObjectId(itemId) },
      { $set: updatedItem }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { message: "Item updated successfully" },
      { status: 200 }
    );
    
  } catch (error) {
    console.error("Error updating item:", error);
    return NextResponse.json(
      { error: "Failed to update item" },
      { status: 500 }
    );
  }
}
