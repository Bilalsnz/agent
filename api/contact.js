export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { to, vendorName, subject, message } = req.body || {};
  if (!to || typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: "A valid vendor email is required." });
  if (!subject || !message || typeof message !== "string" || message.length < 20 || message.length > 10000) return res.status(400).json({ error: "A subject and message between 20 and 10000 characters are required." });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return res.status(503).json({ error: "Email sending is not configured. Use the prepared mailto draft, or configure RESEND_API_KEY and a verified RESEND_FROM address." });
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], subject, text: message, tags: [{ name: "workflow", value: "caterscout" }] })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.message || "Email provider rejected the message." });
    return res.status(200).json({ sent: true, id: data.id, vendorName: vendorName || null, sentAt: new Date().toISOString() });
  } catch {
    return res.status(502).json({ error: "Could not send the email. Check provider configuration and try again." });
  }
}
