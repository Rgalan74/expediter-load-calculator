/* Correos de Smart Load Solution (ES/EN), un solo diseño navy + cyan.
   Cada builder devuelve { subject, html }. HTML con tablas y estilos en línea
   para que se vea bien en Gmail, Outlook y Apple Mail. */
'use strict';

const SITE = 'https://smartloadsolution.com';
const SUPPORT = 'support@smartloadsolution.com';
const C = { bg: '#060b16', card: '#0b1526', line: '#1e293b', cyan: '#22D3EE', ink: '#06101c', txt: '#cbd5e1', mut: '#94a3b8', white: '#ffffff', red: '#f87171', green: '#34d399' };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isEn = (lang) => lang === 'en';
const url = (lang, es, en) => SITE + (isEn(lang) ? en : es);

// Beneficios de cada plan (iguales a la página de Planes)
const PLANES = {
  free: {
    es: ['30 cargas al mes', 'Calculadora de RPM real con veredicto', 'Peajes de la ruta y mapa de zonas', 'Historial de 30 días', 'Academia: módulos 1 a 3'],
    en: ['30 loads a month', 'Real RPM calculator with verdict', 'Route tolls and zone map', '30-day history', 'Academy: modules 1 to 3'],
  },
  professional: {
    name: 'Professional', price: '14.99',
    es: ['Cargas ilimitadas', 'Lex AI: 10 mensajes al día', 'Finanzas completas y cuentas por cobrar', 'Reportes en PDF y exportar a Excel/CSV', 'Historial de 90 días', 'Academia: módulos 1 a 6'],
    en: ['Unlimited loads', 'Lex AI: 10 messages a day', 'Full finances and receivables', 'PDF reports and Excel/CSV export', '90-day history', 'Academy: modules 1 to 6'],
  },
  premium: {
    name: 'Premium + AI', price: '29.99',
    es: ['Todo lo de Professional', 'Lex AI: 150 mensajes al día', 'Historial ilimitado', 'Reporte de impuestos (Schedule C)', 'Academia completa: módulos 1 a 8', 'Soporte prioritario'],
    en: ['Everything in Professional', 'Lex AI: 150 messages a day', 'Unlimited history', 'Tax report (Schedule C)', 'Full Academy: modules 1 to 8', 'Priority support'],
  },
};
// Lo que se pierde al bajar de plan
const PIERDE = {
  premiumToPro: {
    es: ['Lex AI pasa de 150 a 10 mensajes al día', 'El historial pasa de ilimitado a 90 días', 'Reporte de impuestos (Schedule C)', 'Academia: módulos 7 y 8', 'Soporte prioritario'],
    en: ['Lex AI goes from 150 to 10 messages a day', 'History goes from unlimited to 90 days', 'Tax report (Schedule C)', 'Academy: modules 7 and 8', 'Priority support'],
  },
  professional: {
    es: ['Cargas ilimitadas (vuelves a 30 al mes)', 'Lex AI', 'Finanzas completas y cuentas por cobrar', 'Reportes en PDF y exportar a Excel/CSV', 'Historial de 90 días (vuelves a 30)', 'Academia: módulos 4 a 6'],
    en: ['Unlimited loads (back to 30 a month)', 'Lex AI', 'Full finances and receivables', 'PDF reports and Excel/CSV export', '90-day history (back to 30)', 'Academy: modules 4 to 6'],
  },
  premium: {
    es: ['Cargas ilimitadas (vuelves a 30 al mes)', 'Lex AI (150 mensajes al día)', 'Finanzas completas, reportes y exportar', 'Historial ilimitado (vuelves a 30 días)', 'Reporte de impuestos (Schedule C)', 'Academia: módulos 4 a 8'],
    en: ['Unlimited loads (back to 30 a month)', 'Lex AI (150 messages a day)', 'Full finances, reports and export', 'Unlimited history (back to 30 days)', 'Tax report (Schedule C)', 'Academy: modules 4 to 8'],
  },
};

