const I35W_PRINCIPLES = [
  "Undersized gusset plates can yield locally while global bridge motion looks normal.",
  "Strain gauges on critical joints/plates catch material-level stress concentrations.",
  "Accelerometers and displacement sensors help with global motion but may miss local plate yielding.",
  "Heavy or queued traffic can redistribute load into unexpected panel points.",
];

export function buildCritiquePrompt({ hypothesis, sensors, telemetry, allLoadTelemetry }) {
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

function countByType(sensors) {
  const counts = { Accelerometer: 0, "Strain Gauge": 0, Displacement: 0 };
  for (const type of Object.values(sensors)) {
    if (type in counts) counts[type] += 1;
  }
  return counts;
}

function findUncoveredHighStrainPeaks(allLoadTelemetry, sensors) {
  const strainTargets = new Set(
    Object.entries(sensors)
      .filter(([, type]) => type === "Strain Gauge")
      .map(([loc]) => loc),
  );

  let best = null;
  for (const [caseName, summary] of Object.entries(allLoadTelemetry || {})) {
    for (const peak of summary.global_strain_peaks || []) {
      if (strainTargets.has(peak.target)) continue;
      if (!best || Math.abs(peak.peak) > Math.abs(best.peak)) {
        best = { ...peak, caseName };
      }
    }
  }
  return best;
}

export function buildRuleCritique({ hypothesis, sensors, telemetry, allLoadTelemetry, sensorBudget = 8 }) {
  const bullets = [];
  const counts = countByType(sensors);
  const sensorCount = Object.keys(sensors).length;
  const simulatedCases = Object.keys(allLoadTelemetry || {});

  if (!hypothesis?.trim()) {
    bullets.push(
      "Your hypothesis is empty. Which panel points or members on this truss behave like undersized gusset-plate details from the I-35W readings?",
    );
  }

  if (sensorCount === 0) {
    bullets.push(
      "You have not placed any sensors yet. Where would you put at least one local strain measurement versus one global motion sensor, and why?",
    );
    return formatCritique(bullets);
  }

  if (sensorCount > sensorBudget) {
    bullets.push(
      `You placed ${sensorCount} sensors but the budget is ${sensorBudget}. Which locations are essential for catching local joint yielding, and which are redundant?`,
    );
  }

  if (counts["Strain Gauge"] === 0) {
    bullets.push(
      "You have no strain gauges. How would your layout detect local axial yielding at a joint or member connection—the failure mode emphasized in the gusset-plate readings?",
    );
  }

  if (counts["Strain Gauge"] > 0 && counts.Accelerometer === 0 && counts.Displacement === 0) {
    bullets.push(
      "You rely only on strain gauges. What global motion or vibration signal would help you distinguish traffic loading from a developing local connection failure?",
    );
  }

  if (counts["Strain Gauge"] === 0 && (counts.Accelerometer > 0 || counts.Displacement > 0)) {
    bullets.push(
      "Your layout emphasizes global motion or deflection but includes no direct strain measurement. Could a gusset-plate-style failure develop without triggering those sensors first?",
    );
  }

  if (simulatedCases.length < 3) {
    const missing = ["Passenger Cars", "Public Transit Bus", "Heavy Traffic Jam"].filter(
      (name) => !simulatedCases.includes(name),
    );
    bullets.push(
      `You have not simulated all load cases yet (still missing: ${missing.join(", ")}). How do you know your layout captures the worst traffic scenario?`,
    );
  }

  const heavySummary = allLoadTelemetry?.["Heavy Traffic Jam"];
  if (heavySummary?.peaks?.length) {
    const maxPeak = heavySummary.peaks.reduce((best, p) =>
      Math.abs(p.peak) > Math.abs(best.peak) ? p : best,
    );
    const covered = Object.prototype.hasOwnProperty.call(sensors, maxPeak.target);
    if (!covered) {
      bullets.push(
        `In Heavy Traffic Jam, ${maxPeak.target} recorded the largest response among your current sensors (${maxPeak.peak.toFixed(2)} ${maxPeak.unit}), but you did not instrument that location. What member or joint nearby might still hide a worse peak?`,
      );
    }
  }

  const missedStrain = findUncoveredHighStrainPeaks(allLoadTelemetry, sensors);
  if (missedStrain && counts["Strain Gauge"] > 0) {
    bullets.push(
      `Your strain gauges may miss the strongest axial response seen in ${missedStrain.caseName} at ${missedStrain.target} (peak ${missedStrain.peak.toFixed(2)} ${missedStrain.unit}). What reading justifies leaving that member unmonitored?`,
    );
  }

  if (telemetry?.peaks?.length) {
    const onlyJoints = telemetry.peaks.every((p) => p.target.startsWith("Joint_"));
    const onlyBeams = telemetry.peaks.every((p) => p.target.startsWith("Beam_"));
    if (onlyJoints) {
      bullets.push(
        "All of your current sensors sit on joints. Which connecting member might carry the axial force you are not measuring directly?",
      );
    } else if (onlyBeams) {
      bullets.push(
        "All of your current sensors sit on members. Which joint deflection or rotation would confirm that the connection itself is behaving safely?",
      );
    }
  }

  if (bullets.length < 3) {
    bullets.push(
      "Compare your hypothesis to the simulated peaks. Which single sensor would you move first if this bridge had to stay open during a heavy traffic jam?",
    );
    bullets.push(
      "Which I-35W lesson (local plate yielding vs global motion) is best tested by your current layout, and what evidence from the readings supports that?",
    );
  }

  return formatCritique(bullets.slice(0, 5));
}

function formatCritique(bullets) {
  return [
    "Instant design critique (rule-based, grounded in your telemetry):",
    "",
    ...bullets.map((b, i) => `${i + 1}. ${b}`),
    "",
    "Revise your layout or defend your choices in the critique log before exporting your memo.",
  ].join("\n");
}
