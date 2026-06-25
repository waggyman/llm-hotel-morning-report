import { GoogleGenAI } from '@google/genai';

/**
 * LLM provider interface. Models depend on this shape, not on Gemini directly, so the
 * provider can be swapped without touching domain logic:
 *
 *   generateStructured({ system, prompt, schema }) -> Promise<object>
 *
 * The implementation forces JSON output against a response schema at temperature 0 so
 * extraction is as deterministic as the model allows. It never sees the assembly step —
 * its only job is to turn one messy entry into structured, schema-valid facts.
 */

/**
 * @param {{ apiKey: string, model: string, logger?: any, maxRetries?: number }} opts
 */
export function createGeminiClient({ apiKey, model, logger, maxRetries = 2 }) {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: `gemini:${model}`,

    /**
     * @param {{ system?: string, prompt: string, schema: object, thinkingBudget?: number }} req
     *   thinkingBudget: token budget for the model's internal "thinking". 0 disables it —
     *   use for mechanical tasks (grouping/classification) where it only adds latency.
     */
    async generateStructured({ system, prompt, schema, thinkingBudget }) {
      let lastErr;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: system,
              responseMimeType: 'application/json',
              responseSchema: schema,
              temperature: 0,
              ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
            },
          });
          const text = res.text;
          if (!text) throw new Error('empty response from model');
          return JSON.parse(text);
        } catch (err) {
          lastErr = err;
          logger?.warn(
            { attempt, err: err.message },
            'gemini generateStructured failed, retrying',
          );
        }
      }
      throw new Error(`gemini extraction failed after ${maxRetries + 1} attempts: ${lastErr?.message}`);
    },
  };
}
