import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { Device } from '@e-saathi/core';

export const AdminHome: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tab, setTab] = useState<'AWAITING' | 'VERIFIED' | 'CLOSED' | 'ALL'>('AWAITING');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = () => {
    setLoading(true);
    devicesApi
      .list({ limit: '1000' })
      .then((res) => {
        setDevices(res.items || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading administrative queue...
      </div>
    );

  const awaitingVerification = devices.filter(d => d.lifecycleState === 'PROCESSED');
  const verifiedDevices = devices.filter(d => d.lifecycleState === 'VERIFIED');
  const closedDevices = devices.filter(d => d.lifecycleState === 'CLOSED');

  let currentList = devices;
  if (tab === 'AWAITING') currentList = awaitingVerification;
  else if (tab === 'VERIFIED') currentList = verifiedDevices;
  else if (tab === 'CLOSED') currentList = closedDevices;

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    currentList = currentList.filter(d => 
      d.deviceId.toLowerCase().includes(term) ||
      (d.brand && d.brand.toLowerCase().includes(term)) ||
      (d.model && d.model.toLowerCase().includes(term)) ||
      d.category.toLowerCase().includes(term)
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-1">Admin Operations & Verification</h1>
          <p className="text-muted">
            Independent audit verification and final lifecycle closure for circular electronics.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem', color: 'var(--danger-color)' }}
        >
          {error}
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${tab === 'AWAITING' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('AWAITING')}
        >
          Awaiting Verification ({awaitingVerification.length})
        </button>
        <button
          className={`btn ${tab === 'VERIFIED' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('VERIFIED')}
        >
          Verified ({verifiedDevices.length})
        </button>
        <button
          className={`btn ${tab === 'CLOSED' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('CLOSED')}
        >
          Closed ({closedDevices.length})
        </button>
        <button
          className={`btn ${tab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('ALL')}
        >
          All Ecosystem Devices ({devices.length})
        </button>
      </div>

      {/* SEARCH */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Filter by Device ID, Brand, Model, Category..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      {currentList.length === 0 ? (
        <div className="card text-muted" style={{ padding: '2.5rem', textAlign: 'center' }}>
          {searchTerm ? 'No devices match your search filter.' : 'No devices found in this verification queue.'}
        </div>
      ) : (
        <div className="grid-2">
          {currentList.map((device) => (
            <div key={device.deviceId} className="card" style={{ borderLeft: device.lifecycleState === 'PROCESSED' ? '4px solid #f59e0b' : device.lifecycleState === 'VERIFIED' ? '4px solid #3b82f6' : device.lifecycleState === 'CLOSED' ? '4px solid #10b981' : '1px solid var(--border-color)' }}>
              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                <h3 className="heading-3" style={{ margin: 0 }}>
                  {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
                </h3>
                <span
                  className={`badge ${device.lifecycleState === 'VERIFIED' || device.lifecycleState === 'CLOSED' ? 'badge-success' : device.lifecycleState === 'PROCESSED' ? 'badge-warning' : 'badge-neutral'}`}
                >
                  {device.lifecycleState.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                ID: <code>{device.deviceId}</code><br/>
                Category: {device.category} | Condition: {device.condition}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Link
                  to={`/admin/devices/${device.deviceId}`}
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'center', padding: '0.5rem' }}
                >
                  {device.lifecycleState === 'PROCESSED' ? 'Review & Verify Device →' : 'View Audit Trail →'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
