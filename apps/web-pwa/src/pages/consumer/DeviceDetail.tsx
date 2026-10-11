import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { evidenceApi } from '../../api/evidence';
import { custodyApi } from '../../api/custody';
import { Device, Evidence, CustodyEvent } from '@e-saathi/core';
import { PickupManager } from './PickupManager';
import { EvidenceViewer } from '../../components/EvidenceViewer';
import { calculateIndicativeValuation } from '../../utils/valuation';

// Five consumer-facing journey stages
const JOURNEY_STAGES = [
  {
    key: 'REGISTERED',
    label: 'Registered',
    icon: '📱',
    description: 'Device identity established on the platform',
    states: ['CREATED'],
  },
  {
    key: 'PICKUP',
    label: 'Pickup',
    icon: '🚚',
    description: 'Scheduled for collection and handed over to collector',
    states: ['HANDED_OVER', 'COLLECTED'],
  },
  {
    key: 'ASSESSMENT',
    label: 'Assessment',
    icon: '🔬',
    description: 'Technical assessment at certified hub facility',
    states: ['RECEIVED', 'ASSESSED', 'ROUTED'],
  },
  {
    key: 'PROCESSING',
    label: 'Processing',
    icon: '♻️',
    description: 'Safe recovery and material processing by authorized destination',
    states: ['PROCESSING', 'PROCESSED'],
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    icon: '✅',
    description: 'Full lifecycle verified and formally closed',
    states: ['VERIFIED', 'CLOSED'],
  },
];

function getStageIndex(lifecycleState: string): number {
  for (let i = 0; i < JOURNEY_STAGES.length; i++) {
    if (JOURNEY_STAGES[i].states.includes(lifecycleState)) return i;
  }
  return 0;
}

function getNextStep(lifecycleState: string): string {
  const nextSteps: Record<string, string> = {
    CREATED: 'Schedule a pickup request below to begin your recycling journey.',
    HANDED_OVER: 'Awaiting collector to confirm receipt and pick up your device.',
    COLLECTED: 'Device is with the collector, being transported to the hub facility.',
    RECEIVED: 'Hub has received your device. Technical assessment in progress.',
    ASSESSED: 'Assessment complete. Hub is selecting a certified downstream recycler.',
    ROUTED: 'Device routed to certified recycler. Awaiting processing confirmation.',
    PROCESSING: 'Certified recycler is safely processing your device for material recovery.',
    PROCESSED: 'Processing complete. Regulatory administrator is conducting final audit.',
    VERIFIED: 'Audit passed. Awaiting formal lifecycle closure.',
    CLOSED: 'Your device has completed its verified circular lifecycle journey.',
  };
  return nextSteps[lifecycleState] || 'Journey in progress.';
}

