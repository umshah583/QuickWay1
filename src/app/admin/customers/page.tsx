import { prisma } from "@/lib/prisma";
import { CustomersManagementClient } from "./CustomersManagementClient";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  // Fetch all customers with their bookings and subscriptions
  const customers = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    include: {
      Booking_Booking_userIdToUser: {
        include: {
          Service: true,
          Payment: true,
        },
        orderBy: { createdAt: "desc" },
      },
      SubscriptionRequest_SubscriptionRequest_userIdToUser: {
        include: {
          MonthlyPackage: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Calculate customer metrics
  const { computeAvailablePoints } = await import("@/lib/loyalty");
  const { fetchLoyaltySettings } = await import("@/lib/loyalty");
  const loyaltySettings = await fetchLoyaltySettings();

  const customersWithMetrics = await Promise.all(customers.map(async (customer: any) => {
    const bookings = customer.Booking_Booking_userIdToUser || [];
    const subscriptionRequests = customer.SubscriptionRequest_SubscriptionRequest_userIdToUser || [];

    // Count completed bookings
    const totalBookings = bookings.filter(
      (booking: any) => booking.status === "PAID" || booking.taskStatus === "COMPLETED"
    ).length;

    // Calculate lifetime value from paid bookings
    const lifetimeValue = bookings
      .filter((booking: any) => booking.Payment?.status === "PAID")
      .reduce((total: number, booking: any) => total + (booking.Payment?.amountCents || booking.cashAmountCents || 0), 0);

    // Count active subscriptions
    const activeSubscriptions = subscriptionRequests.filter(
      (sub: any) => sub.status === "APPROVED" || sub.status === "ACTIVE"
    ).length;

    // Calculate current loyalty points (earned - redeemed)
    const currentLoyaltyPoints = loyaltySettings.pointsPerAed > 0
      ? await computeAvailablePoints(customer.id, customer.loyaltyRedeemedPoints || 0, loyaltySettings.pointsPerAed)
      : 0;

    return {
      ...customer,
      totalBookings,
      lifetimeValue,
      activeSubscriptions,
      currentLoyaltyPoints,
      bookings,
      subscriptionRequests,
    };
  }));

  return <CustomersManagementClient customers={customersWithMetrics} />;
}
