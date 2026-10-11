import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { Device } from '@e-saathi/core';
import { calculateIndicativeValuation } from '../../utils/valuation';

export const HubInventory: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterState, setFilterState] = useState<string>('ALL');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await devicesApi.list();
        const items = res?.items || [];
        setDevices(items);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading Hub inventory...
      </div>
    );

  const hubStates = ['RECEIVED', 'ASSESSED', 'ROUTED', 'PROCESSING', 'PROCESSED', 'VERIFIED', 'CLOSED'];
  const hubInventory = devices.filter((d) => hubStates.includes(d.lifecycleState));
  const filtered =
    filterState === 'ALL'
      ? hubInventory
      : hubInventory.filter((d) => d.lifecycleState === filterState);

  return (
    <div>
      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="heading-1" style={{ margin: 0 }}>Hub Inventory</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Current custody holdings, assessed hardware, and downstream dispatched inventory.
          </p>
        </div>
        <Link to="/hub" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
          ← Back to Operations Queue
        </Link>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['ALL', 'RECEIVED', 'ASSESSED', 'ROUTED', 'PROCESSING', 'PROCESSED'].map((st) => (
          <button
            key={st}
            className={`btn ${filterState === st ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterState(st)}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
          >
            {st} ({st === 'ALL' ? hubInventory.length : hubInventory.filter((d) => d.lifecycleState === st).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="status-empty">
          <p>No inventory items match the selected filter.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: '1rem' }}>
          {filtered.map((d) => {
            const val = calculateIndicativeValuation(d.category, d.condition, d.brand, d.model);
            return (
              <div key={d.deviceId} className="card">
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {d.brand || d.category.replace(/_/g, ' ')} {d.model || ''}
                  </h3>
                  <span className="badge badge-neutral">{d.lifecycleState.replace(/_/g, ' ')}</span>
                </div>

                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Device ID: {d.deviceId.slice(0, 16)}...
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <div><strong>Category:</strong> {d.category.replace(/_/g, ' ')}</div>
                  <div><strong>Condition:</strong> {d.condition.replace(/_/g, ' ')}</div>
                  <div>
                    <strong>Indicative Valuation:</strong>{' '}
                    <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                      ₹{val.min.toLocaleString('en-IN')} - ₹{val.max.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div><strong>Registered:</strong> {new Date(d.createdAt).toLocaleDateString()}</div>
                </div>

                {d.lifecycleState === 'ASSESSED' && (
                  <Link
                    to={`/hub/routing/${d.deviceId}`}
                    className="btn btn-primary"
                    style={{ width: '100%', textAlign: 'center', display: 'block', fontSize: '0.85rem' }}
                  >
                    Route to Authorized Destination →
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
