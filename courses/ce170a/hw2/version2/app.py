import streamlit as st
import json
import matplotlib.pyplot as plt
from anastruct import SystemElements
from numbers import Number

st.set_page_config(page_title="Custom Bridge SHM Sandbox", layout="wide")

st.title("🌉 Custom Bridge SHM Simulator")
st.markdown("""
Paste the JSON representation of your hand-drawn bridge below. 
Then, apply different load cases to see if the sensors you placed successfully monitor the critical members!
""")

# 1. Provide a Default JSON so it works out of the box
default_json = """{
  "nodes": [[0, 0], [4, 0], [8, 0], [12, 0], [2, 3], [6, 3], [10, 3]],
  "elements": [
    [1, 2], [2, 3], [3, 4], 
    [5, 6], [6, 7], 
    [1, 5], [2, 5], [2, 6], [3, 6], [3, 7], [4, 7]
  ],
  "supports": [
    {"node": 1, "type": "hinged"}, 
    {"node": 4, "type": "roller"}
  ],
  "sensors": [
    {"element": 8, "type": "strain_gauge"} 
  ]
}"""


def _to_float(value):
    """Return numeric values as float, otherwise None."""
    if isinstance(value, Number):
        return float(value)
    return None


def validate_bridge_data(data):
    if not isinstance(data, dict):
        raise ValueError("Top-level JSON must be an object.")

    required = ["nodes", "elements", "supports"]
    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError(f"Missing required keys: {', '.join(missing)}")

    nodes = data["nodes"]
    if not isinstance(nodes, list) or len(nodes) < 2:
        raise ValueError("'nodes' must be a list with at least two [x, y] entries.")

    for i, node in enumerate(nodes, start=1):
        if not isinstance(node, list) or len(node) != 2:
            raise ValueError(f"Node {i} must be [x, y].")
        if _to_float(node[0]) is None or _to_float(node[1]) is None:
            raise ValueError(f"Node {i} contains non-numeric coordinates.")

    n_nodes = len(nodes)
    elements = data["elements"]
    if not isinstance(elements, list) or len(elements) == 0:
        raise ValueError("'elements' must be a non-empty list of [node_i, node_j].")

    for i, el in enumerate(elements, start=1):
        if not isinstance(el, list) or len(el) != 2:
            raise ValueError(f"Element {i} must be [start_node, end_node].")
        n1, n2 = el
        if not isinstance(n1, int) or not isinstance(n2, int):
            raise ValueError(f"Element {i} node references must be integers.")
        if not (1 <= n1 <= n_nodes and 1 <= n2 <= n_nodes):
            raise ValueError(f"Element {i} references nodes outside 1..{n_nodes}.")

    supports = data["supports"]
    if not isinstance(supports, list) or len(supports) == 0:
        raise ValueError("'supports' must be a non-empty list.")

    allowed_supports = {"hinged", "roller", "fixed"}
    for i, sup in enumerate(supports, start=1):
        if not isinstance(sup, dict):
            raise ValueError(f"Support {i} must be an object.")
        node = sup.get("node")
        sup_type = sup.get("type")
        if not isinstance(node, int) or not (1 <= node <= n_nodes):
            raise ValueError(f"Support {i} has invalid node id.")
        if sup_type not in allowed_supports:
            raise ValueError(
                f"Support {i} has unsupported type '{sup_type}'. Use hinged, roller, or fixed."
            )

    sensors = data.get("sensors", [])
    if sensors is not None:
        if not isinstance(sensors, list):
            raise ValueError("'sensors' must be a list if provided.")
        n_elements = len(elements)
        for i, sensor in enumerate(sensors, start=1):
            if not isinstance(sensor, dict):
                raise ValueError(f"Sensor {i} must be an object.")
            el_id = sensor.get("element")
            if el_id is not None and (
                not isinstance(el_id, int) or not (1 <= el_id <= n_elements)
            ):
                raise ValueError(f"Sensor {i} references invalid element id.")


def build_system(data, ea, ei):
    ss = SystemElements(EA=ea, EI=ei)

    for el in data["elements"]:
        n1 = data["nodes"][el[0] - 1]
        n2 = data["nodes"][el[1] - 1]
        ss.add_element(location=[n1, n2])

    for sup in data["supports"]:
        sup_type = sup["type"]
        node_id = sup["node"]
        if sup_type == "hinged":
            ss.add_support_hinged(node_id=node_id)
        elif sup_type == "roller":
            # direction=2 keeps vertical translation restrained for typical 2D truss setup.
            ss.add_support_roll(node_id=node_id, direction=2)
        elif sup_type == "fixed":
            ss.add_support_fixed(node_id=node_id)

    return ss


def apply_loads(ss, load_case, single_car_load, heavy_bus_load, traffic_load):
    if load_case == "Single Car":
        ss.point_load(node_id=2, Fy=-single_car_load)
    elif load_case == "Heavy Bus":
        ss.point_load(node_id=3, Fy=-heavy_bus_load)
    elif load_case == "Bumper-to-Bumper Traffic":
        for i in range(1, 5):
            ss.point_load(node_id=i, Fy=-traffic_load)


def normalize_element_results(raw_results):
    if isinstance(raw_results, dict):
        rows = list(raw_results.values())
    elif isinstance(raw_results, list):
        rows = raw_results
    else:
        rows = []

    normalized = []
    for row in rows:
        if isinstance(row, dict):
            normalized.append(row)
    return normalized


