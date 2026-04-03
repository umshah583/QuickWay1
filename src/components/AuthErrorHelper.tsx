"use client";

import { useState, useEffect } from "react";

interface AuthErrorHelperProps {
  error: string | null;
  onRetry?: () => void;
}

export default function AuthErrorHelper({ error, onRetry }: AuthErrorHelperProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!error || !isClient) return null;

  const isSessionError = error.includes("session") || 
                        error.includes("re-auth") || 
                        error.includes("User not found") ||
                        error.includes("expired");

  const isSetupError = error.includes("No user accounts") || 
                      error.includes("requiresSetup");

  if (!isSessionError && !isSetupError) return null;

  const handleLogout = async () => {
    try {
      // Clear any local storage/session data
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Redirect to login page
      window.location.href = '/api/auth/signout';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force reload
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isSetupError ? "Setup Required" : "Session Expired"}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-6">
            {isSetupError 
              ? "No user accounts found in the system. Please contact the administrator to set up user accounts."
              : "Your session has expired or the user account is no longer available. Please log in again to continue."
            }
          </p>

          {/* Error Details (Toggle) */}
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {showDetails ? "Hide" : "Show"} technical details
            </button>
            {showDetails && (
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-700 text-left">
                <code className="whitespace-pre-wrap">{error}</code>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {isSetupError ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>For Administrators:</strong><br />
                    Run the setup scripts to create initial user accounts:
                  </p>
                  <code className="block mt-2 text-xs bg-blue-100 p-2 rounded">
                    node create-admin-user.js<br />
                    node create-test-driver.js
                  </code>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Refresh Page
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Log Out & Re-login
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="mt-6 text-xs text-gray-500">
            {isSetupError 
              ? "If you're an administrator and need help setting up accounts, check the setup documentation."
              : "If you continue to experience issues, please contact your system administrator."
            }
          </div>
        </div>
      </div>
    </div>
  );
}
