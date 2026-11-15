# Sistema Inteligente de Razonamiento de Cargas — Especificación de diseño

**Estado:** v3 rev. 4 DOCUMENTAL, 15/11/2026. Conserva la investigación y propuestas del 14/11; actualiza F1/F2, H1 y Finanzas ya registrados localmente. D5 y la función pura D14 tienen implementación autorizada en F1; las demás decisiones mantienen su estado específico (§14). Esta revisión solo cambia documentación.
**Fecha:** 14 de noviembre de 2026
**Autor:** Claude
**Base histórica:** rama `feat/motor-financiero` @ `17aaa7a` y auditoría del razonamiento del Panel de Decisiones (13/11/2026). La referencia local vigente es `4b9402f`, descrita en la revisión del 15/11.
**Documentos relacionados:** `2026-11-13-motor-financiero-design.md` (motor financiero; este documento lo usa, no lo sustituye); `2026-11-14-auditoria-heat-map.md` (auditoría de Zonas); `2026-11-14-plan-implementacion-razonamiento.md` (plan F0–F10).

Convenciones:

- **[EXISTE]** componente que ya está en la app o en la rama.
- **[PROPUESTO]** cambio o componente nuevo.
- **[DECISIÓN Dn]** requiere aprobación de Ricardo antes de implementarse (§14).
- **[NO VERIFICADO]** dato externo que no se pudo confirmar en una fuente primaria.
- **[PROVISIONAL]** cifra o umbral que se validará con datos antes de usarse para decidir.

## Revisión documental — 15/11/2026

**Revisión:** Codex, autorizada por Ricardo. Se conserva la autoría y la investigación del 14/11/2026; esta revisión registra implementación local posterior y no aprueba automáticamente decisiones futuras.
**Referencia local:** rama `feat/motor-financiero`, HEAD `4b9402f8e5008d69edcf5b3530a62e9cd8c46615`. Sin verificación de GitHub remoto ni de producción; no hay publicación ni despliegue autorizado por este documento.

| Trabajo | Commit local | Implementación | Pruebas revisadas y límites |
|---|---|---|---|
| Costos de Configuración / CPMEngine | `8c2d0a1b6bf900728cadd82d3fcc2f66b1c9e4dc` | Costos variables en USD/milla; preservación de ceros | Incluido en el conjunto aislado validado; no implica cobertura autónoma de todos los campos de Configuración |
| F1: D5 y función pura D14 | `feb95f996070f469da6d54782739c3be627a8e9a` | Fórmula 2; RPM histórico fuera del umbral; precios de referencia; clasificador D14 sin cambiar CPM | 125/125 pruebas sintéticas del conjunto motor + guardas F2. No se localizaron pruebas dedicadas a `clasificarGastosD14`; no se declaran implementadas simulaciones ni clasificación editable |
| F2: modo sombra local | `573ce472367c21224dda33487886200847193fd8` | Lector, adaptador, CPM histórico y persistencia transaccional de `ultimoCpmRealConfiable`; preferencia preservada; panel legacy conservado | SDK/Emulator 6/6 + 2/2 adicionales de idempotencia y peajes; navegador real con datos ficticios. Las pruebas SDK usan DOM simulado; el navegador usó servidor local con CSP. Sin validación de producción ni repetición del ensayo con CSV privado |
| F0(a): Zonas H1 | `467460e50ad5e11016f5097cd270025d471ae1b3` | Prioridad de `netProfit` válido, respaldo `profit`; cero y negativos conservados; totales y detalle coherentes | 13/13 pruebas sintéticas de lógica y HTML imprimible. DOM simulado; no verifica Google Maps, apariencia en navegador ni impresora física |
| Finanzas: clasificación y vencimientos | `4b9402f8e5008d69edcf5b3530a62e9cd8c46615` | Estados unificados, fecha local e ISO extendido válido sin desplazar su día de vencimiento | 29/29 pruebas específicas (17 originales + 12 ISO), calendario local y DST. DOM y escrituras simulados, sin Firebase real. Pagos parciales no implementados en este módulo |

**Límites de cierre:** F0(a), F1 y F2 están implementados y registrados localmente en el alcance anterior. F0(b), F3–F10 y las correcciones H2–H10 son **propuestas no iniciadas**. No inferir una nueva interfaz, instantáneas persistidas por carga, integración de cobros F1 en Finanzas, simulaciones, fuentes externas o Heat Map por capas a partir de estos commits.

**Activación F2 vigente:** solo `localhost` / `127.0.0.1`, proyecto `demo-smartload-f2`; `?f2shadow=1` activa sombra y `?f2emulator=1` mantiene Emulator con F2 OFF. La selección persiste en sessionStorage de la pestaña. No equivale al futuro interruptor `flags.razonamientoV3`. OFF no elimina la referencia ya persistida; impide la actividad nueva de F2. La CSP pertenece al servidor de laboratorio y no configura producción.

**Trazabilidad de pruebas:** se revisaron resultados existentes, sin reejecutarlos en esta revisión documental. La evidencia de navegador está en `scripts/f2-emulator/evidence/f2-browser.json` y su captura. Los informes 125/125, 2/2, 13/13 y 29/29 se conservan en artefactos externos de validación; no afirmar que sus pruebas temporales estén todas versionadas. SDK de integración: Firebase 12.19.0 externo; la app de navegador usa compat 9.22.0. Restricciones de red y datos ficticios limitan las conclusiones al laboratorio.

**Referencia histórica fuera del alcance:** la especificación del motor del 13/11 aún contiene la frase “el promedio histórico de RPM sigue elevando el umbral”. Esa frase quedó superada por D5 (`feb95f9`); el código y esta revisión reflejan el umbral actual. Ese cuarto documento no se modifica aquí.

**Privacidad y vigencia:** los originales íntegros se conservan en respaldo privado fuera del repositorio. Las cifras de los ejemplos públicos son sintéticas, no datos de Ricardo ni resultados de producción. Las fuentes y decisiones del 14/11 conservan su fecha; no se revalidaron licencias, disponibilidad ni condiciones externas el 15/11.

## Historial de revisiones

| Versión | Fecha | Cambios |
|---|---|---|
| v1 | 14-11-2026 | Borrador inicial |
| v2 | 14-11-2026 | Revisión cruzada con ChatGPT: perfil de partida neutral; confianza multifactorial; excepciones y propuestas; unidades homogéneas; la espera no se infiere de cualquier intervalo; un único costo de salida; fuentes de mercado como candidatas con tipos A/B/C |
| v3 | 14-11-2026 | (1) **Escenarios de salida sin selección automática**: el conductor indica su plan (`planSalidaConductor`) o "No sé"; elegir un plan no equivale a que sea posible (§7.2). (2) **Sin suposición de fines de semana**: solo cuenta la disponibilidad declarada; lo no clasificable queda como **desconocido** (§5, §6.2). (3) **Verificación del CPM en el código** del motor: qué gastos y qué millas incluye cada CPM y qué parte de esperas y reposicionamientos ya está dentro (§7.1). (4) **Costos incrementales**: separación de costo **efectivo adicional** y **costo de oportunidad**; costos variables por milla separados de los asociados al tiempo; los costos fijos **no** son costo efectivo de un día de espera (corrige una cifra diaria anterior; valor histórico conservado solo en el respaldo privado) (§7.3). (5) **Sin doble conteo entre cargas**: las millas que serán deadhead de una carga futura se cuentan en esa carga; el costo de salida nunca entra en la ganancia estimada ni en el piso (§7.5). (6) **Sin ingresos hipotéticos** de la próxima carga (se elimina `ajusteSalida`). (7) "No sé" ≠ riesgo cero: se muestra **riesgo posterior no cuantificado** (§7.4). (8) Ejemplos recalculados con distancias de varias fuentes y cifras provisionales (§10). (9) Pruebas nuevas: sin historial, historial incompleto, reposicionamiento ya incorporado, regreso vacío excepcional (§10.5). (10) Nuevas decisiones **D14** (clasificación de gastos) y **D15** (dónde entra el costo de salida) |
| v3 rev. 1 | 14-11-2026 | **Principio de Ricardo: el panel es una herramienta interna de referencia, no un cotizador; el conductor decide.** (1) Resultado principal = rentabilidad estimada de la carga con sus datos conocidos, con un **indicador** (Cubre objetivo / Cubre costos / No cubre costos) que no es una orden (§7.2). (2) **Advertencias y oportunidades comerciales separadas**, con evidencia y confianza, que nunca cambian el indicador; "un estado difícil no garantiza una salida difícil" (§7.3). (3) **Precios internos de referencia y comparador de tarifas** (§7.4). (4) **Se retiran** `planSalidaConductor`, la prima de salida y las alternativas por plan: ningún costo futuro entra en el mínimo rentable ni en la sugerencia de negociación. (5) Escenarios futuros **solo como simulaciones opcionales** con supuestos elegidos por el conductor (§7.5–§7.6). (6) Nuevas oportunidades verificables: **proximidad a la recogida (S12)** y **urgencia (S13)** (§7.3). (7) D4 (ACEPTAR_ESTRATEGICA) se retira como categoría; D15 reescrita; nueva **D16** (urgencia). (8) Ejemplos y pruebas reescritos (§10) |
| v3 rev. 2 | 14-11-2026 | Cuatro precisiones de la revisión cruzada: (1) toda ganancia se rotula **estimada** (con la fuente y el periodo del CPM), nunca beneficio realizado (§7.2); (2) el costo de oportunidad es una **hipótesis**, en línea propia, separada de los gastos simulados y fuera de cualquier cifra única por defecto (§7.5, §7.6.1); (3) poco deadhead es solo una **posible ventaja**, nunca "el único" ni "el más cercano" (§7.3); (4) **convención de RPM y extras** obligatoria en toda comparación: tarifa o total, millas totales o cargadas (§7.4.1). Ejemplos y pruebas ajustados (§10) |
| v3 rev. 3 | 14-11-2026 | Cierre propuesto: **matriz de decisiones** con estado (respaldada por un principio de Ricardo / pendiente), umbrales provisionales y consecuencias en el motor fase 1 (§14); §12 remite al plan incremental F0–F10 (documento aparte); referencias a la auditoría del Heat Map |
| v3 rev. 4 documental | 15-11-2026 | Actualización autorizada de cinco commits locales, pruebas y límites; D5/D14/H1; fórmula de Configuración; propuestas futuras explícitas. Cifras financieras personales sustituidas por escenarios sintéticos; originales íntegros en respaldo privado. Sin implementación nueva |

