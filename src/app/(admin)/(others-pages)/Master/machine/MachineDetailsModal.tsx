"use client";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";

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

interface MachineDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
}

export default function MachineDetailsModal({
  isOpen,
  onClose,
  machine,
}: MachineDetailsModalProps) {
  if (!isOpen || !machine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              {machine.machineName} - Details
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {machine.respectiveDepartment} Department
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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

        {/* Machine Info Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Current Stock
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{machine.stock}</p>
            <p className="mt-1 text-xs text-blue-500 dark:text-blue-400">
              Available machines
            </p>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <div className="mb-2 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-600"
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
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Min Stock
              </span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {machine.minStock}
            </p>
            <p className="mt-1 text-xs text-green-500 dark:text-green-400">
              Minimum required
            </p>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/20">
            <div className="mb-2 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Max Stock
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {machine.maxStock}
            </p>
            <p className="mt-1 text-xs text-orange-500 dark:text-orange-400">
              Maximum capacity
            </p>
          </div>

          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
            <div className="mb-2 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                Linked Items
              </span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {machine.linkedItems.length}
            </p>
            <p className="mt-1 text-xs text-purple-500 dark:text-purple-400">
              Components required
            </p>
          </div>
        </div>

        {/* Machine Description */}
        {machine.description && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/30">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Description
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {machine.description}
            </p>
          </div>
        )}

        {/* Linked Items Table */}
        <div className="mb-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-medium text-gray-800 dark:text-white">
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
                  d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2m-2 0v2a2 2 0 002 2h2m-2 0h2m-2 0V9a2 2 0 012-2h2V7a2 2 0 00-2-2H9z"
                />
              </svg>
              Linked Items ({machine.linkedItems.length})
            </h3>
            <div className="flex items-center gap-2">
              <Badge size="sm" color={machine.isActive ? "success" : "error"}>
                {machine.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {machine.linkedItems.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-600 dark:bg-gray-700/30">
              <svg
                className="mx-auto mb-4 h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">
                No items linked to this machine
              </p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                Add items by editing the machine configuration
              </p>
            </div>
          ) : (
            <div className="max-w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-gray-800">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      #
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      Item Name
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      Qty per Machine
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      Unit
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      Item Type
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-4 py-3 text-start text-sm font-medium text-gray-500 dark:text-gray-400"
                    >
                      Total Required
                    </TableCell>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {machine.linkedItems.map((linkedItem, index) => (
                    <TableRow
                      key={linkedItem.itemId || index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {linkedItem.itemDetails?.itemName || "Unknown Item"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            ID: {linkedItem.itemId}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {linkedItem.quantity}
                          </span>
                          <span className="text-xs text-gray-500">
                            per machine
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge size="sm" color="info">
                          {linkedItem.itemDetails?.unit || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {linkedItem.itemDetails?.type || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              {linkedItem.quantity * machine.stock}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {linkedItem.itemDetails?.unit || "units"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            ({linkedItem.quantity} × {machine.stock} machines)
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Summary Section */}
        {machine.linkedItems.length > 0 && (
          <div className="mt-6 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4 dark:border-blue-800 dark:from-blue-900/20 dark:to-purple-900/20">
            <h4 className="mb-3 flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Production Summary for {machine.stock}{" "}
              {machine.stock === 1 ? "machine" : "machines"}
            </h4>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
              <div className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-gray-800">
                <span className="text-gray-600 dark:text-gray-300">
                  Unique Items Required:
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {machine.linkedItems.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-gray-800">
                <span className="text-gray-600 dark:text-gray-300">
                  Total Item Quantity:
                </span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {machine.linkedItems.reduce(
                    (sum, item) => sum + item.quantity * machine.stock,
                    0,
                  )}{" "}
                  units
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-gray-800">
                <span className="text-gray-600 dark:text-gray-300">
                  Average per Machine:
                </span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  {machine.linkedItems.length > 0
                    ? Math.round(
                        (machine.linkedItems.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        ) /
                          machine.linkedItems.length) *
                          10,
                      ) / 10
                    : 0}{" "}
                  items
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
