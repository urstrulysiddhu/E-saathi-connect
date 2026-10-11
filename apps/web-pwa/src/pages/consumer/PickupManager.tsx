import React, { useState, useEffect } from 'react';
import { requestsApi } from '../../api/requests';
import { PickupRequest } from '@e-saathi/core';
import { formatAddress } from '../../utils/address';

interface PickupManagerProps {
  deviceId: string;
  lifecycleState: string;
  valuation?: any;
}

export const PickupManager: React.FC<PickupManagerProps> = ({ deviceId, lifecycleState, valuation }) => {
  const [request, setRequest] = useState<PickupRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // form state
  const [showForm, setShowForm] = useState(false);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const res = await requestsApi.list();
      const active = res.items.find(r => r.deviceId === deviceId);
      setRequest(active || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [deviceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !date) return;
    try {
      setSubmitting(true);
      await requestsApi.create({ deviceId, pickupAddress: address, pickupDate: date });
      setShowForm(false);
      await fetchRequest();
    } catch (err: any) {
      setError(err.message || 'Failed to request pickup');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!request) return;
    try {
      setSubmitting(true);
      await requestsApi.escalate(request.requestId);
      await fetchRequest();
    } catch (err: any) {
      setError(err.message || 'Failed to escalate');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading pickup details...</div>;

  return (
    <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--surface-color)' }}>
      <h2 className="heading-2" style={{ marginBottom: '1rem' }}>Collection Request</h2>
      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}

      {request ? (
        <div>
          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>Status:</span>
            <span className={`badge ${request.status === 'PENDING' ? 'badge-neutral' : request.status === 'REJECTED' ? 'badge-danger' : 'badge-success'}`}>
              {request.status}
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            <div className="text-muted">Address:</div>
            <div>{formatAddress(request.pickupAddress)}</div>
            <div className="text-muted" style={{ marginTop: '0.5rem' }}>Requested Date:</div>
            <div>{new Date(request.pickupDate).toLocaleDateString()}</div>
          </div>

          {request.status === 'ACCEPTED' && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '4px' }}>
              <strong>Assigned Collector Org:</strong> {request.assignedCollectorOrganizationId}
            </div>
          )}

          {request.status === 'REJECTED' && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid var(--danger-color)', borderRadius: '4px' }}>
              <strong style={{ color: 'var(--danger-color)' }}>Rejected by Org:</strong> {request.rejectedByOrganizationId}
              <div style={{ marginTop: '0.25rem' }}>Reason: {request.rejectionReason}</div>
              <button 
                onClick={handleEscalate} 
                disabled={submitting}
                className="btn btn-primary" 
                style={{ marginTop: '1rem' }}
              >
                {submitting ? 'Processing...' : 'Escalate / Reassign'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {lifecycleState === 'CREATED' ? (
            !showForm ? (
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                Request Collection
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {valuation && valuation.status === 'ESTIMATED' && (
                  <div style={{ padding: '1rem', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '4px' }}>
                    <strong style={{ color: '#166534', display: 'block', marginBottom: '0.25rem' }}>Indicative Value Range</strong>
                    <span style={{ fontSize: '1.1rem', color: '#15803d' }}>
                      {valuation.currency === 'INR' || !valuation.currency
                        ? `₹${valuation.rangeMin.toLocaleString('en-IN')} - ₹${valuation.rangeMax.toLocaleString('en-IN')}`
                        : `${valuation.rangeMin} - ${valuation.rangeMax} ${valuation.currency}`}
                    </span>
                    <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.25rem', opacity: 0.8 }}>
                      *Estimate based on declared condition ({valuation.inputCondition}). Final offer will be assessed at the Hub.
                    </div>
                  </div>
                )}
                
                {valuation && valuation.status === 'UNAVAILABLE' && (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderLeft: '4px solid #94a3b8', borderRadius: '4px' }}>
                    <strong style={{ color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Estimate Unavailable</strong>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                      A reliable reference price is not available. A final offer will be assessed at the Hub.
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Pickup Address</label>
                  <textarea 
                    className="form-control"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: '100%', minHeight: '60px' }}
                  />
                </div>
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Preferred Date</label>
                  <input 
                    type="date"
                    className="form-control"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={submitting}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
            )
          ) : (
            <div className="text-muted">Device has already been handed over or collected.</div>
          )}
        </>
      )}
    </div>
  );
};
