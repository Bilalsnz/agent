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
  const query = `[out:json][timeout:18];(nwr(around:8000,${lat},${lon})["craft"="caterer"];nwr(around:15000,${lat},${lon})["shop"="caterer"];nwr(around:15000,${lat},${lon})["catering"="yes"];nwr(around:15000,${lat},${lon})["amenity"="restaurant"];nwr(around:15000,${lat},${lon})["amenity"="cafe"]["catering"="yes"];);out center tags 50;`
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
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) continue;
      const result = await response.json();
      if (Array.isArray(result.elements)) { data = result; break; }
    } catch {
      // Try the next public instance when this one times out or is unavailable.
    }
  }
  if (!data) {
    // Overpass can be temporarily overloaded. Fall back to a small, user-triggered
    // Nominatim POI search instead of failing the entire workflow.
    const fallbackSearch = async (term) => {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", term + " in " + location);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "20");
      url.searchParams.set("layer", "poi");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("extratags", "1");
      url.searchParams.set("namedetails", "1");
      const response = await fetch(url, {
        headers: { "User-Agent": "CaterScoutAgent/0.3 (vendor research)" },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Fallback place search returned HTTP " + response.status);
      return response.json();
    };
    try {
      // One focused request first, and only a second request if it finds nothing.
      let places = await fallbackSearch("caterer");
      if (!places.length) {
        await new Promise(resolve => setTimeout(resolve, 1100));
        places = await fallbackSearch("restaurant");
      }
      const seenFallback = new Set();
      const vendors = places.map((place) => {
        const tags = place.extratags || {};
        const name = String(place.name || place.namedetails?.name || "").trim();
        if (!name) return null;
        const address = String(place.display_name || "").trim();
        const key = name.toLocaleLowerCase() + "|" + address.toLocaleLowerCase();
        if (seenFallback.has(key)) return null;
        seenFallback.add(key);
        const website = tags.website || tags["contact:website"] || "";
        const phone = tags.phone || tags["contact:phone"] || "";
        const email = tags.email || tags["contact:email"] || "";
        const lat = place.lat;
        const lon = place.lon;
        const category = /cater/i.test(name + " " + (place.type || "")) ? "Caterer" : "Restaurant / dining";
        return {
          placeId: "osm-" + place.osm_type + "-" + place.osm_id,
          name, category, address, website, phone, email,
          mapsUrl: lat && lon ? "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lon + "#map=17/" + lat + "/" + lon : "",
          businessStatus: "UNKNOWN", source: "OpenStreetMap (Nominatim fallback)",
          status: "lead", price: "", details: "", evidence: ""
        };
      }).filter(Boolean);
      if (vendors.length) return vendors.slice(0, 20);
    } catch {
      // Keep the original actionable error below if the fallback is unavailable.
    }
    throw new Error("OpenStreetMap's map servers are temporarily unavailable, and the backup search found no usable listings. Wait a little and retry, or add vendors manually.");
  }
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
  }).filter(Boolean).sort((a, b) => ((a.category === "Caterer" ? 0 : 1) - (b.category === "Caterer" ? 0 : 1)) || (((b.email ? 2 : 0) + (b.phone ? 1 : 0) + (b.website ? 1 : 0)) - ((a.email ? 2 : 0) + (a.phone ? 1 : 0) + (a.website ? 1 : 0)))).slice(0, 40);
}

