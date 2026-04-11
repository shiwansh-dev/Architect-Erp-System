"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Unit {
  _id: string;
  unitCode: string;
  unitName: string;
  unitType: string;
  isActive: boolean;
}

interface ItemType {
  _id: string;
  typeName: string;
  concernedDepartment: string;
  category: string;
  isActive: boolean;
}

interface Item {
  _id: string;
  itemName: string;
  unit: string;
  type: string;
  machines?: string;
  stock: number;
  photo: string;
}

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

interface FormData {
  itemName: string;
  unit: string;
  type: string;
  stock: number;
  photo: string;
  linkedItems: LinkedItem[];
}

export default function CreateItemPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    itemName: "",
    unit: "",
    type: "",
    stock: 0,
    photo: "",
    linkedItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Data from collections
  const [units, setUnits] = useState<Unit[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  
  // Search states
  const [unitSearchTerm, setUnitSearchTerm] = useState("");
  const [typeSearchTerm, setTypeSearchTerm] = useState("");
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Sub-items functionality
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [selectedItemQuantity, setSelectedItemQuantity] = useState(1);

  // Item name suggestions
  const [showItemNameSuggestions, setShowItemNameSuggestions] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  // Fetch units and item types
  const fetchMasterData = async () => {
    setLoadingData(true);
    try {
      const [unitsResponse, itemTypesResponse] = await Promise.all([
        fetch("/api/master/unit"),
        fetch("/api/master/itemtype")
      ]);

      if (unitsResponse.ok) {
        const unitsData = await unitsResponse.json();
        setUnits(unitsData.units || []);
      }

      if (itemTypesResponse.ok) {
        const itemTypesData = await itemTypesResponse.json();
        setItemTypes(itemTypesData.itemTypes || []);
      }
    } catch {
      console.error("Error fetching master data");
      setError("Failed to load master data");
    } finally {
      setLoadingData(false);
    }
  };

  // Fetch all items for sub-items selection
  const fetchAllItems = async () => {
    setLoadingItems(true);
    try {
      const response = await fetch("/api/master/items");
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched items for suggestions:", data.items?.length || 0);
        setAllItems(data.items || []);
      } else {
        console.error("Failed to fetch items:", response.status);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
    fetchAllItems();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "stock" ? parseInt(value) || 0 : value
    }));

    // Handle item name suggestions and duplicate detection
    if (name === "itemName") {
      console.log("Item name changed:", { value, allItemsCount: allItems.length });
      if (value.trim().length > 0 && allItems.length > 0) {
        setShowItemNameSuggestions(true);
        checkForDuplicates(value);
      } else {
        setShowItemNameSuggestions(false);
        setDuplicateWarning("");
      }
    }
  };

  // Check for duplicate items
  const checkForDuplicates = (itemName: string) => {
    const trimmedName = itemName.trim().toLowerCase();
    const exactMatch = allItems.find(item => 
      item.itemName.toLowerCase() === trimmedName
    );
    
    if (exactMatch) {
      setDuplicateWarning(`⚠️ An item with the exact name "${exactMatch.itemName}" already exists.`);
    } else {
      setDuplicateWarning("");
    }
  };

  // Filter existing items for suggestions
  const getItemNameSuggestions = () => {
    if (!formData.itemName.trim() || allItems.length === 0) return [];
    
    const searchTerm = formData.itemName.toLowerCase();
    // Show all items that contain the search term, excluding exact matches
    const suggestions = allItems.filter(item => 
      item.itemName && item.itemName.toLowerCase().includes(searchTerm) &&
      item.itemName.toLowerCase() !== searchTerm
    ).slice(0, 5);
    
    console.log("Item name suggestions:", {
      searchTerm,
      allItemsCount: allItems.length,
      suggestionsCount: suggestions.length,
      allItems: allItems.map(i => i.itemName),
      suggestions: suggestions.map(s => s.itemName)
    });
    
    return suggestions;
  };

  // Handle selecting a suggested item as template
  const handleSelectSuggestedItem = (item: Item) => {
    setFormData(prev => ({
      ...prev,
      itemName: item.itemName + " (Copy)", // Add (Copy) to avoid exact duplicate
      unit: item.unit,
      type: item.type,
      stock: 0, // Reset stock to 0 for new item
      photo: item.photo
    }));
    setShowItemNameSuggestions(false);
    setDuplicateWarning("");
  };

  // Handle unit selection
  const handleUnitSelect = (unit: Unit) => {
    setFormData(prev => ({ ...prev, unit: unit.unitCode }));
    setUnitSearchTerm(`${unit.unitCode} - ${unit.unitName}`);
    setShowUnitDropdown(false);
  };

  // Handle type selection
  const handleTypeSelect = (itemType: ItemType) => {
    setFormData(prev => ({ ...prev, type: itemType.typeName }));
    setTypeSearchTerm(itemType.typeName);
    setShowTypeDropdown(false);
  };

  // Filter units based on search
  const filteredUnits = units.filter(unit => {
    if (!unitSearchTerm.trim()) return true; // Show all units when search is empty
    return (
      unit.unitCode?.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
      unit.unitName?.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
      unit.unitType?.toLowerCase().includes(unitSearchTerm.toLowerCase())
    );
  });

  // Filter item types based on search
  const filteredItemTypes = itemTypes.filter(itemType => {
    if (!typeSearchTerm.trim()) return true; // Show all types when search is empty
    return (
      itemType.typeName?.toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
      itemType.category?.toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
      itemType.concernedDepartment?.toLowerCase().includes(typeSearchTerm.toLowerCase())
    );
  });


  // Sub-items management functions
  const handleAddItem = (item: Item) => {
    const existingItem = formData.linkedItems.find(linked => linked.itemId === item._id);
    
    if (existingItem) {
      // Update quantity if item already exists
      setFormData(prev => ({
        ...prev,
        linkedItems: prev.linkedItems.map(linked => 
          linked.itemId === item._id 
            ? { ...linked, quantity: linked.quantity + selectedItemQuantity }
            : linked
        )
      }));
    } else {
      // Add new item
      setFormData(prev => ({
        ...prev,
        linkedItems: [
          ...prev.linkedItems,
          {
            itemId: item._id,
            quantity: selectedItemQuantity,
            itemDetails: item
          }
        ]
      }));
    }
    
    setShowItemSelector(false);
    setItemSearchTerm("");
    setSelectedItemQuantity(1);
  };

  // Remove item from sub-items
  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      linkedItems: prev.linkedItems.filter(item => item.itemId !== itemId)
    }));
  };

  // Update item quantity
  const handleUpdateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      linkedItems: prev.linkedItems.map(item => 
        item.itemId === itemId ? { ...item, quantity } : item
      )
    }));
  };

  // Filter items for selection (exclude already linked items)
  const filteredItems = allItems.filter(item =>
    (item.itemName.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
     item.type.toLowerCase().includes(itemSearchTerm.toLowerCase())) &&
    !formData.linkedItems.some(linked => linked.itemId === item._id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicates before submitting
    if (duplicateWarning) {
      setError("Cannot create item: A duplicate item name was detected. Please choose a different name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/master/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          machines: "Not Specified", // Default value for machines
          linkedItems: formData.linkedItems.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity
          }))
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/Master/Items");
      } else {
        setError(data.error || "Failed to create item");
      }
    } catch {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
              Create New Item
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Add a new item to your inventory
            </p>
          </div>
          <Link
            href="/Master/Items"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:ring-2 focus:ring-gray-500"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Items
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
            <button
              onClick={() => setError("")}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Loading Message */}
        {loadingData && (
          <div className="mb-6 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md">
            Loading units and item types...
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Name */}
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Item Name *
              </label>
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                onChange={handleInputChange}
                onFocus={() => {
                  if (formData.itemName.trim().length > 0) {
                    setShowItemNameSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicking on them
                  setTimeout(() => setShowItemNameSuggestions(false), 300);
                }}
                required
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
                  duplicateWarning 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Enter item name"
              />
              
              {/* Debug Info */}
              <div className="mt-1 text-xs text-gray-500">
                Debug: showSuggestions={showItemNameSuggestions.toString()}, items={allItems.length}, suggestions={getItemNameSuggestions().length}, loading={loadingItems.toString()}
              </div>

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{duplicateWarning}</p>
                </div>
              )}

              {/* Item Name Suggestions */}
              {(() => {
                const suggestions = getItemNameSuggestions();
                return showItemNameSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                      Click to use as template: ({suggestions.length} suggestions)
                    </div>
                    {suggestions.map((item) => (
                      <div
                        key={item._id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          handleSelectSuggestedItem(item);
                        }}
                        className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="font-medium text-gray-800 dark:text-white">
                          {item.itemName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.type} • {item.unit} • Stock: {item.stock}
                        </div>
                      </div>
                    ))
                  }
                  </div>
                );
              })()}
            </div>

            {/* Unit Searchable Dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unit *
              </label>
              <input
                type="text"
                value={unitSearchTerm}
                onChange={(e) => {
                  setUnitSearchTerm(e.target.value);
                  setShowUnitDropdown(true);
                }}
                onFocus={() => setShowUnitDropdown(true)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search and select unit"
              />
              
              {showUnitDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredUnits.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400">No units found</div>
                  ) : (
                    filteredUnits.map((unit) => (
                      <div
                        key={unit._id}
                        onClick={() => handleUnitSelect(unit)}
                        className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="font-medium">{unit.unitCode} - {unit.unitName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{unit.unitType}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Item Type Searchable Dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Item Type *
              </label>
              <input
                type="text"
                value={typeSearchTerm}
                onChange={(e) => {
                  setTypeSearchTerm(e.target.value);
                  setShowTypeDropdown(true);
                }}
                onFocus={() => setShowTypeDropdown(true)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search and select item type"
              />
              
              {showTypeDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredItemTypes.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400">No item types found</div>
                  ) : (
                    filteredItemTypes.map((itemType) => (
                      <div
                        key={itemType._id}
                        onClick={() => handleTypeSelect(itemType)}
                        className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="font-medium">{itemType.typeName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {itemType.category} - {itemType.concernedDepartment}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>


            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock *
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleInputChange}
                min="0"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter stock quantity"
              />
            </div>

            {/* Photo URL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Photo URL
              </label>
              <input
                type="url"
                name="photo"
                value={formData.photo}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter image URL (optional)"
              />
            </div>
          </div>

          {/* Sub Items Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                Sub Items ({formData.linkedItems.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowItemSelector(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Sub Item
              </button>
            </div>

            {/* Sub Items List */}
            {formData.linkedItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                No sub items added to this item
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                {formData.linkedItems.map((linkedItem) => (
                  <div key={linkedItem.itemId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-white">
                        {linkedItem.itemDetails?.itemName || 'Loading...'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {linkedItem.itemDetails?.type} • {linkedItem.itemDetails?.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-gray-300">Qty:</label>
                        <input
                          type="number"
                          value={linkedItem.quantity}
                          onChange={(e) => handleUpdateItemQuantity(linkedItem.itemId, parseInt(e.target.value))}
                          min="1"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(linkedItem.itemId)}
                        className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-8">
            <Link
              href="/Master/Items"
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 text-center font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || loadingData}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? "Creating..." : "Create Item"}
            </button>
          </div>
        </form>
      </div>

      {/* Item Selector Modal */}
      {showItemSelector && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                Add Sub Item
              </h3>
              <button
                onClick={() => setShowItemSelector(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search items..."
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantity:
              </label>
              <input
                type="number"
                value={selectedItemQuantity}
                onChange={(e) => setSelectedItemQuantity(parseInt(e.target.value) || 1)}
                min="1"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="overflow-y-auto max-h-80">
              {loadingItems ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Loading items...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {itemSearchTerm ? "No items found matching search" : "No available items"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => handleAddItem(item)}
                      className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 dark:text-white">
                          {item.itemName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {item.type} • {item.unit}
                        </div>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
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

      {/* Click outside to close dropdowns */}
      {(showUnitDropdown || showTypeDropdown || showItemNameSuggestions) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowUnitDropdown(false);
            setShowTypeDropdown(false);
            setShowItemNameSuggestions(false);
          }}
        />
      )}
    </div>
  );
}
