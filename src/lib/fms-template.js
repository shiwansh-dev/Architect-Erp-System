import { ObjectId } from "mongodb";
import * as XLSX from "xlsx";
import { DEFAULT_FMS_SECONDARY_HEADERS } from "@/lib/fms-table-headers";

const COLUMN_KEYS = [
  "taskForDelegation",
  "mainHeading",
  "subHeading",
  "taskNumber",
  "processes",
  "parallelSteps",
  "taskDescription",
  "ownerCode",
  "methodCode",
  "dueRule",
  "processNotes",
  "spacesName",
  "plannedFmsDate",
  "delegationDate",
  "changedDelegationDate",
  "secondaryDelegationDate",
  "drawingNumber",
  "status",
  "assigneeName",
  "allottedDays",
  "reasonComment",
  "taskLink",
  "extraColumn22",
  "reviewCode",
  "reviewName",
  "extraColumn25",
  "supportCode",
  "supportName",
];

const SECONDARY_HEADERS = DEFAULT_FMS_SECONDARY_HEADERS;

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 132;
const DEFAULT_ALLOTTED_DAYS = "1";

function normalizeAllottedDays(value) {
  const normalized = String(value ?? "").trim();
  return normalized || DEFAULT_ALLOTTED_DAYS;
}

function toCellArray(row) {
  const cells = Array.from({ length: COLUMN_KEYS.length }, (_, index) => row[index] ?? "");
  return cells.map((value) => String(value ?? "").trim());
}

function buildTaskRowCells(task) {
  return COLUMN_KEYS.map((key) => {
    if (key === "allottedDays") {
      return normalizeAllottedDays(task[key]);
    }

    return String(task[key] ?? "").trim();
  });
}

function normalizeHeaderRow(row, fallback) {
  return Array.from({ length: COLUMN_KEYS.length }, (_, index) =>
    String(row?.[index] ?? fallback[index] ?? "").trim()
  );
}

function buildTaskTitle(task) {
  const pieces = [
    task.taskNumber ? `#${task.taskNumber}` : "",
    task.processes || task.parallelSteps || task.taskDescription || task.mainHeading || "Untitled Task",
  ].filter(Boolean);

  return pieces.join(" ");
}

function hasParallelHint(task) {
  const haystack = [
    task.mainHeading,
    task.subHeading,
    task.processes,
    task.parallelSteps,
    task.taskDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes("parallel");
}

function normalizeTask(row, rowIndex) {
  const rawCells = toCellArray(row);
  const values = Object.fromEntries(COLUMN_KEYS.map((key, index) => [key, rawCells[index]]));
  values.allottedDays = normalizeAllottedDays(values.allottedDays);

  return {
    ...values,
    rawCells: buildTaskRowCells(values),
    rowNumber: rowIndex + 1,
    title: buildTaskTitle(values),
    isParallel: hasParallelHint(values),
  };
}

export function parseFmsWorkbook(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: "buffer", raw: false, cellText: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });

  const headerRow1 = toCellArray(rows[0] || []);
  const headerRow2 = normalizeHeaderRow(rows[1] || SECONDARY_HEADERS, SECONDARY_HEADERS);
  const dataRows = rows.slice(2);

  const normalizedRows = dataRows
    .map((row, index) => normalizeTask(row, index + 2))
    .filter((row) => row.rawCells.some((cell) => cell.trim()));

  return {
    sheetName: firstSheetName,
    headerRow1: normalizeHeaderRow(headerRow1, Array(COLUMN_KEYS.length).fill("")),
    headerRow2,
    normalizedRows,
  };
}

export function getDefaultSecondaryHeaders() {
  return [...SECONDARY_HEADERS];
}

