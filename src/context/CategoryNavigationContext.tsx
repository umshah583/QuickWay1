"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getCategoryForPath, type ModuleCategoryKey } from "@/lib/modules/categoryNavigation";

interface CategoryNavigationContextValue {
  selectedCategory: ModuleCategoryKey;
  setSelectedCategory: (category: ModuleCategoryKey) => void;
}

const CategoryNavigationContext = createContext<CategoryNavigationContextValue | undefined>(undefined);

export function CategoryNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const derivedCategory = useMemo(() => getCategoryForPath(pathname), [pathname]);
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategoryKey>(derivedCategory);

  useEffect(() => {
    setSelectedCategory(derivedCategory);
  }, [derivedCategory]);

  const value = useMemo(
    () => ({ selectedCategory, setSelectedCategory }),
    [selectedCategory]
  );

  return <CategoryNavigationContext.Provider value={value}>{children}</CategoryNavigationContext.Provider>;
}

export function useCategoryNavigation() {
  const context = useContext(CategoryNavigationContext);
  if (!context) {
    throw new Error("useCategoryNavigation must be used within a CategoryNavigationProvider");
  }
  return context;
}
