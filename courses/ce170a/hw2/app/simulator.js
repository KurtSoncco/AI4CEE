const TRUSS_EA = 15000;
const DT = 0.1;

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
};

function isZeroLengthMember(bridge, member) {
  const n1 = bridge.nodes[member[0] - 1];
  const n2 = bridge.nodes[member[1] - 1];
  return n1[0] === n2[0] && n1[1] === n2[1];
}

function numericGradient(arr, dt) {
  const out = new Array(arr.length).fill(0);
  for (let i = 0; i < arr.length; i += 1) {
    if (i === 0) out[i] = (arr[1] - arr[0]) / dt;
    else if (i === arr.length - 1) out[i] = (arr[i] - arr[i - 1]) / dt;
    else out[i] = (arr[i + 1] - arr[i - 1]) / (2 * dt);
  }
  return out;
}

function extractSensorSeries(sim, sensors) {
  const { node_series: nodeSeries, member_series: memberSeries } = sim;
  const results = {};

  for (const [target, sType] of Object.entries(sensors)) {
    const [tObj, tId] = target.split("_");
    let series;

    if (tObj === "Joint") {
      series = [...(nodeSeries[tId] || [])];
    } else if (tObj === "Beam") {
      series = [...(memberSeries[tId] || [])];
      if (sType === "Strain Gauge") {
        series = series.map((n) => (1e6 * n) / TRUSS_EA);
      }
    } else {
      continue;
    }

    if (sType === "Accelerometer" && series.length) {
      const vel = numericGradient(series, DT);
      series = numericGradient(vel, DT);
    }

    results[target] = series;
  }

  return results;
}

function summarizeTelemetry(sensors, simResults, loadCaseName, sim) {
  const units = {
    Displacement: "m",
    "Strain Gauge": "microstrain",
    Accelerometer: "m/s^2",
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

  Plotly.react("bridge-chart", buildBridgeTraces(), layout, { responsive: true });
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
    Displacement: "Deflection (m)",
    "Strain Gauge": "Strain (microstrain)",
    Accelerometer: "Acceleration (m/s^2)",
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
        xaxis: { title: "Vehicle position along bridge (x)" },
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
  const simResults = extractSensorSeries(sim, state.sensors);
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

function buildExportPayload() {
  return {
    exported_at: new Date().toISOString(),
    hypothesis: document.getElementById("hypothesis-input").value.trim(),
    critique_log: document.getElementById("critique-log").value.trim(),
    sensor_budget: state.data.sensor_budget,
    sensors: state.sensors,
    load_case_telemetry: state.allLoadTelemetry,
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

  return `# CE170A HW2 SHM evidence\n\n## Hypothesis\n${payload.hypothesis || "(not provided)"}\n\n## Sensor layout (${Object.keys(payload.sensors).length}/${payload.sensor_budget})\n${sensorLines || "(none)"}\n\n## Telemetry peaks\n${peakLines || "(run simulations first)"}\n\n## Critique log\n${payload.critique_log || "(not provided)"}\n`;
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
}

async function init() {
  const response = await fetch("bridge_results.json");
  state.data = await response.json();
  state.loadCase = Object.keys(state.data.load_cases)[0];

  setupControls();
  renderPlacedSensors();
  drawBridge();
  drawLoadCaseDiagram();

  const bridgeEl = document.getElementById("bridge-chart");
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

init().catch((err) => {
  console.error(err);
  alert("Failed to load bridge_results.json. Serve this folder over HTTP (GitHub Pages or local server).");
});
