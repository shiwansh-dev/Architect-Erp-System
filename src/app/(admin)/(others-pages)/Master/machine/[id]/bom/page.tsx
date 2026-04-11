"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Badge from "@/components/ui/badge/Badge";

type Item = {
  _id: string;
  itemName: string;
  unit: string;
  type?: string;
};

type LinkedItem = {
  itemId: string;
  quantity: number;
  itemDetails?: Item;
};

type Machine = {
  _id: string;
  machineName: string;
  respectiveDepartment: string;
  stock: number;
  minStock: number;
  maxStock: number;
  description?: string;
  isActive: boolean;
  linkedItems: LinkedItem[];
};

export default function MachineBomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const machineId = params?.id as string;

  const [machine, setMachine] = useState<Machine | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [mRes, iRes] = await Promise.all([
          fetch(`/api/master/machine/${machineId}`),
          fetch(`/api/master/items`),
        ]);
        const mJson = await mRes.json();
        const iJson = await iRes.json();
        if (!mRes.ok) throw new Error(mJson.error || "Failed to load machine");
        if (!iRes.ok) throw new Error(iJson.error || "Failed to load items");
        setMachine(mJson.machine as Machine);
        setItems((iJson.items || []) as Item[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    if (machineId) load();
  }, [machineId]);

  const availableItems = useMemo(() => {
    const used = new Set((machine?.linkedItems || []).map((li) => li.itemId));
    return items.filter((i) => !used.has(i._id));
  }, [items, machine]);

  const updateQuantity = (itemId: string, quantity: number) => {
    if (!machine) return;
    setMachine({
      ...machine,
      linkedItems: machine.linkedItems.map((li) =>
        li.itemId === itemId ? { ...li, quantity: Math.max(0, quantity) } : li,
      ),
    });
  };

  const removeLinkedItem = (itemId: string) => {
    if (!machine) return;
    setMachine({
      ...machine,
      linkedItems: machine.linkedItems.filter((li) => li.itemId !== itemId),
    });
  };

  const [addItemId, setAddItemId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [query, setQuery] = useState("");

  const addLinkedItem = () => {
    if (!machine || !addItemId) return;
    const item = items.find((i) => i._id === addItemId);
    const next: LinkedItem = {
      itemId: addItemId,
      quantity: Math.max(1, addQty),
      itemDetails: item,
    };
    setMachine({ ...machine, linkedItems: [...machine.linkedItems, next] });
    setAddItemId("");
    setAddQty(1);
  };

  const handleSave = async () => {
    if (!machine) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = {
        linkedItems: machine.linkedItems.map((li) => ({
          itemId: li.itemId,
          quantity: li.quantity,
        })),
      };
      const res = await fetch(`/api/master/machine/${machine._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSuccess("Saved successfully");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!machine) return <div className="p-6">Machine not found</div>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            {machine.machineName} • BOM
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Department:{" "}
            <Badge size="sm" color="info">
              {machine.respectiveDepartment}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"
            href="/Master/machine"
          >
            Back
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-3 rounded border border-green-300 bg-green-100 p-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-3 font-semibold">Linked Items</h2>
          {machine.linkedItems.length === 0 ? (
            <div className="text-sm text-gray-500">No items linked yet.</div>
          ) : (
            <div className="space-y-3">
              {machine.linkedItems.map((li) => (
                <div key={li.itemId} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-medium">
                      {li.itemDetails?.itemName || li.itemId}
                    </div>
                    <div className="text-xs text-gray-500">
                      Unit: {li.itemDetails?.unit || "NOS"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={li.quantity}
                      onChange={(e) =>
                        updateQuantity(
                          li.itemId,
                          parseInt(e.target.value || "0"),
                        )
                      }
                      className="w-24 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
                    />
                    <button
                      onClick={() => removeLinkedItem(li.itemId)}
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-3 font-semibold">Add Item</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-gray-300 bg-transparent px-2 py-2 dark:border-gray-700"
            />
            <div className="max-h-56 overflow-y-auto rounded border border-gray-200 dark:border-gray-800">
              {availableItems
                .filter((it) =>
                  it.itemName.toLowerCase().includes(query.toLowerCase()),
                )
                .map((it) => (
                  <button
                    key={it._id}
                    onClick={() => setAddItemId(it._id)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${addItemId === it._id ? "bg-gray-50 dark:bg-gray-800" : ""}`}
                  >
                    {it.itemName}{" "}
                    <span className="text-xs text-gray-500">({it.unit})</span>
                  </button>
                ))}
              {availableItems.filter((it) =>
                it.itemName.toLowerCase().includes(query.toLowerCase()),
              ).length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No items match your search.
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(parseInt(e.target.value || "1"))}
                className="w-24 rounded border border-gray-300 bg-transparent px-2 py-1 dark:border-gray-700"
              />
              <button
                onClick={addLinkedItem}
                disabled={!addItemId}
                className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