---

## 0. Propósito

El Panel de Decisiones es el **motor de razonamiento** de Smart Load Solution: no solo calcula si una carga es rentable, también interpreta el destino, el riesgo de quedarse esperando, el costo de reposicionarse y cómo negociar. La auditoría mostró que hoy:

- el veredicto es **puramente financiero**;
- la inteligencia comercial existe pero **no decide**: reglas de zonas sin uso, un veto absoluto en el servidor sin llamadas, ofertas de escape sin uso, y el aviso de zona trampa **roto** (`window.ZONAS_TRAP` no existe);
- hay **cinco listas de zonas trampa** que se contradicen y reglas de la operación personal de Ricardo escritas como universales;
- Lex tiene **su propio veredicto**, que se sobrescribe con el del panel.

Objetivo: un razonamiento **único, explicable y personal**, que use el motor financiero de la fase 1 como base, sume el contexto comercial con su nivel de confianza, deje el control final al conductor y sirva igual al panel y a Lex.

**Qué no es:** el panel **no es un cotizador** y no fija el precio que se envía al dispatcher. Es una herramienta **interna** de razonamiento y referencia: muestra si la carga cubre los costos, qué ganancia estimada deja y cuánto convendría intentar negociar. El conductor decide qué precio ofrece o acepta (§2).

## 1. Punto de partida

| Componente | Estado | Uso previsto, no implementación actual |
|---|---|---|
| Motor financiero (`financial-engine.js`): ganancia estimada, umbrales, contraoferta, CPM real/configuración, cobros | [IMPLEMENTADO LOCAL] F1 en `feb95f9`, conectado solo al modo sombra F2 en `573ce47`; resultados y límites en la revisión del 15/11 | Capa 1 (hechos) |
| Veredicto financiero del panel (`showDecisionPanel`) | Panel legacy existente; despliegue actual no verificado en esta revisión | Sustitución propuesta para F3, no iniciada |
| Avisos de viaje corto y ganancia diaria baja | [EXISTE] | Pasan a señales S2 y S3 |
| Historial por ruta (últimas 10 cargas) y por estado (`lexProfiles.stateStats`) | [EXISTE] | Base de la capa 2 |
| Notas de origen/destino del conductor | [EXISTE] | Señal S10 |
| Clima del destino (WeatherAPI) | [EXISTE] | Señal S9 |
| Aviso de zona trampa (`analizarTrapPenalty`) | [EXISTE] **roto** y con constantes de la operación de Ricardo | Se rehace como advertencia S4 con datos del conductor (§7.3) |
| Umbrales por zona, veto `Infinity`, `evaluateLoad`, `calcularOfertaEstrategica`, `HUBS_ESCAPE` | [EXISTE] sin uso | El conocimiento pasa al **perfil personal de Ricardo** [DECISIÓN D2]; el código se retira [DECISIÓN D11] |
| Página Zonas (verde/amarillo/rojo por estado) | [EXISTE], umbrales fijos $0.75/$0.90 | Se alimenta del mismo contexto de mercado, con umbrales relativos al costo del conductor |
| Lex: explicación, guiones, notas, aprendizaje de patrones | [EXISTE] | Se conserva; consume la evaluación estructurada (§9) |
| Lex: veredicto propio (`analyzeLoadWithLearning`), umbrales propios, `minRPM` fijo | [EXISTE] | Se retira (§9) |

**Limitaciones de datos existentes:**

- Las cargas guardan una sola fecha (`date`, la de la carga). **No hay fecha de entrega**, ni constancia de los días de descanso o de espera.
- Las cargas guardan `totalMiles` = millas cargadas + deadhead **que el conductor escribió en la calculadora** (`calculator.js`: `totalMiles = loadedMiles + deadheadMiles`). Las millas vacías que no se escriben en ninguna carga (regreso a base, desplazamientos entre cargas sin anotar) **no quedan registradas como millas**, aunque su combustible sí se registre como gasto.
- El CSV exportado de Finanzas solo trae millas totales por carga: con él no se puede separar el deadhead registrado.

Esto condiciona §6.2 y §7.1.

## 2. Principios

**Principio rector (Ricardo, 14-11-2026):** el Panel de Decisiones **no es un cotizador** ni determina el precio que se envía al dispatcher. Es una **herramienta interna de razonamiento y referencia** para el conductor: muestra si la carga cubre los costos, qué ganancia estimada deja y cuánto convendría intentar negociar. **El conductor decide** qué precio ofrece o acepta.

1. **Resultado principal: la rentabilidad estimada de la carga evaluada**, con los datos conocidos de esa carga. Nunca "Cubre objetivo" para una carga que no cubre sus costos o que no tiene ingresos.
2. **Lo futuro no se convierte en costo.** Al aceptar una carga, las millas de reposicionamiento, las esperas y los ingresos siguientes son **desconocidos**: pueden ser muchos, pocos o ninguno. No se suman automáticamente al costo, al mínimo rentable ni a ningún requisito de aceptación.
3. **Advertencias comerciales separadas** del resultado principal, cada una con su evidencia y su nivel de confianza. Informan; no cambian la rentabilidad ni el indicador.
4. **Un estado difícil no garantiza una salida difícil.** Una zona con pocas salidas en general puede dar una carga inmediata tras la entrega. El sistema describe lo que dicen los datos del conductor, nunca predice que "no habrá carga".
5. **La oportunidad también es local:** proximidad a la recogida, urgencia del cliente, otros vehículos disponibles y el momento concreto. Solo se usa lo que se puede **verificar** con datos.
6. **Escenarios futuros solo como simulación opcional**, con supuestos que el conductor elige explícitamente.
7. **Sin vetos por zona** [DECISIÓN D1].
8. **Los datos del conductor mandan; sin datos, neutralidad.** Ningún estado se califica para un conductor sin datos propios, salvo lo que él configure o una fuente objetiva rotulada.
9. **Sin evidencia no hay cifra.** Lo que no se puede cuantificar se dice; no se presenta como cero ni como riesgo seguro.
10. **Cada costo se cuenta una sola vez**, y los gastos efectivos nunca se mezclan con el costo de oportunidad, que es una **hipótesis** (en las simulaciones, §7.5).
11. **Toda ganancia es estimada** (CPM histórico o de Configuración), nunca beneficio realizado; **todo RPM lleva su base** (tarifa o con extras; millas totales o cargadas) (§7.2, §7.4.1).
12. **No se inventan ingresos futuros.**
13. **El conductor tiene la última palabra** sobre la decisión y la negociación; el sistema no cambia sus preferencias sin su confirmación.
14. **Una sola evaluación** para panel, Lex, historial y reportes; **funciones puras y probadas**, como el motor de la fase 1.

## 3. Fuentes de datos (investigación)

Investigación realizada el 14-11-2026. **Acceso técnico no equivale a permiso de uso:** que una API responda o que una página se pueda leer automáticamente no autoriza a reutilizar sus datos en un producto comercial. Cualquier fuente externa requiere revisar sus términos y, si es comercial, un acuerdo escrito. **No se hará scraping.**

### 3.1. Tres tipos de dato de tarifa que no se deben mezclar

| Tipo | Qué es | ¿Comparable con la tarifa del conductor? |
|---|---|---|
| **A. Tarifas de camión general** | Spot y contrato de dry van de 53', reefer, flatbed (p. ej. índices de DAT) | **No.** Otro equipo y otro mercado; como mucho, indicador de tendencia |
| **B. Cotizaciones al cliente** | Lo que un broker o plataforma cobra al cargador (incluye su margen) | **No directamente.** Es un techo, no un pago al transportista |
| **C. Pagos al cargo van / Sprinter** | Lo que recibe el transportista por la carga | **Sí.** Es el único comparable con la tarifa del conductor |

Toda referencia de mercado que use el sistema debe declarar su tipo. Solo el tipo C puede entrar en los precios de referencia (§7.4).

### 3.2. Fuentes

| Fuente | Tipo de dato | Disponibilidad | Licencia y uso | Estado en el diseño |
|---|---|---|---|---|
| **Datos del propio conductor** (cargas, gastos, notas, decisiones) | C (sus pagos reales) | Ya en Firestore | Propios | **Fuente principal** |
| **Google Maps** | Distancia, duración | [EXISTE] | De pago por uso | Mantener; fuente de las distancias de las simulaciones al implementar |
| **WeatherAPI** | Clima | [EXISTE] | Clave en el cliente (riesgo registrado) | Mantener; mover la clave al servidor |
| **EIA** — precios semanales de combustible | Combustible por región (PADD) | API abierta, clave gratuita, publicación los lunes | Datos públicos; los términos de la API permiten crear servicios que muestren y analicen sus datos, citando la fuente como "EIA", sin insinuar respaldo ni alterar los datos. Límites no publicados oficialmente [NO VERIFICADO] | **Propuesta** [DECISIÓN D7] |
| **FMCSA QCMobile** | Autoridad de brokers y transportistas | WebKey gratuita (Login.gov); la solicitud pregunta si el uso es comercial | **Términos para uso comercial no localizados** [NO VERIFICADO]; máximo 50 resultados por consulta | **Propuesta condicionada** a leer los términos al solicitar la clave [DECISIÓN D7] |
| **DAT** (RateView, DAT One) | A (camión general); DAT One incluye equipos Sprinter en el load board | API por contrato; endpoints y precios no publicados | Comercial; cobertura de **pagos** a Sprinter/cargo van **no confirmada** [NO VERIFICADO] | **Candidata** [DECISIÓN D8] |
| **Truckstop Rate Insights** | A (y estimaciones de tarifa pactada) | API con licencia (rate-insights-v3) | Comercial; cobertura de cargo van no confirmada [NO VERIFICADO] | **Candidata** [DECISIÓN D8] |
| **Warp** | Plataforma de carga que trabaja con cargo vans y box trucks; tipo de dato disponible por confirmar (B o C) [NO VERIFICADO] | Sin información verificada sobre API o datos | Comercial; condiciones por confirmar | **Candidata** [DECISIÓN D8] |
| **Sylectus** | Red líder en expedite | Sin API pública encontrada | Comercial | Referencia del segmento; no como fuente de datos por ahora |
| **Rangos de blogs y guías** | Mezcla de A, B y C sin declarar | Públicos | Cifras contradictorias y de vendedores | **No usar** para decidir |
| **Agregado anónimo de conductores de Smart Load** | C | Futuro | Propio; requiere consentimiento, anonimización y mínimos de muestra | **Futuro** [DECISIÓN D9] |
| **Freight Analysis Framework (BTS/FHWA)** | Flujos de carga entrantes y salientes por estado (toneladas), no tarifas | Datos públicos [NO VERIFICADO: cobertura, desagregación y actualidad] | Públicos [NO VERIFICADO] | **A investigar** como indicador **objetivo** de desequilibrio de salida por estado para el perfil neutral [DECISIÓN D13] |

