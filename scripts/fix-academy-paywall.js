// scripts/fix-academy-paywall.js
// Agrega class="academy-pro-lock-section" y class="academy-pro-lock-badge"
// a los elementos de paywall, en ES y EN, sin depender del idioma del texto.
// Uso: node scripts/fix-academy-paywall.js --file academy/module-4/index.html
//      node scripts/fix-academy-paywall.js --all

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { glob } = require('glob');

const ROOTS = ['public/academy', 'public/en/academy'];

function fixFile(fullPath) {
  const raw = fs.readFileSync(fullPath, 'utf8');
  const $ = cheerio.load(raw, { decodeEntities: false });
  let changed = false;

  // Badge superior: div que contiene el emoji 🔒 seguido de "PRO"/"PREMIUM"
  $('div').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (/^🔒\s*(CONTENIDO\s+)?(PRO|PREMIUM)/i.test(text) && !$el.hasClass('academy-pro-lock-badge')) {
      // Evita marcar contenedores padres grandes: solo si es el elemento mas
      // chico posible que contiene ese texto (sin hijos con el mismo texto)
      const hasMatchingChild = $el.find('div').filter((_, c) => /^🔒\s*(CONTENIDO\s+)?(PRO|PREMIUM)/i.test($(c).text().trim())).length > 0;
      if (!hasMatchingChild) {
        $el.addClass('academy-pro-lock-badge');
        changed = true;
      }
    }
  });

  // Seccion grande: <section> cuyo <h2> empieza con 🔒 y contiene Premium/Content
  $('section').each((_, el) => {
    const $el = $(el);
    const h2 = $el.find('h2').first().text().trim();
    if (/^🔒/.test(h2) && /(premium|pro)/i.test(h2) && !$el.hasClass('academy-pro-lock-section')) {
      $el.addClass('academy-pro-lock-section');
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(fullPath, $.html(), 'utf8');
    console.log(`FIXED: ${fullPath}`);
  } else {
    console.log(`sin cambios: ${fullPath}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let targets = [];

  if (args.includes('--file')) {
    const idx = args.indexOf('--file');
    const rel = args[idx + 1]; // e.g. academy/module-4/index.html
    for (const root of ROOTS) {
      const rootBase = root.replace(/^public\//, ''); // "academy" or "en/academy"
      const relInRoot = rel.replace(/^academy\//, '');
      const full = path.join('public', rootBase, relInRoot);
      if (fs.existsSync(full)) targets.push(full);
    }
  } else if (args.includes('--all')) {
    for (const root of ROOTS) {
      const files = await glob('**/*.html', { cwd: root });
      for (const f of files) targets.push(path.join(root, f));
    }
  } else {
    console.error('Usa --file <ruta relativa a academy/> o --all');
    process.exit(1);
  }

  for (const t of targets) fixFile(t);
}

main();
