# Estrategia de Email Marketing — SmartLoad Solution

**Fecha:** 2026-08-23
**Estado:** Borrador para revisión — nada de esto está implementado todavía.

> Este documento es la contraparte de negocio/contenido de
> `docs/superpowers/specs/2026-08-23-email-system-design.md` (el diseño técnico) y
> `docs/superpowers/plans/2026-08-23-email-system-fixes.md` (el plan de código para
> arreglar lo que está roto). Ese plan deja la base técnica lista (formulario de
> contacto funcionando, checkbox de consentimiento real, Brevo nombrado en la
> política de privacidad). Este documento responde una pregunta distinta: **una vez
> que la base esté sana, ¿qué secuencias de email tiene sentido construir para este
> negocio específico, y en qué orden?**

## Contexto del negocio

- Founder único (Ricardo Galán), producto: calculadora de RPM real (incluye
  deadhead) + asistente AI (Lex) + academia (8 módulos, 41 lecciones) + mapa de
  zonas rentables, para expediters de cargo van / sprinter en EE.UU.
- Planes: Starter (gratis), Professional ($14.99/mes), Premium + AI ($29.99/mes).
  Los planes pagos incluyen 14 días de prueba gratis de Lex AI.
- Sin campañas de ads pagadas activas hoy, pero planeadas a futuro (confirmado con
  Ricardo el 2026-08-22) — construir la base de email ahora es relevante porque
  cualquier campaña paga futura va a alimentar esta misma lista, y una secuencia de
  bienvenida/nurture ya lista significa que el gasto en ads convierte mejor desde el
  primer día en vez de tener que construirla apurados después.
- Dos puntos de captura de lead hoy: el modal del homepage y el formulario de la
  calculadora de RPM gratuita (`herramientas/calculadora-rpm.html`) — ambos ya
  mandan a Brevo, lista ID 2 (una vez aplicado el plan técnico, solo si el visitante
  marca el nuevo checkbox de consentimiento).
- Ya existen 3 emails transaccionales (bienvenida al registrarse, límite mensual
  alcanzado, confirmación de compra/cancelación) — funcionan, pero son reactivos,
  no una secuencia diseñada para convertir o retener.
- **Vacío confirmado:** nada le avisa a un usuario que su prueba de 14 días de Lex AI
  está por vencer o ya venció — hoy es puro texto dentro de la app
  (`public/js/lex.js:438`, "Tu trial de 14 días ha vencido"), nunca un email. Este es
  el lever de conversión más claro que existe sin construir nada nuevo desde cero —
  es agregar un trigger a un sistema que ya funciona.

## Qué NO recomiendo hacer todavía

- **Newsletter recurrente de blog.** Sin evidencia de que valga la pena para un
  founder solo — el blog ya existe y atrae tráfico orgánico (SEO) sin necesitar un
  email semanal para sostenerse. Construir y mantener contenido de newsletter
  recurrente es tiempo que compite directo con las secuencias automatizadas de abajo,
  que convierten sin esfuerzo continuo una vez armadas. Reconsiderar si en el futuro
  hay más ancho de banda (¿un asistente de marketing?) o si las campañas pagadas
  generan suficiente volumen de leads como para que valga la pena nutrirlos con
  contenido recurrente, no solo secuencias puntuales.
- **Segmentación avanzada en Brevo** (listas separadas por comportamiento, scoring
  complejo). Con el volumen actual de leads, una sola lista con 2-3 automatizaciones
  simples (ver abajo) cubre el 80% del valor. Segmentar de más ahora es
  over-engineering para el tamaño del negocio.

## Roadmap recomendado (en orden de prioridad)

### 1. Recordatorio de fin de prueba de Lex AI — *el más urgente*

