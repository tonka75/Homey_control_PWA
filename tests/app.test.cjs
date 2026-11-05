const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
function app(extra={}) {
  const elements = new Map();
  const element = () => ({children:[],value:'',get firstChild(){return this.children[0];},get options(){return this.children;},classList:{toggle(){},add(){},remove(){}},
    append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},
    setAttribute(){},addEventListener(){},close(){},lastChild:{textContent:''}});
  const document={addEventListener(){},createElement:element,querySelectorAll(){return [];},
    querySelector(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const local = new Map(), session = new Map();
  const storage = map=>({getItem:key=>map.get(key)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
  const context=vm.createContext({document,localStorage:storage(local),sessionStorage:storage(session),
    AbortController,URL,Response,TypeError,Date,console,setTimeout:()=>1,clearTimeout(){},window:{scrollTo(){}},...extra});
  vm.runInContext(source,context);
  return {run:code=>vm.runInContext(code,context),elements,local,session};
}
test('only private IPv4 addresses can receive credentials',()=>{
  const a=app();
  for(const ip of ['192.168.1.7','10.0.0.2','172.16.0.1','172.31.255.254'])assert.equal(a.run(`validatedIP('${ip}')`),ip);
  for(const ip of ['8.8.8.8','127.0.0.1','172.32.0.1','192.168.1.999','evil.example','192.168.1.1/path'])assert.throws(()=>a.run(`validatedIP('${ip}')`));
  assert.equal(a.run("apiBase('192.168.1.7')"),'https://192-168-1-7.homey.homeylocal.com');
});
test('keys persist only when the user opts in',()=>{
  const a=app();a.run("storeCredentials('10.0.0.2','test-key',false)");
  assert.equal(a.local.has('homey-control.v1.key'),false);
  assert.equal(a.session.get('homey-control.v1.sessionKey'),'test-key');
  a.run("storeCredentials('10.0.0.2','test-key',true)");
  assert.equal(a.local.get('homey-control.v1.key'),'"test-key"');
  a.run("storeCredentials('10.0.0.2','test-key',false)");assert.equal(a.local.has('homey-control.v1.key'),false);
});
test('storage restrictions do not break connection',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
  const a=app({localStorage:blocked,sessionStorage:blocked});
  assert.doesNotThrow(()=>a.run("storeCredentials('10.0.0.2','test-key',false);loadCredentials()"));
});
test('requests use the documented capability path and never cache or follow redirects',async()=>{
  let called;const a=app({fetch:async(url,options)=>{called={url,options};return new Response(null,{status:204});}});
  await a.run("request('api/manager/devices/device/lamp/capability/onoff','PUT',{value:true},'10.0.0.2','test-key')");
  assert.equal(called.url,'https://10-0-0-2.homey.homeylocal.com/api/manager/devices/device/lamp/capability/onoff');
  assert.equal(called.options.headers.Authorization,'Bearer test-key');
  assert.equal(called.options.body,'{"value":true}');
  assert.equal(called.options.cache,'no-store');assert.equal(called.options.redirect,'error');
});
test('missing optional API scopes preserve devices and report partial results',async()=>{
  const a=app({fetch:async url=>url.includes('/devices/')?Response.json({lamp:{name:'Lamp'}}):new Response(null,{status:403})});
  const result=await a.run("fetchAll('10.0.0.2','test-key')");assert.equal(result.devices[0].id,'lamp');assert.equal(result.partial,4);
});
test('authentication failure is reported, not mistaken for an empty home',async()=>{
  const a=app({fetch:async()=>new Response(null,{status:401})});
  await assert.rejects(a.run("fetchAll('10.0.0.2','test-key')"),/behörighet/);
});
test('Flows are actually appended to the visible list',()=>{
  const a=app();a.run("data.connected=true;data.flows=[{id:'a',name:'Kväll',kind:'standard'},{id:'b',name:'Disabled',enabled:false}];renderFlows()");
  const rows=a.elements.get('#flowList').children;assert.equal(rows.length,1);assert.equal(rows[0].children[1].children[0].textContent,'Kväll');
});
test('stale controls are disabled and inaccessible devices show the right status',()=>{
  const a=app();assert.equal(a.run("deviceStatus({available:false,capabilitiesObj:{measure_temperature:{value:22}}})"),'Ej tillgänglig');
  assert.equal(a.run("deviceStatus({available:true})"),'Äldre uppgifter');
  const card=a.run("deviceCard({id:'a',class:'light',capabilities:['onoff'],capabilitiesObj:{onoff:{value:true}}})");
  assert.equal(card.children[3].children[1].disabled,true);
});
test('disconnect cannot be undone by an in-flight connection',async()=>{
  let resolve;const gate=new Promise(r=>resolve=r);
  const a=app({fetch:async()=>{await gate;return Response.json({});}});
  const pending=a.run("connect('10.0.0.2','test-key',true)");a.run('disconnect()');resolve();await pending;
  assert.equal(a.run('data.connected'),false);assert.equal(a.run('data.key'),'');assert.equal(a.local.has('homey-control.v1.key'),false);
});
test('every manifest icon and service-worker shell file exists',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  for(const icon of [...manifest.icons,{src:'icons/icon-180.png',sizes:'180x180'}]){
    const bytes=fs.readFileSync(path.join(root,icon.src));assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
  }
  const files=[...fs.readFileSync(path.join(root,'sw.js'),'utf8').matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]);
  for(const file of files)assert.ok(fs.existsSync(path.join(root,file||'index.html')),file);
});
