import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {google} from 'googleapis';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const app=express();
const port=Number(process.env.PORT||3001);
const mailbox=(process.env.MAILBOX_EMAIL||'info@umnni.com').trim().toLowerCase();
const subject=(process.env.REPORT_SUBJECT||'Daily Work Report').trim();
function expectedSubject(day){
  const [year,month,date]=day.split('-');
  return subject+' - '+date+'/'+month+'/'+year;
}
function matchesReportSubject(actual,day){
  // Ignore case and harmless spacing around the dash, but require the correct date.
  const normalize=s=>s.trim().replace(/\s+/g,' ').replace(/\s*-\s*/g,' - ').toLocaleLowerCase('en');
  return normalize(actual)===normalize(expectedSubject(day));
}
const configured=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_REFRESH_TOKEN);
app.use(express.json({limit:'16kb'}));
const isProduction=process.env.NODE_ENV==='production';
const hrUser=process.env.HR_USERNAME||'hradmin';
const hrPassword=process.env.HR_PASSWORD||(isProduction?'':'UMNNI@Demo2026!');
const sessions=new Map();
const attempts=new Map();
const sessionLife=8*60*60*1000;
function cookie(req,name){
  return (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
}
function verifySession(req){
  const token=cookie(req,'umnni_hr_session');
  const expiry=sessions.get(token);
  if(!token||!expiry)return false;
  if(expiry<Date.now()){sessions.delete(token);return false;}
  return true;
}
function same(a,b){
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function setSessionCookie(res,token,age){
  res.cookie('umnni_hr_session',token,{httpOnly:true,sameSite:'strict',secure:isProduction,path:'/',maxAge:age});
}
app.post('/api/login',(req,res)=>{
  if(!hrPassword)return res.status(503).json({error:'HR_PASSWORD must be configured on the server.'});
  const ip=req.ip||req.socket.remoteAddress;
  const entry=attempts.get(ip)||{count:0,until:Date.now()+15*60*1000};
  if(entry.until<Date.now()){entry.count=0;entry.until=Date.now()+15*60*1000;}
  if(entry.count>=8)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
  const username=String(req.body?.username||'');
  const password=String(req.body?.password||'');
  if(!same(username,hrUser)||!same(password,hrPassword)){
    entry.count++;attempts.set(ip,entry);
    return res.status(401).json({error:'Wrong username or password.'});
  }
  attempts.delete(ip);
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,Date.now()+sessionLife);
  setSessionCookie(res,token,sessionLife);
  res.json({ok:true});
});
app.get('/api/session',(req,res)=>res.json({authenticated:verifySession(req)}));
app.post('/api/logout',(req,res)=>{
  sessions.delete(cookie(req,'umnni_hr_session'));
  res.clearCookie('umnni_hr_session',{path:'/'});
  res.json({ok:true});
});
const samples=[
  ['rahul@example.com','18:32','Completed homepage changes and mobile menu fixes.\nTested contact form.'],
  ['aman@example.com','18:45','Updated landing page and fixed responsive styling.'],
  ['neha@example.com','18:14','Reviewed frontend issues and API integration.'],
  ['priya@example.com','18:21','Edited product reel, added subtitles and exported review copy.'],
  ['karan@example.com','18:57','Organized footage and cut social video clips.'],
  ['sana@example.com','18:08','Designed social posts and promotional banner.'],
  ['aditya@example.com','18:39','Revised brand templates and campaign graphics.'],
  ['vikas@example.com','19:03','Followed up with leads and sent two proposals.'],
  ['ishita@example.com','18:49','Completed outreach calls and scheduled follow-ups.'],
  ['anjali@example.com','18:35','Prepared sales summary and checked inquiries.']
];
const employees=JSON.parse(await readFile(path.join(root,'data/employees.json'),'utf8'));
const emailMap=new Map(employees.map(p=>[p.email.trim().toLowerCase(),p]));
if(new Set(emailMap.keys()).size!==employees.length)throw new Error('Duplicate employee email in data/employees.json');
const isDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'));
const dayIST=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const getHeader=(headers,key)=>headers?.find(h=>h.name?.toLowerCase()===key)?.value||'';
const extractAddress=s=>((s.match(/<([^<>]+)>/)||[])[1]||s).trim().toLowerCase();
function bodyText(part){
  if(!part)return '';
  if(part.mimeType==='text/plain'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8');
  for(const child of part.parts||[]){let text=bodyText(child);if(text)return text;}
  if(part.mimeType==='text/html'&&part.body?.data)return Buffer.from(part.body.data,'base64url').toString('utf8').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ');
  return '';
}
function localDate(ms){return new Date(ms).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});}
function localTime(ms){return new Date(ms).toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});}
// Reports are accepted from office start at 09:30 IST to the next midnight.
function istDayStart(day){return Date.parse(day+'T09:30:00+05:30');}
function istDayEnd(day){return Date.parse(day+'T00:00:00+05:30')+86400000;}
function auth(req,res,next){
  if(!verifySession(req))return res.status(401).json({error:'Session expired. Please log in again.'});
  next();
}
app.get('/api/reports',auth,async(req,res)=>{
  const day=String(req.query.date||dayIST());
  if(!isDay(day))return res.status(400).json({error:'Date must be YYYY-MM-DD'});
  try{
    if(!configured){
      const reports=day===dayIST()?samples.map(([email,time,body],i)=>({id:'demo-'+i,email,time,body,subject,date:day})).filter(r=>emailMap.has(r.email)):[];
      return res.json({mode:'demo',employees,reports,mailbox});
    }
    const auth=new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({refresh_token:process.env.GOOGLE_REFRESH_TOKEN});
    const gmail=google.gmail({version:'v1',auth});
    // Gmail search supports Unix timestamps. Use exact IST midnight boundaries.
    const start=istDayStart(day),end=istDayEnd(day);
    const query='after:'+Math.floor((start-1000)/1000)+' before:'+Math.floor(end/1000)+' to:'+mailbox;
    let ids=[],pageToken;
    do{
      const {data}=await gmail.users.messages.list({userId:'me',q:query,maxResults:100,pageToken});
      ids.push(...(data.messages||[]));pageToken=data.nextPageToken;
    }while(pageToken&&ids.length<1000);
    const reports=[];
    for(let i=0;i<ids.length;i+=15){
      const batch=await Promise.all(ids.slice(i,i+15).map(m=>gmail.users.messages.get({userId:'me',id:m.id,format:'full'})));
      for(const {data:m} of batch){
        const h=m.payload?.headers||[];
        const email=extractAddress(getHeader(h,'from'));
        const recipient=getHeader(h,'to').toLowerCase();
        const sentSubject=getHeader(h,'subject').trim();
        const stamp=Number(m.internalDate);
        if(!emailMap.has(email)||!recipient.includes(mailbox)||!matchesReportSubject(sentSubject,day)||stamp<start||stamp>=end)continue;
        reports.push({id:m.id,email,subject:sentSubject,date:day,time:localTime(stamp),body:bodyText(m.payload).slice(0,30000),timestamp:stamp});
      }
    }
    // One report per employee per day, latest email wins.
    reports.sort((a,b)=>b.timestamp-a.timestamp);
    const seen=new Set();
    return res.json({mode:'live',employees,reports:reports.filter(r=>!seen.has(r.email)&&seen.add(r.email)),mailbox,truncated:ids.length>=1000});
  }catch(err){console.error('Gmail read failed:',err.message);res.status(502).json({error:'Could not load Gmail reports. Check authorized OAuth access and server logs.'});}
});
app.use(cors({origin:false}));
app.use(express.static(path.join(root,'dist')));
app.get('*',(req,res)=>res.sendFile(path.join(root,'dist','index.html')));
app.listen(port,()=>console.log('UMNNI HR API running on http://127.0.0.1:'+port+(configured?' (Gmail configured)':' (demo mode)')));
