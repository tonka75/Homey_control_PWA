'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE = 'homey-control.v1.';
const SAFE_TYPES = new Set(['light', 'socket', 'heater', 'heatpump', 'fan']);
const data = { devices: [], zones: [], flows: [], moods: [], favorites: [], filterType: 'all', page: 'overview', lastUpdated: null, connected: false, ip: '', key: '', busy: false, generation: 0, pending: new Set() };
const make = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = String(content); return node; };
const clear = node => node.replaceChildren();
const valueOf = (device, cap) => device.capabilitiesObj?.[cap]?.value;
const n = (value, decimals=1) => Number(value).toLocaleString('sv-SE', {maximumFractionDigits:decimals, minimumFractionDigits:decimals});
function safeRead(key, fallback) {try{const v=localStorage.getItem(STORE+key);return v===null?fallback:JSON.parse(v);}catch{return fallback;}}
function safelyWrite(key, value) {try{localStorage.setItem(STORE+key,JSON.stringify(value));}catch{}}
function validatedIP(ip) {
  const parts = ip.trim().split('.');
  if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255)) throw Error('Ange en giltig lokal IPv4-adress, till exempel 192.168.1.100.');
  const normalized=parts.map(Number).join('.');
  const octets=parts.map(Number);
  const local=(octets[0]===10)||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31);
  if(!local) throw Error('Av säkerhetsskäl tillåter webbappen bara privata IP-adresser i hemnätverket (10.x, 172.16–31.x eller 192.168.x).');
  return normalized;
}
function apiBase(ip) {return `https://${validatedIP(ip).replaceAll('.','-')}.homey.homeylocal.com`;}
function getCredentials() {return {ip:data.ip,key:data.key};}
function storeCredentials(ip,key,remember) {
  // Store the key only when expressly opted in. Otherwise keep it for the current app session.
  try{sessionStorage.setItem(STORE+'sessionKey',key);}catch{}
  safelyWrite('ip',ip);
  if(remember) safelyWrite('key',key); else {try{localStorage.removeItem(STORE+'key');}catch{}}
  safelyWrite('remember',Boolean(remember));
}
function safeSessionKey(){try{return sessionStorage.getItem(STORE+'sessionKey');}catch{return '';}}
function loadCredentials() {
  data.ip=String(safeRead('ip','')||'');
  data.key=String(safeRead('key','')||safeSessionKey()||'');
  data.favorites=safeRead('favorites',[]);
  if(!Array.isArray(data.favorites))data.favorites=[];
  $('#homeyIp').value=data.ip;
  $('#homeyKey').value=data.key;
  $('#rememberKey').checked=Boolean(safeRead('remember',false));
}
function toast(message,error=false){const t=$('#toast');t.textContent=message;t.classList.remove('hidden');t.classList.toggle('error',error);clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),5200);}
function banner(message,success=false){const b=$('#banner');if(!message){b.classList.add('hidden');return;}b.textContent=message;b.classList.remove('hidden');b.classList.toggle('success',success);}
function status(online){const s=$('#connStatus');s.classList.toggle('online',online);s.classList.toggle('offline',!online);s.lastChild.textContent=online?'Ansluten':'Inte ansluten';}
function go(page){if(!['overview','devices','flows','settings'].includes(page))return;data.page=page;$$('.page').forEach(e=>e.classList.toggle('active',e.id===`page-${page}`));$$('[data-page]').forEach(e=>{e.classList.toggle('selected',e.dataset.page===page);e.setAttribute('aria-current',e.dataset.page===page?'page':'false');});window.scrollTo({top:0,behavior:'instant'});}
function toList(payload){if(Array.isArray(payload))return payload;if(payload&&typeof payload==='object'){return Object.entries(payload).filter(([k,v])=>v&&typeof v==='object').map(([id,val])=>({id,...val}));}return [];}
async function request(path,method='GET',body,ip=data.ip,key=data.key){
  if(!ip||!key)throw Error('Ange IP-adress och API-nyckel under Inställningar.');
  const url=`${apiBase(ip)}/${path.replace(/^\//,'')}`;
  const headers={'Authorization':`Bearer ${key}`,'Accept':'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12500);
  try{
    const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'});
    if(!response.ok){if(response.status===401||response.status===403)throw Error('API-nyckeln saknar behörighet eller är ogiltig.');throw Error(`Homey svarade med HTTP ${response.status}.`);}
    if(response.status===204)return null;
    const text=await response.text();return text?JSON.parse(text):null;
  }catch(err){
    if(err.name==='AbortError')throw Error('Tidsgräns: Homey svarade inte. Kontrollera nätverk och IP-adress.');
    if(err instanceof TypeError)throw Error('Safari kunde inte nå Homey. Det kan bero på IP-adressen, HTTPS/DNS, åtkomst till lokalt nätverk eller CORS. Denna webbapp kan behöva en säker mellanserver eller en annan installationsmetod.');
    throw err;
  }finally{clearTimeout(timeout);}
}
async function fetchAll(ip=data.ip,key=data.key){
  const resources=[['devices','api/manager/devices/device/'],['zones','api/manager/zones/zone/'],['flows','api/manager/flow/flow/'],['advanced','api/manager/flow/advancedflow/'],['moods','api/manager/moods/mood/']];
  const r=await Promise.allSettled(resources.map(([,path])=>request(path,'GET',undefined,ip,key)));
  if(r[0].status==='rejected')throw r[0].reason;
  const get=i=>r[i].status==='fulfilled'?toList(r[i].value):[];
  return {devices:get(0),zones:get(1),flows:[...get(2).map(f=>({...f,kind:'standard'})),...get(3).map(f=>({...f,kind:'advanced'}))],moods:get(4),partial:r.slice(1).filter(x=>x.status==='rejected').length};
}
async function connect(ip,key,remember){
  if(data.busy)return;
  const generation=++data.generation;
  try{
    data.busy=true;$('#saveConnect').disabled=true;$('#saveConnect').textContent='Ansluter…';
    ip=validatedIP(ip);key=key.trim();if(!key)throw Error('Ange din Homey API-nyckel.');
    const result=await fetchAll(ip,key);if(generation!==data.generation)return;
    data.ip=ip;data.key=key;storeCredentials(ip,key,remember);
    Object.assign(data,result,{connected:true,lastUpdated:new Date()});
    status(true);banner(result.partial?`${result.partial} kategori(er) kunde inte hämtas. Kontrollera API-behörigheter.`:'');
    $('#diag').textContent=`Status: Ansluten till ${ip} · ${result.devices.length} enheter`;
    renderAll();go('overview');toast('Ansluten till Homey Pro');
  }catch(err){if(generation!==data.generation)return;data.connected=false;status(false);renderAll();banner(err.message);$('#diag').textContent=`Status: ${err.message}`;toast('Anslutningen misslyckades',true);}
  finally{data.busy=false;$('#saveConnect').disabled=false;$('#saveConnect').textContent='Testa anslutning';}
}
async function refresh(){if(data.busy)return;if(!data.ip||!data.key){go('settings');return;}data.busy=true;const generation=data.generation;$('#refresh').disabled=true;
 try{const result=await fetchAll();if(generation!==data.generation)return;Object.assign(data,result,{connected:true,lastUpdated:new Date()});status(true);banner(result.partial?`${result.partial} kategori(er) kunde inte hämtas. Vissa funktioner saknas.`:'');renderAll();toast('Enheterna uppdaterade');}
 catch(err){if(generation!==data.generation)return;data.connected=false;status(false);renderAll();banner(err.message);toast('Det gick inte att uppdatera',true);}finally{data.busy=false;$('#refresh').disabled=false;}}
function zoneName(device){const zone=data.zones.find(z=>z.id===device.zone);return zone?.name??'Okänt rum';}
function iconFor(cls){return ({light:'☀',socket:'⌁',sensor:'◉',thermostat:'♨',heater:'♨',heatpump:'♨',camera:'▣',doorbell:'♧',blinds:'▥',lawnmower:'✿',speaker:'♫',homealarm:'⬡',fridge_and_freezer:'❄'})[cls]||'◈';}
function isControllable(d){return SAFE_TYPES.has(d.class)&&Array.isArray(d.capabilities)&&d.capabilities.includes('onoff')&&typeof valueOf(d,'onoff')==='boolean'&&d.available!==false;}
function isDimmable(d){return d.class==='light'&&Array.isArray(d.capabilities)&&d.capabilities.includes('dim')&&typeof valueOf(d,'dim')==='number'&&d.available!==false;}
function deviceStatus(d){if(d.available===false)return 'Ej tillgänglig';if(!data.connected)return 'Äldre uppgifter';const t=valueOf(d,'measure_temperature'),p=valueOf(d,'measure_power'),h=valueOf(d,'measure_humidity');
 if(typeof t==='number')return `${n(t)} °C`;if(typeof p==='number')return `${n(p,0)} W`;if(typeof h==='number')return `${n(h,0)} % RH`;
 if(typeof valueOf(d,'onoff')==='boolean')return valueOf(d,'onoff')?'På':'Av';
 if(valueOf(d,'alarm_motion')===true)return 'Rörelse upptäckt';
 if(valueOf(d,'alarm_contact')===true)return 'Öppen';return d.available===false?'Ej tillgänglig':'Status tillgänglig';}
function empty(title,subtitle){const el=make('div','empty');el.append(make('strong','',title),make('span','',subtitle));return el;}
function deviceCard(d){const card=make('article','device-card');card.classList.toggle('is-on',valueOf(d,'onoff')===true);card.classList.toggle('unavailable',d.available===false);const pending=data.pending.has(d.id);const top=make('div','device-top');const icon=make('span','device-icon',iconFor(d.class));const fav=make('button','favorite-button',data.favorites.includes(d.id)?'★':'☆');
 fav.type='button';fav.setAttribute('aria-pressed',String(data.favorites.includes(d.id)));fav.classList.toggle('on',data.favorites.includes(d.id));fav.setAttribute('aria-label',data.favorites.includes(d.id)?`Ta bort ${d.name} från favoriter`:`Lägg till ${d.name} i favoriter`);
 fav.addEventListener('click',()=>{if(data.favorites.includes(d.id))data.favorites=data.favorites.filter(x=>x!==d.id);else data.favorites.push(d.id);safelyWrite('favorites',data.favorites);renderDevices();renderOverview();});top.append(icon,fav);
 const title=make('strong','device-name',d.name||'Namnlös enhet');title.title=d.name||'';const zone=make('div','device-zone',zoneName(d));const bottom=make('div','device-bottom');bottom.append(make('span','device-status',deviceStatus(d)));
 if(isControllable(d)){const v=Boolean(valueOf(d,'onoff'));const b=make('button',`toggle${v?' on':''}`);b.type='button';b.disabled=!data.connected||pending;b.setAttribute('role','switch');b.setAttribute('aria-checked',String(v));b.setAttribute('aria-label',`${v?'Stäng av':'Sätt på'} ${d.name}`);b.addEventListener('click',()=>setCapability(d,'onoff',!v,b));bottom.append(b);}
 card.append(top,title,zone,bottom);
 if(isDimmable(d)){const w=make('div','dim-wrap');const range=make('input');range.type='range';range.disabled=!data.connected||pending;range.min='0';range.max='100';range.step='1';range.value=String(Math.round(valueOf(d,'dim')*100));range.setAttribute('aria-label',`Ljusstyrka för ${d.name}`);const pct=make('span','',`${range.value}%`);range.addEventListener('input',()=>{pct.textContent=`${range.value}%`});range.addEventListener('change',()=>setCapability(d,'dim',Number(range.value)/100,range));w.append(range,pct);card.append(w);}
 return card;}
async function setCapability(d,cap,value,button){
 if(!data.connected)return toast('Anslut till Homey först',true);if(data.pending.has(d.id))return;const generation=data.generation;data.pending.add(d.id);button.disabled=true;renderDevices();renderOverview();
 try{await request(`api/manager/devices/device/${encodeURIComponent(d.id)}/capability/${encodeURIComponent(cap)}`,'PUT',{value});if(generation!==data.generation)return;d.capabilitiesObj??={};d.capabilitiesObj[cap]??={};d.capabilitiesObj[cap].value=value;renderDevices();renderOverview();toast(`${d.name} uppdaterad`);}
 catch(err){toast(`${d.name}: ${err.message}`,true);renderDevices();renderOverview();}finally{data.pending.delete(d.id);renderDevices();renderOverview();}}
function renderOverview(){const ds=data.devices;$('#statDevices').textContent=data.connected?String(ds.length):'–';$('#statLights').textContent=data.connected?String(ds.filter(d=>d.class==='light'&&valueOf(d,'onoff')===true).length):'–';$('#statFlows').textContent=data.connected?String(data.flows.length):'–';$('#statUpdated').textContent=data.lastUpdated?data.lastUpdated.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}):'–';
 const fav=$('#favoriteList');clear(fav);const favorites=ds.filter(d=>data.favorites.includes(d.id));if(favorites.length)favorites.forEach(d=>fav.append(deviceCard(d)));else fav.append(empty('Inga favoriter ännu',data.connected?'Öppna Enheter och tryck på stjärnan för att välja favoriter.':'Anslut din Homey Pro för att komma igång.'));
 renderMoodCards($('#moodQuickList'),data.moods.slice(0,4));$('#heroConnect').textContent=data.connected?'Visa mina enheter →':'Anslut din Homey →';}
