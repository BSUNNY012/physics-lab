/**
 * Separates physical SI values from 3D laboratory rendering dimensions so
 * extreme magnitudes (e.g. L = 1000 m or 0.001 m, F = 1e6 N or 1e-6 N)
 * remain crisp, centered, and legible without ever altering physics math.
 */

export function mapRodLengthToScene(physicalLengthMeters: number): number {
  if (!Number.isFinite(physicalLengthMeters) || physicalLengthMeters <= 0) {
    return 2.0;
  }
  // Standard range [0.8, 3.0] m maps 1:1 to [0.8, 3.0] scene units.
  // Outside that range, smooth logarithmic compression keeps both ends comfortably inside the frame.
  if (physicalLengthMeters >= 0.8 && physicalLengthMeters <= 3.0) {
    return physicalLengthMeters;
  }
  if (physicalLengthMeters > 3.0) {
    const excessLog = Math.log10(physicalLengthMeters / 3.0);
    return Math.min(3.45, 3.0 + excessLog * 0.16);
  }
  const underLog = Math.log10(0.8 / Math.max(1e-12, physicalLengthMeters));
  return Math.max(0.75, 0.8 - underLog * 0.1);
}

export function mapForceToSceneArrowLength(
  forceNewtons: number,
  vectorScale: number
): number {
  const absF = Math.abs(forceNewtons);
  if (!Number.isFinite(absF) || absF <= 0) return 0;
  // Smooth log-compressed magnitude: 10 N -> ~0.95 units, 1e6 N -> ~1.48 units
  const normalized = 0.55 + 0.16 * Math.log10(1 + absF);
  return Math.min(1.55, Math.max(0.45, normalized)) * vectorScale;
}

export function mapTorqueToSceneArrowLength(
  torqueNm: number,
  vectorScale: number
): number {
  const absT = Math.abs(torqueNm);
  if (!Number.isFinite(absT) || absT <= 1e-15) return 0;
  const normalized = 0.45 + 0.16 * Math.log10(1 + absT);
  return Math.min(1.45, Math.max(0.4, normalized)) * vectorScale;
}
