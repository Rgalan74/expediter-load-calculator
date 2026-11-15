/* Local F2 opt-in, BEFORE Firebase initialization. Inert outside localhost.
 * ?f2shadow=1: Emulator + shadow ON; ?f2emulator=1: Emulator + shadow OFF.
 * Tab-scoped selection survives auth.html <-> app.html redirects.
 */
(function(w){
 'use strict';
 if(!/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname))return;
 var q=new URLSearchParams(w.location.search), enabled=false, shadow=false;
 try {
   if(q.get('f2shadow')==='1'||q.get('f2emulator')==='1'){
     w.sessionStorage.setItem('slsF2Emulator','1');
     w.sessionStorage.setItem('slsF2Shadow',q.get('f2shadow')==='1'?'1':'0');
   }
   enabled=w.sessionStorage.getItem('slsF2Emulator')==='1';
   shadow=w.sessionStorage.getItem('slsF2Shadow')==='1';
 } catch (_) {enabled=q.get('f2shadow')==='1'||q.get('f2emulator')==='1';shadow=q.get('f2shadow')==='1';}
 if(!enabled)return;
 var f=w.firebase;
 if(!f||f.apps.length)throw Error('F2: bootstrap debe preceder initializeApp');
 var original=f.initializeApp.bind(f),initialized=false;
 f.initializeApp=function(_ignored,name){
   if(initialized)throw Error('F2: inicializacion duplicada');
   initialized=true;
   var app=original({projectId:'demo-smartload-f2',apiKey:'demo-local-only',
     authDomain:'demo-smartload-f2.firebaseapp.com',appId:'1:123456789:web:demo-f2'},name);
   f.auth(app).useEmulator('http://127.0.0.1:9099',{disableWarnings:true});
   f.firestore(app).useEmulator('127.0.0.1',8180);
   if(f.functions)f.functions(app).useEmulator('127.0.0.1',5001);
   w.__SLS_F2_EMULATOR_ONLY__=Object.freeze({projectId:'demo-smartload-f2',authPort:9099,firestorePort:8180});
   return app;
 };
 // No analytics requests from the lab's Firebase SDK.
 if(f.analytics)f.analytics=function(){throw Error('F2: Analytics desactivado en Emulator');};
 w.SLS_F2_TEST_ENABLED=shadow;
})(window);
