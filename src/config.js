import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
}

export const config = {
  projectRoot,
  dataDir: resolve(projectRoot, 'data'),
  tmpDir: resolve(projectRoot, 'tmp'),

  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  logLevel: process.env.LOG_LEVEL ?? 'info',

  // Gemini (Google AI Studio)
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // When true (or when no API key is present) the pipeline uses the deterministic
  // fallback extractor instead of calling Gemini. The service must still work.
  disableLlm: bool(process.env.DISABLE_LLM) || !process.env.GEMINI_API_KEY,
};
