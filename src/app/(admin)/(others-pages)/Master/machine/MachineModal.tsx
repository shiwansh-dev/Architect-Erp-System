"use client";
import React, { useState, useEffect } from "react";

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
  _id?: string;
  machineName: string;
  respectiveDepartment: string;
  stock: number;
  minStock: number;
  maxStock: number;
  description: string;
  isActive: boolean;
  linkedItems: LinkedItem[];
}

interface Item {
  _id: string;
  itemName: string;
  unit: string;
  type: string;
}

interface MachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  machine: Machine | null;
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
  "General",
];

export default function MachineModal({
  isOpen,
  onClose,
  onSave,
  machine,
}: MachineModalProps) {
  const [formData, setFormData] = useState<Machine>({
    machineName: "",
    respectiveDepartment: "",
    stock: 0,
    minStock: 0,
    maxStock: 0,
    description: "",
    isActive: true,
    linkedItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Item selection states
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedItemQuantity, setSelectedItemQuantity] = useState(1);

  // Fetch items for linking
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const response = await fetch("/api/master/items");
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();

      if (machine) {
        setFormData({
          machineName: machine.machineName,
          respectiveDepartment: machine.respectiveDepartment,
          stock: machine.stock,
          minStock: machine.minStock,
          maxStock: machine.maxStock,
          description: machine.description,
          isActive: machine.isActive,
          linkedItems: machine.linkedItems || [],
        });
      } else {
        setFormData({
          machineName: "",
          respectiveDepartment: "",
          stock: 0,
          minStock: 0,
          maxStock: 0,
          description: "",
          isActive: true,
          linkedItems: [],
        });
      }
      setError("");
    }
  }, [isOpen, machine]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : ["stock", "minStock", "maxStock"].includes(name)
            ? parseInt(value) || 0
            : value,
    }));
  };

  // Add item to machine
  const handleAddItem = (item: Item) => {
    const existingItem = formData.linkedItems.find(
      (linked) => linked.itemId === item._id,
    );

    if (existingItem) {
      // Update quantity if item already exists
      setFormData((prev) => ({
        ...prev,
        linkedItems: prev.linkedItems.map((linked) =>
          linked.itemId === item._id
            ? { ...linked, quantity: linked.quantity + selectedItemQuantity }
            : linked,
        ),
      }));
    } else {
      // Add new item
      setFormData((prev) => ({
        ...prev,
        linkedItems: [
          ...prev.linkedItems,
          {
            itemId: item._id,
            quantity: selectedItemQuantity,
            itemDetails: item,
          },
        ],
      }));
    }

    setShowItemSelector(false);
    setItemSearchTerm("");
    setSelectedItemQuantity(1);
  };

  // Remove item from machine
  const handleRemoveItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      linkedItems: prev.linkedItems.filter((item) => item.itemId !== itemId),
    }));
  };

  // Update item quantity
  const handleUpdateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      linkedItems: prev.linkedItems.map((item) =>
        item.itemId === itemId ? { ...item, quantity } : item,
      ),
    }));
  };

  // Filter items for selection
  const filteredItems = items
    .filter(
      (item) =>
        item.itemName.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(itemSearchTerm.toLowerCase()),
    )
    .filter(
      (item) =>
        !formData.linkedItems.some((linked) => linked.itemId === item._id),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validation
    if (formData.minStock > formData.maxStock) {
      setError("Minimum stock cannot be greater than maximum stock");
      setLoading(false);
      return;
    }

    try {
      const url = machine
        ? `/api/master/machine/${machine._id}`
        : "/api/master/machine";
      const method = machine ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          linkedItems: formData.linkedItems.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSave();
      } else {
        setError(data.error || "Failed to save machine");
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
      <div className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {machine ? "Edit Machine" : "Add New Machine"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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

        {error && (
          <div className="mb-4 rounded-md border border-red-400 bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Machine Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Machine Name *
              </label>
              <input
                type="text"
                name="machineName"
                value={formData.machineName}
                onChange={handleInputChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="Enter machine name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Department *
              </label>
              <select
                name="respectiveDepartment"
                value={formData.respectiveDepartment}
                onChange={handleInputChange}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Stock *
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                min="0"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Min Stock *
              </label>
              <input
                type="number"
                name="minStock"
                value={formData.minStock}
                onChange={handleInputChange}
                min="0"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Stock *
              </label>
              <input
                type="number"
                name="maxStock"
                value={formData.maxStock}
                onChange={handleInputChange}
                min="0"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Enter machine description"
            />
          </div>

          {/* Linked Items Section */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                Linked Items ({formData.linkedItems.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowItemSelector(true)}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Add Item
              </button>
            </div>

            {/* Linked Items List */}
            {formData.linkedItems.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 dark:border-gray-600 dark:text-gray-400">
                No items linked to this machine
              </div>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {formData.linkedItems.map((linkedItem) => (
                  <div
                    key={linkedItem.itemId}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {linkedItem.itemDetails?.itemName || "Loading..."}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {linkedItem.itemDetails?.type} •{" "}
                        {linkedItem.itemDetails?.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={linkedItem.quantity}
                        onChange={(e) =>
                          handleUpdateItemQuantity(
                            linkedItem.itemId,
                            parseInt(e.target.value),
                          )
                        }
                        min="1"
                        className="w-16 rounded border px-2 py-1 text-center dark:border-gray-500 dark:bg-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(linkedItem.itemId)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : machine
                  ? "Update Machine"
                  : "Add Machine"}
            </button>
          </div>
        </form>

        {/* Item Selector Modal */}
        {showItemSelector && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
            <div className="mx-4 max-h-[70vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white p-6 dark:bg-gray-800">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  Add Item to Machine
                </h3>
                <button
                  onClick={() => setShowItemSelector(false)}
                  className="text-gray-500 hover:text-gray-700"
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

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search items..."
                  value={itemSearchTerm}
                  onChange={(e) => setItemSearchTerm(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">
                  Quantity:
                </label>
                <input
                  type="number"
                  value={selectedItemQuantity}
                  onChange={(e) =>
                    setSelectedItemQuantity(parseInt(e.target.value) || 1)
                  }
                  min="1"
                  className="w-24 rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
                />
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingItems ? (
                  <div className="py-4 text-center">Loading items...</div>
                ) : filteredItems.length === 0 ? (
                  <div className="py-4 text-center text-gray-500">
                    {itemSearchTerm
                      ? "No items found matching search"
                      : "No available items"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredItems.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => handleAddItem(item)}
                        className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div>
                          <div className="font-medium">{item.itemName}</div>
                          <div className="text-sm text-gray-500">
                            {item.type} • {item.unit}
                          </div>
                        </div>
                        <button className="text-blue-600 hover:text-blue-800">
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
