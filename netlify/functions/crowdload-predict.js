const N8N_WEBHOOK_URL = "https://mshavezarif.app.n8n.cloud/webhook/crowdload-predict";

export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: event.body,
    });

    const text = await res.text();

    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
      body: text,
    };
  } catch (err) {
    console.error("Error calling n8n webhook", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to reach n8n webhook" }),
    };
  }
}
