"use client";
import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Customer = {
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  paymentTerms?: string;
  creditLimit?: number;
  isActive?: boolean;
};

function CustomerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerId = searchParams.get('id');
  const isEditMode = !!customerId;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<Customer>({
    name: "",
    email: "",
    phone: "",
    gstin: "",
    billingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "India" },
    paymentTerms: "Due on Receipt",
    creditLimit: 0,
    isActive: true,
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/master/customers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch customers");
      setCustomers(json.customers || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomer = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/master/customers/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch customer");
      setForm(json.customer);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch customer");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && customerId) {
      fetchCustomer(customerId);
    } else {
      fetchCustomers();
    }
  }, [isEditMode, customerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const url = isEditMode ? `/api/master/customers/${customerId}` : "/api/master/customers";
      const method = isEditMode ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed to ${isEditMode ? 'update' : 'create'} customer`);
      
      setSuccess(`Customer ${isEditMode ? 'updated' : 'created'} successfully`);
      
      if (!isEditMode) {
        setForm({
          name: "",
          email: "",
          phone: "",
          gstin: "",
          billingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "India" },
          paymentTerms: "Due on Receipt",
          creditLimit: 0,
          isActive: true,
        });
        fetchCustomers();
      } else {
        setTimeout(() => {
          router.push("/Master/customers");
        }, 1500);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to ${isEditMode ? 'update' : 'create'} customer`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            {isEditMode ? "Edit Customer" : "Create Customer"}
          </h1>
          <Link
            href="/Master/customers"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back to List
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">{error}</div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">Customer Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">GSTIN</label>
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Payment Terms</label>
            <input
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Credit Limit</label>
            <input
              type="number"
              min={0}
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value || "0") })}
              className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div>
              <label className="text-sm text-gray-600">Address Line 1</label>
              <input
                value={form.billingAddress.line1}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, line1: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Address Line 2</label>
              <input
                value={form.billingAddress.line2}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, line2: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">City</label>
              <input
                value={form.billingAddress.city}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, city: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">State</label>
              <input
                value={form.billingAddress.state}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, state: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">ZIP</label>
              <input
                value={form.billingAddress.zip}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, zip: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Country</label>
              <input
                value={form.billingAddress.country}
                onChange={(e) => setForm({ ...form, billingAddress: { ...form.billingAddress, country: e.target.value } })}
                className="w-full mt-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end mt-2">
            <button 
              type="submit" 
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : (isEditMode ? "Update Customer" : "Create Customer")}
            </button>
          </div>
        </form>

        {!isEditMode && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h2 className="text-lg font-semibold mb-3">Recent Customers</h2>
            {loading ? (
              <div className="text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-2">
                {customers.slice(0, 5).map(c => (
                  <div key={c._id} className="flex items-center justify-between rounded border border-gray-200 dark:border-gray-800 p-3">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.email || "-"} • {c.phone || "-"}</div>
                    </div>
                    <div className="text-xs text-gray-500">{c.billingAddress?.city || ""} {c.billingAddress?.state ? ", " + c.billingAddress.state : ""}</div>
                  </div>
                ))}
                {customers.length === 0 && <div className="text-sm text-gray-500">No customers yet.</div>}
                {customers.length > 5 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/Master/customers"
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      View all customers
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
      <CustomerContent />
    </Suspense>
  );
}

