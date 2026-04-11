"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import MachineModal from "./MachineModal";
import MachineImportModal from "./MachineImportModal";
import MachineDetailsModal from "./MachineDetailsModal";

interface LinkedItem {
  itemId: string;
  quantity: number;
  itemDetails?: {
    _id: string;
    itemName: string;
    unit: string;
    type: string;
  };
}

interface Machine {
  _id: string;
  machineName: string;
  respectiveDepartment: string;
  stock: number;
  minStock: number;
  maxStock: number;
  description: string;
  isActive: boolean;
  linkedItems: LinkedItem[];
  createdAt?: string;
  updatedAt?: string;
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/master/machine");
      const data = await response.json();

      if (response.ok) {
        setMachines(data.machines);
      } else {
        setError(data.error || "Failed to fetch machines");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    // Prevent row click event
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this machine?")) {
      return;
    }

    try {
      const response = await fetch(`/api/master/machine/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setMachines(machines.filter((machine) => machine._id !== id));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete machine");
      }
    } catch {
      setError("Network error occurred");
    }
  };

  const handleEdit = (machine: Machine, e: React.MouseEvent) => {
    // Prevent row click event
    e.stopPropagation();
    setEditingMachine(machine);
    setIsModalOpen(true);
  };

  const handleRowClick = (machine: Machine) => {
    window.location.href = `/Master/machine/${machine._id}/bom`;
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMachine(null);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedMachine(null);
  };

  const handleMachineSave = () => {
    fetchMachines();
    handleCloseModal();
  };

  const handleImportSuccess = () => {
    fetchMachines();
    setIsImportModalOpen(false);
  };

  // Custom export function that matches the image format
  const handleExport = () => {
    try {
      // Create the export data in the specified format
      const exportData: Array<{
        "S.No": number;
        "Machine Name": string;
        "Machine Code": string;
        "Machine Type": string;
        "Machine Model": string;
        "Machine Brand": string;
        "Machine Description": string;
        "Machine Status": string;
        "Machine Price": number;
        "Machine Stock": number;
        "Min Stock": number;
        "Max Stock": number;
        "Linked Items": string;
      }> = [];
      let serialNumber = 1;

      machines.forEach((machine) => {
        if (machine.linkedItems.length === 0) {
          // Machine with no linked items
          exportData.push({
            "S.No": serialNumber++,
            "Machine Name": machine.machineName,
            "Machine Code": "",
            "Machine Type": "",
            "Machine Model": "",
            "Machine Brand": "",
            "Machine Description": machine.description,
            "Machine Status": machine.isActive ? "Active" : "Inactive",
            "Machine Price": 0,
            "Machine Stock": machine.stock,
            "Min Stock": machine.minStock,
            "Max Stock": machine.maxStock,
            "Linked Items": "NO ITEMS LINKED",
          });
        } else {
          // Machine with linked items
          machine.linkedItems.forEach((linkedItem, index) => {
            exportData.push({
              "S.No": index === 0 ? serialNumber++ : 0,
              "Machine Name": index === 0 ? machine.machineName : "",
              "Machine Code": "",
              "Machine Type": "",
              "Machine Model": "",
              "Machine Brand": "",
              "Machine Description": index === 0 ? machine.description : "",
              "Machine Status":
                index === 0 ? (machine.isActive ? "Active" : "Inactive") : "",
              "Machine Price": 0,
              "Machine Stock": index === 0 ? machine.stock : 0,
              "Min Stock": index === 0 ? machine.minStock : 0,
              "Max Stock": index === 0 ? machine.maxStock : 0,
              "Linked Items":
                linkedItem.itemDetails?.itemName || "Unknown Item",
            });
          });
        }
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 8 }, // S.No.
        { wch: 20 }, // MACHINE NAME
        { wch: 25 }, // ITEM NAME
        { wch: 15 }, // ITEM QUANTITY PER MACHINE
        { wch: 8 }, // UNIT
        { wch: 15 }, // Department
        { wch: 10 }, // Stock
        { wch: 12 }, // Min Stock
        { wch: 12 }, // Max Stock
        { wch: 30 }, // Description
        { wch: 10 }, // Status
      ];
      worksheet["!cols"] = columnWidths;

      // Apply styling to make it look like the image
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:K1");

      // Style header row
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellRef]) continue;

        // Add header styling (this is basic - XLSX doesn't support full styling like colors)
        worksheet[cellRef].s = {
          font: { bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          },
        };
      }

      // Add borders to all cells
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellRef]) {
            worksheet[cellRef] = { t: "s", v: "" };
          }

          if (!worksheet[cellRef].s) worksheet[cellRef].s = {};
          worksheet[cellRef].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        }
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Machine Items Report");

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `machines-items-report-${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      console.log(`Export successful: ${filename}`);
    } catch (error) {
      console.error("Export error:", error);
      setError(
        `Failed to export: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const getStockStatus = (current: number, min: number, max: number) => {
    // Treat 0/0 as Normal
    if (current === 0 && min === 0) return { color: "success", text: "Normal" };
    // Low stock only when strictly below min
    if (current < min) return { color: "error", text: "Low Stock" };
    if (current >= max) return { color: "warning", text: "Overstock" };
    return { color: "success", text: "Normal" };
  };

  const filteredMachines = machines.filter(
    (machine) =>
      machine.machineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      machine.respectiveDepartment
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    fetchMachines();
  }, []);

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pt-4 pb-3 sm:px-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Machine Management
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Manage machines, stock levels, and linked items • Click on a
              machine row to view details
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search machines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <svg
                className="absolute top-2.5 left-3 h-5 w-5 text-gray-400"
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

            {/* Import Excel Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:ring-2 focus:ring-purple-500"
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
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4"
                />
              </svg>
              Import Excel
            </button>

            {/* Export Excel Button */}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
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
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export Excel
            </button>

            {/* Add Machine Button */}
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
              Add Machine
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-400 bg-red-100 p-3 text-red-700">
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
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              Loading machines...
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredMachines.length} of {machines.length} machines
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Active: {machines.filter((m) => m.isActive).length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Low Stock:{" "}
                    {
                      machines.filter(
                        (m) =>
                          m.stock < m.minStock &&
                          !(m.stock === 0 && m.minStock === 0),
                      ).length
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Items:{" "}
                    {machines.reduce((sum, m) => sum + m.linkedItems.length, 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-y border-gray-100 dark:border-gray-800">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      S.No
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Machine Name
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Department
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Stock Status
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Linked Items
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Status
                    </TableCell>
                    <TableCell
                      isHeader
                      className="text-theme-xs py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredMachines.length === 0 ? (
                    <TableRow>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-gray-500 dark:text-gray-400"
                      >
                        {searchTerm ? (
                          <div className="space-y-2">
                            <div>No machines found matching your search</div>
                            <div className="text-xs">
                              Try adjusting your search term or clear filters
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>No machines available yet</div>
                            <div className="text-xs">
                              Add your first machine manually or import from
                              Excel
                            </div>
                            <div className="flex justify-center gap-2 pt-2">
                              <button
                                onClick={() => setIsModalOpen(true)}
                                className="text-xs text-blue-600 underline hover:text-blue-800"
                              >
                                Add Machine
                              </button>
                              <span className="text-gray-400">or</span>
                              <button
                                onClick={() => setIsImportModalOpen(true)}
                                className="text-xs text-purple-600 underline hover:text-purple-800"
                              >
                                Import Excel
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </TableRow>
                  ) : (
                    filteredMachines.map((machine, index) => {
                      const stockStatus = getStockStatus(
                        machine.stock,
                        machine.minStock,
                        machine.maxStock,
                      );
                      return (
                          <TableRow
                            key={machine._id}
                            className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30"
                          >
                            <TableCell className="text-theme-sm py-3 text-gray-500 dark:text-gray-400">
                              {index + 1}
                            </TableCell>
                            <TableCell className="py-3">
                              <div onClick={() => handleRowClick(machine)}>
                                <div className="text-theme-sm flex items-center gap-2 font-medium text-gray-800 dark:text-white/90">
                                  {machine.machineName}
                                  <svg
                                    className="h-3 w-3 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                  </svg>
                                </div>
                                {machine.description && (
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {machine.description.length > 50
                                      ? `${machine.description.substring(0, 50)}...`
                                      : machine.description}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge size="sm" color="info">
                                {machine.respectiveDepartment}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="space-y-1">
                                <Badge
                                  size="sm"
                                  color={
                                    stockStatus.color === "danger"
                                      ? "error"
                                      : (stockStatus.color as
                                          | "success"
                                          | "warning"
                                          | "error")
                                  }
                                >
                                  {stockStatus.text}
                                </Badge>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {machine.stock} / {machine.minStock}-
                                  {machine.maxStock}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="text-theme-sm">
                                {machine.linkedItems.length > 0 ? (
                                  <div>
                                    <span className="font-medium">
                                      {machine.linkedItems.length} items
                                    </span>
                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                      {machine.linkedItems
                                        .slice(0, 2)
                                        .map(
                                          (item) =>
                                            item.itemDetails?.itemName ||
                                            "Loading...",
                                        )
                                        .join(", ")}
                                      {machine.linkedItems.length > 2 &&
                                        ` +${machine.linkedItems.length - 2} more`}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400">
                                    No items linked
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge
                                size="sm"
                                color={machine.isActive ? "success" : "error"}
                              >
                                {machine.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/Master/machine/${machine._id}/bom`}
                                  className="rounded border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                  title="Open BOM"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  BOM
                                </Link>
                                <button
                                  onClick={(e) => handleEdit(machine, e)}
                                  className="rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-900/20"
                                  title="Edit machine"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDelete(machine._id, e)}
                                  className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-800 dark:hover:bg-red-900/20"
                                  title="Delete machine"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Modals */}
        <MachineModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleMachineSave}
          machine={editingMachine}
        />

        <MachineImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportSuccess}
        />

        <MachineDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          machine={selectedMachine}
        />
      </div>
    </div>
  );
}
