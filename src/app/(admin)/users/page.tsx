"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlusIcon } from "@/icons";
import UserTable from "@/components/user-management/UserTable";
import { useModal } from "@/hooks/useModal";

interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  username: string;
  email: string;
  deviceNo?: number | number[]; // optional numeric device number or array
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalUsers: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { isOpen: isDeleteModalOpen, openModal: openDeleteModal, closeModal: closeDeleteModal } = useModal();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Fetch users
  const fetchUsers = async (page = 1, search = "", sort = "createdAt", order = "desc") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
        sortBy: sort,
        sortOrder: order
      });

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Fetch users error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    fetchUsers(1, term, sortBy, sortOrder);
  };

  // Handle sort
  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    fetchUsers(pagination.currentPage, searchTerm, field, newOrder);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    fetchUsers(page, searchTerm, sortBy, sortOrder);
  };

  // Handle add user - redirect to create page
  const handleAddUser = () => {
    window.location.href = "/users/create";
  };

  // Handle edit user - redirect to edit page
  const handleEditUser = (user: User) => {
    window.location.href = `/users/${user._id}/edit`;
  };

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    openDeleteModal();
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/users/${userToDelete._id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setMessage("User deleted successfully");
        fetchUsers(pagination.currentPage, searchTerm, sortBy, sortOrder);
        closeDeleteModal();
        setUserToDelete(null);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete user");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Delete user error:", err);
    }
  };


  // Clear messages
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  // Handle ESC key for delete modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isDeleteModalOpen) {
        closeDeleteModal();
        setUserToDelete(null);
      }
    };

    if (isDeleteModalOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isDeleteModalOpen, closeDeleteModal]);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          User Management
        </h2>
        <nav>
          <ol className="flex items-center gap-2">
            <li>
              <Link className="font-medium" href="/">
                Dashboard /
              </Link>
            </li>
            <li className="font-medium text-primary">Users</li>
          </ol>
        </nav>
      </div>

      {/* Messages */}
      {message && (
        <div className="mb-4 rounded-sm bg-green-100 px-4 py-3 text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-sm bg-red-100 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded border border-stroke bg-transparent px-5 py-2.5 pl-10 pr-4 text-black focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                />
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                onClick={handleAddUser}
                className="flex items-center gap-2 rounded bg-gray-900 px-4.5 py-2 text-white hover:bg-gray-800 transition-all duration-200 hover:shadow-lg"
              >
                <PlusIcon />
                Add User
              </button>
            </div>
          </div>
        </div>

        <div className="p-6.5">
          <UserTable
            users={users}
            loading={loading}
            pagination={pagination}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onSort={handleSort}
            onPageChange={handlePageChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </div>
      </div>


      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && userToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDeleteModal();
              setUserToDelete(null);
            }
          }}
        >
          <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 mx-4 max-w-md w-full">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Confirm Delete
            </h3>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Are you sure you want to delete user{" "}
              <strong>{userToDelete.firstName} {userToDelete.lastName}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  closeDeleteModal();
                  setUserToDelete(null);
                }}
                className="rounded bg-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

