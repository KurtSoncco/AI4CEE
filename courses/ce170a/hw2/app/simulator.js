import bridgeData from "./bridge_data.js";

const TRUSS_EA = 15000;
const DEFAULT_VEHICLE_SPEED = 20;

const SENSOR_TYPES = {
  Accelerometer: { color: "purple", symbol: "triangle-up", size: 12 },
  "Strain Gauge": { color: "green", symbol: "square", size: 11 },
  Displacement: { color: "orange", symbol: "diamond", size: 12 },
};

const VEHICLE_STYLES = {
  "Passenger Cars": { width: 26, height: 14, color: "#4C78A8" },
  "Public Transit Bus": { width: 52, height: 20, color: "#F58518" },
  "Heavy Traffic Jam": { width: 42, height: 18, color: "#B00020" },
};

const state = {
  data: null,
  sensors: {},
  activeSensor: "Accelerometer",
  loadCase: "Passenger Cars",
  lastTelemetry: null,
  allLoadTelemetry: {},
  simulatedLoadCases: new Set(),
  deflectionStep: 0,
  deflectionExaggeration: 1,
};

function isZeroLengthMember(bridge, member) {
  const n1 = bridge.nodes[member[0] - 1];
  const n2 = bridge.nodes[member[1] - 1];
  return n1[0] === n2[0] && n1[1] === n2[1];
}

function membersAtJoint(bridge, jointId) {
  return bridge.members
    .map((member, idx) => ({ member, id: idx + 1 }))
    .filter(({ member }) => member.includes(jointId))
    .map(({ id }) => id);
}

function beamMidpointUySeries(memberId, nodeSeries, bridge) {
  const member = bridge.members[memberId - 1];
  const s1 = nodeSeries[String(member[0])] || [];
  const s2 = nodeSeries[String(member[1])] || [];
  if (!s1.length || !s2.length) return [];
  return s1.map((value, idx) => (value + s2[idx]) / 2);
}

function jointStrainSeries(jointId, memberSeries, bridge) {
  const memberIds = membersAtJoint(bridge, jointId);
  if (!memberIds.length) return [];
  const length = memberSeries[String(memberIds[0])]?.length || 0;
  const out = [];
  for (let step = 0; step < length; step += 1) {
    const strains = memberIds
      .map((mid) => (1e6 * memberSeries[String(mid)][step]) / TRUSS_EA)
      .filter((v) => Number.isFinite(v));
    out.push(strains.length ? strains.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0) : 0);
  }
  return out;
}

function resolveDisplacementSeries(targetObj, targetId, nodeSeries, bridge) {
  if (targetObj === "Joint") {
    return [...(nodeSeries[String(targetId)] || [])];
  }
  if (targetObj === "Beam") {
    return beamMidpointUySeries(Number(targetId), nodeSeries, bridge);
  }
  return [];
}

function verticalAccelerationSeries(displacementSeries, xPositions, vehicleSpeed) {
  if (displacementSeries.length < 2) return [...displacementSeries];
  const time = xPositions.map((x) => (x - xPositions[0]) / vehicleSpeed);
  const velocity = numericGradient(displacementSeries, time);
  return numericGradient(velocity, time);
}

function numericGradient(arr, spacing) {
  const out = new Array(arr.length).fill(0);
  for (let i = 0; i < arr.length; i += 1) {
    if (i === 0) {
      out[i] = (arr[1] - arr[0]) / (spacing[1] - spacing[0]);
    } else if (i === arr.length - 1) {
      out[i] = (arr[i] - arr[i - 1]) / (spacing[i] - spacing[i - 1]);
    } else {
      out[i] = (arr[i + 1] - arr[i - 1]) / (spacing[i + 1] - spacing[i - 1]);
    }
  }
  return out;
}

function extractSensorSeries(sim, sensors, bridge, xPositions, vehicleSpeed) {
  const { node_series: nodeSeries, member_series: memberSeries } = sim;
  const results = {};

  for (const [target, sType] of Object.entries(sensors)) {
    const [tObj, tId] = target.split("_");
    let series = [];

    if (sType === "Strain Gauge") {
      if (tObj === "Beam") {
        series = (memberSeries[tId] || []).map((n) => (1e6 * n) / TRUSS_EA);
      } else if (tObj === "Joint") {
        series = jointStrainSeries(Number(tId), memberSeries, bridge);
      }
    } else if (sType === "Displacement" || sType === "Accelerometer") {
      series = resolveDisplacementSeries(tObj, Number(tId), nodeSeries, bridge);
      if (sType === "Accelerometer" && series.length) {
        series = verticalAccelerationSeries(series, xPositions, vehicleSpeed);
      }
    }

    if (series.length) {
      results[target] = series;
    }
  }

  return results;
}

