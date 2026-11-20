import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isValidAnalyzedPhysicsProblem,
  parseAnalyzeQuestionHttpResponse,
} from './analyzeResponse.ts';

test('Rejects SPA <!doctype html> response with diagnostic error instead of JSON.parse SyntaxError', () => {
  const spaHtml =
    '<!doctype html><html lang="en"><head><title>PHYSICS LAB</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';

  assert.throws(
    () => parseAnalyzeQuestionHttpResponse(200, 'text/html; charset=utf-8', spaHtml),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /returned the application HTML page instead of JSON/i);
      assert.doesNotMatch(err.message, /Unexpected token/i);
      return true;
    }
  );
});

test('Rejects gateway 502 HTML error page cleanly', () => {
  const gatewayHtml = '<html><body><h1>502 Bad Gateway</h1></body></html>';
  assert.throws(
    () => parseAnalyzeQuestionHttpResponse(502, 'text/html', gatewayHtml),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /gateway returned an HTML error page \(HTTP 502\)/i);
      return true;
    }
  );
});

test('Rejects auth redirect HTML response cleanly', () => {
  const loginHtml = '<!DOCTYPE html><html><body>Sign in</body></html>';
  assert.throws(
    () =>
      parseAnalyzeQuestionHttpResponse(200, 'text/html', loginHtml, {
        redirected: true,
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /session or authentication redirect/i);
      return true;
    }
  );
});

test('Handles empty responses, plain-text non-JSON responses, and malformed JSON gracefully', () => {
  assert.throws(
    () => parseAnalyzeQuestionHttpResponse(500, 'application/json', '   '),
    /empty response/i
  );

  assert.throws(
    () => parseAnalyzeQuestionHttpResponse(500, 'text/plain', 'Internal Server Error'),
    /Unexpected response format "text\/plain"/i
  );

  assert.throws(
    () => parseAnalyzeQuestionHttpResponse(200, 'application/json', '{bad json'),
    /invalid JSON/i
  );
});

test('Preserves structured server error JSON and rejects incomplete analysis payloads', () => {
  assert.throws(
    () =>
      parseAnalyzeQuestionHttpResponse(
        429,
        'application/json',
        JSON.stringify({ error: 'Gemini rate limit reached.', code: 'RATE_LIMITED' })
      ),
    /Gemini rate limit reached/i
  );

  assert.throws(
    () =>
      parseAnalyzeQuestionHttpResponse(
        200,
        'application/json',
        JSON.stringify({ analysis: { title: 'Broken', sceneType: 'rotational_dynamics' } })
      ),
    /incomplete or invalid physics scene structure/i
  );

  assert.equal(isValidAnalyzedPhysicsProblem({ title: 'Broken' }), false);
});

test('Accepts and normalizes valid /api/analyze-question JSON response', () => {
  const payload = {
    analysis: {
      sceneType: 'rotational_dynamics',
      engineSupport: 'full',
      supportNote: 'Mapped cleanly.',
      title: 'Hinged Rod',
      summary: 'A 2 m, 4 kg rod hinged at one end.',
      imageReadabilityError: null,
      diagramInsights: [],
      objects: [{ id: 'rod_1', name: 'Rod', type: 'uniform_rod', mass: 4, length: 2, source: 'explicit_text' }],
      forces: [],
      connections: [],
      constraints: [],
      equations: ['tau = I * alpha'],
      unknowns: ['alpha'],
      extractedVariables: [
        { key: 'rodLength', label: 'Rod Length', value: 2, unit: 'm', source: 'explicit_text', editable: true },
      ],
      assumptions: [],
      missingInformation: [],
      simulationConfig: { preset: 'rotational' },
    },
  };

  const parsed = parseAnalyzeQuestionHttpResponse(
    200,
    'application/json; charset=utf-8',
    JSON.stringify(payload)
  );
  assert.equal(parsed.title, 'Hinged Rod');
  assert.equal(parsed.simulationConfig.preset, 'rotational');
  assert.equal(isValidAnalyzedPhysicsProblem(parsed), true);
});
