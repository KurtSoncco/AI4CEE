"""Shared structural health monitoring engine for bridge moving-load simulation."""

from __future__ import annotations

from collections import Counter
from typing import Any, Callable

import numpy as np
from anastruct import SystemElements

TRUSS_EA = 15000.0
TRUSS_EI = 5000
SIMULATION_STEPS = 40
# Quasi-static moving load: map each spatial step to elapsed time via crossing speed.
# Bridge coordinates and deflection share the same model length units.
VEHICLE_CROSSING_SPEED = 20.0

SENSOR_TYPES = {
    "Accelerometer": {"color": "purple", "symbol": "triangle-up", "size": 20},
    "Strain Gauge": {"color": "green", "symbol": "square", "size": 18},
    "Displacement": {"color": "orange", "symbol": "diamond-cross", "size": 22},
}

LOAD_CASES = {
    "Passenger Cars": {
        "magnitude": -20.0,
        "n_vehicles": 1,
        "spacing": 0.0,
        "description": "A single light vehicle crossing the span.",
    },
    "Public Transit Bus": {
        "magnitude": -60.0,
        "n_vehicles": 1,
        "spacing": 0.0,
        "description": "A single heavier vehicle crossing the span.",
    },
    "Heavy Traffic Jam": {
        "magnitude": -80.0,
        "n_vehicles": 4,
        "spacing": 60.0,
        "description": "Several heavy vehicles queued bumper-to-bumper, moving together across the span.",
    },
}

DEFAULT_BRIDGE = {
    "nodes": [
        [20.0, 83.0], [80.0, 83.0], [80.0, 46.0], [80.0, 46.0],
        [145.0, 83.0], [145.0, 48.0], [225.0, 83.0], [225.0, 43.0],
        [310.0, 83.0], [310.0, 40.0], [395.0, 83.0], [395.0, 28.0],
        [485.0, 83.0], [485.0, 3.0], [575.0, 83.0], [575.0, 33.0],
        [655.0, 83.0], [655.0, 38.0], [735.0, 83.0], [735.0, 41.0],
        [820.0, 83.0], [820.0, 46.0], [905.0, 83.0], [905.0, 46.0],
        [985.0, 83.0], [985.0, 43.0], [1065.0, 83.0], [1065.0, 36.0],
        [1145.0, 83.0], [1145.0, 23.0], [1230.0, 83.0], [1230.0, 0.0],
        [1310.0, 83.0], [1310.0, 30.0], [1390.0, 83.0], [1390.0, 36.0],
        [1475.0, 83.0], [1475.0, 43.0], [1555.0, 83.0], [1555.0, 46.0],
        [1635.0, 83.0], [1635.0, 48.0], [1710.0, 83.0],
    ],
    "members": [
        [1, 2], [2, 5], [5, 7], [7, 9], [9, 11], [11, 13], [13, 15], [15, 17], [17, 19], [19, 21],
        [21, 23], [23, 25], [25, 27], [27, 29], [29, 31], [31, 33], [33, 35], [35, 37], [37, 39], [39, 41],
        [41, 43],
        [4, 6], [6, 8], [8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20], [20, 22], [22, 24],
        [24, 26], [26, 28], [28, 30], [30, 32], [32, 34], [34, 36], [36, 38], [38, 40], [40, 42],
        [1, 4], [43, 42], [3, 4],
        [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24],
        [25, 26], [27, 28], [29, 30], [31, 32], [33, 34], [35, 36], [37, 38], [39, 40], [41, 42],
        [3, 2], [4, 5], [5, 8], [8, 9], [9, 12], [12, 13], [15, 18], [18, 19], [19, 22], [22, 23],
        [23, 26], [26, 27], [31, 34], [34, 35], [35, 38], [38, 39], [39, 42], [13, 16], [27, 30], [30, 31],
    ],
    "supports": [
        {"node": 4, "ux": True, "uy": True},
        {"node": 14, "ux": False, "uy": True},
        {"node": 32, "ux": False, "uy": True},
        {"node": 42, "ux": False, "uy": True},
    ],
}

SENSOR_BUDGET = 8


def sensor_target_exists(target: str, bridge_data: dict[str, Any]) -> bool:
    if not isinstance(target, str) or "_" not in target:
        return False
    obj, id_str = target.split("_", 1)
    if not id_str.isdigit():
        return False

    target_id = int(id_str)
    if obj == "Joint":
        return 1 <= target_id <= len(bridge_data["nodes"])
    if obj == "Beam":
        return 1 <= target_id <= len(bridge_data["members"])
    return False