function summarizeTelemetry(sensors, simResults, loadCaseName, sim) {
  const units = {
    Displacement: "model units",
    "Strain Gauge": "microstrain",
    Accelerometer: "model units/s^2",
  };
  const peaks = [];

  for (const [target, values] of Object.entries(simResults)) {
    if (!values.length) continue;
    const peak = values.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0);
    peaks.push({
      target,
      sensor_type: sensors[target],
      peak,
      unit: units[sensors[target]] || "",
    });
  }

  const globalStrainPeaks = [];
  if (sim?.member_series) {
    for (const [memberId, series] of Object.entries(sim.member_series)) {
      const micro = series.map((n) => (1e6 * n) / TRUSS_EA);
      const peak = micro.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0);
      globalStrainPeaks.push({
        target: `Beam_${memberId}`,
        peak,
        unit: "microstrain",
      });
    }
    globalStrainPeaks.sort((a, b) => Math.abs(b.peak) - Math.abs(a.peak));
  }

  return {
    load_case: loadCaseName,
    sensor_count: Object.keys(sensors).length,
    peaks,
    global_strain_peaks: globalStrainPeaks.slice(0, 5),
  };
}

function updateBudget() {
  const count = Object.keys(state.sensors).length;
  const budget = state.data?.sensor_budget ?? 8;
  const el = document.getElementById("sensor-budget");
  el.textContent = `${count} / ${budget}`;
  el.classList.toggle("over", count > budget);
}

function renderPlacedSensors() {
  const list = document.getElementById("placed-sensors");
  const entries = Object.entries(state.sensors);

  if (!entries.length) {
    list.innerHTML = '<li class="muted">None yet.</li>';
    updateBudget();
    return;
  }

  list.innerHTML = entries
    .map(
      ([location, type]) =>
        `<li><span>${type} at ${location}</span><button type="button" data-remove="${location}">Remove</button></li>`,
    )
    .join("");

  list.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      delete state.sensors[btn.dataset.remove];
      renderPlacedSensors();
      drawBridge();
    });
  });

  updateBudget();
}

