import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, logoutAll = false } = body;

    if (!userId && !logoutAll) {
      return NextResponse.json(
        { error: "Either userId or logoutAll=true is required" },
        { status: 400 }
      );
    }

    console.log(`[Admin Force Logout] ${session.user.email} initiating force logout`, {
      userId,
      logoutAll,
      timestamp: new Date().toISOString()
    });

    let affectedUsers = [];

    if (logoutAll) {
      // Logout all users by incrementing their token version
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });

      affectedUsers = allUsers;

      console.log(`[Admin Force Logout] Force logging out ${allUsers.length} users`);

      // Increment token version for all users
      await prisma.user.updateMany({
        data: {
          tokenVersion: {
            increment: 1
          }
        }
      });

    } else {
      // Logout specific user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });

      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      affectedUsers = [user];

      console.log(`[Admin Force Logout] Force logging out user: ${user.email} (${user.id})`);

      // Increment token version for specific user
      await prisma.user.update({
        where: { id: userId },
        data: {
          tokenVersion: {
            increment: 1
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: logoutAll 
        ? `Force logout completed for ${affectedUsers.length} users`
        : `Force logout completed for ${affectedUsers[0].name || affectedUsers[0].email}`,
      affectedUsers: affectedUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      })),
      timestamp: new Date().toISOString(),
      mechanism: "Token version incremented - all existing tokens will be invalidated on next verification"
    });

  } catch (error) {
    console.error("[Admin Force Logout] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    // Get active sessions/users info
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' }
      ]
    });

    // Group users by role
    const groupedUsers = {
      ADMIN: users.filter(u => u.role === 'ADMIN'),
      DRIVER: users.filter(u => u.role === 'DRIVER'),
      USER: users.filter(u => u.role === 'USER'),
      PARTNER: users.filter(u => u.role === 'PARTNER')
    };

    return NextResponse.json({
      users: groupedUsers,
      totalUsers: users.length,
      timestamp: new Date().toISOString(),
      mechanism: "Token versioning - users are logged out when tokenVersion changes"
    });

  } catch (error) {
    console.error("[Admin Force Logout GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
