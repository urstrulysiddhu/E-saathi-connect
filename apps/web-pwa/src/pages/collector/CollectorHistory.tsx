import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests';
import { devicesApi } from '../../api/devices';
import { Device, PickupRequest } from '@e-saathi/core';
import { formatAddress } from '../../utils/address';

export const CollectorHistory: React.FC = () => {
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [reqRes, devRes] = await Promise.all([
          requestsApi.list().catch(() => ({ items: [] })),
          devicesApi.list().catch(() => ({ items: [] })),
        ]);
        setRequests(reqRes?.items || []);
        setDevices(devRes?.items || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load collection history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading collection history...
      </div>
    );

  // Completed or accepted requests
  const pastRequests = requests.filter((r) => r.status === 'ACCEPTED' || r.status === 'REJECTED');

  return (
    <div>
      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="heading-1" style={{ margin: 0 }}>Collection History</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Historical record of accepted collections and rejected dispatches.
          </p>
        </div>
        <Link to="/collector" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
          ← Back to Active Requests
        </Link>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {pastRequests.length === 0 ? (
        <div className="status-empty">
          <p>No historical collection events recorded yet.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: '1rem' }}>
          {pastRequests.map((req) => {
            const dev = (req as any).deviceDetails;
            const matchedDevice = devices.find((d) => d.deviceId === req.deviceId) || dev;
            const isAccepted = req.status === 'ACCEPTED';
            const brand = matchedDevice?.brand || dev?.brand || matchedDevice?.category?.replace(/_/g, ' ') || dev?.category?.replace(/_/g, ' ') || 'E-Waste Item';
            const model = matchedDevice?.model || dev?.model || '';
            const lifecycleState = matchedDevice?.lifecycleState || dev?.lifecycleState;

            return (
              <div
                key={req.requestId}
                className="card"
                style={{ borderLeft: `4px solid ${isAccepted ? 'var(--success-color)' : 'var(--danger-color)'}` }}
              >
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {brand} {model}
                  </h3>
                  <span className={`badge ${isAccepted ? 'badge-success' : 'badge-danger'}`}>
                    {req.status}
                  </span>
                </div>

                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Device ID: {req.deviceId ? `${req.deviceId.slice(0, 16)}...` : 'Unknown'}
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                  <div><strong>Address:</strong> {formatAddress(req.pickupAddress, 'Address on record')}</div>
                  <div><strong>Date:</strong> {new Date(req.updatedAt || req.createdAt).toLocaleString()}</div>
                  {req.rejectionReason && (
                    <div style={{ color: 'var(--danger-color)', marginTop: '0.25rem' }}>
                      <strong>Rejection Reason:</strong> {req.rejectionReason}
                    </div>
                  )}
                  {lifecycleState && (
                    <div><strong>Current Device State:</strong> {lifecycleState.replace(/_/g, ' ')}</div>
                  )}
                </div>

                {isAccepted && req.deviceId && (
                  <Link
                    to={`/collector/handover/${req.deviceId}`}
                    className="btn btn-outline"
                    style={{ display: 'block', textAlign: 'center', fontSize: '0.8rem' }}
                  >
                    View Handover Record →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
