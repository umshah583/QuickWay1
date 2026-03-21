import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession();
    
    const formData = await request.formData();
    const customerId = formData.get("customerId") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phoneNumber = formData.get("phoneNumber") as string;

    if (!customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    // Check if customer exists and is a USER role
    const existingCustomer = await prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer || existingCustomer.role !== "USER") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingCustomer.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      });

      if (emailExists) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
    }

    // Update customer
    const updatedCustomer = await prisma.user.update({
      where: { id: customerId },
      data: {
        name: name || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}
