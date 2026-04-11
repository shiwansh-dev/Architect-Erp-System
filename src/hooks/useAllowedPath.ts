"use client";
import { useEffect, useState } from "react";

export const useAllowedPath = () => {
  const [allowedPath, setAllowedPath] = useState("/");

  useEffect(() => {
    try {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem('isAuthenticated');
      
      if (isAuthenticated === 'true') {
        // Get user data and check role
        const rawUser = localStorage.getItem('user');
        let userRole = '';
        let allowedPaths: string[] = [];
        
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user.role) {
            userRole = user.role;
          }
          if (Array.isArray(user.allowedPaths)) {
            allowedPaths = user.allowedPaths;
          }
        }
        
        // If user has admin role, set to ecommerce (dashboard)
        if (userRole === 'admin') {
          setAllowedPath('/ecommerce');
        } else {
          // Get allowed paths from localStorage
          const savedPaths = localStorage.getItem('allowedPaths');
          
          if (allowedPaths.length > 0) {
            setAllowedPath(allowedPaths[0]);
          } else if (savedPaths) {
            const paths = JSON.parse(savedPaths);
            if (paths && paths.length > 0) {
              setAllowedPath(paths[0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error reading localStorage:', error);
      // Fallback to home page
      setAllowedPath("/");
    }
  }, []);

  return allowedPath;
};
