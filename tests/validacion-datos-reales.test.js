/** Datos exclusivamente sintéticos. Nombre de archivo histórico; sin acceso a datos privados. */
const test=require('node:test');
const assert=require('node:assert/strict');
const FE=require('../public/js/core/financial-engine.js');
/** Lector mínimo del CSV exportado por exportFinancialData() (campos entre comillas incluidos). */
function leerCsv(texto) {
  const filas = [];
  texto.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(linea => {
    const campos = [];
    let actual = '', comillas = false;
    for (const ch of linea) {
      if (ch === '"') comillas = !comillas;
      else if (ch === ',' && !comillas) { campos.push(actual); actual = ''; }
      else actual += ch;
    }
    campos.push(actual);
    filas.push(campos);
  });
  return filas;
}

function cargarDatos(texto) {
  const filas = leerCsv(texto);
  const iGastos = filas.findIndex(f => /GASTOS|EXPENSES/.test(f[0]));
  const iResumen = filas.findIndex(f => /RESUMEN|SUMMARY/.test(f[0]));
  const dinero = s => Number(String(s).replace(/[$,]/g, '')) || 0;
  const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f[0]);
  const cargas = filas.slice(1, iGastos).filter(esFecha).map(f => ({ fecha: f[0], millas: Number(f[3]) }));
  const gastos = filas.slice(iGastos + 1, iResumen).filter(esFecha)
    .map((f, i) => ({ id: `csv-${i}`, fecha: f[0], categoria: f[1], descripcion: f[2], importe: dinero(f[3]) }));
  return { cargas, gastos };
}


const CONFIG={completa:true,cpm:0.40,combustibleEsperadoPorMilla:0.20,seguroMensual:900,pagoVehiculoMensual:600,metaMillasMes:6000};
function csvSintetico(){
 const cargas=[],gastos=[];
 for(let m=1;m<=12;m++){
  const ym=`2032-${String(m).padStart(2,'0')}`;
  if(m!==6){for(let j=1;j<=3;j++)cargas.push([`${ym}-${10+j}`,'Origen ficticio','Destino ficticio',2000,2,4000]);
   gastos.push([`${ym}-15`,'fuel','Combustible ficticio',1200],[`${ym}-16`,'food','Comida ficticia',180],[`${ym}-17`,'tolls','Peaje ficticio',60]);}
  gastos.push([`${ym}-18`,'insurance','Seguro ficticio',m===7?6000:900],[`${ym}-19`,'carpayment','Vehículo ficticio',600]);
 }
 gastos.push(['2032-08-20','insurance','Ajuste ficticio insignificante',5]);
 cargas.push(['2033-01-12','Origen ficticio','Destino ficticio',6000,2,12000]);
 const rows=[['=== REVENUE (LOADS) ==='],['Date','Origin','Destination','Miles','RPM','Revenue'],...cargas,['=== MANUAL EXPENSES ==='],['Date','Category','Description','Amount'],...gastos,['=== SUMMARY ===']];
 return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
}
const cerca=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);
test('A — CSV sintético: contabilidad y lectura',()=>{
 const {cargas,gastos}=cargarDatos(csvSintetico());
 assert.equal(cargas.length,34);assert.equal(gastos.length,58);
 assert.equal(cargas.reduce((s,c)=>s+c.millas,0),72000);
 const total=13200+1980+660+15900+7200+5;
 assert.equal(gastos.reduce((s,g)=>s+g.importe,0),total);
 cerca(total/72000,(11*1200+11*180+11*60+11*900+6000+12*600+5)/72000);
});
test('B — CPM sintético: periodo, cobertura, peajes y elección',()=>{
 const r=FE.resolverCpm({...cargarDatos(csvSintetico()),configuracion:CONFIG,mesActual:'2033-09'}),real=r.real;
 assert.equal(real.periodo.desde,'2032-01');assert.equal(real.periodo.hasta,'2032-12');
 assert.deepEqual(real.excluidos,[{mes:'2033-01',motivo:'mesFinalIncompleto'}]);
 assert.equal(real.periodo.mesesActivos,11);assert.equal(real.periodo.millas,66000);
 const esperado=(15900+7200+1980+5)/66000+0.20;
 cerca(real.cpm,esperado);cerca(real.desglose.cpmContable,(13200+15900+7200+1980+660+5)/66000);
 assert.equal(real.desglose.combustibleFuente,'reciente');assert.equal(real.confiable,true);
 assert.equal(real.cobertura.insurance.significativos,12);assert.equal(real.cobertura.insurance.cumple,true);
 assert.equal(real.cobertura.carpayment.significativos,12);assert.equal(real.cobertura.carpayment.cumple,true);
 assert.ok(real.combustibleVsEsperado>0.99&&real.combustibleVsEsperado<1.01);assert.deepEqual(real.avisos,[]);
 assert.equal(real.candidatosExtraordinarios.length,1);const c=real.candidatosExtraordinarios[0];
 assert.equal(c.categoria,'insurance');assert.equal(c.fecha,'2032-07-18');assert.equal(c.importe,6000);assert.equal(c.marcadoNoRecurrente,false);
 assert.equal(real.antiguedadMeses,9);assert.equal(real.datosAntiguos,true);
 assert.equal(r.fuente,'provisional');cerca(r.cpmAplicado,esperado);assert.equal(r.requiereEleccion,true);assert.equal(r.requiereRevision,true);
});
