/**
 * Google Drive OAuth2 Authentication Helper
 * Supports both OAuth2 client credentials and service account
 */

let accessToken = null;
let tokenExpiry = null;

export function inspectServiceAccountKey() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    return {
      configured: false,
      error: "GOOGLE_SERVICE_ACCOUNT_KEY is not set",
    };
  }

  try {
    let keyToParse = String(serviceAccountKey).trim();
    if (keyToParse.startsWith('"') && keyToParse.endsWith('"')) {
      keyToParse = keyToParse.slice(1, -1);
    }

    const parsed = JSON.parse(keyToParse);
    const serviceAccount = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    const privateKey = typeof serviceAccount?.private_key === "string" ? serviceAccount.private_key : "";
    const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n").trim();

    return {
      configured: true,
      clientEmail: serviceAccount?.client_email || null,
      projectId: serviceAccount?.project_id || null,
      hasPrivateKey: Boolean(privateKey),
      privateKeyStartsCorrectly: normalizedPrivateKey.startsWith("-----BEGIN PRIVATE KEY-----"),
      privateKeyEndsCorrectly: normalizedPrivateKey.endsWith("-----END PRIVATE KEY-----"),
      privateKeyLineCount: normalizedPrivateKey ? normalizedPrivateKey.split("\n").length : 0,
    };
  } catch (error) {
    return {
      configured: true,
      error: error instanceof Error ? error.message : "Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY",
    };
  }
}

/**
 * Get OAuth2 access token using client credentials
 */
async function getAccessTokenFromClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google OAuth2 credentials not configured");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to refresh token: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

/**
 * Get OAuth2 access token using service account
 * Note: This requires the jsonwebtoken package. Install with: npm install jsonwebtoken
 */
async function getAccessTokenFromServiceAccount() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    throw new Error("Google Service Account key not configured. Please set GOOGLE_SERVICE_ACCOUNT_KEY in your .env.local file.");
  }

  try {
    // Dynamic import for jsonwebtoken (CommonJS module)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt = require("jsonwebtoken");

    let serviceAccount;
    
    // Parse the service account JSON (may be double-stringified from env)
    if (typeof serviceAccountKey === 'string') {
      try {
        // Strip outer quotes if present (Next.js may add them)
        let keyToParse = serviceAccountKey.trim();
        if (keyToParse.startsWith('"') && keyToParse.endsWith('"')) {
          keyToParse = keyToParse.slice(1, -1);
        }
        
        // First try parsing directly
        const parsed = JSON.parse(keyToParse);
        
        // If the parsed result is still a string, parse it again (double-stringified)
        if (typeof parsed === 'string') {
          serviceAccount = JSON.parse(parsed);
        } else {
          serviceAccount = parsed;
        }
      } catch (parseError) {
        // If parsing fails, provide helpful error message
        console.error("Failed to parse service account key:", parseError.message);
        console.error("Key length:", serviceAccountKey.length);
        console.error("First 100 chars:", serviceAccountKey.substring(0, 100));
        throw new Error(`Invalid service account key format. Error: ${parseError.message}`);
      }
    } else {
      serviceAccount = serviceAccountKey;
    }

    // Validate required fields
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Service account key missing required fields (client_email or private_key)");
    }

    // Env-stored JSON keys often preserve escaped newlines; JWT signing needs real PEM line breaks.
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n").trim();
    }

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: serviceAccount.client_email,
      scope: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ].join(" "),
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const jwtToken = jwt.sign(jwtPayload, serviceAccount.private_key, {
      algorithm: "RS256",
    });

    // Exchange JWT for access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwtToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to get service account token: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    };
  } catch (error) {
    console.error("Error getting service account token:", error);
    throw error;
  }
}

/**
 * Get a valid access token (cached if still valid)
 */
export async function getAccessToken() {
  // Return cached token if still valid (with 5 minute buffer)
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return accessToken;
  }

  let tokenData;

  // Try service account first, then client credentials
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    tokenData = await getAccessTokenFromServiceAccount();
  } else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    tokenData = await getAccessTokenFromClientCredentials();
  } else {
    throw new Error(
      "Google OAuth2 credentials not configured. Please set either GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN"
    );
  }

  // Cache the token
  accessToken = tokenData.accessToken;
  tokenExpiry = Date.now() + tokenData.expiresIn * 1000;

  return accessToken;
}
