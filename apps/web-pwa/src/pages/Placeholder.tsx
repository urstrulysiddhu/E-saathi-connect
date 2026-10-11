import React from 'react';

export const Placeholder: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '4rem 0' }}>
      <h1 className="heading-1">{title}</h1>
      <p className="text-muted" style={{ fontSize: '1.2rem', marginTop: '1rem' }}>
        This section is under construction and will be available in a future release.
      </p>
    </div>
  );
};
