"use client";
import React, { useEffect, useMemo, useState } from "react";

export default function LocalStorageDebug() {
  const [items, setItems] = useState<Array<{ key: string; value: string }>>([]);

  const loadItems = () => {
    if (typeof window === "undefined") return;
    try {
      const keys = Object.keys(localStorage).sort();
      const pairs = keys.map((key) => ({ key, value: localStorage.getItem(key) ?? "" }));
      setItems(pairs);
    } catch {
      // Swallow errors to avoid crashing debug view
      setItems([]);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const prettyItems = useMemo(() => {
    return items.map(({ key, value }) => {
      let pretty = value;
      try {
        const parsed = JSON.parse(value);
        pretty = JSON.stringify(parsed, null, 2);
      } catch {
        // keep as raw string
      }
      return { key, value: pretty };
    });
  }, [items]);

  const handleClear = () => {
    if (typeof window === "undefined") return;
    localStorage.clear();
    loadItems();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Local Storage (Debug)</h3>
        <div className="flex gap-2">
          <button
            onClick={loadItems}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800"
          >
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700/40 dark:text-red-300 dark:hover:bg-white/5"
          >
            Clear All
          </button>
        </div>
      </div>

      {prettyItems.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No localStorage items found.</p>
      ) : (
        <div className="space-y-4">
          {prettyItems.map(({ key, value }) => (
            <div key={key} className="rounded border border-gray-200 p-3 dark:border-gray-800">
              <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{key}</div>
              <pre className="whitespace-pre-wrap break-all text-xs text-gray-800 dark:text-gray-200">{value}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


