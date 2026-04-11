"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleFormSubmit = async (userData: Partial<User> & { password?: string }) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("User created successfully");
        // Redirect to users list after a brief delay
        setTimeout(() => {
          router.push("/users");
        }, 1500);
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (err) {
      setError("Network error. Please try again.");
      console.error("Form submission error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.push("/users");
  };

  // Clear messages after 5 seconds
  React.useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-title-md2 font-semibold text-black dark:text-white">
          Create New User
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
            <li className="font-medium text-primary">Create User</li>
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
          <UserForm
            user={null}
            onSubmit={handleFormSubmit}
            onClose={handleClose}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
