"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

interface BillingItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayError {
  error: {
    description?: string;
    metadata?: {
      payment_id?: string;
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayError) => void) => void;
}

interface RazorpayConstructor {
  new (options: {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill: {
      name: string;
      email: string;
      contact: string;
    };
    notes: {
      address: string;
    };
    theme: {
      color: string;
    };
    modal: {
      ondismiss: () => void;
    };
  }): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

export default function BillingPage() {
  const router = useRouter();
  const [items, setItems] = useState<BillingItem[]>([
    { id: "1", description: "", quantity: 1, price: 0, total: 0 },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: "",
        quantity: 1,
        price: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof BillingItem, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "price") {
            updated.total = updated.quantity * updated.price;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.18; // 18% GST
  const total = subtotal + tax;

  // Quick test function - sets up ₹1 payment
  const handleQuickTest = () => {
    // Set customer details for testing
    setCustomerName("Test Customer");
    setCustomerEmail("test@example.com");
    setCustomerPhone("9876543210");
    setBillingAddress("Test Address, Test City");

    // Calculate price to get exactly ₹1 total (including 18% GST)
    // total = subtotal + (subtotal * 0.18) = subtotal * 1.18
    // 1 = subtotal * 1.18
    // subtotal = 1 / 1.18 ≈ 0.8475
    // Using 0.85 to ensure total rounds to approximately ₹1.00
    const targetSubtotal = 0.85;
    
    // Set single item with calculated price
    setItems([
      {
        id: "1",
        description: "Test Payment Item",
        quantity: 1,
        price: targetSubtotal,
        total: targetSubtotal,
      },
    ]);

    setError("");
    setSuccess("Test data loaded! Total will be ₹1.00");
  };

  const handleProceedToPayment = async () => {
    if (!customerName || !customerEmail || !customerPhone) {
      setError("Please fill in all customer details");
      return;
    }

    if (items.some((item) => !item.description || item.price <= 0)) {
      setError("Please fill in all item details with valid prices");
      return;
    }

    if (total <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    if (!razorpayLoaded || !window.Razorpay) {
      setError("Razorpay is not loaded. Please refresh the page.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // Create order on server
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: total,
          customerName,
          customerEmail,
          customerPhone,
          billingAddress,
          items: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })),
          subtotal,
          tax,
          total,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      // Initialize Razorpay Checkout
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "ERP Agromach",
        description: `Order ${data.receipt}`,
        order_id: data.orderId,
        handler: function (response: RazorpayResponse) {
          // Payment successful - redirect to confirmation page
          const successUrl = `/billing/payment-success?paymentId=${response.razorpay_payment_id}&orderId=${response.razorpay_order_id}`;
          router.push(successUrl);
        },
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        notes: {
          address: billingAddress || "",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setError("Payment cancelled by user");
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", function (response: RazorpayError) {
        setLoading(false);
        setError(`Payment failed: ${response.error.description || "Unknown error"}`);
        // Stay on billing page to show error
      });

      razorpayInstance.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate payment");
      setLoading(false);
    }
  };

  // Clear any old status messages on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    
    // If there's a status param, it means we came from an old redirect
    // Clear it to show clean billing page
    if (status) {
      router.replace("/billing");
    }
  }, [router]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        onError={() => setError("Failed to load Razorpay SDK")}
      />
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-title-md2 font-semibold text-black dark:text-white">
            Billing & Payment
          </h2>
          <button
            onClick={handleQuickTest}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Quick Test (₹1)
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Details */}
          <div className="lg:col-span-2">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                <h3 className="font-medium text-black dark:text-white">
                  Customer Details
                </h3>
              </div>
              <div className="p-6.5 space-y-4">
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded border border-stroke bg-transparent px-5 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full rounded border border-stroke bg-transparent px-5 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                    placeholder="customer@example.com"
                  />
                </div>
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded border border-stroke bg-transparent px-5 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                    placeholder="+91 1234567890"
                  />
                </div>
                <div>
                  <label className="mb-2.5 block text-black dark:text-white">
                    Billing Address
                  </label>
                  <textarea
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-stroke bg-transparent px-5 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                    placeholder="Enter billing address"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
              <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-black dark:text-white">
                    Items
                  </h3>
                  <button
                    onClick={addItem}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-opacity-90"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
              <div className="p-6.5">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-stroke dark:border-strokedark">
                        <th className="px-3 py-3 text-left text-sm font-medium text-black dark:text-white">
                          Description
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-medium text-black dark:text-white">
                          Quantity
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-medium text-black dark:text-white">
                          Price
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-medium text-black dark:text-white">
                          Total
                        </th>
                        <th className="px-3 py-3 text-left text-sm font-medium text-black dark:text-white">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-stroke dark:border-strokedark"
                        >
                          <td className="px-3 py-4">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) =>
                                updateItem(item.id, "description", e.target.value)
                              }
                              className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                              placeholder="Item description"
                            />
                          </td>
                          <td className="px-3 py-4">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "quantity",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-4">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                updateItem(
                                  item.id,
                                  "price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded border border-stroke bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
                            />
                          </td>
                          <td className="px-3 py-4 text-sm font-medium text-black dark:text-white">
                            ₹{item.total.toFixed(2)}
                          </td>
                          <td className="px-3 py-4">
                            {items.length > 1 && (
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark sticky top-6">
              <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                <h3 className="font-medium text-black dark:text-white">
                  Payment Summary
                </h3>
              </div>
              <div className="p-6.5 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-black dark:text-white">
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">GST (18%)</span>
                  <span className="font-medium text-black dark:text-white">
                    ₹{tax.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-stroke dark:border-strokedark pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-black dark:text-white">
                      Total
                    </span>
                    <span className="text-lg font-semibold text-black dark:text-white">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleProceedToPayment}
                  disabled={loading || total <= 0 || !razorpayLoaded}
                  className="w-full rounded bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Processing..." : "Proceed to Payment"}
                </button>
                {!razorpayLoaded && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-2">
                    Loading Razorpay...
                  </p>
                )}
                {razorpayLoaded && total <= 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Add items to proceed
                  </p>
                )}
                {razorpayLoaded && total > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Powered by Razorpay Payment Gateway
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
