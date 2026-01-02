import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

declare global {
  var __firebasePilotApp: admin.app.App | undefined;
  var __firebaseCustomerApp: admin.app.App | undefined;
  var __firebaseInitialized: boolean | undefined;
}

// ⛔ Skip Firebase initialization during Next.js build phase
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function normalizeSource(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function extractBase64Candidate(value: string): string {
  if (value.startsWith('/app/')) {
    const lastSlash = value.lastIndexOf('/');
    return value.slice(lastSlash + 1);
  }
  return value;
}

function tryParseBase64Json(rawValue: string): { project_id: string } | null {
  const normalized = rawValue.replace(/\s+/g, '');
  if (!normalized) return null;
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(normalized)) return null;
  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim();
    if (!decoded.startsWith('{')) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function loadServiceAccount(envValue: string | undefined): { project_id: string } | null {
  if (!envValue) {
    console.warn(`[FirebaseAdmin] ⚠️ Environment variable not set`);
    return null;
  }
  const source = normalizeSource(envValue);
  
  // Check if the environment variable contains JSON directly (not a file path)
  if (source.startsWith('{')) {
    console.log(`[FirebaseAdmin] Loading credentials from inline environment variable`);
    try {
      return JSON.parse(source);
    } catch (error) {
      console.error(`[FirebaseAdmin] ❌ Failed to parse credentials from environment variable`, error);
      return null;
    }
  }

  const base64Candidate = extractBase64Candidate(source);
  const base64Credentials = tryParseBase64Json(base64Candidate);
  if (base64Credentials) {
    console.log(`[FirebaseAdmin] Loading credentials from base64 environment variable`);
    return base64Credentials;
  }
  
  const absolutePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
  
  console.log(`[FirebaseAdmin] Loading credentials from: ${absolutePath}`);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[FirebaseAdmin] ⚠️ Service account file not found: ${absolutePath}`);
    return null;
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return credentials;
  } catch (error) {
    console.error(`[FirebaseAdmin] ❌ Failed to read service account file: ${absolutePath}`, error);
    return null;
  }
}

function initializePilotApp(): admin.app.App | null {
  if (global.__firebasePilotApp) return global.__firebasePilotApp;
  
  const pilotServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PILOT;
  const serviceAccount = loadServiceAccount(pilotServiceAccountPath);
  
  if (!serviceAccount) {
    console.warn('[FirebaseAdmin] ⚠️ Pilot app not initialized - credentials not available');
    return null;
  }
  
  try {
    global.__firebasePilotApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    }, 'pilot');
    console.log(`[FirebaseAdmin] ✅ Initialized Pilot (driver) Firebase app: ${serviceAccount.project_id}`);
    return global.__firebasePilotApp;
  } catch (error) {
    console.error('[FirebaseAdmin] ❌ Failed to initialize Pilot Firebase app:', error);
    return null;
  }
}

function initializeCustomerApp(): admin.app.App | null {
  if (global.__firebaseCustomerApp) return global.__firebaseCustomerApp;
  
  const customerServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_CUSTOMER;
  const serviceAccount = loadServiceAccount(customerServiceAccountPath);
  
  if (!serviceAccount) {
    console.warn('[FirebaseAdmin] ⚠️ Customer app not initialized - credentials not available');
    return null;
  }
  
  try {
    global.__firebaseCustomerApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    }, 'customer');
    console.log(`[FirebaseAdmin] ✅ Initialized Customer (Quick) Firebase app: ${serviceAccount.project_id}`);
    return global.__firebaseCustomerApp;
  } catch (error) {
    console.error('[FirebaseAdmin] ❌ Failed to initialize Customer Firebase app:', error);
    return null;
  }
}

// Lazy initialization - only initialize when actually needed
function ensureInitialized(): void {
  if (global.__firebaseInitialized) return;
  
  // ⛔ Skip during build phase
  if (isBuildPhase()) {
    console.log('[FirebaseAdmin] ⏭️ Skipping initialization during build phase');
    return;
  }
  
  global.__firebaseInitialized = true;
  
  const pilotApp = initializePilotApp();
  const customerApp = initializeCustomerApp();
  
  if (pilotApp || customerApp) {
    console.log(`[FirebaseAdmin] 🚀 Initialization complete:`);
    if (pilotApp) console.log(`[FirebaseAdmin] - Pilot app: ${pilotApp.name}`);
    if (customerApp) console.log(`[FirebaseAdmin] - Customer app: ${customerApp.name}`);
  } else {
    console.warn('[FirebaseAdmin] ⚠️ No Firebase apps initialized - FCM will not work');
  }
}

// Getter functions for lazy access to messaging instances
export function getPilotMessaging(): admin.messaging.Messaging | null {
  if (isBuildPhase()) return null;
  ensureInitialized();
  return global.__firebasePilotApp ? admin.messaging(global.__firebasePilotApp) : null;
}

export function getCustomerMessaging(): admin.messaging.Messaging | null {
  if (isBuildPhase()) return null;
  ensureInitialized();
  return global.__firebaseCustomerApp ? admin.messaging(global.__firebaseCustomerApp) : null;
}

// Export getters as properties for backward compatibility
// These will be lazily evaluated when accessed
export const pilotMessaging = {
  get instance(): admin.messaging.Messaging | null {
    return getPilotMessaging();
  },
  send: async (message: admin.messaging.Message) => {
    const messaging = getPilotMessaging();
    if (!messaging) {
      console.warn('[FirebaseAdmin] ⚠️ Pilot messaging not available');
      return '';
    }
    return messaging.send(message);
  },
  sendEachForMulticast: async (message: admin.messaging.MulticastMessage) => {
    const messaging = getPilotMessaging();
    if (!messaging) {
      console.warn('[FirebaseAdmin] ⚠️ Pilot messaging not available');
      return { successCount: 0, failureCount: message.tokens.length, responses: [] };
    }
    return messaging.sendEachForMulticast(message);
  }
};

export const customerMessaging = {
  get instance(): admin.messaging.Messaging | null {
    return getCustomerMessaging();
  },
  send: async (message: admin.messaging.Message) => {
    const messaging = getCustomerMessaging();
    if (!messaging) {
      console.warn('[FirebaseAdmin] ⚠️ Customer messaging not available');
      return '';
    }
    return messaging.send(message);
  },
  sendEachForMulticast: async (message: admin.messaging.MulticastMessage) => {
    const messaging = getCustomerMessaging();
    if (!messaging) {
      console.warn('[FirebaseAdmin] ⚠️ Customer messaging not available');
      return { successCount: 0, failureCount: message.tokens.length, responses: [] };
    }
    return messaging.sendEachForMulticast(message);
  }
};

// Legacy export for backward compatibility (defaults to customer messaging)
export const firebaseMessaging = customerMessaging;
