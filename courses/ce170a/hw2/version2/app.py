import streamlit as st
import plotly.graph_objects as go
import numpy as np
from collections import Counter

# Safely import anastruct
try:
    from anastruct import SystemElements
except ImportError:
    st.error("Missing dependency: anastruct. Please run `pip install anastruct`.")
    st.stop()

st.set_page_config(page_title="Bridge SHM Simulator", layout="wide")

st.title("🌉 Bridge SHM Simulator: Moving Load")
st.markdown(
    "Click a **joint** or **beam** on the diagram below to place the active sensor there. "
    "Then, in the panel underneath, pick a sensor type and a load case, and run the simulation "
    "to see how each sensor responds as traffic crosses the span."
)

SENSOR_TYPES = {
    "Accelerometer": {"color": "purple", "symbol": "triangle-up", "size": 20},
    "Strain Gauge": {"color": "green", "symbol": "square", "size": 18},
    "Displacement": {"color": "orange", "symbol": "diamond-cross", "size": 22},
}

LOAD_CASES = {
    "Passenger Cars": {
        "magnitude": -20.0, "n_vehicles": 1, "spacing": 0.0,
        "description": "A single light vehicle crossing the span.",
    },
    "Public Transit Bus": {
        "magnitude": -60.0, "n_vehicles": 1, "spacing": 0.0,
        "description": "A single heavier vehicle crossing the span.",
    },
    "Heavy Traffic Jam": {
        "magnitude": -80.0, "n_vehicles": 4, "spacing": 60.0,
        "description": "Several heavy vehicles queued bumper-to-bumper, moving together across the span.",
    },
}

