"use client";
import React, { useState } from "react";
import * as XLSX from 'xlsx';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: ProcessedItem[]) => void;
}

interface ProcessedItem {
  itemName: string;
  unit: string;
  type: string;
  machines: string;
  stock: number;
  photo: string;
  [key: string]: string | number | boolean;
}

interface ImportResult {
  success: boolean;
  data: ProcessedItem[];
  errors: string[];
  totalRows: number;
  validRows: number;
  debug?: {
    rawDataSample?: unknown[];
    processedDataSample?: ProcessedItem[];
    headers?: string[];
    fileInfo?: {
      name: string;
      size: number;
      type: string;
    };
    error?: string;
    stack?: string;
    message?: string;
  };
}

interface BulkImportResponse {
  success: boolean;
  message: string;
  results: ProcessedItem[];
  errors: string[];
  summary: {
    total: number;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    processingTime: number;
  };
  performance: {
    itemsPerSecond: number;
    batchSize: number;
    batches: number;
  };
}

export default function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.ms-excel.sheet.macroEnabled.12'
      ];
      
      if (!validTypes.includes(selectedFile.type) && 
          !selectedFile.name.endsWith('.xlsx') && 
          !selectedFile.name.endsWith('.xls')) {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      setFile(selectedFile);
      setError("");
      setImportResult(null);
      setBulkImportResult(null);
    }
  };

  // Direct Excel parsing
  const parseExcelFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('Failed to read file data'));
            return;
          }

          console.log('File read successfully, size:', typeof data === 'string' ? data.length : data.byteLength);
          
          let workbook;
          
          try {
            if (data instanceof ArrayBuffer) {
              workbook = XLSX.read(data, { type: 'array' });
            } else {
              workbook = XLSX.read(data, { type: 'binary' });
            }
          } catch (parseError) {
            console.error('XLSX parsing error:', parseError);
            const arrayBuffer = data instanceof ArrayBuffer ? data : new ArrayBuffer(0);
            workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
          }

          console.log('Workbook parsed successfully');
          console.log('Sheet names:', workbook.SheetNames);

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('No sheets found in Excel file'));
            return;
          }

          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          
          console.log('Selected worksheet:', worksheetName);
          console.log('Worksheet range:', worksheet['!ref']);

          let jsonData;
          
          try {
            jsonData = XLSX.utils.sheet_to_json(worksheet);
          } catch (jsonError) {
            console.error('Default JSON conversion failed:', jsonError);
            
            try {
              jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              
              if (jsonData.length > 0) {
                const headers = jsonData[0] as string[];
                const dataRows = jsonData.slice(1) as unknown[][];
                
                jsonData = dataRows.map(row => {
                  const obj: Record<string, unknown> = {};
                  headers.forEach((header, index) => {
                    if (header && header.trim()) {
                      obj[header.trim()] = row[index] || '';
                    }
                  });
                  return obj;
                });
              }
            } catch (headerError) {
              console.error('Header JSON conversion failed:', headerError);
              jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            }
          }

          console.log('JSON conversion successful');
          console.log('Raw JSON data sample:', jsonData.slice(0, 2));
          console.log('Total rows found:', jsonData.length);

          if (!jsonData || jsonData.length === 0) {
            reject(new Error('No data found in Excel file. Make sure the sheet contains data.'));
            return;
          }

          resolve(jsonData as Record<string, unknown>[]);
          
        } catch (error) {
          console.error('Excel parsing error:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file: ' + reader.error?.message));
      };

      try {
        reader.readAsArrayBuffer(file);
      } catch {
        console.log('ArrayBuffer read failed, trying binary string');
        try {
          reader.readAsBinaryString(file);
        } catch {
          reject(new Error('Cannot read file'));
        }
      }
    });
  };

  const getItemName = (row: Record<string, unknown>): string => {
    if (!row || typeof row !== 'object') return '';

    const possibleNames = [
      'itemName', 'Item Name', 'ITEM NAME', 'item name', 'ItemName',
      'name', 'Name', 'NAME', 'product', 'Product', 'PRODUCT',
      'title', 'Title', 'TITLE', 'item_name', 'product_name'
    ];

    for (const key of possibleNames) {
      if (row[key] && typeof row[key] === 'string' && row[key].trim()) {
        return row[key].trim();
      }
    }

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string' && value.trim()) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('item') || lowerKey.includes('name') || lowerKey.includes('product')) {
          return value.trim();
        }
      }
    }

    for (const [, value] of Object.entries(row)) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  };

  const processImportData = async (file: File): Promise<ImportResult> => {
    try {
      console.log('Starting Excel file processing...');
      const rawData = await parseExcelFile(file);
      
      console.log('Raw data parsed:', rawData.length, 'rows');
      
      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          data: [],
          errors: ['No data found in Excel file'],
          totalRows: 0,
          validRows: 0,
          debug: { message: 'Empty file or no readable data' }
        };
      }

      const processedData: ProcessedItem[] = rawData.map((row: Record<string, unknown>): ProcessedItem => {
        const itemName = getItemName(row);
        
        return {
          itemName: itemName,
          unit: String(row.unit || row['Unit'] || row['UNIT'] || 'Piece'),
          type: String(row.type || row['Type'] || row['TYPE'] || 'General'),
          machines: String(row.machines || row['Machines'] || row['MACHINES'] || 'Not Specified'),
          stock: parseInt(String(row.stock || row['Stock'] || row['STOCK'] || '0')) || 0,
          photo: String(row.photo || row['Photo URL'] || row['Photo'] || row['PHOTO URL'] || ''),
          
          ...Object.keys(row).reduce((acc: Record<string, string | number | boolean>, key: string) => {
            const lowerKey = key.toLowerCase();
            if (!['itemname', 'item name', 'name', 'unit', 'type', 'machines', 'stock', 'photo url', 'photo'].includes(lowerKey)) {
              acc[key] = row[key] as string | number | boolean;
            }
            return acc;
          }, {})
        };
      });

      const validItems: ProcessedItem[] = [];
      const errors: string[] = [];
      
      processedData.forEach((item: ProcessedItem, index: number) => {
        const rowNum = index + 1;
        
        if (!item.itemName || !item.itemName.trim()) {
          errors.push(`Row ${rowNum}: Item Name is required (found: "${item.itemName}")`);
        } else {
          validItems.push(item);
        }
      });

      const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];

      return {
        success: true,
        data: validItems,
        errors: errors,
        totalRows: rawData.length,
        validRows: validItems.length,
        debug: {
          rawDataSample: rawData.slice(0, 2),
          processedDataSample: processedData.slice(0, 2),
          headers: headers,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type
          }
        }
      };
      
    } catch (error: unknown) {
      console.error('Import processing error:', error);
      return {
        success: false,
        data: [],
        errors: [error instanceof Error ? error.message : 'Failed to process Excel file'],
        totalRows: 0,
        validRows: 0,
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type
          }
        }
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
      
      console.log('Final import result:', result);
      setImportResult(result);
      
      if (!result.success) {
        setError(result.errors[0] || "Failed to process Excel file");
      } else if (result.data.length === 0) {
        setError("No valid items found. Please check your Excel file format.");
      }
    } catch (error: unknown) {
      console.error('Handle import error:', error);
      setError(error instanceof Error ? error.message : "Failed to import Excel file");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importResult || !importResult.data) return;
    
    try {
      setLoading(true);
      
      console.log('Starting bulk import of', importResult.data.length, 'items');
      
      // Use the dedicated bulk import endpoint
      const response = await fetch("/api/master/items/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(importResult.data),
      });

      const result: BulkImportResponse = await response.json();
      
      if (response.ok && result.success) {
        setBulkImportResult(result);
        
        // Show detailed success message
        console.log('Bulk import successful:', result);
        onImport(result.results || []);
        
        // Show success for 3 seconds then close
        setTimeout(() => {
          handleClose();
        }, 3000);
        
      } else {
        setError(result.errors?.[0] || "Failed to import items");
        setBulkImportResult(result);
      }
    } catch (error: unknown) {
      console.error('Import error:', error);
      setError("Network error occurred during import");
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
        'Item Name': 'Sample Item 1',
        'Unit': 'Piece',
        'Type': 'Electronics',
        'Machines': 'Machine 1',
        'Stock': 100,
        'Photo URL': ''
      },
      {
        'Item Name': 'Sample Item 2',
        'Unit': 'Kg',
        'Type': 'Materials',
        'Machines': 'Machine 2',
        'Stock': 50,
        'Photo URL': ''
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    worksheet['!cols'] = [
      { wch: 25 }, { wch: 12 }, { wch: 15 }, 
      { wch: 20 }, { wch: 10 }, { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
    XLSX.writeFile(workbook, 'items-template.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Bulk Import Items from Excel
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

        {/* Bulk Import Success Result */}
        {bulkImportResult && bulkImportResult.success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
                  Import Completed Successfully! 🎉
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div><span className="font-medium">Total Items:</span> {bulkImportResult.summary.total}</div>
                  <div><span className="font-medium">Created:</span> <span className="text-green-600">{bulkImportResult.summary.created}</span></div>
                  <div><span className="font-medium">Updated:</span> <span className="text-blue-600">{bulkImportResult.summary.updated}</span></div>
                  <div><span className="font-medium">Failed:</span> <span className="text-red-600">{bulkImportResult.summary.failed}</span></div>
                </div>
                <div className="text-xs text-green-600 dark:text-green-300">
                  <div>Processing speed: {bulkImportResult.performance.itemsPerSecond} items/second</div>
                  <div>Batch size: {bulkImportResult.performance.batchSize} items per batch</div>
                </div>
                {bulkImportResult.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-red-600">
                      View {bulkImportResult.errors.length} errors
                    </summary>
                    <ul className="mt-1 text-xs text-red-500 max-h-20 overflow-y-auto">
                      {bulkImportResult.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-3 text-sm text-green-700 dark:text-green-300">
                  This modal will close automatically in 3 seconds...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug info section */}
        {importResult?.debug && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
              Debug Information:
            </h4>
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              <div><strong>File:</strong> {importResult.debug.fileInfo?.name} ({importResult.debug.fileInfo?.size} bytes)</div>
              <div><strong>Type:</strong> {importResult.debug.fileInfo?.type}</div>
              <div><strong>Headers found:</strong> {importResult.debug.headers?.join(', ') || 'None'}</div>
              <div><strong>Total rows:</strong> {importResult.totalRows}</div>
              {importResult.debug.error && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-800 rounded">
                  <strong>Error:</strong> {importResult.debug.error}
                </div>
              )}
              {importResult.debug.rawDataSample && importResult.debug.rawDataSample.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Raw data sample</summary>
                  <pre className="mt-1 p-2 bg-yellow-100 dark:bg-yellow-800 rounded text-xs overflow-x-auto">
                    {JSON.stringify(importResult.debug.rawDataSample, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Template Download */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Bulk Import Features
              </h3>
              <ul className="text-sm text-blue-600 dark:text-blue-300 mt-1 list-disc list-inside">
                <li>Processes up to 100 items per batch for optimal performance</li>
                <li>Automatically creates new items or updates existing ones</li>
                <li>Smart duplicate detection ignores case, spacing, and symbols</li>
                <li>Real-time processing statistics and error reporting</li>
              </ul>
              <button
                onClick={handleDownloadTemplate}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
              >
                Download Template
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
              id="excel-file"
            />
            <label
              htmlFor="excel-file"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg className="h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {file ? file.name : 'Click to select Excel file or drag and drop'}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                .xlsx or .xls files • Optimized for bulk processing
              </span>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <pre className="whitespace-pre-wrap text-xs">{error}</pre>
          </div>
        )}

        {/* Import Result Preview */}
        {importResult && importResult.data.length > 0 && !bulkImportResult && (
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
                <span className="text-green-600 dark:text-green-400">Valid Items:</span>
                <span className="ml-2 font-medium">{importResult.validRows}</span>
              </div>
            </div>
            
            <div className="mt-3">
              <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                Sample items to import:
              </h4>
              <div className="text-xs text-green-600 dark:text-green-300 space-y-1 max-h-32 overflow-y-auto">
                {importResult.data.slice(0, 5).map((item: ProcessedItem, index: number) => (
                  <div key={index} className="bg-green-100 dark:bg-green-800 p-2 rounded">
                    <strong>{item.itemName}</strong> • Unit: {item.unit} • Type: {item.type} • Stock: {item.stock}
                  </div>
                ))}
                {importResult.data.length > 5 && (
                  <div className="text-center">... and {importResult.data.length - 5} more items</div>
                )}
              </div>
            </div>
            
            {importResult.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">
                  Issues found:
                </h4>
                <ul className="text-xs text-red-500 dark:text-red-400 space-y-1 max-h-20 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
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
            {bulkImportResult?.success ? 'Close' : 'Cancel'}
          </button>
          
          {!importResult ? (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing..." : "Process & Preview"}
            </button>
          ) : !bulkImportResult ? (
            <button
              onClick={handleConfirmImport}
              disabled={importResult.validRows === 0 || loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Importing..." : `Bulk Import (${importResult.validRows} items)`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
