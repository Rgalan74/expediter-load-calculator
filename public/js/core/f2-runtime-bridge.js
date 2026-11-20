/* F2 laboratorio: lector autenticado, resolucion F1, writer transaccional.
 * Se ejecuta SOLO si un bootstrap verificado activo demo-smartload-f2.
 * Nunca altera la UI ni las funciones CPMEngine/calculator originales.
 */
(function(w){
 'use strict';
 var state=null;
 function active(){
   var x=w.__SLS_F2_EMULATOR_ONLY__;
   return !!(x&&x.projectId==='demo-smartload-f2'&&w.location.hostname.match(/^(localhost|127\.0\.0\.1)$/)&&w.SLS_F2_TEST_ENABLED===true);
 }
 function num(v){return Number.isFinite(Number(v))?Number(v):null;}
 function monthNow(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
 function configOf(u){
   var c=u.costs||{};
   var base=num(c.totalCPM??c.TOTAL);
   var fuel=num(c.combustible);
   if(c.isDefault!==false||!(base>0)||!(fuel>0))return {completa:false,cpm:base};
   return {
     completa:true,cpm:base,combustibleEsperadoPorMilla:fuel,
     seguroMensual:u.insurance==null?null:num(u.insurance),
     pagoVehiculoMensual:u.vehiclePayment==null?null:num(u.vehiclePayment),
     metaMillasMes:u.monthlyMilesGoal==null?null:num(u.monthlyMilesGoal)
   };
 }
 function candidateValid(c){return !!(c&&Number.isFinite(c.valor)&&c.valor>0&&c.valor<=100&&/^\d{4}-(0[1-9]|1[0-2])$/.test(c.periodoHasta));}
 async function refresh(){
   state=null;
   if(!active())return {estado:'apagado'};
   var f=w.firebase,auth=f.auth(),db=f.firestore(),uid=auth.currentUser?.uid;
   if(!uid||w.currentUser?.uid!==uid)return {estado:'omitido',motivo:'identidad no coincide'};
   var userDoc=await db.collection('users').doc(uid).get();
   if(!userDoc.exists||userDoc.metadata?.fromCache!==false||userDoc.metadata?.hasPendingWrites!==false||auth.currentUser?.uid!==uid)return {estado:'omitido',motivo:'usuario no confirmado por servidor'};
   var [ls,es,cats]=await Promise.all([
     db.collection('loads').where('userId','==',uid).get(),
     db.collection('expenses').where('userId','==',uid).get(),
     w.CustomCategories?.getAllCategories?.()||Promise.resolve([])
   ]);
   if(auth.currentUser?.uid!==uid) return {estado:'omitido',motivo:'sesion cambio durante lectura'};
   if([ls,es].some(s=>s.metadata?.fromCache!==false||s.metadata?.hasPendingWrites!==false))
     return {estado:'omitido',motivo:'historial no confirmado por servidor'};
   var u=userDoc.data();
   var resultado=w.SLSF2CpmAdapter.resolver({
     autenticado:true,historialCompleto:true,
     cargas:ls.docs.map(d=>({id:d.id,...d.data()})),
     gastos:es.docs.map(d=>({id:d.id,...d.data()})),
     configuracion:configOf(u),mesActual:monthNow(),
     categoriasNoOperativas:(cats||[]).filter(c=>c.isOperational===false).map(c=>c.id),
     gastosNoRecurrentes:Array.isArray(u.f2GastosNoRecurrentes)?u.f2GastosNoRecurrentes:[],
     preferencia:u.cpmPreference||null,ultimoCpmRealConfiable:u.ultimoCpmRealConfiable||null
   },w.FinancialEngine);
   if(!active()||auth.currentUser?.uid!==uid)return {estado:'omitido',motivo:'sesion/flag cambio'};
   state={uid,resultado};
   if(resultado.estado!=='resuelto')return resultado;
   // El guard de persistencia exige el certificado de F1, no el valor de CPMEngine.
   var candidate=resultado.candidato;
   if(resultado.resultado?.real?.confiable===true&&candidateValid(candidate)){
     var txResult=await db.runTransaction(async tx=>{
       if(!active()||auth.currentUser?.uid!==uid)throw Error('F2 LAB: sesion cambio');
       var ref=db.collection('users').doc(uid),doc=await tx.get(ref);
       if(!active()||auth.currentUser?.uid!==uid||w.currentUser?.uid!==uid)throw Error('F2 LAB: sesion/flag cambio durante transaccion');
       if(!doc.exists) return 'USUARIO_AUSENTE';
       var old=doc.data().ultimoCpmRealConfiable;
       if(old){
         if(old.periodoHasta>candidate.periodoHasta)return 'PERIODO_ANTIGUO';
         if(old.periodoHasta===candidate.periodoHasta)
           return Math.abs(Number(old.valor)-candidate.valor)<1e-9?'SIN_CAMBIOS':'CONFLICTO_PERIODO';
       }
       tx.update(ref,{ultimoCpmRealConfiable:{valor:candidate.valor,periodoHasta:candidate.periodoHasta}});
       return 'GUARDADO';
     });
     resultado.persistencia=txResult;
   } else resultado.persistencia='SIN_CANDIDATO_CONFIABLE';
   console.debug('[SmartLoad F2 LAB] resolucion CPM',{
     fuente:resultado.resultado.fuente,cpm:resultado.resultado.cpmAplicado,
     candidato:resultado.candidato,persistencia:resultado.persistencia
   });
   return resultado;
 }
 w.SLSF2Runtime={active,current:function(){
   if(!active()||!state||w.firebase.auth().currentUser?.uid!==state.uid||w.currentUser?.uid!==state.uid){state=null;return null;}
   return state.resultado?.resultado||null;
 },refresh};
})(window);
