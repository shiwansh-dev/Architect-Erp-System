"use client";
import React, { useState, useEffect } from "react";

interface ItemType {
  _id?: string;
  typeName: string;
  concernedDepartment: string;
  category: string;
  description: string;
  requiresApproval: boolean;
  isActive: boolean;
}

interface ItemTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  itemType: ItemType | null;
}

const DEPARTMENTS = [
  "Production",
  "Quality Control", 
  "Maintenance",
  "Purchasing",
  "Sales",
  "Inventory",
  "Engineering",
  "Finance",
  "HR",
  "General"
];

const CATEGORIES = [
  "Raw Material",
  "Finished Goods",
  "Semi-Finished",
  "Spare Parts",
  "Consumables",
  "Tools & Equipment",
  "Packaging Material",
  "Office Supplies",
  "Safety Equipment"
];

export default function ItemTypeModal({ isOpen, onClose, onSave, itemType }: ItemTypeModalProps) {
  const [formData, setFormData] = useState<ItemType>({
    typeName: "",
    concernedDepartment: "",
    category: "",
    description: "",
    requiresApproval: false,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (itemType) {
        setFormData({
          typeName: itemType.typeName,
          concernedDepartment: itemType.concernedDepartment,
          category: itemType.category,
          description: itemType.description,
          requiresApproval: itemType.requiresApproval,
          isActive: itemType.isActive,
        });
      } else {
        setFormData({
          typeName: "",
          concernedDepartment: "",
          category: "",
          description: "",
          requiresApproval: false,
          isActive: true,
        });
      }
      setError("");
    }
  }, [isOpen, itemType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = itemType ? `/api/master/itemtype/${itemType._id}` : "/api/master/itemtype";
      const method = itemType ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSave();
      } else {
        setError(data.error || "Failed to save item type");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {itemType ? "Edit Item Type" : "Add New Item Type"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type Name *
            </label>
            <input
              type="text"
              name="typeName"
              value={formData.typeName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., Electronics, Machinery, Chemicals"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Concerned Department *
            </label>
            <select
              name="concernedDepartment"
              value={formData.concernedDepartment}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select Category</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter description for this item type"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="requiresApproval"
              checked={formData.requiresApproval}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Requires Approval for Changes
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : itemType ? "Update Item Type" : "Add Item Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
