'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { TaskStatus } from '@prisma/client';
import { startTask, completeTask, submitCashDetails, startSubscriptionTask, completeSubscriptionTask } from './actions';
import type { Session } from 'next-auth';

type SessionWithMobileToken = Session & { mobileToken?: string };

type DriverBookingItem = {
  id: string;
  startAt: Date;
  endAt: Date;
  taskStatus: string;
  status: string;
  cashCollected: boolean | null;
  cashAmountCents: number | null;
  driverNotes: string | null;
  locationLabel: string | null;
  locationCoordinates: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  service: {
    id: string;
    name: string;
    priceCents: number;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  payment: {
    id: string;
    status: string;
    amountCents: number;
  } | null;
};

type DriverDashboardData = {
  assignmentBookings: DriverBookingItem[];
  cashBookings: DriverBookingItem[];
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalValueCents: number;
  collectedCents: number;
  pendingCents: number;
  collectedCount: number;
  totalCashCollected: number;
  showAssignmentsEmpty: boolean;
  showCashEmpty: boolean;
  subscriptionTasks: {
    id: string;
    subscriptionId: string;
    date: string;
    packageName: string;
    customerName: string;
    amountCents: number;
    taskStatus: TaskStatus;
    carDescription: string | null;
    locationLabel: string | null;
    locationCoordinates: string | null;
  }[];
};

type DriverSectionFlags = {
  driverTabOverview: boolean;
  driverTabAssignments: boolean;
  driverTabCash: boolean;
};

type DriverDutyShift = {
  startTime: string;
  endTime: string;
};

type DriverDutySettings = {
  startTime: string | null;
  endTime: string | null;
  shifts?: DriverDutyShift[];
};

type DriverDayData = {
  driverDay: {
    id: string;
    date: string;
    status: 'OPEN' | 'CLOSED';
    startedAt: string;
    endedAt?: string;
    tasksCompleted: number;
    tasksInProgress: number;
    cashCollectedCents: number;
    cashSettledCents: number;
    startNotes?: string;
    endNotes?: string;
  } | null;
  unsettledCollections: {
    id: string;
    amountCents: number;
    completedAt: string;
    vehiclePlate?: string;
    serviceName: string;
  }[];
};

type DriverDashboardClientProps = {
  data: DriverDashboardData;
  featureFlags: DriverSectionFlags;
  dutySettings?: DriverDutySettings;
};

type Section = 'overview' | 'assignments' | 'cash';

type SectionMeta = {
  id: Section;
  label: string;
  description: string;
};

const sections: SectionMeta[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'View job statistics and performance.',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    description: 'Manage current tasks and cash collection.',
  },
  {
    id: 'cash',
    label: 'Cash Collection',
    description: 'View and manage cash payments.',
  },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(cents / 100);
}

