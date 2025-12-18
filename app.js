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
  const rec = data.recommended_route;
  console.log("RAW RESPONSE:", data);

  
  if (!rec) {
    result.innerHTML = "<p>No route recommendation available.</p>";
    return;
  }
  
  let html = `
    <h2>Recommended Route</h2>
    <p><strong>${rec.line} line (${rec.direction})</strong></p>
    <p><strong>From:</strong> ${rec.start_station}</p>
    <p><strong>To:</strong> ${rec.end_station}</p>
    <p><strong>Duration:</strong> ${rec.duration_minutes} minutes</p>
    <p><strong>Departure:</strong> ${new Date(rec.departure_time).toLocaleString()}</p>
    <p><strong>Arrival:</strong> ${new Date(rec.arrival_time).toLocaleString()}</p>
    <p><strong>Crowd Level:</strong> ${rec.crowd_label} (score: ${rec.crowd_score}/100)</p>
    ${rec.fare_pence ? `<p><strong>Fare:</strong> £${(rec.fare_pence / 100).toFixed(2)}</p>` : ''}
    ${rec.is_disrupted ? '<p style="color: red;"><strong>⚠️ This route has disruptions</strong></p>' : ''}
    
    <h3>Why This Route?</h3>
    <p>${data.decision_summary}</p>
    <p><strong>Confidence:</strong> ${data.confidence_level}</p>
    
    <h3>Alternative Routes</h3>
  `;
  
  if (data.ranked_routes && data.ranked_routes.length > 1) {
    html += "<ul>";
    data.ranked_routes.slice(1, 4).forEach(r => {
      html += `
        <li>
          <strong>${r.line} line (${r.direction})</strong> - 
          ${r.duration_minutes} min, 
          Crowd: ${r.crowd_label} (${r.crowd_score}), 
          Utility: ${r.ranking?.utility || 'N/A'}
          ${r.is_disrupted ? ' ⚠️ Disrupted' : ''}
        </li>
      `;
    });
    html += "</ul>";
    
    // Show why alternatives weren't chosen
    if (data.why_not_others && data.why_not_others.length > 0) {
      html += "<details><summary>Why not the alternatives?</summary><ul>";
      data.why_not_others.slice(0, 3).forEach(alt => {
        html += `<li><strong>${alt.route_id}:</strong> ${alt.reasons.join(' ')}</li>`;
      });
      html += "</ul></details>";
    }
  } else {
    html += "<p>No alternative routes available.</p>";
  }
  
  result.innerHTML = html;
}

