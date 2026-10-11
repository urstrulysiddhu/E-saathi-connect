import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi } from '../../api/requests';
import { Device, PickupRequest } from '@e-saathi/core';
import { calculateIndicativeValuation } from '../../utils/valuation';
import { formatAddress } from '../../utils/address';

interface EnrichedRequest extends PickupRequest {
  deviceDetails?: Device;
}

export const CollectorHome: React.FC = () => {
  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Rejection form state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await requestsApi.list();
      const rawReqs: EnrichedRequest[] = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? (res as unknown as EnrichedRequest[])
        : [];

      setRequests(rawReqs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAccept = async (requestId: string) => {
    try {
      setSubmitting(true);
      await requestsApi.accept(requestId);
      await fetchPending();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectId || !rejectReason.trim()) return;
    try {
      setSubmitting(true);
      await requestsApi.reject(rejectId, { reason: rejectReason.trim() });
      setRejectId(null);
      setRejectReason('');
      await fetchPending();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading assigned pickup requests...
      </div>
    );

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pending = safeRequests.filter((r) => r && r.status === 'PENDING');
  const accepted = safeRequests.filter((r) => r && r.status === 'ACCEPTED');

  return (
    <div>
      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="heading-1" style={{ margin: 0 }}>Collection Requests</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Authorized collector dispatch for e-waste pick-up and custody intake.
          </p>
        </div>
        <Link to="/collector/history" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
          View Collection History →
        </Link>
      </div>

      {error && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}
        >
          {error}
        </div>
      )}

      {/* Inline Rejection Form */}
      {rejectId && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--danger-color)' }}>
          <h3 className="heading-3" style={{ color: 'var(--danger-color)' }}>Reject Collection Request</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            A mandatory reason will be recorded on the audit log for reassignment or escalation.
          </p>
          <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Reason for Rejection *</label>
              <textarea
                className="form-control"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: '100%', minHeight: '70px' }}
                placeholder="E.g. Outside service zone, transport vehicle full, consumer unavailable..."
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-danger" disabled={submitting}>
                {submitting ? 'Recording Rejection...' : 'Confirm Rejection'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRejectId(null)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Pickups Queue */}
      <h2 className="heading-2">Pending Requests ({pending.length})</h2>
      {pending.length === 0 ? (
        <div className="status-empty" style={{ marginBottom: '2.5rem' }}>
          <p>No pending collection requests at this time.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: '2.5rem', gap: '1rem' }}>
          {pending.map((req) => {
            const dev = req.deviceDetails;
            const category = dev?.category || 'ELECTRONIC_DEVICE';
            const condition = dev?.condition || 'WORKING';
            const val = calculateIndicativeValuation(category, condition, dev?.brand, dev?.model);

            return (
              <div key={req.requestId} className="card" style={{ borderTop: '4px solid var(--warning-color)' }}>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {dev?.brand || category.replace(/_/g, ' ')} {dev?.model || ''}
                  </h3>
                  <span className="badge badge-warning">Pending</span>
                </div>

                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Device ID: {req.deviceId ? `${req.deviceId.slice(0, 16)}...` : 'Unknown'}
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px' }}>
                  <div><strong>Category:</strong> {category.replace(/_/g, ' ')}</div>
                  <div><strong>Condition:</strong> {condition.replace(/_/g, ' ')}</div>
                  <div>
                    <strong>Indicative Valuation:</strong>{' '}
                    <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                      ₹{val.min.toLocaleString('en-IN')} - ₹{val.max.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div><strong>Pickup Location:</strong> {formatAddress(req.pickupAddress)}</div>
                  <div>
                    <strong>Scheduled Date:</strong>{' '}
                    {req.pickupDate ? new Date(req.pickupDate).toLocaleDateString() : 'Immediate dispatch'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAccept(req.requestId)}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  >
                    Accept Pickup
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setRejectId(req.requestId);
                      setRejectReason('');
                    }}
                    disabled={submitting}
                    style={{ flex: 1, borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accepted Handovers Queue */}
      <h2 className="heading-2">Accepted Handovers Awaiting Collection ({accepted.length})</h2>
      {accepted.length === 0 ? (
        <div className="status-empty">
          <p>No active accepted handovers.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: '1rem' }}>
          {accepted.map((req) => {
            const dev = req.deviceDetails;
            const category = dev?.category || 'ELECTRONIC_DEVICE';
            const condition = dev?.condition || 'WORKING';
            const val = calculateIndicativeValuation(category, condition, dev?.brand, dev?.model);

            return (
              <div key={req.requestId} className="card" style={{ borderTop: '4px solid var(--success-color)' }}>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {dev?.brand || category.replace(/_/g, ' ')} {dev?.model || ''}
                  </h3>
                  <span className="badge badge-success">Accepted</span>
                </div>

                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Device ID: {req.deviceId ? `${req.deviceId.slice(0, 16)}...` : 'Unknown'}
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px' }}>
                  <div><strong>Pickup Location:</strong> {formatAddress(req.pickupAddress)}</div>
                  <div>
                    <strong>Indicative Valuation:</strong>{' '}
                    <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                      ₹{val.min.toLocaleString('en-IN')} - ₹{val.max.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div><strong>Status:</strong> Ready for Physical Handover Verification</div>
                </div>

                {req.deviceId ? (
                  <Link
                    to={`/collector/handover/${req.deviceId}`}
                    className="btn btn-primary"
                    style={{ width: '100%', textAlign: 'center', display: 'block' }}
                  >
                    Open Handover Verification →
                  </Link>
                ) : (
                  <button className="btn btn-outline" disabled style={{ width: '100%' }}>
                    Missing Device ID
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
