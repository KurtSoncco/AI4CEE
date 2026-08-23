#!/usr/bin/env python3
"""Precompute moving-load FEM results for the static GitHub Pages simulator."""

from __future__ import annotations

import json
from pathlib import Path

from shm_engine import DEFAULT_BRIDGE, LOAD_CASES, SIMULATION_STEPS, TRUSS_EA, VEHICLE_CROSSING_SPEED, run_full_simulation

OUTPUT_JSON = Path(__file__).resolve().parent.parent / "app" / "bridge_results.json"
OUTPUT_JS = Path(__file__).resolve().parent.parent / "app" / "bridge_data.js"


def main() -> None:
    payload = {
        "version": 1,
        "truss_ea": TRUSS_EA,
        "steps": SIMULATION_STEPS,
        "sensor_budget": 8,
        "vehicle_speed": VEHICLE_CROSSING_SPEED,
        "bridge": DEFAULT_BRIDGE,
        "load_cases": LOAD_CASES,
        "simulations": {},
    }

    for load_case_name in LOAD_CASES:
        print(f"Computing {load_case_name}...")
        x_positions, node_series, member_series = run_full_simulation(
            DEFAULT_BRIDGE,
            load_case_name,
            steps=SIMULATION_STEPS,
        )
        payload["simulations"][load_case_name] = {
            "x_positions": x_positions.tolist(),
            "node_series": {str(k): v for k, v in node_series.items()},
            "member_series": {str(k): v for k, v in member_series.items()},
        }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, separators=(",", ":"))
    OUTPUT_JSON.write_text(encoded)
    OUTPUT_JS.write_text(f"export default {encoded};\n")
    size_kb = OUTPUT_JSON.stat().st_size / 1024
    print(f"Wrote {OUTPUT_JSON} ({size_kb:.1f} KB)")
    print(f"Wrote {OUTPUT_JS}")


if __name__ == "__main__":
    main()
