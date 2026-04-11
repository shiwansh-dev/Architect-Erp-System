"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    
    if (isAuthenticated) {
      // User is logged in - redirect to first allowed path
      try {
        const rawUser = localStorage.getItem('user');
        const rawAllowed = localStorage.getItem('allowedPaths');
        let allowedPaths: string[] = [];
        let userRole = '';
        
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (Array.isArray(user.allowedPaths)) {
            allowedPaths = user.allowedPaths;
          }
          if (user.role) {
            userRole = user.role;
          }
        }
        
        if (allowedPaths.length === 0 && rawAllowed) {
          const arr = JSON.parse(rawAllowed);
          if (Array.isArray(arr)) {
            allowedPaths = arr;
          }
        }
        
        // If user has admin role, redirect to ecommerce (dashboard)
        if (userRole === 'admin') {
          router.replace('/ecommerce');
        } else if (allowedPaths && allowedPaths.length > 0) {
          router.replace(allowedPaths[0]);
        } else {
          // Fallback to ecommerce page if no allowed paths
          router.replace('/ecommerce');
        }
    } catch {
      // On parsing errors, redirect to ecommerce page
      router.replace('/ecommerce');
    }
    } else {
      // User is not logged in - redirect to signin page
      router.replace('/signin');
    }
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
