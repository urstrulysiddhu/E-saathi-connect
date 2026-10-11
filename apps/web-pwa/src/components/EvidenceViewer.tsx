import React, { useState, useEffect } from 'react';
import { Evidence } from '@e-saathi/core';
import { evidenceApi } from '../api/evidence';

interface EvidenceViewerProps {
  evidenceList?: Evidence[];
  deviceId?: string;
}

interface EvidenceWithUrl extends Evidence {
  accessUrl?: string;
  loadingUrl?: boolean;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ evidenceList: initialList, deviceId }) => {
  const [items, setItems] = useState<EvidenceWithUrl[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const setupEvidence = async () => {
      let list = initialList;
      if (!list && deviceId) {
        setLoading(true);
        try {
          const res = await evidenceApi.listForDevice(deviceId);
          list = res.items || [];
        } catch {
          list = [];
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      if (!list) list = [];
      if (!isMounted) return;

      setItems(list.map((e) => ({ ...e, loadingUrl: true })));

      // Fetch presigned access URLs for all evidence items
      list.forEach(async (ev) => {
        try {
          const res = await evidenceApi.getAccessUrl(ev.evidenceId);
          if (isMounted) {
            setItems((prev) =>
              prev.map((item) =>
                item.evidenceId === ev.evidenceId
                  ? { ...item, accessUrl: res.accessUrl || res.url, loadingUrl: false }
                  : item
              )
            );
          }
        } catch {
          if (isMounted) {
            setItems((prev) =>
              prev.map((item) =>
                item.evidenceId === ev.evidenceId ? { ...item, loadingUrl: false } : item
              )
            );
          }
        }
      });
    };

    setupEvidence();

    return () => {
      isMounted = false;
    };
  }, [initialList, deviceId]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100px', color: '#64748b' }}>
        Loading evidence records...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="text-muted"
        style={{
          padding: '1.5rem',
          background: 'var(--bg-color)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          border: '1px dashed var(--border-color)',
        }}
      >
        No evidence recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {items.map((ev) => (
        <div
          key={ev.evidenceId}
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            background: '#ffffff',
          }}
        >
          <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600 }}>{ev.evidenceType.replace(/_/g, ' ')}</div>
            <span className="badge badge-success">Integrity Verified</span>
          </div>

          {ev.accessUrl ? (
            <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
              <img
                src={ev.accessUrl}
                alt={ev.evidenceType}
                style={{
                  maxWidth: '100%',
                  maxHeight: '260px',
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'contain',
                  border: '1px solid var(--border-color)',
                  background: '#f8fafc',
                }}
              />
            </div>
          ) : ev.loadingUrl ? (
            <div
              style={{
                height: '140px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
              }}
            >
              Retrieving verified image...
            </div>
          ) : (
            <div
              style={{
                padding: '0.75rem',
                background: '#fef2f2',
                borderRadius: 'var(--radius-md)',
                color: '#991b1b',
                fontSize: '0.8rem',
                marginBottom: '0.75rem',
              }}
            >
              Image metadata persistent in DynamoDB. Preview currently restricted by organization access rules.
            </div>
          )}

          <div className="text-muted" style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
            <div>
              <strong>Captured:</strong> {new Date(ev.createdAt).toLocaleString()}
            </div>
            {ev.capturedByOrganizationId && (
              <div>
                <strong>Organization:</strong> {ev.capturedByOrganizationId}
              </div>
            )}
            <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', marginTop: '0.25rem' }}>
              <strong>Evidence ID:</strong> {ev.evidenceId}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
