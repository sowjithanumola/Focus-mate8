// Simple FocusMate app: localStorage-backed, Chart.js graph, and a tiny AI assistant.
const KEY = "focusmate_entries_v1";
let entries = JSON.parse(localStorage.getItem(KEY) || "[]");

const el = id => document.getElementById(id);
const subj = el("subjectInput");
const duration = el("durationInput");
const remarks = el("remarks");
const dateInput = el("dateInput");
const addEntryBtn = el("addEntry");
const entriesList = el("entriesList");
const tpl = document.getElementById("entryTpl");
const totalTime = el("totalTime");
const sessionsCount = el("sessionsCount");
const exportBtn = el("exportBtn");
const importBtn = el("importBtn");
const aiOutput = el("aiOutput");
const aiInput = el("aiInput");
const askAi = el("askAi");
const analyzeBtn = el("analyze");
const startTimer = el("startTimer");

dateInput.value = new Date().toISOString().slice(0,10);
duration.placeholder = "Minutes focused (e.g. 25)";
render();

addEntryBtn.onclick = () => {
  const s = subj.value.trim() || "General";
  const d = parseInt(duration.value || "0", 10);
  const r = remarks.value.trim();
  const dt = dateInput.value || new Date().toISOString().slice(0,10);
  if(!d){alert("Please enter minutes focused."); return;}
  const entry = {id:Date.now().toString(), subject:s, minutes:d, remarks:r, date:dt};
  entries.unshift(entry);
  saveAndRender();
  subj.value=""; duration.value=""; remarks.value="";
}

function saveAndRender(){
  localStorage.setItem(KEY, JSON.stringify(entries));
  render();
}

function render(){
  // entries list
  entriesList.innerHTML = "";
  for(const e of entries.slice(0,50)){
    const node = tpl.content.cloneNode(true);
    node.querySelector(".subj").textContent = e.subject;
    node.querySelector(".date").textContent = e.date;
    node.querySelector(".time").textContent = e.minutes + " min";
    node.querySelector(".remark").textContent = e.remarks || "—";
    node.querySelector(".edit").onclick = ()=> editEntry(e.id);
    node.querySelector(".delete").onclick = ()=> { if(confirm("Delete this entry?")){ entries = entries.filter(x=>x.id!==e.id); saveAndRender(); } };
    entriesList.appendChild(node);
  }
  // stats
  const total = entries.reduce((s,n)=>s+n.minutes,0);
  totalTime.textContent = "Total: " + total + " min";
  sessionsCount.textContent = "Sessions: " + entries.length;
  drawChart();
}

function editEntry(id){
  const e = entries.find(x=>x.id===id);
  if(!e) return;
  const newM = prompt("Minutes focused:", e.minutes);
  if(!newM) return;
  e.minutes = parseInt(newM,10) || e.minutes;
  const newR = prompt("Remarks:", e.remarks);
  if(newR!==null) e.remarks = newR;
  saveAndRender();
}

// Chart.js visualization: monthly totals for last 30 days
let chart;
function drawChart(){
  const ctx = document.getElementById("performanceChart").getContext("2d");
  // prepare last 30 days
  const days = [];
  const now = new Date();
  for(let i=29;i>=0;i--){
    const d = new Date(now);
    d.setDate(now.getDate()-i);
    days.push(d.toISOString().slice(0,10));
  }
  const data = days.map(day => entries.filter(e=>e.date===day).reduce((s,n)=>s+n.minutes,0));
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days.map(d=>d.slice(5)),
      datasets: [{ label: 'Minutes focused', data }]
    },
    options: {
      responsive:true,
      plugins:{legend:{display:false}},
      scales:{y:{beginAtZero:true}}
    }
  });
}

