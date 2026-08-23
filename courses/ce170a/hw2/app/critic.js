import { buildCritiquePrompt, buildRuleCritique } from "./rule-critic.js";

function setStatus(text, tone) {
  const el = document.getElementById("critic-status");
  el.textContent = text;
  el.className = `status-pill ${tone}`;
}

function showCritique(text) {
  document.getElementById("critic-output").textContent = text;
  document.getElementById("critic-output").classList.remove("hidden");
  document.getElementById("critique-log-area").classList.remove("hidden");
  document.querySelector('[data-pbl="critique"]').checked = true;
}

function getLabState() {
  return (
    window.shmLab?.getState?.() || {
      sensors: {},
      hypothesis: document.getElementById("hypothesis-input")?.value?.trim() || "",
      lastTelemetry: null,
      allLoadTelemetry: {},
      sensorBudget: 8,
    }
  );
}

document.getElementById("run-critic-btn").addEventListener("click", () => {
  const lab = getLabState();
  if (!Object.keys(lab.sensors).length) {
    alert("Place sensors and run at least one simulation before requesting a critique.");
    return;
  }

  const critique = buildRuleCritique({
    hypothesis: lab.hypothesis,
    sensors: lab.sensors,
    telemetry: lab.lastTelemetry,
    allLoadTelemetry: lab.allLoadTelemetry,
    sensorBudget: lab.sensorBudget ?? 8,
  });

  showCritique(critique);
  setStatus("Ready", "ready");
});

document.getElementById("copy-prompt-btn").addEventListener("click", async () => {
  const lab = getLabState();
  const prompt = buildCritiquePrompt({
    hypothesis: lab.hypothesis,
    sensors: lab.sensors,
    telemetry: lab.lastTelemetry,
    allLoadTelemetry: lab.allLoadTelemetry,
  });
  await navigator.clipboard.writeText(prompt);
  alert("Prompt copied. Paste into ChatGPT or Gemini for an optional second opinion.");
});

window.addEventListener("shm:telemetry-updated", () => {
  document.querySelector('[data-pbl="simulate"]').checked = true;
  const count = Object.keys(getLabState().allLoadTelemetry || {}).length;
  if (count >= 3) {
    document.querySelector('[data-pbl="simulate"]').checked = true;
  }
});

setStatus("Ready", "ready");
