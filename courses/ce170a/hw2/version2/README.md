# Homework 2: Bridge SHM Design Project (PBL)

## Driving question

> How would you instrument this truss so a traffic overload cannot hide the same *class* of joint failure that brought down the I-35W bridge?

## Background readings

Before using the simulator, review:

1. NTSB — *Collapse of I-35W Highway Bridge Minneapolis, Minnesota August 1, 2007* (pp. 1–21)
2. Roberto Ballarini & Taichiro Okazaki — *The Infamous Gusset Plates*
3. Modares & Waksmanski — *Overview of Structural Health Monitoring for Steel Bridges*
4. *(Optional)* Xie & Levinson — road-user impacts after the collapse

## Always-on student app

**Launch:** [Bridge SHM Lab on GitHub Pages](https://kurtsoncco.github.io/AI4CEE/courses/ce170a/hw2/app/)

The lab runs entirely in the browser:

- Precomputed moving-load FEM results (same physics as the instructor Python engine)
- Click-to-place sensors on a 2D truss
- Three load cases: Passenger Cars, Public Transit Bus, Heavy Traffic Jam
- Instant design critic (no download, no API key)
- Deflected-shape explorer with load-position slider (undeformed vs exaggerated deflected truss)
- Optional cloud LLM second opinion via **Copy LLM prompt** → ChatGPT or Gemini
- Exportable JSON + markdown evidence for your report

If you want a cloud model, use **Copy LLM prompt** in the app and paste into ChatGPT or Gemini.

## Project stages

Your memo should show evidence from each stage:

| Stage | What you do | Evidence |
| --- | --- | --- |
| 1. Investigate | Read the sources above | Short summary of I-35W failure mechanisms |
| 2. Hypothesize | Name gusset-plate analogues on the lab truss | Hypothesis text in the app |
| 3. Design | Place up to **8** mixed sensors | Sensor map screenshot |
| 4. Critique | Run the in-browser Gemma critic; revise | Critique log: what you kept vs changed |
| 5. Simulate | Run all three load cases; iterate once | Telemetry charts |
| 6. Export | Download JSON / copy markdown | Appendix in your memo |

## Academic integrity

- GenAI is a **consultant**, not an answer key. The critic is prompted **not** to reveal an optimal sensor map.
- Simulation telemetry is **ground truth** — your memo must interpret the numbers the app reports.
- Cite the readings when justifying sensor type and location.

## Instructor notes

### Regenerate physics JSON

```bash
cd courses/ce170a/hw2/version2
python3 -m venv .venv
.venv/bin/pip install anastruct numpy
.venv/bin/python precompute.py
```

This writes `courses/ce170a/hw2/app/bridge_results.json`.

### Local Streamlit (optional)

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

Streamlit is for local instructor use only. Students should use GitHub Pages.

### Enable GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from branch**
3. Branch: `main`, folder: `/ (root)`
4. Student URL: `https://<username>.github.io/AI4CEE/courses/ce170a/hw2/app/`

## Deliverable

Submit a **2-page engineering memo** plus exported evidence (sensor layout, telemetry peaks, critique log) addressing:

1. **Sensor placement** — why each location, tied to I-35W readings
2. **Sensor technology** — why each type fits its location (Modares/Waksmanski)
3. **Load-case analysis** — how stresses change across the three scenarios; did your layout capture the worst case?
