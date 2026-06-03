# AI4CEE: Artificial Intelligence for Civil & Environmental Engineering

> Educational repository for AI-driven civil and environmental engineering applications

## 🎯 Live Application

**[Launch Homework 2 Interactive App](https://ai4cee-r8jqcpvhfg3nev263b8whp.streamlit.app/)** – I-35W Bridge Collapse SHM Simulator

---

## 📚 Courses

### CE170A: Infrastructure Sensing and Modeling

Modern sensing, analysis, and modeling techniques for critical infrastructure systems.

**Topics:**
- Structural health monitoring (SHM)
- Sensor networks and placement strategies
- Infrastructure failure analysis
- Data-driven decision making

**Assignments:**

1. **Homework 1:** Fukushima Nuclear Power Plant
   - Analyze nuclear facility response to seismic events
   - Topics: Structural analysis, sensor networks, risk assessment

2. **Homework 2:** I-35W Bridge Collapse
   - Investigate the Minneapolis bridge collapse (2007)
   - Determine optimal sensor placement for early failure detection
   - Interactive Streamlit simulation included
   - **[Launch App →](https://ai4cee-r8jqcpvhfg3nev263b8whp.streamlit.app/)**

---

## 🏗️ What is Homework 2?

Students take on the role of a structural engineer tasked with retrofitting a Structural Health Monitoring (SHM) system on the I-35W Bridge *before* its tragic collapse in August 2007.

### The Challenge:
- Read NTSB reports and academic papers on the collapse
- Determine which bridge nodes/joints are most critical to monitor
- Select appropriate sensor types (strain gauges, accelerometers, tiltmeters, etc.)
- Run a simulation to see if your sensor placement would have detected the failure

### Learning Outcomes:
- Understand the importance of strategic sensor placement
- Learn about different monitoring technologies and their applications
- Analyze failure mechanisms in real infrastructure
- Practice evidence-based decision making

---

## 📁 Repository Structure

```
AI4CEE/
├── index.html                          # Main landing page
├── styles.css                          # Shared styling
├── streamlit_app.py                    # Streamlit entry point
├── requirements.txt                    # Dependencies
├── README.md                           # This file
├── Procfile                            # Deployment configuration
└── courses/
    └── ce170a/
        ├── index.html                  # Course overview
        └── hw2/
            ├── version1/               # Static HTML simulator (archived)
            └── version2/               # Live Streamlit app
                ├── app.py
                ├── requirements.txt
                └── README.md
```

---

## 🚀 Deployment

The interactive application is deployed on **Streamlit Community Cloud**:
- **URL:** https://ai4cee-r8jqcpvhfg3nev263b8whp.streamlit.app/
- **Status:** Live and ready to use
- **Access:** No login required

### To run locally:

```bash
# Clone the repository
git clone https://github.com/KurtSoncco/AI4CEE.git
cd AI4CEE

# Install dependencies
pip install -r requirements.txt

# Run the Streamlit app
streamlit run streamlit_app.py
```

---

## 📖 References & Readings

For Homework 2, students should review:

1. **NTSB Report**: "Collapse of I-35W Highway Bridge Minneapolis, Minnesota August 1, 2007" (Pages 1–21)
2. **"The Infamous Gusset Plates"** by Roberto Ballarini and Taichiro Okazaki
3. **"Overview of Structural Health Monitoring for Steel Bridges"** by Modares and Waksmanski
4. *(Optional)* "Evaluating the effects of the I-35W bridge collapse on road-users in the twin cities metropolitan region" by Xie & Levinson

---

## 🛠️ Technologies

- **Frontend:** HTML5, CSS3
- **Backend:** Python
- **Framework:** Streamlit
- **Libraries:** Plotly, NumPy, Anastruct
- **Hosting:** Streamlit Community Cloud

---

## 📝 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Kurt Soncco**  
GitHub: [@KurtSoncco](https://github.com/KurtSoncco)  
Repository: [AI4CEE](https://github.com/KurtSoncco/AI4CEE)

---

## 📞 Support

For questions or issues with the application, please open an issue on the [GitHub repository](https://github.com/KurtSoncco/AI4CEE/issues).
