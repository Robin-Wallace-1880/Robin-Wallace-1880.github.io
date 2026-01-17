const KEY = "epic_dashboard_v1";

const todayISO = () => new Date().toISOString().slice(0,10);

function startOfWeek(d=new Date()){
  const x = new Date(d);
  const day = (x.getDay()+6)%7; // Mon=0
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function toISO(d){ return new Date(d).toISOString().slice(0,10); }
function parseISO(s){ const d=new Date(s+"T00:00:00"); return isNaN(d)?null:d; }

function fmtCHF(n){
  try { return new Intl.NumberFormat('de-CH',{style:'currency',currency:'CHF',maximumFractionDigits:0}).format(n||0); }
  catch { return "CHF " + (n||0); }
}
function fmtInt(n){
  try { return new Intl.NumberFormat('de-CH').format(n||0); }
  catch { return String(n||0); }
}

function defaultState(){
  return {
    workouts: [],
    portfolio: { date: todayISO(), valueCHF: 0, monthlyCHF: 0 },
    allocation: [{label:"World ETF", pct:65},{label:"EM ETF", pct:10},{label:"CH", pct:15},{label:"Cash", pct:10}],
    events: [],
    financeNotes: "",
    quickNotes: ""
  };
}

function loadState(){
  const raw = localStorage.getItem(KEY);
  if(!raw) return defaultState();
  try {
    const st = JSON.parse(raw);
    // minimal validation
    if(!st.workouts) st.workouts=[];
    if(!st.events) st.events=[];
    if(!st.portfolio) st.portfolio={date:todayISO(),valueCHF:0,monthlyCHF:0};
    if(!st.allocation) st.allocation=[];
    if(st.financeNotes==null) st.financeNotes="";
    if(st.quickNotes==null) st.quickNotes="";
    return st;
  } catch { return defaultState(); }
}

function saveState(st){
  localStorage.setItem(KEY, JSON.stringify(st));
}

let state = loadState();
let sportsChart, allocChart, trend4wChart;

function setDefaults(){
  document.getElementById("wDate").value = todayISO();
  document.getElementById("pDate").value = state.portfolio.date || todayISO();
  document.getElementById("pValue").value = state.portfolio.valueCHF || 0;
  document.getElementById("pMonthly").value = state.portfolio.monthlyCHF || 0;

  document.getElementById("eDate").value = todayISO();
  document.getElementById("financeNotes").value = state.financeNotes || "";
  document.getElementById("quickNotes").value = state.quickNotes || "";

  // allocation textarea
  document.getElementById("allocText").value =
    (state.allocation||[]).map(x => `${x.label}, ${x.pct}`).join("\n");
}

function renderWorkouts(){
  const list = document.getElementById("workoutList");
  list.innerHTML = "";
  const items = [...state.workouts].sort((a,b)=> (b.date||"").localeCompare(a.date||"")).slice(0,20);

  for(const w of items){
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemLeft">
        <div class="itemTitle">${escapeHtml(w.sport)} • ${w.minutes} min • ${escapeHtml(w.intensity)}</div>
        <div class="itemMeta">${escapeHtml(w.date)}</div>
      </div>
      <div class="itemActions">
        <button class="smallbtn" data-del="${w.id}">Delete</button>
      </div>
    `;
    list.appendChild(el);
  }
  list.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del");
      state.workouts = state.workouts.filter(x => x.id !== id);
      saveState(state);
      refreshAll();
    });
  });
}

function weekStats(){
  const sow = startOfWeek(new Date());
  const end = new Date(sow); end.setDate(end.getDate()+7);

  const wk = state.workouts.filter(w=>{
    const d = parseISO(w.date);
    return d && d >= sow && d < end;
  });

  const minutes = wk.reduce((s,w)=>s+(Number(w.minutes)||0),0);
  const sessions = wk.length;
  const hard = wk.filter(w=>w.intensity==="Hard").length;
  return {minutes, sessions, hard, sow};
}

function renderSportsKPIs(){
  const s = weekStats();
  document.getElementById("wkMinutes").textContent = fmtInt(s.minutes);
  document.getElementById("wkSessions").textContent = fmtInt(s.sessions);
  document.getElementById("wkHard").textContent = fmtInt(s.hard);

  document.getElementById("ovWkMin").textContent = fmtInt(s.minutes);
}

function renderSportsChart(){
  const s = weekStats();
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const vals = [0,0,0,0,0,0,0];

  for(const w of state.workouts){
    const d = parseISO(w.date);
    if(!d) continue;
    const idx = Math.floor((d - s.sow)/(1000*60*60*24));
    if(idx>=0 && idx<7) vals[idx] += Number(w.minutes)||0;
  }

  const ctx = document.getElementById("sportsChart");
  if(sportsChart) sportsChart.destroy();
  sportsChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label:"Minutes", data: vals }] },
    options: { plugins:{legend:{display:false}}, responsive:true }
  });
}

function render4WeekTrend(){
  const sow = startOfWeek(new Date());
  const weeks = [];
  for(let i=3;i>=0;i--){
    const ws = new Date(sow); ws.setDate(ws.getDate()-7*i);
    const we = new Date(ws); we.setDate(we.getDate()+7);
    const minutes = state.workouts.reduce((sum,w)=>{
      const d=parseISO(w.date); if(!d) return sum;
      if(d>=ws && d<we) return sum + (Number(w.minutes)||0);
      return sum;
    },0);
    weeks.push({ label: toISO(ws), minutes });
  }

  const ctx = document.getElementById("trend4wChart");
  if(trend4wChart) trend4wChart.destroy();
  trend4wChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: weeks.map(x=>x.label),
      datasets: [{ label:"Weekly minutes", data: weeks.map(x=>x.minutes), tension:0.25 }]
    },
    options: { plugins:{legend:{display:false}}, responsive:true }
  });
}

function renderPortfolio(){
  document.getElementById("kpiValue").textContent = fmtCHF(state.portfolio.valueCHF);
  document.getElementById("kpiMonthly").textContent = fmtCHF(state.portfolio.monthlyCHF);
  document.getElementById("kpiPDate").textContent = state.portfolio.date || "—";

  document.getElementById("ovPort").textContent = fmtCHF(state.portfolio.valueCHF);
}

function parseAllocationText(txt){
  const lines = txt.split("\n").map(x=>x.trim()).filter(Boolean);
  const out = [];
  for(const line of lines){
    const parts = line.split(",").map(x=>x.trim());
    if(parts.length<2) continue;
    const label = parts.slice(0, parts.length-1).join(", ");
    const pct = Number(parts[parts.length-1]);
    if(!label || !isFinite(pct)) continue;
    out.push({label, pct});
  }
  return out;
}

function renderAllocation(){
  const alloc = state.allocation || [];
  const ctx = document.getElementById("allocChart");
  if(allocChart) allocChart.destroy();
  allocChart = new Chart(ctx, {
    type:"pie",
    data:{ labels: alloc.map(x=>x.label), datasets:[{ data: alloc.map(x=>x.pct) }] },
    options:{ responsive:true, plugins:{legend:{position:"bottom"}} }
  });
}

function renderEvents(){
  const list = document.getElementById("eventList");
  list.innerHTML = "";

  const now = new Date();
  const end = new Date(); end.setDate(end.getDate()+14);

  const events = [...state.events]
    .map(e => ({...e, _dt: new Date(`${e.date}T${e.time||"00:00"}:00`)}))
    .filter(e => e._dt >= new Date(now.toISOString().slice(0,10)+"T00:00:00") && e._dt <= end)
    .sort((a,b)=>a._dt-b._dt);

  if(events.length===0){
    list.innerHTML = `<div class="hint">No events in the next 14 days.</div>`;
  } else {
    for(const e of events){
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="itemLeft">
          <div class="itemTitle">${escapeHtml(e.title || "Event")}</div>
          <div class="itemMeta">${escapeHtml(e.date)} ${escapeHtml(e.time||"")} • ${escapeHtml(e.location||"")}</div>
        </div>
        <div class="itemActions">
          <button class="smallbtn" data-del-event="${e.id}">Delete</button>
        </div>
      `;
      list.appendChild(el);
    }
    list.querySelectorAll("[data-del-event]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-del-event");
        state.events = state.events.filter(x => x.id !== id);
        saveState(state);
        refreshAll();
      });
    });
  }

  // overview next event
  const next = [...state.events]
    .map(e => ({...e, _dt: new Date(`${e.date}T${e.time||"00:00"}:00`)}))
    .filter(e => e._dt >= now)
    .sort((a,b)=>a._dt-b._dt)[0];

  document.getElementById("ovNextEvent").textContent = next
    ? `${next.title || "Event"} (${next.date}${next.time ? " "+next.time : ""})`
    : "—";
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function refreshAll(){
  renderSportsKPIs();
  renderWorkouts();
  renderSportsChart();
  render4WeekTrend();

  renderPortfolio();
  renderAllocation();

  renderEvents();
}

