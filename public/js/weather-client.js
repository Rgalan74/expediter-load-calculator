
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
// Spanish label for each WeatherAPI condition code (the provider returns English text).
const ES={1000:'Despejado',1003:'Parcialmente nublado',1006:'Nublado',1009:'Cubierto',1030:'Neblina',1063:'Lluvia dispersa',1066:'Nieve dispersa',1069:'Aguanieve dispersa',1072:'Llovizna helada dispersa',1087:'Posibles tormentas',1114:'Ventisca',1117:'Tormenta de nieve',1135:'Niebla',1147:'Niebla helada',1150:'Llovizna ligera',1153:'Llovizna',1168:'Llovizna helada',1171:'Llovizna helada fuerte',1180:'Lluvia ligera',1183:'Lluvia ligera',1186:'Lluvia moderada',1189:'Lluvia moderada',1192:'Lluvia fuerte',1195:'Lluvia fuerte',1198:'Lluvia helada ligera',1201:'Lluvia helada',1204:'Aguanieve ligera',1207:'Aguanieve',1210:'Nieve ligera',1213:'Nieve ligera',1216:'Nieve moderada',1219:'Nieve moderada',1222:'Nieve fuerte',1225:'Nieve fuerte',1237:'Granizo',1240:'Chubascos ligeros',1243:'Chubascos',1246:'Chubascos torrenciales',1249:'Chubascos de aguanieve',1252:'Chubascos de aguanieve',1255:'Chubascos de nieve',1258:'Chubascos de nieve fuertes',1261:'Granizo ligero',1264:'Granizo',1273:'Lluvia con tormenta',1276:'Tormenta fuerte con lluvia',1279:'Nieve con tormenta',1282:'Tormenta fuerte con nieve'};
function conditionEs(c){return ES[Number(c?.code)]||c?.text||'No disponible';}
// One category per condition, same code lists as condition(): storm, snow (incl. ice), rain or other.
function kind(c){const t=condition(c);return t==='Tormentas'?'storm':t==='Nieve o precipitación helada'?'snow':t==='Lluvia'?'rain':'other';}
// Counts over checkpoints that returned data ({code} or null for a failed point).
function routeCounts(points){const ok=(points||[]).filter(p=>p&&Number.isFinite(Number(p.code)));const n=k=>ok.filter(p=>kind(p)===k).length;return {total:ok.length,rain:n('rain'),snow:n('snow'),storm:n('storm')};}
// Active alerts, most severe first (Extreme, Severe, Moderate, other).
function activeAlerts(d,now=Date.now()){return (d?.alerts?.alert||[]).filter(a=>!a.expires||!Number.isFinite(Date.parse(a.expires))||Date.parse(a.expires)>now).sort((a,b)=>({Extreme:0,Severe:1,Moderate:2}[a.severity]??3)-({Extreme:0,Severe:1,Moderate:2}[b.severity]??3));}
w.SLSWeather=Object.freeze({request,summary,condition,escape,conditionEs,kind,routeCounts,activeAlerts});
})(window);
