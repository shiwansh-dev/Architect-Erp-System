"use client";
import React, { useState } from "react";
import { PencilIcon, TrashBinIcon as TrashIcon, ChevronLeftIcon, CopyIcon } from "@/icons";

// Permission paths mapping (from PermissionSelector)
const PERMISSION_PATHS: { [key: string]: string } = {
  '/ecommerce': 'Ecommerce',
  '/calendar': 'Calendar',
  '/profile': 'Profile',
  '/users': 'Users',
  '/Master/Items': 'Items',
  '/Master/Unit': 'Unit',
  '/Master/itemtype': 'Item Type',
  '/Master/machine': 'Machine',
  '/Master/process-links': 'Process',
  '/Master/customers': 'Customer',
  '/Templates/fms-template': 'FMS Template',
  '/Templates/fms-template/table': 'FMS Template Table',
  '/Templates/fms-template/flow': 'FMS Template Flow',
};

interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  deviceNo?: number | number[];
  role: string;
  isActive: boolean;
  allowedPaths?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface UserTableProps {
  users: User[];
  loading: boolean;
  pagination: Pagination;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  sortBy: string;
  sortOrder: string;
}

export default function UserTable({
  users,
  loading,
  pagination,
  onEdit,
  onDelete,
  onSort,
  onPageChange,
  sortBy,
  sortOrder
}: UserTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set());

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const getPermissionLabel = (path: string): string => {
    return PERMISSION_PATHS[path] || path;
  };

  const formatPermissions = (user: User): string[] => {
    if (user.role === 'admin') {
      return ['All Permissions'];
    }
    if (!user.allowedPaths || user.allowedPaths.length === 0) {
      return ['No Permissions'];
    }
    return user.allowedPaths.map(path => getPermissionLabel(path));
  };

  const togglePermissionsExpanded = (userId: string) => {
    const next = new Set(expandedPermissions);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setExpandedPermissions(next);
  };

  const handleCopyLoginUrl = async (userId: string) => {
    try {
      setCopyingId(userId);
      // Fetch password from API
      const response = await fetch(`/api/users/${userId}/password`);
      if (!response.ok) {
        throw new Error("Failed to fetch password");
      }
      const data = await response.json();
      
      // Get the base URL (use window.location for current host)
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const loginUrl = `${baseUrl}/signin?username=${encodeURIComponent(data.username)}&password=${encodeURIComponent(data.password)}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(loginUrl);
      
      // Show success feedback (you could use a toast library here)
      alert("Login URL copied to clipboard!");
    } catch (error) {
      console.error("Error copying login URL:", error);
      alert("Failed to copy login URL. Please try again.");
    } finally {
      setCopyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-stroke dark:border-strokedark">
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("firstName")}
            >
              Name {getSortIcon("firstName")}
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("username")}
            >
              Username {getSortIcon("username")}
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("email")}
            >
              Email {getSortIcon("email")}
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("deviceNo")}
            >
              Device No {getSortIcon("deviceNo")}
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("role")}
            >
              Role {getSortIcon("role")}
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("isActive")}
            >
              Status {getSortIcon("isActive")}
            </th>
            <th className="px-4 py-4 text-left font-medium text-black dark:text-white">
              Permissions
            </th>
            <th
              className="cursor-pointer px-4 py-4 text-left font-medium text-black dark:text-white"
              onClick={() => onSort("createdAt")}
            >
              Created {getSortIcon("createdAt")}
            </th>
            <th className="px-4 py-4 text-center font-medium text-black dark:text-white">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user._id}
              className="border-b border-stroke hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800"
            >
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {(user.firstName?.charAt(0) || user.username?.charAt(0) || user.email?.charAt(0) || "")}
                      {(user.lastName?.charAt(0) || "")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-black dark:text-white">
                      {([user.firstName, user.lastName].filter(Boolean).join(" ")) || user.username || user.email}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {user.username}
                </p>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {user.email}
                </p>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {user.deviceNo ? (
                    Array.isArray(user.deviceNo) 
                      ? user.deviceNo.join(', ') 
                      : user.deviceNo.toString()
                  ) : '-'}
                </p>
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    user.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="max-w-xs">
                  {(() => {
                    const permissions = formatPermissions(user);
                    const isExpanded = expandedPermissions.has(user._id);
                    const displayCount = 2;
                    const hasMore = permissions.length > displayCount;
                    const displayPermissions = isExpanded ? permissions : permissions.slice(0, displayCount);
                    
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-1">
                          {displayPermissions.map((perm, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                user.role === 'admin'
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                              }`}
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                        {hasMore && (
                          <button
                            onClick={() => togglePermissionsExpanded(user._id)}
                            className="text-xs text-primary hover:underline self-start mt-1"
                          >
                            {isExpanded ? 'Show less' : `+${permissions.length - displayCount} more`}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {formatDate(user.createdAt)}
                </p>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleCopyLoginUrl(user._id)}
                    disabled={copyingId === user._id}
                    className="rounded bg-blue-100 p-2 text-blue-600 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Copy login URL"
                  >
                    <CopyIcon />
                  </button>
                  <button
                    onClick={() => onEdit(user)}
                    className="rounded bg-primary/10 p-2 text-primary hover:bg-primary/20"
                    title="Edit user"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => onDelete(user)}
                    className="rounded bg-red-100 p-2 text-red-600 hover:bg-red-200"
                    title="Delete user"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Showing {((pagination.currentPage - 1) * 10) + 1} to{" "}
            {Math.min(pagination.currentPage * 10, pagination.totalUsers)} of{" "}
            {pagination.totalUsers} results
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={!pagination.hasPrevPage}
              className="flex items-center gap-1 rounded border border-stroke px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-strokedark dark:hover:bg-gray-800"
            >
              <ChevronLeftIcon />
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                const isActive = page === pagination.currentPage;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`px-3 py-2 text-sm rounded ${
                      isActive
                        ? "bg-primary text-white"
                        : "border border-stroke hover:bg-gray-50 dark:border-strokedark dark:hover:bg-gray-800"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={!pagination.hasNextPage}
              className="flex items-center gap-1 rounded border border-stroke px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-strokedark dark:hover:bg-gray-800"
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
