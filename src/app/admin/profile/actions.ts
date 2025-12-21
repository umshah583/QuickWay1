"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

function readField(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

function redirectWithMessage(type: "error" | "status", message: string) {
  const encoded = encodeURIComponent(message);
  redirect(`/admin/profile?${type}=${encoded}`);
}

export async function updateAdminProfile(formData: FormData) {
  const session = await requireAdminSession();
  const userId = session.user?.id;

  if (!userId) {
    redirectWithMessage("error", "Missing user session");
  }

  const name = readField(formData, "name");
  const email = readField(formData, "email");
  const phoneNumber = readField(formData, "phoneNumber");
  const profileImage = readField(formData, "profileImage");

  if (!name) {
    redirectWithMessage("error", "Name is required");
  }

  if (!email) {
    redirectWithMessage("error", "Email is required");
  }

  if (email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existingUser) {
      redirectWithMessage("error", "Email already in use by another user");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      phoneNumber: phoneNumber || null,
      image: profileImage || null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/profile");
  redirectWithMessage("status", "Profile updated");
}
