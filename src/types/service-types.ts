export type ServiceTypeAttributeOption = {
  label: string;
  imageUrl?: string | null;
};

export type ServiceTypeAttribute = {
  name: string;
  type: "text" | "select" | "checkbox";
  options?: (string | ServiceTypeAttributeOption)[] | null;
  required?: boolean;
};

export type NormalizedServiceTypeAttribute = Omit<ServiceTypeAttribute, "options"> & {
  options?: ServiceTypeAttributeOption[];
};

export function normalizeAttributeOption(option: string | ServiceTypeAttributeOption): ServiceTypeAttributeOption {
  if (typeof option === "string") {
    return { label: option };
  }

  return {
    label: option.label ?? "",
    imageUrl: option.imageUrl ?? null,
  };
}

export function normalizeServiceTypeAttributes(
  attributes?: ServiceTypeAttribute[] | null,
): NormalizedServiceTypeAttribute[] {
  return (attributes ?? []).map((attribute) => {
    const normalizedOptions = attribute.options?.map(normalizeAttributeOption) ?? [];

    return {
      ...attribute,
      options: normalizedOptions.length > 0 ? normalizedOptions : undefined,
    };
  });
}
