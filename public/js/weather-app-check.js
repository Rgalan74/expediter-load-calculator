
(function(w){
'use strict';
let initialized=false;
function initialize(app){
 if(initialized)return;
 const siteKey=w.document.querySelector('meta[name="sls-app-check-site-key"]')?.content?.trim();
 // An empty key is deliberately inactive; no real provider is contacted in Emulator.
 if(!siteKey||!app||String(app.options?.projectId||'').startsWith('demo-'))return;
 if(!w.firebase?.appCheck)throw Error('App Check SDK unavailable');
 w.firebase.appCheck(app).activate(new w.firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey),true);
 initialized=true;
}
async function ensure(){
 if(!initialized)throw Error('Weather verification is not configured');
 await w.firebase.appCheck().getToken(false);
}
w.SLSWeatherAppCheck=Object.freeze({initialize,ensure});
})(window);
