"use client";

import Link from "next/link";
import { ChevronLeftIcon } from "@/icons";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-boxdark">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/signin"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
          >
            <ChevronLeftIcon className="w-4 h-4 mr-1" />
            Back to Sign In
          </Link>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Cancellation & Refund Policy
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-boxdark rounded-lg shadow-sm border border-stroke dark:border-strokedark p-6 md:p-8">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="space-y-6 text-gray-700 dark:text-gray-300">
              
              <section>
                <p className="mb-4">
                  This cancellation policy outlines about how you can cancel or seek a refund for a product / service that you have purchased through the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Cancellation Policy
                </h2>
                <ol className="list-decimal list-inside space-y-4 ml-4">
                  <li className="mb-4">
                    Cancellations will only be considered if the request is made within <strong>7 days</strong> of placing the order. However, cancellation request may not be entertained if the orders have been communicated to such sellers / merchant(s) listed on the Platform and they have initiated the process of shipping them, or the product is out for delivery. In such an event, you may choose to reject the product at the doorstep.
                  </li>
                  <li className="mb-4">
                    <strong>ERP-Agromach</strong> does not accept cancellation requests for perishable items like flowers, eatables, etc. However, the refund / replacement can be made if the user establishes that quality of the product delivered is not good.
                  </li>
                </ol>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Defective or Damaged Products
                </h2>
                <p className="mb-4">
                  In case of receipt of damaged or defective items, please report to our customer service team. The request would be entertained once the seller/ merchant listed on the Platform, has checked and determined the same at its own end. This should be reported within <strong>7 days</strong> of receipt of products.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Product Not as Described
                </h2>
                <p className="mb-4">
                  In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within <strong>7 days</strong> of receiving the product. The customer service team after looking into your complaint will take an appropriate decision.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Warranty Products
                </h2>
                <p className="mb-4">
                  In case of complaints regarding the products that come with a warranty from the manufacturers, please refer the issue to them.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Refund Processing
                </h2>
                <p className="mb-4">
                  In case of any refunds approved by <strong>ERP-Agromach</strong>, it will take <strong>7-14 business days</strong> for the refund to be processed to you. The refund will be credited to the original payment method used during the transaction.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Contact Information
                </h2>
                <p className="mb-4">
                  For any cancellation or refund requests, please contact our customer service team using the contact information provided on this website. Our team will assist you with your request and guide you through the process.
                </p>
              </section>

              <section className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> All cancellation and refund requests are subject to verification and approval by our team. We reserve the right to refuse any cancellation or refund request that does not comply with this policy.
                </p>
              </section>

            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <Link
            href="/signin"
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Back to Sign In
          </Link>
          <Link
            href="/terms-and-conditions"
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            View Terms & Conditions
          </Link>
          <Link
            href="/privacy-policy"
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}

