export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { location, guests } = req.body || {};
  if (!location || typeof location !== "string" || location.length > 180) return res.status(400).json({ error: "Enter a valid event location." });
  if (!Number.isFinite(Number(guests)) || Number(guests) < 1 || Number(guests) > 5000) return res.status(400).json({ error: "Guest count must be between 1 and 5000." });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(503).json({ error: "Live vendor discovery is not configured yet. Set GOOGLE_MAPS_API_KEY in Vercel, or add vendor leads manually." });
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.businessStatus" },
      body: JSON.stringify({ textQuery: `catering services ${location}`, pageSize: 10 })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "Google Places could not complete the search." });
    const vendors = (data.places || []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text || "Unnamed catering business",
      address: p.formattedAddress || "",
      website: p.websiteUri || "",
      phone: p.nationalPhoneNumber || "",
      mapsUrl: p.googleMapsUri || "",
      businessStatus: p.businessStatus || "UNKNOWN",
      source: "Google Places",
      status: "lead",
      email: "",
      price: "",
      details: "",
      evidence: ""
    }));
    return res.status(200).json({ source: "Google Places", count: vendors.length, vendors });
  } catch (error) {
    return res.status(502).json({ error: "Vendor discovery failed. Please retry or add vendors manually." });
  }
}