**Conclusión:** no existe hoy un índice público y fiable de **pagos** a cargo van. El sistema funciona **sin datos de mercado comprados**, con los datos de cada conductor, fuentes públicas gratuitas cuyos términos se confirmen, y un perfil de partida **neutral**. Las fuentes comerciales quedan como candidatas hasta tener términos por escrito.

## 4. La evaluación estructurada [PROPUESTO]

Un único objeto, producido por funciones puras, que leen el panel, Lex y el historial. Es **interno**: nada de él se envía al dispatcher. Los importes de precios están en **dólares de tarifa** (sin extras) salvo que se indique.

```text
evaluacion = {
  version,
  rentabilidad:   resultado de evaluarCarga() (motor fase 1) con SOLO los datos conocidos
                  de esta carga; RESULTADO PRINCIPAL. Nunca incluye costos futuros
  indicador: {
    nivel: CUBRE_OBJETIVO | CUBRE_COSTOS | NO_CUBRE_COSTOS,   (= ACEPTAR | EVALUAR | RECHAZAR del motor)
    incumple: [ids],                                          (costos, objetivo, rpmMinimo, sinIngresos)
    texto: "Esta carga cubre tus costos y tu objetivo" …      (referencia, no una orden)
  },
  preciosReferencia: {                                        (§7.4, internos)
    tarifaEquilibrio, tarifaPorObjetivo, tarifaPorMinimo, tarifaMinimaRentable,
    referenciaPropia (tipo C, null sin muestra), sugerenciaNegociacion, desglose
  },
  comparador: [ { tarifa, origen: ofrecida|equilibrio|objetivo|referencia|sugerencia|conductor,
                  gananciaEstimada, margenEstimado, rpmTarifaTotales, rpmTotalTotales,
                  rpmTarifaCargadas, gananciaEstimadaPorDia } ],   (§7.4; RPM según §7.4.1)
  contexto: {
    ruta:     { origen, destino, millasCargadas, deadheadARecogida, millasTotales, horas, dias },
    mercado:  { origen: perfilEstado, destino: perfilEstado, ruta: perfilRuta },
    conductor:{ baseOperativa, regionesPreferidas, estadosEvitados, diasMaxFuera,
                disponibilidadDeclarada }
  },
  advertencias: [ { id, tipo: riesgo|oportunidad|informacion, severidad: baja|media|alta,
                    mensaje, evidencia: { datos, muestra, periodo },
                    fuente: conductor|configuracion|perfilPersonal|perfilNeutral|externa,
                    confianza: alta|media|baja, verificable: true|false } ],      (§7.3; solo informan)
  simulaciones: [ {                                            (§7.5; opcionales, las crea el conductor)
    supuestos: { destinoSiguiente, millasVacias, diasEspera, gastoViajeDiario,
                 incluirOportunidad, elegidosPor: "conductor" },
    costoEfectivoAdicional, costoBruto,                  (gastos simulados)
    costoOportunidadHipotesis,                           (hipótesis, siempre aparte; null si no se incluye)
    gananciaEstimadaTrasGastosSimulados,                 (ganancia estimada − costo efectivo adicional)
    gananciaEstimadaConHipotesisDeTiempo,                (además − hipótesis de oportunidad; null si no se incluye)
    baseHabitual: { fuenteCpm, medible, metodo },
    nota: "Simulación con tus supuestos; no cambia la rentabilidad de la carga"
  } ],
  explicacion: [ frases ordenadas por impacto, con cifra y fuente ],
  controlManual: { decisionConductor, tarifaAcordada, motivo, fecha } | null
}
```

Cambios frente a la primera v3: desaparecen `salidaDestino`, `planSalidaConductor`, `primaSalida` y `alternativasPorPlan`; los escenarios futuros pasan a `simulaciones`, que no afectan a `rentabilidad`, `indicador` ni `preciosReferencia`. Se añaden `preciosReferencia` y `comparador`.

## 5. Conductores nuevos y perfil de partida

**[IMPLEMENTADO EN EL MOTOR]** La decisión #8 exige configuración mínima para emitir ganancia, indicador y contraoferta. `evaluarCarga` devuelve `sinConfiguracion` si no se confirma; esto no certifica que la UI legacy ya oculte esas cifras. Su presentación coherente pertenece a fases futuras.

**[PROPUESTO]** Configuración inicial ampliada, opcional, en un paso adicional:

1. **Base operativa** (ciudad o estado).
2. **Regiones preferidas** y **estados que prefiere evitar**.
3. **Días máximos fuera de base**.
4. **Tipo de equipo**: cargo van o Sprinter (`VEHICLE_PROFILES`).
5. **Disponibilidad declarada**: días de la semana en que trabaja, y ausencias que quiera marcar (vacaciones, días personales). **Opcional.**

**Sin disponibilidad declarada, el sistema no supone nada** (rectificación de v2): ni que los fines de semana son descanso ni que son laborables. Los días sin clasificar quedan como **desconocidos** (§6.2) y no cuentan como espera.

**Perfil de partida NEUTRAL:**

- Sin datos propios, **ningún estado se califica** como de salida fuerte, débil o "trampa". El sistema dice "Sin datos tuyos de este estado".
- Lo único que puede aportar el perfil neutral son **datos objetivos y rotulados** (por ejemplo, el desequilibrio de carga entrante y saliente por estado si se valida el Freight Analysis Framework, §3.2, [DECISIÓN D13]), siempre con confianza **baja** y sin cambiar el indicador [DECISIÓN D3].
- Lo que el conductor configura (estados evitados, base, regiones, disponibilidad) sí cuenta desde el primer día, porque es su preferencia declarada.

**Perfil personal de Ricardo:** el conocimiento hoy escrito en el código (zonas Premium/Medio/Trampa, `HUBS_ESCAPE`, ciclo de regreso, textos de Lex) **no se aplica a otros conductores**. Se convierte, con revisión de Ricardo, en **su** perfil personal editado (§8.3) [DECISIÓN D2].

## 6. Personalización progresiva

### 6.1. Dimensiones propuestas para aprender de los datos — NO IMPLEMENTADAS

| Dimensión | Cómo se calcula |
|---|---|
| RPM de tarifa por estado destino | Cargas que **terminan** en el estado (tarifa sin extras / millas totales) |
| **RPM de salida** por estado | Cargas que **empiezan** en el estado |
| RPM por ruta | Cargas origen → destino |
| **Espera** tras entregar en un estado | Solo con evidencia (§6.2) |
| **Salidas observadas** desde un estado | Cargas que empezaron en el estado tras una entrega en él (evidencia de la advertencia S4; nunca una predicción) |
| Deadhead al salir de un estado | Deadhead registrado de las cargas que salen de él |
| **Base habitual** del conductor (§7.6.2) | Mediana de días fuera y de millas vacías no atribuidas a cargas, con su método y confianza |
| Comportamiento | Qué acepta o rechaza por estado, distancia y RPM (ya lo aprende Lex) |

Reglas comunes: tarifas sin extras y sobre millas totales; ventana de los últimos 12 meses con actividad (como el CPM real); se excluyen o ponderan a la baja las cargas antiguas contaminadas por la fórmula anterior (`formulaVersion` ausente y `rpm × millas ≠ totalCharge`). Para valores "habituales" se usa la **mediana**, no la media, para que un caso excepcional no la desplace (§10.5).

Con pocos datos propios, el valor se muestra con su muestra y confianza baja; no se completa con suposiciones.

### 6.2. Espera, descanso, reposicionamiento, desconocido y datos no registrados — PROPUESTA NO INICIADA

El intervalo entre dos cargas **no demuestra** que el conductor estuviera esperando trabajo. Con los datos actuales (una sola fecha por carga, sin fecha de entrega) cada intervalo se clasifica así:

| Clasificación | Cómo se detecta | ¿Cuenta como espera? |
|---|---|---|
| **Tránsito de la carga anterior** | Días estimados de la carga anterior (motor: `calcularDiasCarga`) | No: se descuentan del intervalo |
| **Reposicionamiento** | La carga siguiente sale de **otro estado**, o tiene deadhead mayor que un umbral (a definir) | No es espera: es costo de reposicionarse |
| **Descanso declarado** | Días que la disponibilidad declarada marca como no laborables, o ausencias marcadas | No |
| **Pausa / datos no registrados** | Intervalo restante mayor de 7 días [PROVISIONAL], o mes incompleto según el motor (§4.2 del motor) | No: se excluye; no se interpreta |
| **Desconocido** (nuevo en v3) | Días que no se pueden clasificar con fiabilidad: sin disponibilidad declarada, o días que el conductor no declaró ni como laborables ni como descanso | No: se excluye y se informa ("N días sin clasificar") |
| **Espera candidata** | Resto del intervalo, en **días declarados como disponibles**, con la carga siguiente saliendo del **mismo estado** de la entrega | Solo como candidata; confianza baja salvo confirmación |
| **Espera confirmada** | El conductor registra "esperé N días" en la carga (campo opcional) | Sí, con confianza alta |

Consecuencias:

- **Sin disponibilidad declarada no hay esperas candidatas**, solo confirmadas: el resto queda como desconocido. Es la consecuencia directa de no suponer fines de semana.
- **Sin evidencia no hay cifra:** si no hay al menos 3 esperas candidatas consistentes o alguna confirmada, la espera del estado es "sin datos": no hay advertencia de espera ni dato de ayuda en las simulaciones (no es cero ni es un riesgo seguro).
- **Propuesta de datos:** campos opcionales en la carga, **fecha de entrega** y **días de espera tras la entrega** [DECISIÓN D12]. Mejoran mucho la precisión, pero añaden trabajo; por eso son opcionales.
- Si el conductor no registra todas sus cargas, los intervalos parecerán esperas: los meses incompletos del motor y el umbral de 7 días lo limitan, y la confianza lo refleja.

**Ejemplo sintético de interpretación, sin datos personales:** 12 intervalos ficticios; mediana de 2 días y 2 intervalos mayores de 7 días; 7 enlaces salen del estado de la entrega anterior y 5 de otro. Sin fecha de entrega ni disponibilidad declarada, ninguno prueba espera. Es una ilustración de D6/D12, no un análisis real ni una función implementada.

