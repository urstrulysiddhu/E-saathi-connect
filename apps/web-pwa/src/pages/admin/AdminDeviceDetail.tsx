import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { custodyApi } from '../../api/custody';
import { Device, CustodyEvent } from '@e-saathi/core';
import { EvidenceViewer } from '../../components/EvidenceViewer';

export const AdminDeviceDetail: React.FC = () => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [timeline, setTimeline] = useState<CustodyEvent[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('All custody transitions and digital evidence verified.');

  const loadData = async () => {
    if (!deviceId) return;
    try {
      const [devResult, timeResult, chainResult] = await Promise.all([
        devicesApi.get(deviceId),
        custodyApi.getTimeline(deviceId).catch(() => [] as CustodyEvent[]),
        custodyApi.verifyChain(deviceId).catch(() => ({ valid: false, chainLength: 0, checkedAt: '' }))
      ]);

      setDevice(devResult);
      setTimeline(Array.isArray(timeResult) ? timeResult : []);
      setChainValid(typeof chainResult?.valid === 'boolean' ? chainResult.valid : null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load device details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [deviceId]);

  const handleVerify = async () => {
    if (!device) return;
    setActionLoading(true);
    setError('');
    try {
      const res: any = await custodyApi.transition(device.deviceId, 'VERIFICATION_COMPLETED', device.version, {
        notes: verificationNotes || 'Administrative audit integrity check passed',
        metadata: { auditPassed: true, verifiedAt: new Date().toISOString() }
      });
      if (res && res.device) {
        setDevice(res.device);
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!device) return;
    setActionLoading(true);
    setError('');
    try {
      const res: any = await custodyApi.transition(device.deviceId, 'CLOSURE_CONFIRMED', device.version, {
        notes: 'Final lifecycle closure confirmed by regulatory administrator',
        metadata: { journeyClosed: true, closedAt: new Date().toISOString() }
      });
      if (res && res.device) {
        setDevice(res.device);
      }
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Closure failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading administrative review...
      </div>
    );
  if (error && !device)
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', color: 'var(--danger-color)' }}>
        {error}
      </div>
    );
  if (!device) return <div>Device not found</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <Link
        to="/admin"
        className="btn btn-outline"
        style={{ marginBottom: '1.5rem', display: 'inline-block' }}
      >
        ← Back to Admin Queue
      </Link>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>
          {error}
        </div>
      )}

      {/* TOP HEADER CARD */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="text-muted" style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
              Persistent Device ID: <code>{device.deviceId}</code>
            </div>
            <h1 className="heading-1" style={{ margin: 0 }}>
              {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <span
              className={`badge ${device.lifecycleState === 'CLOSED' ? 'badge-neutral' : device.lifecycleState === 'VERIFIED' ? 'badge-success' : 'badge-warning'}`}
              style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}
            >
              {device.lifecycleState.replace(/_/g, ' ')}
            </span>
            {chainValid !== null && (
              <span className={`badge ${chainValid ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                {chainValid ? '✓ SHA-256 Custody Chain Valid' : '✗ Hash Chain Alert'}
              </span>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Category & Condition</div>
            <div style={{ fontWeight: 500 }}>{device.category} — {device.condition}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Data Safety Status</div>
            <div style={{ fontWeight: 500 }}>{device.dataSafetyState.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Registered Date</div>
            <div style={{ fontWeight: 500 }}>{new Date(device.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Registered By Actor</div>
            <div style={{ fontWeight: 500 }}><code>{device.registeredByActorId || 'Consumer'}</code></div>
          </div>
        </div>

        {/* VERIFICATION ACTIONS */}
        {device.lifecycleState === 'PROCESSED' && (
          <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h3 className="heading-3" style={{ marginBottom: '0.5rem' }}>Administrative Journey Verification</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Confirm that the physical device has been processed by an authorized destination, required evidence is logged, and the custody chain is intact.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label className="text-muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>Audit / Verification Notes</label>
              <input
                type="text"
                className="form-control"
                value={verificationNotes}
                onChange={e => setVerificationNotes(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleVerify}
              disabled={actionLoading}
            >
              {actionLoading ? 'Verifying...' : '✓ Verify Integrity & Approve Processing'}
            </button>
          </div>
        )}

        {device.lifecycleState === 'VERIFIED' && (
          <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0' }}>
            <h3 className="heading-3" style={{ marginBottom: '0.5rem', color: '#166534' }}>Final Lifecycle Closure</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Verification completed. Confirm final closure to formally seal the device journey and provide final confirmation to the consumer.
            </p>
            <button
              className="btn btn-primary"
              style={{ backgroundColor: '#166534', borderColor: '#166534' }}
              onClick={handleClose}
              disabled={actionLoading}
            >
              {actionLoading ? 'Closing...' : 'Close Device Journey'}
            </button>
          </div>
        )}

        {device.lifecycleState === 'CLOSED' && (
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: '#475569' }}>
            <strong>Journey Closed:</strong> This electronic device lifecycle is closed, fully audited, and permanently sealed.
          </div>
        )}
      </div>

      {/* PROOF OF JOURNEY - EVIDENCE VIEWER */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 className="heading-2" style={{ marginBottom: '0.5rem' }}>Proof of Journey & Digital Evidence</h2>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Presigned secure retrieval of photographic evidence recorded by Consumer, Collector, Hub, and Destination.
        </p>
        <EvidenceViewer deviceId={device.deviceId} />
      </div>

      {/* CRYPTOGRAPHIC CUSTODY TIMELINE */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h2 className="heading-2" style={{ margin: 0 }}>Custody Ledger & Transition History</h2>
          <span className="badge badge-primary">{timeline.length} Transitions</span>
        </div>

        {timeline.length === 0 ? (
          <div className="text-muted" style={{ padding: '1.5rem', textAlign: 'center' }}>
            No custody events recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {timeline.map((event, idx) => (
              <div
                key={event.eventId || idx}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '1rem',
                  background: idx === timeline.length - 1 ? '#f8fafc' : '#ffffff'
                }}
              >
                <div className="flex-between" style={{ marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                    {event.eventType.replace(/_/g, ' ')}
                  </div>
                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                    {new Date(event.occurredAt || event.recordedAt).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>
                  <div><strong>Actor:</strong> <code>{event.recordedByActorId || event.fromActorId || 'N/A'}</code></div>
                  <div><strong>Org:</strong> <code>{event.recordedByOrganizationId || event.fromOrganizationId || 'N/A'}</code></div>
                  {event.previousLifecycleState && <div><strong>Transition:</strong> {event.previousLifecycleState} → {event.newLifecycleState}</div>}
                </div>

                {event.metadata?.notes ? (
                  <div style={{ fontSize: '0.8rem', color: '#334155', marginBottom: '0.4rem', background: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <em>Notes: {String(event.metadata.notes)}</em>
                  </div>
                ) : null}

                {event.eventHash && (
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', wordBreak: 'break-all' }}>
                    SHA-256 Hash: <code>{event.eventHash}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
