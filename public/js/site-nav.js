/* Menú común de la web pública: abrir/cerrar en móvil, recordar el idioma
   elegido y mostrar "Ir a la app" si la app marcó una sesión iniciada. */
(function () {
  function init() {
    var nav = document.getElementById('slsNav');
    if (!nav) return;
    var btn = nav.querySelector('.sls-nav__burger');
    var menu = document.getElementById('slsNavMenu');
    if (btn && menu) {
      btn.addEventListener('click', function () {
        var open = menu.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) { menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
      });
    }
    nav.querySelectorAll('[data-lang]').forEach(function (a) {
      a.addEventListener('click', function () {
        try { localStorage.setItem('app_language', a.getAttribute('data-lang')); } catch (e) {}
      });
    });
    try { if (localStorage.getItem('sls_session') === '1') nav.classList.add('is-session'); } catch (e) {}
    // Si la página carga Firebase (Academia, app), preguntar directamente si hay sesión
    vigilarSesion(nav, 0);
  }

  function vigilarSesion(nav, intento) {
    var fb = window.firebase;
    if (fb && typeof fb.auth === 'function' && fb.apps && fb.apps.length) {
      try {
        fb.auth().onAuthStateChanged(function (u) {
          nav.classList.toggle('is-session', !!u);
          try { if (u) localStorage.setItem('sls_session', '1'); else localStorage.removeItem('sls_session'); } catch (e) {}
        });
      } catch (e) {}
      return;
    }
    if (intento < 20) setTimeout(function () { vigilarSesion(nav, intento + 1); }, 300);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
