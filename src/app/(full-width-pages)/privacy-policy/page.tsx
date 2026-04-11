"use client";

import Link from "next/link";
import { ChevronLeftIcon } from "@/icons";

export default function PrivacyPolicyPage() {
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
            Privacy Policy
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
                  This Privacy Policy describes how <strong>ERP-Agromach</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;, or &quot;Platform Owner&quot;) collects, uses, and protects your personal information when you use our Platform, including our website, mobile site, and mobile application (collectively, the &quot;Platform&quot;).
                </p>
                <p className="mb-4">
                  By using our Platform, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use our Platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Information We Collect
                </h2>
                <p className="mb-3">We collect several types of information from and about users of our Platform:</p>
                <ol className="list-decimal list-inside space-y-3 ml-4">
                  <li className="mb-3">
                    <strong>Personal Information:</strong> This includes information that can be used to identify you, such as:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li>Name, email address, phone number</li>
                      <li>Billing and shipping addresses</li>
                      <li>Payment information (processed through secure payment gateways)</li>
                      <li>Account credentials (username, password)</li>
                    </ul>
                  </li>
                  <li className="mb-3">
                    <strong>Usage Information:</strong> We automatically collect information about how you interact with our Platform, including:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                      <li>Device information (IP address, browser type, operating system)</li>
                      <li>Pages visited, time spent on pages, and navigation patterns</li>
                      <li>Search queries and preferences</li>
                      <li>Date and time of access</li>
                    </ul>
                  </li>
                  <li className="mb-3">
                    <strong>Cookies and Tracking Technologies:</strong> We use cookies, web beacons, and similar technologies to collect information about your browsing behavior and preferences.
                  </li>
                </ol>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  How We Use Your Information
                </h2>
                <p className="mb-3">We use the information we collect for various purposes, including:</p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>To provide, maintain, and improve our Platform and services</li>
                  <li>To process transactions and manage your account</li>
                  <li>To communicate with you about your account, orders, and our services</li>
                  <li>To send you promotional materials, newsletters, and marketing communications (with your consent)</li>
                  <li>To personalize your experience and provide relevant content</li>
                  <li>To detect, prevent, and address technical issues and security threats</li>
                  <li>To comply with legal obligations and enforce our Terms of Use</li>
                  <li>To analyze usage patterns and improve our Platform&apos;s functionality</li>
                </ol>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Information Sharing and Disclosure
                </h2>
                <p className="mb-3">We may share your information in the following circumstances:</p>
                <ol className="list-decimal list-inside space-y-3 ml-4">
                  <li className="mb-3">
                    <strong>Service Providers:</strong> We may share information with third-party service providers who perform services on our behalf, such as payment processing, data storage, and analytics. These providers are contractually obligated to protect your information.
                  </li>
                  <li className="mb-3">
                    <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
                  </li>
                  <li className="mb-3">
                    <strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government regulation, or to protect our rights, property, or safety.
                  </li>
                  <li className="mb-3">
                    <strong>With Your Consent:</strong> We may share information with third parties when you explicitly consent to such sharing.
                  </li>
                </ol>
                <p className="mt-4">
                  We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Data Security
                </h2>
                <p className="mb-4">
                  We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption of sensitive data in transit and at rest</li>
                  <li>Regular security assessments and updates</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure payment processing through certified payment gateways</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Cookies and Tracking Technologies
                </h2>
                <p className="mb-4">
                  We use cookies and similar tracking technologies to track activity on our Platform and store certain information. Cookies are small data files stored on your device. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Platform.
                </p>
                <p className="mb-4">
                  We use both session cookies (which expire when you close your browser) and persistent cookies (which remain on your device until deleted or expired) to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Remember your preferences and settings</li>
                  <li>Analyze how you use our Platform</li>
                  <li>Provide personalized content and advertisements</li>
                  <li>Improve our services and user experience</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Your Rights and Choices
                </h2>
                <p className="mb-3">You have certain rights regarding your personal information:</p>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li><strong>Access:</strong> You can request access to the personal information we hold about you.</li>
                  <li><strong>Correction:</strong> You can update or correct your personal information through your account settings or by contacting us.</li>
                  <li><strong>Deletion:</strong> You can request deletion of your personal information, subject to legal and contractual obligations.</li>
                  <li><strong>Opt-out:</strong> You can opt-out of receiving marketing communications from us by following the unsubscribe instructions in our emails or contacting us directly.</li>
                  <li><strong>Data Portability:</strong> You can request a copy of your personal information in a structured, machine-readable format.</li>
                  <li><strong>Withdraw Consent:</strong> Where we rely on your consent, you can withdraw it at any time.</li>
                </ol>
                <p className="mt-4">
                  To exercise these rights, please contact us using the contact information provided below.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Data Retention
                </h2>
                <p className="mb-4">
                  We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your information, we will securely delete or anonymize it.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Children&apos;s Privacy
                </h2>
                <p className="mb-4">
                  Our Platform is not intended for children under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately, and we will take steps to delete such information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Third-Party Links
                </h2>
                <p className="mb-4">
                  Our Platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read the privacy policies of any third-party websites or services you visit.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Changes to This Privacy Policy
                </h2>
                <p className="mb-4">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Governing Law
                </h2>
                <p className="mb-4">
                  This Privacy Policy shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with this Privacy Policy shall be subject to the exclusive jurisdiction of the courts in <strong>[Enter City and State]</strong>.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-black dark:text-white mb-3 mt-6">
                  Contact Us
                </h2>
                <p className="mb-4">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us using the contact information provided on this website.
                </p>
                <p className="mb-4">
                  For privacy-related inquiries, you can reach us at:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Email: [Enter email address]</li>
                  <li>Address: [Enter Address]</li>
                  <li>Phone: [Enter phone number]</li>
                </ul>
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
            href="/refund-policy"
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            View Refund Policy
          </Link>
        </div>
      </div>
    </div>
  );
}

