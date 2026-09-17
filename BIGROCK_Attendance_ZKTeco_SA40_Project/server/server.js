const express=require("express");
const path=require("path");
const fs=require("fs");
const ZKLib=require("node-zklib");

const app=express();
const PORT=Number(process.env.PORT||8000);
const ROOT=path.join(__dirname,"..");
const CFG_FILE=path.join(__dirname,"device-config.json");

app.use(express.json({limit:"2mb"}));
app.use(express.static(ROOT));

function readCfg(){
  try{return JSON.parse(fs.readFileSync(CFG_FILE,"utf8"))}
  catch{return {ip:"",port:4370,commKey:0}}
}
function writeCfg(c){
  const safe={ip:String(c.ip||"").trim(),port:Number(c.port||4370),commKey:Number(c.commKey||0)};
  fs.writeFileSync(CFG_FILE,JSON.stringify(safe,null,2));
  return safe;
}
let cfg=readCfg();
let connection=null;
let status={connected:false,name:"",serial:"",logs:0,lastError:""};

async function connect(){
  if(!cfg.ip) throw new Error("Set the BioPro SA40 IP address first.");
  if(connection){try{await connection.disconnect()}catch{} connection=null}
  const zk=new ZKLib(cfg.ip,cfg.port||4370,10000,4000,cfg.commKey||0,"tcp");
  await zk.createSocket();
  connection=zk;
  let info={}; try{info=await zk.getInfo()}catch{}
  let serial="";try{serial=await zk.getSerialNumber()}catch{}
  let name="ZKTeco BioPro SA40";try{name=await zk.getDeviceName()}catch{}
  status={connected:true,name,serial:serial||"",logs:info.logCounts??0,lastError:""};
  return {info,serial,name};
}
async function ensure(){if(!connection||!status.connected)return connect();return {info:null,serial:status.serial,name:status.name}}

app.get("/api/device/config",(req,res)=>res.json(cfg));
app.post("/api/device/config",(req,res)=>{cfg=writeCfg(req.body||{});connection=null;status.connected=false;res.json(cfg)});
app.get("/api/device/status",(req,res)=>res.json(status));

app.post("/api/device/test",async(req,res)=>{
  try{const d=await connect();res.json({ok:true,name:d.name,serial:d.serial,info:d.info})}
  catch(e){status.connected=false;status.lastError=e.message;res.status(500).json({error:e.message})}
});

app.post("/api/device/sync",async(req,res)=>{
  try{
    const d=await ensure();
    const logs=await connection.getAttendances();
    const data=(logs.data||[]).map(x=>({
      userId:String(x.deviceUserId??x.userId??x.userSn??""),
      attTime:new Date(x.recordTime??x.attTime).toISOString()
    })).filter(x=>x.userId&&x.attTime!=="Invalid Date");
    status.logs=data.length;
    res.json({ok:true,logs:data,device:d.name||status.name});
  }catch(e){
    status.connected=false;status.lastError=e.message;
    res.status(500).json({error:e.message})
  }
});

app.get("/api/device/users",async(req,res)=>{
  try{await ensure();const users=await connection.getUsers();res.json({users:users.data||[]})}
  catch(e){status.connected=false;status.lastError=e.message;res.status(500).json({error:e.message})}
});

app.get("/api/device/health",(req,res)=>res.json({ok:true,status}));

app.listen(PORT,"0.0.0.0",()=>console.log(`BIGROCK Attendance: http://localhost:${PORT}`));