default_bridge = {
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


def sensor_target_exists(target, bridge_data):
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


def is_zero_length_member(bridge_data, member):
    n1, n2 = bridge_data["nodes"][member[0] - 1], bridge_data["nodes"][member[1] - 1]
    return n1[0] == n2[0] and n1[1] == n2[1]


bridge_data = default_bridge

if "sensors" not in st.session_state:
    st.session_state.sensors = {}
elif not isinstance(st.session_state.sensors, dict):
    st.session_state.sensors = {}
else:
    st.session_state.sensors = {
        location: sensor_type
        for location, sensor_type in st.session_state.sensors.items()
        if isinstance(location, str)
        and "_" in location
        and location.split("_", 1)[1].isdigit()
        and sensor_type in SENSOR_TYPES
        and sensor_target_exists(location, bridge_data)
    }

def draw_bridge(data):
    fig = go.Figure()
    nodes = data["nodes"]

    # Draw Beams
    for i, member in enumerate(data["members"], start=1):
        n1, n2 = nodes[member[0] - 1], nodes[member[1] - 1]
        fig.add_trace(go.Scatter(x=[n1[0], n2[0]], y=[n1[1], n2[1]], mode="lines", line=dict(color="black", width=3), hoverinfo="skip", showlegend=False))

    # Clickable Beam Midpoints (zero-length members have no meaningful midpoint, skip them)
    mid_xs, mid_ys, mid_texts, mid_customdata = [], [], [], []
    for i, member in enumerate(data["members"], start=1):
        if is_zero_length_member(data, member):
            continue
        n1, n2 = nodes[member[0] - 1], nodes[member[1] - 1]
        mid_xs.append((n1[0] + n2[0]) / 2)
        mid_ys.append((n1[1] + n2[1]) / 2)
        mid_texts.append(f"Beam {i}")
        mid_customdata.append(f"Beam_{i}")

    fig.add_trace(go.Scatter(x=mid_xs, y=mid_ys, mode="markers+text", marker=dict(symbol="diamond", size=7, color="lightgray"), text=mid_texts, textposition="top center", customdata=mid_customdata, name="Clickable Beams"))

    # Clickable Joints
    node_xs, node_ys = [n[0] for n in nodes], [n[1] for n in nodes]
    node_texts = [f"Joint {i}" for i in range(1, len(nodes) + 1)]
    node_customdata = [f"Joint_{i}" for i in range(1, len(nodes) + 1)]

    fig.add_trace(go.Scatter(x=node_xs, y=node_ys, mode="markers+text", marker=dict(symbol="circle", size=7, color="blue"), text=node_texts, textposition="bottom center", customdata=node_customdata, name="Clickable Joints"))

    # Overlay Placed Sensors
    if st.session_state.sensors:
        for sensor_type, config in SENSOR_TYPES.items():
            s_xs, s_ys, s_hover = [], [], []
            for target, placed_type in st.session_state.sensors.items():
                if placed_type == sensor_type:
                    if not isinstance(target, str) or "_" not in target:
                        continue

                    target_obj, target_id = target.split("_", 1)
                    if not target_id.isdigit():
                        continue
                    target_id = int(target_id)
                    if target_obj == "Joint":
                        s_xs.append(nodes[target_id - 1][0])
                        s_ys.append(nodes[target_id - 1][1])
                    elif target_obj == "Beam":
                        member = data["members"][target_id - 1]
                        n1, n2 = nodes[member[0] - 1], nodes[member[1] - 1]
                        s_xs.append((n1[0] + n2[0]) / 2)
                        s_ys.append((n1[1] + n2[1]) / 2)
                    s_hover.append(f"{sensor_type} on {target}")

            if s_xs:
                fig.add_trace(go.Scatter(x=s_xs, y=s_ys, mode="markers", marker=dict(symbol=config["symbol"], size=config["size"], color=config["color"], line=dict(width=2, color="black")), name=sensor_type, text=s_hover, hoverinfo="text"))

    fig.update_layout(xaxis=dict(visible=False), yaxis=dict(visible=False, scaleanchor="x", scaleratio=1), margin=dict(l=20, r=20, t=20, b=20), clickmode="event+select", dragmode=False)
    return fig

# --- STRUCTURAL ANALYSIS ENGINE ---
def detect_deck_y(nodes):
    """The roadway/load path is the chord shared by the most nodes at a common y
    (robust to bridges where the lowest point is a single arch node, not a flat chord)."""
    y_counts = Counter(round(node[1], 6) for node in nodes)
    return max(y_counts, key=lambda y: y_counts[y])


def apply_supports(ss, bridge_data, node_id_map):
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


@st.cache_data(show_spinner="Running structural analysis...")
def run_full_simulation(bridge_data, load_case_name, steps=40):
    """Solves the FEM model at `steps` load positions and returns the full
    displacement/axial-force time series for every node and member, regardless
    of which sensors are currently placed. Cached per (bridge, load_case) so
    placing/removing sensors or re-running an already-seen combo is instant."""
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
        raise ValueError("Bridge must have at least 2 nodes on the roadway chord for the moving-load simulation.")

    deck_xs = [bridge_data["nodes"][i - 1][0] for i in deck_nodes]
    min_x, max_x = min(deck_xs), max(deck_xs)

    x_positions = np.linspace(min_x, max_x, steps)

    n_nodes = len(bridge_data["nodes"])
    n_members = len(bridge_data["members"])
    node_series = {i: [] for i in range(1, n_nodes + 1)}
    member_series = {i: [] for i in range(1, n_members + 1)}

    progress_bar = st.progress(0)

    for step_idx, x in enumerate(x_positions):
        ss = SystemElements(EA=15000, EI=5000)

        # Build structure, skipping zero-length members (anastruct can't compute
        # an orientation angle for two coincident nodes). anastruct automatically
        # merges nodes that share exact coordinates, so this is enough to treat
        # a coincident node pair as effectively one point mechanically.
        element_id_map = {}
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

        # Distribute each vehicle's load onto its bracketing deck nodes via the lever rule,
        # accumulating contributions per node before applying (a "Heavy Traffic Jam" can
        # place multiple vehicles in the same panel).
        node_loads = {}
        for v in range(n_vehicles):
            xv = x - v * spacing
            if xv < min_x - 1e-9 or xv > max_x + 1e-9:
                continue
            for i in range(len(deck_xs) - 1):
                if deck_xs[i] <= xv <= deck_xs[i + 1]:
                    L = deck_xs[i + 1] - deck_xs[i]
                    if L <= 0:
                        break
                    p_left = magnitude * (deck_xs[i + 1] - xv) / L
                    p_right = magnitude * (xv - deck_xs[i]) / L
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
                member_series[orig_member].append(0.0)  # zero-length member: no axial force to report
                continue
            try:
                elem_result = ss.get_element_results(element_id=anastruct_id)
                member_series[orig_member].append(elem_result["Nmax"] if elem_result else 0.0)
            except Exception:
                member_series[orig_member].append(0.0)

        progress_bar.progress((step_idx + 1) / steps)

    progress_bar.empty()
    return x_positions, node_series, member_series


def extract_sensor_series(node_series, member_series, sensors, dt=0.1):
    """Slice the cached full-structure results down to just the placed sensors,
    applying the Accelerometer double-differentiation as a final step."""
    results = {}
    for target, s_type in sensors.items():
        if not isinstance(target, str) or "_" not in target:
            continue
        t_obj, t_id_str = target.split("_", 1)
        if not t_id_str.isdigit():
            continue
        t_id = int(t_id_str)

        if t_obj == "Joint":
            series = list(node_series.get(t_id, []))
        elif t_obj == "Beam":
            series = list(member_series.get(t_id, []))
        else:
            continue

        if s_type == "Accelerometer" and series:
            accels = np.gradient(np.gradient(np.array(series), dt), dt)
            series = accels.tolist()

        results[target] = series
    return results

# --- BRIDGE DIAGRAM (full width, at the top) ---
# Read the active sensor before creating its widget (which is placed below the
# diagram) so a click here can be tagged with the correct sensor type; Streamlit
# widget state persists across reruns by key, so this is safe.
active_sensor = st.session_state.get("active_sensor", list(SENSOR_TYPES.keys())[0])

fig = draw_bridge(bridge_data)
fig.update_layout(height=500)
selection = st.plotly_chart(fig, on_select="rerun", selection_mode="points", key="bridge_chart", use_container_width=True)

if selection and hasattr(selection, "selection") and selection.selection.points:
    clicked_point = selection.selection.points[0]
    if "customdata" in clicked_point:
        customdata = clicked_point["customdata"]
        target = customdata[0] if isinstance(customdata, list) else customdata
        if isinstance(target, str) and "_" in target and st.session_state.sensors.get(target) != active_sensor:
            st.session_state.sensors[target] = active_sensor
            st.rerun()

st.divider()

# --- CONTROLS (below the diagram, since the bridge is long and wants the width) ---
col_load, col_tools, col_placed = st.columns([1, 1, 1.4])

with col_load:
    st.subheader("Load Case")
    load_case_name = st.selectbox("🚦 Load Case:", list(LOAD_CASES.keys()))
    st.caption(LOAD_CASES[load_case_name]["description"])

with col_tools:
    st.subheader("Sensor Tools")
    st.radio("🛠️ Active Sensor:", list(SENSOR_TYPES.keys()), key="active_sensor")
    if st.button("🗑️ Clear All Sensors"):
        st.session_state.sensors = {}
        st.rerun()

with col_placed:
    st.subheader("Placed Sensors")
    if not st.session_state.sensors:
        st.caption("None yet — click a joint or beam on the diagram above.")
    for location, s_type in list(st.session_state.sensors.items()):
        row_label, row_remove = st.columns([4, 1])
        row_label.write(f"- {s_type} at {location}")
        if row_remove.button("✕", key=f"remove_{location}"):
            del st.session_state.sensors[location]
            st.rerun()

st.divider()
# THE BIG BUTTON
run_sim = st.button("🚀 Run Moving Load Simulation", type="primary", use_container_width=True)

# --- RESULTS DASHBOARD ---
if run_sim:
    if not st.session_state.sensors:
        st.warning("Please place at least one sensor on the bridge before running the simulation!")
    else:
        st.divider()
        st.subheader(f"📈 Sensor Telemetry Data — {load_case_name}")

        try:
            load_positions, node_series, member_series = run_full_simulation(bridge_data, load_case_name)
        except ValueError as exc:
            st.error(f"Simulation cannot run for this bridge: {exc}")
            st.stop()

        sim_results = extract_sensor_series(node_series, member_series, st.session_state.sensors)

        units_by_type = {
            "Displacement": "Deflection (m)",
            "Strain Gauge": "Axial Force (kN)",
            "Accelerometer": "Acceleration (m/s^2)",
        }

        # Split plots by sensor type so each chart uses a single, meaningful unit.
        for sensor_type in SENSOR_TYPES:
            traces = []
            for sensor_target, data_array in sim_results.items():
                if st.session_state.sensors.get(sensor_target) != sensor_type:
                    continue

                traces.append(
                    go.Scatter(
                        x=load_positions,
                        y=data_array,
                        mode="lines+markers",
                        name=sensor_target,
                        line=dict(color=SENSOR_TYPES[sensor_type]["color"]),
                    )
                )

            if not traces:
                continue

            st.markdown(f"**{sensor_type} Sensors**")
            res_fig = go.Figure(data=traces)
            res_fig.update_layout(
                xaxis_title="Vehicle Position Along Bridge (X-coordinate)",
                yaxis_title=units_by_type[sensor_type],
                hovermode="x unified",
                height=360,
            )
            st.plotly_chart(res_fig, use_container_width=True)
