const WEBHOOK_URL = "https://mshavezarif.app.n8n.cloud/webhook/crowdload-predict";

const form = document.getElementById("journeyForm");
const result = document.getElementById("result");

const STATIONS_API = "https://api.tfl.gov.uk/StopPoint/Mode/tube";

const originSelect = document.getElementById("origin");
const destinationSelect = document.getElementById("destination");


async function loadStations() {
    try {
      const res = await fetch(STATIONS_API);
      if (!res.ok) throw new Error("Station fetch failed");
  
      const data = await res.json();
  
      const stations = Array.from(
        new Set(
          data.stopPoints.map(sp => sp.commonName)
        )
      ).sort();
  
      stations.forEach(name => {
        const opt1 = document.createElement("option");
        opt1.value = name;
        opt1.textContent = name;
  
        const opt2 = opt1.cloneNode(true);
  
        originSelect.appendChild(opt1);
        destinationSelect.appendChild(opt2);
      });
  
    } catch (err) {
      console.error("Failed to load stations", err);
    }
  }

loadStations();
  

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  result.innerHTML = "Loading...";

  const payload = {
    origin: document.getElementById("origin").value.trim(),
    destination: document.getElementById("destination").value.trim(),
    departure_time: new Date(
      document.getElementById("departure_time").value
    ).toISOString()
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("API error");

    const data = await res.json();
    renderResult(data);

  } catch (err) {
    result.innerHTML = "Failed to fetch recommendation.";
  }
});

function renderResult(data) {
  const rec = data.recommended_route;

  let html = `
    <h2>Recommended Route</h2>
    <p><strong>${rec.line} line (${rec.direction})</strong></p>
    <p>Duration: ${rec.duration_minutes} minutes</p>
    <p>Crowd Level: ${rec.crowd_label} (${rec.crowd_score})</p>
    <p>Confidence: ${data.confidence_level}</p>

    <h3>Decision Summary</h3>
    <p>${data.decision_summary}</p>

    <h3>Other Options</h3>
    <ul>
  `;

  data.ranked_routes.slice(1).forEach(r => {
    html += `
      <li>
        ${r.line} line – Crowd ${r.crowd_score}, Duration ${r.duration_minutes} min
      </li>
    `;
  });

  html += "</ul>";
  result.innerHTML = html;
}
