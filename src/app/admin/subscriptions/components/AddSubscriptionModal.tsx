"use client";

import { useState, useEffect } from "react";
import { X, Plus, User, Package, Calendar, CreditCard, MapPin, Car } from "lucide-react";
import { createManualSubscription } from "../actions";

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
}

interface PackageOption {
  id: string;
  name: string;
  washesPerMonth: number;
  priceCents: number;
}

interface AddSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserOption[];
  packages: PackageOption[];
}

export function AddSubscriptionModal({ isOpen, onClose, users, packages }: AddSubscriptionModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form data
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("WHATSAPP");
  const [scheduleDates, setScheduleDates] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationCoordinates, setLocationCoordinates] = useState("");
  const [notes, setNotes] = useState("");

  const selectedPackageData = packages.find((p) => p.id === selectedPackage);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedUser("");
      setSelectedPackage("");
      setPricePaid("");
      setPaymentMethod("WHATSAPP");
      setScheduleDates("");
      setVehicleMake("");
      setVehicleModel("");
      setVehicleColor("");
      setVehicleType("");
      setVehiclePlate("");
      setLocationLabel("");
      setLocationCoordinates("");
      setNotes("");
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("userId", selectedUser);
      formData.append("packageId", selectedPackage);
      formData.append("pricePaidCents", String(Math.round(parseFloat(pricePaid || "0") * 100)));
      formData.append("paymentMethod", paymentMethod);
      formData.append("scheduleDates", scheduleDates);
      if (vehicleMake) formData.append("vehicleMake", vehicleMake);
      if (vehicleModel) formData.append("vehicleModel", vehicleModel);
      if (vehicleColor) formData.append("vehicleColor", vehicleColor);
      if (vehicleType) formData.append("vehicleType", vehicleType);
      if (vehiclePlate) formData.append("vehiclePlate", vehiclePlate);
      if (locationLabel) formData.append("locationLabel", locationLabel);
      if (locationCoordinates) formData.append("locationCoordinates", locationCoordinates);
      if (notes) formData.append("notes", notes);

      const result = await createManualSubscription(formData);
      
      if (result.success) {
        setSuccess(`Subscription created successfully! ID: ${result.subscriptionId}`);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscription");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-slate-900 border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-xl font-semibold text-white">Add Manual Subscription</h2>
          <button
            onClick={onClose}
            className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setStep(1)}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              step >= 1
                ? "border-b-2 border-violet-500 text-violet-400"
                : "text-slate-400"
            }`}
          >
            1. Customer & Package
          </button>
          <button
            onClick={() => setStep(2)}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              step >= 2
                ? "border-b-2 border-violet-500 text-violet-400"
                : "text-slate-400"
            }`}
          >
            2. Vehicle & Schedule
          </button>
          <button
            onClick={() => setStep(3)}
            className={`flex-1 py-3 text-center text-sm font-medium ${
              step >= 3
                ? "border-b-2 border-violet-500 text-violet-400"
                : "text-slate-400"
            }`}
          >
            3. Payment
          </button>
        </div>

        {/* Content */}
        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); setStep(step + 1); }}>
          <div className="p-6 space-y-6">
            {error && (
              <div className="rounded bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/30">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded bg-green-500/10 p-3 text-sm text-green-400 border border-green-500/30">
                {success}
              </div>
            )}

            {/* Step 1: Customer & Package */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <User className="h-4 w-4" />
                    Select Customer *
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    required
                  >
                    <option value="">Choose a customer...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email || user.phoneNumber || user.id} 
                        {user.phoneNumber && ` (${user.phoneNumber})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Package className="h-4 w-4" />
                    Select Package *
                  </label>
                  <select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    required
                  >
                    <option value="">Choose a package...</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} - {pkg.washesPerMonth} washes/month (AED {(pkg.priceCents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {selectedPackageData && (
                    <p className="text-xs text-slate-400">
                      Package includes {selectedPackageData.washesPerMonth} washes per month
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Step 2: Vehicle & Schedule */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                      <Car className="h-4 w-4" />
                      Vehicle Make
                    </label>
                    <input
                      type="text"
                      value={vehicleMake}
                      onChange={(e) => setVehicleMake(e.target.value)}
                      placeholder="e.g. Toyota"
                      className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Vehicle Model</label>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="e.g. Camry"
                      className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Vehicle Color</label>
                    <input
                      type="text"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      placeholder="e.g. White"
                      className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Vehicle Type</label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">Select type...</option>
                      <option value="SEDAN">Sedan</option>
                      <option value="SUV">SUV</option>
                      <option value="TRUCK">Truck</option>
                      <option value="VAN">Van</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">License Plate</label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="e.g. ABC-123"
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <MapPin className="h-4 w-4" />
                    Location Label
                  </label>
                  <input
                    type="text"
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="e.g. Home, Office"
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Location Coordinates</label>
                  <input
                    type="text"
                    value={locationCoordinates}
                    onChange={(e) => setLocationCoordinates(e.target.value)}
                    placeholder="e.g. 25.2048, 55.2708"
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <Calendar className="h-4 w-4" />
                    Preferred Wash Dates
                  </label>
                  <input
                    type="text"
                    value={scheduleDates}
                    onChange={(e) => setScheduleDates(e.target.value)}
                    placeholder="YYYY-MM-DD, YYYY-MM-DD (comma-separated)"
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-400">
                    Enter dates in YYYY-MM-DD format, separated by commas. Maximum {selectedPackageData?.washesPerMonth || "?"} dates.
                  </p>
                </div>
              </>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                    <CreditCard className="h-4 w-4" />
                    Payment Method *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    required
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Price Paid (AED) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePaid}
                    onChange={(e) => setPricePaid(e.target.value)}
                    placeholder="e.g. 199.00"
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                    required
                  />
                  {selectedPackageData && (
                    <p className="text-xs text-slate-400">
                      Package price: AED {(selectedPackageData.priceCents / 100).toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={3}
                    className="w-full rounded border border-slate-600 bg-slate-800 p-3 text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="rounded bg-slate-800 p-4 space-y-2">
                  <h3 className="font-medium text-white">Summary</h3>
                  <div className="text-sm text-slate-400 space-y-1">
                    <p>Customer: {users.find((u) => u.id === selectedUser)?.name || selectedUser}</p>
                    <p>Package: {selectedPackageData?.name}</p>
                    <p>Payment: {paymentMethod} - AED {pricePaid || "0.00"}</p>
                    <p>Schedule: {scheduleDates || "Not specified"}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between border-t border-slate-700 p-4">
            <button
              type="button"
              onClick={step > 1 ? () => setStep(step - 1) : onClose}
              className="rounded px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              {step > 1 ? "Back" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : step === 3 ? "Create Subscription" : "Next"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
