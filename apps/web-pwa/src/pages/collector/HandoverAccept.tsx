import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { custodyApi } from '../../api/custody';
import { evidenceApi } from '../../api/evidence';
import { Device } from '@e-saathi/core';
import { CameraCapture } from '../../components/CameraCapture';

export const HandoverAccept: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [photoReady, setPhotoReady] = useState(false);
  const [capturedEvidenceId, setCapturedEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    devicesApi
      .get(deviceId)
      .then((d) => setDevice(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  const handlePhotoCapture = async (file: File) => {
    if (!deviceId) return;
    setUploadingPhoto(true);
    setError('');

    try {
      const intentResult = await evidenceApi.uploadIntent(
        deviceId,
        'HANDOVER_PHOTO',
        file.type,
        file.size
      );

      const uploadResponse = await fetch(intentResult.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error('S3 upload failed');
      }

      await evidenceApi.complete(intentResult.evidenceId);
      setCapturedEvidenceId(intentResult.evidenceId);
      setPhotoReady(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAcceptCustody = async () => {
    if (!deviceId || !device) return;
    setActionLoading(true);
    setError('');

    try {
      // Transition custody through authoritative API with verified evidence linkage
      await custodyApi.transition(deviceId, 'HANDOVER_ACCEPTED', device.version, {
        notes: 'Handover verification completed and photo evidence secured',
        metadata: {
          evidenceId: capturedEvidenceId,
          verifiedAt: new Date().toISOString(),
        },
      });

      navigate('/collector');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Custody not confirmed. Retry when connection is restored.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex-center" style={{ height: '200px' }}>
        Loading device details...
      </div>
    );

  if (!device) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
        <h2 className="heading-2" style={{ color: 'var(--danger-color)', marginBottom: '0.75rem' }}>Device Record Unavailable</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          {error || `Device ${deviceId} could not be retrieved from the ledger.`}
        </p>
        <button className="btn btn-outline" onClick={() => navigate('/collector')}>
          ← Return to Collector Dashboard
        </button>
      </div>
    );
  }

  const val = device.indicativeValuation;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="heading-1">Handover Verification</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Verify physical device identity, condition, and capture handover proof before accepting custody.
      </p>

      {error && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}
        >
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="heading-3">Device Identity</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <div>
            <div className="text-muted">Device ID</div>
            <div style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.85rem' }}>{device.deviceId}</div>
          </div>
          <div>
            <div className="text-muted">Type / Category</div>
            <div style={{ fontWeight: 500 }}>{device.category.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <div className="text-muted">Brand / Model</div>
            <div style={{ fontWeight: 500 }}>
              {device.brand} {device.model}
            </div>
          </div>
          <div>
            <div className="text-muted">Declared Condition</div>
            <div style={{ fontWeight: 500 }}>{device.condition.replace(/_/g, ' ')}</div>
          </div>
          {val && (
            <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Indicative Market Valuation</div>
              <div style={{ color: 'var(--success-color)', fontWeight: 600 }}>
                ₹{val.rangeMin?.toLocaleString('en-IN')} - ₹{val.rangeMax?.toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="heading-3" style={{ marginBottom: '1rem' }}>
          Handover Evidence
        </h3>
        {uploadingPhoto && <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Uploading and securing photo proof...</p>}
        {!photoReady ? (
          <CameraCapture onCapture={handlePhotoCapture} maxSizeBytes={5 * 1024 * 1024} />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--success-color)',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>✓</span> Photo securely attached
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-outline"
          onClick={() => navigate('/collector')}
          disabled={actionLoading}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleAcceptCustody}
          disabled={!photoReady || actionLoading}
        >
          {actionLoading ? 'Confirming...' : 'Accept Custody'}
        </button>
      </div>
    </div>
  );
};
