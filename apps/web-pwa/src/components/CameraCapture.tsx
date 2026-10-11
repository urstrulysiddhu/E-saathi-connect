import React, { useRef, useState, useEffect, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel?: () => void;
  maxSizeBytes?: number;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
  maxSizeBytes = 10 * 1024 * 1024,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [startingCamera, setStartingCamera] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStartingCamera(false);
  }, [stream]);

  // Clean up stream tracks on component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Guarantee that the video element receives the stream once both are ready
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video
        .play()
        .catch((err) => console.warn('Camera video auto-play prevented:', err));
    }
  }, [cameraActive, stream]);

  const startCamera = async () => {
    setError(null);
    setStartingCamera(true);
    let mediaStream: MediaStream | null = null;

    try {
      // First try rear camera for mobile devices
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch {
      try {
        // Fallback to standard webcam for desktop / laptop
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err: unknown) {
        setStartingCamera(false);
        console.warn('Camera access unavailable:', err);
        setError('Camera permission denied or camera device unavailable. You can upload an image file instead.');
        triggerFileInput();
        return;
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      setCameraActive(true);
      setStartingCamera(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `capture_${Date.now()}.jpg`, {
                type: 'image/jpeg',
              });
              if (file.size > maxSizeBytes) {
                setError(`File size exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB.`);
                return;
              }
              onCapture(file);
              stopCamera();
            }
          },
          'image/jpeg',
          0.85
        );
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        return;
      }
      if (file.size > maxSizeBytes) {
        setError(`File size exceeds ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB.`);
        return;
      }

      onCapture(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
      <h3 className="heading-3" style={{ marginBottom: '0.5rem' }}>Evidence Capture</h3>
      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        Record a genuine photograph of the device using your camera or webcam, with file upload fallback.
      </p>

      {error && <p style={{ color: 'var(--danger-color)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}

      {cameraActive ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '100%',
            marginBottom: '1rem',
            background: '#090d16',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(console.warn);
              }
            }}
            style={{
              width: '100%',
              minHeight: '260px',
              maxHeight: '420px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div
            style={{
              position: 'absolute',
              top: '0.75rem',
              right: '0.75rem',
              background: 'rgba(16, 185, 129, 0.85)',
              color: '#ffffff',
              padding: '0.25rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            ● Live Camera Feed
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
              padding: '0 1rem',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={capturePhoto}
              style={{ borderRadius: '50px', padding: '0.6rem 1.75rem', fontWeight: 600 }}
            >
              📸 Snap Photo
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={stopCamera}
              style={{ borderRadius: '50px', padding: '0.6rem 1.25rem' }}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCamera}
              disabled={startingCamera}
            >
              {startingCamera ? 'Accessing Camera...' : '📷 Open Camera'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={triggerFileInput}
            >
              📁 Choose Image File
            </button>
            {onCancel && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onCancel}
                style={{ marginLeft: 'auto' }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

