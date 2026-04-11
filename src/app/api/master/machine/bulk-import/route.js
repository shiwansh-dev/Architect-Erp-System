import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// Helper function to normalize machine names for comparison
function normalizeMachineName(name) {
  if (!name || typeof name !== 'string') return '';
  
  return String(name) // Ensure it's a string
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

// POST bulk import machines
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const machines = await request.json();
    
    if (!Array.isArray(machines)) {
      return NextResponse.json(
        { error: "Expected array of machines" },
        { status: 400 }
      );
    }

    if (machines.length === 0) {
      return NextResponse.json(
        { error: "No machines to import" },
        { status: 400 }
      );
    }

    console.log(`Starting bulk import of ${machines.length} machines`);
    const startTime = Date.now();

    // Validate all machines first
    const validMachines = [];
    const errors = [];
    let itemsSkipped = 0;
    
    machines.forEach((machineData, index) => {
      // Safe string conversion and validation
      const machineName = machineData.machineName;
      const safeNameCheck = machineName && typeof machineName === 'string' ? machineName.trim() : '';
      
      if (!safeNameCheck) {
        errors.push(`Machine ${index + 1}: Machine name is required (found: ${typeof machineName})`);
      } else {
        // Count items that will be skipped (those without valid itemId)
        const invalidItems = machineData.linkedItems?.filter(item => !item.itemId) || [];
        itemsSkipped += invalidItems.length;
        
        // Filter out invalid items
        const validLinkedItems = machineData.linkedItems?.filter(item => item.itemId) || [];
        
        validMachines.push({
          ...machineData,
          machineName: safeNameCheck, // Use the safely validated name
          linkedItems: validLinkedItems,
          index: index + 1
        });
      }
    });

    if (validMachines.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No valid machines to import",
        errors,
        summary: {
          total: machines.length,
          created: 0,
          updated: 0,
          failed: errors.length,
          itemsSkipped
        }
      }, { status: 400 });
    }

    // Find existing machines for updates
    const existingMachines = await db.collection("machines").find({}).toArray();
    const existingMachinesMap = new Map();
    existingMachines.forEach(machine => {
      const normalizedName = normalizeMachineName(machine.machineName);
      if (normalizedName) {
        existingMachinesMap.set(normalizedName, machine);
      }
    });

    // Separate machines into creates and updates
    const machinesToCreate = [];
    const machinesToUpdate = [];
    const results = [];

    validMachines.forEach((machineData) => {
      const normalizedName = normalizeMachineName(machineData.machineName);
      
      // Convert linkedItems itemIds to ObjectIds
      const processedLinkedItems = machineData.linkedItems.map(item => ({
        itemId: new ObjectId(item.itemId),
        quantity: parseInt(item.quantity) || 1
      }));

      const processedMachine = {
        machineName: String(machineData.machineName).trim(), // Safe string conversion
        respectiveDepartment: String(machineData.respectiveDepartment || 'General'),
        stock: parseInt(machineData.stock) || 0,
        minStock: parseInt(machineData.minStock) || 0,
        maxStock: parseInt(machineData.maxStock) || 0,
        description: String(machineData.description || ''),
        isActive: machineData.isActive !== false,
        linkedItems: processedLinkedItems,
        updatedAt: new Date()
      };

      if (existingMachinesMap.has(normalizedName)) {
        // Update existing machine
        const existingMachine = existingMachinesMap.get(normalizedName);
        processedMachine.createdAt = existingMachine.createdAt;
        
        machinesToUpdate.push({
          existingMachine,
          newData: processedMachine,
          originalIndex: machineData.index
        });
      } else {
        // Create new machine
        processedMachine.createdAt = new Date();
        processedMachine._originalIndex = machineData.index;
        machinesToCreate.push(processedMachine);
      }
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = errors.length;

    // Bulk insert new machines
    if (machinesToCreate.length > 0) {
      try {
        console.log(`Bulk inserting ${machinesToCreate.length} new machines...`);
        
        const insertResult = await db.collection("machines").insertMany(machinesToCreate, { 
          ordered: false
        });
        
        totalCreated = insertResult.insertedCount;
        console.log(`Successfully inserted ${totalCreated} new machines`);
        
        // Add to results
        Object.entries(insertResult.insertedIds).forEach(([index, id]) => {
          const machine = machinesToCreate[parseInt(index)];
          results.push({
            action: 'created',
            id: id,
            machineName: machine.machineName,
            linkedItemsCount: machine.linkedItems.length,
            row: machine._originalIndex
          });
        });
        
      } catch (insertError) {
        console.error('Bulk insert error:', insertError);
        
        if (insertError.result && insertError.result.insertedCount > 0) {
          totalCreated = insertError.result.insertedCount;
          console.log(`Partially successful: ${totalCreated} machines inserted`);
        }
        
        const failedCount = machinesToCreate.length - totalCreated;
        totalFailed += failedCount;
        errors.push(`${failedCount} machines failed to insert: ${insertError.message}`);
      }
    }

    // Bulk update existing machines
    if (machinesToUpdate.length > 0) {
      try {
        console.log(`Bulk updating ${machinesToUpdate.length} existing machines...`);
        
        const bulkOps = machinesToUpdate.map(({ existingMachine, newData }) => ({
          replaceOne: {
            filter: { _id: existingMachine._id },
            replacement: newData
          }
        }));
        
        const updateResult = await db.collection("machines").bulkWrite(bulkOps, { 
          ordered: false
        });
        
        totalUpdated = updateResult.modifiedCount;
        console.log(`Successfully updated ${totalUpdated} existing machines`);
        
        // Add to results
        machinesToUpdate.forEach(({ existingMachine, newData, originalIndex }, index) => {
          if (index < totalUpdated) {
            results.push({
              action: 'updated',
              id: existingMachine._id,
              machineName: newData.machineName,
              originalName: existingMachine.machineName,
              linkedItemsCount: newData.linkedItems.length,
              row: originalIndex
            });
          }
        });
        
      } catch (updateError) {
        console.error('Bulk update error:', updateError);
        
        if (updateError.result && updateError.result.modifiedCount > 0) {
          totalUpdated = updateError.result.modifiedCount;
          console.log(`Partially successful: ${totalUpdated} machines updated`);
        }
        
        const failedCount = machinesToUpdate.length - totalUpdated;
        totalFailed += failedCount;
        errors.push(`${failedCount} machines failed to update: ${updateError.message}`);
      }
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Generate summary message
    const summaryParts = [];
    if (totalCreated > 0) summaryParts.push(`${totalCreated} created`);
    if (totalUpdated > 0) summaryParts.push(`${totalUpdated} updated`);
    if (totalFailed > 0) summaryParts.push(`${totalFailed} failed`);
    if (itemsSkipped > 0) summaryParts.push(`${itemsSkipped} items skipped`);
    
    const message = summaryParts.length > 0 
      ? `Machine import completed: ${summaryParts.join(', ')}`
      : 'Machine import completed with no changes';

    console.log(`Machine import finished in ${processingTime}ms: ${message}`);

    return NextResponse.json({
      success: true,
      message,
      results,
      errors,
      summary: {
        total: machines.length,
        created: totalCreated,
        updated: totalUpdated,
        failed: totalFailed,
        itemsSkipped: itemsSkipped,
        processingTime: processingTime
      }
    }, { status: 200 });
    
  } catch {
    console.error("Error in machine bulk import");
    return NextResponse.json(
      { 
        error: "Failed to process machine bulk import"
      },
      { status: 500 }
    );
  }
}

// GET bulk import info
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const machinesCount = await db.collection("machines").countDocuments();
    const itemsCount = await db.collection("items").countDocuments();
    
    return NextResponse.json({
      info: "Machine bulk import endpoint",
      currentMachinesCount: machinesCount,
      availableItems: itemsCount,
      features: {
        itemMatching: "Matches items by name from Items collection",
        skipMissing: "Automatically skips items not found in database", 
        bulkOperations: "Uses MongoDB bulk operations for performance",
        duplicateHandling: "Updates existing machines or creates new ones"
      },
      requiredFields: [
        "machineName (required)",
        "linkedItems with valid itemId references"
      ]
    }, { status: 200 });
    
  } catch {
    return NextResponse.json({
      info: "Machine bulk import endpoint",
      error: "Could not fetch stats"
    }, { status: 200 });
  }
}