## 7. Razonamiento comercial

### 7.1. Qué incluye realmente cada CPM (verificado en el código)

Verificado el 14-11-2026 en `public/js/core/financial-engine.js` (`calcularCpmReal`, `evaluarCarga`, `millasDeCarga`), `public/js/settings.js` (CPM de Configuración) y `public/js/calculator.js` (`totalMiles`).

**CPM real** (`calcularCpmReal`):

| Elemento | Qué incluye |
|---|---|
| **Numerador** | Todos los gastos registrados en Finanzas dentro del periodo (últimos 12 meses con actividad, §4.2 del motor), de categorías operativas. **Excluye** peajes (van por carga) y las categorías personalizadas marcadas como no operativas. Los gastos marcados como no recurrentes se reparten en 12 meses. El combustible se toma como $/mi de los últimos 3 meses activos si es coherente (`combustibleFuente = reciente`) |
| **Denominador** | Millas de las cargas guardadas en el periodo (`millasDeCarga`: `millas`/`totalMiles`, que en la calculadora es cargadas + deadhead **escrito**) |
| Fórmula | `cpm = resto / millasPeriodo + combustibleAplicado` |

Consecuencias para las simulaciones (§7.5) y la base habitual:

| Costo | ¿Ya está dentro del CPM real? |
|---|---|
| Combustible y mantenimiento de **millas vacías no registradas** (regreso a base, desplazamientos sin anotar) | **Sí, en promedio**: el gasto está en el numerador y las millas no están en el denominador. El CPM real ya reparte el reposicionamiento **habitual** del periodo entre las millas registradas |
| Millas vacías **registradas como deadhead** de una carga | No se reparten: están en el denominador y se cobran en la carga donde se escribieron |
| Seguro, pago del vehículo y demás fijos durante días sin carga | **Sí**: son mensuales y están en el numerador, sin importar los días parados |
| Comida y alojamiento durante esperas | Sí, **si se registraron** como gasto |
| Combustible de uso personal del vehículo | Sí, y **contamina** el numerador (riesgo general de calidad): sube el CPM y se confunde con reposicionamiento |
| Reposicionamientos o esperas **por encima de lo habitual** del periodo | **No**: el promedio solo cubre lo habitual |

**No se puede asumir que todo el reposicionamiento y la espera están incorporados:** solo lo **habitual del periodo**, solo si el conductor registró sus gastos, y mezclado con uso personal.

**CPM de Configuración** (`settings.js`, corrección `8c2d0a1`): solo los fijos mensuales se dividen por la meta de millas. Los ceros explícitos se conservan.

```text
cpmConfig = precioCombustible / MPG
          + mantenimientoPorMilla + llantasPorMilla + reparacionesPorMilla   (USD/milla)
          + (pagoVehiculo + seguro + licencias + otrosFijos) / metaMillasMes
```

| Costo | ¿Ya está dentro del CPM de Configuración? |
|---|---|
| Combustible de millas vacías no registradas | **No**: `precio / MPG` solo se aplica a las millas de la carga evaluada |
| Fijos durante días sin carga | **Sí, en la medida en que la meta de millas sea realista**: los fijos se reparten entre las millas que el conductor prevé rodar al mes, lo que ya supone cierto tiempo sin carga |
| Comida y alojamiento | **No**, salvo que el conductor los incluya en "otros fijos" |

Por tanto, **la base habitual depende de qué CPM se aplica** (`cpmFuente` del motor) y se guarda en cada simulación (`baseHabitual.fuenteCpm`). Con la referencia temporal del motor (§4.5 del motor) se trata como CPM real del periodo de referencia.

**Ejemplo sintético, no datos de un conductor:** combustible registrado de $0.20/mi frente a $0.16/mi configurado (relación 1.25). La diferencia podría reflejar precios, millas no registradas o categorización incorrecta. No identifica por sí sola la causa ni permite calcular un porcentaje real de reposicionamiento.

### 7.2. Resultado principal propuesto para F3 — NO INICIADO

El motor puro ya calcula la evaluación. El texto y la presentación descritos aquí son objetivo de la UI nueva; F2 no sustituyó la presentación legacy.

- Lo calcula el motor de la fase 1 (`evaluarCarga`) con **solo los datos conocidos** de la carga: tarifa, extras confirmados, millas cargadas, deadhead **hasta la recogida** (conocido al evaluar), peajes escritos y días de la carga.
- Muestra: **ganancia estimada**, margen estimado, RPM (etiquetados según §7.4.1), ganancia estimada por día, y el **indicador**.
- **Ganancia estimada, nunca beneficio realizado.** Se calcula con un CPM (real histórico o de Configuración), no con los gastos reales de esta carga. Siempre se rotula "Ganancia estimada con tu CPM de $X/mi (fuente, periodo)". El beneficio realizado solo existe en Finanzas, con gastos registrados y cobros (motor fase 1, §3.4 del motor), y nunca se mezcla con esta cifra.

Indicador:

| Indicador | Condición (motor fase 1, sin RPM histórico [D5]) | Texto orientativo |
|---|---|---|
| **Cubre objetivo** (`ACEPTAR`) | Cubre costos, objetivo (margen o sueldo) y RPM mínimo | "Cubre tus costos y tu objetivo" |
| **Cubre costos** (`EVALUAR`) | Cubre costos pero no el objetivo o el RPM mínimo | "Cubre tus costos, no tu objetivo: valora negociar" |
| **No cubre costos** (`RECHAZAR`) | No cubre costos o no tiene ingresos | "Con esta tarifa pierdes dinero" |

- El indicador es una **referencia**, no una orden: el conductor puede aceptar o rechazar cualquier carga (§8.3).
- **Nunca incluye** reposicionamientos futuros, esperas futuras ni ingresos de la carga siguiente.
- La ganancia por día baja (S2) y la carga corta (S3) son datos de esta carga: se muestran junto al resultado, como información, sin cambiar el indicador.

### 7.3. Advertencias y oportunidades comerciales propuestas — NO INICIADAS

Se muestran **en un bloque aparte**, debajo del resultado principal, con evidencia, confianza y fuente. **Ninguna cambia la rentabilidad, el indicador ni los precios de referencia.**

| Id | Advertencia u oportunidad | Evidencia necesaria | Cómo se formula |
|---|---|---|---|
| S4 | Salidas desde el estado destino en tus datos | Entregas propias en el estado y qué pasó después (§6.1, §6.2) | "En tus datos: 6 entregas en FL; en 4 la siguiente carga salió de FL (mediana 1 día). No garantiza lo que pase esta vez." Sin datos: "Sin datos tuyos de salida desde FL" |
| S6 | Días fuera de base | Días de la carga frente a `diasMaxFuera` | Información |
| S7 | Por debajo de tu referencia en ruta o estado | RPM de tarifa sin extras sobre millas totales, frente a tu referencia calculada igual (tipo C) | "Tus cargas en esta ruta: mediana $X/mi (tarifa sin extras, millas totales)" |
| S8 | Riesgo del broker | Autoridad FMCSA inactiva o revocada (fuente oficial) | **Alerta alta**, destacada; no altera la rentabilidad |
| S9 | Clima adverso | Alertas en destino o ruta | Información; alerta destacada si es severa |
| S10 | Nota de advertencia del conductor | Su propia nota | Se muestra arriba del bloque |
| S11 | Oportunidad de reposicionarse | Destino en la base o en una región preferida | "Esta carga te deja en tu región preferida" |
| **S12** (nueva) | **Proximidad a la recogida** (posible ventaja) | Deadhead a la recogida que el conductor escribe, frente a su mediana | "Recogida a 15 mi, más cerca que tu deadhead habitual (80 mi): **posible ventaja** al negociar. No indica que seas el único ni el más cercano." |
| **S13** (nueva) | **Urgencia de la carga** | Solo si el conductor la marca o consta en los datos de la carga (p. ej. "hot", "expedite urgente") [DECISIÓN D16] | "Carga urgente: suele haber margen para negociar" (sin cifra salvo datos propios) |

Reglas:

- **Nunca** se califica un estado de "trampa" ni se afirma que no habrá carga. Las advertencias describen datos pasados del conductor y llevan la coletilla "no garantiza lo que pase esta vez" cuando hablan de salidas.
- **Solo datos verificables.** La disponibilidad de otros vehículos o la urgencia real del cliente no se suponen: sin un dato concreto, no hay advertencia.
- **Poco deadhead no significa exclusividad.** S12 solo compara con el propio historial del conductor; el sistema no sabe dónde están otros vehículos y nunca dice ni sugiere que el conductor sea el único o el más cercano.
- **Sin datos no hay advertencia de riesgo**, solo "sin datos tuyos". La falta de datos no se presenta como riesgo ni como garantía.
- Máximo 3 visibles, ordenadas por severidad y confianza; el resto en "Ver más".

### 7.4. Precios internos de referencia y comparador de tarifas

**Implementado:** fórmulas y `preciosReferencia` en F1. **Pendiente:** tabla/comparador visible, cálculo de mediana desde historial y conexión de `rpmReferenciaTarifa` a la app. La negociación configurable y su presentación no se deducen del modo sombra actual.

**Precios de referencia** (dólares de tarifa, sin extras, sobre millas totales; rotulados "Referencia interna, no se envía al dispatcher"):

```text
extrasConf             = extras confirmados de la carga
tarifaEquilibrio       = máximo(0, umbralCostos × millasTotales − extrasConf)       ("no bajes de aquí")
tarifaPorObjetivo      = objetivo × millasTotales − extrasConf                       ("cubre tu objetivo")
tarifaPorMinimo        = rpmMinimo × millasTotales                                   (los extras no la reducen)
tarifaMinimaRentable   = máximo(tarifaPorObjetivo, tarifaPorMinimo, 0)
referenciaPropia       = rpmReferenciaTarifa × millasTotales     (solo datos tipo C, §3.1;
                         mediana de tus cargas en la ruta o estado; null sin muestra suficiente)
sugerenciaNegociacion  = máximo(tarifaMinimaRentable, referenciaPropia ?? 0) × (1 + margenNegociacion)
                         (8 % por defecto, decisión #10; "cuánto convendría intentar pedir")
```

- `objetivo` = `umbralCostos / (1 − margenObjetivo)` o el objetivo por sueldo, como en el motor (§7.1 del motor), sin el RPM histórico [D5].
- **Ningún costo futuro** (reposicionamiento, espera) entra en estas cifras.
- Cada cifra lleva su explicación ("cubre costos + 30 % de margen", "tu mediana en esta ruta, 5 cargas").

