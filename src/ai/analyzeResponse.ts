import {
  validateAndNormalizeAnalysis,
  type AnalyzedPhysicsProblem,
} from './sceneSchema.ts';

export interface AnalyzeResponseContext {
  redirected?: boolean;
  url?: string;
}

const VALID_PRESETS = new Set([
  'rotational',
  'rolling',
  'pulley',
  'collisions',
  'oscillations',
  'block_surface',
  'unsupported',
]);

export function isValidAnalyzedPhysicsProblem(
  value: unknown
): value is AnalyzedPhysicsProblem {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (typeof obj.sceneType !== 'string' || obj.sceneType.trim() === '') return false;
  if (
    obj.engineSupport !== 'full' &&
    obj.engineSupport !== 'partial' &&
    obj.engineSupport !== 'unsupported'
  ) {
    return false;
  }
  if (typeof obj.title !== 'string' || obj.title.trim() === '') return false;
  if (typeof obj.summary !== 'string') return false;
  if (!Array.isArray(obj.objects)) return false;
  if (!Array.isArray(obj.forces)) return false;
  if (!Array.isArray(obj.connections)) return false;
  if (!Array.isArray(obj.extractedVariables)) return false;
  if (!Array.isArray(obj.assumptions)) return false;
  if (!Array.isArray(obj.missingInformation)) return false;

  const simCfg = obj.simulationConfig as Record<string, unknown> | undefined;
  if (!simCfg || typeof simCfg !== 'object') return false;
  if (typeof simCfg.preset !== 'string' || !VALID_PRESETS.has(simCfg.preset)) {
    return false;
  }

  return true;
}

function looksLikeHtmlDocument(rawTrimmed: string, contentType: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    return true;
  }
  const lower = rawTrimmed.slice(0, 256).toLowerCase();
  return (
    lower.startsWith('<!doctype') ||
    lower.startsWith('<html') ||
    lower.startsWith('<head') ||
    lower.startsWith('<body') ||
    lower.startsWith('<?xml') ||
    lower.startsWith('<')
  );
}

function looksLikeAppSpaHtml(rawBody: string): boolean {
  return (
    rawBody.includes('PHYSICS LAB') ||
    rawBody.includes('/src/main.tsx') ||
    rawBody.includes('<div id="root"></div>')
  );
}

export function parseAnalyzeQuestionHttpResponse(
  status: number,
  contentType: string | null,
  rawBody: string,
  context: AnalyzeResponseContext = {}
): AnalyzedPhysicsProblem {
  const trimmed = rawBody.trim();

  if (!trimmed) {
    throw new Error(
      `The physics analysis API returned an empty response (HTTP ${status || 'unknown'}). Please try again.`
    );
  }

  if (looksLikeHtmlDocument(trimmed, contentType)) {
    if (looksLikeAppSpaHtml(rawBody)) {
      throw new Error(
        `The /api/analyze-question endpoint returned the application HTML page instead of JSON (HTTP ${status}). Verify the Express API server is handling POST /api/analyze-question and reload the page.`
      );
    }
    if (status === 401 || status === 403 || context.redirected) {
      throw new Error(
        `Your session or authentication redirect interrupted the analysis request (HTTP ${status}). Please refresh the page and try again.`
      );
    }
    if (status === 413) {
      throw new Error(
        'The uploaded problem image exceeded the server request size limit (HTTP 413). Try uploading a smaller or cropped image.'
      );
    }
    if (status >= 500) {
      throw new Error(
        `The analysis server gateway returned an HTML error page (HTTP ${status}). The AI request may have timed out—please try again.`
      );
    }
    throw new Error(
      `Expected a JSON response from /api/analyze-question, but received an HTML document (HTTP ${status}).`
    );
  }

  const ct = (contentType ?? '').toLowerCase();
  if (ct && !ct.includes('json') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    throw new Error(
      `Unexpected response format "${contentType}" from /api/analyze-question (HTTP ${status}).`
    );
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(trimmed);
  } catch {
    throw new Error(
      `The server returned invalid JSON from /api/analyze-question (HTTP ${status}). Please try again.`
    );
  }

  if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
    throw new Error(
      `The analysis response was not a valid JSON object (HTTP ${status}).`
    );
  }

  const payloadObj = parsedPayload as {
    analysis?: unknown;
    error?: unknown;
    code?: unknown;
  };

  if (status < 200 || status >= 300) {
    const serverMsg =
      typeof payloadObj.error === 'string' && payloadObj.error.trim() !== ''
        ? payloadObj.error.trim()
        : `Question analysis failed with HTTP status ${status}.`;
    throw new Error(serverMsg);
  }

  if (!payloadObj.analysis) {
    if (typeof payloadObj.error === 'string' && payloadObj.error.trim() !== '') {
      throw new Error(payloadObj.error.trim());
    }
    throw new Error('The API response succeeded, but did not include an analysis payload.');
  }

  if (!isValidAnalyzedPhysicsProblem(payloadObj.analysis)) {
    throw new Error(
      'The AI returned an incomplete or invalid physics scene structure. Please try analyzing the question again.'
    );
  }

  return validateAndNormalizeAnalysis(payloadObj.analysis);
}
