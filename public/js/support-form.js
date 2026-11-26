/* Formulario de Soporte (support.html / en/support.html).
   Antes llamaba a handleSubmit(), que no existía: el mensaje se perdía.
   Ahora usa la misma función del servidor que Contacto (sendContactMessage). */
(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyAkEYDbxkjXJx5wNh_7wMdIqmklOMCIyHY",
    authDomain: "expediter-dev.firebaseapp.com",
    projectId: "expediter-dev",
    storageBucket: "expediter-dev.appspot.com",
    messagingSenderId: "447653997176",
    appId: "1:447653997176:web:4e356867bb64b488ab5b8d"
  };
  try { if (window.firebase && !firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch (e) {}
  // Categorías del formulario -> asuntos que acepta el servidor
  var ASUNTO = { general: 'general', billing: 'billing', technical: 'support', account: 'support', feature: 'feature' };
  var EN = (document.documentElement.lang || 'es').indexOf('en') === 0;
  var T = EN ? {
    sending: 'Sending...', ok: 'Message sent! We\'ll reply within 1 to 2 business days.',
    err: 'Something went wrong. Try again or email us at support@smartloadsolution.com.',
    faltan: 'Please fill in your name, a valid email and your message.', cuenta: '[My account] '
  } : {
    sending: 'Enviando...', ok: '¡Mensaje enviado! Te respondemos en 1 a 2 días hábiles.',
    err: 'Algo salió mal. Intenta de nuevo o escríbenos a support@smartloadsolution.com.',
    faltan: 'Escribe tu nombre, un correo válido y tu mensaje.', cuenta: '[Mi cuenta] '
  };

  function mostrar(el, texto, ok) {
    if (!el) return;
    el.textContent = texto;
    el.style.display = 'block';
    el.classList.remove('hidden');
    el.style.color = ok ? '#4ade80' : '#f87171';
    el.style.background = ok ? 'rgba(74,222,128,.08)' : 'rgba(248,113,113,.08)';
  }

  window.handleSubmit = async function (e) {
    if (e) e.preventDefault();
    var $ = function (id) { return document.getElementById(id); };
    var okEl = $('formSuccess'), errEl = $('formError'), btn = $('submitBtn');
    [okEl, errEl].forEach(function (x) { if (x) { x.style.display = 'none'; } });
    var name = ($('name').value || '').trim();
    var email = ($('email').value || '').trim().toLowerCase();
    var cat = $('category').value || 'general';
    var message = ($('message').value || '').trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) { mostrar(errEl, T.faltan, false); return; }
    if (cat === 'account') message = T.cuenta + message;
    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = T.sending; }
    try {
      if (!window.firebase) throw new Error('firebase no cargó');
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      var fn = firebase.app().functions('us-central1').httpsCallable('sendContactMessage');
      var r = await fn({ name: name, email: email, subject: ASUNTO[cat] || 'general', message: message, lang: EN ? 'en' : 'es' });
      if (!(r && r.data && r.data.success)) throw new Error('sin confirmación');
      mostrar(okEl, T.ok, true);
      $('supportForm').reset();
    } catch (err) {
      if (window.console) console.error('[Soporte] Error:', err);
      mostrar(errEl, T.err, false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  };
})();
