import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { Device } from '@e-saathi/core';

export const ConsumerHome: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const result = await devicesApi.list();
        // Since list() returns { items: Device[] }
        setDevices(result.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load devices');
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, []);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading devices...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
        <h3 className="heading-3">Error Loading Devices</h3>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-outline"
          style={{ marginTop: '1rem' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="heading-1" style={{ margin: 0 }}>
          My Devices
        </h1>
        <Link to="/consumer/register" className="btn btn-primary">
          Register New Device
        </Link>
      </div>

      {devices.length === 0 ? (
        <div className="status-empty">
          <p style={{ marginBottom: '1rem' }}>
            No devices yet. Register your first device to start tracking its journey.
          </p>
          <Link to="/consumer/register" className="btn btn-primary">
            Register Device
          </Link>
        </div>
      ) : (
        <div className="grid-2">
          {devices.map((device) => (
            <Link
              key={device.deviceId}
              to={`/consumer/devices/${device.deviceId}`}
              className="card"
              style={{ display: 'block' }}
            >
              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                <h3 className="heading-3" style={{ margin: 0 }}>
                  {device.brand || device.category.replace('_', ' ')} {device.model}
                </h3>
                <span
                  className={`badge ${device.lifecycleState === 'CLOSED' ? 'badge-neutral' : 'badge-success'}`}
                >
                  {device.lifecycleState.replace('_', ' ')}
                </span>
              </div>
              <div className="text-muted" style={{ marginBottom: '1rem' }}>
                ID: {device.deviceId.slice(0, 8)}...
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-neutral">Data: {device.dataSafetyState}</span>
                {device.condition !== 'UNKNOWN' && (
                  <span className="badge badge-neutral">
                    Condition: {device.condition.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--primary-color)',
                  fontWeight: 500,
                }}
              >
                View Journey →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
