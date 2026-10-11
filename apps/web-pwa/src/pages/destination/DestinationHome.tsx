import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { custodyApi } from '../../api/custody';
import { commercialApi } from '../../api/commercial';
import { Device, CommercialTransaction } from '@e-saathi/core';

export const DestinationHome: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      devicesApi.list(),
      commercialApi.listTransactions()
    ])
    .then(([devicesRes, txRes]) => {
      const allTx = txRes.items || [];
      const pendingTx = allTx.filter((tx: CommercialTransaction) => tx.transactionStatus === 'PROPOSED');
      setTransactions(pendingTx);

      const allDevices = devicesRes.items || [];
      // Destination sees devices that are ROUTED, PROCESSING, or PROCESSED
      const destDevices = allDevices.filter((d: Device) => 
        ['ROUTED', 'PROCESSING', 'PROCESSED', 'VERIFIED', 'CLOSED'].includes(d.lifecycleState)
      );
      setDevices(destDevices);
    })
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcceptTx = async (tx: CommercialTransaction) => {
    setActionLoading(true);
    setError('');
    try {
      await commercialApi.acceptTransaction(tx.transactionId, tx.version, tx.agreedAmount);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Accepting transaction failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTxId || !rejectReason.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await commercialApi.rejectTransaction(rejectingTxId, rejectReason.trim());
      setRejectingTxId(null);
      setRejectReason('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Rejecting transaction failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartProcessing = async (device: Device) => {
    setActionLoading(true);
    setError('');
    try {
      await custodyApi.transition(device.deviceId, 'PROCESSING_STARTED', device.version, {
        notes: 'Destination acknowledged physical receipt and initiated processing'
      });
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Processing start failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading destination queue...
      </div>
    );

  const pendingReceiptDevices = devices.filter(d => d.lifecycleState === 'ROUTED');
  const activeProcessingDevices = devices.filter(d => d.lifecycleState === 'PROCESSING');
  const completedDevices = devices.filter(d => ['PROCESSED', 'VERIFIED', 'CLOSED'].includes(d.lifecycleState));

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-1">Destination Facility Operations</h1>
          <p className="text-muted">
            Manage incoming commercial proposals, acknowledge physical receipt, and complete certified processing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/destination/transactions" className="btn btn-outline">
            All Transactions
          </Link>
          <Link to="/destination/completed" className="btn btn-outline">
            Completed Records
          </Link>
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

      {/* REJECT MODAL */}
      {rejectingTxId && (
        <div className="card" style={{ border: '2px solid var(--danger-color)', marginBottom: '1.5rem' }}>
          <h3 className="heading-3" style={{ color: 'var(--danger-color)' }}>Reject Commercial Proposal</h3>
          <form onSubmit={handleRejectTx}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Reason for Rejection</label>
              <textarea
                className="form-control"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="E.g., Price mismatch, device out of facility scope"
                required
                rows={2}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setRejectingTxId(null)}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PENDING COMMERCIAL PROPOSALS */}
      {transactions.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h2 className="heading-2" style={{ margin: 0 }}>Incoming Commercial Proposals ({transactions.length})</h2>
            <span className="badge badge-warning">Action Required</span>
          </div>
          <div className="grid-2">
            {transactions.map((tx) => (
              <div key={tx.transactionId} className="card" style={{ border: '2px solid var(--primary-color)', position: 'relative' }}>
                <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>Proposal for Device</h3>
                  <span className="badge badge-primary">PROPOSED</span>
                </div>
                <div className="text-muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  <strong>Device:</strong> <code>{tx.deviceId}</code><br/>
                  <strong>From Org:</strong> <code>{tx.sourceOrganizationId}</code>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between"><span>Agreed Gross:</span> <span>{tx.currency} {Number(tx.agreedAmount).toFixed(2)}</span></div>
                  <div className="flex-between"><span>Deductions / Fees:</span> <span>- {tx.currency} {Number(tx.fees).toFixed(2)}</span></div>
                  <div className="flex-between" style={{ fontWeight: 'bold', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', color: 'var(--primary-color)' }}>
                    <span>Net Payable:</span> <span>{tx.currency} {Number(tx.netPayable).toFixed(2)}</span>
                  </div>
                  {tx.itemizedTerms && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                      <em>Terms: {tx.itemizedTerms}</em>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                    onClick={() => { setRejectingTxId(tx.transactionId); setRejectReason(''); }}
                    disabled={actionLoading}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => handleAcceptTx(tx)}
                    disabled={actionLoading}
                  >
                    Accept Agreement
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEVICES AWAITING RECEIPT */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 className="heading-2">Inbound Devices (Awaiting Receipt) ({pendingReceiptDevices.length})</h2>
        {pendingReceiptDevices.length === 0 ? (
          <div className="card text-muted" style={{ padding: '1.25rem', textAlign: 'center' }}>
            No inbound devices currently awaiting physical receipt acknowledgment.
          </div>
        ) : (
          <div className="grid-2">
            {pendingReceiptDevices.map((device) => (
              <div key={device.deviceId} className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
                  </h3>
                  <span className="badge badge-warning">ROUTED</span>
                </div>
                <div className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ID: <code>{device.deviceId}</code><br/>
                  Category: {device.category} | Condition: {device.condition}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleStartProcessing(device)}
                  disabled={actionLoading}
                >
                  Acknowledge Physical Receipt & Start Processing
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIVE PROCESSING */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 className="heading-2">Active Processing Floor ({activeProcessingDevices.length})</h2>
        {activeProcessingDevices.length === 0 ? (
          <div className="card text-muted" style={{ padding: '1.25rem', textAlign: 'center' }}>
            No devices currently being processed.
          </div>
        ) : (
          <div className="grid-2">
            {activeProcessingDevices.map((device) => (
              <div key={device.deviceId} className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
                  </h3>
                  <span className="badge badge-primary">PROCESSING</span>
                </div>
                <div className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                  ID: <code>{device.deviceId}</code><br/>
                  Category: {device.category} | Condition: {device.condition}
                </div>
                <Link
                  to={`/destination/processing/${device.deviceId}`}
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'center', display: 'block' }}
                >
                  Upload Evidence & Complete Processing →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPLETED RECORDS */}
      <div>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h2 className="heading-2" style={{ margin: 0 }}>Processed & Verified Devices ({completedDevices.length})</h2>
          <Link to="/destination/completed" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
            View Full Completed Queue →
          </Link>
        </div>
        {completedDevices.length === 0 ? (
          <div className="card text-muted" style={{ padding: '1.25rem', textAlign: 'center' }}>
            No completed devices recorded yet.
          </div>
        ) : (
          <div className="grid-2">
            {completedDevices.slice(0, 4).map((device) => (
              <div key={device.deviceId} className="card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>
                    {device.brand ? `${device.brand} ${device.model || ''}` : device.category.replace('_', ' ')}
                  </h3>
                  <span className={`badge ${device.lifecycleState === 'VERIFIED' || device.lifecycleState === 'CLOSED' ? 'badge-success' : 'badge-neutral'}`}>
                    {device.lifecycleState}
                  </span>
                </div>
                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                  ID: <code>{device.deviceId}</code><br/>
                  Updated: {new Date(device.updatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
