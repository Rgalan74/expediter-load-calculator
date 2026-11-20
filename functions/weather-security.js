
'use strict';
const crypto=require('crypto');
const {HttpsError}=require('firebase-functions/v2/https');
const fail=(code,message)=>{throw new HttpsError(code,message);};
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function validate(d){
 if(!d||Object.keys(d).some(k=>!['version','operation','location','requestId'].includes(k))||d.version!==1||!['current','forecast'].includes(d.operation)||typeof d.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(d.requestId))fail('invalid-argument','Invalid request');
 const l=d.location||{},keys=Object.keys(l),coord=keys.length===2&&keys.includes('lat')&&keys.includes('lng')&&typeof l.lat==='number'&&typeof l.lng==='number'&&Number.isFinite(l.lat)&&Number.isFinite(l.lng)&&Math.abs(l.lat)<=90&&Math.abs(l.lng)<=180;
 const query=keys.length===1&&typeof l.query==='string'&&l.query.trim().length>0&&l.query.length<=160&&!/[:/\\<>]/.test(l.query);
 if(!coord&&!query)fail('invalid-argument','Invalid location');
 const location=coord?{lat:l.lat,lng:l.lng}:{query:l.query.trim()};
 return {version:1,operation:d.operation,location,requestId:d.requestId,details:d.operation==='forecast'||coord||/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(location.query||'')};
}
function authorize(profile,plan,details){
 if(!profile||(profile.accountStatus??'active')!=='active')fail('permission-denied','Calculator access denied');
 // Existing userPlans falls back to Free for legacy/unknown plan IDs.
 const effectivePlan=['free','professional','premium','admin'].includes(plan)?plan:'free';
 if(details&&!['premium','admin'].includes(effectivePlan))fail('permission-denied','Weather details require Premium access');
}
function increment(data,limits,now){
 const iso=new Date(now).toISOString(),keys={second:String(Math.floor(now/1000)),minute:iso.slice(0,16),day:iso.slice(0,10),month:iso.slice(0,7)},next={};
 for(const [kind,max]of Object.entries(limits)){const old=data?.[kind];if(old&&(kind==='second'?Number(old.key)>Number(keys[kind]):old.key>keys[kind]))fail('failed-precondition','Quota clock moved backwards');const count=old?.key===keys[kind]?old.count:0;if(count>=max)fail('resource-exhausted','Weather quota reached');next[kind]={key:keys[kind],count:count+1};}
 return next;
}
function createService({db,provider,namespace='weather',clock=Date.now,limits={},resolveUserPlan}){
 if(typeof resolveUserPlan!=='function')throw Error('Server plan resolver required');
 const caps={user:{minute:20,day:200,month:1000},global:{minute:200,day:10000,month:120000},upstream:{second:8,day:5000,month:80000},...limits};
 const doc=(c,id)=>db.collection(namespace+'_'+c).doc(id);
 async function finish(reqRef,cacheRef,inputHash){
  for(let i=0;i<200;i++){
   const result=await db.runTransaction(async tx=>{
    const [r,c]=await tx.getAll(reqRef,cacheRef);const rd=r.data(),cd=c.data();
    if(!rd||rd.inputHash!==inputHash)fail('already-exists','Request identity conflict');
    if(rd.state==='done'){if(rd.result.expiresAt<=clock())fail('failed-precondition','Weather result expired; use a new requestId');return rd.result;}if(rd.state==='failed')fail(rd.errorCode,'Weather unavailable');
    if(cd?.state==='done'&&cd.expiresAt>clock()){const result={...cd.result,cacheStatus:'hit'};tx.update(reqRef,{state:'done',result});return result;}
    if(cd?.state==='failed'){tx.update(reqRef,{state:'failed',errorCode:'unavailable'});return {failed:true};}
    return null;
   },{maxAttempts:10});
   if(result?.failed)fail('unavailable','Weather unavailable');if(result)return result;
   await new Promise(r=>setTimeout(r,25));
  }
  fail('unavailable','Weather request still pending; retry same requestId');
 }
 return async function getWeather(uid,data){
  const input=validate(data),now=clock(),canonical=JSON.stringify({operation:input.operation,location:input.location}),inputHash=digest(canonical),requestKey=digest(uid+':'+input.requestId);
  const reqRef=doc('requests',requestKey),cacheRef=doc('cache',inputHash),uRef=doc('quota',digest(uid)),gRef=doc('quota','global'),pRef=doc('quota','upstream');
  const decision=await db.runTransaction(async tx=>{
   const now=clock();
   const user=await tx.get(db.collection('users').doc(uid));
   const profile=user.exists?user.data():null;
   if(!profile||(profile.accountStatus??'active')!=='active')fail('permission-denied','Calculator access denied');
   const plan=await resolveUserPlan(uid,profile,tx);
   authorize(profile,plan,input.details);
   const [r,c,u,g,p]=await tx.getAll(reqRef,cacheRef,uRef,gRef,pRef),rd=r.data(),cd=c.data();
   if(rd){if(rd.inputHash!==inputHash)fail('already-exists','Request identity conflict');if(rd.state==='done'){if(rd.result.expiresAt<=now)fail('failed-precondition','Weather result expired; use a new requestId');return {result:rd.result};}if(rd.state==='failed')fail(rd.errorCode,'Weather unavailable');return {wait:true};}
   const uq=increment(u.data(),caps.user,now),gq=increment(g.data(),caps.global,now);
   const base={inputHash,state:'pending',createdAt:now,deleteAt:new Date(now+86400000)};
   if(cd?.state==='done'&&cd.expiresAt>now){const result={...cd.result,cacheStatus:'hit'};tx.set(uRef,{...uq,deleteAt:new Date(now+35*86400000)});tx.set(gRef,{...gq,deleteAt:new Date(now+35*86400000)});tx.set(reqRef,{...base,state:'done',result});return {result};}
   if(cd?.state==='pending'&&cd.leaseUntil>now){tx.set(uRef,{...uq,deleteAt:new Date(now+35*86400000)});tx.set(gRef,{...gq,deleteAt:new Date(now+35*86400000)});tx.set(reqRef,base);return {wait:true};}
   const pq=increment(p.data(),caps.upstream,now);
   tx.set(uRef,{...uq,deleteAt:new Date(now+35*86400000)});tx.set(gRef,{...gq,deleteAt:new Date(now+35*86400000)});tx.set(pRef,{...pq,deleteAt:new Date(now+35*86400000)});tx.set(reqRef,base);tx.set(cacheRef,{state:'pending',owner:requestKey,leaseUntil:now+30000,deleteAt:new Date(now+86400000)});return {owner:true};
  },{maxAttempts:10});
  if(decision.result)return decision.result;if(decision.wait)return finish(reqRef,cacheRef,inputHash);
  let result,errorCode;
  try{const raw=await provider(input);if(!raw?.current||!Number.isFinite(raw.current.temp_f))throw Error();result={version:1,location:raw.location,current:raw.current,...(input.operation==='forecast'?{forecast:raw.forecast,alerts:raw.alerts}:{}),fetchedAt:clock(),expiresAt:clock()+300000,cacheStatus:'miss'};}catch{errorCode='unavailable';}
  await db.runTransaction(async tx=>{const [r,c]=await tx.getAll(reqRef,cacheRef);if(c.data()?.owner!==requestKey||!r.exists)fail('aborted','Reservation ownership lost');tx.update(reqRef,errorCode?{state:'failed',errorCode}:{state:'done',result});tx.set(cacheRef,errorCode?{state:'failed',expiresAt:clock()+1000,deleteAt:new Date(clock()+86400000)}:{state:'done',result,expiresAt:result.expiresAt,deleteAt:new Date(clock()+86400000)});},{maxAttempts:10});
  if(errorCode)fail(errorCode,'Weather unavailable');return result;
 };
}
module.exports={validate,authorize,increment,createService};
