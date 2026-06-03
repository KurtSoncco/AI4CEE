# Homework: Applying Lessons from I-35W to Custom Bridge SHM Design

## Background Readings:
Before beginning the simulation, carefully review the following documents:
- National Transportation Safety Board (NTSB): “Collapse of I-35W Highway Bridge Minneapolis, Minnesota August 1, 2007” (Pages 1–21).
- “The Infamous Gusset Plates” by Roberto Ballarini and Taichiro Okazaki.
- “Overview of Structural Health Monitoring for Steel Bridges” by Modares and Waksmanski.
(Optional Context: “Evaluating the effects of the I-35W bridge collapse on road-users in the twin cities metropolitan region” by Xie & Levinson).

## The Assignment:
The failure of the I-35W bridge highlighted the critical importance of monitoring structural stresses, particularly at key joints and gusset plates. In this assignment, you will apply the lessons learned from the I-35W collapse to design and monitor your own 2D bridge structure.

### Step 1: Draft and Design

Hand-draft a 2D truss bridge design on engineering paper.

Clearly mark the locations where you would install structural health monitoring (SHM) sensors.

Hint: Think about the vulnerabilities discussed in the NTSB and Gusset Plate readings. Where are the highest stresses likely to concentrate in your design?

### Step 2: AI Load Simulation

Upload a clear photo or scan of your hand-drafted bridge to [Insert Link to Your AI Tool].

Instruct the AI to map your sensor locations.

Run the AI stress simulation for three distinct load cases: (1) Passenger Cars, (2) Public Transit Buses, and (3) Heavy Traffic Jam.

### Step 3: Post-Simulation Report (1-2 Pages)
Submit your original hand-drafted schematic along with a report addressing the following:

Design & Placement: Why did you choose this specific bridge design, and why did you place the sensors where you did? Refer back to the I-35W readings to justify your choices.

Sensor Technology: What specific types of sensors (based on the Modares/Waksmanski reading) are represented by the markers on your draft? Why are they appropriate for those locations?

Load Case Analysis: Review the AI simulation outputs. How did the stress distribution change across the three load cases? Did your sensors adequately capture the maximum stresses in the heavy traffic scenario?

## Deployment (Version 2 Streamlit App)

This version uses Python + Streamlit and must be deployed to a Python app host (not GitHub Pages).

### Option A: Streamlit Community Cloud (recommended)
1. Push this repository to GitHub with the Version 2 files.
2. Go to https://share.streamlit.io/ and create a new app.
3. Set:
   - **Repository**: `KurtSoncco/AI4CEE`
   - **Main file path**: `courses/ce170a/hw2/version2/app.py`
4. Streamlit Cloud will automatically install dependencies from:
   - `courses/ce170a/hw2/version2/requirements.txt`
5. After deployment, copy the app URL and use it as the website launch link for Version 2.

### Local run command
```bash
cd courses/ce170a/hw2/version2
pip install -r requirements.txt
streamlit run app.py
```