import streamlit as st
import plotly.graph_objects as go

try:
    from shm_engine import (
        DEFAULT_BRIDGE,
        LOAD_CASES,
        SENSOR_TYPES,
        extract_sensor_series,
        is_zero_length_member,
        run_full_simulation,
        sensor_target_exists,
    )
except ImportError:
    st.error("Missing module: shm_engine. Run from courses/ce170a/hw2/version2/.")
    st.stop()

st.set_page_config(page_title="Bridge SHM Simulator", layout="wide")

st.title("Bridge SHM Simulator: Moving Load")
st.markdown(
    "Click a **joint** or **beam** on the diagram below to place the active sensor there. "
    "Then pick a sensor type and load case, and run the simulation "
    "to see how each sensor responds as traffic crosses the span."
)
st.info(
    "Students should use the always-on GitHub Pages lab at "
    "`courses/ce170a/hw2/app/`. This Streamlit build is for instructors "
    "regenerating physics locally."
)

bridge_data = DEFAULT_BRIDGE

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

    for member in data["members"]:
        n1, n2 = nodes[member[0] - 1], nodes[member[1] - 1]
        fig.add_trace(
            go.Scatter(
                x=[n1[0], n2[0]],
                y=[n1[1], n2[1]],
                mode="lines",
                line=dict(color="black", width=3),
                hoverinfo="skip",
                showlegend=False,
            )
        )

    mid_xs, mid_ys, mid_customdata = [], [], []
    for i, member in enumerate(data["members"], start=1):
        if is_zero_length_member(data, member):
            continue
        n1, n2 = nodes[member[0] - 1], nodes[member[1] - 1]
        mid_xs.append((n1[0] + n2[0]) / 2)
        mid_ys.append((n1[1] + n2[1]) / 2)
        mid_customdata.append(f"Beam_{i}")

    fig.add_trace(
        go.Scatter(
            x=mid_xs,
            y=mid_ys,
            mode="markers+text",
            marker=dict(symbol="diamond", size=7, color="lightgray"),
            textposition="top center",
            customdata=mid_customdata,
            name="Clickable Beams",
        )
    )

    node_xs, node_ys = [n[0] for n in nodes], [n[1] for n in nodes]
    node_customdata = [f"Joint_{i}" for i in range(1, len(nodes) + 1)]

    fig.add_trace(
        go.Scatter(
            x=node_xs,
            y=node_ys,
            mode="markers+text",
            marker=dict(symbol="circle", size=7, color="blue"),
            textposition="bottom center",
            customdata=node_customdata,
            name="Clickable Joints",
        )
    )

    if st.session_state.sensors:
        for sensor_type, config in SENSOR_TYPES.items():
            s_xs, s_ys, s_hover = [], [], []
            for target, placed_type in st.session_state.sensors.items():
                if placed_type != sensor_type:
                    continue
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
                fig.add_trace(
                    go.Scatter(
                        x=s_xs,
                        y=s_ys,
                        mode="markers",
                        marker=dict(
                            symbol=config["symbol"],
                            size=config["size"],
                            color=config["color"],
                            line=dict(width=2, color="black"),
                        ),
                        name=sensor_type,
                        text=s_hover,
                        hoverinfo="text",
                    )
                )

    fig.update_layout(
        xaxis=dict(visible=False),
        yaxis=dict(visible=False, scaleanchor="x", scaleratio=1),
        margin=dict(l=20, r=20, t=20, b=20),
        clickmode="event+select",
        dragmode=False,
    )
    return fig


VEHICLE_STYLES = {
    "Passenger Cars": {"width": 26, "height": 14, "color": "#4C78A8"},
    "Public Transit Bus": {"width": 52, "height": 20, "color": "#F58518"},
    "Heavy Traffic Jam": {"width": 42, "height": 18, "color": "#B00020"},
}

MAX_LOAD_CASE_MAGNITUDE = max(abs(lc["magnitude"]) for lc in LOAD_CASES.values())


