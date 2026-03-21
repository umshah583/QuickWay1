import { prisma } from "@/lib/prisma";
import { AnalyticsDashboardClient } from "./AnalyticsDashboardClient";
import { startOfDay, subDays, endOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const today = new Date();

  // Fetch bookings with relations
  const bookings = await prisma.booking.findMany({
    include: {
      Service: { select: { id: true, name: true, priceCents: true } },
      Payment: { select: { status: true, amountCents: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Fetch subscription requests
  const subscriptionRequests = await prisma.subscriptionRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Calculate growth data (last 30 days)
  const growthData = [];
  for (let i = 29; i >= 0; i--) {
    const date = subDays(today, i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayBookings = bookings.filter(b => {
      const bookingDate = new Date(b.createdAt);
      return bookingDate >= dayStart && bookingDate <= dayEnd;
    });

    const dayRevenue = dayBookings.reduce((sum, b) => {
      if (b.Payment?.status === "PAID") return sum + b.Payment.amountCents;
      return sum;
    }, 0);

    growthData.push({
      date: date.toISOString(),
      bookings: dayBookings.length,
      revenue: dayRevenue,
    });
  }

  // Popular services
  const serviceStats = bookings.reduce((acc, booking) => {
    if (booking.Service) {
      const serviceName = booking.Service.name;
      if (!acc[serviceName]) {
        acc[serviceName] = { name: serviceName, count: 0, revenue: 0 };
      }
      acc[serviceName].count++;
      if (booking.Payment?.status === "PAID") {
        acc[serviceName].revenue += booking.Payment.amountCents;
      }
    }
    return acc;
  }, {} as Record<string, { name: string; count: number; revenue: number }>);

  // Peak hours analysis
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const popularServices = Object.values(serviceStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Peak hours analysis
  const hourlyStats = bookings.reduce((acc, booking) => {
    const hour = new Date(booking.createdAt).getHours();
    if (!acc[hour]) {
      acc[hour] = 0;
    }
    acc[hour]++;
    return acc;
  }, {} as Record<number, number>);

  const peakHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourlyStats[hour] || 0,
  }));

  // Repeat customers
  const customerBookingCounts = bookings.reduce((acc, booking) => {
    if (booking.userId) {
      const userId = booking.userId;
      if (!acc[userId]) {
        acc[userId] = { id: userId, name: null, count: 0 }; // We don't have user relation anymore
      }
      acc[userId].count++;
    }
    return acc;
  }, {} as Record<string, { id: string; name: string | null; count: number }>);

  const repeatCustomers = Object.values(customerBookingCounts)
    .filter(c => c.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalCustomers = Object.keys(customerBookingCounts).length;
  const repeatCustomerCount = Object.values(customerBookingCounts).filter(c => c.count > 1).length;
  const repeatRate = totalCustomers > 0 ? (repeatCustomerCount / totalCustomers) * 100 : 0;

  // Subscription conversion
  const totalUsers = await prisma.user.count({ where: { role: "USER" } });
  const subscribedUsers = new Set(subscriptionRequests.map(sr => sr.userId)).size;
  const conversionRate = totalUsers > 0 ? (subscribedUsers / totalUsers) * 100 : 0;

  // Extract unique cities
  const cities = Array.from(
    new Set(
      bookings
        .map(b => b.locationLabel)
        .filter(Boolean)
        .map(loc => {
          const parts = loc!.split(",");
          return parts.length > 1 ? parts[parts.length - 1].trim() : null;
        })
        .filter(Boolean)
    )
  ).sort();

  return (
    <AnalyticsDashboardClient
      growthData={growthData}
      peakHours={peakHours}
      repeatCustomers={repeatCustomers}
      repeatRate={repeatRate}
      conversionRate={conversionRate}
      totalCustomers={totalCustomers}
      subscribedUsers={subscribedUsers}
      cities={cities as string[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bookings={bookings as any}
    />
  );
}
