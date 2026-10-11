import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { Device } from '@e-saathi/core';
import { EvidenceViewer } from '../../components/EvidenceViewer';

export const DestinationCompleted: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    devicesApi.list()
      .then((res) => {
        const completed = (res.items || []).filter((d: Device) =>
          ['PROCESSED', 'VERIFIED', 'CLOSED'].includes(d.lifecycleState)
        );
        setDevices(completed);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = devices.filter(d => 
    d.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.brand && d.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={() => window.history.back()} className="btn btn-outline" style={{ marginBottom: '0.75rem' }}>
            ← Back to Destination
          </button>
          <h1 className="heading-1">Completed Processing Records</h1>
          <p className="text-muted">
            Audit history of devices processed, recycled, or refurbished at this facility.
          </p>
        </div>
        <div>
          <Link to="/destination" className="btn btn-primary">
            Active Processing Queue
          </Link>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Search by Device ID, brand or category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '400px' }}
        />
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '200px' }}>
          Loading completed records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-muted" style={{ padding: '2.5rem', textAlign: 'center' }}>
          {searchTerm ? 'No matching completed devices found.' : 'No completed devices recorded yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((device) => (
            <div key={device.deviceId} className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="flex-between" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 className="heading-3" style={{ margin: 0, display: 'inline', marginRight: '0.5rem' }}>
                    {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
                  </h3>
                  <span className={`badge ${device.lifecycleState === 'VERIFIED' || device.lifecycleState === 'CLOSED' ? 'badge-success' : 'badge-neutral'}`}>
                    {device.lifecycleState}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Completed: {new Date(device.updatedAt).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                <div><strong>Persistent Device ID:</strong> <code>{device.deviceId}</code></div>
                <div><strong>Category:</strong> {device.category}</div>
                <div><strong>Initial Condition:</strong> {device.condition}</div>
                {device.serialNumber && <div><strong>Serial/IMEI:</strong> <code>{device.serialNumber}</code></div>}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setSelectedDevice(selectedDevice?.deviceId === device.deviceId ? null : device)}
                >
                  {selectedDevice?.deviceId === device.deviceId ? 'Hide Evidence & Proof' : 'View Certified Evidence'}
                </button>
              </div>

              {selectedDevice?.deviceId === device.deviceId && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                  <h4 className="heading-4" style={{ marginBottom: '0.75rem' }}>Attached Evidence Records</h4>
                  <EvidenceViewer deviceId={device.deviceId} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
