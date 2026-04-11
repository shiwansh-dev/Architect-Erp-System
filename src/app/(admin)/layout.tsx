"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const PERMISSION_REFRESH_INTERVAL_MS = 60 * 1000;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();

  // Simple client-side auth guard
  useEffect(() => {
    try {
      const isAuth = typeof window !== 'undefined' ? localStorage.getItem('isAuthenticated') : null;
      if (isAuth !== 'true') {
        router.replace('/signin');
      }
    } catch {
      router.replace('/signin');
    }
  }, [router]);

  useEffect(() => {
    let isDisposed = false;

    const syncPermissions = async (redirectOnFailure = true) => {
      try {
        if (typeof window === "undefined") return;

        const userId = localStorage.getItem('userId');
        if (!userId) {
          if (redirectOnFailure) {
            router.replace('/signin');
          }
          return;
        }

        const searchParams = new URLSearchParams({ pathname });
        const response = await fetch(`/api/auth/verify-permission?${searchParams.toString()}`, {
          method: 'GET',
          headers: {
            'x-user-id': userId,
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('allowedPaths');
            router.replace('/signin');
          } else if (redirectOnFailure) {
            router.replace('/error-404');
          }
          return;
        }

        const data = await response.json();
        if (isDisposed) {
          return;
        }

        const allowedPaths = Array.isArray(data?.user?.allowedPaths) ? data.user.allowedPaths : [];
        const userRole = data?.user?.role || '';

        try {
          const rawUser = localStorage.getItem('user');
          const parsedUser = rawUser ? JSON.parse(rawUser) : {};
          const nextUser = {
            ...parsedUser,
            _id: data?.user?._id || parsedUser?._id || userId,
            role: userRole,
            allowedPaths,
            isActive: data?.user?.isActive,
          };
          localStorage.setItem('user', JSON.stringify(nextUser));
        } catch {
          localStorage.setItem('user', JSON.stringify({
            _id: data?.user?._id || userId,
            role: userRole,
            allowedPaths,
            isActive: data?.user?.isActive,
          }));
        }
        localStorage.setItem('allowedPaths', JSON.stringify(allowedPaths));

        if (userRole === 'admin') {
          return;
        }

        if (!data.hasAccess) {
          const redirectTarget = allowedPaths[0] || '/error-404';
          router.replace(redirectTarget);
        }
      } catch (error) {
        console.error('Error verifying access:', error);
        if (redirectOnFailure) {
          router.replace('/signin');
        }
      }
    };

    syncPermissions(true);

    const intervalId = window.setInterval(() => {
      syncPermissions(false);
    }, PERMISSION_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncPermissions(false);
      }
    };

    const handleWindowFocus = () => {
      syncPermissions(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [pathname, router]);

  // Dynamic class for main content margin based on sidebar state
  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      {/* Sidebar and Backdrop */}
      <AppSidebar />
      <Backdrop />
      {/* Main Content Area */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin} overflow-x-hidden`}
      >
        {/* Header */}
        <AppHeader />
        {/* Page Content */}
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">{children}</div>
      </div>
    </div>
  );
}
