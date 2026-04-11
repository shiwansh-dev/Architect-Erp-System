"use client";
import GridShape from "@/components/common/GridShape";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


export default function Error404() {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState("/");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    try {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      
      if (isAuthenticated === 'true') {
        // Get allowed paths from localStorage
        const allowedPaths = localStorage.getItem('allowedPaths');
        
        if (allowedPaths) {
          const paths = JSON.parse(allowedPaths);
          if (paths && paths.length > 0) {
            setRedirectPath(paths[0]);
            // Auto-redirect after a short delay
            setIsRedirecting(true);
            setTimeout(() => {
              router.push(paths[0]);
            }, 2000);
          }
        }
      }
    } catch (error) {
      console.error('Error reading localStorage:', error);
      // Fallback to home page
      setRedirectPath("/");
    }
  }, [router]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
      <GridShape />
      <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
        <h1 className="mb-8 font-bold text-gray-800 text-title-md dark:text-white/90 xl:text-title-2xl">
          ERROR
        </h1>

        <Image
          src="/images/error/404.svg"
          alt="404"
          className="dark:hidden"
          width={472}
          height={152}
        />
        <Image
          src="/images/error/404-dark.svg"
          alt="404"
          className="hidden dark:block"
          width={472}
          height={152}
        />

        <p className="mt-10 mb-6 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
          We can&apos;t seem to find the page you are looking for!
        </p>

        {isRedirecting && (
          <p className="mb-4 text-sm text-blue-600 dark:text-blue-400">
            Redirecting you to your dashboard in 2 seconds...
          </p>
        )}

        <Link
          href={redirectPath}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
        >
          {redirectPath === "/" ? "Back to Home Page" : "Go to Dashboard"}
        </Link>
      </div>
      {/* <!-- Footer --> */}
      <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
        &copy; {new Date().getFullYear()} - Tranceed Technology
      </p>
    </div>
  );
}