export function buildInitialTaskDocuments(templateId, tasks) {
  let lastSequentialId = null;
  let sequentialRow = 0;
  let branchCount = 0;

  return tasks.map((task, index) => {
    const _id = new ObjectId();
    const isParallel = task.isParallel && Boolean(lastSequentialId);
    const dependsOnTaskIds = isParallel
      ? [lastSequentialId.toString()]
      : lastSequentialId
        ? [lastSequentialId.toString()]
        : [];

    if (isParallel) {
      branchCount += 1;
    } else if (lastSequentialId) {
      sequentialRow += 1;
      branchCount = 0;
    }

    const x = 80 + (isParallel ? branchCount * 320 : 0);
    const y = 80 + sequentialRow * 220;

    const document = {
      _id,
      templateId,
      rowNumber: task.rowNumber,
      taskForDelegation: task.taskForDelegation,
      mainHeading: task.mainHeading,
      subHeading: task.subHeading,
      taskNumber: task.taskNumber,
      processes: task.processes,
      parallelSteps: task.parallelSteps,
      taskDescription: task.taskDescription,
      ownerCode: task.ownerCode,
      methodCode: task.methodCode,
      howWillItBeDone: task.howWillItBeDone || "",
      dueRule: task.dueRule,
      processNotes: task.processNotes,
      spacesName: task.spacesName,
      plannedFmsDate: task.plannedFmsDate,
      delegationDate: task.delegationDate,
      changedDelegationDate: task.changedDelegationDate,
      secondaryDelegationDate: task.secondaryDelegationDate,
      drawingNumber: task.drawingNumber,
      status: task.status,
      assigneeName: task.assigneeName,
      allottedDays: normalizeAllottedDays(task.allottedDays),
      reasonComment: task.reasonComment,
      taskLink: task.taskLink,
      reviewCode: task.reviewCode,
      reviewName: task.reviewName,
      supportCode: task.supportCode,
      supportName: task.supportName,
      extraColumn22: task.extraColumn22,
      extraColumn25: task.extraColumn25,
      rawCells: buildTaskRowCells(task),
      title: task.title,
      dependsOnTaskIds,
      relationshipType: isParallel ? "parallel" : index === 0 ? "root" : "sequential",
      position: {
        x,
        y,
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!isParallel) {
      lastSequentialId = _id;
    }

    return document;
  });
}

export function serializeTemplate(template) {
  return {
    ...template,
    headerRow1: normalizeHeaderRow(template.headerRow1, Array(COLUMN_KEYS.length).fill("")),
    headerRow2: normalizeHeaderRow(template.headerRow2, SECONDARY_HEADERS),
    _id: template._id.toString(),
    importedAt: template.importedAt instanceof Date ? template.importedAt.toISOString() : template.importedAt,
    updatedAt: template.updatedAt instanceof Date ? template.updatedAt.toISOString() : template.updatedAt,
  };
}

export function serializeTask(task) {
  const normalizedTask = {
    ...task,
    delegationDate: String(task.delegationDate ?? "").trim(),
    changedDelegationDate: String(task.changedDelegationDate ?? "").trim(),
    secondaryDelegationDate: String(task.secondaryDelegationDate ?? "").trim(),
    drawingNumber: String(task.drawingNumber ?? "").trim(),
    status: String(task.status ?? "").trim(),
    assigneeName: String(task.assigneeName ?? "").trim(),
    howWillItBeDone: String(task.howWillItBeDone ?? "").trim(),
    allottedDays: normalizeAllottedDays(task.allottedDays),
  };

  return {
    ...normalizedTask,
    rawCells: buildTaskRowCells({
      ...normalizedTask,
      rawCells: Array.isArray(task.rawCells) ? task.rawCells : [],
    }),
    _id: task._id.toString(),
    templateId: task.templateId?.toString ? task.templateId.toString() : String(task.templateId || ""),
    dependsOnTaskIds: Array.isArray(task.dependsOnTaskIds)
      ? task.dependsOnTaskIds.map((value) => value.toString())
      : [],
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  };
}

export function sanitizeTaskPatch(body) {
  const editableFields = [
    "title",
    "taskForDelegation",
    "mainHeading",
    "subHeading",
    "taskNumber",
    "processes",
    "parallelSteps",
    "taskDescription",
    "ownerCode",
    "methodCode",
    "howWillItBeDone",
    "dueRule",
    "processNotes",
    "spacesName",
    "plannedFmsDate",
    "delegationDate",
    "changedDelegationDate",
    "secondaryDelegationDate",
    "drawingNumber",
    "status",
    "assigneeName",
    "allottedDays",
    "reasonComment",
    "taskLink",
    "reviewCode",
    "reviewName",
    "supportCode",
    "supportName",
    "relationshipType",
  ];

  const update = {};
  editableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const nextValue = typeof body[field] === "string" ? body[field].trim() : body[field];
      update[field] =
        field === "ownerCode" && typeof nextValue === "string"
          ? nextValue.toUpperCase()
          : field === "allottedDays"
            ? normalizeAllottedDays(nextValue)
            : nextValue;
    }
  });

  if (Array.isArray(body.dependsOnTaskIds)) {
    update.dependsOnTaskIds = body.dependsOnTaskIds
      .filter(Boolean)
      .map((value) => String(value));
  }

  if (body.position && typeof body.position === "object") {
    update.position = {
      x: Number(body.position.x) || 0,
      y: Number(body.position.y) || 0,
      width: Number(body.position.width) || DEFAULT_NODE_WIDTH,
      height: Number(body.position.height) || DEFAULT_NODE_HEIGHT,
    };
  }

  update.updatedAt = new Date();
  return update;
}
