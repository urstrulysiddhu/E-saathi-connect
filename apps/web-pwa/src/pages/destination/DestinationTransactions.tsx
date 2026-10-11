import React, { useState, useEffect } from 'react';
import { commercialApi } from '../../api/commercial';
import { CommercialTransaction } from '@e-saathi/core';

export const DestinationTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<CommercialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = () => {
    setLoading(true);
    commercialApi.listTransactions()
    .then((txRes) => {
      setTransactions(txRes.items || []);
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
      setError(err instanceof Error ? err.message : 'Accept failed');
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
      setError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading queue...
      </div>
    );

  const pending = transactions.filter(tx => tx.transactionStatus === 'PROPOSED');
  const history = transactions.filter(tx => tx.transactionStatus !== 'PROPOSED');

  return (
    <div>
      <h1 className="heading-1">Destination Transactions</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Commercial agreements and financial settlements.
      </p>

      {error && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}
        >
          {error}
        </div>
      )}

      {/* REJECT FORM */}
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
                placeholder="E.g., Financial mismatch, capacity full"
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

      {pending.length === 0 ? (
        <div className="status-empty" style={{ marginBottom: '2rem' }}>
          <p>No pending agreements.</p>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="heading-2">Pending Commercial Agreements</h2>
          <div className="grid-2">
            {pending.map((tx) => (
              <div key={tx.transactionId} className="card" style={{ border: '2px solid var(--primary-color)' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>Proposed Agreement</h3>
                  <span className="badge badge-neutral">PROPOSED</span>
                </div>
                <div className="text-muted" style={{ marginBottom: '1rem' }}>
                  Device ID: <code>{tx.deviceId}</code><br/>
                  From Org: <code>{tx.sourceOrganizationId}</code>
                </div>
                
                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '4px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between"><span>Gross Amount:</span> <span>{tx.currency} {tx.agreedAmount}</span></div>
                  <div className="flex-between"><span>Fees:</span> <span>- {tx.currency} {tx.fees}</span></div>
                  <div className="flex-between" style={{ fontWeight: 'bold', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', color: 'var(--primary-color)' }}>
                    <span>Net Payable:</span> <span>{tx.currency} {tx.netPayable}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
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
                    Accept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 className="heading-2">Transaction History</h2>
          <div className="grid-2">
            {history.map((tx) => (
              <div key={tx.transactionId} className="card">
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 className="heading-3" style={{ margin: 0 }}>Agreement</h3>
                  <span className={`badge ${tx.transactionStatus === 'ACCEPTED' || tx.transactionStatus === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
                    {tx.transactionStatus}
                  </span>
                </div>
                <div className="text-muted" style={{ marginBottom: '1rem' }}>
                  Device ID: {tx.deviceId.slice(0, 8)}...<br/>
                  From Org: {tx.sourceOrganizationId}
                </div>
                
                <div style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '4px' }}>
                  <div className="flex-between"><span>Gross Amount:</span> <span>{tx.currency} {tx.agreedAmount}</span></div>
                  <div className="flex-between"><span>Fees:</span> <span>- {tx.currency} {tx.fees}</span></div>
                  <div className="flex-between" style={{ fontWeight: 'bold', marginTop: '0.5rem', borderTop: '1px solid #ccc', paddingTop: '0.5rem' }}>
                    <span>Net Payable:</span> <span>{tx.currency} {tx.netPayable}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
