import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import {
  buildInitialTaskDocuments,
  parseFmsWorkbook,
  serializeTask,
  serializeTemplate,
} from "@/lib/fms-template";
import {
  getCachedTemplateList,
  setCachedTemplateBundle,
  syncTemplateListCache,
} from "@/lib/fms-template-cache";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cached = await getCachedTemplateList();
    if (cached) {
      return NextResponse.json(cached);
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const payload = await syncTemplateListCache(db);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching FMS templates:", error);
    return NextResponse.json(
      { error: "Failed to load FMS templates" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const templateName = String(formData.get("templateName") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const parsed = parseFmsWorkbook(Buffer.from(bytes));

    if (!parsed.normalizedRows.length) {
      return NextResponse.json({ error: "No task rows found in the uploaded file" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    const templateId = new ObjectId();
    const importedAt = new Date();
    const templateDocument = {
      _id: templateId,
      name: templateName || file.name.replace(/\.[^.]+$/, ""),
      sourceFileName: file.name,
      sheetName: parsed.sheetName,
      headerRow1: parsed.headerRow1,
      headerRow2: parsed.headerRow2,
      totalTasks: parsed.normalizedRows.length,
      importedAt,
      updatedAt: importedAt,
    };

    const taskDocuments = buildInitialTaskDocuments(templateId, parsed.normalizedRows);

    await db.collection("fms_templates").insertOne(templateDocument);
    await db.collection("fms_template_tasks").insertMany(taskDocuments);
    await Promise.all([
      setCachedTemplateBundle(templateId.toString(), {
        template: serializeTemplate(templateDocument),
        tasks: taskDocuments.map(serializeTask),
      }),
      syncTemplateListCache(db),
    ]);

    return NextResponse.json({
      message: "FMS template imported successfully",
      template: serializeTemplate(templateDocument),
      tasks: taskDocuments.slice(0, 10).map(serializeTask),
    });
  } catch (error) {
    console.error("Error importing FMS template:", error);
    return NextResponse.json(
      { error: "Failed to import FMS template" },
      { status: 500 }
    );
  }
}
