import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzePhysicsQuestionWithGemini } from './src/ai/geminiQuestionAnalyzer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.type('application/json').json({ ok: true, service: 'physics-lab-api' });
  });

  app.post('/api/analyze-question', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        questionText?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      const analysis = await analyzePhysicsQuestionWithGemini({
        questionText: typeof body.questionText === 'string' ? body.questionText : '',
        imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : undefined,
        imageMimeType: typeof body.imageMimeType === 'string' ? body.imageMimeType : undefined,
      });

      res.status(200).type('application/json').json({ analysis });
    } catch (err: unknown) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status: unknown }).status === 'number'
          ? (err as { status: number }).status
          : 500;
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string'
          ? (err as { code: string }).code
          : 'SERVER_ERROR';
      const message =
        err instanceof Error ? err.message : 'Unexpected server error during question analysis.';

      res.status(status).type('application/json').json({ error: message, code });
    }
  });

  app.all('/api/analyze-question', (req, res) => {
    res.status(405).type('application/json').json({
      error: `Method ${req.method} is not allowed on /api/analyze-question. Use POST with JSON.`,
      code: 'METHOD_NOT_ALLOWED',
    });
  });

  app.use('/api', (req, res) => {
    res.status(404).type('application/json').json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'API_NOT_FOUND',
    });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!req.path.startsWith('/api')) {
        next(err);
        return;
      }

      const errObj = err as { type?: string; status?: number; message?: string } | null;
      if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
        res.status(413).type('application/json').json({
          error: 'The uploaded image payload is too large (max 20 MB). Try a smaller or cropped image.',
          code: 'PAYLOAD_TOO_LARGE',
        });
        return;
      }
      if (errObj?.type === 'entity.parse.failed' || errObj?.status === 400) {
        res.status(400).type('application/json').json({
          error: 'Invalid JSON request body sent to /api/analyze-question.',
          code: 'INVALID_REQUEST_JSON',
        });
        return;
      }

      const status = typeof errObj?.status === 'number' ? errObj.status : 500;
      const message =
        typeof errObj?.message === 'string' && errObj.message.trim() !== ''
          ? errObj.message
          : 'Unexpected API server error.';
      res.status(status).type('application/json').json({
        error: message,
        code: 'API_MIDDLEWARE_ERROR',
      });
    }
  );

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get(/.*/, (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PHYSICS LAB server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PHYSICS LAB server:', err);
  process.exit(1);
});
