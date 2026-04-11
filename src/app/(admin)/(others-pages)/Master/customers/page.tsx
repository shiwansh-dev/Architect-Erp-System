"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from 'xlsx';
import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CustomerImportModal from "./CustomerImportModal";

type Customer = {
  _id: string;
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
  createdAt?: string;
};

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/master/customers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch customers");
      setCustomers(json.customers || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) {
      return;
    }

    try {
      const res = await fetch(`/api/master/customers/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete customer");
      setCustomers(customers.filter(c => c._id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete customer");
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleExport = () => {
    try {
      const exportData = customers.map((customer, index) => ({
        'S.No.': index + 1,
        'Customer Name': customer.name,
        'Email': customer.email || '',
        'Phone': customer.phone || '',
        'GSTIN': customer.gstin || '',
        'Address Line 1': customer.billingAddress?.line1 || '',
        'Address Line 2': customer.billingAddress?.line2 || '',
        'City': customer.billingAddress?.city || '',
        'State': customer.billingAddress?.state || '',
        'ZIP': customer.billingAddress?.zip || '',
        'Country': customer.billingAddress?.country || '',
        'Payment Terms': customer.paymentTerms || '',
        'Credit Limit': customer.creditLimit || 0,
        'Status': customer.isActive ? 'Active' : 'Inactive'
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnWidths = [
        { wch: 8 },   // S.No.
        { wch: 20 },  // Customer Name
        { wch: 25 },  // Email
        { wch: 15 },  // Phone
        { wch: 20 },  // GSTIN
        { wch: 25 },  // Address Line 1
        { wch: 25 },  // Address Line 2
        { wch: 15 },  // City
        { wch: 15 },  // State
        { wch: 10 },  // ZIP
        { wch: 15 },  // Country
        { wch: 20 },  // Payment Terms
        { wch: 15 },  // Credit Limit
        { wch: 10 }   // Status
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-export-${timestamp}.xlsx`;

      XLSX.writeFile(workbook, filename);
    } catch (error: unknown) {
      setError(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportSuccess = () => {
    fetchCustomers();
    setIsImportModalOpen(false);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Customer Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage customer information and billing details
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search customers..."
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
            
            {/* Import Excel Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:ring-2 focus:ring-purple-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 12l2 2 4-4" />
              </svg>
              Import Excel
            </button>

            {/* Export Excel Button */}
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
            
            <Link
              href="/Master/customer"
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
              Add Customer
            </Link>
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
            <div className="text-gray-500 dark:text-gray-400">Loading customers...</div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredCustomers.length} of {customers.length} customers
              </div>
              
              {/* Quick stats */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Active: {customers.filter(c => c.isActive).length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Total: {customers.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
                  <TableRow>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      S.No
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Customer Name
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Contact Info
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Billing Address
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Payment Terms
                    </TableCell>
                    <TableCell isHeader className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Credit Limit
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
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <td colSpan={8} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? (
                          <div className="space-y-2">
                            <div>No customers found matching your search</div>
                            <div className="text-xs">Try adjusting your search term or clear filters</div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>No customers available yet</div>
                            <div className="text-xs">Add your first customer to get started</div>
                            <div className="flex justify-center pt-2">
                              <Link
                                href="/Master/customer"
                                className="text-blue-600 hover:text-blue-800 text-xs underline"
                              >
                                Add Customer
                              </Link>
                            </div>
                          </div>
                        )}
                      </td>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer, index) => (
                      <TableRow key={customer._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-3">
                          <div>
                            <div className="font-medium text-gray-800 text-theme-sm dark:text-white/90">
                              {customer.name}
                            </div>
                            {customer.gstin && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                GSTIN: {customer.gstin}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-theme-sm">
                            <div>{customer.email || "-"}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {customer.phone || "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-theme-sm">
                            <div>{customer.billingAddress?.line1 || "-"}</div>
                            {customer.billingAddress?.line2 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {customer.billingAddress.line2}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {customer.billingAddress?.city || ""} {customer.billingAddress?.state ? ", " + customer.billingAddress.state : ""} {customer.billingAddress?.zip || ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-theme-sm text-gray-600 dark:text-gray-400">
                            {customer.paymentTerms || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-theme-sm text-gray-600 dark:text-gray-400">
                            ₹{customer.creditLimit?.toLocaleString() || "0"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge size="sm" color={customer.isActive ? "success" : "error"}>
                            {customer.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/Master/customer?id=${customer._id}`}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded dark:hover:bg-blue-900/20"
                              title="Edit customer"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleDelete(customer._id)}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                              title="Delete customer"
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
        <CustomerImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportSuccess}
        />
      </div>
    </div>
  );
}
