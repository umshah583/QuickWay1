import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PageHeader from "@/app/components/PageHeader";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function fetchDevices(userId?: string) {
  const sessions = await prisma.session.findMany({
    where: {
      expires: { gte: new Date() },
      ...(userId && { userId }),
    },
    include: {
      User: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { expires: 'desc' },
  });

  // Parse device info from sessionToken (stored as JSON)
  const devices = sessions.map(session => {
    let deviceInfo = null;
    try {
      deviceInfo = JSON.parse(session.sessionToken);
    } catch (e) {
      // sessionToken might be a regular token, not JSON
      deviceInfo = {
        deviceId: session.sessionToken,
        deviceName: 'Unknown Device',
      };
    }

    return {
      id: session.id,
      userId: session.userId,
      user: session.User,
      deviceId: deviceInfo?.deviceId || session.sessionToken,
      deviceName: deviceInfo?.deviceName || 'Unknown Device',
      deviceType: deviceInfo?.deviceType,
      platform: deviceInfo?.platform,
      appVersion: deviceInfo?.appVersion,
      osVersion: deviceInfo?.osVersion,
      expires: session.expires,
      createdAt: session.expires, // Using expires as proxy for createdAt since Session doesn't have createdAt
    };
  });

  return {
    devices,
    total: devices.length,
  };
}

export default async function AdminDevicesPage({
  searchParams,
}: {
  searchParams?: Promise<{ userId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="p-8">
        <p className="text-red-600">Unauthorized</p>
      </div>
    );
  }

  const user = session.user as { id: string; role: string };
  if (user.role !== "ADMIN") {
    return (
      <div className="p-8">
        <p className="text-red-600">Access denied</p>
      </div>
    );
  }

  const params = searchParams ? await searchParams : undefined;
  const data = await fetchDevices(params?.userId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logged-in Devices"
        description="Monitor and manage active device sessions for drivers and customers."
      />

      <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--surface-border)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-strong)]">Active Sessions</h3>
              <p className="text-sm text-[var(--text-muted)]">
                {data.total || 0} device(s) currently logged in
              </p>
            </div>
          </div>
        </div>

        {data.devices && data.devices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface)]/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Device
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    App Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device: any) => (
                  <tr key={device.id} className="border-b border-[var(--surface-border)] hover:bg-[var(--surface)]/50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-[var(--text-strong)]">
                          {device.user?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {device.user?.email || 'No email'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Role: {device.user?.role || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-[var(--text-strong)]">
                          {device.deviceName || 'Unknown Device'}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          ID: {device.deviceId?.substring(0, 20)}...
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Type: {device.deviceType || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                      {device.platform || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                      {device.appVersion || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                      {new Date(device.expires).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form
                        action={`/api/admin/devices?sessionId=${device.id}`}
                        method="DELETE"
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition"
                        >
                          Invalidate Session
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No active device sessions found.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
