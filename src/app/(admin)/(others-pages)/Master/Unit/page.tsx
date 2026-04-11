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
import UnitModal from "./UnitModal";
import UnitImportModal from "./UnitImportModal";
import { exportToExcel } from "@/lib/excelUtils";

// Define the TypeScript interface for units
interface Unit {
  _id: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  description: string;
  conversionFactor?: number;
  baseUnit?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  // Fetch units from API
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/master/unit");
      const data = await response.json();
      
      if (response.ok) {
        setUnits(data.units);
      } else {
        setError(data.error || "Failed to fetch units");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Delete unit
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this unit?")) {
      return;
    }

    try {
      const response = await fetch(`/api/master/unit/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUnits(units.filter(unit => unit._id !== id));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete unit");
      }
    } catch {
      setError("Network error occurred");
    }
  };

  // Open edit modal
  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
  };

  // Handle unit save (create/update)
  const handleUnitSave = () => {
    fetchUnits();
    handleCloseModal();
  };

  // Handle Excel export
  const handleExport = () => {
    const result = exportToExcel(units, 'units-export.xlsx');
    if (result.success) {
      console.log(result.message);
    } else {
      setError(result.message);
    }
  };

  // Handle Excel import
  const handleImport = async (importedUnits: { unitCode: string; unitName: string; unitType: string; description: string; conversionFactor: number; baseUnit: string; isActive: boolean; }[]) => {
    setImportLoading(true);
    
    try {
      const results = await Promise.allSettled(
        importedUnits.map(unit => 
          fetch("/api/master/unit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(unit),
          })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        await fetchUnits();
        console.log(`Successfully imported ${successful} units${failed > 0 ? `, ${failed} failed` : ''}`);
      }

      if (failed > 0) {
        setError(`${failed} units failed to import. Please check the data and try again.`);
      }

    } catch {
      setError("Failed to import units");
    } finally {
      setImportLoading(false);
    }
  };

  // Filter units based on search
  const filteredUnits = units.filter(unit =>
    unit.unitCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.unitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.unitType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchUnits();
  }, []);

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Unit Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage measurement units for your business items
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search units..."
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

            {/* Add Unit Button */}
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
              Add Unit
            </button>
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
            <div className="text-gray-500 dark:text-gray-400">Loading units...</div>
          </div>
        ) : (
          <>
            {/* Units Count */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredUnits.length} of {units.length} units
            </div>

            {/* Table */}
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      S.No
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Unit Code
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Unit Name
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Type
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Description
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Status
                    </TableCell>
                    <TableCell
                      isHeader
                      className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUnits.length === 0 ? (
                    <TableRow>
                      <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? "No units found matching your search" : "No units available. Add your first unit!"}
                      </td>
                    </TableRow>
                  ) : (
                    filteredUnits.map((unit, index) => (
                      <TableRow key={unit._id}>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                            {unit.unitCode}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {unit.unitName}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            size="sm"
                            color={
                              unit.unitType === "Basic" ? "primary" :
                              unit.unitType === "Weight" ? "success" :
                              unit.unitType === "Volume" ? "info" :
                              undefined
                            }
                          >
                            {unit.unitType}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {unit.description || "-"}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            size="sm"
                            color={unit.isActive ? "success" : "error"}
                          >
                            {unit.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(unit)}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(unit._id)}
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

        {/* Unit Modal */}
        <UnitModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleUnitSave}
          unit={editingUnit}
        />

        {/* Import Modal */}
        <UnitImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}
