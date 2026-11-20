// Read-only instrumentation for this browser validation, injected by local server.
(function(){
 const shadow=[],blocked=[];const debug=console.debug.bind(console);
 console.debug=function(...args){if(String(args[0]).includes('SmartLoad F2'))shadow.push(args);debug(...args);};
 document.addEventListener('securitypolicyviolation',e=>blocked.push({directive:e.effectiveDirective,url:e.blockedURI}));
 setInterval(()=>{
  let box=document.getElementById('f2-browser-proof');
  if(!box){box=document.createElement('pre');box.id='f2-browser-proof';box.style='white-space:pre-wrap;color:#fff;background:#111;padding:16px;margin:16px;font:12px monospace';document.body.appendChild(box);}
  const f=window.firebase,r=window.SLSF2Runtime?.current();
  let project=null,authEndpoint=null,firestoreEndpoint=null;
  try{project=f.app().options.projectId;authEndpoint=f.auth().emulatorConfig;firestoreEndpoint=f.firestore()._delegate._settings.host;}catch{}
  const resources=performance.getEntriesByType('resource').map(x=>({url:x.name,bytes:x.transferSize}));
  box.textContent=JSON.stringify({project,authEndpoint,firestoreEndpoint,flag:window.SLS_F2_TEST_ENABLED,
   cpm:r?{fuente:r.fuente,valor:r.cpmAplicado,real:r.real}:null,
   inputs:['loadedMiles','deadheadMiles','rate','tolls','otherCosts'].map(id=>[id,document.getElementById(id)?.value]),
   visibleProfit:document.getElementById('netProfit')?.textContent,shadow,blocked,resources},null,2);
 },500);
})();
