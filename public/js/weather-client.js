
(function(w){
function escape(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function request(operation,location){
 if(!w.SLSWeatherAppCheck)throw Error('Weather verification not ready');
 await w.SLSWeatherAppCheck.ensure();
 return (await w.firebase.app().functions('us-central1').httpsCallable('getWeather')({version:1,operation,location,requestId:w.crypto.randomUUID()})).data;
}
function condition(c){const n=Number(c?.code);if([1087,1273,1276,1279,1282].includes(n))return 'Tormentas';if([1066,1069,1072,1114,1117,1147,1168,1171,1198,1201,1204,1207,1210,1213,1216,1219,1222,1225,1237,1249,1252,1255,1258,1261,1264].includes(n))return 'Nieve o precipitación helada';if([1063,1150,1153,1180,1183,1186,1189,1192,1195,1240,1243,1246].includes(n))return 'Lluvia';return c?.text||'No disponible';}
function summary(d){
 const c=d.current||{},lines=['Clima actual en '+(d.location?.name||'destino')+': '+c.temp_f+' °F; '+condition(c.condition)+'.'];
 for(const f of d.forecast?.forecastday||[]){const x=f.day;lines.push('Pronóstico '+f.date+': '+x.mintemp_f+'–'+x.maxtemp_f+' °F; lluvia '+(x.daily_chance_of_rain??'no disponible')+'%; nieve '+(x.daily_chance_of_snow??'no disponible')+'%; '+condition(x.condition)+'.');}
 const alerts=(d.alerts?.alert||[]).filter(a=>!a.expires||!Number.isFinite(Date.parse(a.expires))||Date.parse(a.expires)>Date.now()).sort((a,b)=>({Extreme:0,Severe:1,Moderate:2}[a.severity]??3)-({Extreme:0,Severe:1,Moderate:2}[b.severity]??3));
 for(const a of alerts)lines.push('Alerta recibida: '+a.headline+'; severidad '+(a.severity||'no informada')+'; vigencia '+(a.effective||'no informada')+' / '+(a.expires||'no informada')+'.');
 if(!alerts.length)lines.push('No se recibieron alertas vigentes; esto no garantiza ausencia de riesgo.');
 lines.push('Checkpoints: observaciones actuales en puntos muestreados, no pronóstico de llegada.');
 return '<section aria-label="Resumen meteorológico">'+lines.map(t=>'<p>'+escape(t)+'</p>').join('')+'</section>';
}
w.SLSWeather=Object.freeze({request,summary,condition,escape});
})(window);
