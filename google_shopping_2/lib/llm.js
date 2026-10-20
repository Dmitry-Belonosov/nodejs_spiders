/**
 * Minimal Ollama client. One local model serves vision and decisions:
 * on 16 GB only one 8B model fits next to Chrome.
 */
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MODEL = process.env.LLM_MODEL || 'qwen3-vl:8b-instruct';

/**
 * chat({ prompt, images: [base64], format: jsonSchema, numPredict }) → string
 * With `format`, Ollama constrains the output to that JSON schema.
 */
async function chat({ prompt, system, images, format, numPredict = 256, timeoutMs = 120000, model = MODEL }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt, ...(images && images.length ? { images } : {}) });
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: process.env.LLM_KEEP_ALIVE || '30m',
      messages,
      ...(format ? { format } : {}),
      options: { temperature: 0, num_predict: numPredict },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return String((json.message && json.message.content) || '').trim();
}

async function chatJson(opts) {
  const text = await chat(opts);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`model returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function status() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const json = await res.json();
    const names = (json.models || []).map((m) => m.name);
    return { up: true, model: MODEL, modelInstalled: names.includes(MODEL) };
  } catch (e) {
    return { up: false, model: MODEL, modelInstalled: false };
  }
}

module.exports = { chat, chatJson, status, MODEL };
