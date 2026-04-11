import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET single machine
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const machine = await db.collection("machines").aggregate([
      { $match: { _id: new ObjectId(id) } },
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
    
    if (machine.length === 0) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    
    return NextResponse.json({ machine: machine[0] }, { status: 200 });
  } catch (error) {
    console.error("Error fetching machine:", error);
    return NextResponse.json(
      { error: "Failed to fetch machine" },
      { status: 500 }
    );
  }
}

// PUT update machine
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const updateData = await request.json();
    
    // Check if machine name already exists (excluding current machine)
    if (updateData.machineName) {
      const existingMachine = await db.collection("machines").findOne({ 
        machineName: updateData.machineName,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingMachine) {
        return NextResponse.json(
          { error: "Machine name already exists" },
          { status: 400 }
        );
      }
    }
    
    // Convert item IDs to ObjectIds in linkedItems
    if (updateData.linkedItems) {
      updateData.linkedItems = updateData.linkedItems.map(item => ({
        ...item,
        itemId: new ObjectId(item.itemId)
      }));
    }
    
    const updatedMachine = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const result = await db.collection("machines").updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedMachine }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Machine updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating machine:", error);
    return NextResponse.json(
      { error: "Failed to update machine" },
      { status: 500 }
    );
  }
}

// DELETE machine
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const result = await db.collection("machines").deleteOne({
      _id: new ObjectId(id)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Machine deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting machine:", error);
    return NextResponse.json(
      { error: "Failed to delete machine" },
      { status: 500 }
    );
  }
}