#### 7.4.1. Convención de RPM y extras (obligatoria en toda comparación)

| RPM | Fórmula | Uso | Etiqueta en pantalla |
|---|---|---|---|
| **RPM de tarifa / millas totales** | tarifa sin extras ÷ (cargadas + deadhead) | Base de **todas** las comparaciones: RPM mínimo, referencia propia, S7, precios de referencia (decisión F del motor) | "$/mi tarifa sin extras · millas totales" |
| **RPM total / millas totales** | (tarifa + extras confirmados) ÷ (cargadas + deadhead) | Lo que el motor compara con el umbral de costos y el objetivo (`rpmTotal`) | "$/mi con extras confirmados · millas totales" |
| **RPM de tarifa / millas cargadas** | tarifa sin extras ÷ millas cargadas | **Solo informativo**: es como suelen cotizar los brokers; nunca se compara con los umbrales | "$/mi tarifa · solo millas cargadas (como cotiza el broker)" |

Reglas:

- **Ninguna comparación mezcla bases**: cada par de cifras comparadas usa la misma fórmula, y la etiqueta lo dice.
- **Extras:** solo los confirmados reducen la tarifa necesaria para cubrir costos u objetivo; los no confirmados aparecen como "posible adicional" y no entran en nada. El RPM mínimo se aplica a la tarifa sin extras, así que los extras no lo reducen.
- **Peajes** escritos para la carga suben el umbral de costos (motor §5); se muestran en el desglose.
- Las millas totales de cada cifra se muestran junto a ella ("sobre 1,355 mi totales: 1,355 cargadas + 0 deadhead").

**Comparador de tarifas:** tabla con la ganancia estimada, el margen estimado, los RPM de §7.4.1 (cada uno con su etiqueta) y la ganancia estimada por día para:

- la tarifa ofrecida;
- equilibrio, mínimo rentable, referencia propia y sugerencia de negociación;
- cualquier tarifa que el conductor escriba (p. ej. la contraoferta que piensa hacer, o lo que el dispatcher responde).

El comparador usa la misma función del motor (`evaluarCarga`) con distinta tarifa: mismo resultado que si se evaluara esa tarifa directamente.

### 7.5. Simulaciones de salida propuestas — NO INICIADAS

Sustituye los escenarios de salida y la prima de la primera v3. Se abren **solo si el conductor lo pide** ("Simular qué pasa después de entregar").

**El conductor elige explícitamente cada supuesto:**

| Supuesto | Quién lo fija | Ayuda que da el sistema (sin rellenarlo por él) |
|---|---|---|
| Qué hará después (volver a la base, ir a otro punto, esperar carga allí) | Conductor | — |
| Millas vacías | Conductor | Distancia de ruta al punto elegido (Google Maps al implementar), que puede aceptar o cambiar |
| Días de espera o fuera | Conductor | Su historial con evidencia y confianza, como dato al lado del campo ("tu mediana en FL: 1 día, 4 casos") |
| Gasto de viaje por día | Conductor | Su gasto medio por día según D14 |
| Mostrar la hipótesis de costo de oportunidad (sí/no) | Conductor | Su `valorDiaProductivo` (§7.6.1) |

**Resultado de la simulación** (todo rotulado "Simulación con tus supuestos"):

```text
Gastos simulados (dinero que saldría del bolsillo):
  costoEfectivoAdicional =
      max(0, millasVacias − millasVaciasHabituales) × costoVariablePorMilla
    + max(0, diasFuera − diasFueraHabituales) × gastoViajeDiario
  gananciaEstimadaTrasGastosSimulados = gananciaEstimada (de esta carga) − costoEfectivoAdicional

Hipótesis de costo de oportunidad (aparte; solo si el conductor la pide):
  costoOportunidadHipotesis = max(0, diasFuera − diasFueraHabituales) × valorDiaProductivo
  gananciaEstimadaConHipotesisDeTiempo = gananciaEstimadaTrasGastosSimulados − costoOportunidadHipotesis
```

- **El costo de oportunidad es una hipótesis, no un gasto.** No es dinero que salga del bolsillo: supone que ese día podría haber producido, lo que no se sabe. Se muestra en una línea propia rotulada "Hipótesis: valor de los días que no producen", nunca sumado a los gastos ni dentro de una cifra única por defecto.

- **No modifica** la rentabilidad, el indicador, los precios de referencia ni el comparador. Puede guardarse con la carga como nota de simulación, nunca como costo.
- Se pueden comparar varias simulaciones lado a lado ("si vuelvo a Chicago" / "si espero 2 días en FL").
- La "base habitual" evita contar dos veces lo que ya está en el CPM (§7.1, §7.6.2). Si no es medible, se muestra el costo **bruto** con la nota "parte de este costo ya está en tu CPM real".
- **Sin ingresos supuestos:** la simulación no incluye ingresos de una carga siguiente.

### 7.6. Reglas de cálculo de las simulaciones

#### 7.6.1. Definiciones [PROVISIONAL, D14]

- **`costoVariablePorMilla`**: categorías que dependen de las millas (combustible, mantenimiento, llantas, reparaciones ordinarias). Con CPM real, sus $/mi del periodo; con CPM de Configuración, `precio / MPG` + mantenimiento, llantas y reparaciones por milla.
- **`gastoViajeDiario`**: categorías que dependen de los días fuera de casa (alojamiento, y la parte incremental de la comida).
- **`valorDiaProductivo`** (solo para la hipótesis): `(fijos mensuales / días disponibles al mes) + sueldoPorDia`; sin sueldo configurado, solo la parte de fijos.
- **Los costos fijos no son costo efectivo de un día de espera**: el seguro y el pago del vehículo se pagan igual. Lo que se "pierde" es la cobertura de un día que no produce, y solo si ese día hubiera producido: es la **hipótesis** de costo de oportunidad.

#### 7.6.2. Base habitual y doble conteo

| Caso | Tratamiento |
|---|---|
| CPM real y base habitual medible (deadhead registrado, campos D12) | Se resta la mediana habitual (millas y días) |
| CPM real y base habitual no medible (caso sintético sin medición) | No se puede calcular el exceso: se muestra el costo **bruto**, rotulado |
| CPM de Configuración | Millas vacías habituales = 0; días habituales según la meta de millas solo si hay disponibilidad declarada |
| Millas hasta la recogida de una carga siguiente | Pertenecen a esa carga (su deadhead); si el conductor simula "esperar carga allí", esas millas no se suman |
| Ingreso de la carga siguiente | Nunca |

#### 7.6.3. Política del panel

1. **Indicador = rentabilidad de la fase 1** (sin RPM histórico [D5]). Nada comercial lo cambia automáticamente.
2. **Advertencias y oportunidades** (§7.3) solo informan, con evidencia y confianza [D3].
3. **Simulaciones** (§7.5) solo informan y solo con supuestos del conductor [D15].
4. **Sin vetos por zona** [D1].
5. **Decisión y negociación del conductor** (§8.3): el panel no envía nada ni fija el precio.

## 8. Confianza, explicaciones y control manual — PROPUESTOS, NO INICIADOS

### 8.1. Confianza multifactorial

Cada dato propio (perfil de estado o ruta, espera, salidas observadas, base habitual) recibe una confianza a partir de cinco factores:

| Factor | Qué mide | Ejemplo de efecto |
|---|---|---|
| **Muestra** | Número de casos | 1–2 casos limitan a baja |
| **Antigüedad** | Meses desde el dato más reciente y peso de los recientes | Todo de hace más de 6 meses limita a baja |
| **Consistencia** | Dispersión (coeficiente de variación) | Valores muy dispersos (> 40 %) bajan un nivel |
| **Calidad** | Proporción de registros fiables: fórmula actual, sin contaminación de tolls/otros, meses completos, esperas confirmadas, días clasificados (no desconocidos) | < 60 % fiables bajan un nivel |
| **Representatividad** | Variedad de rutas, meses y temporadas | Todo de una sola ruta o un solo mes baja un nivel |

```text
nivel inicial por muestra:  1–2 → baja · 3–7 → media · ≥ 8 → alta
cada factor desfavorable baja un nivel (mínimo: baja)
factorLimitante = el factor que más bajó la confianza (se muestra al conductor)
```

- Datos oficiales (EIA, FMCSA) tienen confianza alta en lo que miden.
- Cada advertencia muestra su confianza con su factor limitante ("confianza media — 4 cargas tuyas desde FL, la más reciente de hace 5 meses").
- **Todos los umbrales de esta sección son provisionales** hasta validarlos con datos (§14.2).

### 8.2. Explicaciones

- Máximo **3 motivos** visibles, ordenados por impacto, cada uno con cifra y fuente. El resto en "Ver más".
- Lo que no tiene datos se dice: "Sin datos tuyos de salida desde AZ".
- Las advertencias sobre salidas llevan "no garantiza lo que pase esta vez".
- Gastos simulados e hipótesis de oportunidad siempre con su nombre y en líneas separadas.
- Toda ganancia con la palabra "estimada"; todo RPM con su base (§7.4.1).
- Mismo texto en panel y Lex.

### 8.3. Control manual y aprendizaje de excepciones

- **Decidir en contra** ("Acepto igualmente" / "Rechazo igualmente", motivo opcional): se registra como **excepción**. **No cambia** preferencias, perfiles ni la confianza de ninguna señal.
- **Patrón persistente** → **propuesta**, nunca cambio automático. Criterio [PROVISIONAL]: al menos 4 excepciones del mismo tipo en el mismo estado o ruta, repartidas en al menos 2 meses distintos, con resultado conocido (carga completada y cobrada). Solo cambia si el conductor confirma; si rechaza, no se vuelve a proponer en 3 meses.
- **Cómo salió del destino:** la app puede preguntar después de la entrega (opcional) "¿Cómo saliste de FL?". La respuesta alimenta la evidencia de S4 y la base habitual; no cambia nada por sí sola.
- **Tarifa acordada:** el conductor puede registrar la tarifa que negoció (opcional), para comparar con los precios de referencia en reportes.
- **Editar el perfil de mercado** de un estado (manual, explícito): prioridad sobre el perfil neutral, rotulado "Tu ajuste".
- **Silenciar una señal** por estado o ruta.
- Todo es reversible y visible en Configuración [DECISIÓN D10].

## 9. Integración de Lex AI [PROPUESTO]

