import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

declare global {
  var __firebasePilotApp: admin.app.App | undefined;
  var __firebaseCustomerApp: admin.app.App | undefined;
}

const pilotServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_PILOT;
const customerServiceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS_CUSTOMER;

function loadServiceAccount(envPath: string | undefined): { project_id: string } {
  if (!envPath) {
    console.error(`[FirebaseAdmin] ❌ ENVIRONMENT VARIABLE NOT SET`);
    throw new Error(`Firebase credentials environment variable not configured`);
  }
  
  // Check if the environment variable contains JSON directly (not a file path)
  if (envPath.trim().startsWith('{')) {
    console.log(`[FirebaseAdmin] Loading credentials from inline environment variable`);
    try {
      return JSON.parse(envPath);
    } catch (error) {
      console.error(`[FirebaseAdmin] ❌ FAILED TO PARSE CREDENTIALS FROM ENVIRONMENT VARIABLE`, error);
      throw new Error(`Failed to parse Firebase credentials from environment variable: ${error}`);
    }
  }

  const base64Credentials = tryParseBase64Json(envPath);
  if (base64Credentials) {
    console.log(`[FirebaseAdmin] Loading credentials from base64 environment variable`);
    return base64Credentials;
  }
  
  const absolutePath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  
  console.log(`[FirebaseAdmin] Loading credentials from: ${absolutePath}`);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`[FirebaseAdmin] ❌ SERVICE ACCOUNT FILE NOT FOUND: ${absolutePath}`);
    throw new Error(`Firebase service account file not found at ${absolutePath}`);
  }
  
  try {
    const credentials = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    return credentials;
  } catch (error) {
    console.error(`[FirebaseAdmin] ❌ FAILED TO READ SERVICE ACCOUNT FILE: ${absolutePath}`, error);
    throw new Error(`Failed to read Firebase service account file: ${error}`);
  }
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

function initializePilotApp(): admin.app.App {
  if (global.__firebasePilotApp) return global.__firebasePilotApp;
  
  const serviceAccount = loadServiceAccount(pilotServiceAccountPath);
  
  try {
    global.__firebasePilotApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    }, 'pilot');
    console.log(`[FirebaseAdmin] ✅ Initialized Pilot (driver) Firebase app: ${serviceAccount.project_id}`);
    return global.__firebasePilotApp;
  } catch (error) {
    console.error('[FirebaseAdmin] ❌ Failed to initialize Pilot Firebase app:', error);
    throw new Error(`Firebase Pilot app initialization failed: ${error}`);
  }
}

function initializeCustomerApp(): admin.app.App {
  if (global.__firebaseCustomerApp) return global.__firebaseCustomerApp;
  
  const serviceAccount = loadServiceAccount(customerServiceAccountPath);
  
  try {
    global.__firebaseCustomerApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    }, 'customer');
    console.log(`[FirebaseAdmin] ✅ Initialized Customer (Quick) Firebase app: ${serviceAccount.project_id}`);
    return global.__firebaseCustomerApp;
  } catch (error) {
    console.error('[FirebaseAdmin] ❌ Failed to initialize Customer Firebase app:', error);
    throw new Error(`Firebase Customer app initialization failed: ${error}`);
  }
}

// Initialize both apps (will throw if initialization fails)
const pilotApp = initializePilotApp();
const customerApp = initializeCustomerApp();

// Export messaging instances for both apps (guaranteed to be non-null)
export const pilotMessaging = admin.messaging(pilotApp);
export const customerMessaging = admin.messaging(customerApp);

// Legacy export for backward compatibility (defaults to customer app)
export const firebaseMessaging = customerMessaging;

// Log successful initialization summary
console.log(`[FirebaseAdmin] 🚀 Initialization complete:`);
console.log(`[FirebaseAdmin] - Pilot app: ${pilotApp.name}`);
console.log(`[FirebaseAdmin] - Customer app: ${customerApp.name}`);
console.log(`[FirebaseAdmin] - Total apps initialized: 2`);
