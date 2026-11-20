# Plan incremental de implementación — Sistema Inteligente de Razonamiento de Cargas

**Estado:** plan del 14/11/2026 actualizado documentalmente el 15/11/2026. F0(a), F1 y F2 registrados localmente; F0(b) y F3–F10 pendientes. **No ejecutar fases nuevas** sin aprobación de Ricardo.
**Autor:** Claude
**Documentos base:** `2026-11-14-razonamiento-cargas-design.md` (v3), `2026-11-13-motor-financiero-design.md` (motor fase 1), `2026-11-14-auditoria-heat-map.md`.

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

## 1. Reglas de todas las fases

1. **Conservar el comportamiento actual hasta verificar el nuevo.** `flags.razonamientoV3` es un interruptor propuesto para fases futuras. F2 utiliza las guardas locales y parámetros del laboratorio indicados en la revisión del 15/11; no está habilitado en producción.
2. **Una sola fuente de cálculo:** el motor de la fase 1 (`financial-engine.js`) y las capas nuevas (`market-context.js`, `load-signals.js`, `load-reasoning.js`), todas funciones puras. Como arquitectura objetivo de fases futuras, Panel, Lex, Historial, Finanzas y Zonas leerían sus resultados sin recalcular por su cuenta. Actualmente F2 solo los consume en sombra y las pantallas legacy conservan sus cálculos.
3. **Pruebas primero** (`node --test`). El plan original contemplaba CSV privado; el cierre autorizado de F2 se realizó con datos sintéticos y Emulator, no con una nueva ejecución de ese CSV. Cualquier ensayo futuro con datos reales requiere autorización y debe permanecer fuera del repositorio.
4. **Fases pequeñas**, un commit por bloque, en una rama propia; vista previa (canal de Hosting) y revisión de Ricardo; producción solo con su autorización explícita.
5. **Reversión:** cada fase indica cómo volver atrás. Regla general: apagar el interruptor (inmediato, sin despliegue) o `git revert` del commit de la fase. **Ningún cambio de datos destructivo**: los campos nuevos se añaden; los antiguos no se borran ni se reescriben.
6. **Objetivo de F4, no implementado:** persistir la instantánea y `formulaVersion` por carga, conservar cifras antiguas y rotularlas "cálculo anterior", sin recalcularlas en silencio. El snapshot puro que devuelve F1 no acredita esa integración en el guardado.

## 2. Fases

