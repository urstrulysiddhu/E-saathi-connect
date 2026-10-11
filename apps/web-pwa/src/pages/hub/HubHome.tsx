import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { commercialApi } from '../../api/commercial';
import { custodyApi } from '../../api/custody';
import { Device, CommercialTransaction, DeviceCondition } from '@e-saathi/core';
import { calculateIndicativeValuation } from '../../utils/valuation';

export const HubHome: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Assessment form state
  const [assessingDeviceId, setAssessingDeviceId] = useState<string | null>(null);
  const [assessmentCondition, setAssessmentCondition] = useState<DeviceCondition>('WORKING');
  const [assessmentNotes, setAssessmentNotes] = useState('');

  // Commercial Rejection form state
  const [rejectTxId, setRejectTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = () => {
    setLoading(true);
    setError('');
    Promise.all([
      devicesApi.list().catch(() => ({ items: [] })),
      commercialApi.listTransactions().catch(() => ({ items: [] })),
    ])
      .then(([devicesRes, txRes]) => {
        const rawDevices: Device[] = devicesRes?.items || [];
        // Hub acts on devices collected, received, or assessed
        const hubActionable = rawDevices.filter((d: Device) =>
          ['COLLECTED', 'RECEIVED', 'ASSESSED'].includes(d.lifecycleState)
        );
        setDevices(hubActionable);

        const rawTxs: CommercialTransaction[] = txRes?.items || [];
        const pendingTx = rawTxs.filter(
          (tx: CommercialTransaction) => tx.transactionStatus === 'PROPOSED'
        );
        setTransactions(pendingTx);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load Hub operational queue');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReceiptConfirmed = async (device: Device) => {
    setActionLoading(true);
    setError('');
    try {
      await custodyApi.transition(device.deviceId, 'HUB_RECEIPT_CONFIRMED', device.version, {
        notes: 'Physical custody verified and accepted at Central Hub intake dock.',
      });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Receipt confirmation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordAssessment = async (e: React.FormEvent, device: Device) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await custodyApi.transition(device.deviceId, 'ASSESSMENT_RECORDED', device.version, {
        notes: assessmentNotes || `Technical condition assessed: ${assessmentCondition}`,
        metadata: {
          assessedCondition: assessmentCondition,
          assessmentNotes: assessmentNotes || 'Standard intake diagnostic completed',
        },
      });
      setAssessingDeviceId(null);
      setAssessmentNotes('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record assessment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptTx = async (tx: CommercialTransaction) => {
    setActionLoading(true);
    setError('');
    try {
      await commercialApi.acceptTransaction(tx.transactionId, tx.version, tx.agreedAmount);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept commercial transaction');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTxId || !rejectReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await commercialApi.rejectTransaction(rejectTxId, rejectReason.trim());
      setRejectTxId(null);
      setRejectReason('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject commercial transaction');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading Hub operations queue...
      </div>
    );

  return (
    <div>
      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="heading-1" style={{ margin: 0 }}>Hub Operations Queue</h1>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>
            Consolidated intake, technical assessment, commercial proposals, and downstream routing.
          </p>
        </div>
        <Link to="/hub/inventory" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
          View Hub Inventory →
        </Link>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Commercial Rejection Modal/Inline Form */}
      {rejectTxId && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--danger-color)' }}>
          <h3 className="heading-3" style={{ color: 'var(--danger-color)' }}>Reject Commercial Proposal</h3>
          <form onSubmit={handleRejectTx} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Mandatory Rejection Rationale *</label>
              <textarea
                className="form-control"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: '100%', minHeight: '60px' }}
                placeholder="E.g. Discrepancy with declared condition, valuation dispute..."
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRejectTxId(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Commercial Proposals Section */}
      {transactions.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h2 className="heading-2">Commercial Proposals Requiring Acceptance ({transactions.length})</h2>
          <div className="grid-2" style={{ gap: '1rem' }}>
            {transactions.map((tx) => (
              <div key={tx.transactionId} className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>Proposed Commercial Transfer</h3>
                  <span className="badge badge-warning">PROPOSED</span>
                </div>
                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                  Device ID: {tx.deviceId.slice(0, 16)}...
                </div>
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  <div><strong>From Organization:</strong> {tx.sourceOrganizationId}</div>
                  <div><strong>To Organization:</strong> {tx.destinationOrganizationId}</div>
                  <div style={{ marginTop: '0.25rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                    Proposed Net Payable: {tx.currency === 'INR' || !tx.currency ? '₹' : `${tx.currency} `}{(tx.agreedAmount - (tx.fees || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAcceptTx(tx)}
                    disabled={actionLoading}
                    style={{ flex: 1 }}
                  >
                    Accept Terms
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setRejectTxId(tx.transactionId);
                      setRejectReason('');
                    }}
                    disabled={actionLoading}
                    style={{ flex: 1, borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actionable Hardware Queue */}
      <h2 className="heading-2">Actionable Devices ({devices.length})</h2>
      {devices.length === 0 ? (
        <div className="status-empty">
          <p>No devices currently awaiting intake receipt or assessment at this Hub.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: '1rem' }}>
          {devices.map((device) => {
            const val = calculateIndicativeValuation(
              device.category,
              device.condition,
              device.brand,
              device.model
            );
            const isAssessing = assessingDeviceId === device.deviceId;

            return (
              <div key={device.deviceId} className="card" style={{ borderTop: '4px solid var(--primary-color)' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {device.brand || device.category.replace(/_/g, ' ')} {device.model || ''}
                  </h3>
                  <span className="badge badge-neutral">{device.lifecycleState.replace(/_/g, ' ')}</span>
                </div>

                <div className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Device ID: {device.deviceId.slice(0, 16)}...
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: 1.6, background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <div><strong>Category:</strong> {device.category.replace(/_/g, ' ')}</div>
                  <div><strong>Current Condition:</strong> {device.condition.replace(/_/g, ' ')}</div>
                  <div>
                    <strong>Indicative Valuation:</strong>{' '}
                    <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                      ₹{val.min.toLocaleString('en-IN')} - ₹{val.max.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div><strong>Custody State:</strong> {device.lifecycleState}</div>
                </div>

                {/* State-specific operations */}
                {device.lifecycleState === 'COLLECTED' && (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => handleReceiptConfirmed(device)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Recording Receipt...' : 'Confirm Intake Physical Receipt'}
                  </button>
                )}

                {device.lifecycleState === 'RECEIVED' && !isAssessing && (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setAssessingDeviceId(device.deviceId);
                      setAssessmentCondition(device.condition || 'WORKING');
                      setAssessmentNotes('');
                    }}
                    disabled={actionLoading}
                  >
                    Conduct Technical Assessment →
                  </button>
                )}

                {/* Inline Assessment Form */}
                {device.lifecycleState === 'RECEIVED' && isAssessing && (
                  <form
                    onSubmit={(e) => handleRecordAssessment(e, device)}
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Assessed Condition *</label>
                      <select
                        className="form-control"
                        value={assessmentCondition}
                        onChange={(e) => setAssessmentCondition(e.target.value as DeviceCondition)}
                        required
                      >
                        <option value="WORKING">WORKING (Fully Functional)</option>
                        <option value="PARTIALLY_WORKING">PARTIALLY WORKING (Minor defect)</option>
                        <option value="NOT_WORKING">NOT WORKING (Faulty components)</option>
                        <option value="DAMAGED">DAMAGED (Physical damage)</option>
                        <option value="FOR_PARTS">FOR PARTS (Salvage only)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Diagnostic Notes</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Battery degraded, screen intact, boots properly"
                        value={assessmentNotes}
                        onChange={(e) => setAssessmentNotes(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ flex: 1 }}>
                        {actionLoading ? 'Recording...' : 'Record Assessment'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setAssessingDeviceId(null)}
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {device.lifecycleState === 'ASSESSED' && (
                  <Link
                    to={`/hub/routing/${device.deviceId}`}
                    className="btn btn-primary"
                    style={{ width: '100%', textAlign: 'center', display: 'block' }}
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
