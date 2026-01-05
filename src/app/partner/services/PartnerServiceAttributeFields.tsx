"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PARTNER_SERVICE_CAR_TYPES } from "./carTypes";

export type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
};

export type PartnerServiceType = {
  id: string;
  name: string;
  color: string | null;
  attributes?: ServiceTypeAttribute[] | null;
};

type Props = {
  serviceTypes: PartnerServiceType[];
};

export default function PartnerServiceAttributeFields({ serviceTypes }: Props) {
  // Validate and sanitize serviceTypes data with strict type checking
  const validatedServiceTypes: PartnerServiceType[] = React.useMemo(() => {
    console.log('[PartnerServiceAttributeFields] Raw serviceTypes:', serviceTypes);
    
    if (!Array.isArray(serviceTypes)) {
      console.log('[PartnerServiceAttributeFields] serviceTypes is not an array');
      return [];
    }

    const filtered = serviceTypes
      .filter((type) => {
        const isValid = type && 
          typeof type === 'object' && 
          typeof type.id === 'string' && 
          type.id.trim() !== '' &&
          typeof type.name === 'string' &&
          type.name.trim() !== '';
        
        if (!isValid) {
          console.log('[PartnerServiceAttributeFields] Filtering out invalid service type:', type);
        }
        
        return isValid;
      })
      .map(type => {
        const sanitizedType = {
          id: String(type.id).trim(),
          name: String(type.name).trim(),
          color: type.color && typeof type.color === 'string' ? String(type.color).trim() : null,
          attributes: null as ServiceTypeAttribute[] | null,
        };

        if (Array.isArray(type.attributes)) {
          sanitizedType.attributes = type.attributes
            .filter((attr) => {
              const isValidAttr = attr && 
                typeof attr === 'object' && 
                typeof attr.name === 'string' &&
                attr.name.trim() !== '' &&
                typeof attr.type === 'string' &&
                ['text', 'select', 'checkbox'].includes(attr.type);
              
              if (!isValidAttr) {
                console.log('[PartnerServiceAttributeFields] Filtering out invalid attribute:', attr);
              }
              
              return isValidAttr;
            })
            .map(attr => ({
              name: String(attr.name).trim(),
              type: attr.type as 'text' | 'select' | 'checkbox',
              options: Array.isArray(attr.options) 
                ? attr.options
                    .filter((option) => typeof option === 'string' && option.trim() !== '')
                    .map((option) => String(option).trim())
                : undefined,
              required: Boolean(attr.required),
            }));
        }

        console.log('[PartnerServiceAttributeFields] Sanitized type:', sanitizedType);
        return sanitizedType;
      });

    console.log('[PartnerServiceAttributeFields] Final validated serviceTypes:', filtered);
    return filtered;
  }, [serviceTypes]);

  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [carType, setCarType] = useState<string>("");
  const [attributeValues, setAttributeValues] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    if (!selectedTypeId && validatedServiceTypes.length > 0) {
      setSelectedTypeId(validatedServiceTypes[0].id);
    } else if (selectedTypeId && !validatedServiceTypes.some((type) => type.id === selectedTypeId)) {
      setSelectedTypeId(validatedServiceTypes[0]?.id ?? "");
    }
  }, [selectedTypeId, validatedServiceTypes]);

  const selectedType = useMemo(
    () => validatedServiceTypes.find((type) => type.id === selectedTypeId),
    [validatedServiceTypes, selectedTypeId],
  );
  const typeAttributes = useMemo(
    () => (selectedType?.attributes as ServiceTypeAttribute[] | null) ?? [],
    [selectedType],
  );

  const primaryAttribute = useMemo(
    () => typeAttributes.find((attr) => attr.type === "checkbox" && attr.options && attr.options.length > 0),
    [typeAttributes],
  );

  const availableCarTypes = useMemo<string[]>(() => {
    if (primaryAttribute?.options?.length) {
      // Ensure all options are strings, filter out any objects
      return primaryAttribute.options.filter((option): option is string => typeof option === 'string');
    }
    return Array.from(PARTNER_SERVICE_CAR_TYPES);
  }, [primaryAttribute]);

  const secondaryAttributes = useMemo(() => typeAttributes.filter((attr) => attr !== primaryAttribute), [typeAttributes, primaryAttribute]);

  useEffect(() => {
    setCarType("");
    setAttributeValues({});
  }, [selectedTypeId]);

  useEffect(() => {
    if (carType && !availableCarTypes.includes(carType)) {
      setCarType("");
    }
  }, [availableCarTypes, carType]);

  const updateAttributeValue = (attrName: string, value: string | string[] | null) => {
    setAttributeValues((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[attrName];
        return next;
      }

      if (typeof value === "string") {
        if (value.trim() === "") {
          delete next[attrName];
        } else {
          next[attrName] = value;
        }
        return next;
      }

      // string[]
      if (Array.isArray(value) && value.length === 0) {
        delete next[attrName];
      } else {
        next[attrName] = value;
      }
      return next;
    });
  };

  const handleCheckboxChange = (attrName: string, option: string, checked: boolean) => {
    setAttributeValues((prev) => {
      const current = Array.isArray(prev[attrName]) ? (prev[attrName] as string[]) : [];
      const next = checked ? [...current, option] : current.filter((value) => value !== option);
      const cleaned = next.length ? next : null;
      return {
        ...prev,
        ...(cleaned ? { [attrName]: Array.from(new Set(cleaned)) } : {}),
      };
    });
  };

  const currentSelectValue = (attrName: string) => (attributeValues[attrName] as string) || "";
  const currentCheckboxValues = (attrName: string) => (attributeValues[attrName] as string[]) || [];

  if (serviceTypes.length === 0) {
    return (
      <div className="md:col-span-2 rounded-xl border border-dashed border-amber-400/60 bg-amber-100/20 p-4 text-sm text-amber-800">
        No service types are available yet. Please contact support so they can configure service categories for your
        account.
      </div>
    );
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--text-label)]">Service type</span>
          <select
            name="serviceTypeId"
            required
            value={selectedTypeId}
            onChange={(event) => setSelectedTypeId(event.target.value)}
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          >
            <option value="" disabled>
              Select service type
            </option>
            {serviceTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {typeof type.name === 'string' ? type.name : 'Service Type'}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-[var(--text-label)]">
            {primaryAttribute ? (typeof primaryAttribute.name === 'string' ? primaryAttribute.name : 'Type') : "Vehicle / asset type"}
          </span>
          <select
            name="carType"
            required
            disabled={!selectedTypeId && serviceTypes.length > 0}
            value={carType}
            onChange={(event) => setCarType(event.target.value)}
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="" disabled>
              {primaryAttribute ? `Select ${primaryAttribute.name.toLowerCase()}` : "Select type"}
            </option>
            {availableCarTypes.map((type, index) => (
              <option key={index} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {secondaryAttributes.length > 0 && (
        <div className="space-y-4 rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--background)]/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Additional attributes</p>
          <div className="grid gap-4 md:grid-cols-2">
            {secondaryAttributes.map((attr) => (
              <div key={typeof attr.name === 'string' ? attr.name : 'attr'} className="space-y-2">
                <span className="text-xs font-medium text-[var(--text-label)]">
                  {typeof attr.name === 'string' ? attr.name : 'Attribute'}
                  {attr.required && <span className="ml-1 text-rose-600">*</span>}
                </span>

                {attr.type === "checkbox" && attr.options && (
                  <div className="grid gap-2">
                    {attr.options.filter((option): option is string => typeof option === 'string').map((option) => (
                      <label key={option} className="inline-flex items-center gap-2 text-xs text-[var(--text-strong)]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                          checked={currentCheckboxValues(attr.name).includes(option)}
                          onChange={(event) => handleCheckboxChange(attr.name, option, event.target.checked)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}

                {attr.type === "select" && attr.options && (
                  <select
                    value={currentSelectValue(attr.name)}
                    onChange={(event) => updateAttributeValue(attr.name, event.target.value || null)}
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  >
                    <option value="">{attr.required ? "Select an option" : "(optional)"}</option>
                    {attr.options.filter((option): option is string => typeof option === 'string').map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {attr.type === "text" && (
                  <input
                    type="text"
                    value={(attributeValues[attr.name] as string) || ""}
                    onChange={(event) => updateAttributeValue(attr.name, event.target.value)}
                    className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-strong)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    placeholder={attr.required ? undefined : "Optional"}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <input type="hidden" name="attributeValues" value={JSON.stringify(attributeValues)} />
    </div>
  );
}