function hookTabs(){
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.getAttribute("data-tab");
      document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
      document.getElementById("tab-"+t).classList.add("active");
    });
  });
}

function hookActions(){
  document.getElementById("addWorkoutBtn").addEventListener("click", ()=>{
    const date = document.getElementById("wDate").value || todayISO();
    const sport = document.getElementById("wSport").value || "Other";
    const minutes = Number(document.getElementById("wMinutes").value || 0);
    const intensity = document.getElementById("wIntensity").value || "Moderate";
    if(!minutes || minutes<=0) return alert("Minutes must be > 0");

    state.workouts.push({ id: crypto.randomUUID(), date, sport, minutes, intensity });
    saveState(state);
    document.getElementById("wMinutes").value = "";
    refreshAll();
  });

  document.getElementById("savePortfolioBtn").addEventListener("click", ()=>{
    state.portfolio.date = document.getElementById("pDate").value || todayISO();
    state.portfolio.valueCHF = Number(document.getElementById("pValue").value || 0);
    state.portfolio.monthlyCHF = Number(document.getElementById("pMonthly").value || 0);
    saveState(state);
    refreshAll();
  });

  document.getElementById("saveAllocBtn").addEventListener("click", ()=>{
    const alloc = parseAllocationText(document.getElementById("allocText").value || "");
    if(alloc.length===0) return alert("Allocation must have lines like: World ETF, 65");
    const sum = alloc.reduce((s,x)=>s+(Number(x.pct)||0),0);
    if(Math.abs(sum-100) > 1.5) {
      if(!confirm(`Allocation sums to ${sum}%. Continue anyway?`)) return;
    }
    state.allocation = alloc;
    saveState(state);
    refreshAll();
  });

  document.getElementById("saveFinanceNotesBtn").addEventListener("click", ()=>{
    state.financeNotes = document.getElementById("financeNotes").value || "";
    saveState(state);
    alert("Saved");
  });

  document.getElementById("addEventBtn").addEventListener("click", ()=>{
    const date = document.getElementById("eDate").value || todayISO();
    const time = document.getElementById("eTime").value || "";
    const title = document.getElementById("eTitle").value || "";
    const location = document.getElementById("eLoc").value || "";
    if(!title.trim()) return alert("Title is required");
    state.events.push({ id: crypto.randomUUID(), date, time, title, location });
    saveState(state);
    document.getElementById("eTitle").value = "";
    document.getElementById("eLoc").value = "";
    refreshAll();
  });

  document.getElementById("saveQuickBtn").addEventListener("click", ()=>{
    state.quickNotes = document.getElementById("quickNotes").value || "";
    saveState(state);
    alert("Saved");
  });

  document.getElementById("exportBtn").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "epic-dashboard-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importFile").addEventListener("change", async (ev)=>{
    const f = ev.target.files?.[0];
    if(!f) return;
    try{
      const text = await f.text();
      const obj = JSON.parse(text);
      state = obj;
      saveState(state);
      setDefaults();
      refreshAll();
      alert("Imported");
    } catch {
      alert("Import failed (not valid JSON).");
    } finally {
      ev.target.value = "";
    }
  });

  document.getElementById("resetBtn").addEventListener("click", ()=>{
    if(!confirm("Reset dashboard data on this device?")) return;
    state = defaultState();
    saveState(state);
    setDefaults();
    refreshAll();
  });
}

(function init(){
  hookTabs();
  hookActions();
  setDefaults();
  refreshAll();
})();