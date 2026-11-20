import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  validateAndNormalizeAnalysis,
  type AnalyzedPhysicsProblem,
} from './sceneSchema.ts';

const SYSTEM_INSTRUCTION = `You are an expert JEE Physics analyzer and structured 3D simulation scene architect.
Your job is to interpret written physics questions and/or uploaded physics problem photographs/diagrams into a validated structured JSON representation.

RULES:
1. NEVER solve the problem by replacing the physics engine—instead extract objects, physical properties, forces, relationships/constraints, initial conditions, equations, unknowns, and assumptions so a deterministic physics engine can simulate and calculate the system.
2. If an image is provided, carefully inspect BOTH printed text AND any physics diagram (arrows, angle arcs, labels, hinges, pulleys, strings, blocks, surfaces, dimensions, direction indicators). Tag diagram-derived values with source="diagram". If NO image is provided, return diagramInsights as an empty array [].
3. NEVER invent unreadable values from a blurry or cropped image. If image text or a diagram label is unreadable, set imageReadabilityError with a clear clarification request and add items to missingInformation.
4. Strictly distinguish:
   - "explicit_text": stated explicitly in the question text.
   - "diagram": read from diagram labels/arrows/geometry.
   - "calculated": directly derived from given quantities.
   - "assumed": idealized physics defaults needed to run the simulation (e.g., g = 9.81 m/s^2, frictionless hinge, light inextensible string, ideal massless pulley, initial rest, or default dimensions when a qualitative question omits numbers like "a block rests on a rough horizontal surface").
   NEVER mark an assumed quantity as "explicit_text".
5. Supported sceneType & preset mappings:
   - "rotational_dynamics" -> uniform hinged rod, bar, lever, optional attached sphere, applied force(s) at distance r and angle theta_F.
     Keys in extractedVariables & rotationalParams: rodLength (m), rodMass (kg), sphereMass (kg), spherePosition (m), pivotOffset (m), forceMagnitude (N), forceAngle (deg), forceDistance (m from pivot), initialAngularVelocity (rad/s), initialAngle (deg), gravity (m/s^2), damping (N*m*s).
     For gravity/damping in rotational_dynamics: include assumptions with impactKey="gravityEnabled" (false unless weight/gravity torque is relevant, e.g. horizontal pivot without gravity stated) and impactKey="dampingEnabled" (false for frictionless pivot).
   - "pulley_system" -> two masses connected by a string over a fixed pulley (Atwood machine).
     Keys: massLeft (kg), massRight (kg), pulleyMass (kg, 0 for ideal massless pulley), pulleyRadius (m), gravity (m/s^2).
   - "rolling_motion" -> solid cylinder/disc/sphere rolling without slipping down an inclined plane. Use object type "cylinder", "disc", or "sphere" for the rolling body and "incline" for the ramp.
     Keys: inclineAngle (deg), cylinderMass (kg), cylinderRadius (m), rampLength (m), gravity (m/s^2).
   - "block_surface" -> block resting/sliding on horizontal rough/smooth surface with applied/inclined pulling or pushing force, normal reaction, weight, and static/kinetic friction.
     Keys: mass (kg), appliedForce (N), forceAngle (deg above horizontal), muStatic, muKinetic, gravity (m/s^2), initialVelocity (m/s).
     Include assumption with impactKey="frictionEnabled" (true for rough surface, false for smooth/frictionless).
   - "collision_1d" -> two colliding objects/gliders in 1D.
     Keys: massA (kg), velocityA (m/s), massB (kg), velocityB (m/s), restitution (0..1).
   - "oscillation" -> simple pendulum / small-angle oscillation.
     Keys: pendulumLength (m), bobMass (kg), initialAmplitude (deg), gravity (m/s^2), damping.
   - "unsupported" -> any system outside the 6 models above (e.g., 3D gyroscope precession, electromagnetism, thermodynamics, optics, multi-pulley compound constraints with moving pulleys, double pendulum). Clearly explain why in supportNote.
6. Whenever a qualitative problem omits numeric values (e.g., "A solid cylinder rolls without slipping down an inclined plane" or "A block rests on a rough horizontal surface and is pulled by an inclined force"), still extract the full physical setup, populate ALL required parameter keys in extractedVariables with source="assumed" (e.g., pulleyRadius=0.35 m, inclineAngle=30 deg, cylinderMass=2 kg, cylinderRadius=0.4 m, rampLength=5 m, mass=5 kg, appliedForce=28 N, forceAngle=30 deg, muStatic=0.4, muKinetic=0.3), AND list them clearly in missingInformation (with critical=false and suggestedDefault) so the student can inspect/confirm/edit them before generating the 3D scene. Always include every extracted/assumed numerical parameter in extractedVariables using the exact keys listed above.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sceneType: {
      type: Type.STRING,
      description:
        'One of: rotational_dynamics, pulley_system, rolling_motion, block_surface, collision_1d, oscillation, unsupported',
    },
    engineSupport: {
      type: Type.STRING,
      description: 'One of: full, partial, unsupported',
    },
    supportNote: { type: Type.STRING },
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    imageReadabilityError: { type: Type.STRING },
    diagramInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    objects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          mass: { type: Type.NUMBER },
          length: { type: Type.NUMBER },
          radius: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          orientationDeg: { type: Type.NUMBER },
          hinged: { type: Type.BOOLEAN },
          pivotOffset: { type: Type.NUMBER },
          fixed: { type: Type.BOOLEAN },
          frictionCoefficient: { type: Type.NUMBER },
          initialVelocity: { type: Type.NUMBER },
          initialAngularVelocity: { type: Type.NUMBER },
          source: { type: Type.STRING },
        },
        required: ['id', 'name', 'type', 'source'],
      },
    },
    forces: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING },
          targetObjectId: { type: Type.STRING },
          magnitude: { type: Type.NUMBER },
          angleDeg: { type: Type.NUMBER },
          applicationPointDescription: { type: Type.STRING },
          applicationDistance: { type: Type.NUMBER },
          source: { type: Type.STRING },
        },
        required: ['id', 'label', 'type', 'targetObjectId', 'angleDeg', 'applicationPointDescription', 'source'],
      },
    },
    connections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING },
          objectIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          description: { type: Type.STRING },
        },
        required: ['id', 'type', 'objectIds', 'description'],
      },
    },
    constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
    equations: { type: Type.ARRAY, items: { type: Type.STRING } },
    unknowns: { type: Type.ARRAY, items: { type: Type.STRING } },
    extractedVariables: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          label: { type: Type.STRING },
          value: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          objectId: { type: Type.STRING },
          source: { type: Type.STRING },
          editable: { type: Type.BOOLEAN },
        },
        required: ['key', 'label', 'unit', 'source', 'editable'],
      },
    },
    assumptions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          statement: { type: Type.STRING },
          category: { type: Type.STRING },
          enabled: { type: Type.BOOLEAN },
          editable: { type: Type.BOOLEAN },
          impactKey: { type: Type.STRING },
          impactValue: { type: Type.BOOLEAN },
        },
        required: ['id', 'statement', 'category', 'enabled', 'editable'],
      },
    },
    missingInformation: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          field: { type: Type.STRING },
          prompt: { type: Type.STRING },
          critical: { type: Type.BOOLEAN },
          suggestedDefault: { type: Type.NUMBER },
          unit: { type: Type.STRING },
        },
        required: ['id', 'field', 'prompt', 'critical'],
      },
    },
    simulationConfig: {
      type: Type.OBJECT,
      properties: {
        preset: {
          type: Type.STRING,
          description:
            'One of: rotational, rolling, pulley, collisions, oscillations, block_surface, unsupported',
        },
      },
      required: ['preset'],
    },
  },
  required: [
    'sceneType',
    'engineSupport',
    'supportNote',
    'title',
    'summary',
    'objects',
    'forces',
    'connections',
    'constraints',
    'equations',
    'unknowns',
    'extractedVariables',
    'assumptions',
    'missingInformation',
    'simulationConfig',
  ],
};

export interface AnalyzeQuestionInput {
  questionText?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

const MODEL_CANDIDATES = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
const modelCooldownUntil = new Map<string, number>();

function extractReadableErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Raw text is not JSON
  }
  return raw || 'Failed to analyze physics question.';
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function analyzePhysicsQuestionWithGemini(
  input: AnalyzeQuestionInput
): Promise<AnalyzedPhysicsProblem> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured on the server. Add your API key in Settings > Secrets.'),
      { status: 500, code: 'MISSING_API_KEY' }
    );
  }

  const trimmedText = (input.questionText ?? '').trim();
  const hasImage = Boolean(input.imageBase64 && input.imageBase64.trim().length > 0);

  if (!trimmedText && !hasImage) {
    throw Object.assign(
      new Error('Provide either a physics question description or an uploaded question image.'),
      { status: 400, code: 'EMPTY_INPUT' }
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (hasImage && input.imageBase64) {
    const cleanBase64 = input.imageBase64.replace(/^data:[^;]+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: input.imageMimeType || 'image/png',
        data: cleanBase64,
      },
    });
  }

  const promptLines = [
    trimmedText
      ? `Physics Question Text:\n"""\n${trimmedText}\n"""`
      : 'No typed text provided. Carefully transcribe and analyze the physics question and any diagram from the attached image.',
    hasImage
      ? 'An image of the physics question/diagram is attached. Extract printed text, equations, diagram labels, angles, supports, force arrows, and connections.'
      : 'No image is attached; leave diagramInsights as an empty array [].',
    'Return ONLY valid JSON conforming to the structured physics scene schema.',
  ]
    .filter(Boolean)
    .join('\n\n');

  parts.push({ text: promptLines });

  let lastErr: unknown = null;
  let lastRawErr = '';

  const now = Date.now();
  const activeCandidates = MODEL_CANDIDATES.filter((m, idx) => {
    if (idx === MODEL_CANDIDATES.length - 1) return true;
    const until = modelCooldownUntil.get(m) ?? 0;
    return now >= until;
  });

  const attempts: Array<{ model: (typeof MODEL_CANDIDATES)[number]; timeoutMs: number }> = [];
  for (let i = 0; i < activeCandidates.length; i++) {
    const model = activeCandidates[i];
    if (model === 'gemini-4-hydrogen') {
      attempts.push({ model, timeoutMs: 10000 });
    } else {
      attempts.push({ model, timeoutMs: 22000 });
      attempts.push({ model, timeoutMs: 22000 });
    }
  }

  for (const { model, timeoutMs } of attempts) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: {
              thinkingLevel:
                model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
            },
            seed: 42,
          },
        }),
        timeoutMs,
        model
      );

      let rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Gemini returned an empty analysis response.');
      }

      if (rawText.startsWith('```')) {
        rawText = rawText
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();
      }

      const headLower = rawText.slice(0, 64).toLowerCase();
      if (headLower.startsWith('<!doctype') || headLower.startsWith('<html') || headLower.startsWith('<')) {
        throw new Error('Upstream AI service returned HTML instead of structured JSON.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('Gemini returned malformed JSON that could not be parsed.');
      }

      return validateAndNormalizeAnalysis(parsed, trimmedText);
    } catch (err: unknown) {
      lastErr = err;
      lastRawErr = err instanceof Error ? err.message : String(err);
      const errMsg = extractReadableErrorMessage(err);
      const combined = `${lastRawErr} ${errMsg}`;
      const isQuota = /RESOURCE_EXHAUSTED|429|Quota exceeded|rate limit/i.test(combined);
      const isOverloadedOrSlow = /503|UNAVAILABLE|high demand|timed out/i.test(combined);
      if (isQuota || (model === 'gemini-4-hydrogen' && isOverloadedOrSlow)) {
        modelCooldownUntil.set(model, Date.now() + 5 * 60 * 1000);
      }
      console.warn(`[physics-analyzer] model=${model} failed: ${errMsg.slice(0, 200)}`);
      const isTransient =
        isQuota ||
        /500|502|503|504|UNAVAILABLE|high demand|timed out|ECONNRESET|ETIMEDOUT|fetch failed|temporarily|empty analysis|malformed JSON|HTML instead of/i.test(
          combined
        );
      if (!isTransient) {
        break;
      }
      await sleep(150);
    }
  }

  const message = extractReadableErrorMessage(lastErr);
  const combined = `${lastRawErr} ${message}`;
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(combined)) {
    throw Object.assign(
      new Error('Gemini API key was rejected or lacks permission. Check Settings > Secrets.'),
      { status: 403, code: 'API_KEY_REJECTED' }
    );
  }
  if (/RESOURCE_EXHAUSTED|429|Quota exceeded/i.test(combined)) {
    throw Object.assign(
      new Error('Gemini API rate limit or daily free-tier quota reached. Please wait or add a billing-enabled key in Settings > Secrets.'),
      { status: 429, code: 'RATE_LIMITED' }
    );
  }
  if (/timed out/i.test(combined)) {
    throw Object.assign(
      new Error('The AI physics analyzer took too long to respond. Please try Analyze Question again.'),
      { status: 504, code: 'ANALYSIS_TIMEOUT' }
    );
  }
  if (/503|UNAVAILABLE|high demand/i.test(combined)) {
    throw Object.assign(
      new Error('The AI analysis model is temporarily overloaded (503). Please try again in a few seconds.'),
      { status: 503, code: 'SERVICE_UNAVAILABLE' }
    );
  }

  throw Object.assign(new Error(message), { status: 502, code: 'ANALYSIS_FAILED' });
}
