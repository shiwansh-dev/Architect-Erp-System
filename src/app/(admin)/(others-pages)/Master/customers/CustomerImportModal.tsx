"use client";
import React, { useState } from "react";
import * as XLSX from 'xlsx';

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}

type CustomerData = {
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  paymentTerms?: string;
  creditLimit?: number;
  isActive?: boolean;
};

export default function CustomerImportModal({ isOpen, onClose, onImport }: CustomerImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
      setSuccess("");
      setPreviewData([]);
    }
  };

  const parseExcelFile = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError("");

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError("No data found in the Excel file");
        return;
      }

      const customers: CustomerData[] = (jsonData as Record<string, unknown>[]).map((row: Record<string, unknown>, index: number) => {
        const name = String(row['Customer Name'] || row['CUSTOMER NAME'] || row['Name'] || '').trim();
        if (!name) {
          throw new Error(`Row ${index + 2}: Customer Name is required`);
        }

        const email = String(row['Email'] || row['EMAIL'] || '').trim();
        const phone = String(row['Phone'] || row['PHONE'] || '').trim();
        const gstin = String(row['GSTIN'] || row['Gstin'] || '').trim();
        
        const paymentTerms = String(row['Payment Terms'] || row['PAYMENT TERMS'] || 'Due on Receipt').trim();
        const creditLimit = parseFloat(String(row['Credit Limit'] || row['CREDIT LIMIT'] || '0')) || 0;
        const status = String(row['Status'] || row['STATUS'] || 'Active').trim();
        
        return {
          name,
          email: email || undefined,
          phone: phone || undefined,
          gstin: gstin || undefined,
          billingAddress: {
            line1: String(row['Address Line 1'] || row['ADDRESS LINE 1'] || '').trim() || undefined,
            line2: String(row['Address Line 2'] || row['ADDRESS LINE 2'] || '').trim() || undefined,
            city: String(row['City'] || row['CITY'] || '').trim() || undefined,
            state: String(row['State'] || row['STATE'] || '').trim() || undefined,
            zip: String(row['ZIP'] || row['Zip'] || '').trim() || undefined,
            country: String(row['Country'] || row['COUNTRY'] || 'India').trim(),
          },
          paymentTerms: paymentTerms || 'Due on Receipt',
          creditLimit,
          isActive: status.toLowerCase().includes('active'),
        };
      });

      setPreviewData(customers);
      setSuccess(`Successfully parsed ${customers.length} customers from Excel file`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse Excel file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setError("No data to import");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/master/customers/bulk-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customers: previewData }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(`Successfully imported ${result.imported} customers`);
        setTimeout(() => {
          onImport();
          onClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to import customers");
      }
    } catch {
      setError("Network error occurred during import");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setError("");
    setSuccess("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Import Customers from Excel
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Excel File
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Parse Button */}
          {file && (
            <button
              onClick={parseExcelFile}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Parsing..." : "Parse File"}
            </button>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {success}
            </div>
          )}

          {/* Preview Data */}
          {previewData.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-3">
                Preview Data ({previewData.length} customers)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        City
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {previewData.slice(0, 10).map((customer, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                          {customer.name}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                          {customer.email || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                          {customer.phone || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                          {customer.billingAddress?.city || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                          {customer.isActive ? "Active" : "Inactive"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 10 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 10 rows. Total: {previewData.length} customers
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import Button */}
          {previewData.length > 0 && (
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Importing..." : `Import ${previewData.length} Customers`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
