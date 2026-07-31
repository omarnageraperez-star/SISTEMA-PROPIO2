import React from 'react';

export function SkeletonCard({ height = 80, count = 3, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', ...style }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="skeleton-box"
          style={{
            height,
            width: '100%',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.03)'
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4, height = 120 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: '100%' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="skeleton-box"
          style={{
            height,
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.03)'
          }}
        />
      ))}
    </div>
  );
}

export default SkeletonCard;
