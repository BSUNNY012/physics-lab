export interface VectorVisibilityFlags {
  appliedForce: boolean;
  leverArm: boolean;
  perpendicularDistance: boolean;
  torqueVector: boolean;
  rotationDirection: boolean;
}

export interface RotationalSimulationState {
  time: number; // simulated elapsed seconds
  thetaRad: number; // current angular position (rad)
  omega: number; // current angular velocity (rad/s)
  alpha: number; // current angular acceleration (rad/s^2)
  accumulator: number; // fixed-timestep accumulator (s)
}

export interface RotationalDynamicsResult {
  // Inputs mirrored
  mass: number;
  sphereMass: number;
  length: number;
  forceMagnitude: number;
  forceAngleDeg: number;
  forceAngleRad: number;
  forceDistance: number;
  pivotOffset: number;

  // Derived geometry & inertia
  effectiveLeverArm: number; // distance from pivot to force application point (r)
  perpendicularDistance: number; // r_perp = |r * sin(theta_F)|
  momentOfInertiaRod: number; // (1/12)mL^2 + m(L/2 - pivotOffset)^2  (= mL^2/3 when pivotOffset=0)
  momentOfInertiaSphere: number;
  totalMomentOfInertia: number;

  // Torque breakdown
  appliedTorque: number; // r * F * sin(theta_F)
  gravityTorque: number; // -(m_rod * d_cm + m_sphere * d_s) * g * cos(theta) when enabled
  dampingTorque: number; // -c * omega when enabled
  netTorque: number;

  // Kinematics
  angularAcceleration: number;
  angularVelocity: number;
  angularDisplacementRad: number;
  angularDisplacementDeg: number;
  currentAngleRad: number;
  currentAngleDeg: number;

  // Active effects & reliability
  gravityActive: boolean;
  dampingActive: boolean;
  isValid: boolean;
  warningMessage: string | null;
}
