// Call Netlify Function instead of n8n Cloud directly
const WEBHOOK_URL = "https://mshavezarif.app.n8n.cloud/webhook/crowdload-predict";
const form = document.getElementById("journeyForm");
const result = document.getElementById("result");
const STATIONS_API = "https://api.tfl.gov.uk/StopPoint/Mode/tube";
const originSelect = document.getElementById("origin");
const destinationSelect = document.getElementById("destination");

// Store station mapping: icsCode -> commonName
const stationMap = new Map();

async function loadStations() {
  try {
    const res = await fetch(STATIONS_API);
    if (!res.ok) throw new Error("Station fetch failed");
    const data = await res.json();
    
    // Filter stations that have icsCode and remove duplicates
    const stationsMap = new Map();
    data.stopPoints.forEach(sp => {
      if (sp.icsCode && sp.commonName) {
        // Use commonName as key to avoid duplicates
        if (!stationsMap.has(sp.commonName)) {
          stationsMap.set(sp.commonName, sp.icsCode);
          // Also store reverse mapping for lookups
          stationMap.set(sp.icsCode, sp.commonName);
        }
      }
    });
    
    // Sort station names alphabetically
    const sortedStations = Array.from(stationsMap.entries()).sort((a, b) => 
      a[0].localeCompare(b[0])
    );
    
    // Populate dropdowns
    sortedStations.forEach(([name, icsCode]) => {
      const opt1 = document.createElement("option");
      opt1.value = icsCode;  // Store icsCode as value
      opt1.textContent = name;  // Display commonName
      
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
  
  const originCode = originSelect.value.trim();
  const destinationCode = destinationSelect.value.trim();
  const originName = originSelect.options[originSelect.selectedIndex].text;
  const destinationName = destinationSelect.options[destinationSelect.selectedIndex].text;
  
  const payload = {
    origin_code: originCode,  // ICS code for TfL API
    origin_name: originName,  // Station name for display
    destination_code: destinationCode,  // ICS code for TfL API
    destination_name: destinationName,  // Station name for display
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
    console.error("Request failed", err);
    result.innerHTML = "Failed to fetch recommendation.";
  }
});

function renderResult(data) {
  const response = Array.isArray(data) ? data[0] : data;
  const rec = response.recommended_route;

  console.log("RAW RESPONSE:", response);

  if (!rec) {
    result.innerHTML = "<p>No route recommendation available.</p>";
    return;
  }

  const summary = rec.summary;
  const crowdAgg = rec.crowd?.aggregate;

  let html = `
    <h2>Recommended Route</h2>

    <p><strong>From:</strong> ${summary.start_station}</p>
    <p><strong>To:</strong> ${summary.end_station}</p>
    <p><strong>Total Duration:</strong> ${summary.total_duration_minutes} minutes</p>
    <p><strong>Departure:</strong> ${new Date(summary.departure_time).toLocaleString()}</p>
    <p><strong>Arrival:</strong> ${new Date(summary.arrival_time).toLocaleString()}</p>

    <p><strong>Lines Used:</strong> ${summary.lines_used.join(" → ")}</p>
    <p><strong>Interchanges:</strong> ${summary.interchanges}</p>

    <p><strong>Crowd Level:</strong> ${crowdAgg.final_crowd_label} 
       (score ${crowdAgg.final_crowd_score}/100)</p>

    <h3>Journey Breakdown</h3>
  `;

  rec.legs.forEach((leg, idx) => {
    html += `
      <div style="margin-bottom:12px;">
        <strong>Leg ${idx + 1}:</strong><br>
        ${leg.mode === "walking"
          ? `Walk from <strong>${leg.from_station}</strong> to <strong>${leg.to_station}</strong>`
          : `Take <strong>${leg.line}</strong> line (${leg.direction})`}
        <br>
        ${new Date(leg.departure_time).toLocaleTimeString()} → 
        ${new Date(leg.arrival_time).toLocaleTimeString()}
        (${leg.duration_minutes} min)
      </div>
    `;
  });

  if (rec.interchanges && rec.interchanges.length > 0) {
    html += `<h3>Where to Change</h3><ul>`;
    rec.interchanges.forEach(ic => {
      html += `<li>${ic.instruction}</li>`;
    });
    html += `</ul>`;
  }

  html += `
    <h3>Why This Route?</h3>
    <p>${response.decision_summary}</p>
    <p><strong>Confidence:</strong> ${response.confidence_level}</p>

    <h3>Alternative Routes</h3>
  `;

  if (response.ranked_routes && response.ranked_routes.length > 1) {
    html += "<ol>";
    response.ranked_routes.slice(1, 4).forEach(r => {
      html += `
        <li>
          ${r.summary.total_duration_minutes} min, 
          ${r.summary.interchanges} change(s), 
          Crowd: ${r.crowd.aggregate.final_crowd_label}
        </li>
      `;
    });
    html += "</ol>";
  } else {
    html += "<p>No alternative routes available.</p>";
  }

  result.innerHTML = html;
}



