"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Image from "next/image";
import ImportModal from "./ImportModal";
import { exportToExcel } from "@/lib/excelUtils";

// Define the TypeScript interface for machine usage
interface MachineUsage {
  machineId: string;
  machineName: string;
  quantity: number;
}

// Define the TypeScript interface for items
interface Item {
  _id: string;
  itemName: string;
  unit: string;
  type: string;
  machines: string;
  stock: number;
  photo: string;
  machineUsage?: MachineUsage[];
  createdAt?: string;
  updatedAt?: string;
}

// Define the TypeScript interface for processed items (for import)
interface ProcessedItem {
  itemName: string;
  unit: string;
  type: string;
  machines: string;
  stock: number;
  photo: string;
  [key: string]: string | number | boolean;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch items from API
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/master/items");
      const data = await response.json();
      
      if (response.ok) {
        setItems(data.items);
      } else {
        setError(data.error || "Failed to fetch items");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      const response = await fetch(`/api/master/items/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setItems(items.filter(item => item._id !== id));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete item");
      }
    } catch {
      setError("Network error occurred");
    }
  };


  // Handle Excel export
  const handleExport = () => {
    const result = exportToExcel(items);
    if (result.success) {
      // Show success message (you can use toast notification here)
      console.log(result.message);
    } else {
      setError(result.message);
    }
  };

  // Handle Excel import
  const handleImport = async (importedItems: ProcessedItem[]) => {
    setImportLoading(true);
    
    try {
      // Import items one by one
      const results = await Promise.allSettled(
        importedItems.map(item => 
          fetch("/api/master/items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(item),
          })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        await fetchItems(); // Refresh the list
        console.log(`Successfully imported ${successful} items${failed > 0 ? `, ${failed} failed` : ''}`);
      }

      if (failed > 0) {
        setError(`${failed} items failed to import. Please check the data and try again.`);
      }

    } catch {
      setError("Failed to import items");
    } finally {
      setImportLoading(false);
    }
  };

  // Toggle expanded state for machine usage
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Filter items based on search
  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.machines.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchItems();
  }, []);

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Item Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your business items, inventory and details
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            
            {/* Export Button */}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>

            {/* Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              disabled={importLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
              </svg>
              {importLoading ? "Importing..." : "Import Excel"}
            </button>

            {/* Add Item Button */}
            <Link
              href="/Master/Items/create"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Item
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500 dark:text-gray-400">Loading items...</div>
          </div>
        ) : (
          <>
            {/* Items Count */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredItems.length} of {items.length} items
            </div>

            {/* Table */}
            <div className="max-w-full overflow-x-auto">
              <Table className="min-w-[1200px] w-full">
                <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      S.No
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Item Details
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Unit
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Type
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Used In Machines
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Stock
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 px-4 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? "No items found matching your search" : "No items available. Add your first item!"}
                      </td>
                    </TableRow>
                  ) : (
                    filteredItems.map((item, index) => (
                      <TableRow key={item._id}>
                        <TableCell className="py-3 px-4 text-gray-500 text-theme-sm dark:text-gray-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-[50px] w-[50px] overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                              {item.photo ? (
                                <Image
                                  width={50}
                                  height={50}
                                  src={item.photo}
                                  className="h-[50px] w-[50px] object-cover"
                                  alt={item.itemName}
                                />
                              ) : (
                                <div className="h-[50px] w-[50px] flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                                  <svg
                                    className="h-6 w-6 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                                {item.itemName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-gray-500 text-theme-sm dark:text-gray-400">
                          {item.unit}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-gray-500 text-theme-sm dark:text-gray-400">
                          {item.type}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {item.machineUsage && item.machineUsage.length > 0 ? (
                              <>
                                {(expandedItems.has(item._id) 
                                  ? item.machineUsage 
                                  : item.machineUsage.slice(0, 3)
                                ).map((usage) => (
                                  <Link
                                    key={usage.machineId}
                                    href={`/Master/machine/${usage.machineId}/bom`}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/20 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                                    title={`Used in ${usage.machineName} (Qty: ${usage.quantity})`}
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="truncate max-w-[80px]">{usage.machineName}</span>
                                    <span className="text-blue-600 dark:text-blue-400">({usage.quantity})</span>
                                  </Link>
                                ))}
                                {item.machineUsage.length > 3 && (
                                  <button
                                    onClick={() => toggleExpanded(item._id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    {expandedItems.has(item._id) ? (
                                      <>
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                        </svg>
                                        Show Less
                                      </>
                                    ) : (
                                      <>
                                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        +{item.machineUsage.length - 3} More
                                      </>
                                    )}
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Not used in any machine</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Badge
                            size="sm"
                            color={
                              item.stock > 50
                                ? "success"
                                : item.stock > 10
                                ? "warning"
                                : "error"
                            }
                          >
                            {item.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/Master/Items/${item._id}/edit`}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(item._id)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Import Modal */}
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}