def is_zero_length_member(bridge_data: dict[str, Any], member: list[int]) -> bool:
    n1, n2 = bridge_data["nodes"][member[0] - 1], bridge_data["nodes"][member[1] - 1]
    return n1[0] == n2[0] and n1[1] == n2[1]


def detect_deck_y(nodes: list[list[float]]) -> float:
    y_counts = Counter(round(node[1], 6) for node in nodes)
    return max(y_counts, key=lambda y: y_counts[y])


def apply_supports(ss: SystemElements, bridge_data: dict[str, Any], node_id_map: dict[int, int]) -> None:
    for sup in bridge_data["supports"]:
        anastruct_id = node_id_map.get(sup["node"])
        if anastruct_id is None:
            continue
        if sup["ux"] and sup["uy"]:
            ss.add_support_hinged(node_id=anastruct_id)
        elif sup["uy"]:
            ss.add_support_roll(node_id=anastruct_id, direction=2)
        elif sup["ux"]:
            ss.add_support_roll(node_id=anastruct_id, direction=1)


def run_full_simulation(
    bridge_data: dict[str, Any],
    load_case_name: str,
    steps: int = SIMULATION_STEPS,
    progress_callback: Callable[[float], None] | None = None,
) -> tuple[np.ndarray, dict[int, list[float]], dict[int, list[float]]]:
    load_case = LOAD_CASES[load_case_name]
    magnitude = load_case["magnitude"]
    n_vehicles = load_case["n_vehicles"]
    spacing = load_case["spacing"]

    deck_y = detect_deck_y(bridge_data["nodes"])
    deck_nodes = [
        idx + 1
        for idx, node in enumerate(bridge_data["nodes"])
        if abs(node[1] - deck_y) < 1e-6
    ]
    deck_nodes = sorted(deck_nodes, key=lambda node_id: bridge_data["nodes"][node_id - 1][0])
    if len(deck_nodes) < 2:
        raise ValueError(
            "Bridge must have at least 2 nodes on the roadway chord for the moving-load simulation."
        )

    deck_xs = [bridge_data["nodes"][i - 1][0] for i in deck_nodes]
    min_x, max_x = min(deck_xs), max(deck_xs)

    x_positions = np.linspace(min_x, max_x, steps)

    n_nodes = len(bridge_data["nodes"])
    n_members = len(bridge_data["members"])
    node_series: dict[int, list[float]] = {i: [] for i in range(1, n_nodes + 1)}
    member_series: dict[int, list[float]] = {i: [] for i in range(1, n_members + 1)}

    for step_idx, x in enumerate(x_positions):
        ss = SystemElements(EA=TRUSS_EA, EI=TRUSS_EI)

        element_id_map: dict[int, int] = {}
        for m_idx, member in enumerate(bridge_data["members"], start=1):
            if is_zero_length_member(bridge_data, member):
                continue
            n1 = bridge_data["nodes"][member[0] - 1]
            n2 = bridge_data["nodes"][member[1] - 1]
            element_id_map[m_idx] = ss.add_element(location=[n1, n2])

        node_id_map = {
            i + 1: ss.find_node_id(bridge_data["nodes"][i]) for i in range(n_nodes)
        }

        apply_supports(ss, bridge_data, node_id_map)

        node_loads: dict[int, float] = {}
        for v in range(n_vehicles):
            xv = x - v * spacing
            if xv < min_x - 1e-9 or xv > max_x + 1e-9:
                continue
            for i in range(len(deck_xs) - 1):
                if deck_xs[i] <= xv <= deck_xs[i + 1]:
                    span = deck_xs[i + 1] - deck_xs[i]
                    if span <= 0:
                        break
                    p_left = magnitude * (deck_xs[i + 1] - xv) / span
                    p_right = magnitude * (xv - deck_xs[i]) / span
                    nid_left = node_id_map[deck_nodes[i]]
                    nid_right = node_id_map[deck_nodes[i + 1]]
                    node_loads[nid_left] = node_loads.get(nid_left, 0.0) + p_left
                    node_loads[nid_right] = node_loads.get(nid_right, 0.0) + p_right
                    break

        for anastruct_id, fy in node_loads.items():
            ss.point_load(node_id=anastruct_id, Fy=fy)

        ss.solve()

        for orig_node in range(1, n_nodes + 1):
            anastruct_id = node_id_map[orig_node]
            try:
                disp = ss.get_node_displacements(node_id=anastruct_id)
                node_series[orig_node].append(disp["uy"] if disp else 0.0)
            except Exception:
                node_series[orig_node].append(0.0)

        for orig_member in range(1, n_members + 1):
            anastruct_id = element_id_map.get(orig_member)
            if anastruct_id is None:
                member_series[orig_member].append(0.0)
                continue
            try:
                elem_result = ss.get_element_results(element_id=anastruct_id)
                member_series[orig_member].append(elem_result["Nmax"] if elem_result else 0.0)
            except Exception:
                member_series[orig_member].append(0.0)

        if progress_callback is not None:
            progress_callback((step_idx + 1) / steps)

    return x_positions, node_series, member_series


