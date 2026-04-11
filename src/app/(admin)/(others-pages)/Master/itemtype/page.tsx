"use client";
import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import ItemTypeModal from "./ItemTypeModal";
import { exportToExcel } from "@/lib/excelUtils";

interface ItemType {
  _id: string;
  typeName: string;
  concernedDepartment: string;
  category: string;
  description: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function ItemTypesPage() {
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchItemTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/master/itemtype");
      const data = await response.json();
      
      if (response.ok) {
        setItemTypes(data.itemTypes);
      } else {
        setError(data.error || "Failed to fetch item types");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this item type?")) {
      return;
    }

    try {
      const response = await fetch(`/api/master/itemtype/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setItemTypes(itemTypes.filter(itemType => itemType._id !== id));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete item type");
      }
    } catch {
      setError("Network error occurred");
    }
  };

  const handleEdit = (itemType: ItemType) => {
    setEditingItemType(itemType);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItemType(null);
  };

  const handleItemTypeSave = () => {
    fetchItemTypes();
    handleCloseModal();
  };

  const handleExport = () => {
    const result = exportToExcel(itemTypes, 'item-types-export.xlsx');
    if (result.success) {
      console.log(result.message);
    } else {
      setError(result.message);
    }
  };

  const filteredItemTypes = itemTypes.filter(itemType =>
    itemType.typeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    itemType.concernedDepartment.toLowerCase().includes(searchTerm.toLowerCase()) ||
    itemType.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchItemTypes();
  }, []);

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Item Type Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage item types and their associated departments
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search item types..."
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
            
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
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
              Add Item Type
            </button>
          </div>
        </div>

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

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="text-gray-500 dark:text-gray-400">Loading item types...</div>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredItemTypes.length} of {itemTypes.length} item types
            </div>

            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                  <TableRow>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      S.No
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Type Name
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Department
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Category
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Description
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Status
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredItemTypes.length === 0 ? (
                    <TableRow>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? "No item types found matching your search" : "No item types available. Add your first item type!"}
                      </td>
                    </TableRow>
                  ) : (
                    filteredItemTypes.map((itemType, index) => (
                      <TableRow key={itemType._id}>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {itemType.typeName}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge size="sm" color="info">
                            {itemType.concernedDepartment}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {itemType.category}
                        </TableCell>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {itemType.description ? (
                            <span title={itemType.description}>
                              {itemType.description.length > 50 
                                ? `${itemType.description.substring(0, 50)}...` 
                                : itemType.description}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1">
                            <Badge
                              size="sm"
                              color={itemType.isActive ? "success" : "error"}
                            >
                              {itemType.isActive ? "Active" : "Inactive"}
                            </Badge>
                            {itemType.requiresApproval && (
                              <Badge size="sm" color="warning">
                                Needs Approval
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(itemType)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(itemType._id)}
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

        <ItemTypeModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleItemTypeSave}
          itemType={editingItemType}
        />
      </div>
    </div>
  );
}
