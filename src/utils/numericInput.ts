export interface ParsedNumberResult {
  valid: boolean;
  value: number | null;
  error?: string;
}

export interface AdaptiveSliderRange {
  min: number;
  max: number;
  step: number;
  isLog: boolean;
}

export function parseScientificNumber(
  raw: string,
  options: {
    allowNegative?: boolean;
    allowZero?: boolean;
    minPositive?: number;
  } = {}
): ParsedNumberResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, value: null, error: 'Value required' };
  }

  // Allow standard decimals and scientific notation (e.g. 1e6, 2.5e-8, -3.1E+4)
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { valid: false, value: null, error: 'Must be a finite number' };
  }

  const allowNegative = options.allowNegative ?? false;
  const allowZero = options.allowZero ?? true;

  if (!allowNegative && num < 0) {
    return { valid: false, value: null, error: 'Must be non-negative' };
  }
  if (!allowZero && num === 0) {
    return { valid: false, value: null, error: 'Must be greater than 0' };
  }
  if (options.minPositive !== undefined && num < options.minPositive) {
    return {
      valid: false,
      value: null,
      error: `Must be ≥ ${formatPhysicsNumber(options.minPositive)}`,
    };
  }

  return { valid: true, value: num };
}

export function formatPhysicsNumber(value: number, sigFigs = 4): string {
  if (!Number.isFinite(value)) return 'Undefined';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e-3 && abs < 1e4) {
    // Clean decimal representation without trailing zeroes
    const precision = abs >= 100 ? 2 : abs >= 10 ? 3 : 4;
    return Number(value.toFixed(precision)).toString();
  }
  return value.toExponential(Math.max(1, sigFigs - 1));
}

export function formatInputString(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e-4 && abs < 1e6) {
    return Number(value.toPrecision(7)).toString();
  }
  return value.toExponential(4);
}

export function computeAdaptiveRange(
  value: number,
  options: {
    allowNegative?: boolean;
    allowZero?: boolean;
    fixedMin?: number;
    fixedMax?: number;
    defaultStep?: number;
    useLog?: boolean;
  } = {}
): AdaptiveSliderRange {
  const useLog = Boolean(options.useLog) && !options.allowNegative && value > 0;

  if (options.fixedMin !== undefined && options.fixedMax !== undefined) {
    const min = Math.min(options.fixedMin, value);
    const max = Math.max(options.fixedMax, value);
    const span = max - min || 1;
    const step = options.defaultStep ?? Number((span / 200).toPrecision(2));
    return { min, max, step, isLog: false };
  }

  if (useLog) {
    const exp = Math.floor(Math.log10(Math.max(1e-12, value)));
    const minExp = exp - 2;
    const maxExp = exp + 2;
    return {
      min: minExp,
      max: maxExp,
      step: 0.02,
      isLog: true,
    };
  }

  const abs = Math.abs(value);
  const mag = abs > 0 ? Math.pow(10, Math.floor(Math.log10(abs))) : 1;

  if (options.allowNegative) {
    const bound =
      abs > 0
        ? Math.max(mag * 5, abs * 2)
        : options.defaultStep
        ? options.defaultStep * 50
        : 10;
    const step = Number((bound / 100).toPrecision(2)) || 0.1;
    return { min: -bound, max: bound, step, isLog: false };
  }

  const min = options.allowZero === false ? Math.min(mag * 0.1, abs * 0.25) : 0;
  const max =
    abs > 0
      ? Math.max(mag * 5, abs * 2.5)
      : options.defaultStep
      ? options.defaultStep * 50
      : 10;
  const step = Number(((max - min) / 200).toPrecision(2)) || 1e-6;
  return { min, max, step, isLog: false };
}

export function sliderValueToPhysical(sliderVal: number, range: AdaptiveSliderRange): number {
  if (!range.isLog) return sliderVal;
  return Math.pow(10, sliderVal);
}

export function physicalValueToSlider(physVal: number, range: AdaptiveSliderRange): number {
  if (!range.isLog) return physVal;
  if (physVal <= 0) return range.min;
  return Math.min(range.max, Math.max(range.min, Math.log10(physVal)));
}
