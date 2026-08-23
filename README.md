# AI4CEE: Artificial Intelligence for Civil & Environmental Engineering

> Educational repository for AI-driven civil and environmental engineering applications

## Live application

**[Launch Homework 2 Bridge SHM Lab](https://kurtsoncco.github.io/AI4CEE/courses/ce170a/hw2/app/)** — always-on GitHub Pages simulator with in-browser Gemma critic

No login, no sleeping server, no API key required for students.

---

## Courses

### CE170A: Infrastructure Sensing and Modeling

Modern sensing, analysis, and modeling techniques for critical infrastructure systems.

**Topics:**

- Structural health monitoring (SHM)
- Sensor networks and placement strategies
- Infrastructure failure analysis
- Data-driven decision making with GenAI guardrails

**Assignments:**

1. **Homework 1:** Fukushima Nuclear Power Plant *(materials forthcoming)*
2. **Homework 2:** I-35W Bridge Collapse → applied to a 2D truss SHM design project
   - **[Launch always-on lab →](https://kurtsoncco.github.io/AI4CEE/courses/ce170a/hw2/app/)**
   - Assignment brief: [courses/ce170a/hw2/version2/README.md](courses/ce170a/hw2/version2/README.md)

---

## Homework 2 (project-based)

Students investigate the I-35W collapse through readings, hypothesize vulnerable joints on a lab truss, place up to eight mixed sensors, critique their design with an in-browser **Gemma 3 270M** assistant, run moving-load simulations for three traffic scenarios, and export evidence for a short engineering memo.

GenAI acts as a consultant; FEM telemetry is ground truth; readings set the constraints.

---

## Repository structure

```
AI4CEE/
├── index.html
├── styles.css
├── streamlit_app.py              # Instructor-only local entry
├── requirements.txt
├── README.md
└── courses/
    └── ce170a/
        ├── index.html
        └── hw2/
            ├── app/                # Student-facing GitHub Pages lab
            │   ├── index.html
            │   ├── simulator.js
            │   ├── critic.js
            │   ├── critic-worker.js
            │   └── bridge_results.json
            ├── version1/           # Archived HTML quiz
            └── version2/           # Python engine + assignment brief
                ├── shm_engine.py
                ├── precompute.py
                └── app.py
```

---

## Deployment

### Students (GitHub Pages)

1. Enable **Settings → Pages → Deploy from branch `main` / root**
2. Share: `https://<username>.github.io/AI4CEE/courses/ce170a/hw2/app/`

### Instructors (regenerate physics or run Streamlit locally)

```bash
git clone https://github.com/KurtSoncco/AI4CEE.git
cd AI4CEE

# Regenerate precomputed JSON
cd courses/ce170a/hw2/version2
python3 -m venv .venv && .venv/bin/pip install anastruct numpy
.venv/bin/python precompute.py

# Optional Streamlit
cd ../../../../
pip install -r requirements.txt
streamlit run streamlit_app.py
```

---

## References

1. NTSB I-35W collapse report (pp. 1–21)
2. Ballarini & Okazaki — gusset plates
3. Modares & Waksmanski — steel bridge SHM
4. *(Optional)* Xie & Levinson — twin cities road-user impacts

---

## Technologies

- **Student lab:** HTML, CSS, Plotly.js, Transformers.js, Gemma 3 270M ONNX
- **Physics engine:** Python, anastruct, NumPy
- **Hosting:** GitHub Pages (students); optional local Streamlit for instructors

---

## License

MIT License — see [LICENSE](LICENSE).

---

## Author

**Kurt Soncco** — [@KurtSoncco](https://github.com/KurtSoncco)
