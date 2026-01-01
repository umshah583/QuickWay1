"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Package, Loader2 } from "lucide-react";
import { createPackage, updatePackage, getServiceTypes, type PackageFormData, type PackageRecord, type ServiceTypeOption } from "./actions";

type ServiceTypeAttribute = {
  name: string;
  type: string;
  options?: Array<string | { label: string; imageUrl?: string }>;
};

type PackageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editPackage?: PackageRecord | null;
};

export function PackageModal({ isOpen, onClose, editPackage }: PackageModalProps) {
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState<"MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [washesPerMonth, setWashesPerMonth] = useState("");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [popular, setPopular] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");
  const [features, setFeatures] = useState<string[]>(["", "", ""]);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});

  // Get selected service type's attributes
  const selectedServiceType = useMemo(() => {
    return serviceTypes.find(st => st.id === serviceTypeId);
  }, [serviceTypes, serviceTypeId]);

  const serviceTypeAttributes = useMemo(() => {
    if (!selectedServiceType?.attributes) return [];
    const attrs = selectedServiceType.attributes as ServiceTypeAttribute[];
    return Array.isArray(attrs) ? attrs : [];
  }, [selectedServiceType]);

  useEffect(() => {
    if (isOpen) {
      loadServiceTypes();
      if (editPackage) {
        setName(editPackage.name);
        setDescription(editPackage.description || "");
        setDuration(editPackage.duration as "MONTHLY" | "QUARTERLY" | "YEARLY");
        setWashesPerMonth(editPackage.washesPerMonth.toString());
        setPrice((editPackage.priceCents / 100).toFixed(2));
        setDiscountPercent(editPackage.discountPercent?.toString() || "");
        setPopular(editPackage.popular);
        setStatus(editPackage.status as "ACTIVE" | "INACTIVE" | "ARCHIVED");
        const existingFeatures = editPackage.features || [];
        setFeatures([...existingFeatures, ...Array(3 - existingFeatures.length).fill("")].slice(0, 3));
        setServiceTypeId(editPackage.serviceTypeId || "");
        setSelectedAttributes(editPackage.selectedAttributes ? JSON.parse(editPackage.selectedAttributes) : {});
      } else {
        resetForm();
      }
    }
  }, [isOpen, editPackage]);

  const loadServiceTypes = async () => {
    setLoading(true);
    try {
      const types = await getServiceTypes();
      setServiceTypes(types);
    } catch (err) {
      console.error("Error loading service types:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setDuration("MONTHLY");
    setWashesPerMonth("");
    setPrice("");
    setDiscountPercent("");
    setPopular(false);
    setStatus("ACTIVE");
    setFeatures(["", "", ""]);
    setServiceTypeId("");
    setSelectedAttributes({});
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData: PackageFormData = {
      name: name.trim(),
      description: description.trim() || undefined,
      duration,
      washesPerMonth: parseInt(washesPerMonth) || 0,
      priceCents: Math.round(parseFloat(price) * 100) || 0,
      discountPercent: parseInt(discountPercent) || 0,
      popular,
      status,
      features: features.filter(f => f.trim()),
      serviceTypeId: serviceTypeId || undefined,
      selectedAttributes: Object.keys(selectedAttributes).length > 0 ? selectedAttributes : undefined,
    };

    try {
      const result = editPackage
        ? await updatePackage(editPackage.id, formData)
        : await createPackage(formData);

      if (result.success) {
        onClose();
        resetForm();
      } else {
        setError(result.error || "Something went wrong");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttributeToggle = (attributeName: string, optionValue: string, checked: boolean) => {
    setSelectedAttributes(prev => {
      const current = prev[attributeName] || [];
      if (checked) {
        return { ...prev, [attributeName]: [...current, optionValue] };
      } else {
        return { ...prev, [attributeName]: current.filter(v => v !== optionValue) };
      }
    });
  };

  const isAttributeSelected = (attributeName: string, optionValue: string) => {
    return selectedAttributes[attributeName]?.includes(optionValue) || false;
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  if (!isOpen) return null;

  const inputClass = "w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "block text-xs font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-lg bg-white shadow-xl mx-4">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3 z-10">
          <h2 className="text-base font-semibold text-gray-900">
            {editPackage ? "Edit Package" : "Create Package"}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Service Type Selection */}
          <div>
            <label className={labelClass}>Service Type</label>
            <select
              value={serviceTypeId}
              onChange={(e) => setServiceTypeId(e.target.value)}
              disabled={loading}
              className={inputClass}
            >
              <option value="">All Service Types</option>
              {serviceTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Show Service Type Attributes - Selectable */}
          {serviceTypeAttributes.length > 0 && (
            <div className="space-y-4">
              <div className="text-xs font-medium text-gray-700">Select Applicable Attributes:</div>
              {serviceTypeAttributes.map((attr, attrIdx) => {
                const options = attr.options || [];
                if (options.length === 0) return null;

                return (
                  <div key={attrIdx} className="rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 text-sm font-medium text-gray-800">{attr.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {options.map((option, optIdx) => {
                        const optionValue = typeof option === 'string' ? option : option.label;
                        const isSelected = isAttributeSelected(attr.name, optionValue);

                        return (
                          <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleAttributeToggle(attr.name, optionValue, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{optionValue}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Name & Duration */}
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className={labelClass}>Package Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Premium Plan"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Duration *</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value as "MONTHLY" | "QUARTERLY" | "YEARLY")}
                required
                className={inputClass}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className={inputClass}
            />
          </div>

          {/* Pricing Row */}
          <div className="grid gap-3 grid-cols-3">
            <div>
              <label className={labelClass}>Washes/Month *</label>
              <input
                type="number"
                value={washesPerMonth}
                onChange={(e) => setWashesPerMonth(e.target.value)}
                required
                min="1"
                placeholder="8"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Price (AED) *</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                min="0"
                step="0.01"
                placeholder="299"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Discount %</label>
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                min="0"
                max="100"
                placeholder="20"
                className={inputClass}
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <label className={labelClass}>Features</label>
            <div className="grid gap-2 grid-cols-3">
              {features.map((feature, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={feature}
                  onChange={(e) => updateFeature(idx, e.target.value)}
                  placeholder={`Feature ${idx + 1}`}
                  className={inputClass}
                />
              ))}
            </div>
          </div>

          {/* Status & Popular */}
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className={labelClass}>Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE" | "ARCHIVED")}
                required
                className={inputClass}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={popular}
                  onChange={(e) => setPopular(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs font-medium text-gray-700">Mark as Popular</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Package className="h-3 w-3" />
              )}
              {editPackage ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
