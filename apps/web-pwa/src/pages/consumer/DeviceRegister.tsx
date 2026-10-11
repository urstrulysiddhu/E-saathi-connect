import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { devicesApi } from '../../api/devices';
import { DeviceCategory, DeviceCondition, Device } from '@e-saathi/core';
import { calculateIndicativeValuation } from '../../utils/valuation';
import { CameraCapture } from '../../components/CameraCapture';
import { evidenceApi } from '../../api/evidence';

export const DeviceRegister: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [registeredDevice, setRegisteredDevice] = useState<Device | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [evidenceUploaded, setEvidenceUploaded] = useState(false);

  const [formData, setFormData] = useState({
    category: 'MOBILE_PHONE' as DeviceCategory,
    brand: '',
    model: '',
    condition: 'WORKING' as DeviceCondition,
    serialNumber: '',
  });

  const estimate = calculateIndicativeValuation(
    formData.category,
    formData.condition,
    formData.brand,
    formData.model
  );

  const handlePhotoCaptured = (file: File) => {
    setSelectedPhoto(file);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setSelectedPhoto(null);
    setPhotoPreviewUrl(null);
  };

  const uploadDevicePhoto = async (deviceId: string, file: File) => {
    setUploadingPhoto(true);
    try {
      const intentResult = await evidenceApi.uploadIntent(
        deviceId,
        'DEVICE_PHOTO',
        file.type,
        file.size
      );

      const uploadResponse = await fetch(intentResult.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error('S3 byte upload failed');
      }

      await evidenceApi.complete(intentResult.evidenceId);
      setEvidenceUploaded(true);
    } catch (err: unknown) {
      console.warn('Photo upload failed during registration:', err);
      throw err;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let device: Device;
    try {
      device = await devicesApi.create({
        ...formData,
        idempotencyKey: crypto.randomUUID(),
      });
      setRegisteredDevice(device);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register device');
      setLoading(false);
      return;
    }

    if (selectedPhoto) {
      try {
        await uploadDevicePhoto(device.deviceId, selectedPhoto);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? `Device registered successfully, but photo upload failed: ${err.message}. You can retry uploading below.`
            : 'Device registered successfully, but photo upload failed. You can retry uploading below.'
        );
      }
    }

    setLoading(false);
  };

  const handleRetryPhotoUpload = async () => {
    if (!registeredDevice || !selectedPhoto) return;
    setError('');
    try {
      await uploadDevicePhoto(registeredDevice.deviceId, selectedPhoto);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Photo retry failed');
    }
  };

  if (registeredDevice) {
    const val = registeredDevice.indicativeValuation;
    return (
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        <div className="card" style={{ borderLeft: '6px solid var(--success-color)', padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem', color: 'var(--success-color)' }}>✓</span>
            <h1 className="heading-1" style={{ margin: 0, color: 'var(--success-color)' }}>
              Device Registered Successfully
            </h1>
          </div>
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
            A persistent, tamper-evident device identity has been established on the platform.
          </p>

          <div style={{ background: 'var(--bg-color)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>PERSISTENT DEVICE ID:</span>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, wordBreak: 'break-all' }}>
                {registeredDevice.deviceId}
              </div>
            </div>
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Device Details:</span>
                <div style={{ fontWeight: 600 }}>
                  {registeredDevice.brand || registeredDevice.category.replace('_', ' ')} {registeredDevice.model || ''}
                </div>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Declared Condition:</span>
                <div style={{ fontWeight: 600 }}>{registeredDevice.condition.replace(/_/g, ' ')}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '1.25rem', background: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0', marginBottom: '2rem' }}>
            <span className="text-muted" style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 600 }}>
              TRANSPARENT INDICATIVE VALUATION:
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#047857', marginTop: '0.25rem' }}>
              {val && val.status === 'ESTIMATED' && val.rangeMin !== undefined && val.rangeMax !== undefined
                ? `₹${val.rangeMin.toLocaleString('en-IN')} - ₹${val.rangeMax.toLocaleString('en-IN')}`
                : `₹${estimate.min.toLocaleString('en-IN')} - ₹${estimate.max.toLocaleString('en-IN')}`}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#065f46', marginTop: '0.5rem', marginBottom: 0 }}>
              *Indicative valuation based on declared category, model and condition. This is an estimate to inform your recycling decision and is clearly distinct from a guaranteed buyback price or accepted commercial offer.
            </p>
          </div>

          {/* Photo upload status notification */}
          {evidenceUploaded && (
            <div style={{ padding: '0.85rem 1rem', background: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #6ee7b7', color: '#065f46', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✓</span>
              <span><strong>Genuine Photo Evidence Attached:</strong> S3 digital evidence created and linked to device custody ledger.</span>
            </div>
          )}

          {error && selectedPhoto && !evidenceUploaded && (
            <div style={{ padding: '0.85rem 1rem', background: '#fff1f2', borderRadius: 'var(--radius-md)', border: '1px solid #fecdd3', color: '#9f1239', marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>{error}</div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRetryPhotoUpload}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? 'Retrying Upload...' : 'Retry Photo Upload'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {!evidenceUploaded && (
              <Link
                to={`/consumer/devices/${registeredDevice.deviceId}/upload-photo`}
                className="btn btn-primary"
                style={{ flex: 1, textAlign: 'center', minWidth: '180px' }}
              >
                Upload Device Photo
              </Link>
            )}
            <Link
              to={`/consumer/devices/${registeredDevice.deviceId}`}
              className={evidenceUploaded ? 'btn btn-primary' : 'btn btn-outline'}
              style={{ flex: 1, textAlign: 'center', minWidth: '180px' }}
            >
              View Device Journey
            </Link>
            <Link
              to="/consumer"
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem' }}
            >
              My Devices
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto' }}>
      <h1 className="heading-1">Register Device</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Provide details about the electronic device you are handing over. This establishes the
        beginning of its verifiable journey.
      </p>

      {error && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--danger-color)',
            marginBottom: '1.5rem',
            padding: '1rem',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="form-control"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value as DeviceCategory })
            }
            required
          >
            <option value="MOBILE_PHONE">Mobile Phone / Smartphone</option>
            <option value="LAPTOP">Laptop / Notebook</option>
            <option value="DESKTOP">Desktop Computer / Workstation</option>
            <option value="TABLET">Tablet / iPad</option>
            <option value="TELEVISION">Television / Display</option>
            <option value="MONITOR">Computer Monitor</option>
            <option value="PRINTER">Printer / Scanner</option>
            <option value="ROUTER">Network Router / Modem</option>
            <option value="SMALL_APPLIANCE">Small Electronic Appliance</option>
            <option value="LARGE_APPLIANCE">Large Electronic Appliance</option>
            <option value="OTHER">Other E-Waste</option>
          </select>
        </div>

        <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Brand</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. OnePlus, Apple, Samsung, Dell"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Model</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. OnePlus 11, iPhone 14, XPS 15"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Condition</label>
          <select
            className="form-control"
            value={formData.condition}
            onChange={(e) =>
              setFormData({ ...formData, condition: e.target.value as DeviceCondition })
            }
            required
          >
            <option value="WORKING">Working (Fully functional)</option>
            <option value="PARTIALLY_WORKING">Partially Working (Minor defects/glitches)</option>
            <option value="NOT_WORKING">Not Working (Powers off / non-bootable)</option>
            <option value="DAMAGED">Physically Damaged (Broken screen / chassis)</option>
            <option value="FOR_PARTS">For Parts (Severe component loss)</option>
            <option value="UNKNOWN">Unknown / Untested</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Serial Number or IMEI (Optional)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Unique identifier for verification"
            value={formData.serialNumber}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
          />
        </div>

        {/* Real Photographic Evidence Capture & Preview */}
        <div className="form-group" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ fontWeight: 600 }}>
            Device Photograph (Proof of Custody)
          </label>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Capture a real photo of the physical device using your camera or webcam, or upload an image file.
          </p>

          {photoPreviewUrl ? (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', background: '#f8fafc', textAlign: 'center' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <img
                  src={photoPreviewUrl}
                  alt="Captured device"
                  style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
                <span className="badge badge-success">✓ Photo Selected ({((selectedPhoto?.size || 0) / 1024).toFixed(1)} KB)</span>
                <button type="button" onClick={handleClearPhoto} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                  Retake / Remove
                </button>
              </div>
            </div>
          ) : (
            <CameraCapture onCapture={handlePhotoCaptured} maxSizeBytes={5 * 1024 * 1024} />
          )}
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>Indicative Valuation Estimate:</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success-color)' }}>
              ₹{estimate.min.toLocaleString('en-IN')} - ₹{estimate.max.toLocaleString('en-IN')}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', marginBottom: 0 }}>
            *Calculated transparently using rule-based market pricing for {formData.category.replace('_', ' ')} in {formData.condition.replace('_', ' ')} condition. Not a guaranteed buyback price.
          </p>
        </div>

        <div
          style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}
        >
          <button type="button" onClick={() => navigate('/consumer')} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Registering...' : 'Register Device'}
          </button>
        </div>
      </form>
    </div>
  );
};
