// Fictitious browser fixture; no test battery. Only demo Auth/Firestore Emulator.
const path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const sdk=createRequire(path.join(process.env.SLS_F2_SDK_ROOT||path.join(os.homedir(),'AppData/Local/Temp/SmartLoad-F2-E2E-v01/SmartLoad_F2_E2E_Emulator_v01'),'package.json'));
const f=sdk('firebase/compat/app').default;sdk('firebase/compat/auth');sdk('firebase/compat/firestore');
(async()=>{
 const hub=await(await fetch('http://127.0.0.1:4400/emulators')).json();if(hub.auth?.port!==9099||hub.firestore?.port!==8180)throw Error('Emulator no confirmado');
 const app=f.initializeApp({projectId:'demo-smartload-f2',apiKey:'demo-local-only'});
 app.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});app.firestore().useEmulator('127.0.0.1',8180);
 try{
 const email=`f2-browser-${Date.now()}@example.test`,password='Fictitious-F2-Only-2026!';
 const {user}=await app.auth().createUserWithEmailAndPassword(email,password);const db=app.firestore(),batch=db.batch();
 batch.set(db.collection('users').doc(user.uid),{displayName:'F2 Browser Fictional',onboarding:{completed:true},preferences:{isDefault:false},
 costs:{isDefault:false,totalCPM:0.25,TOTAL:0.25,combustible:0.2,mantenimiento:0.05,comida:0,costosFijos:0},
 insurance:0,vehiclePayment:0,monthlyMilesGoal:3000,fuelMPG:20,fuelPricePerGallon:4,targetProfit:20,
 ownerPayMonthly:0,workDaysPerMonth:20,cpmPreference:{fuente:'real'},createdAt:new Date().toISOString()});
 for(const ym of ['2026-07','2026-08','2026-09']){
  for(let i=0;i<7;i++)batch.set(db.collection('loads').doc(`${user.uid}-${ym}-${i}`),{userId:user.uid,date:`${ym}-0${i+1}`,loadedMiles:140,deadheadMiles:10,totalMiles:150,rate:225,totalCharge:225,netProfit:175.5,origin:'Miami FL',destination:'Orlando FL'});
  for(const [category,amount]of[['fuel',210],['maintenance',105],['tolls',31.5]])batch.set(db.collection('expenses').doc(`${user.uid}-${ym}-${category}`),{userId:user.uid,date:`${ym}-15`,category,amount});
 }
 await batch.commit();console.log(JSON.stringify({uid:user.uid,email,password,historicalTolls:94.5,expectedCpm:0.3,legacyCpm:0.33}));
 }finally{await app.auth().signOut();await app.firestore().terminate();await app.delete();}
})().catch(e=>{console.error(e);process.exitCode=1;});
