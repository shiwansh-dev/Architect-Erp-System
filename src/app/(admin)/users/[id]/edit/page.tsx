"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon } from "@/icons";
import UserForm from "@/components/user-management/UserForm";

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
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();

        if (response.ok) {
          setUser(data.user); // Extract user from the response object
        } else {
          setError(data.error || "Failed to fetch user");
        }
      } catch (err) {
        setError("Network error. Please try again.");
        console.error("Fetch user error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const handleFormSubmit = async (userData: Partial<User> & { password?: string }) => {
    setFormLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("User updated successfully");
        // Redirect to users list after a brief delay
        setTimeout(() => {
          router.push("/users");
        }, 1500);
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Form submission error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleClose = () => {
    router.push("/users");
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading user data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-title-md2 font-semibold text-black dark:text-white">
            Edit User
          </h2>
          <nav>
            <ol className="flex items-center gap-2">
              <li>
                <Link className="font-medium" href="/ecommerce">
                  Dashboard /
                </Link>
              </li>
              <li>
                <Link className="font-medium" href="/users">
                  Users /
                </Link>
              </li>
              <li className="font-medium text-primary">Edit User</li>
            </ol>
          </nav>
        </div>

        <div className="mb-4 rounded-sm bg-red-100 px-4 py-3 text-red-700">
          {error}
        </div>

        <div className="mb-6">
          <Link
            href="/users"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ChevronLeftIcon />
            Back to Users
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          Edit User
        </h2>
        <nav>
          <ol className="flex items-center gap-2">
            <li>
              <Link className="font-medium" href="/ecommerce">
                Dashboard /
              </Link>
            </li>
            <li>
              <Link className="font-medium" href="/users">
                Users /
              </Link>
            </li>
            <li className="font-medium text-primary">Edit User</li>
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

      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronLeftIcon />
          Back to Users
        </Link>
      </div>

      {/* User Form */}
      <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
          <h3 className="text-lg font-semibold text-black dark:text-white">
            User Information
          </h3>
        </div>
        <div className="p-6.5">
          {user && (
            <UserForm
              user={user}
              onSubmit={handleFormSubmit}
              onClose={handleClose}
              loading={formLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}