function lista(items, icon, color) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">${items.map((t) =>
    `<tr><td width="26" valign="top" style="padding:5px 0;color:${color};font-size:15px;font-weight:700;">${icon}</td><td style="padding:5px 0;color:${C.txt};font-size:15px;line-height:1.5;">${esc(t)}</td></tr>`).join('')}</table>`;
}
function caja(titulo, contenido, color) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${C.bg};border:1px solid ${C.line};border-radius:12px;"><tr><td style="padding:16px 18px;">
    ${titulo ? `<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800;color:${color || C.cyan};margin-bottom:6px;">${esc(titulo)}</div>` : ''}${contenido}</td></tr></table>`;
}
function boton(texto, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 6px;"><tr><td style="background:${C.cyan};border-radius:10px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:800;color:${C.ink};text-decoration:none;">${esc(texto)}</a></td></tr></table>`;
}
function enlace(texto, href) {
  return `<p style="text-align:center;margin:10px 0 0;"><a href="${href}" style="color:${C.cyan};font-size:14px;font-weight:700;text-decoration:none;">${esc(texto)}</a></p>`;
}
function p(t) { return `<p style="margin:0 0 14px;color:${C.txt};font-size:15px;line-height:1.6;">${t}</p>`; }

function layout(lang, { preheader, titulo, cuerpo, motivo }) {
  const en = isEn(lang);
  return `<!DOCTYPE html><html lang="${en ? 'en' : 'es'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:${C.card};border:1px solid ${C.line};border-radius:16px;">
  <tr><td style="padding:22px 28px;border-bottom:2px solid ${C.cyan};">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;"><img src="${SITE}/img/logo-app.png" width="36" height="36" alt="" style="display:block;border-radius:8px;"></td>
      <td style="font-size:18px;font-weight:800;color:${C.white};">Smart Load Solution</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 28px 24px;">
    <h1 style="margin:0 0 14px;font-size:23px;line-height:1.3;color:${C.white};font-weight:800;">${titulo}</h1>
    ${cuerpo}
  </td></tr>
  <tr><td style="padding:18px 28px 24px;border-top:1px solid ${C.line};">
    <p style="margin:0 0 6px;color:${C.mut};font-size:12px;line-height:1.6;text-align:center;">Smart Load Solution · <a href="${SITE}${en ? '/en/' : '/'}" style="color:${C.mut};">smartloadsolution.com</a> · <a href="mailto:${SUPPORT}" style="color:${C.mut};">${SUPPORT}</a></p>
    <p style="margin:0;color:#64748b;font-size:11.5px;line-height:1.5;text-align:center;">${esc(motivo)}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const M = {
  es: { cuenta: 'Recibiste este correo porque tienes una cuenta en Smart Load Solution.', sub: 'Recibiste este correo por tu suscripción a Smart Load Solution.' },
  en: { cuenta: 'You received this email because you have a Smart Load Solution account.', sub: 'You received this email because of your Smart Load Solution subscription.' },
};

// 1) Bienvenida al crear la cuenta
function welcome(lang, nombre) {
  const en = isEn(lang); const n = String(nombre || '').trim().split(/\s+/)[0];
  const pasos = en
    ? [['1', 'Set up your costs', 'Van payment, insurance, maintenance and the miles you run each month. That is how the app knows your real cost per mile.'],
       ['2', 'Evaluate your first load', 'Enter origin, destination and the pay. The app gets the miles, the fuel price on the route and the tolls, and gives you the verdict.'],
       ['3', 'Try Lex AI', 'You have 14 days free to ask Lex about your loads and how to negotiate them.']]
    : [['1', 'Configura tus costos', 'Pago de la van, seguro, mantenimiento y las millas que haces al mes. Así la app sabe tu costo real por milla.'],
       ['2', 'Evalúa tu primera carga', 'Escribe origen, destino y lo que te pagan. La app saca las millas, la gasolina de la ruta y los peajes, y te da el veredicto.'],
       ['3', 'Prueba Lex AI', 'Tienes 14 días gratis para preguntarle a Lex por tus cargas y cómo negociarlas.']];
  const filas = pasos.map(([k, t, d]) => `<tr><td width="38" valign="top" style="padding:8px 0;"><div style="width:28px;height:28px;border-radius:8px;background:rgba(34,211,238,.14);color:${C.cyan};font-weight:900;text-align:center;line-height:28px;">${k}</div></td>
    <td style="padding:8px 0;"><div style="color:${C.white};font-weight:700;font-size:15px;">${t}</div><div style="color:${C.mut};font-size:14px;line-height:1.5;">${d}</div></td></tr>`).join('');
  return {
    subject: en ? 'Welcome to Smart Load Solution 🚐' : 'Bienvenido a Smart Load Solution 🚐',
    html: layout(lang, {
      preheader: en ? 'Your free account is ready. 3 steps to decide with numbers.' : 'Tu cuenta gratis está lista. 3 pasos para decidir con números.',
      titulo: en ? `Welcome${n ? ', ' + esc(n) : ''}! 👋` : `¡Bienvenido${n ? ', ' + esc(n) : ''}! 👋`,
      cuerpo: p(en ? 'Your free account is ready. In 3 steps you start deciding which loads to accept with your own numbers:' : 'Tu cuenta gratis está lista. En 3 pasos empiezas a decidir qué cargas aceptar con tus propios números:')
        + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 6px;">${filas}</table>`
        + boton(en ? 'Open the app →' : 'Abrir la app →', SITE + '/app.html')
        + enlace(en ? 'Start the free Academy (modules 1 to 3) →' : 'Empieza la Academia gratis (módulos 1 a 3) →', url(lang, '/academy.html', '/en/academy.html')),
      motivo: en ? 'You received this email because you created a Smart Load Solution account.' : 'Recibiste este correo porque creaste una cuenta en Smart Load Solution.',
    }),
  };
}

