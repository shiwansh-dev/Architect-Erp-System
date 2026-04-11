"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PaymentDetails {
  success: boolean;
  payment?: {
    amount: number;
    status: string;
  };
  order?: {
    amount: number;
    status: string;
  };
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const paymentId = searchParams.get("paymentId");
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (paymentId || orderId) {
      // Fetch payment details from API
      fetch(`/api/payment/status?paymentId=${paymentId || ""}&orderId=${orderId || ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPaymentDetails(data);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching payment details:", error);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [paymentId, orderId]);

  const amount = paymentDetails?.payment?.amount
    ? (paymentDetails.payment.amount / 100).toFixed(2)
    : paymentDetails?.order?.amount
    ? (paymentDetails.order.amount / 100).toFixed(2)
    : "0.00";

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        {/* Success Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <svg
            className="h-12 w-12 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        {/* Success Message */}
        <h1 className="mb-4 text-3xl font-bold text-black dark:text-white">
          Payment Successful!
        </h1>
        <p className="mb-8 text-center text-gray-600 dark:text-gray-400 max-w-md">
          Thank you for your payment. Your transaction has been completed successfully.
        </p>

        {/* Payment Details Card */}
        {loading ? (
          <div className="w-full max-w-md rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-center text-gray-600 dark:text-gray-400">Loading payment details...</p>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-white">
              Payment Details
            </h2>
            <div className="space-y-3">
              {paymentId && (
                <div className="flex justify-between border-b border-stroke pb-2 dark:border-strokedark">
                  <span className="text-gray-600 dark:text-gray-400">Payment ID:</span>
                  <span className="font-medium text-black dark:text-white">{paymentId}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between border-b border-stroke pb-2 dark:border-strokedark">
                  <span className="text-gray-600 dark:text-gray-400">Order ID:</span>
                  <span className="font-medium text-black dark:text-white">{orderId}</span>
                </div>
              )}
              {amount && (
                <div className="flex justify-between border-b border-stroke pb-2 dark:border-strokedark">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span className="font-medium text-black dark:text-white">₹{amount}</span>
                </div>
              )}
              {paymentDetails?.payment?.status && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
                    {paymentDetails.payment.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <Link
            href="/billing"
            className="rounded bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Back to Billing
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded border border-stroke bg-white px-6 py-3 font-medium text-black hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors dark:border-strokedark dark:bg-boxdark dark:text-white dark:hover:bg-boxdark-2"
          >
            Print Receipt
          </button>
        </div>

        {/* Additional Info */}
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
          A confirmation email has been sent to your registered email address. If you have any questions, please contact our support team.
        </p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

