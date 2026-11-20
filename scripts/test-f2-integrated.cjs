/* Integration gate: real application scripts + Firebase compat SDK + demo Emulator.
 * No Firebase mocks. DOM is minimal; this does not claim visual/browser QA.
 * Uses the existing temporary SDK installation; no project dependency changes.
 * Run with firebase emulators:exec --project demo-smartload-f2 --only auth,firestore
 *   --config scripts/f2-emulator/firebase.json "node scripts/test-f2-integrated.cjs"
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {createRequire}=require('node:module');
const sdkRoot=process.env.SLS_F2_SDK_ROOT||path.join(os.homedir(),'AppData/Local/Temp/SmartLoad-F2-E2E-v01/SmartLoad_F2_E2E_Emulator_v01');
const sdk=createRequire(path.join(sdkRoot,'package.json'));
const firebase=sdk('firebase/compat/app').default;
sdk('firebase/compat/auth');sdk('firebase/compat/firestore');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'public/app.html'),'utf8');
const order=[...html.matchAll(/<script[^>]+src="([^"?]+)(?:\?[^\"]*)?"/g)].map(x=>x[1]);
let passes=0;
function pass(name){console.log(`PASS ${++passes}: ${name}`);}
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v))};};
function session(search,tab=storage()){
  const logs=[],elements={};
  for(const id of ['decisionPanel','decisionTitle','netProfit'])elements[id]={textContent:'',style:{},classList:{add(){},remove(){}},scrollIntoView(){},setAttribute(k,v){this[k]=v;}};
  const f={...firebase};Object.defineProperty(f,'apps',{get:()=>firebase.apps});
  // SDK lives in Node's realm, application scripts in vm's realm. Materialize
  // only write payloads in the SDK realm; all reads/transactions remain real.
  f.firestore=Object.assign(function(...args){
    const db=firebase.firestore(...args);
    return new Proxy(db,{get(target,key){
      if(key==='runTransaction')return fn=>target.runTransaction(tx=>fn({
        get:ref=>tx.get(ref),update:(ref,patch)=>tx.update(ref,structuredClone(patch))
      }));
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});
  },firebase.firestore);
  const w={firebase:f,location:{hostname:'127.0.0.1',search},sessionStorage:tab,localStorage:storage(),
    document:{getElementById:id=>elements[id]||null,addEventListener(){},dispatchEvent(){},querySelectorAll:()=>[],querySelector:()=>null},
    console:{debug:(...args)=>logs.push(args),log(){},warn(){},error(){}},debugLog:(...args)=>logs.push(args),
    setTimeout:()=>0,clearTimeout(){},URLSearchParams,Date,Event,
    CustomEvent:class extends Event{constructor(type,options){super(type);this.detail=options?.detail;}},
    Map,Set,Proxy,navigator:{},addEventListener(){}};
  w.window=w;w.self=w;const ctx=vm.createContext(w);
  const load=name=>vm.runInContext(fs.readFileSync(path.join(root,'public',name),'utf8'),ctx,{filename:name});
  load('js/core/f2-emulator-bootstrap.js');
  // Explicit fake sentinel: bootstrap MUST replace it before initialization.
  const app=f.initializeApp({projectId:'FORBIDDEN-SENTINEL',apiKey:'not-a-key'});
  assert.equal(app.options.projectId,'demo-smartload-f2');
  const relevant=new Set(['js/core/financial-engine.js','js/core/load-shadow-f2.js','js/core/f2-cpm-adapter.js',
    'js/core/f2-runtime-bridge.js','js/calculator.js','js/custom-categories.js','js/cpm-engine.js']);
  for(const name of order)if(relevant.has(name))load(name);
  return {w,app,logs,elements,tab,async close(){await app.auth().signOut();await app.firestore().terminate();await app.delete();}};
}
async function version(s,uid){
  const token=await s.app.auth().currentUser.getIdToken();
  const r=await fetch(`http://127.0.0.1:8180/v1/projects/demo-smartload-f2/databases/(default)/documents/users/${uid}`,{headers:{Authorization:'Bearer '+token}});
  assert.equal(r.status,200);return (await r.json()).updateTime;
}
async function main(){
  const r=await fetch('http://127.0.0.1:4400/emulators',{signal:AbortSignal.timeout(5000)});
  const h=await r.json();assert.equal(h.auth.port,9099);assert.equal(h.firestore.port,8180);
  for(const k of ['auth','firestore'])assert.ok(['127.0.0.1','localhost'].includes(h[k].host));
  assert.ok(order.indexOf('js/core/f2-emulator-bootstrap.js')<order.indexOf('js/config.js'));
  for(const name of ['js/core/f2-cpm-adapter.js','js/core/f2-runtime-bridge.js'])assert.ok(order.indexOf(name)<order.indexOf('js/calculator.js'));
  const authHtml=fs.readFileSync(path.join(root,'public/auth.html'),'utf8');
  assert.ok(authHtml.indexOf('js/core/f2-emulator-bootstrap.js')<authHtml.indexOf('firebase.initializeApp('));
  pass('orden de scripts app/auth y Hub exclusivamente local');
  const email=`f2-integrated-${Date.now()}@example.test`,password='Fictitious-F2-Only-2026!';
  let s=session('?f2shadow=1');
  try{
    const cred=await s.app.auth().createUserWithEmailAndPassword(email,password),uid=cred.user.uid,db=s.app.firestore();
    const user={costs:{isDefault:false,totalCPM:0.25,TOTAL:0.25,combustible:0.2,mantenimiento:0.05,comida:0,costosFijos:0},
      insurance:0,vehiclePayment:0,monthlyMilesGoal:3000,profileData:{targetProfit:20},etiqueta:'preservar'};
    const ref=db.collection('users').doc(uid);await ref.set(user);
    const batch=db.batch();
    for(const ym of ['2026-07','2026-08','2026-09']){
      for(let i=0;i<7;i++)batch.set(db.collection('loads').doc(`${uid}-${ym}-${i}`),{userId:uid,date:`${ym}-0${i+1}`,loadedMiles:140,deadheadMiles:10});
      for(const [category,amount] of [['fuel',210],['maintenance',105],['tolls',31.5]])
        batch.set(db.collection('expenses').doc(`${uid}-${ym}-${category}`),{userId:uid,date:`${ym}-15`,category,amount});
    }
    await batch.commit();s.w.currentUser={uid,...user};
    await s.w.refreshActiveCpm(); // Actual calculator entry point, actual CPMEngine too.
    let c=s.w.SLSF2Runtime.current();assert.equal(c.real.confiable,true);assert.equal(c.fuente,'provisional');
    assert.ok(Math.abs(c.cpmAplicado-0.3)<1e-9);
    let stored=(await ref.get({source:'server'})).data();assert.equal(stored.etiqueta,'preservar');assert.equal(stored.cpmPreference,undefined);
    assert.ok(stored.ultimoCpmRealConfiable,JSON.stringify(s.logs.filter(x=>String(x[0]).includes('F2'))));
    assert.ok(Math.abs(stored.ultimoCpmRealConfiable.valor-0.3)<1e-9);
    pass('calculadora -> historial confiable -> F1 -> transaccion real del Emulator');
    const data={baseIncome:1000,others:0,tolls:0,loadedMiles:900,deadheadMiles:100,totalMiles:1000,totalCharge:1000,
      netProfit:670,actualRPM:1,profitMargin:67,profitPerMile:0.67};
    s.w.showDecisionPanel(data);
    const report=s.logs.findLast(x=>x[0]==='[SmartLoad F2 modo sombra]')?.[1];
    assert.ok(report,'comparacion debe ejecutarse desde el panel original');assert.equal(report.fuenteCPM,'provisional');
    assert.ok(Math.abs(report.gananciaNueva-700)<1e-9);assert.ok(Math.abs(report.diferenciaGanancia-30)<1e-9);
    assert.equal(s.elements.netProfit.textContent,'$670.00');
    pass('panel usa CPM F2 historico en sombra; diferencia $30 por excluir peajes, UI conserva $670');
    await ref.update({cpmPreference:{fuente:'configuracion'}});await s.w.refreshActiveCpm();
    assert.equal(s.w.SLSF2Runtime.current().fuente,'configuracion');assert.equal(s.w.SLSF2Runtime.current().cpmAplicado,0.25);
    assert.equal((await ref.get()).data().cpmPreference.fuente,'configuracion');
    pass('preferencia configuracion respetada sin sobrescritura');
    await ref.update({cpmPreference:{fuente:'real'}});await s.w.refreshActiveCpm();
    assert.equal(s.w.SLSF2Runtime.current().fuente,'real');
    const saved=(await ref.get()).data().ultimoCpmRealConfiable;
    const del=db.batch();(await db.collection('expenses').where('userId','==',uid).get()).forEach(d=>del.delete(d.ref));await del.commit();
    const tab=s.tab;await s.close();s=null;
    s=session('',tab);await s.app.auth().signInWithEmailAndPassword(email,password);
    const ref2=s.app.firestore().collection('users').doc(uid);s.w.currentUser={uid,...(await ref2.get()).data()};
    await s.w.refreshActiveCpm();c=s.w.SLSF2Runtime.current();
    assert.equal(c.fuente,'referenciaTemporal');assert.ok(c.cpmAplicado>=saved.valor);
    assert.equal((await ref2.get()).data().cpmPreference.fuente,'real');
    pass('sesion SDK nueva recupera referencia persistida con historial incompleto y preferencia real');
    const before=await version(s,uid);await s.close();s=null;
    s=session('?f2emulator=1',tab);await s.app.auth().signInWithEmailAndPassword(email,password);
    s.w.currentUser={uid,...(await s.app.firestore().collection('users').doc(uid).get()).data()};
    let calls=0;const refresh=s.w.SLSF2Runtime.refresh;s.w.SLSF2Runtime.refresh=async()=>{calls++;return refresh();};
    await s.w.refreshActiveCpm();s.w.showDecisionPanel(data);
    assert.equal(calls,0);assert.equal(s.w.SLSF2Runtime.current(),null);
    assert.equal(s.logs.filter(x=>x[0]==='[SmartLoad F2 modo sombra]').length,0);
    assert.equal(await version(s,uid),before);assert.equal(s.elements.netProfit.textContent,'$670.00');
    pass('F2 OFF: sin llamadas al puente, logs sombra ni escrituras; panel legacy operativo');
    console.log(`F2 INTEGRADA: ${passes}/${passes} PASS (SDK real + Emulator; DOM simulado)`);
  }finally{if(s)await s.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