export const DeviceDetail: React.FC = () => {
  const { deviceId } = useParams();
  const [device, setDevice] = useState<Device | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [custodyEvents, setCustodyEvents] = useState<CustodyEvent[]>([]);
  const [chainVerification, setChainVerification] = useState<{ valid: boolean; chainLength: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  useEffect(() => {
    if (!deviceId) return;
    const load = async () => {
      try {
        const [devResult, evResult, timelineResult, verifyResult] = await Promise.all([
          devicesApi.get(deviceId),
          evidenceApi.listForDevice(deviceId).catch(() => ({ items: [] })),
          custodyApi.getTimeline(deviceId).catch(() => []),
          custodyApi.verifyChain(deviceId).catch(() => null),
        ]);
        setDevice(devResult);
        setEvidenceList(evResult.items || []);
        setCustodyEvents(timelineResult || []);
        setChainVerification(verifyResult);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load device details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [deviceId]);

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading device details...
      </div>
    );
  if (error)
    return (
      <div className="card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
        {error}
      </div>
    );
  if (!device) return <div>Device not found</div>;

  const currentStageIdx = getStageIndex(device.lifecycleState);
  const nextStep = getNextStep(device.lifecycleState);

  // Valuation
  const val = device.indicativeValuation;
  const fallbackVal = calculateIndicativeValuation(device.category, device.condition, device.brand, device.model);
  const hasEstimatedVal = val && val.status === 'ESTIMATED' && val.rangeMin !== undefined && val.rangeMax !== undefined;
  const displayMin = hasEstimatedVal ? val.rangeMin! : fallbackVal.min;
  const displayMax = hasEstimatedVal ? val.rangeMax! : fallbackVal.max;

  const isClosed = device.lifecycleState === 'CLOSED';
  const isVerified = device.lifecycleState === 'VERIFIED' || isClosed;

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <Link
        to="/consumer"
        className="btn btn-outline"
        style={{ marginBottom: '1.5rem', border: 'none', padding: '0.5rem 0' }}
      >
        ← Back to My Devices
      </Link>

      {/* DEVICE IDENTITY CARD */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '0.25rem' }}>
              Device ID: {device.deviceId}
            </div>
            <h1 className="heading-1" style={{ margin: 0 }}>
              {device.brand ? `${device.brand} ${device.model || ''}`.trim() : device.category.replace(/_/g, ' ')}
            </h1>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              {device.category.replace(/_/g, ' ')} · Registered {new Date(device.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <span
            className={`badge ${isClosed ? 'badge-neutral' : isVerified ? 'badge-success' : 'badge-warning'}`}
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.9rem' }}
          >
            {device.lifecycleState.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid-2" style={{ gap: '0.75rem', fontSize: '0.9rem' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.15rem' }}>Declared Condition</div>
            <div style={{ fontWeight: 500 }}>{device.condition.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.15rem' }}>Data Safety</div>
            <div style={{ fontWeight: 500 }}>{device.dataSafetyState.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.15rem' }}>Indicative Valuation (INR)</div>
            <div style={{ fontWeight: 700, color: 'var(--success-color)', fontSize: '1.05rem' }}>
              ₹{displayMin.toLocaleString('en-IN')} – ₹{displayMax.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>
              Transparent market estimate — not a guaranteed buyback price
            </div>
          </div>
          {val?.basis && (
            <div>
              <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.15rem' }}>Valuation Basis</div>
              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>{val.basis}</div>
            </div>
          )}
        </div>
      </div>

      {/* FIVE-STAGE JOURNEY TRACKER */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="heading-2" style={{ marginBottom: '1.25rem' }}>Your Recycling Journey</h2>

        {/* Stage progress bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: '1.5rem', overflowX: 'auto' }}>
          {JOURNEY_STAGES.map((stage, idx) => {
            const isPast = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            const isFuture = idx > currentStageIdx;
            return (
              <div key={stage.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                {/* Connector + circle */}
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: idx === 0 ? 0 : 1, height: '2px', background: isPast || isCurrent ? 'var(--primary-color)' : 'var(--border-color)', transition: 'background 0.3s' }} />
                  <div
                    style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCurrent ? 'var(--primary-color)' : isPast ? 'var(--success-color)' : 'var(--border-color)',
                      color: isFuture ? '#aaa' : '#fff',
                      fontSize: isCurrent ? '1.1rem' : '1rem',
                      border: isCurrent ? '3px solid var(--primary-color)' : 'none',
                      boxShadow: isCurrent ? '0 0 0 4px rgba(16,185,129,0.15)' : 'none',
                      transition: 'all 0.3s',
                    }}
                  >
                    {isPast ? '✓' : stage.icon}
                  </div>
                  <div style={{ flex: idx === JOURNEY_STAGES.length - 1 ? 0 : 1, height: '2px', background: isPast ? 'var(--primary-color)' : 'var(--border-color)', transition: 'background 0.3s' }} />
                </div>
                {/* Label */}
                <div style={{
                  marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? 'var(--primary-color)' : isPast ? 'var(--success-color)' : '#aaa',
                  textAlign: 'center', lineHeight: 1.2,
                }}>
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current stage detail */}
        <div style={{ background: 'var(--bg-color)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.95rem' }}>
            {JOURNEY_STAGES[currentStageIdx].icon} {JOURNEY_STAGES[currentStageIdx].label}: {JOURNEY_STAGES[currentStageIdx].description}
          </div>
          <div className="text-muted" style={{ fontSize: '0.85rem' }}>{nextStep}</div>
        </div>
      </div>

      {/* PICKUP / HANDOVER MANAGER (only relevant when CREATED) */}
      <PickupManager
        deviceId={device.deviceId}
        lifecycleState={device.lifecycleState}
        valuation={{ status: 'ESTIMATED', rangeMin: displayMin, rangeMax: displayMax, currency: 'INR', inputCondition: device.condition }}
      />

      {/* EVIDENCE */}
      <div className="card" style={{ marginBottom: '1.5rem', marginTop: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <h2 className="heading-2" style={{ margin: 0 }}>Proof of Journey</h2>
          <Link
            to={`/consumer/devices/${deviceId}/upload-photo`}
            className="btn btn-primary"
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
          >
            + Add Photo
          </Link>
        </div>
        {evidenceList.length === 0 ? (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>No evidence records yet. Capture a photo to establish a tamper-evident record.</p>
        ) : (
          <EvidenceViewer evidenceList={evidenceList} />
        )}
      </div>

      {/* COLLAPSIBLE AUDIT TRAIL */}
      <div className="card">
        <button
          onClick={() => setShowAuditTrail((v) => !v)}
          style={{
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 0, fontFamily: 'inherit',
          }}
        >
          <h2 className="heading-2" style={{ margin: 0 }}>
            Full Audit Trail & Cryptographic Ledger
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {chainVerification && (
              <span className={`badge ${chainVerification.valid ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                {chainVerification.valid ? `✓ SHA-256 Chain Valid (${chainVerification.chainLength} events)` : '✗ Hash Chain Alert'}
              </span>
            )}
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>{showAuditTrail ? '▲ Hide' : '▼ Show'}</span>
          </div>
        </button>

        {showAuditTrail && (
          <div style={{ marginTop: '1.25rem' }}>
            {custodyEvents.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No custody events recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {custodyEvents.map((evt, i) => (
                  <div
                    key={evt.eventId || i}
                    style={{
                      padding: '0.6rem 0.85rem', background: '#f8fafc',
                      borderRadius: 'var(--radius-sm)', border: '1px solid #e2e8f0', fontSize: '0.8rem',
                    }}
                  >
                    <div className="flex-between">
                      <strong>{evt.eventType.replace(/_/g, ' ')}</strong>
                      <span className="text-muted">{new Date(evt.occurredAt || evt.recordedAt).toLocaleString('en-IN')}</span>
                    </div>
                    {evt.fromActorId && (
                      <div className="text-muted" style={{ marginTop: '0.2rem' }}>
                        Actor: {evt.fromActorId}
                      </div>
                    )}
                    <div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.7rem', marginTop: '0.2rem', wordBreak: 'break-all' }}>
                      Hash: {evt.eventHash?.slice(0, 32)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
