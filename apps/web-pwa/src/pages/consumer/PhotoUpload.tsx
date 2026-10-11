import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CameraCapture } from '../../components/CameraCapture';
import { evidenceApi } from '../../api/evidence';

export const PhotoUpload: React.FC = () => {
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
      // 1. Get Intent
      const intentResult = await evidenceApi.uploadIntent(
        deviceId,
        'DEVICE_PHOTO',
        file.type,
        file.size
      );

      // 2. Upload to S3 directly via presigned URL
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

      // 3. Complete evidence creation
      await evidenceApi.complete(intentResult.evidenceId);

      setSuccess(true);
      setTimeout(() => {
        navigate(`/consumer/devices/${deviceId}`);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Evidence upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="heading-1">Add Device Photo</h1>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        A clear photo acts as initial proof of custody.
      </p>

      {error && (
        <div
          className="card"
          style={{ borderLeft: '4px solid var(--danger-color)', marginBottom: '1.5rem' }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="card"
          style={{
            borderLeft: '4px solid var(--success-color)',
            marginBottom: '1.5rem',
            background: '#ecfdf5',
            color: '#065f46',
          }}
        >
          Upload verified successfully! Redirecting...
        </div>
      )}

      {!success && (
        <div className="card">
          {loading ? (
            <div className="flex-center" style={{ height: '150px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '1rem' }}>Uploading securely...</div>
                <div className="text-muted" style={{ fontSize: '0.875rem' }}>
                  Establishing integrity hash
                </div>
              </div>
            </div>
          ) : (
            <CameraCapture
              onCapture={handleCapture}
              onCancel={() => navigate(`/consumer/devices/${deviceId}`)}
            />
          )}
        </div>
      )}
    </div>
  );
};
