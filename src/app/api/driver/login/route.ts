import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { errorResponse, jsonResponse, noContentResponse } from "@/lib/api-response";
import { signMobileToken } from "@/lib/mobile-session";
import { randomBytes } from "crypto";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  deviceType: z.string().optional(),
  platform: z.string().optional(),
  appVersion: z.string().optional(),
  osVersion: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { email, password, deviceId, deviceName, deviceType, platform, appVersion, osVersion } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return errorResponse("Invalid email or password", 401);
  }

  const valid = bcrypt.compareSync(password, user.passwordHash);
  if (!valid) {
    return errorResponse("Invalid email or password", 401);
  }

  // Check if user is a driver
  if (user.role !== "DRIVER") {
    return errorResponse("Account not authorized for driver app", 403);
  }

  // Check if single device login is enabled
  const singleDeviceSetting = await prisma.adminSetting.findUnique({
    where: { key: 'single_device_login_enabled' }
  });
  const singleDeviceEnabled = singleDeviceSetting?.value === 'true';

  console.log(`[Driver Login] Single device login: ${singleDeviceEnabled}, Device ID: ${deviceId}`);

  // If single device login is enabled and deviceId is provided
  if (singleDeviceEnabled && deviceId) {
    // Check if there's an active session on a different device
    const existingSessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        expires: { gte: new Date() },
      },
      take: 5,
    });

    // If there are active sessions on different devices, invalidate them
    for (const session of existingSessions) {
      // Store device info in sessionToken (temporary solution)
      // In production, you'd want to add device fields to Session model
      if (session.sessionToken !== deviceId) {
        console.log(`[Driver Login] Invalidating old session from different device`);
        await prisma.session.delete({ where: { id: session.id } });
      }
    }
  }

  const token = await signMobileToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  // Create or update session with device info (storing in sessionToken as JSON for now)
  if (deviceId) {
    const deviceInfo = {
      deviceId,
      deviceName,
      deviceType,
      platform,
      appVersion,
      osVersion,
    };

    // Delete old sessions for this user if single device login is enabled
    if (singleDeviceEnabled) {
      await prisma.session.deleteMany({
        where: { userId: user.id }
      });
    }

    // Create new session with device info
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30 days

    const sessionId = randomBytes(16).toString('hex');

    await prisma.session.create({
      data: {
        id: sessionId,
        sessionToken: JSON.stringify(deviceInfo),
        userId: user.id,
        expires,
      },
    });
  }

  return jsonResponse({
    success: true,
    token,
    driver: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    singleDeviceEnabled,
  });
}

export function OPTIONS() {
  return noContentResponse();
}