const TORONTO_PUBLIC_CONTACTS = [
  {
    name: "Cleese Catering", category: "Caterer",
    address: "Toronto, Ontario, Canada", website: "https://cleesecatering.com/",
    phone: "+1 416-463-3895", email: "catering@cleesecatering.com",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto contact directory",
    status: "lead", price: "", details: "Corporate catering and event services listed for Toronto and the GTA. Date availability, group capacity, dietary fit, and pricing are not yet confirmed.",
    evidence: "https://cleesecatering.com/"
  },
  {
    name: "We Cater To You", category: "Caterer",
    address: "171 East Liberty Street, Unit 107, Toronto, ON M6K 3P6, Canada",
    website: "https://www.wecatertoyou.ca/", phone: "+1 647-436-3831", email: "orders@wecatertoyou.ca",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto contact directory",
    status: "lead", price: "", details: "Corporate and office catering across Toronto and the GTA. Minimum order and event-specific availability require confirmation.",
    evidence: "https://www.wecatertoyou.ca/"
  },
  {
    name: "Catering By Nikos", category: "Caterer",
    address: "963 O'Connor Drive, Toronto, ON M4B 2T1, Canada",
    website: "https://www.cateringbynikos.com/contact-us", phone: "+1 416-429-9325", email: "catering@cateringbynikos.com",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto contact directory",
    status: "lead", price: "", details: "Catering contact published on the business website. Event availability, capacity, dietary fit, and pricing are not yet confirmed.",
    evidence: "https://www.cateringbynikos.com/contact-us"
  },
  {
    name: "Big City Catering", category: "Caterer",
    address: "707 Dundas Street West, Toronto, ON M5T 2W6, Canada",
    website: "https://bigcitycatering.ca/contact/", phone: "", email: "orders@bigcitycatering.ca",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto contact directory",
    status: "lead", price: "", details: "Official contact form and order email published. Event availability, capacity, dietary fit, and pricing are not yet confirmed.",
    evidence: "https://bigcitycatering.ca/contact/"
  },
  {
    name: "Shawarma Moose Catering", category: "Caterer",
    address: "898 College Street, Toronto, ON M6H 1A4, Canada",
    website: "https://shawarmamoose.ca/contact", phone: "+1 647-340-8001", email: "catering@shawarmamoose.ca",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto contact directory",
    status: "lead", price: "", details: "Official catering contact page. Date availability, group capacity, dietary fit, and pricing are not yet confirmed.",
    evidence: "https://shawarmamoose.ca/contact"
  },
  {
    name: "Silver Feast Catering", category: "Caterer",
    address: "Pickering, Ontario, Canada · Serves Toronto and the GTA",
    website: "https://silverfeastcatering.ca/contact/", phone: "+1 647-830-0079", email: "silverfeastcatering@gmail.com",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto-area contact directory",
    status: "lead", price: "", details: "Official website lists Toronto and GTA service. Confirm travel/delivery to the event address, availability, capacity, dietary fit, and pricing.",
    evidence: "https://silverfeastcatering.ca/contact/"
  },
  {
    name: "Chef Hassan's Kitchen", category: "Caterer",
    address: "Toronto and the Greater Toronto Area, Canada",
    website: "https://shopchk.com/pages/contact", phone: "", email: "info@chefhassanskitchen.com",
    mapsUrl: "", businessStatus: "UNKNOWN", source: "Official website · Toronto-area contact directory",
    status: "lead", price: "", details: "Official contact page lists Toronto and GTA service. Minimum lead time, availability, capacity, dietary fit, and pricing require confirmation.",
    evidence: "https://shopchk.com/pages/contact"
  }
];

function addTorontoPublicContacts(vendors, location) {
  if (!/toronto|greater toronto area|\bgta\b/i.test(String(location || ""))) return vendors;
  const merged = [...vendors];
  const seen = new Set(vendors.map(v => String(v.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()));
  for (const vendor of TORONTO_PUBLIC_CONTACTS) {
    const key = vendor.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!seen.has(key)) {
      merged.push({ ...vendor, placeId: "toronto-public-" + key.replace(/ /g, "-") });
      seen.add(key);
    }
  }
  return merged.sort((a, b) => ((a.category === "Caterer" ? 0 : 1) - (b.category === "Caterer" ? 0 : 1)) || (((b.email ? 2 : 0) + (b.phone ? 1 : 0) + (b.website ? 1 : 0)) - ((a.email ? 2 : 0) + (a.phone ? 1 : 0) + (a.website ? 1 : 0))));
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
    vendors = addTorontoPublicContacts(vendors, location);
    return res.status(200).json({ source: source + (/toronto|greater toronto area|\bgta\b/i.test(String(location || "")) ? " + official Toronto contact directory" : ""), count: vendors.length, vendors, note: "Search results are leads only. Contact details are sourced from official business websites where noted. Confirm event availability, capacity, dietary accommodation, and prices directly with each vendor." });
  } catch (error) {
    return res.status(502).json({ error: error?.message || "Vendor discovery failed. Please retry or add vendors manually." });
  }
}
