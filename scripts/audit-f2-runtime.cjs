/* Release gate for the existing isolated F2 app. No network, SDK or credentials.
 * node --test scripts/audit-f2-runtime.cjs
 * Default: repository candidate. SLS_F2_LAB: complete isolated app to audit.
 * Failing assertions identify unmet closure criteria, not emulator regressions.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Default validates the new candidate; SLS_F2_LAB validates the untouched lab.
const core = process.env.SLS_F2_LAB
  ? path.join(process.env.SLS_F2_LAB, 'public/js/core')
  : path.join(__dirname, '../public/js/core');
const engine = require('../public/js/core/financial-engine.js');

function fixture() {
  const loads = [], expenses = [];
  for (let m = 1; m <= 12; m++) {
    const date = `2025-${String(m).padStart(2, '0')}-15`;
    for (let n = 0; n < 5; n++) loads.push({date, totalMiles:1000, userId:'fictional-A'});
    for (const [category,amount] of [['fuel',1000],['insurance',1250],['carpayment',900],['food',200]])
      expenses.push({date,category,amount,userId:'fictional-A'});
  }
  const user = {costs:{isDefault:false,totalCPM:0.55,combustible:0.2},insurance:1250,
    vehiclePayment:900,monthlyMilesGoal:6000,
    cpmPreference:{fuente:'real',cpmReal:0.67,cpmConfig:0.55},unrelated:'preserve'};
  let reads=0, writes=0, cached=false, txHook=null;
  const snapshot = data => ({exists:true, metadata:{fromCache:cached,hasPendingWrites:false},data:()=>structuredClone(data)});
  const query = rows => ({where(){return this;},async get(){reads++;return {
    metadata:{fromCache:cached,hasPendingWrites:false},docs:rows.map((r,i)=>({id:String(i),data:()=>structuredClone(r)}))};}});
  const db = {collection(name){
    if(name==='users')return {doc:()=>({async get(){reads++;return snapshot(user);}})};
    return query(name==='loads'?loads:expenses);
  },async runTransaction(fn){return fn({async get(){reads++;const s=snapshot(user);if(txHook)txHook();return s;},
    update(ref,patch){writes++;Object.assign(user,structuredClone(patch));}});}};
  const auth={currentUser:{uid:'fictional-A'}};
  const w={location:{hostname:'127.0.0.1'},SLS_F2_TEST_ENABLED:true,
    __SLS_F2_EMULATOR_ONLY__:{projectId:'demo-smartload-f2'},currentUser:{uid:'fictional-A'},
    firebase:{auth:()=>auth,firestore:()=>db},FinancialEngine:engine,
    CustomCategories:{getAllCategories:async()=>[]}};
  const ctx=vm.createContext({window:w,self:w,console:{debug(){}},Date,URLSearchParams});
  for(const name of ['f2-cpm-adapter.js','f2-runtime-bridge.js'])
    vm.runInContext(fs.readFileSync(path.join(core,name),'utf8'),ctx,{filename:name});
  return {w,auth,user,loads,expenses,runtime:w.SLSF2Runtime,
    counts:()=>({reads,writes}),cached:()=>{cached=true;},onTransactionRead:fn=>{txHook=fn;}};
}

test('historial ficticio maduro: fuente real y candidato 0.67; preferencia preservada',async()=>{
  const f=fixture(),before=structuredClone(f.user.cpmPreference);
  const r=await f.runtime.refresh();
  assert.equal(r.resultado.real.confiable,true);
  assert.equal(r.resultado.fuente,'real');
  assert.ok(Math.abs(r.resultado.cpmAplicado-0.67)<1e-9);
  assert.equal(r.persistencia,'GUARDADO');
  assert.deepEqual(f.user.cpmPreference,before);
  assert.equal(f.user.unrelated,'preserve');
});
test('sesion nueva con historial incompleto conserva referencia persistida',async()=>{
  const f=fixture();await f.runtime.refresh();
  const saved=structuredClone(f.user.ultimoCpmRealConfiable);
  const second=fixture();second.user.ultimoCpmRealConfiable=saved;second.expenses.length=0;
  const r=await second.runtime.refresh();
  assert.ok(r.resultado.cpmAplicado>=saved.valor);
  assert.equal(second.counts().writes,0);
});
test('OFF desde inicio: cero lecturas y escrituras F2',async()=>{
  const f=fixture();f.w.SLS_F2_TEST_ENABLED=false;
  assert.equal((await f.runtime.refresh()).estado,'apagado');
  assert.deepEqual(f.counts(),{reads:0,writes:0});
});
test('barrera: apagar flag invalida inmediatamente current()',async()=>{
  const f=fixture();await f.runtime.refresh();f.w.SLS_F2_TEST_ENABLED=false;
  assert.equal(f.runtime.current(),null);
});
test('barrera: cambio de identidad invalida inmediatamente current()',async()=>{
  const f=fixture();await f.runtime.refresh();f.auth.currentUser={uid:'fictional-B'};
  f.w.currentUser={uid:'fictional-B'};assert.equal(f.runtime.current(),null);
});
test('barrera: lectura de cache no certifica historial completo ni persiste',async()=>{
  const f=fixture();f.cached();await f.runtime.refresh();
  assert.equal(f.counts().writes,0);
});
test('barrera: flag apagado durante tx.get impide tx.update',async()=>{
  const f=fixture();f.onTransactionRead(()=>{f.w.SLS_F2_TEST_ENABLED=false;});
  try {await f.runtime.refresh();} catch (_) { /* abort is acceptable */ }
  assert.equal(f.counts().writes,0);
});
test('preferencia configuracion se respeta aunque exista CPM real confiable',async()=>{
  const f=fixture();f.user.cpmPreference.fuente='configuracion';
  const r=await f.runtime.refresh();
  assert.equal(r.resultado.fuente,'configuracion');
  assert.equal(r.resultado.cpmAplicado,0.55);
  assert.equal(f.user.cpmPreference.fuente,'configuracion');
});
test('sin preferencia usa provisional y no inventa eleccion del conductor',async()=>{
  const f=fixture();delete f.user.cpmPreference;
  const r=await f.runtime.refresh();
  assert.equal(r.resultado.fuente,'provisional');
  assert.equal(r.resultado.requiereEleccion,true);
  assert.equal(f.user.cpmPreference,undefined);
});
test('datos invalidos no producen referencia persistida',async()=>{
  const f=fixture();f.expenses[0].amount='invalido';
  assert.equal((await f.runtime.refresh()).estado,'omitido');
  assert.equal(f.counts().writes,0);
});
test('origen no local no realiza operaciones F2',async()=>{
  const f=fixture();f.w.location.hostname='example.invalid';
  assert.equal((await f.runtime.refresh()).estado,'apagado');
  assert.deepEqual(f.counts(),{reads:0,writes:0});
});
test('identidad cambia durante tx.get: aborta escritura',async()=>{
  const f=fixture();f.onTransactionRead(()=>{f.auth.currentUser={uid:'fictional-B'};});
  await assert.rejects(()=>f.runtime.refresh(),/sesion/);
  assert.equal(f.counts().writes,0);
});
