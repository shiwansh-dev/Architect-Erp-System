"use client";
import React, { useState, useEffect } from "react";
import { EyeIcon, EyeCloseIcon } from "@/icons";
import PermissionSelector from "./PermissionSelector";

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

interface UserFormProps {
  user?: User | null;
  onSubmit: (userData: Partial<User> & { password?: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function UserForm({ user, onSubmit, onClose, loading: externalLoading }: UserFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    deviceNo: [] as number[],
    role: "user",
    isActive: true,
    allowedPaths: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const isLoading = externalLoading !== undefined ? externalLoading : loading;
  const [success, setSuccess] = useState(false);

  const isEdit = !!user;

  useEffect(() => {
    if (user) {
      // Handle both single device number and array of device numbers
      let deviceNumbers: number[] = [];
      if (user.deviceNo) {
        if (Array.isArray(user.deviceNo)) {
          deviceNumbers = user.deviceNo;
        } else {
          deviceNumbers = [user.deviceNo];
        }
      }
      
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || "",
        email: user.email || "",
        password: "", // Don't pre-fill password for edit
        deviceNo: deviceNumbers,
        role: user.role || "user",
        isActive: user.isActive !== undefined ? user.isActive : true,
        allowedPaths: (user as unknown as Record<string, unknown>).allowedPaths as string[] || [],
      });
    } else {
      // Reset form for new user
      setFormData({
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        password: "",
        deviceNo: [],
        role: "user",
        isActive: true,
        allowedPaths: [],
      });
    }
    // Clear errors when switching between users
    setErrors({});
  }, [user]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Validate device numbers - only validate non-zero values
    if (formData.deviceNo.length > 0) {
      for (let i = 0; i < formData.deviceNo.length; i++) {
        const deviceNo = formData.deviceNo[i];
        if (deviceNo !== 0 && (!Number.isInteger(deviceNo) || deviceNo < 0)) {
          newErrors.deviceNo = "All device numbers must be positive integers";
          break;
        }
      }
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    // Last name is now optional
    if (formData.lastName.trim() && formData.lastName.trim().length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters if provided";
    }

    // Email is now optional but must be valid if provided
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!isEdit && !formData.password.trim()) {
      newErrors.password = "Password is required";
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started', { formData, isEdit });
    
    if (!validateForm()) {
      console.log('Form validation failed', { errors });
      return;
    }

    console.log('Form validation passed');

    if (externalLoading === undefined) {
    setLoading(true);
    }
    
    try {
      const submitData: Record<string, unknown> = { ...formData };
      // Handle device numbers - filter out zero values and only include if array has valid values
      const validDeviceNumbers = formData.deviceNo.filter(device => device > 0);
      if (validDeviceNumbers.length === 0) {
        delete submitData.deviceNo;
      } else {
        submitData.deviceNo = validDeviceNumbers;
      }
      
      // Don't include password if it's empty (for edit mode)
      if (isEdit && !submitData.password) {
        const { password, ...dataWithoutPassword } = submitData;
        void password; // Mark as intentionally unused
        await onSubmit(dataWithoutPassword);
        return;
      }

      console.log('Submitting data:', submitData);
      await onSubmit(submitData);
      console.log('Form submission successful');
      setSuccess(true);
      // Close form after a brief success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      if (externalLoading === undefined) {
      setLoading(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const addDeviceNumber = () => {
    setFormData(prev => ({
      ...prev,
      deviceNo: [...prev.deviceNo, 0]
    }));
  };

  const removeDeviceNumber = (index: number) => {
    setFormData(prev => ({
      ...prev,
      deviceNo: prev.deviceNo.filter((_, i) => i !== index)
    }));
  };

  const updateDeviceNumber = (index: number, value: string) => {
    const numValue = value === "" ? 0 : parseInt(value, 10);
    setFormData(prev => ({
      ...prev,
      deviceNo: prev.deviceNo.map((device, i) => i === index ? numValue : device)
    }));
  };

  return (
    <div className="w-full max-w-2xl">
        {success && (
          <div className="mb-4 rounded bg-green-100 px-4 py-3 text-green-700 dark:bg-green-900 dark:text-green-300">
            {isEdit ? "User updated successfully!" : "User created successfully!"}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                First Name *
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${
                  errors.firstName
                    ? "border-red-500 focus:ring-red-500"
                    : "border-stroke focus:ring-primary dark:border-strokedark"
                }`}
                placeholder="Enter first name"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${
                  errors.lastName
                    ? "border-red-500 focus:ring-red-500"
                    : "border-stroke focus:ring-primary dark:border-strokedark"
                }`}
                placeholder="Enter last name"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${
                errors.username
                  ? "border-red-500 focus:ring-red-500"
                  : "border-stroke focus:ring-primary dark:border-strokedark"
              }`}
              placeholder="Enter username"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-600">{errors.username}</p>
            )}
          </div>

          {/* Permissions */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Allowed Sections & Pages
            </label>
            <div className="rounded border border-stroke p-3 dark:border-strokedark">
              <PermissionSelector
                selected={formData.allowedPaths}
                onChange={(paths) => setFormData((p) => ({ ...p, allowedPaths: paths }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Device Numbers
            </label>
            <div className="space-y-2">
              {formData.deviceNo.map((device, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={device === 0 ? "" : String(device)}
                    onChange={(e) => updateDeviceNumber(index, e.target.value)}
                    className={`flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 ${
                      errors.deviceNo
                        ? "border-red-500 focus:ring-red-500"
                        : "border-stroke focus:ring-primary dark:border-strokedark"
                    }`}
                    placeholder="Enter device number"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => removeDeviceNumber(index)}
                    className="rounded bg-red-500 px-3 py-2 text-white hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDeviceNumber}
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                Add Device Number
              </button>
            </div>
            {errors.deviceNo && (
              <p className="mt-1 text-sm text-red-600">{errors.deviceNo}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 ${
                errors.email
                  ? "border-red-500 focus:ring-red-500"
                  : "border-stroke focus:ring-primary dark:border-strokedark"
              }`}
              placeholder="Enter email address"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password {isEdit ? "(leave blank to keep current)" : "*"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full rounded border px-3 py-2 pr-10 focus:outline-none focus:ring-2 ${
                  errors.password
                    ? "border-red-500 focus:ring-red-500"
                    : "border-stroke focus:ring-primary dark:border-strokedark"
                }`}
                placeholder={isEdit ? "Enter new password" : "Enter password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeCloseIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full rounded border border-stroke px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary dark:border-strokedark"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Active user
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-stroke px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-strokedark dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
    </div>
  );
}

