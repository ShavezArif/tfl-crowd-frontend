// Call n8n Cloud webhook directly
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

    const stationsMap = new Map();
    data.stopPoints.forEach(sp => {
      if (sp.icsCode && sp.commonName && !stationsMap.has(sp.commonName)) {
        stationsMap.set(sp.commonName, sp.icsCode);
        stationMap.set(sp.icsCode, sp.commonName);
      }
    });

    const sortedStations = Array.from(stationsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    sortedStations.forEach(([name, icsCode]) => {
      const opt1 = document.createElement("option");
      opt1.value = icsCode;
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