function buildBridgeTraces() {
  const bridge = state.data.bridge;
  const nodes = bridge.nodes;
  const traces = [];

  for (const member of bridge.members) {
    const n1 = nodes[member[0] - 1];
    const n2 = nodes[member[1] - 1];
    traces.push({
      x: [n1[0], n2[0]],
      y: [n1[1], n2[1]],
      mode: "lines",
      line: { color: "black", width: 3 },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  const midX = [];
  const midY = [];
  const midCustom = [];
  bridge.members.forEach((member, idx) => {
    if (isZeroLengthMember(bridge, member)) return;
    const n1 = nodes[member[0] - 1];
    const n2 = nodes[member[1] - 1];
    midX.push((n1[0] + n2[0]) / 2);
    midY.push((n1[1] + n2[1]) / 2);
    midCustom.push(`Beam_${idx + 1}`);
  });

  traces.push({
    x: midX,
    y: midY,
    mode: "markers",
    marker: { symbol: "diamond", size: 8, color: "lightgray" },
    customdata: midCustom,
    name: "Beams",
  });

  traces.push({
    x: nodes.map((n) => n[0]),
    y: nodes.map((n) => n[1]),
    mode: "markers",
    marker: { symbol: "circle", size: 8, color: "blue" },
    customdata: nodes.map((_, i) => `Joint_${i + 1}`),
    name: "Joints",
  });

  for (const [sensorType, config] of Object.entries(SENSOR_TYPES)) {
    const xs = [];
    const ys = [];
    const text = [];

    for (const [target, placedType] of Object.entries(state.sensors)) {
      if (placedType !== sensorType) continue;
      const [obj, idStr] = target.split("_");
      const id = Number(idStr);
      if (obj === "Joint") {
        xs.push(nodes[id - 1][0]);
        ys.push(nodes[id - 1][1]);
      } else if (obj === "Beam") {
        const member = bridge.members[id - 1];
        const n1 = nodes[member[0] - 1];
        const n2 = nodes[member[1] - 1];
        xs.push((n1[0] + n2[0]) / 2);
        ys.push((n1[1] + n2[1]) / 2);
      }
      text.push(`${sensorType} on ${target}`);
    }

    if (xs.length) {
      traces.push({
        x: xs,
        y: ys,
        mode: "markers",
        marker: {
          symbol: config.symbol,
          size: config.size,
          color: config.color,
          line: { width: 2, color: "black" },
        },
        text,
        hoverinfo: "text",
        name: sensorType,
      });
    }
  }

  return traces;
}

function drawBridge() {
  const layout = {
    xaxis: { visible: false },
    yaxis: { visible: false, scaleanchor: "x", scaleratio: 1 },
    margin: { l: 20, r: 20, t: 20, b: 20 },
    dragmode: false,
    height: 420,
  };

  return Plotly.react("bridge-chart", buildBridgeTraces(), layout, { responsive: true });
}

function globalMaxAbsUy(sim) {
  let maxUy = 0;
  for (const series of Object.values(sim.node_series)) {
    for (const uy of series) {
      maxUy = Math.max(maxUy, Math.abs(uy));
    }
  }
  return maxUy || 1;
}

function findWorstDeflectionStep(sim) {
  const nSteps = sim.x_positions.length;
  let bestStep = 0;
  let bestVal = 0;
  for (let step = 0; step < nSteps; step += 1) {
    const stepMax = getStepMaxUy(sim, step);
    if (stepMax >= bestVal) {
      bestVal = stepMax;
      bestStep = step;
    }
  }
  return bestStep;
}

function getStepMaxUy(sim, step) {
  let maxUy = 0;
  for (const series of Object.values(sim.node_series)) {
    maxUy = Math.max(maxUy, Math.abs(series[step] ?? 0));
  }
  return maxUy;
}

function computeDeflectionExaggeration(sim) {
  const bridge = state.data.bridge;
  const ys = bridge.nodes.map((node) => node[1]);
  const trussDepth = Math.max(...ys) - Math.min(...ys);
  const maxUy = globalMaxAbsUy(sim);
  return Math.max(1, (0.35 * trussDepth) / maxUy);
}

function deformedNodes(bridge, sim, stepIndex, exaggeration) {
  return bridge.nodes.map((node, idx) => {
    const uy = sim.node_series[String(idx + 1)]?.[stepIndex] ?? 0;
    return [node[0], node[1] + uy * exaggeration];
  });
}

function detectDeckY(bridge) {
  const counts = new Map();
  for (const [, y] of bridge.nodes) {
    const key = y.toFixed(6);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bestY = bridge.nodes[0][1];
  let bestCount = 0;
  for (const [yKey, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestY = Number(yKey);
    }
  }
  return bestY;
}

function buildDeflectionTraces(stepIndex) {
  const bridge = state.data.bridge;
  const sim = state.data.simulations[state.loadCase];
  const exaggeration = state.deflectionExaggeration;
  const original = bridge.nodes;
  const deformed = deformedNodes(bridge, sim, stepIndex, exaggeration);
  const deckY = detectDeckY(bridge);
  const loadX = sim.x_positions[stepIndex];
  const traces = [];

  for (const member of bridge.members) {
    if (isZeroLengthMember(bridge, member)) continue;
    const n1 = member[0] - 1;
    const n2 = member[1] - 1;
    traces.push({
      x: [original[n1][0], original[n2][0]],
      y: [original[n1][1], original[n2][1]],
      mode: "lines",
      line: { color: "#bbbbbb", width: 2, dash: "dash" },
      hoverinfo: "skip",
      showlegend: false,
    });
    traces.push({
      x: [deformed[n1][0], deformed[n2][0]],
      y: [deformed[n1][1], deformed[n2][1]],
      mode: "lines",
      line: { color: "#174a8b", width: 3 },
      hoverinfo: "skip",
      showlegend: false,
    });
  }

  traces.push({
    x: original.map((node) => node[0]),
    y: original.map((node) => node[1]),
    mode: "markers",
    marker: { symbol: "circle-open", size: 7, color: "#999999" },
    name: "Undeformed joints",
  });

  traces.push({
    x: deformed.map((node) => node[0]),
    y: deformed.map((node) => node[1]),
    mode: "markers",
    marker: { symbol: "circle", size: 7, color: "#174a8b" },
    name: "Deflected joints",
  });

  return traces;
}

function updateDeflectionStepInfo(stepIndex) {
  const sim = state.data.simulations[state.loadCase];
  const x = sim.x_positions[stepIndex];
  const stepMax = getStepMaxUy(sim, stepIndex);
  const globalMax = globalMaxAbsUy(sim);
  const worstStep = findWorstDeflectionStep(sim);
  const isWorst = stepIndex === worstStep;
  document.getElementById("deflection-step-info").textContent =
    `Step ${stepIndex + 1}/${sim.x_positions.length} · first vehicle at x=${x.toFixed(1)} · ` +
    `max |vertical deflection|=${stepMax.toFixed(3)} model units` +
    ` · shown at ×${state.deflectionExaggeration.toFixed(1)} exaggeration` +
    (isWorst ? " · worst global deflection at this step" : "") +
    ` · dataset peak=${globalMax.toFixed(3)} model units`;
}

function drawDeflectedShape(stepIndex = state.deflectionStep) {
  state.deflectionStep = stepIndex;
  const slider = document.getElementById("deflection-step-slider");
  if (slider) slider.value = String(stepIndex);
  updateDeflectionStepInfo(stepIndex);

  const bridge = state.data.bridge;
  const sim = state.data.simulations[state.loadCase];
  const deckY = detectDeckY(bridge);
  const loadX = sim.x_positions[stepIndex];

  Plotly.react(
    "deflection-chart",
    buildDeflectionTraces(stepIndex),
    {
      xaxis: { visible: false },
      yaxis: { visible: false, scaleanchor: "x", scaleratio: 1 },
      margin: { l: 20, r: 20, t: 20, b: 20 },
      dragmode: false,
      height: 420,
      showlegend: true,
      legend: { orientation: "h", y: -0.05 },
      shapes: [
        {
          type: "line",
          x0: loadX,
          x1: loadX,
          y0: deckY - 8,
          y1: deckY + 18,
          line: { color: "#B00020", width: 2, dash: "dot" },
        },
      ],
      annotations: [
        {
          x: loadX,
          y: deckY + 22,
          text: "First vehicle",
          showarrow: false,
          font: { size: 11, color: "#B00020" },
        },
      ],
    },
    { responsive: true },
  );
}

function setupDeflectionExplorer() {
  const sim = state.data.simulations[state.loadCase];
  const slider = document.getElementById("deflection-step-slider");
  state.deflectionExaggeration = computeDeflectionExaggeration(sim);
  slider.max = String(sim.x_positions.length - 1);
  slider.value = "0";
  state.deflectionStep = 0;

  slider.oninput = () => {
    drawDeflectedShape(Number(slider.value));
  };

  document.getElementById("deflection-worst-btn").onclick = () => {
    drawDeflectedShape(findWorstDeflectionStep(sim));
  };

  drawDeflectedShape(0);
}

function drawLoadCaseDiagram() {
  const loadCase = state.data.load_cases[state.loadCase];
  const style = VEHICLE_STYLES[state.loadCase];
  const magnitudes = Object.values(state.data.load_cases).map((lc) => Math.abs(lc.magnitude));
  const maxMag = Math.max(...magnitudes);

  const step = loadCase.spacing > 0 ? loadCase.spacing : style.width * 1.8;
  let xs = Array.from({ length: loadCase.n_vehicles }, (_, i) => i * step);
  const center = xs.length ? xs[xs.length - 1] / 2 : 0;
  xs = xs.map((x) => x - center);

  const wheelY = 6;
  const bodyY = 12;
  const arrowLen = 25 + 35 * (Math.abs(loadCase.magnitude) / maxMag);
  const arrowY = bodyY + style.height + 6;
  const roadMargin = style.width;

  const shapes = [
    {
      type: "line",
      x0: Math.min(...xs) - roadMargin,
      x1: Math.max(...xs) + roadMargin,
      y0: 0,
      y1: 0,
      line: { color: "gray", width: 4 },
    },
  ];

  const annotations = [
    {
      x: 0,
      y: arrowY + arrowLen + 10,
      text: `${Math.abs(loadCase.magnitude).toFixed(0)} kN per vehicle`,
      showarrow: false,
      font: { size: 12, color: "crimson" },
    },
  ];

  xs.forEach((x) => {
    shapes.push({
      type: "rect",
      x0: x - style.width / 2,
      x1: x + style.width / 2,
      y0: bodyY,
      y1: bodyY + style.height,
      line: { color: "black", width: 1 },
      fillcolor: style.color,
    });
    [x - style.width * 0.3, x + style.width * 0.3].forEach((wx) => {
      shapes.push({
        type: "circle",
        x0: wx - 4,
        x1: wx + 4,
        y0: wheelY - 4,
        y1: wheelY + 4,
        fillcolor: "black",
        line: { width: 0 },
      });
    });
    annotations.push({
      x,
      y: arrowY,
      ax: x,
      ay: arrowY + arrowLen,
      xref: "x",
      yref: "y",
      axref: "x",
      ayref: "y",
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1.3,
      arrowwidth: 2.5,
      arrowcolor: "crimson",
    });
  });

  Plotly.react(
    "load-chart",
    [],
    {
      shapes,
      annotations,
      xaxis: {
        visible: false,
        range: [Math.min(...xs) - roadMargin * 1.3, Math.max(...xs) + roadMargin * 1.3],
      },
      yaxis: {
        visible: false,
        scaleanchor: "x",
        scaleratio: 1,
        range: [-5, arrowY + arrowLen + 22],
      },
      height: 170,
      margin: { l: 10, r: 10, t: 10, b: 10 },
      showlegend: false,
    },
    { staticPlot: true, responsive: true },
  );
}

function renderTelemetryCharts(simResults) {
  const sim = state.data.simulations[state.loadCase];
  const x = sim.x_positions;
  const units = {
    Displacement: "Vertical deflection (model units)",
    "Strain Gauge": "Strain (microstrain)",
    Accelerometer: "Vertical acceleration (model units/s², quasi-static)",
  };

  const container = document.getElementById("telemetry-charts");
  container.innerHTML = "";

  for (const sensorType of Object.keys(SENSOR_TYPES)) {
    const traces = [];
    for (const [target, values] of Object.entries(simResults)) {
      if (state.sensors[target] !== sensorType) continue;
      traces.push({
        x,
        y: values,
        mode: "lines+markers",
        name: target,
        line: { color: SENSOR_TYPES[sensorType].color },
      });
    }
    if (!traces.length) continue;

    const block = document.createElement("div");
    block.className = "chart-block";
    const title = document.createElement("h4");
    title.textContent = `${sensorType} sensors`;
    const chart = document.createElement("div");
    chart.className = "telemetry-chart";
    block.append(title, chart);
    container.appendChild(block);

    Plotly.newPlot(
      chart,
      traces,
      {
        xaxis: { title: "Vehicle position along bridge (model x)" },
        yaxis: { title: units[sensorType] },
        hovermode: "x unified",
        height: 320,
        margin: { l: 60, r: 20, t: 20, b: 50 },
      },
      { responsive: true },
    );
  }
}

function runSimulation() {
  if (!Object.keys(state.sensors).length) {
    alert("Place at least one sensor before running the simulation.");
    return;
  }

  const sim = state.data.simulations[state.loadCase];
  const simResults = extractSensorSeries(
    sim,
    state.sensors,
    state.data.bridge,
    sim.x_positions,
    state.data.vehicle_speed ?? DEFAULT_VEHICLE_SPEED,
  );
  state.lastTelemetry = summarizeTelemetry(state.sensors, simResults, state.loadCase, sim);
  state.allLoadTelemetry[state.loadCase] = state.lastTelemetry;
  state.simulatedLoadCases.add(state.loadCase);

  document.getElementById("results-area").classList.remove("hidden");
  document.getElementById("results-title").textContent = `Sensor telemetry — ${state.loadCase}`;
  renderTelemetryCharts(simResults);

  window.dispatchEvent(
    new CustomEvent("shm:telemetry-updated", {
      detail: {
        telemetry: state.lastTelemetry,
        sensors: { ...state.sensors },
        hypothesis: document.getElementById("hypothesis-input").value.trim(),
      },
    }),
  );
}

function collectAiLiteracyFeedback() {
  const consultant = document.querySelector('input[name="ai-consultant-confidence"]:checked');
  const verify = document.querySelector('input[name="ai-verify-confidence"]:checked');

  return {
    ai_consultant_confidence: consultant ? Number(consultant.value) : null,
    ai_verify_confidence: verify ? Number(verify.value) : null,
    ai_helped_thinking: document.getElementById("ai-helped-thinking").value.trim(),
    ai_verified_or_disagreed: document.getElementById("ai-verified-or-disagreed").value.trim(),
    ai_still_to_learn: document.getElementById("ai-still-to-learn").value.trim(),
  };
}

function updateReflectStep() {
  const feedback = collectAiLiteracyFeedback();
  const hasRatings =
    feedback.ai_consultant_confidence !== null && feedback.ai_verify_confidence !== null;
  const hasOpenResponse =
    feedback.ai_helped_thinking.length > 0 ||
    feedback.ai_verified_or_disagreed.length > 0 ||
    feedback.ai_still_to_learn.length > 0;

  document.querySelector('[data-pbl="reflect"]').checked = hasRatings && hasOpenResponse;
}

function setupFeedbackControls() {
  const refreshPreviewIfVisible = () => {
    const preview = document.getElementById("export-preview");
    if (preview.classList.contains("hidden")) return;
    preview.textContent = JSON.stringify(buildExportPayload(), null, 2);
  };

  const onFeedbackChange = () => {
    updateReflectStep();
    refreshPreviewIfVisible();
  };

  document
    .querySelectorAll('input[name="ai-consultant-confidence"], input[name="ai-verify-confidence"]')
    .forEach((input) => input.addEventListener("change", onFeedbackChange));

  ["ai-helped-thinking", "ai-verified-or-disagreed", "ai-still-to-learn"].forEach((id) => {
    document.getElementById(id).addEventListener("input", onFeedbackChange);
  });
}

function buildExportPayload() {
  return {
    exported_at: new Date().toISOString(),
    hypothesis: document.getElementById("hypothesis-input").value.trim(),
    critique_log: document.getElementById("critique-log").value.trim(),
    sensor_budget: state.data.sensor_budget,
    sensors: state.sensors,
    load_case_telemetry: state.allLoadTelemetry,
    ai_literacy_feedback: collectAiLiteracyFeedback(),
    pbl_checks: Object.fromEntries(
      [...document.querySelectorAll("[data-pbl]")].map((el) => [el.dataset.pbl, el.checked]),
    ),
  };
}

function buildMarkdownSummary() {
  const payload = buildExportPayload();
  const sensorLines = Object.entries(payload.sensors)
    .map(([loc, type]) => `- ${type} at ${loc}`)
    .join("\n");

  const peakLines = Object.entries(payload.load_case_telemetry)
    .map(([caseName, summary]) => {
      const peaks = summary.peaks
        .map((p) => `  - ${p.target}: peak ${p.peak.toFixed(4)} ${p.unit}`)
        .join("\n");
      return `- **${caseName}**\n${peaks || "  - (no peaks)"}`;
    })
    .join("\n");

  return `# CE170A HW2 SHM evidence\n\n## Hypothesis\n${payload.hypothesis || "(not provided)"}\n\n## Sensor layout (${Object.keys(payload.sensors).length}/${payload.sensor_budget})\n${sensorLines || "(none)"}\n\n## Telemetry peaks\n${peakLines || "(run simulations first)"}\n\n## Critique log\n${payload.critique_log || "(not provided)"}\n\n## AI literacy feedback\n- Consultant confidence: ${formatRating(payload.ai_literacy_feedback.ai_consultant_confidence)}\n- Verify-before-trust confidence: ${formatRating(payload.ai_literacy_feedback.ai_verify_confidence)}\n\n### Where AI helped\n${payload.ai_literacy_feedback.ai_helped_thinking || "(not provided)"}\n\n### Where I verified or disagreed\n${payload.ai_literacy_feedback.ai_verified_or_disagreed || "(not provided)"}\n\n### Still to learn\n${payload.ai_literacy_feedback.ai_still_to_learn || "(not provided)"}\n`;
}

function formatRating(value) {
  return value === null ? "(not provided)" : `${value}/5`;
}

function setupControls() {
  const loadSelect = document.getElementById("load-case-select");
  loadSelect.innerHTML = Object.keys(state.data.load_cases)
    .map((name) => `<option value="${name}">${name}</option>`)
    .join("");
  loadSelect.value = state.loadCase;
  loadSelect.addEventListener("change", () => {
    state.loadCase = loadSelect.value;
    document.getElementById("load-case-desc").textContent =
      state.data.load_cases[state.loadCase].description;
    drawLoadCaseDiagram();
    setupDeflectionExplorer();
  });
  document.getElementById("load-case-desc").textContent =
    state.data.load_cases[state.loadCase].description;

  const radio = document.getElementById("sensor-radio");
  radio.innerHTML = Object.keys(SENSOR_TYPES)
    .map(
      (name, idx) =>
        `<label><input type="radio" name="active-sensor" value="${name}" ${idx === 0 ? "checked" : ""}/> ${name}</label>`,
    )
    .join("");
  radio.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      state.activeSensor = input.value;
    });
  });

  document.getElementById("clear-sensors-btn").addEventListener("click", () => {
    state.sensors = {};
    renderPlacedSensors();
    drawBridge();
  });

  document.getElementById("run-sim-btn").addEventListener("click", runSimulation);

  document.getElementById("export-json-btn").addEventListener("click", () => {
    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ce170a-hw2-shm-evidence.json";
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById("export-preview").textContent = JSON.stringify(payload, null, 2);
    document.getElementById("export-preview").classList.remove("hidden");
    document.querySelector('[data-pbl="export"]').checked = true;
  });

  document.getElementById("copy-markdown-btn").addEventListener("click", async () => {
    const md = buildMarkdownSummary();
    await navigator.clipboard.writeText(md);
    document.getElementById("export-preview").textContent = md;
    document.getElementById("export-preview").classList.remove("hidden");
    document.querySelector('[data-pbl="export"]').checked = true;
    alert("Markdown summary copied to clipboard.");
  });

  setupFeedbackControls();
}