function renderMoodCards(container,moods){clear(container);if(!moods.length){container.append(empty('Inga scener att visa',data.connected?'Skapa ljusscener i Homey.':'Anslut din Homey för att visa scener.'));return;}moods.forEach(m=>{const b=make('button','scene-card');b.type='button';b.disabled=!data.connected||data.pending.has('mood:'+m.id);const l=make('span','scene-left');l.append(make('span','scene-icon','☀'),make('span','scene-name',m.name));b.append(l,make('span','scene-arrow','↗'));b.addEventListener('click',()=>confirmStart(`Aktivera scenen ”${m.name}”?`,'Ljusscen',()=>runMood(m)));container.append(b);});}
function selectedDevices(){const term=$('#searchDevices').value.trim().toLocaleLowerCase('sv-SE');const zone=$('#zoneFilter').value;const allowed=zone==='all'?null:new Set([zone]);if(allowed){let changed;do{changed=false;for(const z of data.zones){if(allowed.has(z.parent)&&!allowed.has(z.id)){allowed.add(z.id);changed=true;}}}while(changed);}
 return data.devices.filter(d=>!term||(d.name||'').toLocaleLowerCase('sv-SE').includes(term)).filter(d=>!allowed||allowed.has(d.zone)).filter(d=>data.filterType==='all'||(data.filterType==='other'?!['light','socket','sensor'].includes(d.class):d.class===data.filterType)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','sv'));}
function renderDevices(){const root=$('#deviceList');clear(root);const devices=selectedDevices();if(devices.length)devices.forEach(d=>root.append(deviceCard(d)));else root.append(empty(data.connected?'Inga enheter matchar':'Ingen Homey ansluten',data.connected?'Prova ett annat rum eller sökord.':'Öppna Inställningar och anslut din Homey Pro.'));}
function renderZones(){const select=$('#zoneFilter'),selected=select.value;select.replaceChildren(make('option','','Alla rum'));select.firstChild.value='all';data.zones.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','sv')).forEach(z=>{const option=make('option','',z.name);option.value=z.id;select.append(option);});select.value=[...select.options].some(x=>x.value===selected)?selected:'all';}
function renderFlows(){renderMoodCards($('#moodList'),data.moods);const root=$('#flowList');clear(root);const flows=data.flows.filter(f=>f.enabled!==false).sort((a,b)=>(a.name||'').localeCompare(b.name||'','sv'));if(!flows.length){root.append(empty('Inga startbara Flows',data.connected?'Kontrollera behörighet att läsa Flows i Homey.':'Anslut Homey för att visa dina Flows.'));return;}
 flows.forEach(f=>{const row=make('div','flow-row');const icon=make('span','flow-icon','↗');const body=make('div','flow-body');body.append(make('strong','',f.name||'Namnlös Flow'),make('small','',f.kind==='advanced'?'Advanced Flow':'Flow'));const button=make('button','','Starta');button.addEventListener('click',()=>confirmStart(`Vill du starta ”${f.name}”?`,'Starta Flow',()=>runFlow(f)));button.disabled=!data.connected||data.pending.has('flow:'+f.id);row.append(icon,body,button);root.append(row);});}
function confirmStart(message,title,callback){const dialog=$('#confirmDialog');$('#dialogTitle').textContent=title;$('#dialogText').textContent=message;dialog.showModal();const yes=$('#confirmAction');yes.onclick=async()=>{dialog.close();await callback();};}
async function runFlow(f){if(!data.connected||data.pending.has('flow:'+f.id))return;data.pending.add('flow:'+f.id);renderFlows();try{const kind=f.kind==='advanced'?'advancedflow':'flow';await request(`api/manager/flow/${kind}/${encodeURIComponent(f.id)}/trigger`,'POST');toast(`Flow ”${f.name}” startad`);}catch(err){toast(err.message,true);}}
async function runMood(m){if(!data.connected||data.pending.has('mood:'+m.id))return;const generation=data.generation;data.pending.add('mood:'+m.id);renderAll();try{await request(`api/manager/moods/mood/${encodeURIComponent(m.id)}/set`,'POST');toast(`Scenen ”${m.name}” aktiverad`);setTimeout(()=>{if(generation===data.generation&&data.connected)refresh();},800);}catch(err){toast(err.message,true);}}
function renderAll(){renderZones();renderOverview();renderDevices();renderFlows();}
function disconnect(){data.generation++;data.pending.clear();$('#confirmDialog').close();data.devices=[];data.zones=[];data.flows=[];data.moods=[];data.lastUpdated=null;data.connected=false;data.ip='';data.key='';data.favorites=[];
 try{for(const key of ['key','ip','favorites','remember'])localStorage.removeItem(STORE+key);sessionStorage.removeItem(STORE+'sessionKey');}catch{}
 $('#homeyIp').value='';$('#homeyKey').value='';$('#rememberKey').checked=false;$('#diag').textContent='Status: Frånkopplad';status(false);banner('Uppgifterna har raderats från den här enheten.',true);renderAll();toast('Kopplad från Homey');}
function init(){loadCredentials();$$('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.goto)));
 $('#heroConnect').addEventListener('click',()=>go(data.connected?'devices':'settings'));
 $('#refresh').addEventListener('click',refresh);
 $('#connectForm').addEventListener('submit',event=>{event.preventDefault();connect($('#homeyIp').value,$('#homeyKey').value,$('#rememberKey').checked);});
 $('#showKey').addEventListener('click',()=>{const f=$('#homeyKey');f.type=f.type==='password'?'text':'password';$('#showKey').textContent=f.type==='password'?'Visa':'Dölj';});
 $('#disconnect').addEventListener('click',disconnect);
 $('#cancelAction').addEventListener('click',()=>$('#confirmDialog').close());
 $('#searchDevices').addEventListener('input',renderDevices);$('#zoneFilter').addEventListener('change',renderDevices);
 $$('#typeChips button').forEach(b=>b.addEventListener('click',()=>{data.filterType=b.dataset.type;$$('#typeChips button').forEach(x=>x.classList.toggle('active',x===b));renderDevices();}));
 renderAll();
 if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>toast('Offlineinstallationen kunde inte slutföras. Försök igen när du har internet.',true));
 window.addEventListener('offline',()=>banner('Du är offline. Sparade vyer kan visas, men styrning kräver kontakt med Homey.'));
 window.addEventListener('online',()=>{if(data.ip&&data.key)refresh();});
 $('#installDismiss').addEventListener('click',()=>{$('#installTip').classList.add('hidden');safelyWrite('hideInstall',true);});
 if(safeRead('hideInstall',false)||window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)$('#installTip').classList.add('hidden');
 if(data.ip&&data.key)refresh();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data.connected&&data.lastUpdated&&Date.now()-data.lastUpdated.getTime()>60000)refresh();});
}
document.addEventListener('DOMContentLoaded',init);
