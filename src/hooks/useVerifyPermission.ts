"use client";
import { useEffect, useState } from "react";

interface PermissionResult {
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to verify user permissions server-side
 * This prevents users from bypassing client-side checks by modifying localStorage
 */
export function useVerifyPermission(pathname: string): PermissionResult {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyPermission = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get userId from localStorage (for backward compatibility)
        // In production, this should come from httpOnly cookie
        const userId = localStorage.getItem('userId');
        
        if (!userId) {
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        // Call server-side permission verification API
        const response = await fetch('/api/auth/verify-permission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId, // Pass userId in header
          },
          body: JSON.stringify({ pathname }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Unauthorized - user not authenticated
            setHasAccess(false);
            setError('Unauthorized');
          } else {
            setHasAccess(false);
            setError('Failed to verify permission');
          }
          return;
        }

        const data = await response.json();
        setHasAccess(data.hasAccess || false);
      } catch (err) {
        console.error('Error verifying permission:', err);
        setHasAccess(false);
        setError('Network error');
      } finally {
        setIsLoading(false);
      }
    };

    if (pathname) {
      verifyPermission();
    } else {
      setIsLoading(false);
    }
  }, [pathname]);

  return { hasAccess, isLoading, error };
}





