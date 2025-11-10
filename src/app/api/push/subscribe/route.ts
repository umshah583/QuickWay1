import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const body = (await req.json().catch(() => null)) as PushSubscriptionPayload | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Missing subscription details" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId,
    },
  });

  return NextResponse.json({ success: true });
}
