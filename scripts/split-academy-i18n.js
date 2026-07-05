// scripts/split-academy-i18n.js
// Separa páginas bilingües (data-lang="es"/"en") de public/academy/
// en dos archivos limpios: ES (misma ruta) + EN (public/en/academy/...)
//
// Uso:
//   node scripts/split-academy-i18n.js --file academy/start-here/index.html   (una sola, modo prueba)
//   node scripts/split-academy-i18n.js --all                                  (las 50, después de verificar)

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { glob } = require('glob');

const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

const STRINGS = {
  es: {
    navBrandSuffix: 'Academia',
    backToApp: '← Volver a la App',
    breadcrumbAcademy: '← Academia',
    academyHref: '/academy.html',
    alertComplete: '¡Quick Win completado! 🎉 ¿Listo para corregir los otros 6 errores en el Módulo 1?',
    btnCompletedText: '✓ Completado - Ir al Módulo 1',
  },
  en: {
    navBrandSuffix: 'Academy',
    backToApp: '← Back to App',
    breadcrumbAcademy: '← Academy',
    academyHref: '/en/academy.html',
    alertComplete: 'Quick Win completed! 🎉 Ready to fix the other 6 mistakes in Module 1?',
    btnCompletedText: '✓ Completed - Go to Module 1',
  },
};

function absolutizePaths($) {
  // img, favicon
  $('link[rel="icon"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('..')) $(el).attr('href', '/img/' + path.basename(href));
  });
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && src.startsWith('..')) $(el).attr('src', '/img/' + path.basename(src));
    const onerror = $(el).attr('onerror');
    if (onerror && onerror.includes('..')) {
      $(el).attr('onerror', onerror.replace(/'\.\.[^']*\//, "'/img/"));
    }
  });
  // shared academy.js (lives at public/academy/js/academy.js)
  $('script[src*="academy.js"]').each((_, el) => {
    $(el).attr('src', '/academy/js/academy.js');
  });
  // remove language-manager.js entirely (no longer needed per-language)
  $('script[src*="language-manager.js"]').remove();
}

function stripToggleScript($) {
  $('script').each((_, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('Academy bilingual content toggle') || txt.includes('applyAcademyLang')) {
      $(el).remove();
    }
  });
}

function fixCompletionScript($, lang) {
  $('script').each((_, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('markLessonComplete')) {
      let updated = txt
        .replace(/alert\('[^']*'\)/, `alert('${STRINGS[lang].alertComplete}')`)
        .replace(/btn\.textContent = '[^']*'/, `btn.textContent = '${STRINGS[lang].btnCompletedText}'`)
        .replace(/getElementById\('markCompleteBtn[^']*'\)/g, "getElementById('markCompleteBtn')");
      $(el).html(updated);
    }
  });
  $('[id^="markCompleteBtn"]').attr('id', 'markCompleteBtn');
}

function fixShell($, lang) {
  const s = STRINGS[lang];
  $('html').attr('lang', lang);

  // Nav brand word (Academia/Academy)
  $('nav span span').each((_, el) => {
    const t = $(el).text().trim();
    if (t === 'Academia' || t === 'Academy') $(el).text(s.navBrandSuffix);
  });

  // "Back to App" button
  $('[data-i18n="academy.back_app"]')
    .removeAttr('data-i18n')
    .text(s.backToApp);

  // Breadcrumb "← Academy" / "← Academia" link
  $('.breadcrumb a').first().each((_, el) => {
    $(el).attr('href', s.academyHref).text(s.breadcrumbAcademy);
  });
}

function addHeadTags($, lang, canonicalUrl, altUrl, title) {
  $('title').text(title);
  $('head').append(`<link rel="canonical" href="${canonicalUrl}">\n`);
  $('head').append(`<link rel="alternate" hreflang="es" href="${lang === 'es' ? canonicalUrl : altUrl}">\n`);
  $('head').append(`<link rel="alternate" hreflang="en" href="${lang === 'en' ? canonicalUrl : altUrl}">\n`);
  $('head').append(`<link rel="alternate" hreflang="x-default" href="${lang === 'es' ? canonicalUrl : altUrl}">\n`);
}

function buildVersion(rawHtml, lang, relPath) {
  const $ = cheerio.load(rawHtml, { decodeEntities: false });

  // Keep only this language's block, drop the other
  const other = lang === 'es' ? 'en' : 'es';
  $(`[data-lang="${other}"]`).remove();
  $(`[data-lang="${lang}"]`).each((_, el) => {
    const $el = $(el);
    $el.replaceWith($el.html());
  });
  // Elimina comentarios HTML huerfanos tipo <!-- end data-lang="es/en" -->
  $('*').contents().filter(function() {
    return this.type === 'comment' && /data-lang/.test(this.data);
  }).remove();

  stripToggleScript($);
  absolutizePaths($);
  fixCompletionScript($, lang);
  fixShell($, lang);

  const h1 = $('h1').first().text().trim().replace(/\s+/g, ' ') || 'Smart Load Academy';
  const brand = lang === 'es' ? 'Smart Load Academia' : 'Smart Load Academy';
  const title = `${h1} | ${brand}`;

  const urlPath = lang === 'es'
    ? `/academy/${relPath.replace(/\\/g, '/')}`
    : `/en/academy/${relPath.replace(/\\/g, '/')}`;
  const canonicalUrl = `https://smartloadsolution.com${urlPath.replace(/index\.html$/, '')}`;
  const altUrlPath = lang === 'es'
    ? `/en/academy/${relPath.replace(/\\/g, '/')}`
    : `/academy/${relPath.replace(/\\/g, '/')}`;
  const altUrl = `https://smartloadsolution.com${altUrlPath.replace(/index\.html$/, '')}`;

  addHeadTags($, lang, canonicalUrl, altUrl, title);

  return $.html();
}

async function processFile(relPath) {
  const srcPath = path.join(PUBLIC_DIR, 'academy', relPath);
  const raw = fs.readFileSync(srcPath, 'utf8');
  const cleanRaw = raw.replace(/^\uFEFF/, '');

  if (!/data-lang=/.test(cleanRaw)) {
    console.log(`SKIP (ya procesado o sin data-lang): ${relPath}`);
    return;
  }

  const esHtml = buildVersion(cleanRaw, 'es', relPath);
  const enHtml = buildVersion(cleanRaw, 'en', relPath);

  // ES: overwrite in place
  fs.writeFileSync(srcPath, esHtml, 'utf8');

  // EN: write to public/en/academy/<relPath>
  const enPath = path.join(PUBLIC_DIR, 'en', 'academy', relPath);
  fs.mkdirSync(path.dirname(enPath), { recursive: true });
  fs.writeFileSync(enPath, enHtml, 'utf8');

  console.log(`OK: ${relPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  let files;

  if (args.includes('--file')) {
    const idx = args.indexOf('--file');
    const full = args[idx + 1]; // e.g. academy/start-here/index.html
    files = [path.relative(path.join(PUBLIC_DIR, 'academy'), path.join(PUBLIC_DIR, full))];
  } else if (args.includes('--all')) {
    const all = await glob('**/*.html', { cwd: path.join(PUBLIC_DIR, 'academy') });
    files = all;
  } else {
    console.error('Usa --file <ruta> o --all');
    process.exit(1);
  }

  for (const f of files) {
    await processFile(f);
  }
}

main();
