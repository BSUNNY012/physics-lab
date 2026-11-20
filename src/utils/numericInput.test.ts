import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdaptiveRange,
  formatPhysicsNumber,
  parseScientificNumber,
  physicalValueToSlider,
  sliderValueToPhysical,
} from './numericInput';

test('Parses scientific notation, decimals, negative values, and rejects invalid inputs', () => {
  assert.deepEqual(parseScientificNumber('1e6'), { valid: true, value: 1_000_000 });
  assert.deepEqual(parseScientificNumber('2.5e-8'), { valid: true, value: 2.5e-8 });
  assert.deepEqual(parseScientificNumber('3e12'), { valid: true, value: 3e12 });
  assert.equal(parseScientificNumber('-5', { allowNegative: false }).valid, false);
  assert.equal(parseScientificNumber('-5', { allowNegative: true }).value, -5);
  assert.equal(parseScientificNumber('0', { allowZero: false }).valid, false);
  assert.equal(parseScientificNumber('Infinity').valid, false);
  assert.equal(parseScientificNumber('abc').valid, false);
});

test('Adaptive slider expands cleanly for 5 kg, 500 kg, and 0.0005 kg', () => {
  const r5 = computeAdaptiveRange(5, { allowZero: false });
  assert.ok(r5.min < 5 && r5.max > 5);

  const r500 = computeAdaptiveRange(500, { allowZero: false });
  assert.ok(r500.min < 500 && r500.max >= 1250);

  const rTiny = computeAdaptiveRange(0.0005, { allowZero: false });
  assert.ok(rTiny.min < 0.0005 && rTiny.max > 0.0005 && rTiny.max < 0.01);
});

test('Logarithmic slider round-trip preserves order of magnitude', () => {
  const range = computeAdaptiveRange(1e5, { allowZero: false, useLog: true });
  assert.equal(range.isLog, true);
  const sliderPos = physicalValueToSlider(1e5, range);
  const recovered = sliderValueToPhysical(sliderPos, range);
  assert.ok(Math.abs(recovered - 1e5) < 1e-6);
});

test('formatPhysicsNumber formats small, standard, and scientific magnitudes cleanly', () => {
  assert.equal(formatPhysicsNumber(0), '0');
  assert.equal(formatPhysicsNumber(20), '20');
  assert.match(formatPhysicsNumber(2.5e-8), /e-8/);
  assert.match(formatPhysicsNumber(3e12), /e\+12/);
});
