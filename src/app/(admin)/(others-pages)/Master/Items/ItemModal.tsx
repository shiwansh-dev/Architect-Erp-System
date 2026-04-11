"use client";
import React, { useState, useEffect } from "react";

interface Item {
  _id?: string;
  itemName: string;
  unit: string;
  type: string;
  machines: string;
  stock: number;
  photo: string;
}

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

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  item: Item | null;
}

export default function ItemModal({ isOpen, onClose, onSave, item }: ItemModalProps) {
  const [formData, setFormData] = useState<Item>({
    itemName: "",
    unit: "",
    type: "",
    machines: "",
    stock: 0,
    photo: "",
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
        setUnits(unitsData.units.filter((unit: Unit) => unit.isActive));
      }

      if (itemTypesResponse.ok) {
        const itemTypesData = await itemTypesResponse.json();
        setItemTypes(itemTypesData.itemTypes.filter((itemType: ItemType) => itemType.isActive));
      }
    } catch {
      console.error("Error fetching master data");
    } finally {
      setLoadingData(false);
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      fetchMasterData();
      
      if (item) {
        setFormData({
          itemName: item.itemName,
          unit: item.unit,
          type: item.type,
          machines: item.machines,
          stock: item.stock,
          photo: item.photo,
        });
        
        // Set search terms to current values for display
        const selectedUnit = units.find(u => u.unitCode === item.unit || u.unitName === item.unit);
        const selectedType = itemTypes.find(t => t.typeName === item.type);
        
        setUnitSearchTerm(selectedUnit ? `${selectedUnit.unitCode} - ${selectedUnit.unitName}` : item.unit);
        setTypeSearchTerm(selectedType ? selectedType.typeName : item.type);
      } else {
        setFormData({
          itemName: "",
          unit: "",
          type: "",
          machines: "",
          stock: 0,
          photo: "",
        });
        setUnitSearchTerm("");
        setTypeSearchTerm("");
      }
      setError("");
    }
  }, [isOpen, item, itemTypes, units]);

  // Update search terms when data is loaded
  useEffect(() => {
    if (formData.unit && units.length > 0) {
      const selectedUnit = units.find(u => u.unitCode === formData.unit || u.unitName === formData.unit);
      if (selectedUnit) {
        setUnitSearchTerm(`${selectedUnit.unitCode} - ${selectedUnit.unitName}`);
      }
    }
    
    if (formData.type && itemTypes.length > 0) {
      const selectedType = itemTypes.find(t => t.typeName === formData.type);
      if (selectedType) {
        setTypeSearchTerm(selectedType.typeName);
      }
    }
  }, [units, itemTypes, formData.unit, formData.type]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "stock" ? parseInt(value) || 0 : value
    }));
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
  const filteredUnits = units.filter(unit => 
    unit.unitCode.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
    unit.unitName.toLowerCase().includes(unitSearchTerm.toLowerCase()) ||
    unit.unitType.toLowerCase().includes(unitSearchTerm.toLowerCase())
  );

  // Filter item types based on search
  const filteredItemTypes = itemTypes.filter(itemType =>
    itemType.typeName.toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
    itemType.category.toLowerCase().includes(typeSearchTerm.toLowerCase()) ||
    itemType.concernedDepartment.toLowerCase().includes(typeSearchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = item ? `/api/master/items/${item._id}` : "/api/master/items";
      const method = item ? "PUT" : "POST";

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
        setError(data.error || "Failed to save item");
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
            {item ? "Edit Item" : "Add New Item"}
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

        {loadingData && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-md">
            Loading units and item types...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter item name"
            />
          </div>

          {/* Unit Searchable Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Search and select unit"
            />
            
            {showUnitDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredUnits.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 dark:text-gray-400">No units found</div>
                ) : (
                  filteredUnits.map((unit) => (
                    <div
                      key={unit._id}
                      onClick={() => handleUnitSelect(unit)}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Search and select item type"
            />
            
            {showTypeDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredItemTypes.length === 0 ? (
                  <div className="px-3 py-2 text-gray-500 dark:text-gray-400">No item types found</div>
                ) : (
                  filteredItemTypes.map((itemType) => (
                    <div
                      key={itemType._id}
                      onClick={() => handleTypeSelect(itemType)}
                      className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Machines *
            </label>
            <input
              type="text"
              name="machines"
              value={formData.machines}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter related machines"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stock *
            </label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleInputChange}
              min="0"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter stock quantity"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Photo URL
            </label>
            <input
              type="url"
              name="photo"
              value={formData.photo}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter image URL"
            />
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
              disabled={loading || loadingData}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : item ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>

      {/* Click outside to close dropdowns */}
      {(showUnitDropdown || showTypeDropdown) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowUnitDropdown(false);
            setShowTypeDropdown(false);
          }}
        />
      )}
    </div>
  );
}
