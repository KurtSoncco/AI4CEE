import {
  env,
  pipeline,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "onnx-community/gemma-3-270m-it-ONNX";

let generator = null;

async function loadGenerator() {
  if (generator) return generator;

  const configs = [
    { device: "webgpu", dtype: "q4", label: "WebGPU" },
    { device: "wasm", dtype: "q4", label: "WASM" },
  ];

  let lastError = null;
  for (const cfg of configs) {
    try {
      self.postMessage({
        type: "progress",
        message: `Loading Gemma 3 270M via ${cfg.label} (~300MB on first visit)...`,
      });
      generator = await pipeline("text-generation", MODEL_ID, {
        device: cfg.device,
        dtype: cfg.dtype,
      });
      self.postMessage({ type: "ready", backend: cfg.label });
      return generator;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load Gemma critic.");
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === "init") {
      await loadGenerator();
      return;
    }

    if (type === "generate") {
      const model = await loadGenerator();
      const result = await model(payload.prompt, {
        max_new_tokens: 220,
        temperature: 0.65,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false,
      });

      const text = Array.isArray(result)
        ? result[0]?.generated_text || String(result[0] || "")
        : result.generated_text || String(result);

      self.postMessage({ type: "result", text: text.trim() });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
