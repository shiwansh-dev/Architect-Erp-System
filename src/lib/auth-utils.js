// Server-side authentication and authorization utilities
import clientPromise, { databaseName } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const USER_CACHE_TTL_MS = 30 * 1000;
const userCache = globalThis.__erpUserCache || new Map();
if (!globalThis.__erpUserCache) {
  globalThis.__erpUserCache = userCache;
}

/**
 * Get user from database by userId
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User object or null
 */
export async function getUserFromDB(userId) {
  try {
    if (!userId || !ObjectId.isValid(userId)) {
      return null;
    }

    const cached = userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } } // Exclude password
    );

    userCache.set(userId, {
      user,
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });

    return user;
  } catch (error) {
    console.error("Error fetching user from DB:", error);
    return null;
  }
}

/**
 * Check if user has access to a specific path
 * @param {Object} user - User object from database
 * @param {string} pathname - Path to check (e.g., "/Templates/fms-template")
 * @returns {boolean} True if user has access
 */
export function hasPathAccess(user, pathname) {
  if (!user) return false;

  // Admin users have access to all paths
  if (user.role === 'admin') {
    return true;
  }

  // Backward compatibility: if no allowedPaths are configured, allow all
  if (!user.allowedPaths || !Array.isArray(user.allowedPaths) || user.allowedPaths.length === 0) {
    return true;
  }

  // Check if pathname starts with any allowed path
  const hasAccess = user.allowedPaths.some((allowedPath) => {
    // Exact match or pathname starts with allowed path
    return pathname === allowedPath || pathname.startsWith(allowedPath + '/');
  });

  return hasAccess;
}

/**
 * Validate user session and permissions
 * @param {Request} request - Next.js request object
 * @param {string} pathname - Optional pathname to check (if not provided, extracted from request)
 * @returns {Promise<{user: Object|null, hasAccess: boolean, pathname: string}>}
 */
export async function validateUserSession(request, pathname = null) {
  try {
    let url = null;
    let requestPathname;
    
    // Get URL from request if available
    if (request.url) {
      try {
        url = new URL(request.url);
      } catch {
        // URL might already be a URL object or invalid
        if (request.url instanceof URL) {
          url = request.url;
        }
      }
    }
    
    if (pathname) {
      requestPathname = pathname;
    } else if (url) {
      requestPathname = url.pathname;
    } else {
      // Fallback: try to extract from request
      requestPathname = pathname || '/';
    }

    // Public paths that don't require authentication
    const publicPaths = [
      '/signin',
      '/signup',
      '/terms-and-conditions',
      '/refund-policy',
      '/privacy-policy',
      '/api/signin',
      '/api/signup',
      '/_next',
      '/favicon.ico',
    ];

    // Check if path is public
    const isPublicPath = publicPaths.some(path => requestPathname.startsWith(path));
    if (isPublicPath) {
      return { user: null, hasAccess: true, pathname: requestPathname };
    }

    // Get userId from various sources
    let userId = null;
    
    // Try to get from headers (set by middleware or API calls)
    if (request.headers) {
      if (typeof request.headers.get === 'function') {
        userId = request.headers.get('x-user-id');
      } else if (request.headers['x-user-id']) {
        userId = request.headers['x-user-id'];
      }
    }
    
    // Try to get from cookies (for middleware and API routes)
    if (!userId && request.cookies) {
      // Handle both middleware cookies (ReadonlyRequestCookies) and API route cookies
      if (typeof request.cookies.get === 'function') {
        try {
          const userIdCookie = request.cookies.get('userId');
          const userIdClientCookie = request.cookies.get('userId_client');
          userId = userIdCookie?.value || userIdClientCookie?.value;
        } catch (e) {
          // Cookie get might fail in some contexts
          console.warn('Error getting cookies:', e);
        }
      } else if (request.cookies.userId) {
        // Fallback for different cookie formats
        userId = request.cookies.userId;
      } else if (request.cookies.userId_client) {
        userId = request.cookies.userId_client;
      }
    }
    
    // Try to get from URL search params (for API routes)
    if (!userId && url) {
      try {
        userId = url.searchParams.get('userId');
      } catch {
        // searchParams might not be available
      }
    }

    // Require userId for protected paths
    if (!userId) {
      return { user: null, hasAccess: false, pathname: requestPathname };
    }

    // Get user from database
    const user = await getUserFromDB(userId);
    if (!user) {
      return { user: null, hasAccess: false, pathname: requestPathname };
    }

  // Check if user is active
  if (user.isActive === false) {
    return { user: null, hasAccess: false, pathname: requestPathname };
  }

  if (user.expiresAt) {
    const expiresAt = new Date(user.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) {
      return { user: null, hasAccess: false, pathname: requestPathname };
    }
  }

  // Check path access
  const hasAccess = hasPathAccess(user, requestPathname);

    return { user, hasAccess, pathname: requestPathname };
  } catch (error) {
    console.error("Error validating user session:", error);
    return { user: null, hasAccess: false, pathname: pathname || '' };
  }
}
