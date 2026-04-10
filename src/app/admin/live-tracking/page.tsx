'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import map component to avoid SSR issues and prevent re-initialization
const LiveTrackingMap = dynamic(() => import('./LiveTrackingMap'), { 
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '500px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🗺️</div>
        <p style={{ color: '#666' }}>Loading map...</p>
      </div>
    </div>
  )
});

interface LiveTrackingResponse {
  drivers: Array<{
    driverId: string;
    driverName: string;
    phoneNumber: string | null;
    availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ON_BREAK';
    currentTaskStatus: string | null;
    location: {
      latitude: number | null;
      longitude: number | null;
      updatedAt: Date | null;
    } | null;
    lastSeen: Date;
    taskCount: number;
  }>;
  totalDrivers?: number;
  availableDrivers?: number;
  busyDrivers?: number;
  offlineDrivers?: number;
}

export default function AdminLiveTrackingDashboard() {
  const [drivers, setDrivers] = useState<LiveTrackingResponse['drivers']>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [focusedDriverId, setFocusedDriverId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalDrivers: number;
    availableDrivers: number;
    busyDrivers: number;
    offlineDrivers: number;
  }>({ totalDrivers: 0, availableDrivers: 0, busyDrivers: 0, offlineDrivers: 0 });

  const fetchLiveLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/live-tracking');
      if (!response.ok) {
        throw new Error('Failed to fetch driver locations');
      }

      const data: LiveTrackingResponse = await response.json();
      console.log('[LiveTracking] API Response:', data);
      console.log('[LiveTracking] Drivers with location:', data.drivers?.filter(d => d.location).length || 0);
      console.log('[LiveTracking] Total drivers:', data.drivers?.length || 0);
      
      // Log individual driver details
      data.drivers?.forEach(driver => {
        console.log(`[LiveTracking] Driver ${driver.driverName}: status=${driver.availabilityStatus}, location=${driver.location ? 'YES' : 'NO'}`);
      });
      
      setDrivers(data.drivers || []);
      setStats({
        totalDrivers: data.totalDrivers || data.drivers?.length || 0,
        availableDrivers: data.availableDrivers || 0,
        busyDrivers: data.busyDrivers || 0,
        offlineDrivers: data.offlineDrivers || 0,
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching live locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLiveLocations();

    // Set up polling for live updates
    const interval = setInterval(fetchLiveLocations, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' }}>Live Driver Tracking</h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Track all active drivers in real-time
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            backgroundColor: '#f0f0f0',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>🕒</span>
            Last updated: {mounted ? lastUpdate.toLocaleTimeString() : 'Loading...'}
          </span>
          <button
            onClick={fetchLiveLocations}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{loading ? '⟳' : '🔄'}</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#666' }}>Total Drivers</span>
            <span style={{ fontSize: '20px' }}>👥</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.totalDrivers}</div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            All registered drivers
          </p>
        </div>

        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #28a745',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#155724' }}>Available</span>
            <span style={{ fontSize: '20px' }}>✅</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#155724' }}>{stats.availableDrivers}</div>
          <p style={{ fontSize: '12px', color: '#155724', marginTop: '4px' }}>
            Ready for assignment
          </p>
        </div>

        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#856404' }}>Busy</span>
            <span style={{ fontSize: '20px' }}>🔄</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#856404' }}>{stats.busyDrivers}</div>
          <p style={{ fontSize: '12px', color: '#856404', marginTop: '4px' }}>
            On active tasks
          </p>
        </div>

        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #dc3545',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#721c24' }}>Offline</span>
            <span style={{ fontSize: '20px' }}>❌</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#721c24' }}>{stats.offlineDrivers}</div>
          <p style={{ fontSize: '12px', color: '#721c24', marginTop: '4px' }}>
            Not available today
          </p>
        </div>
      </div>

      {/* Map and Driver List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Map */}
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Live Driver Locations</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                All drivers and their current status
              </p>
            </div>
            <div style={{ height: '400px' }}>
              <LiveTrackingMap drivers={drivers.filter(d => d.location)} focusedDriverId={focusedDriverId} />
            </div>
          </div>
        </div>

        {/* Driver List */}
        <div>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Driver Status</h3>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Real-time availability and location information
              </p>
            </div>
            <div style={{ padding: '20px' }}>
              {drivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ color: '#999', fontSize: '16px', marginBottom: '8px' }}>
                    No drivers found
                  </p>
                  <p style={{ color: '#666', fontSize: '14px' }}>
                    Check driver registrations and day status
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {drivers.map((driver) => (
                    <div
                      key={driver.driverId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        backgroundColor: 
                          driver.availabilityStatus === 'AVAILABLE' ? '#f8fff8' :
                          driver.availabilityStatus === 'BUSY' ? '#fffef8' :
                          driver.availabilityStatus === 'OFFLINE' ? '#fff8f8' : '#f8f8f8'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <p style={{ fontWeight: '500' }}>{driver.driverName}</p>
                          <span style={{
                            backgroundColor: 
                              driver.availabilityStatus === 'AVAILABLE' ? '#28a745' :
                              driver.availabilityStatus === 'BUSY' ? '#ffc107' :
                              driver.availabilityStatus === 'OFFLINE' ? '#dc3545' : '#6c757d',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>
                            {driver.availabilityStatus}
                          </span>
                        </div>
                        <p style={{ color: '#666', fontSize: '12px', marginBottom: '2px' }}>
                          {driver.phoneNumber || 'No phone'}
                        </p>
                        {driver.location ? (
                          <p style={{ color: '#28a745', fontSize: '12px' }}>
                            📍 Location active • Tasks: {driver.taskCount}
                          </p>
                        ) : (
                          <p style={{ color: '#dc3545', fontSize: '12px' }}>
                            📍 No location • Tasks: {driver.taskCount}
                          </p>
                        )}
                        {driver.currentTaskStatus && (
                          <p style={{ color: '#17a2b8', fontSize: '11px', marginTop: '2px' }}>
                            Current: {driver.currentTaskStatus}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{
                          color: '#666',
                          fontSize: '11px',
                          marginBottom: '4px'
                        }}>
                          Last seen: {formatTimeAgo(new Date(driver.lastSeen))}
                        </span>
                        {driver.location && (
                          <button
                            style={{
                              backgroundColor: focusedDriverId === driver.driverId ? '#007bff' : '#6c757d',
                              color: 'white',
                              border: 'none',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                            onClick={() => {
                              console.log(`[LiveTracking] Clicked View on Map for driver: ${driver.driverName} (ID: ${driver.driverId})`);
                              setFocusedDriverId(driver.driverId);
                            }}
                          >
                            {focusedDriverId === driver.driverId ? 'Viewing' : 'View on Map'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
