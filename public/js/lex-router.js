// ======================================================
// LEX ROUTER: Chat basado en perfil, estados y comparación de RPM
// ======================================================

(function () {
  const INTERNAL_KEYWORDS = [
    // Finanzas / negocio
    'rpm', 'cpm', 'ganancia', 'profit', 'costo', 'costos',
    'millas', 'milla', 'deadhead', 'vacías', 'vacias',
    'finanzas', 'ingresos', 'gastos', 'beneficio',
    // Operación / zonas
    'carga', 'cargas', 'rutas', 'ruta',
    'estado', 'state', 'zona', 'zonas', 'heatmap',
    'historial', 'history', 'promedio', 'promedios',
    'mejores', 'peores', 'trap', 'trampa'
  ];
  const EXTERNAL_HINTS = [
  'clima',
  'tiempo',
  'weather',
  'temperatura',
  'noticia',
  'noticias',
  'news'
 ];

  const STATE_CODES = [
    'AL','AR','AZ','CA','CO','CT','DE','FL','GA','IA','ID','IL','IN','KS','KY',
    'LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM',
    'NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA',
    'WI','WV','WY'
  ];

  function normalize(text) {
    return (text || '').toString().trim().toLowerCase();
  }

    // Palabras típicas de NEGOCIACIÓN
  const NEGOTIATION_KEYWORDS = [
    'contraofert',       // contraofertar, contraoferta
    'contra oferta',
    'cuanto pido',
    'cuánto pido',
    'cuanto pedir',
    'cuánto pedir',
    'cuanto deberia pedir',
    'cuánto debería pedir',
    'pedir mas',
    'pedir más',
    'subir el precio',
    'subir rate',
    'subir el rate',
    'me estan dando poco',
    'me están dando poco',
    'me dan poco',
    'muy poco para',
    'regatear',
    'contra ofertar'
  ];

  function isNegotiationMessage(text) {
    const t = (text || '').toString().toLowerCase();
    return NEGOTIATION_KEYWORDS.some((kw) => t.includes(kw));
  }


 // 🧠 Decide si es pregunta interna (app) o externa (API futura)
 function isInternalQuestion(text, originalText) {
  const t   = normalize(text);
  const raw = (originalText || '').toString().toLowerCase();

  if (!t) return true;

  // 1️⃣ Si pregunta por clima/tiempo/temperatura → externo SIEMPRE
  if (EXTERNAL_HINTS.some((kw) => raw.includes(kw))) {
    return false;
  }

  // 2️⃣ Detectar estado (sigla, ciudad o nombre) y RPM
  const stateByCity = detectStateFromCityInText
    ? detectStateFromCityInText(originalText)
    : null;

  const stateByName = typeof detectStateFromNameInText === 'function'
    ? detectStateFromNameInText(originalText)
    : null;

  const stateByCode = detectStateFromTextLocal
    ? detectStateFromTextLocal(originalText)
    : null;

  const rpmCandidate = typeof parseRPMFromText === 'function'
    ? parseRPMFromText(originalText)
    : null;

  if (stateByCity || stateByName || stateByCode || rpmCandidate) {
    return true;
  }

  // 3️⃣ Palabras típicas de negocio
  if (INTERNAL_KEYWORDS.some((kw) => t.includes(kw))) {
    return true;
  }

  // 4️⃣ Por defecto, interno
  return true;
 }



  // Detectar estado por código (GA, TX, FL...) evitando falsos positivos tipo "MO" de "Como"
 function detectStateFromTextLocal(originalText) {
  if (!originalText) return null;

  // Palabras cortas comunes en español que NO deben contarse como estados
  const STOP_WORDS = [
    'ME', 'DE', 'LA', 'EL', 'LO', 'AL', 'DEL',
    'QUE', 'Y', 'A', 'EN', 'POR', 'PARA', 'CON',
    'UN', 'UNA', 'MI', 'TI', 'TE'
  ];

  const rawTokens = originalText.split(/\s+/);

  const tokens = rawTokens
    .map(t => t.replace(/[^A-Za-z]/g, '')) // limpia ¿?, comas, acentos, etc.
    .filter(Boolean)
    .map(t => t.toUpperCase())
    .filter(t => !STOP_WORDS.includes(t)); // 💥 filtramos ME, DE, etc.

  for (const token of tokens) {
    if (STATE_CODES.includes(token)) {
      return token;
    }
  }
  return null;
 }

 // ░░░ NOMBRE DE ESTADO → SIGLA (USADO PARA "ohio", "texas", "georgia") ░░░
 const STATE_NAME_TO_CODE = {
  'ALABAMA': 'AL',
  'ALASKA': 'AK',
  'ARIZONA': 'AZ',
  'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA',
  'COLORADO': 'CO',
  'CONNECTICUT': 'CT',
  'DELAWARE': 'DE',
  'FLORIDA': 'FL',
  'GEORGIA': 'GA',
  'IOWA': 'IA',
  'IDAHO': 'ID',
  'ILLINOIS': 'IL',
  'INDIANA': 'IN',
  'KANSAS': 'KS',
  'KENTUCKY': 'KY',
  'LOUISIANA': 'LA',
  'MASSACHUSETTS': 'MA',
  'MARYLAND': 'MD',
  'MAINE': 'ME',
  'MICHIGAN': 'MI',
  'MINNESOTA': 'MN',
  'MISSOURI': 'MO',
  'MISSISSIPPI': 'MS',
  'MONTANA': 'MT',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  'NEBRASKA': 'NE',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEVADA': 'NV',
  'NEW YORK': 'NY',
  'OHIO': 'OH',
  'OKLAHOMA': 'OK',
  'OREGON': 'OR',
  'PENNSYLVANIA': 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  'TENNESSEE': 'TN',
  'TEXAS': 'TX',
  'UTAH': 'UT',
  'VIRGINIA': 'VA',
  'VERMONT': 'VT',
  'WASHINGTON': 'WA',
  'WISCONSIN': 'WI',
  'WEST VIRGINIA': 'WV',
  'WYOMING': 'WY'
 };


// ░░░ CIUDAD → ESTADO (USADO PARA MIAMI, DALLAS, ATLANTA, ETC.) ░░░
const CITY_TO_STATE = {
  // FLORIDA (FL)
  'MIAMI': 'FL',
  'ORLANDO': 'FL',
  'TAMPA': 'FL',
  'JACKSONVILLE': 'FL',
  'FORT LAUDERDALE': 'FL',
  'FORT MYERS': 'FL',
  'WEST PALM BEACH': 'FL',
  'TALLAHASSEE': 'FL',
  'PENSACOLA': 'FL',
  'GAINESVILLE': 'FL',
  'PORT ST. LUCIE': 'FL',

  // TEXAS (TX)
  'DALLAS': 'TX',
  'HOUSTON': 'TX',
  'AUSTIN': 'TX',
  'SAN ANTONIO': 'TX',
  'FORT WORTH': 'TX',
  'EL PASO': 'TX',
  'ARLINGTON': 'TX',
  'CORPUS CHRISTI': 'TX',
  'PLANO': 'TX',
  'LAREDO': 'TX',
  'LUBBOCK': 'TX',
  'AMARILLO': 'TX',
  'MCALLEN': 'TX',
  'BROWNSVILLE': 'TX',

  // GEORGIA (GA)
  'ATLANTA': 'GA',
  'SAVANNAH': 'GA',
  'AUGUSTA': 'GA',
  'COLUMBUS': 'GA',
  'MACON': 'GA',
  'ATHENS': 'GA',
  'WARNER ROBINS': 'GA',
  'ALBANY': 'GA',
  'VALDOSTA': 'GA',

  // CALIFORNIA (CA)
  'LOS ANGELES': 'CA',
  'SAN FRANCISCO': 'CA',
  'SAN DIEGO': 'CA',
  'SAN JOSE': 'CA',
  'SACRAMENTO': 'CA',
  'FRESNO': 'CA',
  'LONG BEACH': 'CA',
  'OAKLAND': 'CA',
  'BAKERSFIELD': 'CA',
  'ANAHEIM': 'CA',
  'SANTA ANA': 'CA',
  'RIVERSIDE': 'CA',
  'STOCKTON': 'CA',
  'IRVINE': 'CA',

  // ILLINOIS (IL)
  'CHICAGO': 'IL',
  'AURORA': 'IL',
  'ROCKFORD': 'IL',
  'JOLIET': 'IL',
  'NAPERVILLE': 'IL',
  'SPRINGFIELD': 'IL',
  'PEORIA': 'IL',
  'ELGIN': 'IL',
  'WAUKEGAN': 'IL',

  // OHIO (OH)
  'COLUMBUS': 'OH',
  'CLEVELAND': 'OH',
  'CINCINNATI': 'OH',
  'TOLEDO': 'OH',
  'AKRON': 'OH',
  'DAYTON': 'OH',
  'CANTON': 'OH',
  'YOUNGSTOWN': 'OH',
  'PARMA': 'OH',
  'LORAIN': 'OH',

  // MICHIGAN (MI)
  'DETROIT': 'MI',
  'GRAND RAPIDS': 'MI',
  'WARREN': 'MI',
  'STERLING HEIGHTS': 'MI',
  'LANSING': 'MI',
  'ANN ARBOR': 'MI',
  'FLINT': 'MI',
  'DEARBORN': 'MI',
  'LIVONIA': 'MI',

  // PENNSYLVANIA (PA)
  'PHILADELPHIA': 'PA',
  'PITTSBURGH': 'PA',
  'ALLENTOWN': 'PA',
  'ERIE': 'PA',
  'READING': 'PA',
  'SCRANTON': 'PA',
  'BETHLEHEM': 'PA',
  'HARRISBURG': 'PA',
  'LANCASTER': 'PA',

  // NORTH CAROLINA (NC)
  'CHARLOTTE': 'NC',
  'RALEIGH': 'NC',
  'GREENSBORO': 'NC',
  'DURHAM': 'NC',
  'WINSTON-SALEM': 'NC',
  'FAYETTEVILLE': 'NC',
  'CARY': 'NC',
  'WILMINGTON': 'NC',
  'ASHEVILLE': 'NC',

  // TENNESSEE (TN)
  'MEMPHIS': 'TN',
  'NASHVILLE': 'TN',
  'KNOXVILLE': 'TN',
  'CHATTANOOGA': 'TN',
  'CLARKSVILLE': 'TN',
  'MURFREESBORO': 'TN',
  'FRANKLIN': 'TN',
  'JOHNSON CITY': 'TN',

  // INDIANA (IN)
  'INDIANAPOLIS': 'IN',
  'FORT WAYNE': 'IN',
  'EVANSVILLE': 'IN',
  'SOUTH BEND': 'IN',
  'CARMEL': 'IN',
  'BLOOMINGTON': 'IN',
  'FISHERS': 'IN',
  'HAMMOND': 'IN',

  // ARIZONA (AZ)
  'PHOENIX': 'AZ',
  'TUCSON': 'AZ',
  'MESA': 'AZ',
  'CHANDLER': 'AZ',
  'SCOTTSDALE': 'AZ',
  'GLENDALE': 'AZ',
  'GILBERT': 'AZ',
  'TEMPE': 'AZ',
  'PEORIA': 'AZ',

  // WISCONSIN (WI)
  'MILWAUKEE': 'WI',
  'MADISON': 'WI',
  'GREEN BAY': 'WI',
  'KENOSHA': 'WI',
  'RACINE': 'WI',
  'APPLETON': 'WI',
  'WAUKESHA': 'WI',
  'EAU CLAIRE': 'WI',

  // MINNESOTA (MN)
  'MINNEAPOLIS': 'MN',
  'ST. PAUL': 'MN',
  'ROCHESTER': 'MN',
  'DULUTH': 'MN',
  'BLOOMINGTON': 'MN',
  'BROOKLYN PARK': 'MN',
  'PLYMOUTH': 'MN',

  // MISSOURI (MO)
  'KANSAS CITY': 'MO',
  'ST. LOUIS': 'MO',
  'SPRINGFIELD': 'MO',
  'COLUMBIA': 'MO',
  'INDEPENDENCE': 'MO',
  'LEE\'S SUMMIT': 'MO',
  'O\'FALLON': 'MO',

  // KENTUCKY (KY)
  'LOUISVILLE': 'KY',
  'LEXINGTON': 'KY',
  'BOWLING GREEN': 'KY',
  'OWENSBORO': 'KY',
  'COVINGTON': 'KY',
  'HOPKINSVILLE': 'KY',
  'RICHMOND': 'KY',
  'FLORENCE': 'KY',

  // NEVADA (NV)
  'LAS VEGAS': 'NV',
  'HENDERSON': 'NV',
  'RENO': 'NV',
  'NORTH LAS VEGAS': 'NV',
  'SPARKS': 'NV',
  'CARSON CITY': 'NV',

  // OREGON (OR)
  'PORTLAND': 'OR',
  'EUGENE': 'OR',
  'SALEM': 'OR',
  'GRESHAM': 'OR',
  'HILLSBORO': 'OR',
  'BEAVERTON': 'OR',
  'BEND': 'OR',
  'MEDFORD': 'OR',

  // WASHINGTON (WA)
  'SEATTLE': 'WA',
  'SPOKANE': 'WA',
  'TACOMA': 'WA',
  'VANCOUVER': 'WA',
  'BELLEVUE': 'WA',
  'KENT': 'WA',
  'EVERETT': 'WA',
  'RENTON': 'WA',
  'YAKIMA': 'WA',

  // IOWA (IA)
  'DES MOINES': 'IA',
  'CEDAR RAPIDS': 'IA',
  'DAVENPORT': 'IA',
  'SIOUX CITY': 'IA',
  'IOWA CITY': 'IA',
  'WATERLOO': 'IA',
  'COUNCIL BLUFFS': 'IA',

  // KANSAS (KS)
  'WICHITA': 'KS',
  'OVERLAND PARK': 'KS',
  'KANSAS CITY': 'KS',
  'OLATHE': 'KS',
  'TOPEKA': 'KS',
  'LAWRENCE': 'KS',
  'SHAWNEE': 'KS',
  'MANHATTAN': 'KS',

  // ALABAMA (AL)
  'BIRMINGHAM': 'AL',
  'MONTGOMERY': 'AL',
  'MOBILE': 'AL',
  'HUNTSVILLE': 'AL',
  'TUSCALOOSA': 'AL',
  'HOOVER': 'AL',
  'DOTHAN': 'AL',
  'AUBURN': 'AL',

  // SOUTH CAROLINA (SC)
  'CHARLESTON': 'SC',
  'COLUMBIA': 'SC',
  'NORTH CHARLESTON': 'SC',
  'MOUNT PLEASANT': 'SC',
  'ROCK HILL': 'SC',
  'GREENVILLE': 'SC',
  'SUMMERVILLE': 'SC',

  // VIRGINIA (VA)
  'VIRGINIA BEACH': 'VA',
  'NORFOLK': 'VA',
  'CHESAPEAKE': 'VA',
  'RICHMOND': 'VA',
  'NEWPORT NEWS': 'VA',
  'ALEXANDRIA': 'VA',
  'HAMPTON': 'VA',
  'ROANOKE': 'VA',

  // ARKANSAS (AR)
  'LITTLE ROCK': 'AR',
  'FORT SMITH': 'AR',
  'FAYETTEVILLE': 'AR',
  'SPRINGDALE': 'AR',
  'JONESBORO': 'AR',
  'NORTH LITTLE ROCK': 'AR',
  'CONWAY': 'AR',

  // OKLAHOMA (OK)
  'OKLAHOMA CITY': 'OK',
  'TULSA': 'OK',
  'NORMAN': 'OK',
  'BROKEN ARROW': 'OK',
  'LAWTON': 'OK',
  'EDMOND': 'OK',
  'MOORE': 'OK',

  // COLORADO (CO)
  'DENVER': 'CO',
  'COLORADO SPRINGS': 'CO',
  'AURORA': 'CO',
  'FORT COLLINS': 'CO',
  'LAKEWOOD': 'CO',
  'THORNTON': 'CO',
  'ARVADA': 'CO',
  'BOULDER': 'CO',

  // NEW YORK (NY)
  'NEW YORK CITY': 'NY',
  'NEW YORK': 'NY',
  'BUFFALO': 'NY',
  'ROCHESTER': 'NY',
  'SYRACUSE': 'NY',
  'ALBANY': 'NY',
  'YONKERS': 'NY',
  'NEW ROCHELLE': 'NY',

  // NEW JERSEY (NJ)
  'NEWARK': 'NJ',
  'JERSEY CITY': 'NJ',
  'PATERSON': 'NJ',
  'ELIZABETH': 'NJ',
  'EDISON': 'NJ',
  'WOODBRIDGE': 'NJ',
  'LAKEWOOD': 'NJ',
  'TOMS RIVER': 'NJ',

  // MARYLAND (MD)
  'BALTIMORE': 'MD',
  'FREDERICK': 'MD',
  'ROCKVILLE': 'MD',
  'GAITHERSBURG': 'MD',
  'BOWIE': 'MD',
  'HAGERSTOWN': 'MD',
  'ANNAPOLIS': 'MD',

  // LOUISIANA (LA)
  'NEW ORLEANS': 'LA',
  'BATON ROUGE': 'LA',
  'SHREVEPORT': 'LA',
  'LAFAYETTE': 'LA',
  'LAKE CHARLES': 'LA',
  'KENNER': 'LA',
  'BOSSIER CITY': 'LA',

  // MISSISSIPPI (MS)
  'JACKSON': 'MS',
  'GULFPORT': 'MS',
  'SOUTHAVEN': 'MS',
  'HATTIESBURG': 'MS',
  'BILOXI': 'MS',
  'MERIDIAN': 'MS',
  'TUPELO': 'MS',

  // NEW MEXICO (NM)
  'ALBUQUERQUE': 'NM',
  'LAS CRUCES': 'NM',
  'RIO RANCHO': 'NM',
  'SANTA FE': 'NM',
  'ROSWELL': 'NM',
  'FARMINGTON': 'NM',
  'CLOVIS': 'NM',

  // UTAH (UT)
  'SALT LAKE CITY': 'UT',
  'WEST VALLEY CITY': 'UT',
  'PROVO': 'UT',
  'WEST JORDAN': 'UT',
  'OREM': 'UT',
  'SANDY': 'UT',
  'OGDEN': 'UT',

  // IDAHO (ID)
  'BOISE': 'ID',
  'MERIDIAN': 'ID',
  'NAMPA': 'ID',
  'IDAHO FALLS': 'ID',
  'POCATELLO': 'ID',
  'CALDWELL': 'ID',
  'COEUR D\'ALENE': 'ID',

  // NEBRASKA (NE)
  'OMAHA': 'NE',
  'LINCOLN': 'NE',
  'BELLEVUE': 'NE',
  'GRAND ISLAND': 'NE',
  'KEARNEY': 'NE',
  'FREMONT': 'NE',
  'HASTINGS': 'NE',

  // CONNECTICUT (CT)
  'BRIDGEPORT': 'CT',
  'NEW HAVEN': 'CT',
  'HARTFORD': 'CT',
  'STAMFORD': 'CT',
  'WATERBURY': 'CT',
  'NORWALK': 'CT',
  'DANBURY': 'CT',

  // DELAWARE (DE)
  'WILMINGTON': 'DE',
  'DOVER': 'DE',
  'NEWARK': 'DE',
  'MIDDLETOWN': 'DE',
  'SMYRNA': 'DE',
  'MILFORD': 'DE',

  // RHODE ISLAND (RI)
  'PROVIDENCE': 'RI',
  'WARWICK': 'RI',
  'CRANSTON': 'RI',
  'PAWTUCKET': 'RI',
  'EAST PROVIDENCE': 'RI',
  'WOONSOCKET': 'RI'
};



// Detectar estado por NOMBRE en el texto (ej: "ohio", "texas")
function detectStateFromNameInText(originalText) {
  if (!originalText) return null;
  const upper = originalText.toUpperCase();

  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (upper.includes(name)) {
      return code;
    }
  }
  return null;
}

function detectStateFromCityInText(originalText) {
  if (!originalText) return null;
  const upper = originalText.toUpperCase();

  for (const [city, state] of Object.entries(CITY_TO_STATE)) {
    if (upper.includes(city)) {
      return state;
    }
  }
  return null;
}


  // Intentar extraer un RPM válido del texto (0.75, 0.9, 1.10, etc.)
  function parseRPMFromText(originalText) {
    if (!originalText) return null;

    const matches = originalText.match(/(\d+([.,]\d+)?)/g);
    if (!matches) return null;

    const candidates = matches
      .map(str => str.replace(',', '.'))
      .map(str => parseFloat(str))
      .filter(num => !isNaN(num) && num > 0.1 && num < 10); // asumimos RPM razonable

    if (!candidates.length) return null;

    // Tomamos el último número que parece RPM (suele ser el más relevante del mensaje)
    return candidates[candidates.length - 1];
  }

  async function getProfileSafe() {
    if (typeof window.getLexProfile !== 'function') {
      console.warn('[LEX-ROUTER] getLexProfile no está disponible');
      return null;
    }
    try {
      const profile = await window.getLexProfile();
      return profile || null;
    } catch (err) {
      console.error('[LEX-ROUTER] Error al obtener perfil de Lex:', err);
      return null;
    }
  }

  function buildGlobalSummary(profile) {
    const avgRPM      = Number(profile.avgRPM || 0);
    const avgCPM      = Number(profile.avgCPM || 0);
    const avgProfit   = Number(profile.avgProfit || 0);
    const minSafeRPM  = Number(profile.minSafeRPM || 0);

    let msg = 'Resumen rápido de tu operación:\n';

    if (avgRPM > 0) {
      msg += `• RPM promedio histórico: $${avgRPM.toFixed(2)}/mi.\n`;
    }
    if (avgCPM > 0) {
      msg += `• Costo promedio por milla: $${avgCPM.toFixed(2)}/mi.\n`;
    }
    if (minSafeRPM > 0) {
      msg += `• RPM mínimo seguro estimado: $${minSafeRPM.toFixed(2)}/mi.\n`;
    }
    if (avgProfit > 0) {
      msg += `• Ganancia promedio por carga: $${avgProfit.toFixed(0)} aprox.\n`;
    }

    const preferred = Array.isArray(profile.preferredStates)
      ? profile.preferredStates
      : [];
    const avoid = Array.isArray(profile.avoidStates)
      ? profile.avoidStates
      : [];

    if (preferred.length > 0) {
      msg += `\nMejores estados (según tu historial): ${preferred.slice(0, 5).join(', ')}.\n`;
    }
    if (avoid.length > 0) {
      msg += `Estados a evitar: ${avoid.slice(0, 5).join(', ')}.\n`;
    }

    msg += '\nÚsame para comparar ofertas contra estos números, no solo contra el RPM que te dice el dispatcher. 😉';

    return msg;
  }

  function getStateNote(profile, state) {
  if (!profile || !profile.stateNotes) return null;

  const raw = profile.stateNotes[state];
  if (!raw) return null;

  // Puede ser string o array de strings
  if (Array.isArray(raw)) {
    const joined = raw
      .map(n => n.toString().trim())
      .filter(Boolean)
      .join(' | ');
    return joined.length ? joined : null;
  }

  const text = raw.toString().trim();
  return text.length ? text : null;
}



  function buildStateSummary(profile, state) {
  const stats = profile.stateStats && profile.stateStats[state];
  if (!stats || !stats.totalMiles) {
    return `No tengo suficiente historial para analizar ${state} todavía. Registra algunas cargas más hacia ese estado y podré darte un mejor criterio. 🙂`;
  }

  const loads       = stats.loads || 0;
  const avgRPM      = stats.avgRPM || (stats.totalRevenue && stats.totalMiles
                        ? stats.totalRevenue / stats.totalMiles
                        : 0);
  const avgProfit   = stats.avgProfit || (stats.totalProfit && stats.loads
                        ? stats.totalProfit / stats.loads
                        : 0);
  const avgDeadhead = stats.avgDeadhead || 0;

  const preferred = Array.isArray(profile.preferredStates)
    ? profile.preferredStates.includes(state)
    : false;
  const avoid = Array.isArray(profile.avoidStates)
    ? profile.avoidStates.includes(state)
    : false;

  let label = '';
  if (preferred) label = '✅ Está en tu lista de estados buenos.';
  else if (avoid) label = '⚠️ Está en tu lista de estados complicados.';
  
  let msg = `Análisis de tu historial en ${state}:\n`;
  msg += `• Cargas registradas: ${loads}.\n`;
  msg += `• RPM promedio: $${avgRPM.toFixed(2)}/mi.\n`;
  if (avgProfit) {
    msg += `• Ganancia promedio por carga: $${avgProfit.toFixed(0)}.\n`;
  }
  if (avgDeadhead) {
    msg += `• Deadhead promedio: ${avgDeadhead.toFixed(0)} millas.\n`;
  }
  if (label) {
    msg += `\n${label}\n`;
  }

  // 📝 Nota personal sobre el estado (si existe)
  const note = getStateNote(profile, state);
  if (note) {
    msg += `\n📝 Nota personal sobre ${state}: ${note}\n`;
  }

  msg += '\nCuando te ofrezcan una carga hacia este estado, compárala con estos números antes de decir que sí. 😉';

  return msg;
}


  function buildRPMGlobalComparison(profile, rpm) {
    const avgRPM     = Number(profile.avgRPM || 0);
    const minSafeRPM = Number(profile.minSafeRPM || 0);

    const classification = classifyRPM(rpm, null, avgRPM, minSafeRPM);
    let msg = `${classification.label} — Oferta con RPM: $${rpm.toFixed(2)}/mi\n\n`;


    if (minSafeRPM > 0) {
      if (rpm < minSafeRPM) {
        msg += `• Está por DEBAJO de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). 👎\n`;
      } else {
        msg += `• Está POR ENCIMA de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). ✅\n`;
      }
    }

    if (avgRPM > 0) {
      if (rpm < avgRPM * 0.95) {
        msg += `• Está por debajo de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi).\n`;
      } else if (rpm > avgRPM * 1.05) {
        msg += `• Está por ENCIMA de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi). 💰\n`;
      } else {
        msg += `• Está muy cerca de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi).\n`;
      }
    }

    // 🔥 Conclusión final según clasificación
if (classification.label === "✅ BUENA") {
  msg += '\nRecomendación final: **ACEPTAR**. Para tu promedio global esto está muy bien. Solo cuida el deadhead. 🚚💰';
}
else if (classification.label === "⚠️ REGULAR") {
  msg += '\nRecomendación final: **NEGOCIAR**. Está decente, pero puedes apretar un poco. ⚠️';
}
else {
  msg += '\nRecomendación final: **RECHAZAR**. Está por debajo de lo que tú necesitas para ganar consistentemente. ❌';
}

return msg;

  }

  function classifyRPM(rpm, avgStateRPM, avgGlobalRPM, minSafeRPM) {
  let label = "⚠️ REGULAR";
  let color = "regular";

  // ❌ MALA
  if (rpm < minSafeRPM) {
    return { label: "❌ MALA", color: "bad" };
  }

  // Si hay promedio del estado, evaluar primero por estado
  if (avgStateRPM) {
    if (rpm >= avgStateRPM * 1.05) return { label: "✅ BUENA", color: "good" };
    if (rpm <= avgStateRPM * 0.90) return { label: "❌ MALA", color: "bad" };
    return { label: "⚠️ REGULAR", color: "regular" };
  }

  // Si no hay promedio del estado, usar global
  if (rpm >= avgGlobalRPM * 1.10) return { label: "✅ BUENA", color: "good" };
  if (rpm <= avgGlobalRPM * 0.90) return { label: "❌ MALA", color: "bad" };

  return { label: "⚠️ REGULAR", color: "regular" };
}

// ======================================================
// CONSEJO DE NEGOCIACIÓN (cuando el intent es NEGOTIATION)
// ======================================================
function buildNegotiationAdvice(profile, state, rpm) {
  const minSafe = Number(profile.minSafeRPM || 0);
  const globalAvg = Number(profile.avgRPM || 0);
  const stateStats = state && profile.stateStats ? profile.stateStats[state] : null;

  const avgStateRPM = stateStats ? Number(stateStats.avgRPM || 0) : null;

  // Punto base recomendado para pedir
  // Si hay promedio por estado, usamos eso. Si no, usamos global + colchón.
  let targetBase = globalAvg || minSafe;
  if (avgStateRPM && avgStateRPM > 0) {
    targetBase = Math.max(avgStateRPM, minSafe + 0.05);
  } else {
    targetBase = Math.max(globalAvg, minSafe + 0.05);
  }

  // Pequeño colchón para contraoferta
  let counterLow = targetBase + 0.05;
  let counterHigh = counterLow + 0.05;

  // Redondeos bonitos
  targetBase = Number(targetBase.toFixed(2));
  counterLow = Number(counterLow.toFixed(2));
  counterHigh = Number(counterHigh.toFixed(2));

  // Construir mensaje
  const lines = [];

  if (state) {
    lines.push(`🧮 Negociación hacia ${state}:`);
  } else {
    lines.push('🧮 Negociación basada en tus números:');
  }

  if (rpm) {
    const offer = Number(rpm);
    lines.push(`• Oferta actual: $${offer.toFixed(2)}/mi.`);

    if (avgStateRPM && avgStateRPM > 0) {
      lines.push(`• Tu promedio histórico en ese estado: $${avgStateRPM.toFixed(2)}/mi.`);
    }

    lines.push(`• Tu RPM mínimo seguro: $${minSafe.toFixed(2)}/mi.`);
    lines.push(`• Objetivo razonable para pedir: alrededor de $${targetBase.toFixed(2)}/mi.`);

    if (offer < targetBase) {
      lines.push(
        `💬 Recomendación: contraoferta entre **$${counterLow.toFixed(2)} y $${counterHigh.toFixed(2)}/mi**. ` +
        `Si no suben cerca de eso, úsala solo si necesitas moverte de la zona.`
      );
    } else {
      lines.push(
        `💬 Recomendación: ya está cerca o por encima de lo que sueles cobrar. ` +
        `Puedes pedir un poquito más (ej. **$${counterLow.toFixed(2)}**), pero sin arriesgar perderla si te conviene la zona.`
      );
    }
  } else {
    // No tenemos RPM exacto, solo pregunta tipo "cuánto pedir"
    lines.push(`• Tu RPM promedio global: $${globalAvg.toFixed(2)}/mi.`);
    lines.push(`• Tu RPM mínimo seguro estimado: $${minSafe.toFixed(2)}/mi.`);

    if (avgStateRPM && avgStateRPM > 0) {
      lines.push(`• Tu RPM promedio en ese estado: $${avgStateRPM.toFixed(2)}/mi.`);
      lines.push(
        `💬 Recomendación: empieza pidiendo **entre $${counterLow.toFixed(2)} y $${counterHigh.toFixed(2)}/mi** ` +
        `y ten en mente que por debajo de **$${minSafe.toFixed(2)}/mi** empiezas a comprometer tu ganancia real.`
      );
    } else {
      lines.push(
        `💬 Recomendación: para negociar sin número claro, apunta a **$${counterLow.toFixed(2)}–$${counterHigh.toFixed(2)}/mi** ` +
        `y evita bajar de **$${minSafe.toFixed(2)}/mi** salvo que necesites moverte de la zona.`
      );
    }
  }

  return lines.join('\n');
}


function buildRPMStateComparison(profile, state, rpm) {
  const stats = profile.stateStats && profile.stateStats[state];
  const avgStateRPM = stats && stats.avgRPM
    ? stats.avgRPM
    : null;

  const avgRPM     = Number(profile.avgRPM || 0);
  const minSafeRPM = Number(profile.minSafeRPM || 0);

  const classification = classifyRPM(rpm, avgStateRPM, avgRPM, minSafeRPM);

  let msg = `${classification.label} — Oferta hacia ${state} con RPM: $${rpm.toFixed(2)}/mi\n\n`;

  if (minSafeRPM > 0) {
    if (rpm < minSafeRPM) {
      msg += `• Está por DEBAJO de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). 👎\n`;
    } else {
      msg += `• Está POR ENCIMA de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). ✅\n`;
    }
  }

  if (avgStateRPM) {
    if (rpm < avgStateRPM * 0.95) {
      msg += `• Está por debajo de tu RPM promedio en ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`;
    } else if (rpm > avgStateRPM * 1.05) {
      msg += `• Está por ENCIMA de tu RPM promedio en ${state} ($${avgStateRPM.toFixed(2)}/mi). 💰\n`;
    } else {
      msg += `• Está muy cerca de lo que sueles cobrar en ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`;
    }
  } else if (avgRPM > 0) {
    if (rpm < avgRPM * 0.95) {
      msg += `• Comparado con tu promedio global ($${avgRPM.toFixed(2)}/mi), está algo por debajo.\n`;
    } else if (rpm > avgRPM * 1.05) {
      msg += `• Comparado con tu promedio global ($${avgRPM.toFixed(2)}/mi), está por ENCIMA. 💰\n`;
    } else {
      msg += `• Está cerca de tu promedio global ($${avgRPM.toFixed(2)}/mi).\n`;
    }
  }

  if (stats && stats.avgDeadhead) {
    msg += `• Tu deadhead promedio histórico en ${state} es de ${stats.avgDeadhead.toFixed(0)} millas.\n`;
  }

  // 📝 Nota personal sobre el estado (si existe)
  const note = getStateNote(profile, state);
  if (note) {
    msg += `\n📝 Nota personal sobre ${state}: ${note}\n`;
  }

  // 🔥 Conclusión final según clasificación
  if (classification.label === "✅ BUENA") {
    msg += '\nRecomendación final: **TIRALE**. Está fuerte para lo que sueles cobrar ahí. Solo revisa el deadhead y si ese estado te deja salir fácil. 🚚🔥';
  }
  else if (classification.label === "⚠️ REGULAR") {
    msg += '\nRecomendación final: **NEGOCIA** unos centavos. Si no suben, úsala solo si necesitas moverte de la zona. ⚠️';
  }
  else {
    msg += '\nRecomendación final: **NO LA AGARRES**. No te conviene para tus números y ese estado puede ponerte a perder tiempo. ❌';
  }

  return msg;
}

// ======================================================
// AYUDA RÁPIDA DE DECISIÓN (sí / no / negocia)
// ======================================================
function buildDecisionHelp(profile, state, rpm) {
  const minSafe = Number(profile.minSafeRPM || profile.minSafe || 0);
  const globalAvg = Number(profile.avgRPM || 0);
  const stateStats = state && profile.stateStats ? profile.stateStats[state] : null;
  const stateAvg = stateStats ? Number(stateStats.avgRPM || 0) : null;

  const lines = [];

  if (rpm) {
    const offer = Number(rpm);
    const refAvg = stateAvg && stateAvg > 0 ? stateAvg : globalAvg;

    let label, action, emoji;

    if (offer < minSafe) {
      label = '❌ MALA';
      action = 'RECHÁZALA';
      emoji = '❌';
    } else if (offer >= refAvg) {
      label = '✅ BUENA';
      action = 'ACÉPTALA';
      emoji = '✅';
    } else {
      label = '⚠️ REGULAR';
      action = 'NEGOCIA';
      emoji = '⚠️';
    }

    if (state) {
      lines.push(`${label} — Oferta hacia ${state} con RPM: $${offer.toFixed(2)}/mi`);
    } else {
      lines.push(`${label} — Oferta con RPM: $${offer.toFixed(2)}/mi`);
    }

    if (minSafe > 0) {
      lines.push(`• Tu RPM mínimo seguro: $${minSafe.toFixed(2)}/mi.`);
    }
    if (stateAvg && stateAvg > 0) {
      lines.push(`• Tu RPM promedio en ese estado: $${stateAvg.toFixed(2)}/mi.`);
    } else if (globalAvg > 0) {
      lines.push(`• Tu RPM promedio global: $${globalAvg.toFixed(2)}/mi.`);
    }

    lines.push(`💬 Recomendación rápida: **${action}**. ${emoji}`);
  } else {
    // No hay RPM en el texto → pedimos que especifiques
    lines.push('Para darte un sí o no rápido necesito al menos el RPM aproximado ($/milla) de la oferta.');
    lines.push('Ej: "Es bueno 1.10 para TX?" o "Me ofrecen 0.95 para GA, qué te parece?".');
  }

  return lines.join('\n');
}



   // 🔹 Función global que usa el chat
window.handleLexChatMessage = async function (messageText) {
  const originalText = (messageText || '').toString();
  const text = normalize(originalText);
  if (!text) return;

  // 🧠 0️⃣ Intento de detectar intención con Cerebro #2 (lex-intents.js)
  let intentResult = null;
  if (typeof window.lexDetectIntent === 'function') {
    try {
      intentResult = window.lexDetectIntent(originalText);
    } catch (e) {
      console.warn('[LEX-ROUTER] Error en lexDetectIntent:', e);
    }
  }

    // Detectar negociación por heurística propia (palabras clave)
  const negotiationByHeuristic = isNegotiationMessage(originalText);


  // 1️⃣ Detectar estado (sigla / ciudad / nombre completo) y RPM
  let state = detectStateFromTextLocal(originalText);   // GA, TX, FL...
  if (!state && typeof detectStateFromCityInText === 'function') {
    state = detectStateFromCityInText(originalText);    // Miami -> FL, Dallas -> TX...
  }
  if (!state && typeof detectStateFromNameInText === 'function') {
    state = detectStateFromNameInText(originalText);    // "ohio" -> OH, "texas" -> TX...
  }

  const rpm = typeof parseRPMFromText === 'function'
    ? parseRPMFromText(originalText)
    : null;

  // 2️⃣ Pregunta interna si:
  //    - heurística dice interno, O
  //    - menciona un estado válido, O
  //    - menciona un RPM numérico
  const internalByHeuristic = typeof isInternalQuestion === 'function'
    ? isInternalQuestion(text, originalText)
    : true;

  let internal = internalByHeuristic || !!state || !!rpm;

  // 🛑 Si el intent dice que es EXTERNAL con alta confianza → forzar EXTERNO
  if (intentResult && intentResult.intent === 'EXTERNAL' && intentResult.confidence >= 0.7) {
    internal = false;
  }

  if (typeof window.setLexState === 'function') {
    window.setLexState('thinking', {
      message: internal
        ? 'Estoy revisando lo que ya aprendí de tus cargas… 📊'
        : 'Esto parece una pregunta externa, más adelante usaré una API 🌐',
      duration: 2500
    });
  }

  const replyFn = typeof window.appendLexMessageFromRouter === 'function'
    ? window.appendLexMessageFromRouter
    : null;

  // 3️⃣ Si es externa → mensaje genérico y salir
  if (!internal) {
    if (replyFn) {
      replyFn(
        'Eso suena a una pregunta externa (clima, noticias, precios globales...). Más adelante conectaré una API para ayudarte también con eso. 🌐'
      );
    }
    return;
  }

  // 4️⃣ Cargar perfil de Lex (aprendizaje interno)
  const profile = await getProfileSafe();

  if (!profile) {
    if (replyFn) {
      replyFn(
        'Todavía no tengo perfil de aprendizaje cargado. Asegúrate de tener historial de cargas y de haber inicializado Lex Learning. 🧠'
      );
    }
    return;
  }

  // 🧠 4.1 Si el intent es de AYUDA DE DECISIÓN, respondemos súper directo
  const isDecisionHelp =
    intentResult &&
    (
      intentResult.intent === 'DECISION_HELP' ||
      intentResult.subtype === 'DECISION_HELP' ||
      (intentResult.flags && intentResult.flags.decision === true)
    );

  if (isDecisionHelp) {
    const msg = buildDecisionHelp(profile, state, rpm);
    replyFn && replyFn(msg);
    return;
  }

  // 🧠 4.2 Si el intent es de NEGOCIACIÓN, usamos lógica de negociación
  let isNegotiation =
    negotiationByHeuristic ||
    (
      intentResult &&
      (
        intentResult.intent === 'NEGOTIATION' ||
        intentResult.subtype === 'NEGOTIATION' ||
        (intentResult.flags && intentResult.flags.negotiation === true)
      )
    );

  if (isNegotiation) {
    const msg = buildNegotiationAdvice(profile, state, rpm);
    replyFn && replyFn(msg);
    return;
  }

  // 5️⃣ Lógica de respuesta según lo que venga en el mensaje
  let msg;

  if (rpm && state) {
    msg = buildRPMStateComparison(profile, state, rpm);
  } else if (rpm && !state) {
    msg = buildRPMGlobalComparison(profile, rpm);
  } else if (!rpm && state) {
    msg = buildStateSummary(profile, state);
  } else {
    msg = buildGlobalSummary(profile);
  }

  replyFn && replyFn(msg);

};



// ======================================================
// Respuesta interna para el chat de Lex
// Usa el perfil guardado (lexProfiles) y las funciones de resumen
// ======================================================
async function handleInternalChatMessage(originalText, ctx = {}) {
  const { state, rpm } = ctx;

  // 1. Obtener perfil de Lex (ya lo tienes en lex-learning.js)
  let profile;
  try {
    if (typeof getLexProfile === 'function') {
      profile = await getLexProfile();
    } else {
      console.warn('[LEX-CHAT] getLexProfile no está definido');
      return 'Todavía no tengo listo mi perfil de aprendizaje. Pronto podré usar tus datos reales. 😉';
    }
  } catch (e) {
    console.error('[LEX-CHAT] Error cargando perfil:', e);
    return 'Hubo un problema leyendo tus datos. Intenta de nuevo en un momento. 🛠️';
  }

  // 2. Si tengo estado y RPM → comparación de oferta
  if (state && typeof buildRPMStateComparison === 'function' && rpm) {
    return buildRPMStateComparison(profile, state, rpm);
  }

  // 3. Si solo tengo estado → resumen de estado
  if (state && typeof buildStateSummary === 'function') {
    return buildStateSummary(profile, state);
  }

  // 4. Fallback: no pude sacar estado ni rpm útiles
  return (
    'Puedo ayudarte mejor si me das al menos un estado o ciudad y opcionalmente el RPM.\n' +
    'Ejemplos:\n' +
    '• "Es bueno 1.10 para TX?"\n' +
    '• "Cómo está GA para mí últimamente?"\n' +
    '• "Qué precio aceptar en Miami?"'
  );
}

// Opcional: respuesta para preguntas externas (futuro API)
async function handleExternalChatMessage(originalText) {
  return 'Esta pregunta parece necesitar info de fuera de la app (noticias, clima, etc.). Más adelante conectaré una API para ayudarte también con eso. 🌐';
}
})();