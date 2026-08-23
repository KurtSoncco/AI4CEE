const I35W_PRINCIPLES = [
  "Undersized gusset plates can yield locally while global bridge motion looks normal.",
  "Strain gauges on critical joints/plates catch material-level stress concentrations.",
  "Accelerometers and displacement sensors help with global motion but may miss local plate yielding.",
  "Heavy or queued traffic can redistribute load into unexpected panel points.",
];

function buildCritiquePrompt({ hypothesis, sensors, telemetry, allLoadTelemetry }) {
  const sensorLines = Object.entries(sensors)
    .map(([loc, type]) => `- ${type} at ${loc}`)
    .join("\n");

  const peakLines = Object.entries(allLoadTelemetry || {})
    .map(([caseName, summary]) => {
      const peaks = (summary.peaks || [])
        .map((p) => `${p.target}: peak ${p.peak.toFixed(4)} ${p.unit}`)
        .join("; ");
      return `- ${caseName}: ${peaks || "no peaks recorded"}`;
    })
    .join("\n");

  const currentPeaks = (telemetry?.peaks || [])
    .map((p) => `${p.target}: peak ${p.peak.toFixed(4)} ${p.unit}`)
    .join("; ");

  return `You are an SHM teaching assistant for a civil engineering lab.

Rules:
- Do NOT provide an optimal sensor map or numbered list of exact joints to instrument.
- Ask 3-5 short Socratic questions or critique bullets.
- Ground comments in the student's layout and the measured peaks below.
- Reference these I-35W lessons only as general principles: ${I35W_PRINCIPLES.join(" ")}

Student hypothesis:
${hypothesis || "(none provided yet)"}

Current sensor layout:
${sensorLines || "(no sensors placed)"}

Latest load case (${telemetry?.load_case || "none"}): ${currentPeaks || "no simulation run yet"}

All simulated load cases:
${peakLines || "(student has not run all load cases yet)"}

Respond with concise critique questions the student should answer in their memo.`;
}

function setStatus(text, tone) {
  const el = document.getElementById("critic-status");
  el.textContent = text;
  el.className = `status-pill ${tone}`;
}

let worker = null;
let criticReady = false;

function ensureFallbackPrompt() {
  const lab = window.shmLab?.getState?.() || {
    sensors: {},
    hypothesis: document.getElementById("hypothesis-input")?.value?.trim() || "",
    lastTelemetry: null,
    allLoadTelemetry: {},
  };

  const prompt = buildCritiquePrompt(lab);
  document.getElementById("fallback-prompt").value = prompt;
  document.getElementById("fallback-area").classList.remove("hidden");
  return prompt;
}

function attachWorker() {
  worker = new Worker(new URL("./critic-worker.js", import.meta.url), { type: "module" });

  worker.onmessage = (event) => {
    const { type, message, text, backend } = event.data;

    if (type === "progress") {
      document.getElementById("critic-progress").textContent = message;
      document.getElementById("critic-progress").classList.remove("hidden");
      setStatus("Loading", "loading");
      return;
    }

    if (type === "ready") {
      criticReady = true;
      document.getElementById("critic-progress").classList.add("hidden");
      document.getElementById("run-critic-btn").disabled = false;
      setStatus(`Ready (${backend || "loaded"})`, "ready");
      return;
    }

    if (type === "result") {
      document.getElementById("critic-output").textContent = text;
      document.getElementById("critic-output").classList.remove("hidden");
      document.getElementById("critique-log-area").classList.remove("hidden");
      document.querySelector('[data-pbl="critique"]').checked = true;
      document.getElementById("run-critic-btn").disabled = false;
      setStatus("Ready", "ready");
      return;
    }

    if (type === "error") {
      document.getElementById("critic-progress").textContent = message;
      document.getElementById("critic-progress").classList.remove("hidden");
      setStatus("Fallback mode", "error");
      ensureFallbackPrompt();
      document.getElementById("run-critic-btn").disabled = false;
    }
  };
}

document.getElementById("load-critic-btn").addEventListener("click", () => {
  if (!worker) attachWorker();
  setStatus("Loading", "loading");
  worker.postMessage({ type: "init" });
});

document.getElementById("run-critic-btn").addEventListener("click", () => {
  const lab = window.shmLab?.getState?.();
  if (!lab || !Object.keys(lab.sensors).length) {
    alert("Place sensors and run at least one simulation before requesting a critique.");
    return;
  }

  const prompt = buildCritiquePrompt({
    hypothesis: lab.hypothesis,
    sensors: lab.sensors,
    telemetry: lab.lastTelemetry,
    allLoadTelemetry: lab.allLoadTelemetry,
  });

  if (!worker || !criticReady) {
    document.getElementById("fallback-prompt").value = prompt;
    document.getElementById("fallback-area").classList.remove("hidden");
    alert("Gemma is not loaded yet. Use the fallback prompt or click Load Gemma critic first.");
    return;
  }

  document.getElementById("run-critic-btn").disabled = true;
  setStatus("Generating", "loading");
  worker.postMessage({ type: "generate", payload: { prompt } });
});

document.getElementById("copy-fallback-btn").addEventListener("click", async () => {
  const prompt = ensureFallbackPrompt();
  await navigator.clipboard.writeText(prompt);
  alert("Fallback prompt copied.");
});

window.addEventListener("shm:telemetry-updated", () => {
  document.querySelector('[data-pbl="simulate"]').checked = true;
  if (window.shmLab?.getState?.().allLoadTelemetry) {
    const count = Object.keys(window.shmLab.getState().allLoadTelemetry).length;
    if (count >= 3) {
      document.querySelector('[data-pbl="simulate"]').checked = true;
    }
  }
});