- Lex **recibe la evaluación estructurada** y la explica. No calcula CPM, umbrales ni veredictos propios.
- Se retiran: el veredicto de `analyzeLoadWithLearning`, el parche que lo sobrescribe, los umbrales de `lex-ai-engine.js` y el `minRPM` fijo de `response-builders.js`.
- Se conservan: explicación, guiones de negociación (con `preciosReferencia` y el comparador, presentados como referencia interna), notas, aprendizaje de patrones, educación sobre mercados (rotulada como general y **sin calificar estados** para conductores sin datos).
- **"¿Y si…?"**: Lex vuelve a llamar a las mismas funciones con entradas modificadas ("¿y si me pagan $X?" = comparador; "¿y si vuelvo a casa?" = simulación con los supuestos que el conductor dé).
- Las listas de "estados trampa" de `response-builders.js` y `zones-agent.js` se retiran junto con las demás (§11).

## 10. Casos de validación

### 10.1. Parámetros sintéticos de los ejemplos (todos [PROVISIONAL])

**Datos completamente sintéticos:** conductor ficticio, periodo 2026-01 a 2026-03, 6,000 millas (2,000 por mes), 60 días disponibles (20 por mes) y 12 días fuera de base (4 por mes). No representan a Ricardo ni a usuarios reales. Se conserva el método de los ejemplos originales; sus cifras personales quedan solo en el respaldo privado.

| Parámetro | Valor sintético | Origen y advertencias |
|---|---|---|
| CPM real | $0.60/mi | Suma de categorías de §14.1 sin peajes: $0.20 de combustible y $0.40 del resto |
| `costoVariablePorMilla` | $0.25/mi | Combustible $0.20 + mantenimiento $0.03 + llantas $0.01 + reparaciones $0.01 |
| `gastoViajeDiario` | $20/día | Comida y alojamiento sintéticos: $80/mes entre 4 días fuera; hipótesis ilustrativa, no regla de la app |
| Fijos mensuales | $500/mes | Seguro $240 + vehículo $200 + permisos $20 + teléfono $40; coinciden con los ratios sintéticos de §14.1 y 2,000 mi/mes |
| `valorDiaProductivo` | $150/día | Hipótesis voluntaria: $500/20 + sueldo ficticio $2,500/20. No es gasto efectivo ni umbral automático |
| Objetivo financiero de los ejemplos | Margen 30 %, sin objetivo de sueldo | El sueldo ficticio anterior solo ilustra la hipótesis de oportunidad; no se pasa al motor en estos ejemplos |
| Días de conducción | millas ÷ 600 | Aproximación ilustrativa; el motor dispone de `calcularDiasCarga` |
| Base habitual con CPM real | No medible en el ejemplo | No se inventan millas ni días habituales; una futura simulación mostraría el costo bruto rotulado |

El CPM configurado sintético sería $0.20 + $0.05 + $500/2,000 = $0.50/mi; es distinto del real $0.60/mi. Las referencias de los ejemplos usan explícitamente el CPM real. Ninguna de estas cifras constituye un resultado de prueba ni un parámetro aprobado para usuarios.

**Distancias por carretera** (fuentes secundarias consultadas el 14-11-2026; la cifra final saldrá de la ruta real de Google Maps al implementar):

| Tramo | Rango | Valor usado |
|---|---|---|
| Detroit → Miami | 1,339–1,371 mi (Rome2Rio, Air Miles Calculator, DistanceFrom, 1map) | 1,355 mi |
| Miami → Chicago | 1,341–1,386 mi (Rome2Rio, DistanceFrom, 1map) | 1,360 mi |
| Chicago ↔ Phoenix | 1,695–1,755 mi (Rome2Rio, DistanceFrom, 1map) | 1,720 mi |

*v2 usaba 1,380 mi para Detroit → Miami y Miami → Chicago y 1,750 mi para Chicago ↔ Phoenix: dentro o cerca del rango, pero sin fuente.*

### 10.2. Detroit, MI → Miami, FL (~1,355 mi), base ficticia en Chicago

**Escenario sintético de diseño, no prueba ejecutada ni pantalla nueva disponible.** La investigación histórica del aviso roto y del veto sin uso se conserva en §1; F0(b) sigue pendiente.

- Supuestos: 1,355 mi cargadas + 0 deadhead; sin extras ni peajes; tarifa $2,168; CPM real sintético $0.60/mi, periodo 2026-01 a 2026-03; margen objetivo 30 %, sin sueldo en la evaluación.
- Costo estimado: 1,355 × $0.60 = $813. **Ganancia estimada: $1,355**, cubre objetivo.
- Referencias internas: equilibrio $813; mínimo rentable $813/0.70 ≈ $1,161.43; sugerencia con 8 % ≈ $1,254.34, sin referencia propia mayor. El RPM mínimo no es vinculante en este escenario.
- Advertencias propuestas: S4 describiría solo datos propios y S12 una posible ventaja de proximidad; no están implementadas por F2.
- Futura simulación voluntaria “Vuelvo vacío a la base”: 1,360 mi y 2.3 días elegidos. Gastos brutos = 1,360 × $0.25 + 2.3 × $20 = **$386**; ganancia estimada tras gastos simulados = **$969**. Sin base habitual medible, rotular “bruto: parte ya está en tu CPM real”.
- Hipótesis de oportunidad aparte: 2.3 × $150 = **$345**; cifra bajo esa hipótesis = **$624**. No se suma al costo de la carga ni se presenta por defecto como gasto.
- Futura simulación “Espero 1 día”: $20 de gasto supuesto y, aparte, $150 de oportunidad hipotética. Las millas hasta una recogida futura pertenecen a esa carga futura.

### 10.3. Chicago, IL → Phoenix, AZ (~1,720 mi), base ficticia en Chicago

**Escenario completamente sintético; simulaciones y señales propuestas no iniciadas.**

- Supuestos: 1,720 mi totales; sin deadhead, extras ni peajes; tarifa $2,236; mismo CPM real sintético $0.60/mi y margen 30 %, sin objetivo de sueldo.
- Costo estimado: **$1,032**; ganancia estimada: **$1,204**, cubre objetivo. Mínimo rentable ≈ $1,474.29; sugerencia al 8 % ≈ $1,592.23.
- Sin datos propios de AZ, la futura señal diría “Sin datos tuyos”; no se infiere una salida difícil. Esto no certifica que la UI actual ya implemente esa regla.
- Futura simulación de regreso: 1,720 mi y 2.9 días; gasto bruto = $430 + $58 = **$488**; ganancia tras gasto simulado = **$716**. Hipótesis de oportunidad separada: $435; cifra bajo esa hipótesis = **$281**. La ganancia principal sigue siendo $1,204.
- Variante sintética con 100 mi de deadhead: $2,236/1,820 ≈ $1.229/mi sobre millas totales y $1.30/mi sobre cargadas. No mezclar esas bases.

### 10.4. Conductor nuevo — COMPORTAMIENTO OBJETIVO DE LA UI

Las reglas siguientes son propuestas de presentación; el control `sinConfiguracion` del motor no certifica su aplicación en el panel legacy.

