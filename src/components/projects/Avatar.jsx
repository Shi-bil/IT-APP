import React from 'react';

export default function Avatar({ name, size = 28, ringClass = 'ring-2 ring-slate-900' }) {
  const initials = (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold ${ringClass}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${(hue + 40) % 360},70%,45%))`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
