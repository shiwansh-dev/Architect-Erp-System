import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET all machines
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    // Aggregate to populate linked items
    const machines = await db.collection("machines").aggregate([
      {
        $lookup: {
          from: "items",
          localField: "linkedItems.itemId",
          foreignField: "_id",
          as: "populatedItems"
        }
      },
      {
        $addFields: {
          linkedItems: {
            $map: {
              input: "$linkedItems",
              as: "linkedItem",
              in: {
                itemId: "$$linkedItem.itemId",
                quantity: "$$linkedItem.quantity",
                itemDetails: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$populatedItems",
                        cond: { $eq: ["$$this._id", "$$linkedItem.itemId"] }
                      }
                    },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      {
        $project: {
          populatedItems: 0
        }
      }
    ]).toArray();
    
    return NextResponse.json({ machines }, { status: 200 });
  } catch (error) {
    console.error("Error fetching machines:", error);
    return NextResponse.json(
      { error: "Failed to fetch machines" },
      { status: 500 }
    );
  }
}

// POST new machine
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const machineData = await request.json();
    
    // Check if machine name already exists
    const existingMachine = await db.collection("machines").findOne({ 
      machineName: machineData.machineName 
    });
    
    if (existingMachine) {
      return NextResponse.json(
        { error: "Machine name already exists" },
        { status: 400 }
      );
    }
    
    // Convert item IDs to ObjectIds in linkedItems
    if (machineData.linkedItems) {
      machineData.linkedItems = machineData.linkedItems.map(item => ({
        ...item,
        itemId: new ObjectId(item.itemId)
      }));
    }
    
    const newMachine = {
      ...machineData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("machines").insertOne(newMachine);
    
    return NextResponse.json(
      { message: "Machine created successfully", id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating machine:", error);
    return NextResponse.json(
      { error: "Failed to create machine" },
      { status: 500 }
    );
  }
}
