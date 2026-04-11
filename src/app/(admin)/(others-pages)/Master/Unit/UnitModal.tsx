"use client";
import React, { useState, useEffect } from "react";

interface Unit {
  _id?: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  description: string;
  conversionFactor?: number;
  baseUnit?: string;
  isActive: boolean;
}

interface UnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  unit: Unit | null;
}

export default function UnitModal({ isOpen, onClose, onSave, unit }: UnitModalProps) {
  const [formData, setFormData] = useState<Unit>({
    unitCode: "",
    unitName: "",
    unitType: "Basic",
    description: "",
    conversionFactor: 1,
    baseUnit: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (unit) {
        setFormData({
          unitCode: unit.unitCode,
          unitName: unit.unitName,
          unitType: unit.unitType,
          description: unit.description,
          conversionFactor: unit.conversionFactor || 1,
          baseUnit: unit.baseUnit || "",
          isActive: unit.isActive,
        });
      } else {
        setFormData({
          unitCode: "",
          unitName: "",
          unitType: "Basic",
          description: "",
          conversionFactor: 1,
          baseUnit: "",
          isActive: true,
        });
      }
      setError("");
    }
  }, [isOpen, unit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : 
               name === "conversionFactor" ? parseFloat(value) || 1 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = unit ? `/api/master/unit/${unit._id}` : "/api/master/unit";
      const method = unit ? "PUT" : "POST";

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
        setError(data.error || "Failed to save unit");
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
            {unit ? "Edit Unit" : "Add New Unit"}
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
              Unit Code *
            </label>
            <input
              type="text"
              name="unitCode"
              value={formData.unitCode}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., KG, PCS, LTR"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit Name *
            </label>
            <input
              type="text"
              name="unitName"
              value={formData.unitName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., Kilogram, Pieces, Liter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Unit Type *
            </label>
            <select
              name="unitType"
              value={formData.unitType}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="Basic">Basic Unit</option>
              <option value="Weight">Weight</option>
              <option value="Volume">Volume</option>
              <option value="Length">Length</option>
              <option value="Area">Area</option>
              <option value="Count">Count</option>
              <option value="Time">Time</option>
              <option value="Other">Other</option>
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
              placeholder="Enter description for this unit"
            />
          </div>

          {formData.unitType !== "Basic" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conversion Factor
                </label>
                <input
                  type="number"
                  name="conversionFactor"
                  value={formData.conversionFactor}
                  onChange={handleInputChange}
                  step="0.0001"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Base Unit
                </label>
                <input
                  type="text"
                  name="baseUnit"
                  value={formData.baseUnit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g., GM, ML, CM"
                />
              </div>
            </>
          )}

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
              {loading ? "Saving..." : unit ? "Update Unit" : "Add Unit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