function buildMapLink(locationCoordinates: string | null | undefined): string | null {
  if (!locationCoordinates) {
    return null;
  }

  if (/^https?:\/\//i.test(locationCoordinates)) {
    return locationCoordinates;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationCoordinates)}`;
}

export default function DriverDashboardClient({ data, featureFlags, dutySettings }: DriverDashboardClientProps) {
  console.log('[DriverDashboard] Component rendered with data:', {
    hasAssignments: data.assignmentBookings.length > 0,
    hasCash: data.cashBookings.length > 0,
    featureFlags
  });
  const sectionOrder: Section[] = ['overview', 'assignments', 'cash'];
  const enabledSections = sectionOrder.filter((section) => {
    if (section === 'overview') return featureFlags.driverTabOverview;
    if (section === 'assignments') return featureFlags.driverTabAssignments;
    if (section === 'cash') return featureFlags.driverTabCash;
    return true;
  });

  const [activeSection, setActiveSection] = useState<Section | null>(enabledSections[0] ?? null);

  const { data: session } = useSession();

  const {
    assignmentBookings,
    cashBookings,
    totalJobs,
    activeJobs,
    completedJobs,
    totalValueCents,
    collectedCents,
    pendingCents,
    collectedCount,
    totalCashCollected,
    showAssignmentsEmpty,
    showCashEmpty,
    subscriptionTasks,
  } = data;

  const [localCashCollected, setLocalCashCollected] = useState<Record<string, boolean>>({});

  // Driver day management state
  const [driverDayData, setDriverDayData] = useState<DriverDayData | null>(null);
  const [dayActionLoading, setDayActionLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchDriverDay = useCallback(async (date?: string) => {
    console.log('[WebDriverDashboard] ===== FETCHING DRIVER DAY =====');
    console.log('[WebDriverDashboard] fetchDriverDay called with date:', date);
    console.log('[WebDriverDashboard] Session object:', session);
    console.log('[WebDriverDashboard] User info:', session?.user);

    try {
      console.log('[WebDriverDashboard] Fetching driver day data for date:', date);
      console.log('[WebDriverDashboard] Current user session info available:', !!session);
      console.log('[WebDriverDashboard] User ID:', session?.user?.id);
      console.log('[WebDriverDashboard] User role:', session?.user?.role);

      const url = date ? `/api/driver/day?date=${date}` : '/api/driver/day';
      console.log('[WebDriverDashboard] Making API call to:', url);
      console.log('[WebDriverDashboard] Full URL:', typeof window !== 'undefined' ? window.location.origin + url : 'SSR');

      const headers: Record<string, string> = {};
      if ((session as SessionWithMobileToken)?.mobileToken) {
        headers['Authorization'] = `Bearer ${(session as SessionWithMobileToken).mobileToken}`;
        console.log('[WebDriverDashboard] Using mobile token for authentication');
      } else {
        console.log('[WebDriverDashboard] No mobile token available');
      }

      const response = await fetch(url, {
        headers,
        credentials: 'include'
      });
      console.log('[WebDriverDashboard] Raw fetch response:', response);
      console.log('[WebDriverDashboard] Response status:', response.status);
      console.log('[WebDriverDashboard] Response ok:', response.ok);
      console.log('[WebDriverDashboard] Response status text:', response.statusText);

      const responseHeaders = Object.fromEntries(response.headers.entries());
      console.log('[WebDriverDashboard] Response headers:', responseHeaders);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('[WebDriverDashboard] API error response data:', errorData);

          if (errorData.error) {
            errorMessage = errorData.error;
          }

          // Handle the specific "day already ended" error
          if (errorData.details && !errorData.details.canStartNewDay) {
            errorMessage = `Day already ended for today.\n\nNext available date: ${errorData.details.nextAvailableDate}\n\nContact administrator to reset if needed.`;
          }
        } catch (parseError) {
          console.error('[WebDriverDashboard] Could not parse error response as JSON:', parseError);
          // Fallback to text response
          try {
            const errorText = await response.text();
            console.error('[WebDriverDashboard] Error response as text:', errorText);
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            console.error('[WebDriverDashboard] Could not get error response as text either:', textError);
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[WebDriverDashboard] API response data:', result);
      console.log('[WebDriverDashboard] Setting driverDayData to:', result);
      setDriverDayData(result);

      console.log('[WebDriverDashboard] ✅ Successfully fetched and set driver day data');
    } catch (error) {
      console.error('[WebDriverDashboard] ❌ Error fetching driver day:', error);
      console.error('[WebDriverDashboard] Error details:', error);

      // Set a default state to show the section even on error
      const defaultState = {
        driverDay: null,
        unsettledCollections: []
      };
      console.log('[WebDriverDashboard] Setting default state:', defaultState);
      setDriverDayData(defaultState);
    }
  }, [session]);

  const handleStartDay = async (notes?: string) => {
    console.log('[WebDriverDashboard] ===== START DAY BUTTON PRESSED =====');
    console.log('[WebDriverDashboard] Current driver day data:', driverDayData);
    console.log('[WebDriverDashboard] Current day status:', driverDayData?.driverDay?.status);

    // Check if this is starting a new day after ending the previous one
    const isStartingAfterEnd = driverDayData?.driverDay?.status === 'CLOSED';

    if (isStartingAfterEnd) {
      const confirmStart = confirm(
        'Previous Day Ended\n\n' +
        'You have already ended your day today. Starting a new day will create a separate shift record.\n\n' +
        'If you need to modify today\'s ended day, contact an administrator.\n\n' +
        'Do you want to start a new day?'
      );

      if (!confirmStart) {
        console.log('[WebDriverDashboard] New day start cancelled by user');
        return;
      }
    }

    // Proceed with day start
    console.log('[WebDriverDashboard] Proceeding with day start...');

    const confirmReady = confirm('Are you ready to start your work day?');
    if (!confirmReady) {
      console.log('[WebDriverDashboard] Day start cancelled by user');
      return;
    }

    try {
      setDayActionLoading(true);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if ((session as SessionWithMobileToken)?.mobileToken) {
        headers['Authorization'] = `Bearer ${(session as SessionWithMobileToken).mobileToken}`;
      }

      const response = await fetch('/api/driver/day', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'start', notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to start day');
      }

      const result = await response.json();

      // Check if API returned a warning instead of success
      if (result.warning && !result.canStartNewDay) {
        console.log('[WebDriverDashboard] ===== RECEIVED WARNING =====');
        console.log('[WebDriverDashboard] Warning details:', result);

        confirm(
          `Day Already Ended Today\n\n${result.warning}\n\nPrevious day ended: ${new Date(result.previousDay.endedAt).toLocaleString()}\n\nNext available date: ${result.nextAvailableDate}\n\n${result.message}\n\nClick OK to acknowledge.`
        );

        await fetchDriverDay();
        return;
      }

      await fetchDriverDay();
      alert('Day started successfully!');
    } catch (error) {
      console.error('Error starting day:', error);
      let errorMessage = 'Failed to start day. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setDayActionLoading(false);
    }
  };

  const handleEndDay = async (notes?: string) => {
    try {
      setDayActionLoading(true);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if ((session as SessionWithMobileToken)?.mobileToken) {
        headers['Authorization'] = `Bearer ${(session as SessionWithMobileToken).mobileToken}`;
      }

      const response = await fetch('/api/driver/day', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'end', notes }),
      });

      if (!response.ok) {
        throw new Error('Failed to end day');
      }

      await fetchDriverDay();
    } catch (error) {
      console.error('Error ending day:', error);
      alert('Failed to end day. Please try again.');
    } finally {
      setDayActionLoading(false);
    }
  };

  useEffect(() => {
    if (enabledSections.length === 0) {
      setActiveSection(null);
      return;
    }

    const hasActive = enabledSections.includes(activeSection as Section);
    if (!hasActive) {
      setActiveSection(enabledSections[0]);
    }
  }, [enabledSections, activeSection]);

  useEffect(() => {
    fetchDriverDay();
  }, [fetchDriverDay]);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {enabledSections.length ? (
          <aside className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 lg:w-64">
            <nav className="space-y-2 text-sm">
              {sections
                .filter((section) => enabledSections.includes(section.id))
                .map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full rounded-xl px-4 py-3 text-left font-semibold transition ${
                        isActive
                          ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-border)]/40 hover:text-[var(--text-strong)]'
                      }`}
                    >
                      <span className="block text-sm">{section.label}</span>
                      <span className="block text-xs font-normal text-[var(--text-muted)]">{section.description}</span>
                    </button>
                  );
                })}
            </nav>
          </aside>
        ) : null}

        <main className="flex-1 space-y-6">
          {(dutySettings?.shifts && dutySettings.shifts.length > 0) || (dutySettings?.startTime && dutySettings?.endTime) ? (
            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-sm">
              <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Today&apos;s duty time</h2>
              <p className="mt-2 text-base font-semibold text-[var(--text-strong)]">
                {dutySettings?.shifts && dutySettings.shifts.length > 0
                  ? dutySettings.shifts.map((shift) => `${shift.startTime} - ${shift.endTime}`).join("  |  ")
                  : `${dutySettings?.startTime ?? ""} - ${dutySettings?.endTime ?? ""}`}
              </p>
            </section>
          ) : null}
          {!activeSection ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/60 p-6 text-center text-sm text-[var(--text-muted)]">
              All driver dashboard modules are disabled by admin.
            </div>
          ) : null}
          
          {/* Driver Day Management */}
          {(() => {
            console.log('[DriverDashboard] About to render Day Management section, driverDayData:', driverDayData);
            return (
              <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[var(--text-strong)]">Day Management</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchDriverDay()}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          console.log('[WebDriverDashboard] Testing direct API call...');
                          const response = await fetch('/api/driver/day?test=true');
                          const result = await response.json();
                          console.log('[WebDriverDashboard] Direct API test result:', result);
                          alert(`API Test Result:\n${JSON.stringify(result, null, 2)}`);
                        } catch (error) {
                          console.error('[WebDriverDashboard] Direct API test failed:', error);
                          alert(`API Test Failed: ${error}`);
                        }
                      }}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                    >
                      Test API
                    </button>
                    {driverDayData?.driverDay?.status === 'OPEN' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Day Active
                      </span>
                    )}
                    {driverDayData?.driverDay?.status === 'CLOSED' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Day Ended
                      </span>
                    )}
                  </div>
                </div>

                {driverDayData?.driverDay ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)]">Tasks Completed</label>
                        <p className="text-2xl font-semibold text-[var(--text-strong)]">{driverDayData.driverDay.tasksCompleted}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)]">Tasks In Progress</label>
                        <p className="text-2xl font-semibold text-[var(--text-strong)]">{driverDayData.driverDay.tasksInProgress}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)]">Cash Collected</label>
                        <p className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(driverDayData.driverDay.cashCollectedCents)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)]">Cash Settled</label>
                        <p className="text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(driverDayData.driverDay.cashSettledCents)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[var(--surface-border)]">
                      <div>
                        <p className="text-sm text-[var(--text-muted)]">
                          Started: {format(new Date(driverDayData.driverDay.startedAt), 'MMM d, h:mm a')}
                        </p>
                        {driverDayData.driverDay.endedAt && (
                          <p className="text-sm text-[var(--text-muted)]">
                            Ended: {format(new Date(driverDayData.driverDay.endedAt), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>

                      {driverDayData.driverDay.status === 'OPEN' ? (
                        <button
                          onClick={() => {
                            const notes = prompt('End of day notes (optional):');
                            handleEndDay(notes || undefined);
                          }}
                          disabled={dayActionLoading}
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {dayActionLoading ? 'Ending...' : 'End Day'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const notes = prompt('Start of day notes (optional):');
                            handleStartDay(notes || undefined);
                          }}
                          disabled={dayActionLoading}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {dayActionLoading ? 'Starting...' : 'Start New Day'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-[var(--text-muted)] mb-4">No active shift for today</p>

                    {/* Debug Info */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-sm font-semibold text-blue-800 mb-2">Debug Info:</div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>User ID: {session?.user?.id || 'Loading...'}</div>
                        <div>Role: {session?.user?.role || 'Loading...'}</div>
                        <div>Day Status: {driverDayData?.driverDay?.status || 'No active day'}</div>
                        <div>Current Date: {new Date().toISOString().split('T')[0]}</div>
                        <div>API Base URL: {typeof window !== 'undefined' ? window.location.origin : 'SSR'}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const notes = prompt('Start of day notes (optional):');
                        handleStartDay(notes || undefined);
                      }}
                      disabled={dayActionLoading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {dayActionLoading ? 'Starting...' : 'Start Day'}
                    </button>
                  </div>
                )}
              </section>
            );
          })()}

          {/* Unsettled Cash Collections */}
          {driverDayData?.unsettledCollections && driverDayData.unsettledCollections.length > 0 && (
            <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">Unsettled Collections</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      fetchDriverDay(e.target.value);
                    }}
                    className="px-3 py-1 border border-[var(--surface-border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {driverDayData.unsettledCollections.map((collection) => (
                  <div key={collection.id} className="flex items-center justify-between p-3 bg-[var(--surface-secondary)] rounded-lg">
                    <div>
                      <p className="font-medium text-[var(--text-strong)]">{collection.serviceName}</p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {collection.vehiclePlate ? `Plate: ${collection.vehiclePlate}` : 'No plate info'}
                        {' • '}
                        {format(new Date(collection.completedAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[var(--text-strong)]">{formatCurrency(collection.amountCents)}</p>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending Settlement
                      </span>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-[var(--surface-border)]">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[var(--text-strong)]">Total Unsettled</span>
                    <span className="text-lg font-semibold text-[var(--text-strong)]">
                      {formatCurrency(driverDayData.unsettledCollections.reduce((sum, col) => sum + col.amountCents, 0))}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'overview' && featureFlags.driverTabOverview ? (
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Assigned jobs</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{totalJobs}</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Active jobs</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{activeJobs}</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Completed jobs</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{completedJobs}</p>
                <p className="text-xs text-[var(--text-muted)]">Tasks finished</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash collected</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(collectedCents)}</p>
                <p className="text-xs text-[var(--text-muted)]">{collectedCount} job(s) paid</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Cash pending</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(pendingCents)}</p>
                <p className="text-xs text-[var(--text-muted)]">{totalJobs - collectedCount} job(s) remaining</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 sm:col-span-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Total cash collected</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalCashCollected)}</p>
                <p className="text-xs text-[var(--text-muted)]">All time collections</p>
              </article>
              <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 sm:col-span-2">
                <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--text-muted)]">Pending value</h2>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-strong)]">{formatCurrency(totalValueCents)}</p>
              </article>
            </section>
          ) : null}

          {activeSection === 'assignments' && featureFlags.driverTabAssignments ? (
            <section className="space-y-4">
              <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Today&apos;s tasks</h1>
                <p className="text-sm text-[var(--text-muted)]">Review each booking and update the status as you progress.</p>
              </header>

              <div className="grid gap-4">
                {showAssignmentsEmpty ? (
                  <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-6 text-center text-sm text-[var(--text-muted)]">
                    No bookings assigned for today yet.
                  </div>
                ) : (
                  assignmentBookings.map((booking) => {
                    const paymentStatus = booking.payment?.status ?? "REQUIRES_PAYMENT";
                    const locationHref = buildMapLink(booking.locationCoordinates);
                    const showMapLink = Boolean(locationHref && ["IN_PROGRESS", "COMPLETED"].includes(booking.taskStatus));
                    const cashFormUnlocked = ["IN_PROGRESS", "COMPLETED"].includes(booking.taskStatus);
                    const isAlreadyPaid = booking.payment?.status === "PAID" || booking.status === "PAID";
                    const showCashForm = cashFormUnlocked && !isAlreadyPaid;

                    const isCash = !booking.payment || booking.payment.status === "REQUIRES_PAYMENT";
                    const cashDone = localCashCollected[booking.id] ?? Boolean(booking.cashCollected);
                    const isDisabled = booking.taskStatus !== "IN_PROGRESS" || (isCash && !cashDone);

                    const bookingWithVehicle = booking as typeof booking & { vehicleCount?: number; vehicleServiceDetails?: string };
                    const vehicleCount = bookingWithVehicle.vehicleCount && bookingWithVehicle.vehicleCount > 1
                      ? bookingWithVehicle.vehicleCount
                      : 1;
                    const headerLabel = vehicleCount > 1 ? "Multi services" : (booking.service?.name ?? "Service");

                    return (
                      <article key={booking.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-[var(--brand-primary)]">{headerLabel}</div>
                            <h2 className="text-lg font-semibold">
                              <time dateTime={booking.startAt.toISOString()} suppressHydrationWarning>
                                {format(booking.startAt, "EEE, MMM d • h:mm a")}
                              </time>
                            </h2>
                            <p className="text-sm text-[var(--text-muted)]">Customer: {booking.user?.email ?? "Guest"}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">
                              Vehicles: {bookingWithVehicle.vehicleCount ?? 1}
                              {booking.locationLabel ? ` • Location: ${booking.locationLabel}` : ""}
                            </p>
                            {bookingWithVehicle.vehicleServiceDetails ? (
                              <p className="mt-1 text-xs text-[var(--text-muted)] whitespace-pre-wrap">
                                {bookingWithVehicle.vehicleServiceDetails}
                              </p>
                            ) : null}
                            {booking.taskStatus === "COMPLETED" ? (
                              <Link
                                href={`/driver/invoices/${booking.id}`}
                                className="mt-2 inline-flex items-center justify-center rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                              >
                                View invoice
                              </Link>
                            ) : null}
                            
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Task: {booking.taskStatus}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Booking: {booking.status}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Payment: {paymentStatus}</span>
                            {showMapLink ? (
                              <a
                                href={locationHref ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 font-semibold text-white transition hover:bg-slate-700"
                              >
                                View map
                              </a>
                            ) : null}
                          </div>
                        </header>

                        <div className={`mt-4 grid gap-4 ${featureFlags.driverTabCash ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                          <section className="space-y-2 text-sm">
                            <h3 className="font-semibold text-[var(--text-strong)]">Actions</h3>
                            <div className="flex flex-wrap gap-2">
                              <form action={startTask}>
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <button
                                  type="submit"
                                  className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                                  disabled={booking.taskStatus !== "ASSIGNED"}
                                >
                                  Start task
                                </button>
                              </form>
                              <form action={completeTask}>
                                <input type="hidden" name="bookingId" value={booking.id} />
                                <button
                                  type="submit"
                                  className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                                  disabled={isDisabled}
                                >
                                  Complete task
                                </button>
                              </form>
                              {booking.taskStatus === "IN_PROGRESS" || booking.taskStatus === "COMPLETED" ? (
                                <Link
                                  href={`/driver/bookings/${booking.id}`}
                                  className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                                >
                                  View details
                                </Link>
                              ) : null}
                              {booking.taskStatus === "COMPLETED" ? (
                                <Link
                                  href={`/driver/invoices/${booking.id}`}
                                  className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                                >
                                  Print invoice
                                </Link>
                              ) : null}
                            </div>
                            {booking.taskStatus === "ASSIGNED" ? (
                              <p className="text-xs text-[var(--text-muted)]">Start the task to unlock location and cash collection details.</p>
                            ) : null}
                          </section>
                          {featureFlags.driverTabCash ? (
                            <section className="space-y-2 text-sm">
                              <h3 className="font-semibold text-[var(--text-strong)]">Cash collection</h3>
                              {showCashForm ? (
                                <form action={submitCashDetails} className="space-y-2">
                                  <input type="hidden" name="bookingId" value={booking.id} />
                                  <label className="flex items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      name="cashCollected"
                                      defaultChecked={Boolean(booking.cashCollected)}
                                      onChange={(e) => setLocalCashCollected(prev => ({ ...prev, [booking.id]: e.target.checked }))}
                                      className="h-4 w-4 rounded border-[var(--surface-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                                    />
                                    <span>Cash received</span>
                                  </label>
                                  <input
                                    type="number"
                                    name="cashAmount"
                                    step="0.01"
                                    min={0}
                                    defaultValue={booking.cashAmountCents ? (booking.cashAmountCents / 100).toFixed(2) : ""}
                                    placeholder="Amount in AED"
                                    className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                                  />
                                  <textarea
                                    name="driverNotes"
                                    defaultValue={booking.driverNotes ?? ""}
                                    rows={2}
                                    placeholder="Notes about this job"
                                    className="w-full rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-xs focus:border-[var(--brand-primary)] focus:outline-none"
                                  />
                                  <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-full bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                                  >
                                    Save cash details
                                  </button>
                                </form>
                              ) : cashFormUnlocked ? (
                                <p className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                                  Payment already recorded online. No cash collection needed.
                                </p>
                              ) : (
                                <p className="rounded-lg border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 px-3 py-2 text-xs text-[var(--text-muted)]">
                                  Cash form will unlock once you press Start task.
                                </p>
                              )}
                            </section>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <section className="space-y-3">
                <header className="space-y-1">
                  <h2 className="text-lg font-semibold text-[var(--text-strong)]">Today&apos;s subscription washes</h2>
                  <p className="text-xs text-[var(--text-muted)]">Subscription visits scheduled for today under your subscription customers.</p>
                </header>

                {subscriptionTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-4 text-center text-xs text-[var(--text-muted)]">
                    No subscription washes assigned for today.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
                    <table className="w-full text-sm">
                      <thead className="border-b border-[var(--surface-border)] bg-[var(--surface-secondary)]">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Package</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Customer</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Car</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Location</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Daily value</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-label)]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--surface-border)]">
                        {subscriptionTasks.map((task) => {
                          const locationHref = buildMapLink(task.locationCoordinates);
                          const canStart = task.taskStatus === 'ASSIGNED';
                          const canComplete = task.taskStatus === 'IN_PROGRESS';

                          return (
                            <tr key={task.id} className="hover:bg-[var(--hover-bg)] transition-colors">
                              <td className="px-4 py-2 text-[var(--text-strong)]">{task.packageName}</td>
                              <td className="px-4 py-2 text-[var(--text-medium)]">{task.customerName}</td>
                              <td className="px-4 py-2 text-[var(--text-medium)]">{task.carDescription ?? 'N/A'}</td>
                              <td className="px-4 py-2 text-[var(--text-medium)]">
                                <div className="flex flex-col gap-1">
                                  <span>{task.locationLabel ?? 'N/A'}</span>
                                  {locationHref ? (
                                    <a
                                      href={locationHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[0.7rem] font-semibold text-[var(--brand-primary)] hover:underline"
                                    >
                                      View map
                                    </a>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-[var(--text-strong)]">{formatCurrency(task.amountCents)}</td>
                              <td className="px-4 py-2">
                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                  {task.taskStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <form action={startSubscriptionTask}>
                                    <input type="hidden" name="subscriptionId" value={task.subscriptionId} />
                                    <input type="hidden" name="date" value={task.date} />
                                    <button
                                      type="submit"
                                      className="rounded-full bg-[var(--brand-primary)] px-2.5 py-1 text-[0.7rem] font-semibold text-white transition hover:bg-[var(--brand-secondary)]"
                                      disabled={!canStart}
                                    >
                                      Start wash
                                    </button>
                                  </form>
                                  <form action={completeSubscriptionTask}>
                                    <input type="hidden" name="subscriptionId" value={task.subscriptionId} />
                                    <input type="hidden" name="date" value={task.date} />
                                    <button
                                      type="submit"
                                      className="rounded-full border border-[var(--surface-border)] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
                                      disabled={!canComplete}
                                    >
                                      Complete wash
                                    </button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </section>
          ) : null}

          {activeSection === 'cash' && featureFlags.driverTabCash ? (
            <section className="space-y-4">
              <header className="space-y-1">
                <h1 className="text-2xl font-semibold">Cash Collection</h1>
                <p className="text-sm text-[var(--text-muted)]">View and manage cash payments for your jobs.</p>
              </header>

              <div className="grid gap-4">
                {showCashEmpty ? (
                  <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface)]/70 p-6 text-center text-sm text-[var(--text-muted)]">
                    No bookings to display.
                  </div>
                ) : (
                  cashBookings.map((booking) => {
                    const cashStatus = booking.cashCollected ? 'Collected' : 'Pending';
                    const cashAmount = booking.cashAmountCents ? formatCurrency(booking.cashAmountCents) : formatCurrency(booking.service?.priceCents ?? 0);

                    return (
                      <article key={booking.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{booking.service?.name ?? "Service"}</h3>
                            <p className="text-sm text-[var(--text-muted)]">Customer: {booking.user?.email ?? "Guest"}</p>
                            <p className="text-sm text-[var(--text-muted)]">Amount: {cashAmount}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${booking.cashCollected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {cashStatus}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// Note: startTask, completeTask, submitCashDetails are imported from actions, but since it's client, need to handle differently.
// Actually, since forms post to server actions, it's fine.
