const $ = (s) => document.querySelector(s);
const storeKey = "caterscout-v1";
const state = { brief: null, vendors: [] };
try {
  const saved = JSON.parse(localStorage.getItem(storeKey) || "{}");
  state.brief = saved.brief || null;
  const raw = Array.isArray(saved.vendors) ? saved.vendors : [];
  // Migrate older test workspaces to the approved Toronto test market.
  if (state.brief && /houston|texas|singapore|\bsg\b/i.test(String(state.brief.location || ""))) {
    state.brief.location = "Toronto, Ontario, Canada";
    state.brief.currency = "CAD";
    // Do not mix old-market leads into the new market's results.
    const hasOutreachHistory = raw.some(v => v && !["lead", "drafted"].includes(v.status));
    if (!hasOutreachHistory) raw.length = 0;
    else raw.forEach(v => { if (v && v.source) v.source = "Previous-market record, verify location: " + v.source; });
  }
  const seen = new Set();
  state.vendors = raw.filter(v => {
    if (!v || !String(v.name || "").trim() || /^unnamed\b/i.test(String(v.name).trim())) return false;
    const norm = String(v.name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const address = String(v.address || "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = norm + "|" + address;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (state.vendors.length !== raw.length) localStorage.setItem(storeKey, JSON.stringify({brief:state.brief,vendors:state.vendors}));
} catch {}
const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const save = () => { localStorage.setItem(storeKey, JSON.stringify({ brief: state.brief, vendors: state.vendors })); render(); };
const dateInput = $('input[name="date"]');
if (state.brief) {
  for (const [key, value] of Object.entries({location:state.brief.location,date:state.brief.date,guests:state.brief.guests,eventType:state.brief.eventType,dietary:state.brief.dietary,budget:state.brief.budget,currency:state.brief.currency,notes:state.brief.notes})) {
    const field = document.querySelector(`[name="${key}"]`);
    if (field && value !== null && value !== undefined) field.value = value;
  }
} else if (dateInput) { const d = new Date(); d.setDate(d.getDate()+7); dateInput.value = d.toISOString().slice(0,10); }
function briefFromForm(){ const f = new FormData($("#brief-form")); return { location:f.get("location").trim(),date:f.get("date"),guests:Number(f.get("guests")),eventType:f.get("eventType").trim(),dietary:f.get("dietary").trim(),budget:f.get("budget") ? Number(f.get("budget")) : null,currency:f.get("currency"),notes:f.get("notes").trim() }; }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2); }
function statusLabel(v){ return ({lead:"Not contacted",drafted:"Draft prepared",contacted:"Contacted",replied:"Reply received",quoted:"Price quoted",unavailable:"Unavailable", "no-reply":"No reply"})[v] || v; }
function render(){ const vendors=state.vendors; $("#nav-count").textContent=vendors.length; $("#stat-vendors").textContent=vendors.length; $("#stat-contacted").textContent=vendors.filter(v=>["contacted","replied","quoted","unavailable","no-reply"].includes(v.status)).length; $("#stat-replies").textContent=vendors.filter(v=>["replied","quoted","unavailable"].includes(v.status)).length; $("#stat-quotes").textContent=vendors.filter(v=>v.status==="quoted" && v.price && v.price.trim()).length; $("#vendor-total").textContent=vendors.length+" VENDORS"; const contacted=vendors.filter(v=>["contacted","replied","quoted","unavailable","no-reply"].includes(v.status)).length; const pct=vendors.length?Math.round(contacted/vendors.length*100):0; $("#progress-fill").style.width=pct+"%"; $("#progress-text").textContent=pct+"%"; $("#action-search").textContent=vendors.length?"COMPLETE":"WAITING"; $("#action-search").classList.toggle("done",!!vendors.length); $("#action-contact").textContent=contacted?"IN PROGRESS":"WAITING"; $("#action-contact").classList.toggle("done",!!contacted); $("#action-report").textContent=vendors.some(v=>v.status!=="lead")?"READY":"WAITING"; $("#action-report").classList.toggle("done",vendors.some(v=>v.status!=="lead")); $("#empty-state").style.display=vendors.length?"none":"block"; $("#vendor-list").innerHTML=vendors.map(v=>`<article class="vendor-card"><div class="vendor-top"><div><div class="vendor-name">${esc(v.name)}</div><div class="vendor-meta">${esc([v.address,v.phone,v.email].filter(Boolean).join(" · ")||v.website||"Contact details not yet available")}</div>${v.category?`<div class="vendor-meta"><span class="pill">${esc(v.category)}</span> · ${esc(v.source||"Listing")}</div>`:""}${v.website?`<div class="vendor-meta"><a href="${esc(v.website)}" target="_blank" rel="noopener" style="color:#c4f36b">Website ↗</a></div>`:""}${v.evidence&&/^https?:\/\//i.test(v.evidence)?`<div class="vendor-meta"><a href="${esc(v.evidence)}" target="_blank" rel="noopener" style="color:#c4f36b">Contact source ↗</a></div>`:""}${v.mapsUrl?`<div class="vendor-meta"><a href="${esc(v.mapsUrl)}" target="_blank" rel="noopener" style="color:#c4f36b">Open map ↗</a></div>`:""}${v.phone?`<div class="vendor-meta"><a href="tel:${esc(v.phone)}" style="color:#c4f36b">Call ${esc(v.phone)}</a> · <a href="https://wa.me/${esc(normalizeWhatsAppNumber(v.phone,state.brief?.location||""))}?text=${encodeURIComponent(makeEmail(v,state.brief||{eventType:"group meal",location:"",date:"",guests:"",dietary:"",budget:null,currency:"",notes:""}))}" target="_blank" rel="noopener" style="color:#c4f36b">WhatsApp ↗</a></div>`:""}${v.email?`<div class="vendor-meta"><a href="mailto:${esc(v.email)}" style="color:#c4f36b">Email vendor ↗</a></div>`:""}<div class="vendor-meta"><a href="https://www.google.com/search?q=${encodeURIComponent([v.name,state.brief?.location||"", "official contact website email phone"].filter(Boolean).join(" "))}" target="_blank" rel="noopener" style="color:#c4f36b">Find public contact details ↗</a></div>${v.price?`<div class="vendor-meta" style="color:#c4f36b;margin-top:8px">Recorded quote: ${esc(v.price)}</div>`:""}${v.details?`<div class="vendor-meta" style="margin-top:7px">Response: ${esc(v.details)}</div>`:""}</div><span class="pill ${v.status==="quoted"?"quoted":v.status==="no-reply"?"no-reply":""}">${esc(statusLabel(v.status))}</span></div><div class="vendor-actions"><button class="tiny-btn" data-action="edit" data-id="${esc(v.id)}">Edit details</button><button class="tiny-btn accent" data-action="draft" data-id="${esc(v.id)}">Prepare inquiry</button><button class="tiny-btn" data-action="copy" data-id="${esc(v.id)}">Copy inquiry</button><button class="tiny-btn" data-action="whatsapp" data-id="${esc(v.id)}" ${v.phone?"":"disabled"}>Send via WhatsApp</button><button class="tiny-btn" data-action="send" data-id="${esc(v.id)}">Send via email</button><button class="tiny-btn" data-action="reply" data-id="${esc(v.id)}">Record response</button><button class="tiny-btn" data-action="contacted" data-id="${esc(v.id)}">Mark contacted</button><button class="tiny-btn" data-action="delete" data-id="${esc(v.id)}">Remove</button></div></article>`).join(""); renderReport(); }
function renderReport(){ const b=state.brief,vs=state.vendors; if(!b&&!vs.length){$("#report-preview").innerHTML="<p>Complete an event brief and track vendor responses to generate a report.</p>";return;} const quotes=vs.filter(v=>v.status==="quoted"&&v.price); const noReply=vs.filter(v=>v.status==="no-reply"); const pending=vs.filter(v=>["lead","drafted","contacted"].includes(v.status)); const overdue=vs.filter(v=>v.status==="contacted"&&v.followUpAt&&new Date(v.followUpAt)<=new Date()); $("#report-preview").innerHTML=`<div class="report-grid"><div class="report-metric"><strong>${vs.length}</strong><span>Vendors identified</span></div><div class="report-metric"><strong>${quotes.length}</strong><span>Recorded quotes</span></div><div class="report-metric"><strong>${noReply.length}</strong><span>No reply recorded</span></div></div><div class="report-note"><strong style="color:#edf3eb">Event brief</strong><br>${b?`${esc(b.eventType)} · ${esc(b.guests)} guests · ${esc(b.location)} · ${esc(b.date)}<br>Dietary needs: ${esc(b.dietary||"Not specified")} · Budget: ${b.budget!==null&&b.budget!==undefined?esc(b.budget+" "+b.currency+" per person"):"Not specified"}`:"No event brief saved."}</div><div class="report-note">Only prices recorded from vendor responses are treated as quotes. Search results do not confirm availability. ${noReply.length} vendor(s) are explicitly marked as no reply. ${overdue.length} contacted vendor(s) are past their 48-hour follow-up reminder and should be checked before being marked non-responsive.</div><table class="report-table"><thead><tr><th>Vendor</th><th>Status</th><th>Price stated</th><th>Evidence / details</th></tr></thead><tbody>${vs.length?vs.map(v=>`<tr><td>${esc(v.name)}<br><span style="color:#91a092">${esc(v.email||v.phone||v.website||"No contact recorded")}</span>${v.contactedAt?`<br><span style="color:#91a092">Contacted: ${esc(new Date(v.contactedAt).toLocaleString())}</span>`:""}${v.followUpAt?`<br><span style="color:#91a092">Follow-up: ${esc(new Date(v.followUpAt).toLocaleString())}</span>`:""}</td><td>${esc(statusLabel(v.status))}</td><td>${esc(v.price||"Not confirmed")}</td><td>${esc([v.details,v.evidence].filter(Boolean).join(" | ")||"No response evidence recorded")}</td></tr>`).join(""):'<tr><td colspan="4">No vendors recorded yet.</td></tr>'}</tbody></table>${pending.length?`<p style="margin-top:12px">${pending.length} vendor(s) still need outreach or a response update.</p>`:""}`; }
async function discover(brief){ const response=await fetch("/api/vendors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(brief)}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||"Vendor search failed"); return data; }
$("#brief-form").addEventListener("submit",async e=>{e.preventDefault();state.brief=briefFromForm();save();const btn=$("#search-btn");btn.disabled=true;btn.innerHTML="Searching real vendor listings…";try{const data=await discover(state.brief);const found=data.vendors||[];let added=0;for(const item of found){const itemName=String(item.name||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();const itemAddress=String(item.address||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();if(!state.vendors.some(v=>(v.placeId&&v.placeId===item.placeId)||(String(v.name||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()===itemName&&String(v.address||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()===itemAddress))){state.vendors.push({...item,id:id(),status:"lead",price:"",details:"",evidence:"",source:item.source||"OpenStreetMap"});added++;}}save();$("#action-search").textContent="COMPLETE";if(!found.length)alert("Search completed but returned no vendors. Try a broader location or add vendors manually.");else alert(`Added ${added} vendor(s) from ${data.source||"search"} results. These are leads only, not confirmed availability or quotes.`);}catch(err){alert(err.message+"\n\nYou can still add vendors manually. Live search uses OpenStreetMap by default; GOOGLE_MAPS_API_KEY is optional.");}finally{btn.disabled=false;btn.innerHTML='<span>⌕</span> Find caterers <span class="arrow">↗</span>';}});

function openVendorDialog(v=null){
  const form=$("#vendor-form");form.reset();
  form.elements.vendorId.value=v?.id||"";
  form.elements.name.value=v?.name||"";
  form.elements.website.value=v?.website||"";
  form.elements.email.value=v?.email||"";
  form.elements.phone.value=v?.phone||"";
  form.elements.source.value=v?.source||"";
  $("#vendor-dialog-title").textContent=v?"Edit vendor details":"Add vendor";
  $("#vendor-submit").textContent=v?"Save changes ↗":"Add to pipeline ↗";
  $("#vendor-dialog").showModal();
}
$("#add-vendor").addEventListener("click",()=>openVendorDialog());$("#empty-add").addEventListener("click",()=>openVendorDialog());$("#close-dialog").addEventListener("click",()=>$("#vendor-dialog").close());$("#close-reply").addEventListener("click",()=>$("#reply-dialog").close());
$("#vendor-form").addEventListener("submit",e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name")||"").trim();if(!name)return;
  const vendorId=String(f.get("vendorId")||"");
  const fields={name,website:String(f.get("website")||"").trim(),email:String(f.get("email")||"").trim(),phone:String(f.get("phone")||"").trim(),source:String(f.get("source")||"").trim()||"Manually added"};
  if(vendorId){const existing=state.vendors.find(v=>v.id===vendorId);if(existing)Object.assign(existing,fields);}
  else state.vendors.push({id:id(),...fields,address:"",status:"lead",price:"",details:"",evidence:""});
  $("#vendor-dialog").close();save();
});
$("#vendor-list").addEventListener("click",async e=>{const btn=e.target.closest("button[data-action]");if(!btn)return;const v=state.vendors.find(x=>x.id===btn.dataset.id);if(!v)return;switch(btn.dataset.action){case"edit":openVendorDialog(v);break;case"copy":{if(!state.brief){alert("Save an event brief first.");return;}const draft=makeEmail(v,state.brief);try{await navigator.clipboard.writeText(draft);alert("Inquiry copied. Paste it into WhatsApp, email, or your preferred contact channel.");}catch{alert(draft);}break;}case"delete":state.vendors=state.vendors.filter(x=>x.id!==v.id);save();break;case"contacted":v.status="contacted";v.contactedAt=v.contactedAt||new Date().toISOString();v.followUpAt=v.followUpAt||new Date(Date.now()+48*60*60*1000).toISOString();save();break;case"reply":{const f=$("#reply-form");f.elements.vendorId.value=v.id;f.elements.status.value=v.status==="lead"?"replied":v.status;f.elements.price.value=v.price||"";f.elements.details.value=v.details||"";f.elements.evidence.value=v.evidence||"";$("#reply-dialog").showModal();break;}case"send":{if(!state.brief){alert("Save an event brief first.");return;}if(!v.email){alert("This vendor has no email address saved yet. Add the business email in the form that opens, then tap Send via email again.");openVendorDialog(v);return;}if(!confirm("Send a catering inquiry to "+v.email+"? Please confirm this is the correct business contact."))return;btn.disabled=true;try{const message=makeEmail(v,state.brief);const response=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:v.email,vendorName:v.name,subject:`Catering inquiry: ${state.brief.eventType} on ${state.brief.date}`,message})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Email could not be sent.");v.status="contacted";v.contactedAt=data.sentAt||new Date().toISOString();v.followUpAt=new Date(new Date(v.contactedAt).getTime()+48*60*60*1000).toISOString();v.evidence="Email sent via Resend at "+v.contactedAt+" (message "+data.id+")";save();alert("Inquiry sent to "+v.email+". Record the vendor reply when it arrives.");}catch(err){if(String(err.message).includes("Email sending is not configured")){const draft=makeEmail(v,state.brief);const subject=encodeURIComponent(`Catering inquiry: ${state.brief.eventType} on ${state.brief.date}`);const mailto=`mailto:${encodeURIComponent(v.email)}?subject=${subject}&body=${encodeURIComponent(draft)}`;v.status=v.status==="lead"?"drafted":v.status;save();window.location.href=mailto;alert("Direct sending is not configured yet. I opened an email draft instead. Check your email app and tap Send. The vendor will not be marked contacted until you send it.");}else alert(err.message);}finally{btn.disabled=false;}break;}case"whatsapp":{if(!state.brief){alert("Save an event brief first.");return;}if(!v.phone){alert("No phone number is saved for this vendor. Use Edit details to add one.");return;}const digits=normalizeWhatsAppNumber(v.phone,state.brief.location);if(digits.length<10){alert("This phone number looks incomplete. Edit the vendor details and check the country code before using WhatsApp.");return;}const message=makeEmail(v,state.brief);window.location.href=`https://wa.me/${digits}?text=${encodeURIComponent(message)}`;break;}case"draft":{if(!state.brief){alert("Save an event brief first.");return;}const text=makeEmail(v,state.brief);const subject=encodeURIComponent(`Catering inquiry: ${state.brief.eventType} on ${state.brief.date}`);if(v.email){window.location.href=`mailto:${encodeURIComponent(v.email)}?subject=${subject}&body=${encodeURIComponent(text)}`;}else if(v.phone){const digits=normalizeWhatsAppNumber(v.phone,state.brief.location);if(digits.length<10){alert("This phone number looks incomplete. Edit vendor details and check the country code.");return;}window.location.href=`https://wa.me/${digits}?text=${encodeURIComponent(text)}`;}else{try{await navigator.clipboard.writeText(text);alert("This vendor has no email or phone number saved. Inquiry copied to clipboard. Find their contact details, then paste the inquiry into your preferred app.");}catch{alert("This vendor has no email or phone number saved. Add contact details using Edit details, or use Copy inquiry and copy the message from there.");}}v.status=v.status==="lead"?"drafted":v.status;save();break;}}});
function normalizeWhatsAppNumber(phone, location="") {
  const raw = String(phone || "").trim();
  const hasInternationalPrefix = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  const market = String(location || "");
  if (!hasInternationalPrefix && /canada|\bca\b|toronto|ontario|united states|\busa\b|\bus\b/i.test(market) && digits.length === 10) digits = "1" + digits;
  else if (!hasInternationalPrefix && /singapore|\bsg\b/i.test(market) && digits.length === 8) digits = "65" + digits;
  else if (!hasInternationalPrefix && /nigeria|\bng\b/i.test(market) && digits.startsWith("0")) digits = "234" + digits.slice(1);
  return digits;
}
function makeEmail(v,b){return `Hello ${v.name},\n\nI'm enquiring about catering for a ${b.eventType} in ${b.location} on ${b.date} for approximately ${b.guests} guests.\n\nCould you please confirm:\n1. Whether you are available on that date and can serve this guest count.\n2. Your actual price, including per-person rate, delivery, taxes, staffing and any minimum order. Please specify the currency.\n3. Whether you can accommodate these dietary needs: ${b.dietary||"Please share your available dietary options"}.\n4. What the quoted price includes, and any deposit or cancellation terms.\n5. Your menu options and how long the quote remains valid.\n\nBudget guidance: ${b.budget!==null&&b.budget!==undefined?b.budget+" "+b.currency+" per person":"not specified"}.\nAdditional details: ${b.notes||"None at this stage"}.\n\nPlease share the price and availability you can actually offer for this date. Thank you.\n\nBest regards`;}
$("#reply-form").addEventListener("submit",e=>{
  e.preventDefault();
  const f=e.currentTarget;
  const v=state.vendors.find(x=>x.id===f.elements.vendorId.value);
  if(!v)return;
  let status=f.elements.status.value;
  const price=f.elements.price.value.trim();
  const details=f.elements.details.value.trim();
  const evidence=f.elements.evidence.value.trim();
  if(status==="quoted"&&!price){alert("Enter the actual price the vendor stated, or choose a different response status.");return;}
  if(status==="quoted"&&!evidence){if(!confirm("No evidence reference was added. Save the price anyway? For a reliable report, record an email, message, URL, or call note."))return;}
  if(price&&status==="replied")status="quoted";
  v.status=status;v.price=price;v.details=details;v.evidence=evidence;
  v.respondedAt=new Date().toISOString();
  if(["replied","quoted","unavailable"].includes(status))v.followUpAt="";
  $("#reply-dialog").close();save();
});
$("#export-report").addEventListener("click",()=>{const payload={generatedAt:new Date().toISOString(),event:state.brief,vendors:state.vendors.map(v=>({name:v.name,website:v.website||null,email:v.email||null,phone:v.phone||null,source:v.source||null,status:statusLabel(v.status),priceActuallyStated:v.price||null,responseDetails:v.details||null,evidenceReference:v.evidence||null})),integrity:{pricesAreVendorReported:true,availabilityRequiresVendorConfirmation:true,nonRespondersIncluded:true}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="caterscout-evidence-report.json";a.click();URL.revokeObjectURL(a.href);});

function csvCell(value){const text=String(value??"");return '"' + text.replace(/"/g,'""') + '"';}
$("#export-csv").addEventListener("click",()=>{
  const b=state.brief||{};
  const rows=[["Event location","Event date","Guest count","Event type","Dietary needs","Budget per person","Currency","Vendor","Category","Source","Website","Email","Phone","Status","Price actually stated","Response details","Evidence reference","Contacted at","Follow-up at"]];
  for(const v of state.vendors) rows.push([b.location||"",b.date||"",b.guests||"",b.eventType||"",b.dietary||"",b.budget??"",b.currency||"",v.name||"",v.category||"",v.source||"",v.website||"",v.email||"",v.phone||"",statusLabel(v.status),v.price||"",v.details||"",v.evidence||"",v.contactedAt||"",v.followUpAt||""]);
  const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="caterscout-evidence-report.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("#print-report").addEventListener("click",()=>{ $("#report-section").scrollIntoView({behavior:"smooth"}); setTimeout(()=>window.print(),250); });
$("#switch-us-market").addEventListener("click",()=>{if(!confirm("Switch this workspace to Toronto, Canada? This clears the current vendor shortlist so leads from different markets are not mixed. Your event date, guest count, and other event details will be kept."))return;const locationField=document.querySelector('[name="location"]');const currencyField=document.querySelector('[name="currency"]');if(locationField)locationField.value="Toronto, Ontario, Canada";if(currencyField)currencyField.value="CAD";state.brief={...(state.brief||briefFromForm()),location:"Toronto, Ontario, Canada",currency:"CAD"};state.vendors=[];save();alert("Market switched to Toronto, Canada. Tap Find caterers to run a fresh search. Contact details and availability still need to be verified.");});

$("#clean-vendors").addEventListener("click",()=>{
  const before=state.vendors.length,seen=new Set();
  state.vendors=state.vendors.filter(v=>{
    if(!String(v.name||"").trim()||String(v.name||"").trim().toLowerCase().startsWith("unnamed"))return false;
    const name=String(v.name).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const address=String(v.address||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const key=name+"|"+address;
    if(seen.has(key)&&["lead","drafted"].includes(v.status))return false;
    seen.add(key);return true;
  });
  save();alert("Shortlist cleaned. Removed "+(before-state.vendors.length)+" unnamed or duplicate lead(s). Existing response records were preserved where possible.");
});

$("#nav-vendors").addEventListener("click",()=>$("#vendors-section").scrollIntoView({behavior:"smooth"}));$("#nav-report").addEventListener("click",()=>$("#report-section").scrollIntoView({behavior:"smooth"}));
render();
