import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileUserFromRequest } from '@/lib/mobile-session';

export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const driver = await getMobileUserFromRequest(request);
    if (!driver) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    if (!query) {
      return NextResponse.json({ customers: [] });
    }

    // Search customers by name, email, or phone number
    const customers = await prisma.user.findMany({
      where: {
        role: 'USER',
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            email: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            phoneNumber: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
      },
      orderBy: [
        { name: 'asc' }
      ],
      take: limit
    });

    console.log('[Customer Search] Driver authenticated, Query:', query, 'Results:', customers.length);

    return NextResponse.json({
      customers: customers.map(customer => ({
        id: customer.id,
        name: customer.name || 'Unknown',
        email: customer.email || '',
        phoneNumber: customer.phoneNumber || '',
        createdAt: customer.createdAt,
        bookingCount: 0, // TODO: Add booking count later if needed
        displayName: customer.name || customer.email || customer.phoneNumber || 'Unknown Customer'
      }))
    });

  } catch (error) {
    console.error('[Customer Search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search customers' },
      { status: 500 }
    );
  }
}
