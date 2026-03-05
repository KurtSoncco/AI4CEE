# Homework: I-35W Bridge Collapse - AI Structural Health Monitoring Simulation

## Background Readings:
Before beginning the simulation, carefully review the following documents:
- National Transportation Safety Board (NTSB): “Collapse of I-35W Highway Bridge Minneapolis, Minnesota August 1, 2007” (Pages 1–21).
- “The Infamous Gusset Plates” by Roberto Ballarini and Taichiro Okazaki.
- “Overview of Structural Health Monitoring for Steel Bridges” by Modares and Waksmanski.
(Optional Context: “Evaluating the effects of the I-35W bridge collapse on road-users in the twin cities metropolitan region” by Xie & Levinson).

## The Assignment:
You are the lead structural engineer tasked with retrofitting a structural health monitoring (SHM) system on the I-35W Bridge before its tragic collapse. Based on your readings, you must predict the most vulnerable components and test your hypothesis using our AI Structural Simulator.

### Step 1: AI Sensor Allocation

- Open the Gemini and load the I-35W Bridge model.
- Allocate a maximum of [Insert Number, e.g., 10] monitoring sensors across the bridge graph.

Hint: Use your readings to determine which specific nodes, joints, or plates require the most critical monitoring.

### Step 2: Collapse Simulation

- Run the "Historical Collapse" load scenario in the AI tool.
- Observe the stress measurements captured by your specific sensor placements. Did your sensors capture the critical stresses leading up to the failure?

### Step 3: Post-Simulation Report (1-2 Pages)
Submit a brief report containing:

- Sensor Strategy: Explain exactly where you placed your sensors on the model and why, referencing specific findings from the NTSB report and the Ballarini/Okazaki paper.
- Technology Selection: Identify the specific monitoring technologies (e.g., strain gauges, accelerometers) you chose for each location and explain why, referencing the Modares/Waksmanski paper.
- Simulation Analysis: Include a screenshot of your AI simulation results. Did your sensor layout successfully capture the critical failure points? If you were to run the simulation again, what would you change about your sensor allocation?