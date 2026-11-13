# Motor financiero único — Especificación

**Estado:** BORRADOR — revisión 6. Decisiones de diseño de Ricardo aprobadas (A–G, 1–11). Pendiente de cierre: tratamiento de sobrepagos y método fiscal (§11.3) y umbrales técnicos provisionales (§11.4). No implementar hasta aprobación.
**Fecha:** 13 de noviembre de 2026
**Autores:** Claude (rama `fix/seguridad-costos-reportes`) y ChatGPT (prototipo `smartload-financial-prototype`), consolidado por Claude.
**Base de código:** rama `fix/seguridad-costos-reportes` (parte de `main` @ `2de295e`). Revisiones anteriores: 1 `05c1908`, 2 `5e3ce07`, 3 `a8c81bb`, 4 `85fea4c`, 5 `3135121`.

---

## Historial de revisiones

| Rev. | Fecha | Cambios |
|---|---|---|
| 1 | 13-11-2026 | Borrador inicial (commit `05c1908`) |
| 2 | 13-11-2026 | Revisión cruzada Claude/ChatGPT: RPM total vs RPM de tarifa (§7.1), Extras confirmados (§2, §3), contraoferta (§7.4), objetivo = máximo entre sueldo y margen (§7.1), sueldo bruto (§7.2), cargas antiguas sin reconstrucción de CPM (§8), criterio de millas pasa a advertencia y control de combustible esperado (§4.2), gastos extraordinarios por materialidad y recurrencia (§6). Separación explícita entre decisiones aprobadas, pendientes y umbrales provisionales (§11) |
| 3 | 13-11-2026 | Evaluación vs liquidación (§3.4). Control de combustible aproximado (§4.2). Pérdida de confiabilidad de un CPM real elegido (§4.5). Validación contable separada de la del CPM (§10.3). Decisión pendiente #7 |
| 4 | 13-11-2026 | Decisiones 1–7 de Ricardo incorporadas (§11.1). Contratado, facturado y cobrado con pagos parciales e incobrables (§3.4). Regla "el CPM nunca baja automáticamente" (§4.4, §4.5). Peajes solo si se escriben, sin promedio histórico (§5). Usuario nuevo: configuración mínima propia, sin promedio de industria; opción (a) pendiente de Ricardo (§4.1, §11.2 #8). Ganancia siempre "estimada". Pago del vehículo $0 válido (§9). Método fiscal pendiente de verificar con el contador (§3.4) |
| 5 | 13-11-2026 | Decisión #8 aprobada por Ricardo: opción (a) para usuarios sin configuración mínima (§4.1, §11.1). Sobrepagos marcados como pendientes de precisar (§3.4, §11.2). Registrado que la exportación CSV de Finanzas no tiene botón (§12) |
| 6 | 13-11-2026 | Validación con datos reales (112 cargas, 80 gastos). Decisiones #9 (meses incompletos), #10 (margen de negociación configurable) y #11 (seguro de $2,705 solo como candidato a revisión). Periodo del CPM real: mes en curso, meses finales incompletos y meses intermedios incompletos (§4.2). Cobertura de gastos fijos por número de pagos significativos o por importe (§4.2). Antigüedad del CPM real (§4.6). Gastos extraordinarios: sin combustible ni peajes, 5 % + doble de la mediana (§6). Tabla de decisiones separada en aprobadas, reglas técnicas cerradas, pendientes y umbrales provisionales (§11) |

---

## 0. Por qué existe este documento

Hoy la ganancia de una carga se calcula en cinco sitios distintos (calcular, guardar, panel de decisión y dos en Historial), el costo por milla (CPM) tiene tres orígenes posibles y Lex AI usa reglas de decisión propias. Cada auditoría encontró casos en que dos pantallas daban números distintos para la misma carga.

Objetivo: **una sola definición de cada número**, usada por todas las pantallas, separando claramente:

- **Rentabilidad estimada**: antes de aceptar una carga (calculadora, panel, Lex, historial de cargas). Siempre se rotula como **estimada**, aunque se calcule con los datos propios del conductor.
- **Rentabilidad contable**: lo que realmente pasó (Finanzas: ingresos de cargas menos gastos registrados).

Nunca se mezclan: Finanzas no descuenta costos estimados, y la calculadora no registra gastos en Finanzas.

## 1. Estado actual (punto de partida)

| Ámbito | Producción | Vista previa (rama) |
|---|---|---|
| Fórmula: cobro = tarifa + extras; gastos = CPM × millas + toll | Sí | Sí |
| Lectura de costos sin el "costo fantasma" de $0.06/mi | Sí | Sí |
| Historial: edición sin CPM duplicado | Sí | Sí |
| CPM real desde Finanzas (meses con actividad, combustible 3 meses) | No | Sí |
| Desglose "Ver cómo se calcula" | No | Sí |
| Sueldo del dueño por día | No | Sí |
| Reportes PDF completos, lista de gastos completa, edición de categoría | No | Sí |

Lo de la vista previa **no se publicará** tal cual: se rehace sobre esta especificación.

**Diferencias conocidas entre la rama y esta especificación** (pendientes de implementar):

- `cpm-engine.js` todavía **incluye la categoría Peajes** en el CPM real (§5 la excluye).
- El sueldo **sustituye** al margen (§7.1 usa el máximo de ambos).
- No existe el control de combustible esperado (§4.2, criterio 3) ni la detección de gastos extraordinarios (§6).
- El RPM mínimo de Configuración no se aplica en el semáforo (§7.1).
- No existen Extras confirmados / no confirmados (§2), ni contratado / facturado / cobrado con pagos parciales (§3.4).
- El usuario nuevo recibe un promedio de industria ($0.534 o $0.55) en lugar de pedir su configuración mínima (§4.1).
- Mientras el conductor no elige fuente, se usa Configuración aunque sea menor que el CPM real confiable (§4.4).
- La ganancia se rotula "Ganancia Neta", no "estimada".
- El periodo del CPM real no excluye el mes en curso ni los meses finales incompletos, ni bloquea por meses intermedios incompletos (§4.2), y no muestra la antigüedad de los datos (§4.6).
- La cobertura de gastos fijos se comprueba mes a mes (§4.2 la cambia por cobertura global).
- El margen de la contraoferta está fijo en 8 % (§7.4 lo hace configurable).

## 2. Definiciones

| Término | Definición | Tipo |
|---|---|---|
| **Tarifa (Rate)** | Pago base contratado por la carga | Ingreso |
| **Extras confirmados** | Cargos adicionales que el cliente ya aceptó pagar (descarga, espera acordada…). En pantalla: "Cargos Extra al Cliente" | Ingreso |
| **Extras no confirmados** | Cargos posibles pero no garantizados al aceptar la carga (p. ej. detención eventual) | **No** cuentan como ingreso en la decisión; se muestran aparte como "posible adicional" |
| **Toll de la carga** | Peaje que el conductor **escribe** para esa carga. Si el campo está vacío, el peaje estimado es **$0**: no se presupone ningún peaje | Gasto **estimado** de esa carga. **No** genera ningún asiento en Finanzas |
| **Peaje registrado** | Gasto de la categoría Peajes que el conductor registra en Finanzas al subir el recibo | Gasto **real** |
| **Millas totales** | Millas cargadas + deadhead. Las paradas del sistema de destinos actual solo suman millas (no tienen ingreso propio) | — |
| **CPM base** | Costo por milla de operar **sin peajes** | Gasto estimado |
| **Sueldo del dueño** | Sueldo **bruto, antes de impuestos**, que el conductor necesita sacar al mes. Opcional | Objetivo, no gasto |

Notas:
- **Todos los RPM de esta especificación se calculan sobre millas totales** (cargadas + deadhead). Decisión aprobada por Ricardo.
- El sistema antiguo de paradas con ingreso propio (`stopsContainer`) ya no existe en la interfaz; si se reintroduce, sus ingresos entran en "Ingresos totales".
- El reposicionamiento entre cargas no se registra. Por diseño, el CPM real reparte su costo entre las millas de las cargas guardadas (ver §4.3).
- UI de Extras (a definir en implementación): el campo actual de "Cargos Extra al Cliente" pasa a representar Extras **confirmados**; los no confirmados requieren un campo o una casilla adicional.

## 3. Función financiera única

### 3.1. Contrato

Una función pura, sin acceso a Firebase ni al DOM:

```text
calcularCarga(entradas, supuestos) -> resultado
```

**Entradas** (de la carga): `tarifa`, `extrasConfirmados`, `extrasNoConfirmados`, `tollCarga` (número o vacío), `millasCargadas`, `millasDeadhead`, `estadoOrigen`, `estadoDestino`, `fecha`.

**Supuestos** (resueltos antes, ver §4): `cpmBase`, `cpmFuente` (`configuracion` | `real` | `referenciaTemporal`), `cpmUltimoPeriodoConfiable` (fecha, solo si la fuente es real o temporal), `combustiblePorMilla`, `sueldoPorDia`, `diasCarga`, `margenObjetivo`, `rpmMinimo`, `margenNegociacion`.

Si **no hay configuración mínima** (§4.1), la función devuelve solo ingresos, millas y RPM, con `estado = "sinConfiguracion"`, y **no** calcula costos, ganancia, umbrales ni contraoferta.

**Resultado:**

```text
millasTotales      = millasCargadas + millasDeadhead
ingresosTotales    = tarifa + extrasConfirmados
rpmTarifa          = tarifa / millasTotales
rpmTotal           = ingresosTotales / millasTotales
posibleAdicional   = extrasNoConfirmados          (solo informativo)
peajeEstimado      = tollCarga si se escribió; si está vacío, 0
costoOperativo     = cpmBase × millasTotales
costoEstimado      = costoOperativo + peajeEstimado
gananciaEstimada   = ingresosTotales − costoEstimado      (puede ser negativa)
margenEstimado     = gananciaEstimada / ingresosTotales    (0 si no hay ingresos)
sueldoCarga        = sueldoPorDia × diasCarga
gananciaTrasSueldo = gananciaEstimada − sueldoCarga
umbrales           = ver §7.1
contraoferta       = ver §7.4
snapshot           = copia de entradas + supuestos + versión de la fórmula
```

En pantalla: "Ganancia estimada", "Margen estimado", nunca "real".

### 3.2. Quién la usa

| Pantalla / flujo | Uso |
|---|---|
| Calculadora y panel de decisión | Muestra `resultado` |
| Guardar carga (online y **sin conexión**, vía `sync-manager` → `createLoad`) | Guarda `resultado` + `snapshot`; **no recalcula** |
| Historial: ver | Muestra lo guardado |
| Historial: editar | Ver §8 |
| Reportes estimados / Zonas | Leen lo guardado |
| Lex AI | Recibe `resultado` y `umbrales`; **no recalcula** (§7.3) |
| Finanzas | **No la usa**: trabaja con ingresos y gastos reales |

### 3.3. Reglas

- Sin `||` para valores numéricos: un `0` es un valor válido. Solo `null`/vacío usa valores por defecto.
- Redondeo solo al mostrar, nunca al guardar.
- Versión de fórmula (`formulaVersion`) en cada carga guardada.

### 3.4. Contratado, facturado y cobrado

Se **reutilizan los campos existentes** de la carga (`totalCharge`, `paymentStatus`, `expectedPaymentDate`, `actualPaymentDate`); solo se añaden campos opcionales. No hay un sistema contable paralelo.

| Concepto | Dónde se guarda | ¿Cambia? |
|---|---|---|
| **Contratado** | En la evaluación (`snapshot`): tarifa + Extras confirmados al aceptar | **Nunca** |
| **Facturado** | `totalCharge` (campo existente): tarifa + Extras finalmente acordados | Sí, al añadir o quitar un Extra (p. ej. un Extra no confirmado que termina aprobándose). Cada cambio se registra (`facturadoActualizadoEn`) |
| **Cobrado** | Lista opcional `abonos: [{ importe, fecha }]` | Sí, al registrar cada cobro |
| **Incobrable** | Ajuste opcional `ajusteIncobrable: { importe, fecha, motivo }` | Solo por acción explícita del conductor |

Derivados:

```text
cobrado   = Σ abonos.importe
pendiente = facturado − cobrado − ajusteIncobrable.importe
```

**Estado de pago:**

| Estado | Condición |
|---|---|
| Pagada | `pendiente ≤ 0` |
| Pago parcial | `cobrado > 0` y `pendiente > 0` |
| Vencida | `cobrado = 0`, `pendiente > 0` y pasó `expectedPaymentDate` |
| Pendiente | resto |

**Compatibilidad con lo existente:**

- `actualPaymentDate` se escribe **solo cuando `pendiente` llega a 0** (fecha del último abono). Así, todo el código actual que entiende "tiene `actualPaymentDate` = pagada" sigue funcionando, y una carga con pago parcial sigue apareciendo como no pagada.
- Carga antigua con `actualPaymentDate` y sin `abonos`: se **lee** como un único abono por `totalCharge` en esa fecha. No se reescribe.
- "Marcar como pagada" pasa a "Registrar pago", con el importe pendiente propuesto por defecto (un clic = pago total, como hoy).

**Reglas:**

- Un pago parcial **no** cambia la ganancia estimada ni la facturada.
- Un Extra nunca crea un ingreso aparte: solo modifica `totalCharge`.
- Si el cliente paga de menos, la diferencia queda en `pendiente` y se muestra en Cuentas; no se convierte en gasto.
- **Sobrepagos (pendiente de precisar, §11.3):** hoy la especificación solo establece que un sobrepago deja `pendiente` negativo, visible en Cuentas, sin modificar la ganancia estimada ni la facturada. Falta definir si se registra como saldo a favor del cliente, como ingreso adicional (Extra cobrado) o como importe a devolver, y cómo aparece en el flujo de caja.
- Una diferencia definitivamente incobrable requiere el **ajuste explícito**; aparece como línea propia ("Pérdida por incobrable") en el Estado de Resultados. No modifica `totalCharge`.

**Qué usa cada reporte:**

| Reporte | Importe | Fecha |
|---|---|---|
| Estado de Resultados, Desglose, Zonas, CPM real | Facturado (`totalCharge`) − incobrables | Fecha de la carga |
| Cuentas por cobrar y antigüedad | **Pendiente** (hoy usa el total facturado) | Fecha de pago esperada |
| Flujo de caja / cobros | **Abonos** (hoy usa el total facturado de las pagadas) | **Fecha de cada abono** (hoy usa la fecha de la carga) |
| Historial | "Evaluada / Facturada / Cobrada", solo las que difieran | — |

**Pendiente de verificar con el contador de Ricardo (no es decisión técnica):** el reporte fiscal (Schedule C) hoy cuenta como ingresos el facturado según la **fecha de la carga** (base devengado). La mayoría de dueño-operadores declaran por **lo cobrado**: en ese caso una carga de diciembre cobrada en enero corresponde al año siguiente, y los incobrables no se deducen (nunca se declararon). El reporte se ajustará al método que confirme el contador.

## 4. Resolución del CPM base

### 4.1. Etapas

El costo de decisión sale **siempre de los datos del propio conductor** (decisión de Ricardo). No se usa ningún promedio de industria para decidir.

| Etapa | Condición | CPM base | Qué muestra |
|---|---|---|---|
| **A. Sin configuración mínima** | Faltan datos de la configuración mínima | — | Tarifa, millas cargadas, deadhead y RPM. **No** muestra ganancia estimada, semáforo de decisión ni contraoferta: "Completa tu configuración para ver tu ganancia estimada", con acceso directo a los cinco datos mínimos. *(Opción (a), aprobada por Ricardo, decisión #8)* |
| **B. Configurado** | Configuración mínima completa, sin historial confiable | Desde Configuración | "Según tu Configuración" |
| **C. Con historial** | Historial que pasa §4.2 | §4.4 | Ambos valores visibles |

**Configuración mínima** (parte del onboarding; ~1 minuto):

1. Pago mensual del vehículo — **$0 es válido** (vehículo propio).
2. Seguro mensual.
3. MPG.
4. Precio de combustible por galón.
5. Millas que rueda al mes.

Al completarla se **ofrecen** (no se exigen) mantenimiento, llantas, reparaciones y otros fijos. El botón "Después" del onboarding se mantiene, pero sin configuración mínima no hay veredicto. Las recomendaciones financieras (ganancia estimada, semáforo, contraoferta, veredicto de Lex) se habilitan **únicamente** al completar los cinco datos.

### 4.2. Periodo y criterios de confianza del CPM real (decisiones 1 y 9)

#### Periodo

1. **Mes con actividad:** mes con ≥ 25 % de las millas de un mes típico del conductor (mediana), mínimo 300 mi.
2. **Mes incompleto:** mes con actividad que **no tiene combustible registrado**, o cuyo combustible por milla es **< 0.5×** el esperado (`precio / MPG` de Configuración). Todo mes con millas consume combustible: es el mejor indicador de registro incompleto.
3. **Exclusiones** (sin modificar nunca los registros originales):

| Caso | Tratamiento |
|---|---|
| **Mes en curso** (mes del calendario actual, sin cerrar) | Se excluye **siempre**, esté o no completo |
| **Meses finales históricos incompletos** (los últimos meses con actividad, consecutivos, que son incompletos) | Se excluyen **conjuntamente sus millas y sus gastos**, uno tras otro hasta llegar a un mes completo. Nota visible: "Último periodo confiable: hasta [mes]. [Meses] excluidos: sin gastos registrados" (decisión #9) |
| **Mes intermedio incompleto** (incompleto, con meses completos antes y después) | **Bloquea** la confiabilidad: "Falta registrar gastos de [mes]". No se excluye ni se infiere nada |

4. Tras las exclusiones, el periodo son los últimos 12 meses con actividad que quedan. Se incluyen los gastos de meses de pausa **intermedios** (seguro y pago del vehículo se pagan igual); se excluyen los posteriores al último mes del periodo.
5. Si tras las exclusiones quedan **menos de 3 meses con actividad**, el CPM real no es confiable.

**Validación con los datos de Ricardo:** 11 meses con actividad (umbral 1,618 mi). Abril de 2026 tiene 3 cargas y 2,269 mi sin ningún gasto (ni combustible): es mes final incompleto y se excluye. Periodo resultante: mayo 2025 – marzo 2026, 66,467 mi. CPM real (sin peajes, combustible reciente): **$0.764/mi** (con abril, $0.729/mi). Enero de 2026 (sin cargas, $2,237 de gastos) es pausa intermedia y sus gastos se incluyen.

#### Criterios que bloquean

Si falla alguno, el CPM real se considera no confiable y el desglose indica cuál falló:

1. ≥ 3 meses con actividad y ≥ 20 cargas.
2. Gastos registrados en ≥ 3 meses del periodo.
3. **Combustible coherente con la Configuración.** Hay combustible registrado y el combustible real por milla está entre **0.5× y 1.5×** el esperado (`precio por galón / MPG` de Configuración):
   - por encima de 1.5×: "posibles cargas sin registrar" (hay recibos pero faltan millas);
   - por debajo de 0.5×: "posibles recibos de combustible sin registrar".
   - **Es una comparación aproximada**, y así se indica en pantalla: el precio de Configuración es el actual y no el de cada mes del periodo, y el MPG configurado puede no ser exacto. La banda es deliberadamente ancha para absorber esas diferencias (±30 % de variación de precio sigue dentro): detecta errores de registro groseros, no variaciones de precio.
   - Mejora posterior (no incluida): usar el precio promedio nacional mensual del periodo (fuente pública, p. ej. EIA).
4. **Cobertura global de gastos fijos.** Para cada gasto fijo declarado en Configuración (seguro; pago del vehículo si es > $0), se cumple **al menos una** de estas condiciones en el periodo:
   - **Por número de pagos significativos:** número de pagos ≥ meses del periodo − 1. Solo cuenta como pago significativo el que es ≥ 50 % del importe mensual configurado (o, si no hay importe configurado, ≥ 50 % de la mediana de esa categoría en el periodo). Así, un pago muy pequeño (p. ej. un recargo de $24.88) no cuenta como cobertura. Tolera cambios de póliza, porque no depende de que el importe coincida.
   - **Por importe:** total pagado ≥ 80 % de `importe mensual configurado × meses del periodo`. Tolera pagos acumulados o atrasados.
   - Los meses de pausa intermedios cuentan como meses del periodo; el primer mes cuenta aunque sea parcial; un pago del vehículo de $0 no se exige.
   - No se exige un pago en cada mes: los calendarios de pago reales no son mensuales exactos.

   *Validación con los datos de Ricardo (periodo mayo 2025 – marzo 2026, 11 meses):* seguro, 11 pagos significativos de 12 (el de $24.88 no cuenta), exigidos 10 → cumple; importe 115 %. Pago del vehículo, 10 pagos significativos de 10, exigidos 10 → cumple; importe 103 %.

**Criterio que solo advierte** (no bloquea):

5. Millas mensuales promedio inferiores al 40 % de la meta de Configuración → aviso: "Rodaste bastante menos de lo previsto; revisa si hay cargas sin registrar o actualiza tu meta de millas".

**Información que se muestra siempre** (no es aviso): millas reales por mes frente a la meta de Configuración (Ricardo: 6,249 frente a 9,000, 69 %). Explica por qué el CPM de Configuración difiere del real.

Los porcentajes de esta sección son **umbrales técnicos provisionales** (§11.4).

### 4.3. Cálculo

```text
cpmBase real = (gastos del periodo − peajes − combustible) / millas del periodo
             + combustible de los 3 últimos meses activos / millas de esos meses
```

Combustible reciente con dos protecciones (ya implementadas): si esos 3 meses tienen < 1,000 mi, o el resultado es menor que la mitad del promedio largo, se usa el periodo completo.

### 4.4. Elección del conductor y regla de no bajar

**Regla general (aprobada, decisión 7): el sistema nunca reduce el CPM por su cuenta. Cualquier cambio automático de fuente solo puede mantenerlo o subirlo; cualquier bajada requiere que el conductor la confirme.**

1. Al pasar los criterios de §4.2 por primera vez, la app muestra ambos CPM con su desglose, **recomienda** el más representativo y pide elegir.
2. **Mientras no elija**, se usa `máximo(CPM real confiable, CPM de Configuración)`, rotulado "provisional — elige tu fuente".
3. La elección se guarda (`users/{uid}.cpmPreference = { fuente, fecha, cpmConfig, cpmReal }`) y **no cambia sola**. Se vuelve a preguntar solo si:
   - la diferencia entre ambos cambia más de 15 % respecto al momento de la elección, o
   - el CPM real deja de cumplir los criterios que bloquean (§4.5), o
   - el conductor lo pide desde Configuración.
4. Si el conductor eligió el **CPM real**, su valor evoluciona con sus datos (sube o baja): fue su elección. Lo protege el aviso de cambio > 15 % del punto 3.
5. La pantalla indica **siempre** qué fuente se usa y desde cuándo.
6. **Trazabilidad:** cada cambio de fuente o de valor se guarda (`cpmHistory`: fecha, valor anterior, valor nuevo, motivo, automático/conductor).

### 4.5. Pérdida de confiabilidad y vencimiento

Si el conductor eligió el CPM real y su historial deja de cumplir los criterios que bloquean:

1. La app **lo advierte** de forma visible y explica qué criterio falló.
2. Usa como **referencia temporal** `máximo(último CPM real confiable, CPM de Configuración)`, con el último CPM real **congelado con su fecha**, rotulado: "Referencia temporal: $X/mi (tu costo real al [fecha]). Tu historial actual no es confiable por: [motivo]".
3. **No cambia la elección guardada**: cuando el historial vuelve a ser confiable, se retoma el CPM real y se avisa.
4. **Vencimiento:** pasados 6 meses (umbral provisional), la referencia **mantiene su valor**, se rotula "Referencia vencida desde [fecha] — puede no reflejar tus costos actuales" y la app pide revisión en cada sesión, con tres opciones: actualizar la Configuración, mantener el valor, o pasar al CPM de Configuración. **Nunca baja sola.**
5. Mientras dure, el semáforo muestra la etiqueta "referencia temporal" o "referencia vencida".

### 4.6. Antigüedad del CPM real (decisión 9)

Un CPM real calculado con datos antiguos **no se presenta como costo actual confirmado**.

- **Antigüedad** = meses entre el último mes del periodo confiable (§4.2) y el mes en curso.
- Siempre se muestra: "Basado en tus gastos hasta [mes] ([n] meses)".
- Si la antigüedad supera **6 meses** (umbral provisional), se rotula "Datos antiguos — puede no reflejar tus costos actuales" y la app pide revisión, con las mismas tres opciones y la misma regla que la referencia vencida de §4.5: el valor se conserva y **nunca baja solo**.
- Caso de Ricardo hoy: último periodo confiable marzo de 2026, antigüedad 8 meses → "Datos antiguos".

## 5. Peajes (decisión 3 de Ricardo)

Los peajes dependen de la ruta: no se presuponen.

| Situación | Peaje estimado de la carga | Finanzas |
|---|---|---|
| El conductor escribe un toll en la calculadora | Ese valor (gasto estimado de esa carga) | Nada |
| Campo vacío | **$0**. No se presupone ningún peaje | Nada |
| El conductor sube el recibo en Finanzas | No afecta a la carga ya evaluada | Gasto real en la categoría Peajes |

- **No hay promedio histórico de peajes** ni casilla "Ruta sin peajes" (sustituye la propuesta de la revisión 3).
- El CPM base **excluye siempre la categoría Peajes**: dependen de la ruta y no deben repartirse entre todas las cargas.
- Consecuencia aceptada: en una ruta con peajes que no se escriban, la ganancia estimada será algo mayor que la real (con los datos de Ricardo, sus peajes promedian $0.011/mi, unos $7 en una carga de 680 mi).

## 6. Candidatos a gasto extraordinario (decisiones 2 y 11)

Se **señalan para revisión**, no se clasifican ni se excluyen automáticamente. Un gasto es **candidato** si cumple todas las condiciones aplicables:

1. **Categoría elegible:** nunca son candidatos el **combustible** (se registra como total mensual y varía por naturaleza) ni los **peajes** (excluidos del CPM, §5).
2. **Materialidad:** importe ≥ 5 % del total de gastos del periodo de §4.2.
3. **Atípico en su categoría:** si la categoría tiene ≥ 3 movimientos en el periodo, importe ≥ 2 × la mediana de esa categoría. Con menos de 3 movimientos, solo se aplica la materialidad.

Tratamiento:

- Aparece en el desglose como "Candidato a revisión", con su fecha, importe y descripción.
- **No se modifica el asiento original.**
- **Solo si el conductor lo marca** expresamente como "no recurrente" desde Finanzas, se reparte en 12 meses dentro del CPM. Sin esa acción, cuenta entero en su mes.

**Validación con los datos de Ricardo:** la regla de la revisión 5 marcaba 5 movimientos (dos pagos del vehículo atrasados o acumulados, dos totales mensuales de combustible y un seguro): 4 falsos positivos. La regla actual marca **1**: el seguro de **$2,705.03 del 11-09-2025** ("Pago seguro comercial + pago nuevo seguro"), ≥ $2,534 (5 %) y ≥ $2,520 (2 × mediana $1,260). Por la **decisión #11**, queda solo como candidato a revisión: no se reclasifica, no se modifica y no se redistribuye sin acción expresa de Ricardo.

Los umbrales (5 %, 3 movimientos, 2 × mediana) son **provisionales** (§11.4).

## 7. Decisión: umbrales, sueldo y Lex

Solo en etapas B y C (con configuración mínima).

### 7.1. Umbrales

Todos los RPM sobre **millas totales**.

```text
umbralCostos    = cpmBase + peajeEstimado / millasTotales

objetivoSueldo  = umbralCostos + sueldoCarga / millasTotales     (solo si hay sueldo)
objetivoMargen  = umbralCostos / (1 − margenObjetivo)
umbralObjetivo  = máximo(objetivoSueldo, objetivoMargen)         (sin sueldo: objetivoMargen)
```

| Resultado | Condición |
|---|---|
| **Rechazar** | `rpmTotal < umbralCostos` (pierde dinero) |
| **Evaluar / Casi aceptar** | Cubre costos pero no cumple alguna de las dos condiciones de "Aceptar" |
| **Aceptar** | `rpmTotal ≥ umbralObjetivo` **y** `rpmTarifa ≥ rpmMinimo` |

- **Rentabilidad contra RPM total:** los Extras confirmados son dinero real y ya están en la ganancia estimada.
- **RPM mínimo contra RPM de tarifa:** es un piso de negociación sobre lo que paga el broker, y no depende de Extras.
- **Máximo, no suma:** el sueldo y el margen no se acumulan; se aplica el más exigente y la pantalla indica cuál ("objetivo por sueldo" u "objetivo por margen").
- `rpmMinimo` es el campo de Configuración hoy etiquetado "RPM Mínimo" (guardado como `targetRPM`); hoy **no** lo usa el semáforo.
- El promedio histórico de RPM del conductor sigue elevando el umbral de aceptar como hoy.
- Las **excepciones estratégicas** (salir de una zona trampa, reposicionarse hacia una zona premium) no rebajan el umbral: se muestran como una recomendación aparte y explícita.

### 7.2. Sueldo por día

- El sueldo configurado es **bruto, antes de impuestos** (decisión aprobada). El formulario debe indicarlo así.
- `sueldoPorDia = sueldo mensual / días de trabajo al mes` (22 por defecto).
- `diasCarga = máximo(1, horas reales / horas de manejo por día)`, horas reales = duración de Google + 30 min por parada de combustible (si la velocidad resultante está entre 35 y 80 mph; si no, la estimación interna).
- La métrica "ganancia estimada por día" usa **el mismo** `diasCarga` (hoy usa otro redondeo).

### 7.3. Lex AI

Recibe el `resultado` y los `umbrales` de §3 y §7.1 y solo los explica. No calcula CPM ni umbrales propios. En etapa A, Lex indica que falta la configuración mínima y no da veredicto. Hoy `response-builders.js` usa un `minRPM` fijo de $0.85 y `lex-ai-engine.js` reconstruye umbrales: ambos deben pasar a usar estos datos.

### 7.4. Contraoferta

La tarifa a pedir debe cumplir **ambos** requisitos de "Aceptar", descontando solo los Extras **confirmados**:

```text
tarifaPorObjetivo = umbralObjetivo × millasTotales − extrasConfirmados
tarifaPorMinimo   = rpmMinimo × millasTotales
tarifaObjetivo    = máximo(tarifaPorObjetivo, tarifaPorMinimo)
tarifaEquilibrio  = máximo(umbralCostos × millasTotales − extrasConfirmados, 0)
contraoferta      = tarifaObjetivo × (1 + margenNegociacion)
```

- `margenNegociacion` es **configurable por cada conductor**, con **8 %** inicial (decisión #10). Es una preferencia de negociación: está separado del margen de rentabilidad (`margenObjetivo`), del RPM mínimo y de los costos. No afecta al veredicto de aceptar o rechazar, solo a la cifra de contraoferta sugerida.

- Los Extras no confirmados **no** reducen la tarifa a pedir.
- Todos los importes del bloque "Acción sugerida" son **tarifa** (lo que se negocia con el broker), y así se rotulan.

## 8. Cargas antiguas (decisión 4)

- Una carga guardada **conserva su ganancia estimada y supuestos originales**. Cambiar el CPM o la Configuración no la modifica.
- Al **editar**:
  - si solo cambian texto, compañía, notas o fecha: no se recalcula nada;
  - si cambian tarifa, extras, toll o millas **y la carga tiene snapshot**: se recalcula con los **supuestos guardados en la carga**;
  - si cambian tarifa, extras, toll o millas **y la carga no tiene snapshot**: **no se reconstruye ni se infiere el CPM original**. La app avisa: "Esta carga no guarda los costos con que se calculó. Se recalculará con tus costos actuales ($X/mi)". Requiere confirmación y se registra (`recalculatedAt`, `cpmFuente`, `formulaVersion`; se crea el snapshot a partir de ese momento).
- Botón **"Recalcular"** en Historial (texto corto, decisión de Ricardo) para actualizar a propósito una carga con los costos actuales. Pide confirmación explicando que usará los costos de hoy, y queda registrado igual que arriba.
- Registrar un pago, un abono o un Extra cobrado **no** recalcula la ganancia estimada (§3.4).
- Lectura tolerante de campos antiguos (`miles`, `loaded`, `deadhead`, `rate`, `totalCost`), sin reescribirlos.
- **Ninguna migración masiva** que reescriba cargas.

## 9. Configuración y unidades

- **Configuración mínima** (§4.1): pago del vehículo (**$0 válido**), seguro, MPG, precio de combustible, millas al mes. Después se ofrecen mantenimiento, llantas, reparaciones y otros fijos.
- Mantenimiento, llantas y reparaciones: el formulario dice "Mensual ($)" y así se calculan.
- Configuraciones antiguas con valores < $1 en esos campos: **no convertir en silencio**. Aviso en Configuración y en la calculadora: "¿Estos valores son por milla o por mes?", y se guarda según la respuesta.
- **Caso de Ricardo (decisión 6): sus valores 0.014 / 0.012 / 0.025 son dólares por milla** (≈ $0.051/mi en total). Equivalente mensual con su meta de 9,000 mi: $126 / $108 / $225. La corrección de su Configuración se aplica **con su confirmación** en la implementación, mediante el mismo aviso.
- No hay promedio de industria para decidir (decisión 5). El formulario no viene relleno con costos de ejemplo.
- El campo de sueldo indica "bruto, antes de impuestos" (§7.2).
- Nuevo campo "Margen de negociación (%)" para la contraoferta, 8 % por defecto (§7.4, decisión #10).
- `isEstablishedUser()` debe considerar "configuración mínima completa", no solo antigüedad de la cuenta.

## 10. Plan de pruebas

### 10.1. Unitarias (función pura, Node)

Reutilizar y ampliar el prototipo de ChatGPT (`financial-engine.test.mjs`, 11 pruebas) y las simulaciones de Claude (10 casos de CPM):

- Extras confirmados y no confirmados; toll escrito; toll vacío = $0; pérdidas negativas.
- Sin configuración mínima: devuelve solo ingresos, millas y RPM; ni ganancia ni veredicto.
- Pago del vehículo $0 con el resto completo: configuración mínima válida.
- RPM total vs RPM de tarifa: carga que cumple el objetivo solo gracias a Extras confirmados pero no el RPM mínimo de tarifa → no "Aceptar".
- Objetivo por sueldo vs por margen: cada uno ganando por separado; sin sueldo.
- Contraoferta: con y sin Extras confirmados; cuando manda el RPM mínimo; Extras no confirmados no la reducen.
- Valores 0 en Configuración respetados.
- Etapas A, B, C; cada criterio que bloquea de §4.2 fallando por separado; el criterio 5 solo produce aviso.
- Combustible por encima de 1.5× y por debajo de 0.5× del esperado.
- Pausa larga, carga suelta tras pausa, mes de pausa intermedio.
- **Meses incompletos (decisión 9):**
  - mes en curso excluido aunque esté completo;
  - un mes final incompleto excluido (millas y gastos), con nota de último periodo confiable;
  - varios meses finales incompletos consecutivos excluidos;
  - mes final con combustible pero < 0.5× el esperado → incompleto;
  - mes intermedio incompleto → bloquea;
  - tras excluir quedan < 3 meses con actividad → no confiable;
  - los registros originales no se modifican.
- **Antigüedad (§4.6):** datos de hace ≤ 6 meses → "Basado en tus gastos hasta…"; > 6 meses → "Datos antiguos", pide revisión, no baja; usuario cuya actividad terminó hace meses.
- **Cobertura de fijos:** cumple por número de pagos aunque falle por importe (póliza nueva más cara); cumple por importe con pagos acumulados; pagos muy pequeños no cuentan como pago significativo; pago del vehículo $0 no se exige; mes de pausa cuenta.
- CPM real excluye la categoría Peajes.
- **Regla de no bajar:** en ningún camino automático (sin elección, pérdida de confiabilidad, vencimiento) el CPM aplicado baja sin confirmación.
- **Candidatos a extraordinario:** combustible y peajes nunca son candidatos; categoría con ≥ 3 movimientos y gasto ≥ 5 % y ≥ 2 × mediana → candidato; ≥ 5 % pero < 2 × mediana → no; categoría con < 3 movimientos → solo materialidad; pagos acumulados de vehículo → no; candidato sin marcar → cuenta entero, asiento intacto; marcado como no recurrente → repartido en 12 meses.
- **Margen de negociación (decisión 10):** valor configurado distinto de 8 %; 0 %; no altera el veredicto ni el margen objetivo.
- Pagos: pago total, pago parcial (estado y pendiente correctos, sin `actualPaymentDate`), varios abonos hasta completar, sobrepago, incobrable; ninguno cambia la ganancia estimada.
- Carga antigua con `actualPaymentDate` y sin abonos: se lee como un abono único.
- Edición de carga sin snapshot: no infiere CPM, pide confirmación.

### 10.2. Integración en navegador (Chrome sin ventana, como la prueba del PDF)

Con datos de prueba en un proyecto/emulador, **nunca** con datos reales:

1. Usuario sin configuración mínima → calculadora sin ganancia ni semáforo.
2. Completar configuración mínima → calcular → el panel muestra X ("estimada").
3. Guardar → la carga guardada tiene exactamente X y su snapshot.
4. Editar solo notas → X no cambia.
5. Editar millas → recalcula con los supuestos guardados.
6. Editar millas de una carga sin snapshot → aviso y confirmación.
7. Botón "Recalcular" → confirmación y registro.
8. Historial, Zonas y reportes muestran X.
9. Cambiar el CPM en Configuración → las cargas anteriores siguen en X.
10. Registrar pago parcial → Cuentas muestra el pendiente; flujo de caja usa el abono en su fecha; X no cambia.
11. **Sin conexión**: guardar, recuperar conexión, sincronizar → la carga sincronizada tiene X.
12. Lex recibe X y los mismos umbrales.

### 10.3. Datos reales (solo lectura)

Con las 112 cargas de Ricardo (CSV) y la exportación de sus 80 gastos, **dos validaciones distintas**:

**A. Validación contable** (¿el motor lee los mismos datos que Finanzas?)
- Para el mismo rango de fechas, el total de gastos y el total por categoría del periodo de §4.2 coinciden con el reporte de Finanzas.
- Número de cargas y millas totales coinciden.
- Referencia actual: $50,671.32 / 112 cargas / 68,736 mi.

**B. Validación del CPM** (¿el número de decisión sale bien de esos datos?)
- El CPM base **no** tiene por qué reproducir `gastos totales ÷ millas`, porque excluye peajes y usa combustible reciente. Se comprueba que sea **reproducible desde el desglose**:
  `(gastos del periodo − peajes − combustible) / millas del periodo + combustible reciente / millas recientes`.
- Identidad de control: con combustible del periodo completo y peajes incluidos, el resultado debe igualar `gastos totales ÷ millas` (~$0.737 en los datos de Ricardo).
- Aplicar los umbrales provisionales de §11.4 y revisar uno a uno los casos que marcan (meses activos, combustible esperado, gastos extraordinarios) para validarlos.

**Resultados de la validación (13-11-2026)**, reproducidos de forma independiente por Claude y ChatGPT con la exportación de Finanzas:

| Dato | Valor |
|---|---|
| Cargas / gastos | 112 / 80 |
| Ingresos / gastos | $67,278.00 / $50,671.32 |
| Millas | 68,736.15 |
| CPM contable (todo) | $0.73719/mi |
| Peajes | $776.55 |
| CPM sin peajes, combustible del periodo completo (con abril) | $0.72589/mi |
| CPM con combustible reciente (con abril) | $0.72930/mi |
| CPM con combustible reciente **sin abril de 2026** (regla §4.2) | **$0.76412/mi** |
| Combustible por milla vs esperado | $0.224 vs $0.1995 (1.12×, dentro de banda) |
| Millas por mes activo vs meta | 6,248.74 vs 9,000 (69 %, sin aviso) |
| Candidatos a extraordinario | 1 (seguro $2,705.03, 11-09-2025) |

No validables con esta exportación: re-preguntar con cambio > 15 % y vigencia de 6 meses (requieren historial a lo largo del tiempo).

## 11. Decisiones

### 11.1. Aprobadas por Ricardo

| Decisión | Contenido |
|---|---|
| A | CPM real como referencia principal cuando es confiable, mostrando también el de Configuración, con elección del conductor recordada (§4.4) |
| B | Exigir el RPM mínimo además del objetivo (§7.1) |
| C | Confirmar unidades de mantenimiento sin conversión silenciosa (§9) |
| D | Peajes separados del CPM base (§5) |
| E | Conservar el resultado original de las cargas antiguas (§8) |
| F | RPM mínimo sobre millas totales (cargadas + deadhead) |
| G | Sueldo bruto, antes de impuestos |
| 1 | Criterios de confianza del CPM real (§4.2) |
| 2 | Gastos no recurrentes: se reparten en 12 meses **solo si el conductor los marca** (§6) |
| 3 | Peajes solo si se escriben en la calculadora; vacío = $0; el gasto real solo al subir el recibo en Finanzas; sin promedio histórico ni casilla (§5) |
| 4 | Botón "Recalcular" en Historial (§8) |
| 5 | El costo para decidir sale siempre de la configuración del conductor; sin promedio de industria (§4.1) |
| 6 | Los valores de mantenimiento de Ricardo son dólares por milla (§9) |
| 7 | Referencia segura = máximo entre el último CPM real confiable y el de Configuración; el CPM nunca baja automáticamente (§4.4, §4.5) |
| 8 | Usuario sin configuración mínima: opción (a). Se muestran tarifa, millas cargadas, deadhead y RPM; no se muestran ganancia estimada, semáforo ni contraoferta; se le invita a completar los cinco datos (pago del vehículo $0 válido); sin promedios de industria (§4.1) |
| 9 | **Meses incompletos:** se excluyen del CPM los meses finales incompletos (millas y gastos juntos), sin modificar registros; se distingue mes en curso, meses finales históricos incompletos y meses intermedios incompletos (que bloquean); se muestra el último periodo confiable y se advierte de datos antiguos; un CPM histórico antiguo no se presenta como costo actual confirmado (§4.2, §4.6) |
| 10 | **Margen de negociación** de la contraoferta configurable por conductor, 8 % inicial, separado del margen de rentabilidad, del RPM mínimo y de los costos (§7.4) |
| 11 | **Seguro de $2,705.03 del 11-09-2025:** solo candidato a revisión; no se clasifica como extraordinario, no se modifica el asiento ni se redistribuye sin acción expresa del conductor (§6) |

### 11.2. Reglas técnicas cerradas (Claude y ChatGPT)

Reglas de diseño acordadas en la revisión cruzada que no expresan una preferencia del propietario:

1. RPM total para rentabilidad y RPM de tarifa para el mínimo (§7.1); contraoferta con ambos requisitos y solo Extras confirmados (§7.4); objetivo = máximo entre sueldo y margen (§7.1).
2. Sin reconstrucción de CPM en cargas sin snapshot (§8).
3. Criterio de millas como advertencia; control de combustible aproximado (§4.2).
4. Contratado / facturado / cobrado con pagos parciales (§3.4); ganancia rotulada siempre como estimada.
5. Mes en curso siempre excluido; mes intermedio incompleto bloquea (§4.2).
6. Cobertura de fijos global, por número de pagos significativos **o** por importe (§4.2).
7. Combustible y peajes nunca son candidatos a extraordinario (§6).
8. Millas reales frente a la meta se muestran siempre como información (§4.2).
9. La antigüedad del CPM real se trata con la misma regla que la referencia vencida (§4.6, §4.5).

### 11.3. Pendientes (sin aprobar)

| Tema | Estado |
|---|---|
| **Sobrepagos:** ¿saldo a favor del cliente, ingreso adicional o importe a devolver? (§3.4) | Pendiente de precisar |
| **Método fiscal** (devengado o lo cobrado) para el reporte Schedule C | Verificar con el contador de Ricardo (§3.4); no es decisión técnica |

### 11.4. Umbrales técnicos provisionales

No son decisiones aprobadas: son valores iniciales a confirmar con datos.

| Umbral | Valor provisional | Dónde | Validación |
|---|---|---|---|
| Mes con actividad | ≥ 25 % de la mediana mensual, mínimo 300 mi | §4.2 | Probado con datos de Ricardo (1,618 mi; 11 meses) |
| Mes incompleto por combustible bajo | < 0.5× el esperado | §4.2 | Probado (ningún mes completo cae por debajo) |
| Banda de combustible del periodo | 0.5× – 1.5× de precio/MPG | §4.2 criterio 3 | Probado (1.12×) |
| Mínimo de meses tras exclusiones | 3 | §4.2 | Pendiente de casos límite |
| Pago significativo de un gasto fijo | ≥ 50 % del importe mensual configurado (o de la mediana) | §4.2 criterio 4 | Probado (excluye el pago de $24.88) |
| Cobertura de fijos por importe | ≥ 80 % de lo esperado | §4.2 criterio 4 | Probado (115 % / 103 %) |
| Advertencia de millas | < 40 % de la meta | §4.2 criterio 5 | Probado (69 %, sin aviso) |
| Candidato a extraordinario | ≥ 5 % del total; con ≥ 3 movimientos, ≥ 2 × mediana | §6 | Probado (1 candidato frente a 5 de la regla anterior) |
| Re-preguntar elección de CPM | cambio > 15 % | §4.4 | Requiere historial en el tiempo |
| Vigencia / antigüedad | 6 meses | §4.5, §4.6 | Requiere historial en el tiempo |

El margen de negociación del 8 % **ya no es un umbral técnico**: es el valor inicial configurable aprobado en la decisión #10.

## 12. Problemas conocidos fuera del motor (registrados)

1. **3 pruebas fallando en `functions/test-admin.js`** ("3 pagos en Firestore", "totalPaid…", "failedPaymentsCount…"). Causa: desde el commit `f86d2cf` `adminGetUserDetail` lee los pagos de la API de Stripe (`stripe.charges.list`), pero la prueba sigue simulando pagos en Firestore. El código es correcto; la prueba está desactualizada. Relacionado: `adminGetBillingOverview` sigue leyendo `collectionGroup('payments')`, que no se llena, así que sus totales pueden salir en $0.
2. Dos cargas con RPM exportado distinto de tarifa/millas (Freight Alliance #24035, Empire #531198). Hipótesis: la versión anterior de `saveLoad()` guardaba `totalCharge = tarifa + tolls + otros`. No verificado.
3. Agrupación de nombres de compañías en reportes.
4. `evaluateLoad` (Cloud Function) no tiene llamadas: código muerto.
5. Clave de OpenRouter pendiente de rotar (estuvo expuesta antes del 12-11-2026).
6. Flujo de caja agrupa los cobros por fecha de carga y no por fecha de cobro (se corrige con §3.4).
7. La exportación CSV de Finanzas (`exportFinancialData()` en `finances.js`, que incluye cargas y gastos) no tiene botón: el código espera un elemento `exportBtn` que no existe en `app.html`. Solo se puede ejecutar desde la consola del navegador.

## 13. Fases de implementación (tras aprobación)

1. Función pura + pruebas unitarias (sin tocar pantallas).
2. Configuración mínima y etapa A (§4.1, §9); calculadora, panel y guardado (online y sin conexión) usando la función.
3. Historial (§8), botón "Recalcular", y reportes estimados.
4. Contratado / facturado / cobrado con pagos parciales (§3.4) en Historial, Cuentas y flujo de caja.
5. Resolución del CPM (§4) con la elección del conductor, la regla de no bajar y la referencia temporal (§4.5).
6. Peajes (§5), Extras confirmados (§2) y gastos extraordinarios (§6).
7. Lex (§7.3).
8. Pruebas de integración (§10.2) y verificación con datos reales (§10.3).
9. Vista previa → revisión de Ricardo → producción.

Cada fase: un commit, pruebas en verde, sin desplegar a producción hasta la fase 9.
