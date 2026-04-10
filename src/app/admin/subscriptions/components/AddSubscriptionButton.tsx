"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddSubscriptionModal } from "./AddSubscriptionModal";

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

interface AddSubscriptionButtonProps {
  users: UserOption[];
  packages: PackageOption[];
}

export function AddSubscriptionButton({ users, packages }: AddSubscriptionButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Manual Subscription
      </button>

      <AddSubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        users={users}
        packages={packages}
      />
    </>
  );
}
