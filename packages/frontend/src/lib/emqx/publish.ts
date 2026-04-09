/**
 * Publishes a message to EMQX Cloud via the HTTP API.
 * Used by the Route Handler to send commands to devices without
 * maintaining a persistent MQTT connection.
 */
export async function publishToMqtt(
  topic: string,
  payload: Record<string, unknown>
): Promise<void> {
  const apiUrl = process.env.EMQX_HTTP_API_URL;
  const apiKey = process.env.EMQX_HTTP_API_KEY;
  const apiSecret = process.env.EMQX_HTTP_API_SECRET;

  if (!apiUrl || !apiKey || !apiSecret) {
    throw new Error("EMQX HTTP API credentials not configured");
  }

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  const response = await fetch(`${apiUrl}/api/v5/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      topic,
      payload: JSON.stringify(payload),
      qos: 1,
      retain: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`EMQX publish failed: ${response.status}`);
  }
}
