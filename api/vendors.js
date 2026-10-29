async function searchOpenStreetMap(location) {
  const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
  geoUrl.searchParams.set("q", location);
  geoUrl.searchParams.set("format", "jsonv2");
  geoUrl.searchParams.set("limit", "1");
  let matches;
  try {
    const geoResponse = await fetch(geoUrl, {
      headers: { "User-Agent": "CaterScoutAgent/0.2 (vendor research)" },
      signal: AbortSignal.timeout(12000)
    });
    if (!geoResponse.ok) throw new Error("Location lookup returned HTTP " + geoResponse.status);
    matches = await geoResponse.json();
  } catch {
    throw new Error("Could not locate this city right now. Check the spelling and try again.");
  }
  if (!matches.length) throw new Error("Could not find that location. Try a city and state, such as Houston, Texas, USA.");
  const [lat, lon] = [Number(matches[0].lat), Number(matches[0].lon)];
  // Keep the query modest and try more than one public Overpass instance.
  const query = `[out:json][timeout:18];(nwr(around:10000,${lat},${lon})["craft"="caterer"];nwr(around:10000,${lat},${lon})["shop"="caterer"];nwr(around:10000,${lat},${lon})["catering"="yes"];nwr(around:10000,${lat},${lon})["amenity"="restaurant"];);out center tags 60;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  let data = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "CaterScoutAgent/0.2 (vendor research)" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(22000)
      });
      if (!response.ok) continue;
      const result = await response.json();
      if (Array.isArray(result.elements)) { data = result; break; }
    } catch {
      // Try the next public instance when this one times out or is unavailable.
    }
  }
  if (!data) throw new Error("All public map search services are busy right now. Please retry in a minute, or use the manual vendor option.");
  const seen = new Set();
  return (data.elements || []).map((item) => {
    const tags = item.tags || {};
    const name = (tags.name || tags.brand || "").trim();
    if (!name) return null;
    const normalizedName = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const itemLat = item.lat ?? item.center?.lat;
    const itemLon = item.lon ?? item.center?.lon;
    const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean).join(" ");
    const coords = itemLat && itemLon ? Number(itemLat).toFixed(4) + "," + Number(itemLon).toFixed(4) : "";
    const dedupeKey = normalizedName + "|" + (address.toLocaleLowerCase() || coords);
    if (seen.has(dedupeKey)) return null;
    seen.add(dedupeKey);
    const website = tags.website || tags["contact:website"] || "";
    const phone = tags.phone || tags["contact:phone"] || "";
    const email = tags.email || tags["contact:email"] || "";
    const category = tags.craft === "caterer" || tags.shop === "caterer" || tags.catering === "yes" ? "Caterer" : "Restaurant / dining";
    return {
      placeId: "osm-" + item.type + "-" + item.id, name, category, address, website, phone, email,
      mapsUrl: itemLat && itemLon ? "https://www.openstreetmap.org/?mlat=" + itemLat + "&mlon=" + itemLon + "#map=17/" + itemLat + "/" + itemLon : "",
      businessStatus: "UNKNOWN", source: "OpenStreetMap", status: "lead", price: "", details: "", evidence: ""
    };
  }).filter(Boolean).sort((a, b) => (a.category === "Caterer" ? 0 : 1) - (b.category === "Caterer" ? 0 : 1)).slice(0, 30);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { location, guests } = req.body || {};
  if (!location || typeof location !== "string" || location.length > 180) return res.status(400).json({ error: "Enter a valid event location." });
  if (!Number.isFinite(Number(guests)) || Number(guests) < 1 || Number(guests) > 5000) return res.status(400).json({ error: "Guest count must be between 1 and 5000." });
  try {
    let vendors;
    let source;
    if (process.env.GOOGLE_MAPS_API_KEY) {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri,places.businessStatus" },
        body: JSON.stringify({ textQuery: `catering services and caterers for group events in ${location}`, pageSize: 20 })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: data.error?.message || "Google Places could not complete the search." });
      vendors = (data.places || []).map(p => ({
        placeId: p.id,
        name: p.displayName?.text || "",
        category: /cater/i.test(p.displayName?.text || "") ? "Caterer" : "Restaurant / dining",
        address: p.formattedAddress || "",
        website: p.websiteUri || "",
        phone: p.nationalPhoneNumber || "",
        email: "",
        mapsUrl: p.googleMapsUri || "",
        businessStatus: p.businessStatus || "UNKNOWN",
        source: "Google Places",
        status: "lead",
        price: "",
        details: "",
        evidence: ""
      })).filter(p => p.name && p.name.trim());
      source = "Google Places";
    } else {
      vendors = await searchOpenStreetMap(location);
      source = "OpenStreetMap";
    }
    return res.status(200).json({ source, count: vendors.length, vendors, note: "Search results are leads only. Confirm event availability, dietary accommodation, and prices directly with each vendor." });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Vendor discovery failed. Please retry or add vendors manually." });
  }
}
