"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (machines: ProcessedMachine[]) => void;
}

interface ProcessedMachine {
  machineName: string;
  respectiveDepartment: string;
  stock: number;
  minStock: number;
  maxStock: number;
  description: string;
  isActive: boolean;
  linkedItems: {
    itemId: string;
    quantity: number;
    itemName: string; // For display purposes
    unit: string;
  }[];
}

interface ImportResult {
  success: boolean;
  data: ProcessedMachine[];
  errors: string[];
  skippedItems: string[];
  totalRows: number;
  validMachines: number;
  debug?: {
    rawDataSample?: unknown[];
    machineGroups?: string[];
    totalItemsInDb?: number;
    fileInfo?: {
      name: string;
      size: number;
      type: string;
    };
    error?: string;
    stack?: string;
  };
}

interface BulkImportResponse {
  success: boolean;
  message: string;
  results: ProcessedMachine[];
  errors: string[];
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
    itemsSkipped: number;
  };
}

export default function MachineImportModal({
  isOpen,
  onClose,
  onImport,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkImportResult, setBulkImportResult] =
    useState<BulkImportResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.ms-excel.sheet.macroEnabled.12",
      ];

      if (
        !validTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith(".xlsx") &&
        !selectedFile.name.endsWith(".xls")
      ) {
        setError("Please select a valid Excel file (.xlsx or .xls)");
        return;
      }

      setFile(selectedFile);
      setError("");
      setImportResult(null);
      setBulkImportResult(null);
    }
  };

  const parseExcelFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error("Failed to read file data"));
            return;
          }

          let workbook;

          if (data instanceof ArrayBuffer) {
            workbook = XLSX.read(data, { type: "array" });
          } else {
            workbook = XLSX.read(data, { type: "binary" });
          }

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error("No sheets found in Excel file"));
            return;
          }

          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];

          let jsonData;

          try {
            jsonData = XLSX.utils.sheet_to_json(worksheet);
          } catch {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length > 0) {
              const headers = jsonData[0] as string[];
              const dataRows = jsonData.slice(1) as unknown[][];

              jsonData = dataRows.map((row) => {
                const obj: Record<string, unknown> = {};
                headers.forEach((header, index) => {
                  if (header && header.trim()) {
                    obj[header.trim()] = row[index] || "";
                  }
                });
                return obj;
              });
            }
          }

          if (!jsonData || jsonData.length === 0) {
            reject(new Error("No data found in Excel file"));
            return;
          }

          resolve(jsonData as Record<string, unknown>[]);
        } catch (error) {
          console.error("Excel parsing error:", error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file: " + reader.error?.message));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const processImportData = async (file: File): Promise<ImportResult> => {
    try {
      console.log("Starting Excel file processing...");
      const rawData = await parseExcelFile(file);

      console.log("Raw data parsed:", rawData.length, "rows");

      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          data: [],
          errors: ["No data found in Excel file"],
          skippedItems: [],
          totalRows: 0,
          validMachines: 0,
        };
      }

      // Fetch all items from the database for matching
      console.log("Fetching items from database...");
      const itemsResponse = await fetch("/api/master/items");
      if (!itemsResponse.ok) {
        throw new Error("Failed to fetch items from database");
      }
      const itemsData = await itemsResponse.json();
      const items = itemsData.items || [];

      console.log("Found", items.length, "items in database");

      // Create item lookup map (case-insensitive and normalized)
      const itemLookup = new Map<
        string,
        { _id: string; itemName: string; unit: string; type: string }
      >();
      items.forEach(
        (item: {
          _id: string;
          itemName: string;
          unit: string;
          type: string;
        }) => {
          const normalizedName = item.itemName
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, "")
            .replace(/\s+/g, " ");
          itemLookup.set(normalizedName, {
            _id: item._id,
            itemName: item.itemName,
            unit: item.unit,
            type: item.type,
          });
        },
      );

      // Group rows by machine
      const machineGroups = new Map<
        string,
        (Record<string, unknown> & {
          _rowNumber: number;
          _machineName: string;
        })[]
      >();
      const errors: string[] = [];
      const skippedItems: string[] = [];

      rawData.forEach((row: Record<string, unknown>, index: number) => {
        const rowNum = index + 1;

        // Get machine name (could be in first row of group or provided) - with safe string conversion
        const rawMachineName =
          row["MACHINE NAME"] ||
          row["Machine Name"] ||
          row["machineName"] ||
          "";
        const machineName =
          typeof rawMachineName === "string"
            ? rawMachineName
            : String(rawMachineName || "");
        const rawItemName =
          row["ITEM NAME"] || row["Item Name"] || row["itemName"] || "";
        const itemName =
          typeof rawItemName === "string"
            ? rawItemName
            : String(rawItemName || "");

        if (!machineName && !itemName) {
          errors.push(`Row ${rowNum}: No machine name or item name found`);
          return;
        }

        // If we have a machine name, this starts a new machine group
        let currentMachineName = machineName;

        // If no machine name in this row, try to find the last machine name
        if (!currentMachineName) {
          // Look backwards for the machine name
          for (let i = index - 1; i >= 0; i--) {
            const prevRow = rawData[i];
            const prevRawMachineName =
              prevRow["MACHINE NAME"] ||
              prevRow["Machine Name"] ||
              prevRow["machineName"] ||
              "";
            const prevMachineName =
              typeof prevRawMachineName === "string"
                ? prevRawMachineName
                : String(prevRawMachineName || "");
            if (prevMachineName) {
              currentMachineName = prevMachineName;
              break;
            }
          }
        }

        if (!currentMachineName) {
          errors.push(`Row ${rowNum}: Cannot determine machine name`);
          return;
        }

        // Initialize machine group if not exists
        if (!machineGroups.has(currentMachineName)) {
          machineGroups.set(currentMachineName, []);
        }

        machineGroups.get(currentMachineName)!.push({
          ...row,
          _rowNumber: rowNum,
          _machineName: currentMachineName,
        });
      });

      console.log("Found", machineGroups.size, "unique machines");

      // Process each machine group
      const processedMachines: ProcessedMachine[] = [];

      for (const [machineName, rows] of machineGroups) {
        // Ensure machineName is a string
        const safeMachineName =
          typeof machineName === "string"
            ? machineName
            : String(machineName || "");
        console.log(
          `Processing machine: ${safeMachineName} with ${rows.length} rows`,
        );

        // Get machine details from first row
        const firstRow = rows[0];
        const rawDepartment =
          firstRow["Department"] || firstRow["DEPARTMENT"] || "General";
        const department =
          typeof rawDepartment === "string"
            ? rawDepartment
            : String(rawDepartment || "General");

        const stock =
          parseInt(String(firstRow["Stock"] || firstRow["STOCK"] || "0")) || 0;
        const minStock =
          parseInt(
            String(firstRow["Min Stock"] || firstRow["MIN STOCK"] || "0"),
          ) || 0;
        const maxStock =
          parseInt(
            String(firstRow["Max Stock"] || firstRow["MAX STOCK"] || "0"),
          ) || 0;

        const rawDescription =
          firstRow["Description"] || firstRow["DESCRIPTION"] || "";
        const description =
          typeof rawDescription === "string"
            ? rawDescription
            : String(rawDescription || "");

        const rawStatus = firstRow["Status"] || firstRow["STATUS"] || "Active";
        const status =
          typeof rawStatus === "string"
            ? rawStatus
            : String(rawStatus || "Active");

        const linkedItems: ProcessedMachine["linkedItems"] = [];

        // Process items for this machine
        for (const row of rows) {
          const rawItemName =
            row["ITEM NAME"] || row["Item Name"] || row["itemName"] || "";
          const itemName =
            typeof rawItemName === "string"
              ? rawItemName
              : String(rawItemName || "");
          const quantity =
            parseInt(
              String(
                row["ITEM QUANTITY PER MACHINE"] || row["Quantity"] || "1",
              ),
            ) || 1;

          if (!itemName || itemName === "NO ITEMS LINKED") {
            continue;
          }

          // Find matching item in database
          const normalizedItemName = itemName
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, "")
            .replace(/\s+/g, " ");
          const matchedItem = itemLookup.get(normalizedItemName);

          if (matchedItem) {
            linkedItems.push({
              itemId: matchedItem._id,
              quantity: quantity,
              itemName: matchedItem.itemName,
              unit: matchedItem.unit,
            });
            console.log(
              `✓ Matched item: ${itemName} -> ${matchedItem.itemName}`,
            );
          } else {
            skippedItems.push(
              `${safeMachineName}: ${itemName} (not found in database)`,
            );
            console.log(`✗ Skipped item: ${itemName} (not found)`);
          }
        }

        // Create machine object with safe string handling
        const processedMachine: ProcessedMachine = {
          machineName: safeMachineName.trim(),
          respectiveDepartment: department,
          stock: stock,
          minStock: minStock,
          maxStock: maxStock || Math.max(minStock * 2, 100), // Default max stock
          description: description,
          isActive: status.toLowerCase().includes("active"),
          linkedItems: linkedItems,
        };

        processedMachines.push(processedMachine);
      }

      console.log(
        "Processing complete:",
        processedMachines.length,
        "machines processed",
      );

      return {
        success: true,
        data: processedMachines,
        errors: errors,
        skippedItems: skippedItems,
        totalRows: rawData.length,
        validMachines: processedMachines.length,
        debug: {
          rawDataSample: rawData.slice(0, 3),
          machineGroups: Array.from(machineGroups.keys()),
          totalItemsInDb: items.length,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
        },
      };
    } catch (error: unknown) {
      console.error("Import processing error:", error);
      return {
        success: false,
        data: [],
        errors: [
          error instanceof Error
            ? error.message
            : "Failed to process Excel file",
        ],
        skippedItems: [],
        totalRows: 0,
        validMachines: 0,
        debug: {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await processImportData(file);

      console.log("Final import result:", result);
      setImportResult(result);

      if (!result.success) {
        setError(result.errors[0] || "Failed to process Excel file");
      } else if (result.data.length === 0) {
        setError(
          "No valid machines found. Please check your Excel file format.",
        );
      }
    } catch (error: unknown) {
      console.error("Handle import error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to import Excel file",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult || !importResult.data) return;

    try {
      setLoading(true);

      console.log(
        "Starting bulk import of",
        importResult.data.length,
        "machines",
      );

      // Use the machine bulk import endpoint
      const response = await fetch("/api/master/machine/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(importResult.data),
      });

      const result: BulkImportResponse = await response.json();

      if (response.ok && result.success) {
        setBulkImportResult(result);

        console.log("Bulk import successful:", result);
        onImport(result.results || []);

        setTimeout(() => {
          handleClose();
        }, 4000);
      } else {
        setError(result.errors?.[0] || "Failed to import machines");
        setBulkImportResult(result);
      }
    } catch (error: unknown) {
      console.error("Import error:", error);
      setError(
        "Network error occurred during import: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError("");
    setImportResult(null);
    setBulkImportResult(null);
    onClose();
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "S.No.": "A",
        "MACHINE NAME": "Sample Machine 1",
        "ITEM NAME": "COMPLETE KIT",
        "ITEM QUANTITY PER MACHINE": 1,
        UNIT: "NOS",
        Department: "Production",
        Stock: 5,
        "Min Stock": 2,
        "Max Stock": 10,
        Description: "Sample machine description",
        Status: "Active",
      },
      {
        "S.No.": "2",
        "MACHINE NAME": "",
        "ITEM NAME": "MAIN SHAFT",
        "ITEM QUANTITY PER MACHINE": 1,
        UNIT: "NOS",
        Department: "",
        Stock: "",
        "Min Stock": "",
        "Max Stock": "",
        Description: "",
        Status: "",
      },
      {
        "S.No.": "3",
        "MACHINE NAME": "",
        "ITEM NAME": "CONNECTING ROD",
        "ITEM QUANTITY PER MACHINE": 2,
        UNIT: "NOS",
        Department: "",
        Stock: "",
        "Min Stock": "",
        "Max Stock": "",
        Description: "",
        Status: "",
      },
      {
        "S.No.": "B",
        "MACHINE NAME": "Sample Machine 2",
        "ITEM NAME": "MOTOR",
        "ITEM QUANTITY PER MACHINE": 1,
        UNIT: "NOS",
        Department: "Production",
        Stock: 3,
        "Min Stock": 1,
        "Max Stock": 8,
        Description: "Another sample machine",
        Status: "Active",
      },
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 8 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Machine Import Template",
    );
    XLSX.writeFile(workbook, "machine-import-template.xlsx");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Import Machines from Excel
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Success Result */}
        {bulkImportResult && bulkImportResult.success && (
          <div className="mb-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-medium text-green-800 dark:text-green-200">
                  Machine Import Completed! 🎉
                </h3>
                <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Machines:</span>{" "}
                    {bulkImportResult.summary.total}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    <span className="text-green-600">
                      {bulkImportResult.summary.created}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>{" "}
                    <span className="text-blue-600">
                      {bulkImportResult.summary.updated}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Items Skipped:</span>{" "}
                    <span className="text-yellow-600">
                      {bulkImportResult.summary.itemsSkipped || 0}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-sm text-green-700 dark:text-green-300">
                  This modal will close automatically in 4 seconds...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug info section */}
        {importResult?.debug && (
          <div className="mb-4 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
            <h4 className="mb-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Processing Information:
            </h4>
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              <div>
                <strong>File:</strong> {importResult.debug.fileInfo?.name}
              </div>
              <div>
                <strong>Items in database:</strong>{" "}
                {importResult.debug.totalItemsInDb}
              </div>
              <div>
                <strong>Machines found:</strong>{" "}
                {importResult.debug.machineGroups?.join(", ")}
              </div>
              <div>
                <strong>Total rows processed:</strong> {importResult.totalRows}
              </div>
            </div>
          </div>
        )}

        {/* Template Download */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Machine Import Requirements
              </h3>
              <ul className="mt-1 list-inside list-disc text-sm text-blue-600 dark:text-blue-300">
                <li>MACHINE NAME column for machine identification</li>
                <li>
                  ITEM NAME column for items to link (must exist in Items
                  collection)
                </li>
                <li>ITEM QUANTITY PER MACHINE for quantities</li>
                <li>
                  Items not found in database will be skipped automatically
                </li>
                <li>
                  Machine details (Department, Stock, etc.) from first row of
                  each machine
                </li>
              </ul>
              <button
                onClick={handleDownloadTemplate}
                className="mt-2 text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                Download Template
              </button>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Select Excel File *
          </label>
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
              id="excel-file"
            />
            <label
              htmlFor="excel-file"
              className="flex cursor-pointer flex-col items-center"
            >
              <svg
                className="mb-2 h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {file
                  ? file.name
                  : "Click to select Excel file or drag and drop"}
              </span>
              <span className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                .xlsx or .xls files with machine and item data
              </span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md border border-red-400 bg-red-100 p-3 text-red-700">
            <pre className="text-xs whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* Import Result Preview */}
        {importResult && importResult.data.length > 0 && !bulkImportResult && (
          <div className="mb-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <h3 className="mb-2 text-lg font-medium text-green-800 dark:text-green-200">
              Import Preview
            </h3>
            <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-600 dark:text-green-400">
                  Total Machines:
                </span>
                <span className="ml-2 font-medium">
                  {importResult.validMachines}
                </span>
              </div>
              <div>
                <span className="text-green-600 dark:text-green-400">
                  Items Skipped:
                </span>
                <span className="ml-2 font-medium text-yellow-600">
                  {importResult.skippedItems.length}
                </span>
              </div>
            </div>

            <div className="mt-3">
              <h4 className="mb-1 text-sm font-medium text-green-600 dark:text-green-400">
                Sample machines to import:
              </h4>
              <div className="max-h-32 space-y-2 overflow-y-auto text-xs text-green-600 dark:text-green-300">
                {importResult.data.slice(0, 3).map((machine, index) => (
                  <div
                    key={index}
                    className="rounded bg-green-100 p-2 dark:bg-green-800"
                  >
                    <div className="font-medium">{machine.machineName}</div>
                    <div className="text-xs">
                      {machine.respectiveDepartment} •{" "}
                      {machine.linkedItems.length} items • Stock:{" "}
                      {machine.stock}
                    </div>
                  </div>
                ))}
                {importResult.data.length > 3 && (
                  <div className="text-center">
                    ... and {importResult.data.length - 3} more machines
                  </div>
                )}
              </div>
            </div>

            {importResult.skippedItems.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-yellow-600">
                  View {importResult.skippedItems.length} skipped items
                </summary>
                <ul className="mt-1 max-h-20 overflow-y-auto text-xs text-yellow-600">
                  {importResult.skippedItems.slice(0, 10).map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                  {importResult.skippedItems.length > 10 && (
                    <li>
                      • ... and {importResult.skippedItems.length - 10} more
                    </li>
                  )}
                </ul>
              </details>
            )}

            {importResult.errors.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-red-600">
                  View {importResult.errors.length} errors
                </summary>
                <ul className="mt-1 max-h-20 overflow-y-auto text-xs text-red-500">
                  {importResult.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {bulkImportResult?.success ? "Close" : "Cancel"}
          </button>

          {!importResult ? (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Process & Preview"}
            </button>
          ) : !bulkImportResult ? (
            <button
              onClick={handleConfirmImport}
              disabled={importResult.validMachines === 0 || loading}
              className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Importing..."
                : `Import ${importResult.validMachines} Machines`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
