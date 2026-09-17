const DB_NAME="bigrockAttendanceDB", DB_VER=1;
let db, stream=null, capturedPhoto="";
const $=id=>document.getElementById(id);
const state={settings:{dutyTarget:12,breakLimit:60}};

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=()=>{db=r.result;["staff","events","settings"].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:"id",autoIncrement:true})})};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)})}
function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name)}
function all(name){return new Promise((res,rej)=>{let r=store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(name,obj){return new Promise((res,rej)=>{let r=store(name,"readwrite").put(obj);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function del(name,id){return new Promise((res,rej)=>{let r=store(name,"readwrite").delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function clearStore(name){return new Promise((res,rej)=>{let r=store(name,"readwrite").clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function dayKey(d=new Date()){return d.toISOString().slice(0,10)}
function fmtTime(ts){return new Date(ts).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function fmtDate(ts){return new Date(ts).toLocaleDateString()}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function diff(a,b){return Math.max(0,(b-a)/60000)}
function minutesText(m){m=Math.round(m);return `${Math.floor(m/60)}h ${m%60}m`}
function getEventsFor(staffId,date=dayKey()){return eventsCache.filter(e=>e.staffId===staffId&&e.date===date).sort((a,b)=>a.ts-b.ts)}
let eventsCache=[],staffCache=[];

function summary(staffId,date=dayKey()){
  const ev=getEventsFor(staffId,date); let dutyIn=null,dutyOut=null,lunchOut=null, lunchIn=null,breaks=[],openBreak=null;
  ev.forEach(e=>{
    if(e.action==="Duty IN"&&!dutyIn)dutyIn=e.ts;
    if(e.action==="Duty OUT")dutyOut=e.ts;
    if(e.action==="Lunch OUT")lunchOut=e.ts;
    if(e.action==="Lunch IN"&&lunchOut){lunchIn=e.ts}
    if(e.action==="Break OUT"&&!openBreak)openBreak=e.ts;
    if(e.action==="Break IN"&&openBreak){breaks.push([openBreak,e.ts]);openBreak=null}
  });
  let end=dutyOut||Date.now(), duty=dutyIn?diff(dutyIn,end):0;
  let breakMin=0;
  if(lunchOut) breakMin+=diff(lunchOut,lunchIn||((dutyOut||Date.now())));
  breaks.forEach(x=>breakMin+=diff(x[0],x[1]));
  if(openBreak)breakMin+=diff(openBreak,Date.now());
  return {dutyIn,dutyOut,duty,breakMin,working:!!dutyIn&&!dutyOut};
}

async function refreshCaches(){staffCache=await all("staff");eventsCache=await all("events");let ss=await all("settings");if(ss[0])Object.assign(state.settings,ss[0]);$("dutyTarget").value=state.settings.dutyTarget;$("breakLimit").value=state.settings.breakLimit}
function staffName(id){let s=staffCache.find(x=>x.id===id);return s?s.name:"Unknown"}

async function render(){
  await refreshCaches(); renderSelect(); renderDashboard(); renderStaff(); renderEvents();
}
function renderSelect(){ $("employeeSelect").innerHTML=staffCache.length?staffCache.map(s=>`<option value="${s.id}">${esc(s.empId)} — ${esc(s.name)}</option>`).join(""):`<option value="">Add staff first</option>`}
function renderDashboard(){
  const today=dayKey();let rows="",present=0,working=0,over=0;
  staffCache.forEach(s=>{let x=summary(s.id,today);if(x.dutyIn)present++;if(x.working)working++;if(x.breakMin>state.settings.breakLimit)over++;
    const cls=x.breakMin>state.settings.breakLimit?"over-row":"";
    rows+=`<tr class="${cls}"><td><b>${esc(s.name)}</b><br><small>${esc(s.empId)}</small></td><td>${x.dutyIn?fmtTime(x.dutyIn):"—"}</td><td>${x.dutyOut?fmtTime(x.dutyOut):"—"}</td><td>${minutesText(x.duty)} / ${state.settings.dutyTarget}h</td><td>${minutesText(x.breakMin)} ${x.breakMin>state.settings.breakLimit?"⚠️":""}</td><td><span class="status ${x.breakMin>state.settings.breakLimit?"bad":x.working?"ok":"warn"}">${x.breakMin>state.settings.breakLimit?"BREAK ALERT":x.working?"WORKING":x.dutyOut?"OUT":"NOT IN"}</span></td></tr>`});
  $("dashTable").innerHTML=rows||`<tr><td colspan="6">No staff added.</td></tr>`;$("statStaff").textContent=staffCache.length;$("statPresent").textContent=present;$("statWorking").textContent=working;$("statOver").textContent=over;
}
function renderStaff(){$("staffTable").innerHTML=staffCache.map(s=>`<tr><td>${s.photo?`<img class="staff-photo" src="${s.photo}">`:"👤"}</td><td>${esc(s.empId)}</td><td><b>${esc(s.name)}</b></td><td>${esc(s.dept||"—")}</td><td>${esc(s.desig||"—")}</td><td><button class="icon-btn" onclick="editStaff(${s.id})">✏️</button><button class="icon-btn" onclick="removeStaff(${s.id})">🗑️</button></td></tr>`).join("")||`<tr><td colspan="6">No staff added.</td></tr>`}
function renderEvents(){let ev=eventsCache.filter(e=>e.date===dayKey()).sort((a,b)=>b.ts-a.ts);$("eventTable").innerHTML=ev.map(e=>`<tr><td>${fmtTime(e.ts)}</td><td>${esc(staffName(e.staffId))}</td><td><b>${esc(e.action)}</b></td><td>${e.photo?"📷":"—"}</td></tr>`).join("")||`<tr><td colspan="4">No events today.</td></tr>`}

async function mark(action){
  const sid=Number($("employeeSelect").value);if(!sid)return alert("Please add/select an employee.");
  const s=summary(sid);let valid=true,msg="";
  if(action==="Duty IN"&&s.dutyIn&&!s.dutyOut){valid=false;msg="Duty is already IN."}
  if(action==="Duty OUT"&&!s.dutyIn){valid=false;msg="Duty IN is required first."}
  if(["Lunch OUT","Break OUT"].includes(action)&&!s.dutyIn){valid=false;msg="Duty IN is required first."}
  if(action==="Lunch IN"&&!getEventsFor(sid).some(e=>e.action==="Lunch OUT")){valid=false;msg="Lunch OUT is required first."}
  if(action==="Break IN"&&!getEventsFor(sid).some(e=>e.action==="Break OUT")){valid=false;msg="Break OUT is required first."}
  if(!valid)return alert(msg);
  await put("events",{staffId:sid,action,ts:Date.now(),date:dayKey(),photo:capturedPhoto||null});
  capturedPhoto="";$("photoPreview").style.display="none";await render();alert(action+" recorded for "+staffName(sid));
}
async function startCamera(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});$("camera").srcObject=stream}catch(e){alert("Camera access failed. Please allow camera permission and use HTTPS or localhost.")}}
function capture(){if(!stream)return alert("Start camera first.");let v=$("camera"),c=$("canvas");c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext("2d").drawImage(v,0,0,c.width,c.height);capturedPhoto=c.toDataURL("image/jpeg",.72);$("photoPreview").src=capturedPhoto;$("photoPreview").style.display="block";$("camera").style.display="none"}
function blobToData(file){return new Promise((res,rej)=>{if(!file)return res("");let r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}

async function addStaff(existing=null){
  $("dialogTitle").textContent=existing?"Edit Staff":"Add Staff";$("staffId").value=existing?.id||"";$("fEmpId").value=existing?.empId||"";$("fName").value=existing?.name||"";$("fDept").value=existing?.dept||"";$("fDesig").value=existing?.desig||"";$("fPhoto").value="";$("staffDialog").showModal();
}
async function saveStaff(e){e.preventDefault();let id=Number($("staffId").value)||null, old=id?staffCache.find(s=>s.id===id):null;let photo=old?.photo||"";if($("fPhoto").files[0])photo=await blobToData($("fPhoto").files[0]);await put("staff",{...(old||{}),...(id?{id}:{}),empId:$("fEmpId").value.trim(),name:$("fName").value.trim(),dept:$("fDept").value.trim(),desig:$("fDesig").value.trim(),photo});$("staffDialog").close();await render()}
window.editStaff=id=>addStaff(staffCache.find(s=>s.id===id));
window.removeStaff=async id=>{if(confirm("Delete this staff member? Attendance history will remain.")){await del("staff",id);await render()}};

function csv(rows){let keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return "\ufeff"+[keys.join(","),...rows.map(r=>keys.map(k=>`"${String(r[k]??"").replace(/"/g,'""')}"`).join(","))].join("\n")}
function download(name,text,type="text/csv"){let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function exportToday(){let rows=staffCache.map(s=>{let x=summary(s.id);return {Date:dayKey(),Employee_ID:s.empId,Name:s.name,Department:s.dept||"",Designation:s.desig||"",Duty_IN:x.dutyIn?new Date(x.dutyIn).toLocaleString():"",Duty_OUT:x.dutyOut?new Date(x.dutyOut).toLocaleString():"",Duty_Hours:(x.duty/60).toFixed(2),Total_Break_Minutes:Math.round(x.breakMin),Break_Limit:state.settings.breakLimit,Alert:x.breakMin>state.settings.breakLimit?"OVER 1 HOUR":""}});download(`BIGROCK_Attendance_${dayKey()}.csv`,csv(rows))}
function exportEvents(){download(`BIGROCK_Events_${dayKey()}.csv`,csv(eventsCache.map(e=>({Date:e.date,Time:new Date(e.ts).toLocaleString(),Employee_ID:(staffCache.find(s=>s.id===e.staffId)||{}).empId||"",Employee:staffName(e.staffId),Action:e.action,Photo:e.photo?"Captured":"None"}))))}
function exportStaff(){download("BIGROCK_Staff_Master.csv",csv(staffCache.map(s=>({Employee_ID:s.empId,Name:s.name,Department:s.dept||"",Designation:s.desig||"",Photo:s.photo?"Yes":"No"}))))}

async function backup(){let data={staff:staffCache,events:eventsCache,settings:state.settings,version:1};download("BIGROCK_Attendance_Backup.json",JSON.stringify(data,null,2),"application/json")}
async function restore(file){let text=await file.text();try{let d=JSON.parse(text);await clearStore("staff");await clearStore("events");await clearStore("settings");for(const s of d.staff||[])await put("staff",s);for(const e of d.events||[])await put("events",e);if(d.settings)await put("settings",{id:1,...d.settings});await render();alert("Backup restored.")}catch(e){alert("Invalid backup file.")}}

function initNav(){document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(b.dataset.view).classList.add("active");$("pageTitle").textContent=b.textContent.replace(/^[^A-Za-z]+/,"")})}
function tick(){let now=new Date();$("liveClock").textContent=now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});$("todayLabel").textContent=now.toLocaleDateString([], {weekday:"long",year:"numeric",month:"long",day:"numeric"});if(now.getSeconds()===0&&db)renderDashboard()}
(async()=>{await openDB();let ss=await all("settings");if(!ss.length)await put("settings",{id:1,dutyTarget:12,breakLimit:60});await render();initNav();tick();setInterval(tick,1000)})();
$("startCamera").onclick=startCamera;$("capturePhoto").onclick=capture;$("saveStaff").onclick=saveStaff;$("addStaffBtn").onclick=()=>addStaff();
document.querySelectorAll(".big-btn").forEach(b=>b.onclick=()=>mark(({dutyIn:"Duty IN",dutyOut:"Duty OUT",lunchOut:"Lunch OUT",lunchIn:"Lunch IN",breakOut:"Break OUT",breakIn:"Break IN"})[b.dataset.action]));
$("exportToday").onclick=exportToday;$("exportEvents").onclick=exportEvents;$("exportStaff").onclick=exportStaff;$("backup").onclick=backup;
$("restore").onchange=e=>e.target.files[0]&&restore(e.target.files[0]);
$("saveSettings").onclick=async()=>{state.settings.dutyTarget=Number($("dutyTarget").value)||12;state.settings.breakLimit=Number($("breakLimit").value)||60;await put("settings",{id:1,...state.settings});await render();alert("Settings saved.")};
$("clearData").onclick=async()=>{if(confirm("Delete ALL local staff, events and settings? This cannot be undone unless you have a backup.")){await clearStore("staff");await clearStore("events");await clearStore("settings");await put("settings",{id:1,dutyTarget:12,breakLimit:60});await render()}};
$("dashSearch").oninput=e=>{let q=e.target.value.toLowerCase();document.querySelectorAll("#dashTable tr").forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?"":"none")};
/* ZKTeco BioPro SA40 connector integration */
let deviceConfig={ip:"",port:4370,commKey:0};
async function loadDeviceConfig(){
  try{
    const r=await fetch("/api/device/config"); if(!r.ok)return;
    deviceConfig=await r.json();
    $("deviceIp").value=deviceConfig.ip||"";$("devicePort").value=deviceConfig.port||4370;$("deviceKey").value=deviceConfig.commKey||0;
    await deviceStatus();
  }catch(e){/* connector server not running */}
}
async function deviceStatus(){
  try{
    const r=await fetch("/api/device/status"); const d=await r.json();
    const b=$("deviceBadge"); b.textContent=d.connected?"Connected":"Connector Offline";
    b.className="status "+(d.connected?"ok":"warn");
    $("deviceInfo").innerHTML=d.connected?
      `<b class="device-online">Connected</b> — ${esc(d.name||"ZKTeco device")} ${d.serial?`· SN ${esc(d.serial)}`:""} ${d.logs!=null?`· ${d.logs} logs`:""}`:
      `<span class="device-offline">Connector not connected.</span> Start the Node connector and test again.`;
  }catch(e){
    $("deviceBadge").textContent="Connector Offline";$("deviceBadge").className="status warn";
    $("deviceInfo").innerHTML=`<span class="device-offline">Node connector is not running. Start it with <code>npm install</code> then <code>npm start</code>.</span>`;
  }
}
$("deviceSave")?.addEventListener("click",async()=>{
  const cfg={ip:$("deviceIp").value.trim(),port:Number($("devicePort").value)||4370,commKey:Number($("deviceKey").value)||0};
  try{let r=await fetch("/api/device/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cfg)});let d=await r.json();if(!r.ok)throw Error(d.error||"Save failed");deviceConfig=d;alert("Device settings saved.");await deviceStatus()}catch(e){alert("Start the Node connector first. "+e.message)}
});
$("deviceTest")?.addEventListener("click",async()=>{
  try{let r=await fetch("/api/device/test",{method:"POST"});let d=await r.json();if(!r.ok)throw Error(d.error||"Connection failed");alert(`Connected: ${d.name||"ZKTeco"}${d.serial?`\nSerial: ${d.serial}`:""}`);await deviceStatus()}catch(e){alert("Connection failed: "+e.message)}
});
$("deviceSync")?.addEventListener("click",async()=>{
  try{
    let r=await fetch("/api/device/sync",{method:"POST"});let d=await r.json();if(!r.ok)throw Error(d.error||"Sync failed");
    let imported=0;
    for(const log of (d.logs||[])){
      const emp=staffCache.find(s=>String(s.empId)===String(log.userId));
      if(!emp)continue;
      const ts=new Date(log.attTime).getTime(), date=new Date(ts).toISOString().slice(0,10);
      if(eventsCache.some(e=>e.source==="fingerprint"&&e.staffId===emp.id&&Math.abs(e.ts-ts)<2000))continue;
      const sameDay=eventsCache.filter(e=>e.staffId===emp.id&&e.date===date&&e.source==="fingerprint").sort((a,b)=>a.ts-b.ts);
      const action=(sameDay.length%2===0)?"Duty IN":"Duty OUT";
      await put("events",{staffId:emp.id,action,ts,date,photo:null,source:"fingerprint",deviceUserId:String(log.userId)});
      imported++;
    }
    await render();alert(`Fingerprint sync complete.\nReceived: ${(d.logs||[]).length}\nImported: ${imported}\nUnknown Employee IDs: ${(d.logs||[]).length-imported}`);
  }catch(e){alert("Fingerprint sync failed: "+e.message)}
});
loadDeviceConfig();