def draw_load_case_diagram(load_case_name):
    load_case = LOAD_CASES[load_case_name]
    magnitude, n_vehicles, spacing = (
        load_case["magnitude"],
        load_case["n_vehicles"],
        load_case["spacing"],
    )
    style = VEHICLE_STYLES[load_case_name]
    body_w, body_h, color = style["width"], style["height"], style["color"]

    step = spacing if spacing > 0 else body_w * 1.8
    xs = [i * step for i in range(n_vehicles)]
    center_offset = xs[-1] / 2 if xs else 0
    xs = [x - center_offset for x in xs]

    wheel_y0, body_y0 = 6, 12
    arrow_len = 25 + 35 * (abs(magnitude) / MAX_LOAD_CASE_MAGNITUDE)
    arrow_y0 = body_y0 + body_h + 6

    fig = go.Figure()
    road_margin = body_w
    fig.add_shape(
        type="line",
        x0=min(xs) - road_margin,
        x1=max(xs) + road_margin,
        y0=0,
        y1=0,
        line=dict(color="gray", width=4),
    )

    for x in xs:
        fig.add_shape(
            type="rect",
            x0=x - body_w / 2,
            x1=x + body_w / 2,
            y0=body_y0,
            y1=body_y0 + body_h,
            line=dict(color="black", width=1),
            fillcolor=color,
        )
        for wx in (x - body_w * 0.3, x + body_w * 0.3):
            fig.add_shape(
                type="circle",
                x0=wx - 4,
                x1=wx + 4,
                y0=wheel_y0 - 4,
                y1=wheel_y0 + 4,
                line=dict(width=0),
                fillcolor="black",
            )
        fig.add_annotation(
            x=x,
            y=arrow_y0,
            ax=x,
            ay=arrow_y0 + arrow_len,
            xref="x",
            yref="y",
            axref="x",
            ayref="y",
            showarrow=True,
            arrowhead=3,
            arrowsize=1.3,
            arrowwidth=2.5,
            arrowcolor="crimson",
        )

    fig.add_annotation(
        x=0,
        y=arrow_y0 + arrow_len + 10,
        text=f"{abs(magnitude):.0f} kN per vehicle",
        showarrow=False,
        font=dict(size=12, color="crimson"),
    )

    fig.update_layout(
        xaxis=dict(
            visible=False,
            range=[min(xs) - road_margin * 1.3, max(xs) + road_margin * 1.3],
        ),
        yaxis=dict(
            visible=False,
            scaleanchor="x",
            scaleratio=1,
            range=[-5, arrow_y0 + arrow_len + 22],
        ),
        height=170,
        margin=dict(l=10, r=10, t=10, b=10),
        showlegend=False,
    )
    return fig


@st.cache_data(show_spinner="Running structural analysis...")
def cached_simulation(load_case_name):
    return run_full_simulation(bridge_data, load_case_name)


active_sensor = st.session_state.get("active_sensor", list(SENSOR_TYPES.keys())[0])

fig = draw_bridge(bridge_data)
fig.update_layout(height=500)
selection = st.plotly_chart(
    fig,
    on_select="rerun",
    selection_mode="points",
    key="bridge_chart",
    use_container_width=True,
)

if selection and hasattr(selection, "selection") and selection.selection.points:
    clicked_point = selection.selection.points[0]
    if "customdata" in clicked_point:
        customdata = clicked_point["customdata"]
        target = customdata[0] if isinstance(customdata, list) else customdata
        if (
            isinstance(target, str)
            and "_" in target
            and st.session_state.sensors.get(target) != active_sensor
        ):
            st.session_state.sensors[target] = active_sensor
            st.rerun()

st.divider()

col_load, col_tools, col_placed = st.columns([1, 1, 1.4])

with col_load:
    st.subheader("Load Case")
    load_case_name = st.selectbox("Load Case:", list(LOAD_CASES.keys()))
    st.caption(LOAD_CASES[load_case_name]["description"])
    st.plotly_chart(
        draw_load_case_diagram(load_case_name),
        use_container_width=True,
        config={"staticPlot": True},
    )

with col_tools:
    st.subheader("Sensor Tools")
    st.radio("Active Sensor:", list(SENSOR_TYPES.keys()), key="active_sensor")
    if st.button("Clear All Sensors"):
        st.session_state.sensors = {}
        st.rerun()

with col_placed:
    st.subheader("Placed Sensors")
    if not st.session_state.sensors:
        st.caption("None yet — click a joint or beam on the diagram above.")
    for location, s_type in list(st.session_state.sensors.items()):
        row_label, row_remove = st.columns([4, 1])
        row_label.write(f"- {s_type} at {location}")
        if row_remove.button("Remove", key=f"remove_{location}"):
            del st.session_state.sensors[location]
            st.rerun()

st.divider()
run_sim = st.button("Run Moving Load Simulation", type="primary", use_container_width=True)

if run_sim:
    if not st.session_state.sensors:
        st.warning("Please place at least one sensor on the bridge before running the simulation!")
    else:
        st.divider()
        st.subheader(f"Sensor Telemetry Data — {load_case_name}")

        try:
            load_positions, node_series, member_series = cached_simulation(load_case_name)
        except ValueError as exc:
            st.error(f"Simulation cannot run for this bridge: {exc}")
            st.stop()

        sim_results = extract_sensor_series(
            node_series,
            member_series,
            st.session_state.sensors,
            bridge_data,
            load_positions,
        )

        units_by_type = {
            "Displacement": "Vertical deflection (model units)",
            "Strain Gauge": "Strain (microstrain, uε)",
            "Accelerometer": "Vertical acceleration (model units/s², quasi-static)",
        }

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