// Export / Import
exportBtn.onclick = () => {
  const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = "focusmate-data.json";
  a.click();
}
importBtn.onclick = () => {
  const inp = document.createElement("input");
  inp.type="file";
  inp.accept="application/json";
  inp.onchange = e => {
    const f = e.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try{
        const parsed = JSON.parse(ev.target.result);
        if(Array.isArray(parsed)){ entries = parsed.concat(entries); saveAndRender(); alert("Imported!"); }
      }catch(err){ alert("Invalid file"); }
    };
    r.readAsText(f);
  };
  inp.click();
}

// Tiny AI assistant (no external calls): heuristics + canned tips
askAi.onclick = () => {
  const q = (aiInput.value||"").toLowerCase().trim();
  if(!q){ aiOutput.textContent = "Type a question like 'How to study for exams?' or press Analyze progress."; return; }
  aiOutput.textContent = "Thinking...";
  setTimeout(()=> {
    aiOutput.textContent = cannedResponse(q);
  }, 500);
}

analyzeBtn.onclick = () => {
  aiOutput.textContent = "Analyzing recent sessions...";
  setTimeout(()=> {
    aiOutput.textContent = analyzeProgress();
  }, 600);
}

function cannedResponse(q){
  if(q.includes("focus")||q.includes("concentr")) return "Try the Pomodoro method: 25 min focused, 5 min break. Remove distractions, put phone in another room, and set a clear goal for each session.";
  if(q.includes("motiva")||q.includes("habit")) return "Build tiny habits: start with just 10 minutes daily. Gradually increase. Celebrate small wins and review weekly.";
  if(q.includes("exams")) return "Prioritize active recall: quiz yourself, use flashcards, and practice past papers under timed conditions.";
  if(q.includes("schedule")) return "Block your calendar: assign subjects to time blocks. Alternate difficult and easy subjects for mental variety.";
  return "Here's a tip: set one clear goal per session, track time, and write one sentence of reflection. Consistency beats intensity.";
}

function analyzeProgress(){
  if(!entries.length) return "No entries yet — start by recording a 25-minute focused session!";
  // compute weekly averages and subject focus
  const last30 = entries.slice(0,200).filter(e=>{
    const d = new Date(e.date); const diff = (new Date() - d)/(1000*60*60*24); return diff<=30;
  });
  if(!last30.length) return "No sessions in the last 30 days.";
  const total = last30.reduce((s,n)=>s+n.minutes,0);
  const avg = Math.round(total / Math.max(1, new Set(last30.map(e=>e.date)).size));
  const bySub = {};
  last30.forEach(e=> bySub[e.subject] = (bySub[e.subject]||0) + e.minutes);
  const top = Object.entries(bySub).sort((a,b)=>b[1]-a[1])[0];
  const weak = Object.entries(bySub).sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]).join(", ");
  return `In the last 30 days you logged ${total} minutes (avg ${avg} min/day). Your most-studied subject: ${top?top[0]:"—"}. Consider adding short daily sessions for subjects you study less: ${weak||"none"}. Keep using short focused sessions and review weekly.`;
}

// Timer helper (25-min)
startTimer.onclick = () => {
  let secs = 25*60;
  startTimer.disabled = true;
  const origText = startTimer.textContent;
  const intv = setInterval(()=> {
    const m = Math.floor(secs/60), s = secs%60;
    startTimer.textContent = `${m}:${s.toString().padStart(2,"0")}`;
    secs--;
    if(secs<0){ clearInterval(intv); startTimer.disabled=false; startTimer.textContent = origText; alert("Timer finished! Add your session."); }
  },1000);
}

// initialize sample demo entries if empty (makes UI lively)
if(entries.length===0){
  const demo = [
    {id:"d1", subject:"Maths", minutes:25, remarks:"Solved 6 integrals", date:new Date().toISOString().slice(0,10)},
    {id:"d2", subject:"Physics", minutes:30, remarks:"Worked on thermodynamics", date:new Date(Date.now()-86400000).toISOString().slice(0,10)},
    {id:"d3", subject:"Chemistry", minutes:20, remarks:"Revision of acids", date:new Date(Date.now()-2*86400000).toISOString().slice(0,10)}
  ];
  entries = demo.concat(entries);
  saveAndRender();
}
