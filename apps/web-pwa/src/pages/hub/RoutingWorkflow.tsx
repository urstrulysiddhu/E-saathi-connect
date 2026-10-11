import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { routingApi } from '../../api/routing';
import { commercialApi } from '../../api/commercial';
import { custodyApi } from '../../api/custody';
import { Device, EligibilityResult } from '@e-saathi/core';

interface UIOption extends EligibilityResult {
  applicableOffer?: {
    offerId: string;
    currency: string;
    amount: number;
    validUntil: string;
  };
}

export const RoutingWorkflow: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [options, setOptions] = useState<{ results: UIOption[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Proposal Form State
  const [selectedOption, setSelectedOption] = useState<UIOption | null>(null);
  const [agreedAmount, setAgreedAmount] = useState<number>(0);
  const [fees, setFees] = useState<number>(0);
  const [itemizedTerms, setItemizedTerms] = useState('');

  useEffect(() => {
    if (!deviceId) return;

    Promise.all([devicesApi.get(deviceId), routingApi.getOptions(deviceId)])
      .then(([d, opts]) => {
        setDevice(d);
        setOptions(opts as unknown as { results: UIOption[] }); // Type mapping
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const handleRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !selectedOption || !device) return;
    setActionLoading(true);
    setError('');

    try {
      // 1. Create the formal Commercial Proposal targeting the destination's organization
      const targetOrgId = selectedOption.organizationId || selectedOption.destinationId;
      await commercialApi.proposeTransaction({
        deviceId,
        destinationOrganizationId: targetOrgId,
        agreedAmount,
        fees,
        netPayable: agreedAmount - fees,
        currency: 'INR', // Indian Rupee
        itemizedTerms
      });

      // 2. Create the formal Routing Decision record
      await routingApi.createDecision(deviceId, selectedOption.destinationId);

      // 3. Fire ROUTING_CONFIRMED custody transition — advances device ASSESSED → ROUTED
      await custodyApi.transition(deviceId, 'ROUTING_CONFIRMED', device.version, {
        notes: `Routed to ${selectedOption.destinationName || selectedOption.destinationId} via authorized network`,
        metadata: {
          selectedDestinationId: selectedOption.destinationId,
          destinationOrgId: targetOrgId,
          commercialAmountINR: agreedAmount,
        },
      });

      navigate('/hub');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create commercial proposal & routing decision.');
    } finally {
      setActionLoading(false);
    }
  };


  const openProposalForm = (option: UIOption) => {
    setSelectedOption(option);
    setAgreedAmount(option.applicableOffer?.amount || 0);
    setFees(0);
    setItemizedTerms('Pending agreement');
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Evaluating Eligibility Engine...
      </div>
    );
  if (!device || !options) return <div>Data not found</div>;

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-outline" onClick={() => navigate('/hub')} style={{ marginBottom: '1rem' }}>
          ← Back to Hub Dashboard
        </button>
        <h1 className="heading-1">Downstream Destination Routing</h1>
        <p className="text-muted">
          Select an authorized downstream recycler or refurbisher for Device <code>{deviceId}</code>.
        </p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem', color: 'var(--danger-color)' }}>
          {error}
        </div>
      )}

      {selectedOption && (
        <div className="card" style={{ marginBottom: '2rem', border: '2px solid var(--primary-color)', background: 'var(--card-bg, #ffffff)' }}>
          <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
            <h2 className="heading-2" style={{ margin: 0 }}>Commercial Proposal & Routing</h2>
            <span className="badge badge-primary">{selectedOption.destinationName || selectedOption.destinationId}</span>
          </div>
          <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            Enter the commercial terms for transferring to <strong>{selectedOption.destinationName || selectedOption.destinationId}</strong> (Org: <code>{selectedOption.organizationId || 'N/A'}</code>). The receiving party must explicitly accept these terms before settlement.
          </p>
          <form onSubmit={handleRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="grid-2">
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Agreed Amount (Gross INR / ₹)</label>
                <input type="number" step="0.01" className="form-control" value={agreedAmount} onChange={e => setAgreedAmount(Number(e.target.value))} required />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Deductions / Logistics Fees (INR / ₹)</label>
                <input type="number" step="0.01" className="form-control" value={fees} onChange={e => setFees(Number(e.target.value))} required />
              </div>
            </div>
            
            <div style={{ padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}>
              <strong>Net Payable to Hub:</strong>
              <strong style={{ color: 'var(--primary-color)' }}>₹{(agreedAmount - fees).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>

            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Itemized Commercial Terms</label>
              <textarea className="form-control" value={itemizedTerms} onChange={e => setItemizedTerms(e.target.value)} rows={2} placeholder="E.g., Payment on verified receipt and functional assay" />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedOption(null)} disabled={actionLoading}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                {actionLoading ? 'Proposing...' : 'Submit Proposal & Route Device'}
              </button>
            </div>
          </form>
        </div>
      )}

      <h2 className="heading-2" style={{ marginBottom: '1rem' }}>Authorized Network Destinations</h2>
      {options.results.length === 0 ? (
        <div className="status-empty card" style={{ padding: '2rem', textAlign: 'center' }}>
          No eligible destinations found in the authorized downstream network.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {options.results.map((opt, i) => (
            <div key={i} className="card" style={{ opacity: opt.eligible ? 1 : 0.7, border: opt.eligible ? '1px solid var(--border-color)' : '1px dashed var(--border-color)' }}>
              <div className="flex-between" style={{ marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 className="heading-3" style={{ margin: 0, display: 'inline', marginRight: '0.5rem' }}>
                    {opt.destinationName || `Destination ${opt.destinationId.slice(-6)}`}
                  </h3>
                  {opt.destinationType && (
                    <span className="badge badge-neutral" style={{ marginRight: '0.5rem' }}>
                      {opt.destinationType}
                    </span>
                  )}
                  {opt.organizationId && (
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                      Org: {opt.organizationId}
                    </span>
                  )}
                </div>
                <div>
                  {opt.eligible ? (
                    <span className="badge badge-success">✓ Eligible</span>
                  ) : (
                    <span className="badge badge-danger">✗ Ineligible</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                <div>
                  <span className="text-muted">Licence Ref: </span>
                  <code>{opt.authorizationReference || 'AUTH-STD-2025'}</code>
                </div>
                <div>
                  <span className="text-muted">Legal Authorization: </span>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    {opt.authorizationStatus || 'ACTIVE'}
                  </span>
                </div>
              </div>

              {opt.reasons && opt.reasons.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: opt.eligible ? 'var(--text-muted)' : 'var(--danger-color)', marginBottom: '0.5rem' }}>
                  {opt.reasons.join(', ')}
                </div>
              )}
              
              {opt.applicableOffer && opt.eligible && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, color: '#166534' }}>
                    Applicable Commercial Offer: {opt.applicableOffer.currency} {opt.applicableOffer.amount}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Valid until {new Date(opt.applicableOffer.validUntil).toLocaleDateString()}
                  </div>
                </div>
              )}

              {opt.eligible && (!selectedOption || selectedOption.destinationId !== opt.destinationId) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading || selectedOption !== null}
                    onClick={() => openProposalForm(opt)}
                  >
                    Select & Propose Terms
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

