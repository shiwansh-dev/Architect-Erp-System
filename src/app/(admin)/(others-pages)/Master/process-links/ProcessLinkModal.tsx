"use client";
import React, { useState, useEffect } from "react";

interface ProcessLink {
  _id: string;
  processName: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ProcessLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (processLink: Omit<ProcessLink, '_id' | 'createdAt' | 'updatedAt'>) => void;
  editingProcessLink: ProcessLink | null;
}


export default function ProcessLinkModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingProcessLink 
}: ProcessLinkModalProps) {
  const [formData, setFormData] = useState({
    processName: "",
    description: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens/closes or when editing changes
  useEffect(() => {
    if (isOpen) {
      if (editingProcessLink) {
        setFormData({
          processName: editingProcessLink.processName,
          description: editingProcessLink.description,
          isActive: editingProcessLink.isActive,
        });
      } else {
        setFormData({
          processName: "",
          description: "",
          isActive: true,
        });
      }
      setError("");
    }
  }, [isOpen, editingProcessLink]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.processName.trim()) {
      setError("Process name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSubmit(formData);
    } catch {
      setError("Failed to save process link");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {editingProcessLink ? "Edit Process" : "Add New Process"}
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

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Process Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Process Name *
            </label>
            <input
              type="text"
              name="processName"
              value={formData.processName}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g., VMC Machining, Laser Cutting, Painting"
            />
          </div>


          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Describe the process, its purpose, and any special requirements..."
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Active (Process is currently available for use)
            </label>
          </div>

          {/* Action Buttons */}
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
              {loading ? "Saving..." : editingProcessLink ? "Update Process" : "Create Process"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
