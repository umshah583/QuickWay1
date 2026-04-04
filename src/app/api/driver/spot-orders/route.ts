// Driver Spot Orders API Endpoint
// GET /api/driver/spot-orders - Get driver's spot orders
// POST /api/driver/spot-orders - Create new spot order

import { NextRequest, NextResponse } from 'next/server';
import { getMobileUserFromRequest } from '@/lib/mobile-session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { errorResponse, jsonResponse } from '@/lib/api-response';
import { generateBookingIdentifiers } from '@/lib/booking-identifiers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendCustomerCredentialsEmail } from '@/lib/email';

// Interface for customer with temporary password
interface CustomerWithTempPassword {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  role: string;
  image: string | null;
  emailVerified: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  partnerId: string | null;
  loyaltyRedeemedPoints: number;
  loyaltyCreditCents: number;
  refreshToken: string | null;
  oneTimeCode: string | null;
  oneTimeCodeExpiry: Date | null;
  pushSubscription: string | null;
  createdAt: Date;
  updatedAt: Date;
  locationUpdatedAt: Date | null;
  tempPassword: string;
}

// Request schema for creating spot order
const CreateSpotOrderSchema = z.object({
  zoneId: z.string().optional(), // Make optional since we're using unified booking system
  serviceId: z.string().min(1, 'Service ID is required'),
  locationLabel: z.string().min(1, 'Location is required'),
  locationCoordinates: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleCount: z.number().int().min(1).max(10).default(1),
  vehicleServiceDetails: z.string().optional(),
  // Customer details for spot order
  customerName: z.string().min(1, 'Customer name is required'),
  customerMobile: z.string().min(1, 'Customer mobile number is required'),
  customerEmail: z.string().email('Valid customer email is required'),
  customerVehiclePlate: z.string().min(1, 'Customer vehicle plate is required'),
});

// Helper function to generate random password
function generateRandomPassword(length = 8): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Helper function to create customer account
async function createCustomerAccount(customerData: {
  name: string;
  email: string;
  mobile: string;
  vehiclePlate: string;
}): Promise<CustomerWithTempPassword | any> {
  try {
    // Check if customer already exists
    const existingCustomer = await prisma.user.findFirst({
      where: {
        OR: [
          { email: customerData.email },
          { phoneNumber: customerData.mobile }
        ]
      }
    });

    if (existingCustomer) {
      console.log('[Spot Orders] Customer already exists:', existingCustomer.email);
      return existingCustomer as any;
    }

    // Generate random password
    const tempPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create customer account
    const customer = await prisma.user.create({
      data: {
        name: customerData.name,
        email: customerData.email,
        phoneNumber: customerData.mobile,
        passwordHash: hashedPassword,
        role: 'USER',
        emailVerified: new Date(), // Auto-verify with current date
      }
    });

    // Return customer with tempPassword for sending credentials
    const customerWithTempPassword = {
      ...customer,
      tempPassword: tempPassword
    };

    console.log('[Spot Orders] Created customer account:', {
      id: customer.id,
      email: customer.email,
      tempPassword: tempPassword // For logging only, will be sent via email
    });

    // Send credentials email to customer
    try {
      if (customer.email && tempPassword) {
        await sendCustomerCredentialsEmail(customer.email, customer.name || 'Customer', tempPassword);
        console.log('[Spot Orders] Credentials email sent to:', customer.email);
      } else {
        console.warn('[Spot Orders] Cannot send email - missing email or password');
      }
    } catch (emailError) {
      console.error('[Spot Orders] Failed to send credentials email:', emailError);
      // Don't fail the whole process if email fails
    }

    // Return customer with tempPassword for sending credentials to customer
    console.log('[Spot Orders] Customer credentials to send:', {
      email: customer.email,
      password: tempPassword
    });

    return customerWithTempPassword;

  } catch (error) {
    console.error('[Spot Orders] Error creating customer account:', error);
    throw error;
  }
}