// 2) Llegó al límite de cargas del plan gratis
function loadLimit(lang, max) {
  const en = isEn(lang); const m = Number(max) || 30;
  return {
    subject: en ? `You reached your ${m} loads this month` : `Llegaste a tus ${m} cargas de este mes`,
    html: layout(lang, {
      preheader: en ? 'Your data is saved. Here is how to keep evaluating loads now.' : 'Tus datos siguen guardados. Así puedes seguir evaluando cargas ahora.',
      titulo: en ? `You used your ${m} loads this month 🚐` : `Usaste tus ${m} cargas de este mes 🚐`,
      cuerpo: p(en ? `The free plan includes ${m} loads a month. Your loads and data stay saved, and next month you get ${m} again.` : `El plan gratis incluye ${m} cargas al mes. Tus cargas y tus datos siguen guardados, y el mes que viene vuelves a tener ${m}.`)
        + p(en ? 'If you want to keep evaluating loads now, <b style="color:#fff;">Professional</b> gives you, for $14.99 a month:' : 'Si quieres seguir evaluando cargas ahora, <b style="color:#fff;">Professional</b> te da, por $14.99 al mes:')
        + caja('', lista(PLANES.professional[en ? 'en' : 'es'], '✓', C.cyan))
        + boton(en ? 'See plans →' : 'Ver planes →', url(lang, '/plans.html', '/en/plans.html'))
        + p(`<span style="font-size:13px;color:${C.mut};">${en ? '14-day money-back guarantee on your first payment. Cancel anytime.' : 'Garantía de 14 días en tu primer pago. Cancelas cuando quieras.'}</span>`),
      motivo: M[en ? 'en' : 'es'].cuenta,
    }),
  };
}

