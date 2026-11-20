
'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret,defineString}=require('firebase-functions/params');
const {createService}=require('./weather-security');
const key=defineSecret('WEATHERAPI_KEY');
const allowedApps=defineString('WEATHER_ALLOWED_APP_IDS',{default:''});
function buildGetWeather({admin,db,resolveUserPlan,provider,allowedAppIds}){
 const productionProvider=async input=>{
  // Emulator must use an injected local provider; never fall through to a real API.
  if(process.env.FUNCTIONS_EMULATOR==='true')throw Error('Emulator provider not configured');
  const secret=key.value();if(!secret||secret.startsWith('SYNTHETIC-'))throw Error('Weather secret not configured');
  const url=new URL(input.operation==='forecast'?'https://api.weatherapi.com/v1/forecast.json':'https://api.weatherapi.com/v1/current.json');
  url.searchParams.set('key',secret);url.searchParams.set('q',input.location.query??(input.location.lat+','+input.location.lng));url.searchParams.set('aqi','no');
  if(input.operation==='forecast'){url.searchParams.set('days','3');url.searchParams.set('alerts','yes');}
  const response=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok)throw Error('Weather unavailable');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>1024*1024)throw Error('Weather response too large');
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
 };
 const service=createService({db,resolveUserPlan,provider:provider||productionProvider});
 return onCall({region:'us-central1',secrets:[key],enforceAppCheck:true,maxInstances:2,timeoutSeconds:30},async req=>{
  const apps=typeof allowedAppIds==='function'?allowedAppIds():allowedApps.value().split(',').map(x=>x.trim()).filter(Boolean);
  if(!req.app?.appId||!apps.includes(req.app.appId))throw new HttpsError('unauthenticated','Application verification required');
  if(!req.auth)throw new HttpsError('unauthenticated','Sign in required');
  const bearer=req.rawRequest.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  let auth;try{auth=await admin.auth().verifyIdToken(bearer,true);}catch{throw new HttpsError('unauthenticated','Session invalid or revoked');}
  if(auth.uid!==req.auth.uid||auth.firebase?.sign_in_provider==='anonymous')throw new HttpsError('permission-denied','Registered account required');
  return service(auth.uid,req.data);
 });
}
module.exports={buildGetWeather};
