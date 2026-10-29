async function searchOpenStreetMap(location) {
  const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
  geoUrl.searchParams.set("q", location);
  geoUrl.searchParams.set("format", "jsonv2");
  geoUrl.searchParams.set("limit", "1");
  const geoResponse = await fetch(geoUrl, { headers: { "User-Agent": "CaterScoutAgent/0.1 (vendor research demo)" } });
  if (!geoResponse.ok) throw new Error("Location lookup is temporarily unavailable.");
  const matches = await geoResponse.json();
  if (!matches.length) return [];
  const [lat, lon] = [Number(matches[0].lat), Number(matches[0].lon)];
  const query = `[out:json][timeout:20];(nwr(around:12000,${lat},${lon})["craft"="caterer"];nwr(around:12000,${lat},${lon})["shop"="caterer"];nwr(around:12000,${lat},${lon})["amenity"="restaurant"];);out center tags 30;`;
  const overpassResponse = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "CaterScoutAgent/0.1 (vendor research demo)" },
    body: "data=" + encodeURIComponent(query)
  });
  if (!overpassResponse.ok) throw new Error("OpenStreetMap vendor search is temporarily unavailable. Retry or add vendors manually.");
  const data = await overpassResponse.json();
  return (data.elements || []).map((item) => {
    const tags = item.tags || {};
    const itemLat = item.lat ?? item.center?.lat;
    const itemLon = item.lon ?? item.center?.lon;
    const website = tags.website || tags["contact:website"] || "";
    const phone = tags.phone || tags["contact:phone"] || "";
    const email = tags.email || tags["contact:email"] || "";
    return {
      placeId: "osm-" + item.type + "-" + item.id,
      name: tags.name || tags.brand || "Unnamed food business",
      address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" "),
      website,
      phone,
      email,
      mapsUrl: itemLat && itemLon ? `https://www.openstreetmap.org/?mlat=${itemLat}&mlon=${itemLon}#map=17/${itemLat}/${itemLon}` : "",
      businessStatus: "UNKNOWN",
      source: "OpenStreetMap",
      status: "lead",
      price: "",
      details: "",
      evidence: ""
    };
  });
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
        body: JSON.stringify({ textQuery: `catering services ${location}`, pageSize: 10 })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: data.error?.message || "Google Places could not complete the search." });
      vendors = (data.places || []).map(p => ({
        placeId: p.id,
        name: p.displayName?.text || "Unnamed catering business",
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
      }));
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