// GET /api/driver/spot-orders
export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const session = await getMobileUserFromRequest(request);
    if (!session || session.role !== 'DRIVER') {
      return errorResponse('Unauthorized', 401);
    }

    // Fetch bookings that were created as spot orders by this driver
    const spotBookings = await prisma.booking.findMany({
      where: {
        driverId: session.sub,
        userId: session.sub, // Spot orders are where user and driver are the same
        taskStatus: {
          not: "COMPLETED",
        },
      },
      include: {
        Service: true,
        User_Booking_userIdToUser: true,
        Payment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to match expected spot order format
    const spotOrders = await Promise.all(spotBookings.map(async (booking) => {
      // Get the area information (we'll need to derive this from location or use a default)
      let area = null;
      if (booking.locationLabel) {
        // Try to find area by name or use a default
        area = await prisma.area.findFirst({
          where: {
            OR: [
              { name: { contains: booking.locationLabel } },
              { active: true }
            ]
          },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          }
        });
      }

      // Fallback to first active area if none found
      if (!area) {
        area = await prisma.area.findFirst({
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            active: true,
          }
        });
      }

      return {
        id: booking.id,
        driverId: booking.driverId,
        zoneId: area?.id || '',
        Area: area,
        serviceId: booking.serviceId,
        Service: booking.Service,
        locationLabel: booking.locationLabel,
        locationCoordinates: booking.locationCoordinates,
        vehiclePlate: booking.vehiclePlate,
        vehicleCount: booking.vehicleCount,
        vehicleServiceDetails: booking.vehicleServiceDetails,
        status: booking.taskStatus,
        priceCents: booking.cashAmountCents, // Use cashAmountCents instead of priceCents
        cashCollected: booking.cashCollected,
        cashSettled: booking.cashSettled,
        createdAt: booking.createdAt,
        acceptedAt: booking.startAt,
        completedAt: booking.taskCompletedAt,
        driverNotes: booking.vehicleServiceDetails,
        // Add booking-specific fields
        bookingId: booking.id,
        userId: booking.userId,
        taskStatus: booking.taskStatus,
      };
    }));

    return jsonResponse(spotOrders);

  } catch (error) {
    console.error('Error in driver spot orders GET API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}

// POST /api/driver/spot-orders
export async function POST(request: NextRequest) {
  try {
    // Authenticate driver
    const session = await getMobileUserFromRequest(request);
    if (!session || session.role !== 'DRIVER') {
      return errorResponse('Unauthorized', 401);
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('[Spot Orders POST] Received request body:', body);
    console.log('[Spot Orders POST] Driver session:', { sub: session.sub, email: session.email, role: session.role });
    
    const validation = CreateSpotOrderSchema.safeParse(body);
    
    if (!validation.success) {
      console.log('[Spot Orders POST] Validation failed:', validation.error.issues);
      return jsonResponse(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    console.log('[Spot Orders POST] Validated data:', data);
    const { 
      zoneId, 
      serviceId, 
      locationLabel, 
      locationCoordinates, 
      vehiclePlate, 
      vehicleCount, 
      vehicleServiceDetails,
      customerName,
      customerMobile,
      customerEmail,
      customerVehiclePlate
    } = data;

    // Create customer account first
    console.log('[Spot Orders POST] Creating customer account...');
    const customer = await createCustomerAccount({
      name: customerName,
      email: customerEmail,
      mobile: customerMobile,
      vehiclePlate: customerVehiclePlate,
    });

    console.log('[Spot Orders POST] Customer account created/retrieved:', {
      id: customer.id,
      email: customer.email,
      isNew: !!customer.tempPassword
    });

    // Verify zone exists and is active (if zoneId is provided)
    let zone = null;
    if (zoneId) {
      zone = await prisma.area.findUnique({
        where: { id: zoneId, active: true },
      });

      if (!zone) {
        return errorResponse('Invalid zone', 400);
      }
    }

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return errorResponse('Invalid service', 400);
    }

    // Get pricing for this zone and service
    let priceCents = service.priceCents; // Default to base service price

    const zonePrice = await prisma.serviceAreaPrice.findFirst({
      where: {
        areaId: zoneId,
        serviceId: serviceId,
        active: true,
      },
    });

    if (zonePrice) {
      priceCents = zonePrice.priceCents;
    }

    // Create a regular booking instead of spot order
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later
    
    // Generate invoice and order numbers for proper tracking
    const { invoiceNumber, orderNumber } = await generateBookingIdentifiers(zone?.name || 'Spot Order');
    console.log('[Spot Orders] Generated identifiers:', { invoiceNumber, orderNumber });
    
    const booking = await prisma.booking.create({
      data: {
        userId: customer.id, // Use customer ID as the booking owner
        driverId: session.sub, // Auto-assign to creating pilot
        serviceId: serviceId,
        status: 'PENDING',
        taskStatus: 'ASSIGNED', // Auto-assigned and ready to start
        cashAmountCents: priceCents, // Use cashAmountCents instead of priceCents
        startAt: now, // Start immediately
        endAt: endTime, // Add required end time
        locationLabel: locationLabel,
        locationCoordinates: locationCoordinates,
        vehiclePlate: customerVehiclePlate, // Use customer's vehicle plate
        vehicleCount: vehicleCount || 1,
        vehicleServiceDetails: vehicleServiceDetails,
        cashCollected: false,
        cashSettled: false,
        invoiceNumber: invoiceNumber, // Add invoice number
        orderNumber: orderNumber, // Add order number
        areaId: zone?.id || null, // Add area if available
        areaName: zone?.name || null, // Add area name if available
        // Add customer details for reference
        customerLatitude: null,
        customerLongitude: null,
      },
      include: {
        Service: true,
        User_Booking_userIdToUser: true,
        Payment: true,
      },
    });

    console.log(`[Spot Orders] Driver ${session.sub} created spot booking ${booking.id} for customer ${customer.email} - auto-assigned and cash-only`);

    // Return enhanced response with customer information
    return jsonResponse({
      id: booking.id,
      driverId: booking.driverId,
      zoneId: zoneId,
      area: zone, // Changed from Area to area
      serviceId: booking.serviceId,
      service: booking.Service, // Changed from Service to service
      locationLabel: booking.locationLabel,
      locationCoordinates: booking.locationCoordinates,
      vehiclePlate: booking.vehiclePlate,
      vehicleCount: booking.vehicleCount,
      vehicleServiceDetails: booking.vehicleServiceDetails,
      status: booking.taskStatus, // Use taskStatus for consistency
      priceCents: booking.cashAmountCents, // Use cashAmountCents
      createdAt: booking.createdAt,
      acceptedAt: booking.startAt,
      completedAt: booking.taskCompletedAt,
      driverNotes: booking.vehicleServiceDetails,
      // Add booking-specific fields
      bookingId: booking.id,
      userId: booking.userId,
      taskStatus: booking.taskStatus,
      cashCollected: booking.cashCollected,
      cashSettled: booking.cashSettled,
      // Add invoice and order numbers
      invoiceNumber: booking.invoiceNumber,
      orderNumber: booking.orderNumber,
      // Add customer information
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        mobile: customer.phoneNumber,
        isNewCustomer: !!customer.tempPassword,
        credentialsSent: !!customer.tempPassword, // TODO: Update when email is implemented
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error in driver spot orders POST API:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return errorResponse('Unauthorized', 401);
    }

    return errorResponse('Internal server error', 500);
  }
}