function bindBridgeClickHandler() {
  const bridgeEl = document.getElementById("bridge-chart");
  if (typeof bridgeEl.on !== "function") {
    throw new Error("Bridge chart is not ready for sensor clicks yet.");
  }

  bridgeEl.on("plotly_click", (event) => {
    const target = event.points?.[0]?.customdata;
    if (!target || typeof target !== "string" || !target.includes("_")) return;

    const budget = state.data.sensor_budget ?? 8;
    if (!state.sensors[target] && Object.keys(state.sensors).length >= budget) {
      alert(`Sensor budget is ${budget}. Remove a sensor or revise your design.`);
      return;
    }

    state.sensors[target] = state.activeSensor;
    renderPlacedSensors();
    drawBridge();
    document.querySelector('[data-pbl="design"]').checked = true;
  });
}

function exposeLabApi() {
  window.shmLab = {
    getState: () => ({
      sensors: { ...state.sensors },
      hypothesis: document.getElementById("hypothesis-input").value.trim(),
      lastTelemetry: state.lastTelemetry,
      allLoadTelemetry: state.allLoadTelemetry,
      loadCase: state.loadCase,
      sensorBudget: state.data?.sensor_budget ?? 8,
    }),
    buildMarkdownSummary,
    buildExportPayload,
  };
}

async function init() {
  state.data = bridgeData;
  state.loadCase = Object.keys(state.data.load_cases)[0];

  setupControls();
  renderPlacedSensors();
  drawLoadCaseDiagram();
  setupDeflectionExplorer();

  await drawBridge();
  bindBridgeClickHandler();
  exposeLabApi();
}

function showStartupError(err) {
  console.error(err);
  const detail = err?.message ? `\n\nDetails: ${err.message}` : "";
  alert(
    "Failed to start the simulator. Use the GitHub Pages link or run a local server:\n" +
      "python3 -m http.server 8765\n" +
      "https://kurtsoncco.github.io/AI4CEE/courses/ce170a/hw2/app/" +
      detail,
  );
}

init().catch(showStartupError);