**Por qué primero:** ya existe la prueba de 14 días, ya existe el campo
`lexTrialEndsAt` en Firestore, ya existe el patrón de email transaccional
(`db.collection("mail").add(...)`). Es agregar un trigger, no construir
infraestructura nueva. Es además el momento de mayor intención de compra —alguien
que probó Lex AI y le sirvió está en el punto óptimo para convertir a pago, y hoy
ese momento se pierde en silencio si el usuario no vuelve a abrir la app justo esos
días.

**Sugerencia de implementación** (a diseñar en detalle cuando se ejecute, no en este
documento): una Cloud Function programada (`onSchedule`, patrón ya usado en
`functions/index.js` si existe algo similar — verificar) que corra 1x/día, busque
usuarios con `lexTrialEndsAt` entre "mañana" y "en 3 días", y les mande un email.
Dos envíos, no uno: uno a 3 días de vencer ("te quedan 3 días, esto es lo que Lex ya
te ayudó a decidir") y uno el día que vence ("tu prueba terminó, así es como se ve
seguir con Lex AI"). El segundo es el que más convierte en productos SaaS
comparables — es la última oportunidad antes de que el usuario simplemente lo
olvide.

### 2. Secuencia de bienvenida (expandir el email único actual a 3 pasos)

**Por qué segundo:** cada usuario nuevo ya pasa por este punto, así que el ROI por
email escrito es alto (se manda para siempre, no es una campaña de una vez). Hoy
solo hay un email de bienvenida sin contenido de activación — el usuario se registra
y queda solo para descubrir la app por su cuenta.

Estructura sugerida (3 emails, espaciados):
- **Día 0 (ya existe, mejorar contenido):** bienvenida + 1 acción concreta ("calcula
  tu primera carga en 30 segundos" con link directo a la calculadora).
- **Día 2:** highlight de un valor que probablemente no descubrió solo — el mapa de
  zonas rentables o el Módulo 1 de la Academia ("El error más común calculando RPM,
  y por qué el 90% lo hace mal" — ya existe como lección, es contenido reciclado, no
  hay que escribir nada nuevo).
- **Día 6-7 (si está en plan gratis y activo):** empujón suave hacia upgrade o hacia
  la prueba de Lex AI si todavía no la activó.

### 3. Re-engagement de leads que nunca completaron el registro

**Por qué tercero:** hoy, alguien que llena el modal del homepage o el formulario de
la calculadora pero no termina de crear su cuenta simplemente queda en la lista de
Brevo sin ningún seguimiento automático. Con el checkbox de consentimiento nuevo
(plan técnico), la base de contactos que sí puede recibir esto será más chica pero
más calificada (opt-in real, no capturado a la fuerza).

Sugerencia: 1-2 emails automáticos en Brevo (workflow nativo de Brevo, no requiere
código en este repo) — a las 24-48h de capturarse el lead sin haber creado cuenta,
un recordatorio simple con el mismo gancho del modal ("¿Sabes cuánto perdiste el mes
pasado por no calcular bien el RPM?").

### 4. Win-back post-cancelación (mejora incremental, baja prioridad)

Ya existe el email de cancelación (transaccional, confirma la baja). Se podría
agregar un segundo email 30 días después ("¿qué cambió? esto es lo nuevo desde que
te fuiste"), pero es la prioridad más baja de las cuatro — el volumen de
cancelaciones probablemente es bajo dado que el negocio recién está creciendo, y el
esfuerzo relativo a los otros tres puntos no se justifica todavía.

## Cómo ejecutar esto

Cuando se decida avanzar con cualquiera de estos puntos, tratarlo como su propio
spec + plan (mismo proceso que
`docs/superpowers/specs/2026-08-23-email-system-design.md` +
`docs/superpowers/plans/2026-08-23-email-system-fixes.md`) — no meterlo en el plan
técnico de arreglos, que es sobre cerrar huecos de seguridad/cumplimiento, no sobre
construir funcionalidad nueva. El orden de prioridad de arriba es la recomendación;
la decisión de cuál construir primero (y el copy real de cada email, que este
documento deliberadamente no escribe todavía) le corresponde a Ricardo.