def element_peak_abs_force(row):
    candidates = ["N", "N_1", "N_2", "Nmax", "Nmin"]
    vals = []
    for key in candidates:
        val = _to_float(row.get(key))
        if val is not None:
            vals.append(abs(val))
    return max(vals) if vals else None

# 2. UI Layout
col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("1. Bridge Geometry & Sensors")
    json_input = st.text_area("Bridge JSON Data:", value=default_json, height=300)

    st.subheader("2. Material / Section Parameters")
    ea = st.number_input("EA (axial stiffness)", min_value=1000.0, value=15000.0, step=500.0)
    ei = st.number_input("EI (bending stiffness)", min_value=100.0, value=5000.0, step=100.0)

    st.subheader("2. Load Case")
    load_case = st.radio("Select Traffic Condition:", ["Single Car", "Heavy Bus", "Bumper-to-Bumper Traffic"])

    single_car_load = st.slider("Single Car Load (kN)", 5, 80, 20)
    heavy_bus_load = st.slider("Heavy Bus Load (kN)", 20, 150, 60)
    traffic_load = st.slider("Traffic Load per deck node (kN)", 5, 60, 15)

    st.subheader("3. Result Diagrams")
    selected_plots = st.multiselect(
        "Select plots to display",
        options=[
            "Structure",
            "Axial Force",
            "Shear Force",
            "Bending Moment",
            "Displacement",
            "Reaction Forces",
        ],
        default=["Structure", "Axial Force", "Shear Force", "Bending Moment", "Reaction Forces"],
    )

    run_sim = st.button("Run FEA Simulation", type="primary")

with col2:
    if run_sim:
        try:
            data = json.loads(json_input)
            validate_bridge_data(data)
            ss = build_system(data, ea, ei)
            apply_loads(ss, load_case, single_car_load, heavy_bus_load, traffic_load)

            # Solve the system
            ss.solve()

            # Visualization
            st.subheader("Simulation Diagrams")

            plotters = {
                "Structure": lambda: ss.show_structure(show=False, figsize=(8, 4)),
                "Axial Force": lambda: ss.show_axial_force(show=False, figsize=(8, 4)),
                "Shear Force": lambda: ss.show_shear_force(show=False, figsize=(8, 4)),
                "Bending Moment": lambda: ss.show_bending_moment(show=False, figsize=(8, 4)),
                "Displacement": lambda: ss.show_displacement(show=False, figsize=(8, 4)),
                "Reaction Forces": lambda: ss.show_reaction_force(show=False, figsize=(8, 4)),
            }

            if not selected_plots:
                st.info("No diagrams selected. Choose at least one in the left panel.")

            for plot_name in selected_plots:
                make_plot = plotters.get(plot_name)
                if make_plot is None:
                    continue
                try:
                    st.markdown(f"**{plot_name}**")
                    fig = make_plot()
                    st.pyplot(fig)
                    plt.close(fig)
                except Exception as plot_error:
                    st.warning(f"Could not render '{plot_name}': {plot_error}")

            # Check Sensor Effectiveness
            st.subheader("Sensor Analysis Report")
            element_rows = normalize_element_results(ss.get_element_results())

            peak_rows = []
            for row in element_rows:
                peak = element_peak_abs_force(row)
                if peak is None:
                    continue
                peak_rows.append(
                    {
                        "id": row.get("id"),
                        "peak_abs_axial_kN": round(peak, 3),
                        "N": row.get("N"),
                        "N_1": row.get("N_1"),
                        "N_2": row.get("N_2"),
                    }
                )

            if not peak_rows:
                st.warning(
                    "Element results are available, but no numeric axial-force entries were found. "
                    "Check whether your model behaves like a pure truss and whether loads/supports are valid."
                )
            else:
                max_force_element = max(peak_rows, key=lambda x: x["peak_abs_axial_kN"])
                max_id = max_force_element["id"]
                max_val = max_force_element["peak_abs_axial_kN"]

                monitored_elements = [
                    s.get("element") for s in data.get("sensors", []) if isinstance(s, dict)
                ]

                if max_id in monitored_elements:
                    st.success(
                        f"Great job. Sensor coverage includes critical Element {max_id} "
                        f"with peak axial force {max_val} kN."
                    )
                else:
                    st.error(
                        f"Warning: sensors missed the current critical element. "
                        f"Peak axial force is {max_val} kN on Element {max_id}."
                    )

                st.markdown("**Top critical elements by |axial force|**")
                peak_rows_sorted = sorted(
                    peak_rows,
                    key=lambda x: x["peak_abs_axial_kN"],
                    reverse=True,
                )
                st.dataframe(peak_rows_sorted[: min(10, len(peak_rows_sorted))], use_container_width=True)

            with st.expander("Raw solver results", expanded=False):
                st.markdown("**Element Results**")
                st.json(element_rows)
                try:
                    node_results = ss.get_node_results_system()
                    st.markdown("**Node Results / Reactions**")
                    st.json(node_results)
                except Exception as node_error:
                    st.info(f"Node/reaction table unavailable: {node_error}")

        except Exception as e:
            st.error(f"Error parsing JSON or running simulation. Check your formatting. Details: {e}")