// 3) Plan activado (primer pago) o subida de plan
function planActivated(planId, lang) {
  const en = isEn(lang); const P = PLANES[planId] || PLANES.professional;
  return {
    subject: en ? `Your ${P.name} plan is active 🎉` : `Tu plan ${P.name} está activo 🎉`,
    html: layout(lang, {
      preheader: en ? `You now have ${P.name} for $${P.price}/month.` : `Ya tienes ${P.name} por $${P.price}/mes.`,
      titulo: en ? `Welcome to ${P.name}! 🎉` : `¡Bienvenido a ${P.name}! 🎉`,
      cuerpo: p(en ? `Your payment went through and you now have ${P.name} for $${P.price} a month. This is what you get:` : `Tu pago se procesó y ya tienes ${P.name} por $${P.price} al mes. Esto es lo que incluye:`)
        + caja('', lista(P[en ? 'en' : 'es'], '✓', C.cyan))
        + boton(en ? 'Open the app →' : 'Abrir la app →', SITE + '/app.html')
        + p(`<span style="font-size:13px;color:${C.mut};">${en ? 'You can manage or cancel your subscription anytime from My Account. If it is not for you, ask for a full refund within 14 days of your first payment.' : 'Puedes gestionar o cancelar tu suscripción cuando quieras desde Mi cuenta. Si no te convence, pide el reembolso completo dentro de los 14 días de tu primer pago.'}</span>`),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 4) Bajada de plan aplicada (Premium -> Professional)
function planDowngraded(lang) {
  const en = isEn(lang);
  return {
    subject: en ? 'Your plan changed to Professional' : 'Tu plan cambió a Professional',
    html: layout(lang, {
      preheader: en ? 'You keep Lex AI (10 a day), unlimited loads and full finances.' : 'Sigues con Lex AI (10 al día), cargas ilimitadas y finanzas completas.',
      titulo: en ? 'Your plan is now Professional' : 'Tu plan ahora es Professional',
      cuerpo: p(en ? 'Your plan changed to Professional ($14.99 a month). You keep:' : 'Tu plan cambió a Professional ($14.99 al mes). Sigues teniendo:')
        + caja('', lista(PLANES.professional[en ? 'en' : 'es'], '✓', C.cyan))
        + boton(en ? 'Open the app →' : 'Abrir la app →', SITE + '/app.html')
        + enlace(en ? 'Go back to Premium + AI →' : 'Volver a Premium + AI →', SITE + '/account.html'),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 5) Bajada programada (Premium -> Professional al final del periodo)
function downgradeScheduled(fecha, lang) {
  const en = isEn(lang);
  return {
    subject: en ? 'Your plan change is scheduled' : 'Tu cambio de plan está programado',
    html: layout(lang, {
      preheader: en ? `On ${fecha} your plan changes to Professional.` : `El ${fecha} tu plan pasa a Professional.`,
      titulo: en ? 'Plan change scheduled 📋' : 'Cambio de plan programado 📋',
      cuerpo: p(en ? `On <b style="color:#fff;">${esc(fecha)}</b> your plan changes from Premium + AI to Professional. Until then you keep everything in Premium.` : `El <b style="color:#fff;">${esc(fecha)}</b> tu plan pasa de Premium + AI a Professional. Hasta entonces sigues con todo lo de Premium.`)
        + caja(en ? 'What changes that day' : 'Lo que cambia ese día', lista(PIERDE.premiumToPro[en ? 'en' : 'es'], '•', '#fbbf24'), '#fbbf24')
        + p(en ? 'You keep unlimited loads, full finances, reports and Lex AI with 10 messages a day.' : 'Sigues con cargas ilimitadas, finanzas completas, reportes y Lex AI con 10 mensajes al día.')
        + boton(en ? 'Keep Premium →' : 'Mantener Premium →', SITE + '/account.html'),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 6) Cancelación programada (al final del periodo pagado)
function cancellationScheduled(fecha, planId, lang) {
  const en = isEn(lang); const lst = PIERDE[planId === 'premium' ? 'premium' : 'professional'][en ? 'en' : 'es'];
  return {
    subject: en ? 'Your subscription will end soon' : 'Tu suscripción terminará pronto',
    html: layout(lang, {
      preheader: en ? `You keep your plan until ${fecha}. Your data stays saved.` : `Sigues con tu plan hasta el ${fecha}. Tus datos se quedan guardados.`,
      titulo: en ? 'We received your cancellation' : 'Recibimos tu cancelación',
      cuerpo: p(en ? `You keep your plan until <b style="color:#fff;">${esc(fecha)}</b> and you will not be charged again. After that your account moves to the free plan and <b style="color:#fff;">your loads and data stay saved</b>.` : `Sigues con tu plan hasta el <b style="color:#fff;">${esc(fecha)}</b> y no se te volverá a cobrar. Después tu cuenta pasa al plan gratis y <b style="color:#fff;">tus cargas y datos se quedan guardados</b>.`)
        + caja(en ? 'What you lose that day' : 'Lo que pierdes ese día', lista(lst, '•', '#fbbf24'), '#fbbf24')
        + boton(en ? 'Keep my plan →' : 'Mantener mi plan →', SITE + '/account.html')
        + p(`<span style="font-size:13px;color:${C.mut};">${en ? 'Was something missing? Reply to this email or write to' : '¿Te faltó algo? Responde a este correo o escríbenos a'} <a href="mailto:${SUPPORT}" style="color:${C.cyan};">${SUPPORT}</a>. ${en ? 'We read every message.' : 'Leemos todos los mensajes.'}</span>`),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 7) Pago fallido
function paymentFailed(planId, lang) {
  const en = isEn(lang); const P = PLANES[planId] || PLANES.professional;
  return {
    subject: en ? 'We could not charge your subscription' : 'No pudimos cobrar tu suscripción',
    html: layout(lang, {
      preheader: en ? 'Update your card so you do not lose your plan.' : 'Actualiza tu tarjeta para no perder tu plan.',
      titulo: en ? 'Your payment did not go through ⚠️' : 'Tu pago no se pudo procesar ⚠️',
      cuerpo: p(en ? `Your bank declined the payment for your <b style="color:#fff;">${P.name}</b> plan. It happens: an expired card, a limit or a security block.` : `Tu banco rechazó el pago de tu plan <b style="color:#fff;">${P.name}</b>. Pasa a menudo: tarjeta vencida, límite o un bloqueo de seguridad.`)
        + p(en ? 'We will try again over the next few days. To avoid losing your plan, update your card in <b style="color:#fff;">My Account → Manage subscription</b>.' : 'Volveremos a intentarlo en los próximos días. Para no perder tu plan, actualiza tu tarjeta en <b style="color:#fff;">Mi cuenta → Gestionar suscripción</b>.')
        + boton(en ? 'Update my card →' : 'Actualizar mi tarjeta →', SITE + '/account.html')
        + p(`<span style="font-size:13px;color:${C.mut};">${en ? 'Payments are processed by Stripe. We never see or store your card.' : 'Los pagos los procesa Stripe. Nosotros nunca vemos ni guardamos tu tarjeta.'}</span>`),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 8) La suscripción terminó (pasa a gratis)
function planEnded(lang) {
  const en = isEn(lang);
  return {
    subject: en ? 'Your plan ended — your data is still here' : 'Tu plan terminó — tus datos siguen aquí',
    html: layout(lang, {
      preheader: en ? 'You are on the free plan now. Your loads and data are saved.' : 'Ahora estás en el plan gratis. Tus cargas y datos están guardados.',
      titulo: en ? 'You are now on the free plan' : 'Ahora estás en el plan gratis',
      cuerpo: p(en ? 'Your subscription ended and your account moved to Starter (free). <b style="color:#fff;">Your loads, finances and notes are still saved.</b> With the free plan you keep:' : 'Tu suscripción terminó y tu cuenta pasó a Starter (gratis). <b style="color:#fff;">Tus cargas, finanzas y notas siguen guardadas.</b> Con el plan gratis sigues teniendo:')
        + caja('', lista(PLANES.free[en ? 'en' : 'es'], '✓', C.cyan))
        + p(en ? 'Whenever you want, you can come back to Professional or Premium in one click.' : 'Cuando quieras, vuelves a Professional o Premium en un clic.')
        + boton(en ? 'See plans →' : 'Ver planes →', url(lang, '/plans.html', '/en/plans.html')),
      motivo: M[en ? 'en' : 'es'].sub,
    }),
  };
}

// 9) La prueba de Lex termina pronto
function lexTrialEnding(lang, fecha) {
  const en = isEn(lang);
  return {
    subject: en ? 'Your Lex AI trial ends in 2 days' : 'Tu prueba de Lex AI termina en 2 días',
    html: layout(lang, {
      preheader: en ? 'Keep Lex with Professional (10 a day) or Premium + AI (150 a day).' : 'Sigue con Lex en Professional (10 al día) o Premium + AI (150 al día).',
      titulo: en ? 'Your Lex AI trial ends soon 🤖' : 'Tu prueba de Lex AI termina pronto 🤖',
      cuerpo: p(en ? `Your 14 free days of Lex AI end on <b style="color:#fff;">${esc(fecha)}</b>. After that, everything else in your free plan stays the same and you will not be charged.` : `Tus 14 días gratis de Lex AI terminan el <b style="color:#fff;">${esc(fecha)}</b>. Después, todo lo demás de tu plan gratis sigue igual y no se te cobra nada.`)
        + p(en ? 'If Lex helped you analyze loads and negotiate, you can keep it:' : 'Si Lex te ayudó a analizar cargas y negociar, puedes seguir con él:')
        + caja('', lista(en ? ['Professional — $14.99/month: Lex 10 messages a day + unlimited loads', 'Premium + AI — $29.99/month: Lex 150 messages a day + everything else'] : ['Professional — $14.99/mes: Lex 10 mensajes al día + cargas ilimitadas', 'Premium + AI — $29.99/mes: Lex 150 mensajes al día + todo lo demás'], '✓', C.cyan))
        + boton(en ? 'See plans →' : 'Ver planes →', url(lang, '/plans.html', '/en/plans.html'))
        + p(`<span style="font-size:13px;color:${C.mut};">${en ? '14-day money-back guarantee on your first payment.' : 'Garantía de 14 días en tu primer pago.'}</span>`),
      motivo: M[en ? 'en' : 'es'].cuenta,
    }),
  };
}

module.exports = { welcome, loadLimit, planActivated, planDowngraded, downgradeScheduled, cancellationScheduled, paymentFailed, planEnded, lexTrialEnding, PLANES };
