import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  computeAdaptiveRange,
  formatInputString,
  parseScientificNumber,
  physicalValueToSlider,
  sliderValueToPhysical,
} from '../utils/numericInput';

export interface AdaptiveParamControlProps {
  id: string;
  label: string;
  value: number;
  defaultValue?: number;
  unit: string;
  allowNegative?: boolean;
  allowZero?: boolean;
  minPositive?: number;
  fixedMin?: number;
  fixedMax?: number;
  defaultStep?: number;
  supportsLog?: boolean;
  disabled?: boolean;
  onChange: (val: number) => void;
}

export const AdaptiveParamControl: React.FC<AdaptiveParamControlProps> = ({
  id,
  label,
  value,
  defaultValue,
  unit,
  allowNegative = false,
  allowZero = true,
  minPositive,
  fixedMin,
  fixedMax,
  defaultStep,
  supportsLog = false,
  disabled = false,
  onChange,
}) => {
  const [draft, setDraft] = useState<string>(() => formatInputString(value));
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useLog, setUseLog] = useState<boolean>(false);

  // Sync external value updates when user is not actively typing
  useEffect(() => {
    if (!isFocused) {
      setDraft(formatInputString(value));
      setErrorMsg(null);
    }
  }, [value, isFocused]);

  const range = useMemo(
    () =>
      computeAdaptiveRange(value, {
        allowNegative,
        allowZero,
        fixedMin,
        fixedMax,
        defaultStep,
        useLog: supportsLog && useLog,
      }),
    [value, allowNegative, allowZero, fixedMin, fixedMax, defaultStep, supportsLog, useLog]
  );

  const sliderValue = useMemo(() => physicalValueToSlider(value, range), [value, range]);

  const commitDraft = (raw: string, isFinalCommit: boolean) => {
    const trimmed = raw.trim();
    // Do not interrupt scientific notation / decimal typing mid-entry
    if (!isFinalCommit && (trimmed === '' || /[eE.+-]$/.test(trimmed))) {
      setErrorMsg(null);
      return;
    }

    const parsed = parseScientificNumber(trimmed, {
      allowNegative,
      allowZero,
      minPositive,
    });

    if (!parsed.valid || parsed.value === null) {
      setErrorMsg(parsed.error ?? 'Invalid number');
      return;
    }

    setErrorMsg(null);
    if (parsed.value !== value) {
      onChange(parsed.value);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);
    commitDraft(next, false);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (draft.trim() === '') {
      setDraft(formatInputString(value));
      setErrorMsg(null);
      return;
    }
    const parsed = parseScientificNumber(draft, {
      allowNegative,
      allowZero,
      minPositive,
    });
    if (parsed.valid && parsed.value !== null) {
      setErrorMsg(null);
      if (parsed.value !== value) onChange(parsed.value);
      setDraft(formatInputString(parsed.value));
    } else {
      setErrorMsg(parsed.error ?? 'Invalid number');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft(draft, true);
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(formatInputString(value));
      setErrorMsg(null);
      e.currentTarget.blur();
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRaw = Number(e.target.value);
    let nextPhys = sliderValueToPhysical(nextRaw, range);
    if (range.isLog) {
      nextPhys = Number(nextPhys.toPrecision(4));
    } else {
      nextPhys = Number(nextPhys.toPrecision(6));
    }
    if (!allowZero && nextPhys <= 0) {
      nextPhys = minPositive ?? 1e-6;
    }
    setErrorMsg(null);
    onChange(nextPhys);
  };

  const isModified =
    defaultValue !== undefined &&
    Math.abs(value - defaultValue) > 1e-9 * Math.max(1, Math.abs(defaultValue));

  const canLog = supportsLog && !allowNegative && value > 0;

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-1.5">
        <label htmlFor={id} className="text-xs text-slate-300 truncate" title={label}>
          {label}
        </label>
        <div className="flex items-center gap-1 shrink-0">
          {supportsLog && (
            <button
              type="button"
              disabled={!canLog}
              onClick={() => setUseLog((v) => !v)}
              title={
                canLog
                  ? 'Toggle linear / logarithmic slider scale'
                  : 'Log scale requires positive value'
              }
              className={`px-1 py-0.5 rounded text-[10px] font-mono transition-colors border ${
                useLog && canLog
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#0E1524] text-slate-500 hover:text-slate-300 border-slate-800'
              } disabled:opacity-40`}
            >
              {useLog && canLog ? 'Log' : 'Lin'}
            </button>
          )}
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} numeric value`}
            aria-invalid={errorMsg ? 'true' : 'false'}
            value={draft}
            disabled={disabled}
            onFocus={() => setIsFocused(true)}
            onChange={handleTextChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 2.5e-3"
            className={`w-20 bg-[#080C14] border rounded px-1.5 py-0.5 text-right font-mono-tabular text-xs outline-none transition-colors ${
              errorMsg
                ? 'border-amber-500/80 text-amber-300'
                : 'border-slate-800 focus:border-cyan-500/60 text-cyan-300'
            }`}
          />
          {unit && (
            <span className="text-[11px] font-mono text-slate-500 w-9 text-left truncate">
              {unit}
            </span>
          )}
          {defaultValue !== undefined && (
            <button
              type="button"
              disabled={!isModified}
              onClick={() => {
                setErrorMsg(null);
                setDraft(formatInputString(defaultValue));
                onChange(defaultValue);
              }}
              aria-label={`Reset ${label} to default`}
              title={`Reset to ${formatInputString(defaultValue)}${unit ? ` ${unit}` : ''}`}
              className={`p-0.5 rounded transition-colors ${
                isModified
                  ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/70'
                  : 'text-slate-700 cursor-default'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={sliderValue}
        disabled={disabled}
        onChange={handleSliderChange}
        className="lab-slider w-full"
      />

      {errorMsg && (
        <p role="alert" className="text-[10px] font-mono text-amber-400 leading-tight">
          {errorMsg}
        </p>
      )}
    </div>
  );
};