| Fase | Contenido | Pruebas y criterio de salida | Reversión | Requiere |
|---|---|---|---|---|
| **F0(a). Zonas H1 — COMPLETADO LOCAL** | `netProfit` válido tiene prioridad; `profit` es respaldo, con cero y negativos conservados | 13/13 pruebas; commit `467460e`; no cambia colores ni umbrales | `git revert` del commit, solo con autorización | Corrección independiente autorizada |
| **F0(b). Aviso de zona trampa — PENDIENTE** | Propuesta no iniciada: retirar o dejar inerte el aviso roto hasta F5 | Pruebas por definir; no forma parte de H1 | Reversión por definir al implementar | D11 y autorización específica |
| **F1. Ajustes del motor — IMPLEMENTADO LOCAL** | D5 en `evaluarCarga`: el RPM promedio histórico sale del umbral de "Cubre objetivo"; nuevo parámetro `rpmReferenciaTarifa` (mediana tipo C de ruta o estado); `preciosReferencia` siempre presentes (también cuando cubre el objetivo); `FORMULA_VERSION` 2. Función pura nueva de desglose por clase de gasto (D14), sin cambiar `resolverCpm` | Prueba D5 actualizada y resultado registrado 125/125 del conjunto motor + guardas F2. Criterios adicionales propuestos: unidades sintéticas de §10.5 ($494.29 / $510 / $550.80), comparador por tarifa y etiquetas de RPM. No se declaran ejecutados todos esos criterios ni pruebas dedicadas de D14 | `git revert` autorizado; app.html ya carga el motor para F2, sin sustituir el panel | D5, D14 |
| **F2. Modo sombra — COMPLETADO EN LABORATORIO LOCAL** | La calculadora llama al motor **en paralelo** al panel actual, sin mostrarlo; compara mediante diagnóstico local (`console.debug`; errores mediante `debugLog`), sin enviar informes externos veredicto actual frente a indicador nuevo, ganancia y contraoferta. Lectura del CPM con `resolverCpm` y persistencia de `ultimoCpmRealConfiable` | Validación autorizada con datos ficticios: SDK/Emulator 6/6 + 2/2; navegador OFF/ON. Diferencias explicadas por fuente de CPM y exclusión de peajes; CSV real no reejecutado. Commit `573ce47` | Interruptor apagado = código sin efecto; `git revert` | F1 |
| **F3. Panel nuevo (detrás del interruptor) — PROPUESTA NO INICIADA** | Resultado principal con "ganancia estimada" rotulada (fuente y periodo del CPM), indicador con texto de referencia, precios de referencia y comparador de tarifas con etiquetas de RPM (§7.4.1). El panel actual sigue siendo el de todos los demás usuarios | Pruebas de presentación: rótulo "estimada", etiquetas de RPM, extras; revisión visual en vista previa en móvil y escritorio; Ricardo usa el panel nuevo en su cuenta un periodo acordado | Apagar el interruptor | D1, D3, D4, D5 |
| **F4. Guardado y coherencia con Historial y Finanzas — PROPUESTA NO INICIADA** | Al guardar: instantánea de la evaluación (`formulaVersion`, CPM, fuente, periodo). Historial y reportes muestran "ganancia estimada" de la instantánea; Finanzas sigue mostrando el **resultado realizado** (gastos y cobros), rotulado como tal y sin mezclarse | Pruebas: carga antigua conserva sus cifras; carga nueva guarda la instantánea; la ganancia estimada del Panel = la del Historial para la misma carga; Finanzas no cambia sus totales | `git revert`; los campos nuevos se ignoran si se apaga | F3 |
| **F5. Advertencias y oportunidades (solo lectura) — PROPUESTA NO INICIADA** | `market-context.js` y `load-signals.js`: S4, S6, S7, S11, S12 con datos propios, confianza multifactorial, "sin datos tuyos" y "no garantiza lo que pase esta vez"; S8, S9, S10 con sus fuentes actuales | Pruebas de §10.5 de la v3 (intervalos, desconocidos, mediana, poco deadhead, sin datos); prueba de que ninguna advertencia cambia rentabilidad, indicador ni precios | Apagar el interruptor | D2, D3, D6 |
| **F6. Lex coherente — PROPUESTA NO INICIADA** | Lex consume la evaluación; se retiran su veredicto propio, sus umbrales y el `minRPM` fijo; "¿y si me pagan $X?" usa el comparador | Prueba de coherencia: misma carga → mismo indicador, ganancia estimada y precios en Panel y Lex | Interruptor; `git revert` | F3, F5 |
| **F7. Simulaciones y datos opcionales — PROPUESTA NO INICIADA** | Simulaciones voluntarias (§7.5–§7.6), con gastos simulados e hipótesis de oportunidad separados; campos opcionales: fecha de entrega, días de espera, cómo salió (D12), urgencia (D16), tarifa acordada (D10); disponibilidad declarada (D6) | Pruebas: simulación sin supuestos no se calcula; hipótesis aparte; nada cambia la rentabilidad; campos vacíos no rompen nada | Interruptor; campos opcionales ignorables | D6, D10, D12, D14, D15, D16 |
| **F8. Heat Map por capas — PROPUESTA NO INICIADA** | Separar cálculo y pintura (auditoría §6); "Vista clásica" conservada; capas de rentabilidad personal, tarifas comparables, actividad y entradas/salidas desde `market-context.js`; vista regional | Pruebas de cada capa (ponderación, bases de RPM, ventana, confianza como estilo); la vista clásica idéntica a la actual (salvo H1 ya corregido) | Selector vuelve a la vista clásica; interruptor | Aprobación de la auditoría; D3 |
| **F9. Fuentes públicas — PROPUESTA NO INICIADA** | EIA (combustible) y FMCSA (broker, S8) en funciones de servidor con caché | Pruebas con datos guardados (sin red en las pruebas) | Desactivar la función; el razonamiento funciona sin ellas | D7 y términos confirmados |
| **F10. Retirada del código antiguo — PROPUESTA NO INICIADA** | Panel antiguo, umbrales de zona sin uso, listas de zonas trampa, `evaluateLoad`, `calculator-decision.js`, veredicto de Lex | Búsqueda de referencias = 0; todas las pruebas en verde; una versión de producción completa con el sistema nuevo sin incidencias antes de borrar | `git revert` | D11; F3–F8 estables |

Las fuentes comerciales (D8) y el agregado anónimo (D9) quedan fuera de este plan hasta tener acuerdos escritos y política de privacidad.

## 3. Coherencia objetivo entre Panel, Lex y Finanzas — PROPUESTA

Esta tabla y la prueba transversal describen F3–F8 futuros. No certifican integración actual de instantáneas, cobros, pagos parciales o capas de mercado. La corrección independiente de Finanzas (`4b9402f`) unifica estados y fechas, sin integrar el motor de cobros F1.

| Cifra | Fuente única | Dónde se muestra | Rótulo |
|---|---|---|---|
| Ganancia **estimada** de una carga | `evaluarCarga` (instantánea al guardar) | Panel, Lex, Historial, Zonas (capa de rentabilidad personal) | "Ganancia estimada con tu CPM de $X/mi (fuente, periodo)" |
| Resultado **realizado** | Finanzas: gastos registrados y cobros (motor fase 1, §3.4) | Finanzas y reportes financieros | "Resultado real (gastos y cobros registrados)" |
| CPM aplicado | `resolverCpm` | Panel, Configuración, Lex | Fuente y periodo |
| Precios de referencia | `evaluarCarga` + `rpmReferenciaTarifa` | Panel, Lex | "Referencia interna, no se envía al dispatcher" |
| Advertencias | `load-signals.js` | Panel, Lex, Zonas | Evidencia y confianza |

Prueba transversal: para un conjunto fijo de cargas, Panel, Lex e Historial devuelven las mismas cifras estimadas, y Finanzas no cambia sus totales realizados.

## 4. Riesgos del plan

1. **Cambio de umbral por D5:** al retirar `max(objetivo, RPM histórico)`, el umbral baja o permanece igual. Una evaluación que antes no alcanzaba el RPM histórico puede pasar a `ACEPTAR`; no ocurre el cambio inverso por D5 aislado. F2 solo lo diagnostica; el panel visible sigue siendo legacy.
2. **Doble código temporal** mientras conviven panel antiguo y nuevo: comienza con el cálculo paralelo de F2 y permanece previsto hasta F10 y se retira en F10.
3. **Datos antiguos heterogéneos** (ganancias con fórmulas antiguas): se rotulan, no se recalculan en silencio.
4. **Costo de Google** al añadir coordenadas o ZIP: solo al guardar cargas nuevas, una vez por carga.
