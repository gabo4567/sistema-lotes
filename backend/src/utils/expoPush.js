export async function sendExpoPush(tokens, title, body, data = {}) {
  try {
    const messages = tokens.map((to) => ({ to, title, body, data }));
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const json = await resp.json().catch(() => ({}));
    return json;
  } catch (e) {
    return { error: e?.message };
  }
}