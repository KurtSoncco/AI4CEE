# Homework: Applying Lessons from I-35W to Custom Bridge SHM Design

## Background Readings:
Before beginning the simulation, carefully review the following documents:
- National Transportation Safety Board (NTSB): “Collapse of I-35W Highway Bridge Minneapolis, Minnesota August 1, 2007” (Pages 1–21).
- “The Infamous Gusset Plates” by Roberto Ballarini and Taichiro Okazaki.
- “Overview of Structural Health Monitoring for Steel Bridges” by Modares and Waksmanski.
(Optional Context: “Evaluating the effects of the I-35W bridge collapse on road-users in the twin cities metropolitan region” by Xie & Levinson).

## The Assignment:
The failure of the I-35W bridge highlighted the critical importance of monitoring structural stresses, particularly at key joints and gusset plates. In this assignment, you will apply the lessons learned from the I-35W collapse to instrument and monitor a 2D truss bridge provided in the simulator.

### Step 1: Study the Provided Bridge

Open the Bridge SHM Simulator (loaded with the default bridge below) and study its geometry: the deck, the supports, and the panel points where members meet.

Hint: Think about the vulnerabilities discussed in the NTSB and Gusset Plate readings. Where are the highest stresses likely to concentrate in this design? Which connections most resemble the gusset-plate details discussed in the readings?

### Step 2: Place Sensors & Run Load Simulations

In the app, place Accelerometer, Strain Gauge, and Displacement sensors at the joints/members you believe are most critical.

Run the simulation for each of the three built-in load cases: (1) Passenger Cars, (2) Public Transit Bus, and (3) Heavy Traffic Jam, and record the telemetry charts for each.

(Optional/advanced: you may instead upload or paste your own bridge JSON to analyze a custom design.)

### Step 3: Post-Simulation Report (1-2 Pages)
Submit screenshots of your sensor layout and telemetry charts along with a report addressing the following:

Sensor Placement: Why did you place the sensors where you did? Refer back to the I-35W readings to justify your choices.

Sensor Technology: What specific types of sensors (based on the Modares/Waksmanski reading) are represented by the markers you placed? Why are they appropriate for those locations?

Load Case Analysis: How did the stress distribution change across the three load cases? Did your sensors adequately capture the maximum stresses in the heavy traffic jam scenario?

## Deployment (Version 2 Streamlit App)

This version uses Python + Streamlit and must be deployed to a Python app host (not GitHub Pages).

### Option A: Streamlit Community Cloud (recommended)
1. Push this repository to GitHub with the Version 2 files.
2. Go to https://share.streamlit.io/ and create a new app.
3. Set:
   - **Repository**: `KurtSoncco/AI4CEE`
   - **Main file path**: `streamlit_app.py`
4. Streamlit Cloud will automatically install dependencies from:
   - `/requirements.txt` (which references `courses/ce170a/hw2/version2/requirements.txt`)
5. After deployment, copy the app URL and use it as the website launch link for Version 2.

### Option B: Render / Railway style deployment
This repository now includes a root `Procfile` so platforms that detect Procfile can start the app directly.

### Local run command
```bash
cd /tmp/workspace/KurtSoncco/AI4CEE
pip install -r requirements.txt
streamlit run streamlit_app.py
```