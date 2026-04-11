import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

export async function POST(request) {
  try {
    const { customers } = await request.json();
    
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { error: "No customers data provided" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    // Validate and prepare customers data
    const validCustomers = customers.map(customer => ({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      gstin: customer.gstin || "",
      billingAddress: {
        line1: customer.billingAddress?.line1 || "",
        line2: customer.billingAddress?.line2 || "",
        city: customer.billingAddress?.city || "",
        state: customer.billingAddress?.state || "",
        zip: customer.billingAddress?.zip || "",
        country: customer.billingAddress?.country || "India",
      },
      paymentTerms: customer.paymentTerms || "Due on Receipt",
      creditLimit: Number(customer.creditLimit || 0),
      isActive: customer.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert customers
    const result = await db.collection("customers").insertMany(validCustomers);

    return NextResponse.json(
      { 
        message: "Customers imported successfully",
        imported: result.insertedCount,
        insertedIds: result.insertedIds
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing customers:", error);
    return NextResponse.json(
      { error: "Failed to import customers" },
      { status: 500 }
    );
  }
}