- **Sin configuración mínima:** tarifa, millas cargadas, deadhead y RPM; ni ganancia, ni indicador, ni precios de referencia (decisión #8). Clima y notas sí.
- **Con configuración mínima, sin historial:** rentabilidad con su CPM de Configuración; precios de referencia sin referencia propia; ningún estado calificado; simulaciones disponibles con sus propios supuestos (millas habituales = 0).
- **Tras varias cargas:** referencia propia, advertencias S4/S7/S12 con su confianza multifactorial.

### 10.5. Casos de prueba propuestos — NO DECLARADOS APROBADOS

Los casos de esta tabla son criterios futuros salvo evidencia individual explícita. No confundirlos con los resultados revisados de la tabla del 15/11.

| Caso | Qué se comprueba |
|---|---|
| **Unidades sintéticas (§7.4):** 600 mi, extras $20, RPM mínimo $0.85, CPM $0.60, margen 30 % | Objetivo = $0.60/0.70 ≈ $0.85714/mi; tarifa por objetivo ≈ $494.29; tarifa por mínimo = $510; mínimo rentable $510; sugerencia al 8 % = $550.80 sin referencia propia. Caso propuesto, no resultado de prueba registrado |
| **Lo futuro no entra en el resultado** | Rentabilidad, indicador y precios de referencia idénticos con y sin simulaciones, y con y sin advertencias |
| **Comparador** | Para cada tarifa, la ganancia coincide con `evaluarCarga` evaluada con esa tarifa |
| **Tarifa escrita por el conductor** | Se añade al comparador; no cambia los precios de referencia |
| **Simulación sin supuestos elegidos** | No se calcula; el sistema no rellena días ni destino por el conductor |
| **Simulación sin pedir la hipótesis de oportunidad** | `costoOportunidadHipotesis = null` y `gananciaEstimadaConHipotesisDeTiempo = null`; solo gastos simulados |
| **Simulación con la hipótesis pedida** | La hipótesis aparece en línea propia rotulada "Hipótesis"; `gananciaEstimadaTrasGastosSimulados` no la incluye |
| **Rótulo de ganancia** | Toda cifra de ganancia del panel, comparador y simulaciones lleva "estimada" y la fuente y periodo del CPM; nunca se presenta como beneficio realizado |
| **Etiquetas de RPM** | Con deadhead > 0, RPM sobre millas totales y sobre cargadas difieren y cada uno lleva su etiqueta; los umbrales solo se comparan con RPM sobre millas totales |
| **Extras no confirmados** | No cambian ganancia estimada, indicador, precios de referencia ni RPM; aparecen como "posible adicional" |
| **Poco deadhead** (S12) | El mensaje dice "posible ventaja" y nunca "eres el único" o "el más cercano" |
| **Sin historial** (CPM de Configuración) | Simulación con millas habituales = 0; gastos simulados completos |
| **Historial incompleto** (CPM real no confiable; referencia temporal o Configuración) | La base habitual se toma de la fuente de CPM aplicada, nunca del CPM real no confiable |
| **Reposicionamiento ya incorporado** (CPM real confiable; base habitual medida con D12; regreso de la distancia habitual) | Exceso 0 → efectivo adicional 0, con la nota "ya incluido en tu CPM real" |
| **Regreso vacío excepcional** (un regreso de 1,500 mi entre regresos de ~300 mi) | La mediana habitual no cambia; el caso se marca como atípico |
| **Base habitual no medible con CPM real** | Simulación con `costoBruto` rotulado |
| **Fijos como hipótesis** | Un día de espera simulado no aumenta los gastos simulados por seguro ni pago del vehículo; solo la hipótesis de oportunidad, si se pide |
| **Sin ingresos futuros** | Ninguna simulación suma ingresos de una carga siguiente |
| **Estado con pocas salidas en tus datos, pero esta vez hay carga inmediata** | La advertencia S4 lleva "no garantiza lo que pase esta vez"; el resultado principal no cambia |
| **Sin datos del estado destino** | "Sin datos tuyos"; ninguna advertencia de riesgo |
| **Recogida a 15 mi con deadhead habitual de 80 mi** | S12 "posible ventaja", confianza según muestra |
| **Urgencia no marcada** | Sin S13; el sistema no la supone |
| **Broker con autoridad revocada** | S8 alerta alta destacada; rentabilidad e indicador sin cambios |
| **Intervalo con sábado y domingo, sin disponibilidad declarada** | Días desconocidos: ni descanso ni espera |
| **Mismo intervalo, conductor declaró que no trabaja fines de semana** | Descanso declarado |
| **Intervalo de 5 días con siguiente carga desde otro estado** | Reposicionamiento, no espera |
| **Intervalo de 12 días** | Pausa / no registrado: se excluye |
| **Conductor registra "esperé 2 días" en 3 cargas en FL** | Espera confirmada, confianza alta (dato de ayuda en simulaciones y en S4) |
| **Conductor con base en Texas, sin datos de TX** | Ninguna regla califica TX ni asume el Midwest |
| **5 excepciones en FL en 1 solo mes / en 3 meses cobradas** | Nada / propuesta que el conductor confirma |
| **Confianza:** 8 cargas desde GA de hace 9 meses; 10 desde OH muy dispersas | Baja por antigüedad / baja un nivel por consistencia |
| Miami → Atlanta, $0.80/mi (caso real) | **Cubre costos**, no el objetivo; S2 como información; sugerencia de negociación en dólares |
| Phoenix → Dallas a $0.95/mi, base en Dallas | Cubre costos, no el objetivo; S11 "te deja en tu base" como oportunidad (no cambia el indicador) |
| Lex: "¿y si me pagan $X?" / "¿y si vuelvo a casa?" | Comparador y simulación con las mismas funciones; mismo resultado que el panel |

## 11. Arquitectura [PROPUESTO]

```text
public/js/core/
  financial-engine.js      [EXISTE] capa 1: hechos financieros, CPM, cobros
                                    (+ desglose por clase de gasto según D14, sin cambiar el CPM)
  market-context.js        [PROPUESTO] capa 2: perfiles de estado y ruta, clasificación de intervalos (§6.2),
                                         base habitual (§7.6.2), confianza multifactorial (§8.1)
  load-signals.js          [PROPUESTO] capa 3: advertencias y oportunidades S1–S13 (§7.3)
  load-reasoning.js        [PROPUESTO] capas 4–5: indicador (§7.2), precios de referencia y comparador (§7.4),
                                         simulaciones (§7.5–§7.6), explicación

Firestore (por conductor)
  users/{uid}.preferenciasMercado     base, regiones, estados evitados, días fuera,
                                      disponibilidad declarada
  users/{uid}.clasificacionGastos     clase de cada categoría (D14)
  users/{uid}.perfilMercadoEditado    ajustes manuales y propuestas aceptadas (con fecha)
  users/{uid}.excepciones             decisiones contrarias (para detectar patrones)
  users/{uid}.cpmPreference / ultimoCpmRealConfiable   (motor fase 1)
  cargas: campos opcionales fechaEntrega, diasEspera, salidaReal [D12], urgente [D16], tarifaAcordada [D10]
  cargas: simulaciones guardadas como nota (nunca como costo)
  evaluación guardada con la carga (snapshot)

Servidor (claves fuera del cliente; solo tras confirmar términos)
  fuelPrices (programada, semanal)    EIA → caché por región     [D7]
  brokerCheck (callable)              FMCSA QCMobile              [D7]
```

- **Arquitectura objetivo:** las capas 1–5 serían funciones puras con pruebas. Solo la capa financiera y el puente F2 tienen el alcance implementado de la revisión del 15/11; los módulos nuevos de razonamiento no existen todavía. Los datos externos entran ya cacheados como parámetro; el razonamiento nunca llama a la red.

## 12. Plan de implementación gradual

El plan detallado está en `2026-11-14-plan-implementacion-razonamiento.md` (fases F0–F10, pruebas, criterio de salida y reversión de cada una). Resumen:

| Fase | Contenido | Cambia lo que ve el conductor |
|---|---|---|
| F0(a) | Zonas H1 corregido y probado, commit `467460e` | Corrección completada localmente |
| F0(b) | Aviso de zona trampa roto | Propuesta pendiente, no iniciada |
| F1 | D5 y función pura D14 implementados, commit `feb95f9` | Sin panel nuevo |
| F2 | Modo sombra local probado, commit `573ce47` | Panel legacy conservado |
| F3 — PROPUESTA NO INICIADA | Panel nuevo detrás de un interruptor por usuario | Solo cuentas de prueba |
| F4 — PROPUESTA NO INICIADA | Instantánea al guardar; coherencia con Historial y Finanzas | Solo cuentas de prueba |
| F5 — PROPUESTA NO INICIADA | Advertencias y oportunidades (solo informan) | Solo cuentas de prueba |
| F6 — PROPUESTA NO INICIADA | Lex consume la evaluación | Solo cuentas de prueba |
| F7 — PROPUESTA NO INICIADA | Simulaciones voluntarias y campos opcionales | Solo cuentas de prueba |
| F8 — PROPUESTA NO INICIADA | Heat Map por capas, con la vista clásica conservada | Solo cuentas de prueba |
| F9 — PROPUESTA NO INICIADA | EIA y FMCSA tras confirmar términos | — |
| F10 — PROPUESTA NO INICIADA | Retirada del código antiguo, tras una versión estable | — |

Principios: comportamiento actual conservado hasta verificar el nuevo; una sola fuente de cálculo; pruebas primero; reversión por interruptor o `git revert`; ningún cambio destructivo de datos.

## 13. Existente, propuesto y pendiente de aprobación

| Tema | Existe | Propuesto | Decisión |
|---|---|---|---|
| Función del panel | Veredicto con aspecto de orden | Herramienta interna de referencia: rentabilidad, advertencias, precios de referencia; el conductor decide | — |
| Rentabilidad | Panel legacy conservado; F1 conectado solo a sombra F2 local | Motor fase 1 como resultado principal, con indicador | D5 |
| Zonas | 5 listas contradictorias; veto sin uso | Perfil neutral; zonas de Ricardo solo en su perfil personal; nunca "trampa" | D1, D2 |
| Destinos difíciles | Aviso roto con constantes personales | Advertencia S4 con datos propios y "no garantiza lo que pase esta vez" | D3 |
| Espera | Inferida implícitamente en el código muerto | Clasificación de intervalos con "desconocido"; disponibilidad declarada; campos opcionales | D6, D12 |
| Reposicionamiento y esperas futuras | `HUBS_ESCAPE` sin uso | **Solo simulaciones opcionales** con supuestos del conductor; nunca en el mínimo rentable | D14, D15 |
| Oportunidades locales | No existe | Proximidad (S12) y urgencia (S13) solo con datos verificables; S11 base o región | D16 |
| Negociación | UI legacy conserva su contraoferta; F1 ya dispone de precios sin RPM histórico en el umbral | Precios internos de referencia y comparador de tarifas; sin costos futuros | D5, D10 |
| Conductor nuevo | Configuración mínima | + base, regiones, días fuera, disponibilidad | D6 |
| Combustible y broker | Precio fijo; sin control de broker | EIA y FMCSA tras confirmar términos | D7 |
| Datos de mercado | Ninguno | Candidatas DAT / Truckstop / Warp, con tipo de dato declarado | D8, D9, D13 |
| Confianza | No existe | Multifactorial con factor limitante | — |
| Control manual | No existe | Excepciones; patrones → propuestas confirmadas | D10 |
| Lex | Veredicto propio sobrescrito | Consume la evaluación; comparador y simulaciones por voz | — |

## 14. Matriz de decisiones D1–D16

**Registro histórico y alcance autorizado:** el 14/11 las decisiones eran propuestas. Posteriormente Ricardo autorizó implementar, validar y registrar F1/F2: D5 y la función pura D14 están incorporadas en ese alcance. Eso no aprueba todas las decisiones ni sus interfaces futuras. La columna "Estado" conserva las demás decisiones históricas pendientes:

- **Respaldada por un principio de Ricardo:** coincide con lo que Ricardo dijo el 14-11-2026 ("el panel es una referencia interna, no un cotizador"; lo futuro no se convierte en costo ni en requisito; un estado difícil no garantiza una salida difícil; proximidad y urgencia solo con datos verificables). Falta su confirmación formal de la decisión concreta.
- **Pendiente:** Ricardo no se ha pronunciado.

Las decisiones del motor de la fase 1 (A–G y #1–#13) ya están aprobadas y no se repiten aquí.

| # | Decisión | Propuesta | Estado | Umbrales provisionales | Consecuencia en el motor fase 1 |
|---|---|---|---|---|---|
| D1 | Eliminar los vetos absolutos por zona | Sí | Respaldada por un principio de Ricardo | — | Ninguna (el veto está fuera del motor, en `evaluateLoad` sin uso) |
| D2 | Conocimiento de zonas de Ricardo | Solo en su perfil personal, revisado por él | Pendiente | — | Ninguna |
| D3 | ¿Las advertencias comerciales pueden cambiar el indicador? | No: solo informan | Respaldada por un principio de Ricardo | Confianza: muestra 1–2 / 3–7 / ≥ 8; dispersión 40 %; calidad 60 %; antigüedad 6 meses | Ninguna: `evaluarCarga` no recibe advertencias |
| D4 | Antigua categoría ACEPTAR_ESTRATEGICA | Se retira; pasa a la oportunidad S11 | Pendiente | — | Ninguna (la categoría nunca estuvo en el motor) |
| D5 | RPM histórico fuera del indicador; referencia de precio separada | Sí | Implementación F1 autorizada y registrada (`feb95f9`); UI y mediana automática pendientes | Muestra mínima propuesta ≥ 3, aún no integrada | Fórmula 2, nuevo `rpmReferenciaTarifa` y `preciosReferencia` existentes; F2 no conecta aún la mediana del historial |
| D6 | Configuración ampliada con disponibilidad declarada | Sí, opcional; sin ella, días desconocidos | Pendiente | 22 días disponibles al mes (solo hasta tener la disponibilidad) | Ninguna en el cálculo; `sueldoPorDia` sigue igual |
| D7 | EIA y FMCSA | Sí, condicionado a sus términos | Pendiente | — | Ninguna (datos de entrada, cacheados) |
| D8 | Fuentes comerciales (DAT, Truckstop, Warp) | Pedir condiciones y tipo de dato; sin integración | Pendiente | — | Ninguna |
| D9 | Agregado anónimo entre conductores | Posponer | Pendiente | Muestra mínima por zona (a definir) | Ninguna |
| D10 | Control manual, excepciones y tarifa acordada | Excepciones sin efecto; patrones → propuesta confirmada | Pendiente | 4 excepciones en 2 meses; pausa de 3 meses tras rechazo | Ninguna |
| D11 | Aviso roto y código muerto | Retirar el aviso (F0) y el código (F10) | Pendiente | — | Ninguna |
| D12 | Campos opcionales: entrega, espera, cómo salió | Sí, opcionales | Pendiente | Espera máxima interpretable 7 días; 3 esperas candidatas | Ninguna |
| D13 | Investigar el Freight Analysis Framework | Sí, solo investigación | Pendiente (relacionada con el trabajo de fuentes de Claude Chat) | — | Ninguna |
| D14 | Clasificación de gastos solo para simulaciones | Función pura base; interfaz futura | Función incorporada en F1 con autorización; sin pruebas dedicadas localizadas; simulaciones y clasificación editable pendientes | Valores sintéticos ilustrativos de §10.1, no parámetros personales | `clasificarGastosD14` existe, no cambia `resolverCpm` ni el CPM; no acredita F7 |
| D15 | Costos futuros solo como simulaciones voluntarias | Sí | Respaldada por un principio de Ricardo | Días de conducción = millas / 600 (sustituir por `calcularDiasCarga`) | Ninguna: criterio de prueba pendiente para futuras simulaciones (rentabilidad idéntica con y sin ellas) |
| D16 | Urgencia de la carga | Casilla opcional que marca el conductor | Respaldada por un principio de Ricardo (el concepto); el mecanismo, pendiente | — | Ninguna |

**Resumen al 15/11:** D5 y la función pura D14 están incorporadas con autorización técnica en F1/F2. Sus extensiones de UI, medianas y simulaciones siguen pendientes. D1, D3, D15 y D16 conservan el respaldo conceptual histórico, sin autorización nueva para implementar; las restantes decisiones mantienen su estado pendiente. D5 cambia el umbral; D14 no cambia el CPM.

### 14.1. D14: clasificación base y valores exclusivamente sintéticos

La clase base existe como función pura. `food` y `lodging` se clasifican como `porDiaFuera`; la función no separa la parte incremental de la comida ni calcula importes diarios. Las explicaciones de uso incremental, elecciones editables y simulaciones siguen siendo propuestas; no se afirma cobertura de pruebas específica. La última columna es un ejemplo aritmético público, no historial personal.

| Categoría (id en la app) | Clase base / propuesta de uso | Por qué | Ejemplo sintético, USD/mi |
|---|---|---|---|
| Combustible (`fuel`) | **Variable por milla** | Depende de las millas. Verificar categorías; no inferir su composición | 0.20 (periodo y reciente) |
| Mantenimiento (`maintenance`) | **Variable por milla** | Servicios por kilometraje | 0.03 |
| Llantas (`tires`) | **Variable por milla** | Desgaste por millas | 0.01 |
| Reparaciones (`repairs`) | **Variable por milla** (ordinarias); las grandes, **no recurrentes** (motor §6) | Desgaste, con eventos irregulares | 0.01 |
| Peajes (`tolls`) | **Por carga** (fuera del CPM, motor §5) | Dependen de la ruta | 0.02 (fuera del CPM) |
| Comida (`food`) | **Mixta → por día fuera de base** | Parte se gastaría igual en casa; solo el exceso es incremental | 0.02 |
| Alojamiento (`lodging`) | **Por día fuera de base** | Solo existe fuera de casa | 0.02 |
| Seguro (`insurance`) | **Fija (tiempo)** | Mensual, sin importar las millas | 0.12 |
| Pago del vehículo (`carpayment`) | **Fija (tiempo)** | Mensual | 0.10 |
| Permisos y licencias (`permits`) | **Fija (tiempo)** | Anual o mensual | 0.01 |
| Teléfono (si se registra) | **Fija (tiempo)** | Mensual | 0.02 |
| Otros (`other`) | **Sin clasificar** | Sin categoría; el conductor puede reclasificar movimientos | 0.04 |
| Categorías personalizadas | **La que elija el conductor**; sin elegir, "sin clasificar" | Solo él sabe qué son | 0.02 |

Reglas:

- Lo **sin clasificar** no entra en `costoVariablePorMilla` ni en `gastoViajeDiario` (sigue dentro del CPM, que ya lo incluye) y se informa.
- **La clasificación no cambia el CPM**: solo sirve para las simulaciones (§7.5–§7.6).

### 14.2. Umbrales y cifras provisionales (a validar con datos)

Espera máxima interpretable 7 días; dispersión 40 %; calidad 60 %; antigüedad 6 meses; patrón persistente 4 excepciones en 2 meses; pausa de propuesta rechazada 3 meses; esperas candidatas mínimas 3; deadhead que indica reposicionamiento (a definir); días de conducción = millas / 600 (sustituir por `calcularDiasCarga`); días disponibles al mes 22 (sustituir por la disponibilidad declarada); $0.25/mi, $20/día y $150/día exclusivamente sintéticos de §10.1. Ninguno cambia el indicador (por diseño, §7.6.3); los que alimentan advertencias y simulaciones se validarán con datos antes de mostrarse como algo más que provisionales.

## 15. Riesgos

1. **Muestra pequeña:** con pocos datos, el sistema dirá "sin datos tuyos" a menudo. Es preferible a inventar; los campos opcionales (D12) aceleran el aprendizaje.
2. **Datos incompletos del conductor:** si no registra todas sus cargas o sus millas vacías, los intervalos y la base habitual se malinterpretan; mitigado por §6.2, §7.1 y la confianza.
3. **Uso personal del vehículo** mezclado en el combustible: infla el CPM real y la base habitual aparente; no se puede separar sin datos adicionales (odómetro o marca de uso personal).
4. **Carga de trabajo del conductor:** campos opcionales, simulaciones y propuestas deben ser pocos y claros; todo es opcional.
5. **Falsa precisión:** las simulaciones dependen de D14, de la base habitual y de los supuestos del conductor; se rotulan siempre como simulación, con su desglose.
6. **Lectura del indicador como orden:** el texto debe dejar claro que es una referencia ("cubre tus costos…"), no "acepta" o "rechaza".
7. **Licencias de datos de mercado:** probable restricción de uso comercial; no depender de ellos.
8. **Complejidad visible:** límite de 3 advertencias visibles.
9. **Rendimiento:** el contexto de mercado se calcula y cachea por sesión, como el CPM real.
10. **Coherencia con el motor:** D5 y §7.4 modifican la contraoferta del motor de la fase 1 (sin RPM histórico en el umbral; referencia propia aparte); ya tienen implementación F1; esta revisión documenta ese estado. Las extensiones propuestas de interfaz y mediana necesitan sus propias pruebas. La ganancia estimada del motor no cambia por D5 aislado.

## 16. Fuentes consultadas (14-11-2026)

- DAT — RateView: https://services.dat.com/content/resources/product-sheets/rateview-general
- DAT — Sprinter Van Expediting: https://dat.com/solutions/sprinter-van-expediting
- HDT — DAT One, categorías de equipo adicionales: https://www.truckinginfo.com/news/dat-freight-analytics-updates-dat-one-load-board
- DAT — Trendlines: https://www.dat.com/resources/trendlines
- Solera — Sylectus Load Board: https://fleet-solutions.solera.com/sylectus-load-board
- Omnitracs — Sylectus Load Board: https://www.omnitracs.com/technology/load-board
- API Evangelist — Truckstop (Rate Insights v3): https://providers.apievangelist.com/providers/truckstop/
- PR Newswire — Truckstop Rate Insights (2022): https://prnewswire.com/news-releases/introducing-rate-insights-a-first-of-its-kind-rate-tool-giving-truckstopcom-customers-the-power-to-competitively-price-and-negotiate-rates-301519604.html
- EIA — Gasoline and Diesel Fuel Update: https://www.eia.gov/petroleum/gasdiesel/index.php
- EIA — Derechos y reutilización: https://www.eia.gov/about/copyrights_reuse.php
- EIA — Términos de la API: https://www.eia.gov/opendata/terms-of-service.php
- OilPriceAPI — EIA API v2 y límites (terceros): https://www.oilpriceapi.com/eia-api
- FMCSA — QCMobile API: https://mobile.fmcsa.dot.gov/QCDevsite/docs/qcApi
- FMCSA — QCMobile, primeros pasos: https://mobile.fmcsa.dot.gov/QCDevsite/docs/getStarted
- FMCSA — QCMobile, acceso a la API: https://mobile.fmcsa.dot.gov/QCDevsite/docs/apiAccess
- Load Work — tarifas en expedite (terceros, orientativo): https://intercom.help/load-work/en/articles/15138351-rates-and-rpm-how-to-think-about-money-in-expedited-freight
- Truxx.ai — costo por milla de cargo van (terceros, orientativo): https://truxx.ai/tools/cost-per-mile-calculator/cargo-van
- Distancias (secundarias, orientativas): Rome2Rio (https://www.rome2rio.com/s/Miami/Chicago-IL, https://www.rome2rio.com/s/Phoenix/Chicago, https://www.rome2rio.com/s/Detroit-MI/Miami); DistanceFrom (https://distancefrom.co/distance/chicago-to-miami/, https://distancefrom.co/distance/chicago-to-phoenix/, https://distancefrom.co/distance/detroit-to-miami/); Air Miles Calculator (https://www.airmilescalculator.com/distance/dtw-to-mia/); 1map (https://site.1map.maklai.co/routes/us-fl-miami_to_us-il-chicago, https://site.1map.maklai.co/routes/us-az-phoenix_to_us-il-chicago)
- Código verificado: `public/js/core/financial-engine.js` (`calcularCpmReal`, `evaluarCarga`, `millasDeCarga`), `public/js/settings.js` (CPM de Configuración), `public/js/calculator.js` (`totalMiles`).
- Warp y Freight Analysis Framework: **sin consulta propia todavía** (incluidos como candidatos a investigar).
