import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CameraCapture } from '../../components/CameraCapture';
import { evidenceApi } from '../../api/evidence';
import { custodyApi } from '../../api/custody';
import { devicesApi } from '../../api/devices';
import { Device } from '@e-saathi/core';

export const DestinationProcessing: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCapture = async (file: File) => {
    if (!deviceId) return;
    setLoading(true);
    setError('');

    try {
      // 1. Fetch current device for version
      const device: Device = await devicesApi.get(deviceId);
      
      if (device.lifecycleState !== 'PROCESSING') {
        throw new Error(`Device must be in PROCESSING state to upload evidence. Currently: ${device.lifecycleState}`);
      }

      // 2. Get Intent
      const intentResult = await evidenceApi.uploadIntent(
        deviceId,
        'PROCESSING_PHOTO',
        file.type,
        file.size
      );

      // 3. Upload to S3 directly via presigned URL
      const uploadResponse = await fetch(intentResult.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('S3 upload failed');
      }

      // 4. Complete evidence creation
      await evidenceApi.complete(intentResult.evidenceId);

      // 5. Complete processing transition
      await custodyApi.transition(
        deviceId,
        'PROCESSING_COMPLETED',
        device.version,
        {
          notes: `Processing evidence uploaded: ${intentResult.evidenceId}`,
          metadata: { evidenceId: intentResult.evidenceId }
        }
      );

      setSuccess(true);
      setTimeout(() => {
        navigate(`/destination`);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Processing completion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="heading-1">Complete Processing</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        Upload a photo as evidence that processing/recycling has been completed.
      </p>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {success ? (
        <div className="card" style={{ borderLeft: '4px solid var(--success-color)', backgroundColor: '#f0fdf4' }}>
          <h3 className="heading-3" style={{ margin: 0, color: 'var(--success-color)' }}>
            Processing Completed!
          </h3>
          <p>Evidence securely uploaded and device marked as PROCESSED.</p>
        </div>
      ) : (
        <div className="card">
          {loading ? (
            <div className="flex-center" style={{ height: '300px' }}>
              <div className="text-muted">Uploading securely...</div>
            </div>
          ) : (
            <CameraCapture onCapture={handleCapture} />
          )}
        </div>
      )}
    </div>
  );
};
