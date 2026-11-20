import React, { useMemo } from 'react';
import * as THREE from 'three';

interface OrientationGizmoProps {
  cameraQuaternion: [number, number, number, number];
  onSnapAxis: (axis: 'x' | '-x' | 'y' | '-y' | 'z' | '-z') => void;
}

const AXES: Array<{
  id: 'x' | 'y' | 'z';
  label: string;
  vec: [number, number, number];
  color: string;
}> = [
  { id: 'x', label: 'X', vec: [1, 0, 0], color: '#ef4444' },
  { id: 'y', label: 'Y', vec: [0, 1, 0], color: '#10b981' },
  { id: 'z', label: 'Z', vec: [0, 0, 1], color: '#3b82f6' },
];

export const OrientationGizmo: React.FC<OrientationGizmoProps> = ({
  cameraQuaternion,
  onSnapAxis,
}) => {
  const projected = useMemo(() => {
    const invQ = new THREE.Quaternion(...cameraQuaternion).invert();
    const radius = 24;
    const cx = 38;
    const cy = 38;

    return AXES.map((axis) => {
      const v = new THREE.Vector3(...axis.vec).applyQuaternion(invQ);
      return {
        ...axis,
        px: cx + v.x * radius,
        py: cy - v.y * radius,
        pz: v.z,
      };
    }).sort((a, b) => a.pz - b.pz);
  }, [cameraQuaternion]);

  return (
    <div
      aria-label="3D View Orientation Gizmo"
      className="w-[76px] h-[76px] rounded-full bg-[#0D131F]/90 border border-slate-800/90 shadow-lg select-none relative"
    >
      <svg viewBox="0 0 76 76" className="w-full h-full">
        <circle
          cx="38"
          cy="38"
          r="34"
          fill="none"
          stroke="rgba(148,163,184,0.1)"
          strokeWidth="1"
        />
        <circle cx="38" cy="38" r="2.2" fill="#94a3b8" />
        {projected.map((ax) => (
          <g
            key={ax.id}
            onClick={() => onSnapAxis(ax.id)}
            className="cursor-pointer"
          >
            <line
              x1="38"
              y1="38"
              x2={ax.px}
              y2={ax.py}
              stroke={ax.color}
              strokeWidth="2"
              strokeOpacity={ax.pz >= 0 ? 0.95 : 0.45}
            />
            <circle
              cx={ax.px}
              cy={ax.py}
              r="8.5"
              fill={ax.color}
              fillOpacity={ax.pz >= 0 ? 0.95 : 0.45}
            />
            <text
              x={ax.px}
              y={ax.py + 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#080b11"
              fontSize="9.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, monospace"
            >
              {ax.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
