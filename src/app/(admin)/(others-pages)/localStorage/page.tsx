"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function LocalStorageDebugPage() {
  const [localStorageData, setLocalStorageData] = useState<Record<string, unknown>>({});
  const [isClient, setIsClient] = useState(false);
  const [refreshTime, setRefreshTime] = useState<string>("");

  // Load localStorage data safely
  useEffect(() => {
    setIsClient(true);
    loadLocalStorageData();
  }, []);

  const loadLocalStorageData = () => {
    if (typeof window !== 'undefined') {
      const data: Record<string, unknown> = {};
      
      // Get all localStorage keys and values
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          try {
            // Try to parse as JSON first
            data[key] = JSON.parse(value || '');
          } catch {
            // If parsing fails, store as string
            data[key] = value;
          }
        }
      }
      
      setLocalStorageData(data);
      setRefreshTime(new Date().toLocaleString());
    }
  };

  const clearAllLocalStorage = () => {
    if (typeof window !== 'undefined') {
      const confirmClear = window.confirm("Are you sure you want to clear all localStorage data?");
      if (confirmClear) {
        localStorage.clear();
        loadLocalStorageData();
      }
    }
  };

  const clearSpecificKey = (key: string) => {
    if (typeof window !== 'undefined') {
      const confirmClear = window.confirm(`Are you sure you want to delete "${key}"?`);
      if (confirmClear) {
        localStorage.removeItem(key);
        loadLocalStorageData();
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard!");
    });
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              LocalStorage Debug Console
            </h1>
            <Link
              href="/"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
          
          <div className="flex items-center justify-between">
            <p className="text-gray-600 dark:text-gray-400">
              Last refreshed: {refreshTime}
            </p>
            <div className="flex gap-2">
              <button
                onClick={loadLocalStorageData}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Refresh Data
              </button>
              <button
                onClick={clearAllLocalStorage}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Data Display */}
        {Object.keys(localStorageData).length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-6a2 2 0 00-2 2v3a2 2 0 002 2h6a2 2 0 002-2v-3a2 2 0 00-2-2z" />
              </svg>
              <h3 className="text-lg font-medium mb-2">No Data Found</h3>
              <p>LocalStorage is empty or no data available</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(localStorageData).map(([key, value]) => (
              <div key={key} className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-mono mr-3">
                      {key}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                      ({typeof value === 'object' ? 'Object' : typeof value})
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => clearSpecificKey(key)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md overflow-x-auto text-sm">
                    <code className="text-gray-800 dark:text-gray-200">
                      {JSON.stringify(value, null, 2)}
                    </code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            LocalStorage Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Object.keys(localStorageData).length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Keys</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {JSON.stringify(localStorageData).length}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Total Characters</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Math.round(JSON.stringify(localStorageData).length / 1024 * 100) / 100}KB
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Approximate Size</div>
            </div>
          </div>
        </div>

        {/* Raw JSON Export */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Raw JSON Export
            </h3>
            <button
              onClick={() => copyToClipboard(JSON.stringify(localStorageData, null, 2))}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Copy All JSON
            </button>
          </div>
          <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md overflow-x-auto text-sm max-h-64 overflow-y-auto">
            <code className="text-gray-800 dark:text-gray-200">
              {JSON.stringify(localStorageData, null, 2)}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
