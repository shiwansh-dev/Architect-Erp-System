"use client";
import React, { useState } from "react";
import { importFromExcel } from "@/lib/excelUtils";

interface UnitImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (units: UnitData[]) => void;
}

interface UnitData {
  unitCode: string;
  unitName: string;
  unitType: string;
  description: string;
  conversionFactor: number;
  baseUnit: string;
  isActive: boolean;
}

export default function UnitImportModal({ isOpen, onClose, onImport }: UnitImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{
    success: boolean;
    data: UnitData[];
    totalRows: number;
    validRows: number;
    errors: string[];
    message?: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      setFile(selectedFile);
      setError("");
      setImportResult(null);
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
      const result = await importFromExcel(file);
      
      if (result.success) {
        // Transform the data to match unit structure
        const unitData = result.data.map((row: Record<string, unknown>) => ({
          unitCode: row.unitCode || row['Unit Code'] || '',
          unitName: row.unitName || row['Unit Name'] || '',
          unitType: row.unitType || row['Unit Type'] || 'Basic',
          description: row.description || row['Description'] || '',
          conversionFactor: parseFloat(String(row.conversionFactor || row['Conversion Factor'] || '1')),
          baseUnit: row.baseUnit || row['Base Unit'] || '',
          isActive: row.isActive !== undefined ? row.isActive : (row['Is Active'] !== 'false'),
        }));

        setImportResult({
          ...result,
          data: unitData
        });
      } else {
        setError(result.message);
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to import Excel file");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (importResult && importResult.data) {
      onImport(importResult.data);
      handleClose();
    }
  };

  const handleClose = () => {
    setFile(null);
    setError("");
    setImportResult(null);
    onClose();
  };

  const handleDownloadTemplate = () => {
    // Create unit-specific template
    const templateData = [
      {
        'Unit Code': 'KG',
        'Unit Name': 'Kilogram',
        'Unit Type': 'Weight',
        'Description': 'Standard weight unit',
        'Conversion Factor': 1000,
        'Base Unit': 'GM',
        'Is Active': true
      },
      {
        'Unit Code': 'PCS',
        'Unit Name': 'Pieces',
        'Unit Type': 'Count',
        'Description': 'Individual items count',
        'Conversion Factor': 1,
        'Base Unit': '',
        'Is Active': true
      }
    ];

    // Use the existing utility but with unit data
    const XLSX = require('xlsx'); // eslint-disable-line @typescript-eslint/no-require-imports
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 15 }, // Unit Code
      { wch: 20 }, // Unit Name
      { wch: 15 }, // Unit Type
      { wch: 30 }, // Description
      { wch: 18 }, // Conversion Factor
      { wch: 15 }, // Base Unit
      { wch: 12 }  // Is Active
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Units Template');
    XLSX.writeFile(workbook, 'units-template.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Import Units from Excel
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Template Download */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Need a template?
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                Download our Excel template with the correct format and sample unit data.
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
              >
                Download Units Template
              </button>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Excel File *
          </label>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
              id="unit-excel-file"
            />
            <label
              htmlFor="unit-excel-file"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg className="h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {file ? file.name : 'Click to select Excel file or drag and drop'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Supports .xlsx and .xls files
              </span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Import Result Preview */}
        {importResult && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
              Import Preview
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-600 dark:text-green-400">Total Rows:</span>
                <span className="ml-2 font-medium">{importResult.totalRows}</span>
              </div>
              <div>
                <span className="text-green-600 dark:text-green-400">Valid Units:</span>
                <span className="ml-2 font-medium">{importResult.validRows}</span>
              </div>
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                  Validation Errors:
                </h4>
                <ul className="text-xs text-red-500 dark:text-red-400 space-y-1 max-h-20 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>• ... and {importResult.errors.length - 10} more errors</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          
          {!importResult ? (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Import & Preview"}
            </button>
          ) : (
            <button
              onClick={handleConfirmImport}
              disabled={importResult.validRows === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Import ({importResult.validRows} units)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