def members_at_joint(bridge_data: dict[str, Any], joint_id: int) -> list[int]:
    return [
        idx
        for idx, member in enumerate(bridge_data["members"], start=1)
        if joint_id in member
    ]


def beam_midpoint_uy_series(
    member_id: int,
    node_series: dict[int, list[float]],
    bridge_data: dict[str, Any],
) -> list[float]:
    member = bridge_data["members"][member_id - 1]
    n1, n2 = member[0], member[1]
    s1 = node_series.get(n1, [])
    s2 = node_series.get(n2, [])
    if not s1 or not s2:
        return []
    return [(a + b) / 2 for a, b in zip(s1, s2)]


def joint_strain_series(
    joint_id: int,
    member_series: dict[int, list[float]],
    bridge_data: dict[str, Any],
) -> list[float]:
    member_ids = members_at_joint(bridge_data, joint_id)
    if not member_ids:
        return []

    length = len(member_series[member_ids[0]])
    out: list[float] = []
    for step in range(length):
        strains = [
            1e6 * member_series[mid][step] / TRUSS_EA
            for mid in member_ids
            if mid in member_series and len(member_series[mid]) > step
        ]
        out.append(max(strains, key=abs) if strains else 0.0)
    return out


def vertical_acceleration_series(
    displacement_series: list[float],
    x_positions: np.ndarray,
    vehicle_speed: float = VEHICLE_CROSSING_SPEED,
) -> list[float]:
    if len(displacement_series) < 2:
        return list(displacement_series)
    time = (np.asarray(x_positions, dtype=float) - float(x_positions[0])) / vehicle_speed
    disp = np.asarray(displacement_series, dtype=float)
    return np.gradient(np.gradient(disp, time), time).tolist()


def resolve_displacement_series(
    target_obj: str,
    target_id: int,
    node_series: dict[int, list[float]],
    bridge_data: dict[str, Any],
) -> list[float]:
    if target_obj == "Joint":
        return list(node_series.get(target_id, []))
    if target_obj == "Beam":
        return beam_midpoint_uy_series(target_id, node_series, bridge_data)
    return []


def extract_sensor_series(
    node_series: dict[int, list[float]],
    member_series: dict[int, list[float]],
    sensors: dict[str, str],
    bridge_data: dict[str, Any],
    x_positions: np.ndarray,
    vehicle_speed: float = VEHICLE_CROSSING_SPEED,
) -> dict[str, list[float]]:
    results: dict[str, list[float]] = {}
    for target, s_type in sensors.items():
        if not isinstance(target, str) or "_" not in target:
            continue
        t_obj, t_id_str = target.split("_", 1)
        if not t_id_str.isdigit():
            continue
        t_id = int(t_id_str)

        if s_type == "Strain Gauge":
            if t_obj == "Beam":
                series = [
                    1e6 * n / TRUSS_EA for n in member_series.get(t_id, [])
                ]
            elif t_obj == "Joint":
                series = joint_strain_series(t_id, member_series, bridge_data)
            else:
                continue
        elif s_type in {"Displacement", "Accelerometer"}:
            series = resolve_displacement_series(t_obj, t_id, node_series, bridge_data)
            if s_type == "Accelerometer" and series:
                series = vertical_acceleration_series(series, x_positions, vehicle_speed)
        else:
            continue

        results[target] = series
    return results


def summarize_telemetry(
    sensors: dict[str, str],
    sim_results: dict[str, list[float]],
    load_case_name: str,
) -> dict[str, Any]:
    units_by_type = {
        "Displacement": "model units",
        "Strain Gauge": "microstrain",
        "Accelerometer": "model units/s^2",
    }
    peaks = []
    for target, values in sim_results.items():
        sensor_type = sensors.get(target, "Unknown")
        if not values:
            continue
        peak = max(values, key=abs)
        peaks.append(
            {
                "target": target,
                "sensor_type": sensor_type,
                "peak": float(peak),
                "unit": units_by_type.get(sensor_type, ""),
            }
        )
    return {
        "load_case": load_case_name,
        "sensor_count": len(sensors),
        "peaks": peaks,
    }
