"use client";

import { useState } from "react";
import { Edit, Trash2, PauseCircle, PlayCircle, XCircle } from "lucide-react";
import { deleteSubscription, updateSubscriptionStatus, updateSubscriptionDetails } from "../../actions";

interface SubscriptionActionsProps {
  subscriptionId: string;
  currentStatus: string;
  autoRenew: boolean;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  locationLabel?: string | null;
  locationCoordinates?: string | null;
  pricePaidCents?: number;
  startDate?: Date;
  endDate?: Date;
  washesRemaining?: number;
  washesUsed?: number;
  packageId?: string;
  availablePackages?: { id: string; name: string; washesPerMonth: number; priceCents: number }[];
}

export function SubscriptionActions({
  subscriptionId,
  currentStatus,
  autoRenew,
  vehicleMake,
  vehicleModel,
  vehicleColor,
  vehicleType,
  vehiclePlate,
  locationLabel,
  locationCoordinates,
  pricePaidCents,
  startDate,
  endDate,
  washesRemaining,
  washesUsed,
  packageId,
  availablePackages,
}: SubscriptionActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("subscriptionId", subscriptionId);
      await deleteSubscription(formData);
      window.location.href = "/admin/subscriptions";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (status: string, reason?: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("subscriptionId", subscriptionId);
      formData.append("status", status);
      if (reason) formData.append("reason", reason);
      await updateSubscriptionStatus(formData);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDetails = async (formData: FormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      formData.append("subscriptionId", subscriptionId);
      await updateSubscriptionDetails(formData);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
        >
          <Edit className="h-4 w-4" />
          Edit Details
        </button>

        {currentStatus === "ACTIVE" && (
          <>
            <button
              onClick={() => handleStatusChange("PAUSED")}
              className="inline-flex items-center gap-2 rounded-lg border border-yellow-600 bg-yellow-900/30 px-3 py-2 text-sm font-medium text-yellow-300 hover:bg-yellow-900/50 transition-colors"
            >
              <PauseCircle className="h-4 w-4" />
              Pause
            </button>
            <button
              onClick={() => setShowStatusModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-900/30 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/50 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          </>
        )}

        {currentStatus === "PAUSED" && (
          <button
            onClick={() => handleStatusChange("ACTIVE")}
            className="inline-flex items-center gap-2 rounded-lg border border-green-600 bg-green-900/30 px-3 py-2 text-sm font-medium text-green-300 hover:bg-green-900/50 transition-colors"
          >
            <PlayCircle className="h-4 w-4" />
            Resume
          </button>
        )}

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-slate-900 border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Subscription</h3>
            <p className="text-sm text-slate-300 mb-4">
              Are you sure you want to delete this subscription? This action cannot be undone.
            </p>
            {error && (
              <div className="mb-4 rounded bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/30">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-slate-900 border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Cancel Subscription</h3>
            <p className="text-sm text-slate-300 mb-4">
              Please provide a reason for cancellation.
            </p>
            {error && (
              <div className="mb-4 rounded bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/30">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const reason = formData.get("reason") as string;
                handleStatusChange("CANCELLED", reason);
              }}
              className="space-y-4"
            >
              <div>
                <textarea
                  name="reason"
                  rows={3}
                  placeholder="Cancellation reason..."
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-900 border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Edit Subscription Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-4 rounded bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/30">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleEditDetails(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Package & Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  {availablePackages && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1">Package</label>
                      <select
                        name="packageId"
                        defaultValue={packageId || ""}
                        className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                      >
                        {availablePackages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} - {pkg.washesPerMonth} washes (AED {(pkg.priceCents / 100).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Price Paid (AED)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="pricePaidCents"
                      defaultValue={pricePaidCents ? (pricePaidCents / 100).toFixed(2) : ""}
                      placeholder="e.g. 199.00"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Washes Remaining</label>
                    <input
                      type="number"
                      name="washesRemaining"
                      defaultValue={washesRemaining || 0}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Washes Used</label>
                    <input
                      type="number"
                      name="washesUsed"
                      defaultValue={washesUsed || 0}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Subscription Period</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={startDate ? startDate.toISOString().split('T')[0] : ""}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      defaultValue={endDate ? endDate.toISOString().split('T')[0] : ""}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Vehicle Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vehicle Make</label>
                    <input
                      name="vehicleMake"
                      defaultValue={vehicleMake || ""}
                      placeholder="e.g. Toyota"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vehicle Model</label>
                    <input
                      name="vehicleModel"
                      defaultValue={vehicleModel || ""}
                      placeholder="e.g. Camry"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vehicle Color</label>
                    <input
                      name="vehicleColor"
                      defaultValue={vehicleColor || ""}
                      placeholder="e.g. White"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Vehicle Type</label>
                    <select
                      name="vehicleType"
                      defaultValue={vehicleType || ""}
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">Select type...</option>
                      <option value="SEDAN">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="TRUCK">Truck</option>
                      <option value="VAN">Van</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">License Plate</label>
                    <input
                      name="vehiclePlate"
                      defaultValue={vehiclePlate || ""}
                      placeholder="e.g. ABC-123"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Location</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Location Label</label>
                    <input
                      name="locationLabel"
                      defaultValue={locationLabel || ""}
                      placeholder="e.g. Home, Office"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Location Coordinates</label>
                    <input
                      name="locationCoordinates"
                      defaultValue={locationCoordinates || ""}
                      placeholder="e.g. 25.2048, 55.2708"
                      className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Settings</h4>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <input
                      type="checkbox"
                      name="autoRenew"
                      defaultChecked={autoRenew}
                      className="rounded border-slate-600 bg-slate-800 text-violet-500 focus:ring-violet-500"
                    />
                    Auto-renew subscription
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
