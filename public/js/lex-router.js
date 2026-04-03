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
    'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY',
    'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM',
    'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA',
    'WI', 'WV', 'WY'
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
    const t = normalize(text);
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
      debugLog('[LEX-ROUTER] getLexProfile no está disponible');
      return null;
    }
    try {
      const profile = await window.getLexProfile();
      return profile || null;
    } catch (err) {
      debugLog('[LEX-ROUTER] Error al obtener perfil de Lex:', err);
      return null;
    }
  }

  function buildGlobalSummary(profile) {
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const avgRPM = Number(profile.avgRPM || 0);
    const avgCPM = Number(profile.avgCPM || 0);
    const avgProfit = Number(profile.avgProfit || 0);
    const minSafeRPM = Number(profile.minSafeRPM || 0);

    let msg = isEs ? 'Resumen rápido de tu operación:\n' : 'Quick summary of your operation:\n';

    if (avgRPM > 0) {
      msg += isEs
        ? `• RPM promedio histórico: $${avgRPM.toFixed(2)}/mi.\n`
        : `• Historical average RPM: $${avgRPM.toFixed(2)}/mi.\n`;
    }
    if (avgCPM > 0) {
      msg += isEs
        ? `• Costo promedio por milla: $${avgCPM.toFixed(2)}/mi.\n`
        : `• Average cost per mile: $${avgCPM.toFixed(2)}/mi.\n`;
    }
    if (minSafeRPM > 0) {
      msg += isEs
        ? `• RPM mínimo seguro estimado: $${minSafeRPM.toFixed(2)}/mi.\n`
        : `• Estimated minimum safe RPM: $${minSafeRPM.toFixed(2)}/mi.\n`;
    }
    if (avgProfit > 0) {
      msg += isEs
        ? `• Ganancia promedio por carga: $${avgProfit.toFixed(0)} aprox.\n`
        : `• Average profit per load: ~$${avgProfit.toFixed(0)}.\n`;
    }

    const preferred = Array.isArray(profile.preferredStates) ? profile.preferredStates : [];
    const avoid = Array.isArray(profile.avoidStates) ? profile.avoidStates : [];

    if (preferred.length > 0) {
      msg += isEs
        ? `\nMejores estados (según tu historial): ${preferred.slice(0, 5).join(', ')}.\n`
        : `\nBest states (based on your history): ${preferred.slice(0, 5).join(', ')}.\n`;
    }
    if (avoid.length > 0) {
      msg += isEs
        ? `Estados a evitar: ${avoid.slice(0, 5).join(', ')}.\n`
        : `States to avoid: ${avoid.slice(0, 5).join(', ')}.\n`;
    }

    msg += isEs
      ? '\nÚsame para comparar ofertas contra estos números, no solo contra el RPM que te dice el dispatcher. 😉'
      : '\nUse me to compare offers against these numbers, not just the RPM your dispatcher quotes you. 😉';

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
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const stats = profile.stateStats && profile.stateStats[state];
    if (!stats || !stats.totalMiles) {
      return isEs
        ? `No tengo suficiente historial para analizar ${state} todavía. Registra algunas cargas más hacia ese estado y podré darte un mejor criterio. 🙂`
        : `I don't have enough history to analyze ${state} yet. Log a few more loads to that state and I'll give you better insight. 🙂`;
    }

    const loads = stats.loads || 0;
    const avgRPM = stats.avgRPM || (stats.totalRevenue && stats.totalMiles
      ? stats.totalRevenue / stats.totalMiles
      : 0);
    const avgProfit = stats.avgProfit || (stats.totalProfit && stats.loads
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
    if (preferred) label = isEs ? '✅ Está en tu lista de estados buenos.' : '✅ It\'s on your good states list.';
    else if (avoid) label = isEs ? '⚠️ Está en tu lista de estados complicados.' : '⚠️ It\'s on your avoid list.';

    let msg = isEs ? `Análisis de tu historial en ${state}:\n` : `Your history analysis for ${state}:\n`;
    msg += isEs ? `• Cargas registradas: ${loads}.\n` : `• Loads recorded: ${loads}.\n`;
    msg += `• ${isEs ? 'RPM promedio' : 'Average RPM'}: $${avgRPM.toFixed(2)}/mi.\n`;
    if (avgProfit) {
      msg += isEs ? `• Ganancia promedio por carga: $${avgProfit.toFixed(0)}.\n` : `• Average profit per load: $${avgProfit.toFixed(0)}.\n`;
    }
    if (avgDeadhead) {
      msg += isEs ? `• Deadhead promedio: ${avgDeadhead.toFixed(0)} millas.\n` : `• Average deadhead: ${avgDeadhead.toFixed(0)} miles.\n`;
    }
    if (label) {
      msg += `\n${label}\n`;
    }

    const note = getStateNote(profile, state);
    if (note) {
      msg += isEs ? `\n📝 Nota personal sobre ${state}: ${note}\n` : `\n📝 Personal note for ${state}: ${note}\n`;
    }

    msg += isEs
      ? '\nCuando te ofrezcan una carga hacia este estado, compárala con estos números antes de decir que sí. 😉'
      : '\nWhen you get an offer to this state, compare it against these numbers before saying yes. 😉';

    return msg;
  }


  function buildRPMGlobalComparison(profile, rpm) {
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const avgRPM = Number(profile.avgRPM || 0);
    const minSafeRPM = Number(profile.minSafeRPM || 0);

    const classification = classifyRPM(rpm, null, avgRPM, minSafeRPM);
    const displayLabel = classification.color === 'good' ? '✅ GOOD' : classification.color === 'bad' ? '❌ BAD' : '⚠️ FAIR';
    let msg = `${isEs ? classification.label : displayLabel} — ${isEs ? 'Oferta con RPM' : 'Offer with RPM'}: $${rpm.toFixed(2)}/mi\n\n`;

    if (minSafeRPM > 0) {
      if (rpm < minSafeRPM) {
        msg += isEs
          ? `• Está por DEBAJO de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). 👎\n`
          : `• It's BELOW your minimum safe RPM ($${minSafeRPM.toFixed(2)}/mi). 👎\n`;
      } else {
        msg += isEs
          ? `• Está POR ENCIMA de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). ✅\n`
          : `• It's ABOVE your minimum safe RPM ($${minSafeRPM.toFixed(2)}/mi). ✅\n`;
      }
    }

    if (avgRPM > 0) {
      if (rpm < avgRPM * 0.95) {
        msg += isEs
          ? `• Está por debajo de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi).\n`
          : `• It's below your global average RPM ($${avgRPM.toFixed(2)}/mi).\n`;
      } else if (rpm > avgRPM * 1.05) {
        msg += isEs
          ? `• Está por ENCIMA de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi). 💰\n`
          : `• It's ABOVE your global average RPM ($${avgRPM.toFixed(2)}/mi). 💰\n`;
      } else {
        msg += isEs
          ? `• Está muy cerca de tu RPM promedio global ($${avgRPM.toFixed(2)}/mi).\n`
          : `• It's very close to your global average RPM ($${avgRPM.toFixed(2)}/mi).\n`;
      }
    }

    if (classification.color === 'good') {
      msg += isEs
        ? '\nRecomendación final: **ACEPTAR**. Para tu promedio global esto está muy bien. Solo cuida el deadhead. 🚚💰'
        : '\nFinal recommendation: **ACCEPT**. For your global average this is solid. Just watch the deadhead. 🚚💰';
    }
    else if (classification.color === 'regular') {
      msg += isEs
        ? '\nRecomendación final: **NEGOCIAR**. Está decente, pero puedes apretar un poco. ⚠️'
        : '\nFinal recommendation: **NEGOTIATE**. It\'s decent, but you can push a bit. ⚠️';
    }
    else {
      msg += isEs
        ? '\nRecomendación final: **RECHAZAR**. Está por debajo de lo que tú necesitas para ganar consistentemente. ❌'
        : '\nFinal recommendation: **REJECT**. It\'s below what you need to earn consistently. ❌';
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
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const minSafe = Number(profile.minSafeRPM || 0);
    const globalAvg = Number(profile.avgRPM || 0);
    const stateStats = state && profile.stateStats ? profile.stateStats[state] : null;

    const avgStateRPM = stateStats ? Number(stateStats.avgRPM || 0) : null;

    let targetBase = globalAvg || minSafe;
    if (avgStateRPM && avgStateRPM > 0) {
      targetBase = Math.max(avgStateRPM, minSafe + 0.05);
    } else {
      targetBase = Math.max(globalAvg, minSafe + 0.05);
    }

    let counterLow = targetBase + 0.05;
    let counterHigh = counterLow + 0.05;

    targetBase = Number(targetBase.toFixed(2));
    counterLow = Number(counterLow.toFixed(2));
    counterHigh = Number(counterHigh.toFixed(2));

    const lines = [];

    if (state) {
      lines.push(isEs ? `🧮 Negociación hacia ${state}:` : `🧮 Negotiation for ${state}:`);
    } else {
      lines.push(isEs ? '🧮 Negociación basada en tus números:' : '🧮 Negotiation based on your numbers:');
    }

    if (rpm) {
      const offer = Number(rpm);
      lines.push(isEs ? `• Oferta actual: $${offer.toFixed(2)}/mi.` : `• Current offer: $${offer.toFixed(2)}/mi.`);

      if (avgStateRPM && avgStateRPM > 0) {
        lines.push(isEs
          ? `• Tu promedio histórico en ese estado: $${avgStateRPM.toFixed(2)}/mi.`
          : `• Your historical average for that state: $${avgStateRPM.toFixed(2)}/mi.`);
      }

      lines.push(isEs ? `• Tu RPM mínimo seguro: $${minSafe.toFixed(2)}/mi.` : `• Your minimum safe RPM: $${minSafe.toFixed(2)}/mi.`);
      lines.push(isEs
        ? `• Objetivo razonable para pedir: alrededor de $${targetBase.toFixed(2)}/mi.`
        : `• Reasonable target to ask for: around $${targetBase.toFixed(2)}/mi.`);

      if (offer < targetBase) {
        lines.push(isEs
          ? `💬 Recomendación: contraoferta entre **$${counterLow.toFixed(2)} y $${counterHigh.toFixed(2)}/mi**. Si no suben cerca de eso, úsala solo si necesitas moverte de la zona.`
          : `💬 Recommendation: counter between **$${counterLow.toFixed(2)} and $${counterHigh.toFixed(2)}/mi**. If they won't go near that, only take it if you need to reposition.`);
      } else {
        lines.push(isEs
          ? `💬 Recomendación: ya está cerca o por encima de lo que sueles cobrar. Puedes pedir un poquito más (ej. **$${counterLow.toFixed(2)}**), pero sin arriesgar perderla si te conviene la zona.`
          : `💬 Recommendation: it's already close to or above your usual rate. You can ask a little more (e.g. **$${counterLow.toFixed(2)}**), but don't risk losing it if the lane works for you.`);
      }
    } else {
      lines.push(isEs ? `• Tu RPM promedio global: $${globalAvg.toFixed(2)}/mi.` : `• Your global average RPM: $${globalAvg.toFixed(2)}/mi.`);
      lines.push(isEs ? `• Tu RPM mínimo seguro estimado: $${minSafe.toFixed(2)}/mi.` : `• Your estimated minimum safe RPM: $${minSafe.toFixed(2)}/mi.`);

      if (avgStateRPM && avgStateRPM > 0) {
        lines.push(isEs
          ? `• Tu RPM promedio en ese estado: $${avgStateRPM.toFixed(2)}/mi.`
          : `• Your average RPM for that state: $${avgStateRPM.toFixed(2)}/mi.`);
        lines.push(isEs
          ? `💬 Recomendación: empieza pidiendo **entre $${counterLow.toFixed(2)} y $${counterHigh.toFixed(2)}/mi** y ten en mente que por debajo de **$${minSafe.toFixed(2)}/mi** empiezas a comprometer tu ganancia real.`
          : `💬 Recommendation: start asking **between $${counterLow.toFixed(2)} and $${counterHigh.toFixed(2)}/mi** and keep in mind that below **$${minSafe.toFixed(2)}/mi** you start cutting into your real profit.`);
      } else {
        lines.push(isEs
          ? `💬 Recomendación: para negociar sin número claro, apunta a **$${counterLow.toFixed(2)}–$${counterHigh.toFixed(2)}/mi** y evita bajar de **$${minSafe.toFixed(2)}/mi** salvo que necesites moverte de la zona.`
          : `💬 Recommendation: without a specific number, aim for **$${counterLow.toFixed(2)}–$${counterHigh.toFixed(2)}/mi** and avoid going below **$${minSafe.toFixed(2)}/mi** unless you really need to reposition.`);
      }
    }

    return lines.join('\n');
  }


  function buildRPMStateComparison(profile, state, rpm) {
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    const stats = profile.stateStats && profile.stateStats[state];
    const avgStateRPM = stats && stats.avgRPM
      ? stats.avgRPM
      : null;

    const avgRPM = Number(profile.avgRPM || 0);
    const minSafeRPM = Number(profile.minSafeRPM || 0);

    const classification = classifyRPM(rpm, avgStateRPM, avgRPM, minSafeRPM);
    const displayLabel = classification.color === 'good' ? '✅ GOOD' : classification.color === 'bad' ? '❌ BAD' : '⚠️ FAIR';

    let msg = `${isEs ? classification.label : displayLabel} — ${isEs ? `Oferta hacia ${state} con RPM` : `Offer to ${state} with RPM`}: $${rpm.toFixed(2)}/mi\n\n`;

    if (minSafeRPM > 0) {
      if (rpm < minSafeRPM) {
        msg += isEs
          ? `• Está por DEBAJO de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). 👎\n`
          : `• It's BELOW your minimum safe RPM ($${minSafeRPM.toFixed(2)}/mi). 👎\n`;
      } else {
        msg += isEs
          ? `• Está POR ENCIMA de tu RPM mínimo seguro ($${minSafeRPM.toFixed(2)}/mi). ✅\n`
          : `• It's ABOVE your minimum safe RPM ($${minSafeRPM.toFixed(2)}/mi). ✅\n`;
      }
    }

    if (avgStateRPM) {
      if (rpm < avgStateRPM * 0.95) {
        msg += isEs
          ? `• Está por debajo de tu RPM promedio en ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`
          : `• It's below your average RPM for ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`;
      } else if (rpm > avgStateRPM * 1.05) {
        msg += isEs
          ? `• Está por ENCIMA de tu RPM promedio en ${state} ($${avgStateRPM.toFixed(2)}/mi). 💰\n`
          : `• It's ABOVE your average RPM for ${state} ($${avgStateRPM.toFixed(2)}/mi). 💰\n`;
      } else {
        msg += isEs
          ? `• Está muy cerca de lo que sueles cobrar en ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`
          : `• It's very close to what you usually earn in ${state} ($${avgStateRPM.toFixed(2)}/mi).\n`;
      }
    } else if (avgRPM > 0) {
      if (rpm < avgRPM * 0.95) {
        msg += isEs
          ? `• Comparado con tu promedio global ($${avgRPM.toFixed(2)}/mi), está algo por debajo.\n`
          : `• Compared to your global average ($${avgRPM.toFixed(2)}/mi), it's a bit low.\n`;
      } else if (rpm > avgRPM * 1.05) {
        msg += isEs
          ? `• Comparado con tu promedio global ($${avgRPM.toFixed(2)}/mi), está por ENCIMA. 💰\n`
          : `• Compared to your global average ($${avgRPM.toFixed(2)}/mi), it's ABOVE. 💰\n`;
      } else {
        msg += isEs
          ? `• Está cerca de tu promedio global ($${avgRPM.toFixed(2)}/mi).\n`
          : `• It's close to your global average ($${avgRPM.toFixed(2)}/mi).\n`;
      }
    }

    if (stats && stats.avgDeadhead) {
      msg += isEs
        ? `• Tu deadhead promedio histórico en ${state} es de ${stats.avgDeadhead.toFixed(0)} millas.\n`
        : `• Your historical average deadhead to ${state} is ${stats.avgDeadhead.toFixed(0)} miles.\n`;
    }

    const note = getStateNote(profile, state);
    if (note) {
      msg += isEs
        ? `\n📝 Nota personal sobre ${state}: ${note}\n`
        : `\n📝 Personal note for ${state}: ${note}\n`;
    }

    if (classification.color === 'good') {
      msg += isEs
        ? '\nRecomendación final: **TIRALE**. Está fuerte para lo que sueles cobrar ahí. Solo revisa el deadhead y si ese estado te deja salir fácil. 🚚🔥'
        : '\nFinal recommendation: **TAKE IT**. It\'s solid for what you usually earn there. Just check the deadhead and that the state gets you out easily. 🚚🔥';
    }
    else if (classification.color === 'regular') {
      msg += isEs
        ? '\nRecomendación final: **NEGOCIA** unos centavos. Si no suben, úsala solo si necesitas moverte de la zona. ⚠️'
        : '\nFinal recommendation: **NEGOTIATE** a few cents. If they won\'t move, only take it if you need to reposition. ⚠️';
    }
    else {
      msg += isEs
        ? '\nRecomendación final: **NO LA AGARRES**. No te conviene para tus números y ese estado puede ponerte a perder tiempo. ❌'
        : '\nFinal recommendation: **PASS ON IT**. It doesn\'t work for your numbers and that state may leave you stuck. ❌';
    }

    return msg;
  }

  // ======================================================
  // AYUDA RÁPIDA DE DECISIÓN (sí / no / negocia)
  // ======================================================
  function buildDecisionHelp(profile, state, rpm) {
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
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
        label = isEs ? '❌ MALA' : '❌ BAD';
        action = isEs ? 'RECHÁZALA' : 'REJECT IT';
        emoji = '❌';
      } else if (offer >= refAvg) {
        label = isEs ? '✅ BUENA' : '✅ GOOD';
        action = isEs ? 'ACÉPTALA' : 'ACCEPT IT';
        emoji = '✅';
      } else {
        label = isEs ? '⚠️ REGULAR' : '⚠️ FAIR';
        action = isEs ? 'NEGOCIA' : 'NEGOTIATE';
        emoji = '⚠️';
      }

      if (state) {
        lines.push(`${label} — ${isEs ? `Oferta hacia ${state} con RPM` : `Offer to ${state} with RPM`}: $${offer.toFixed(2)}/mi`);
      } else {
        lines.push(`${label} — ${isEs ? 'Oferta con RPM' : 'Offer with RPM'}: $${offer.toFixed(2)}/mi`);
      }

      if (minSafe > 0) {
        lines.push(isEs ? `• Tu RPM mínimo seguro: $${minSafe.toFixed(2)}/mi.` : `• Your minimum safe RPM: $${minSafe.toFixed(2)}/mi.`);
      }
      if (stateAvg && stateAvg > 0) {
        lines.push(isEs ? `• Tu RPM promedio en ese estado: $${stateAvg.toFixed(2)}/mi.` : `• Your average RPM for that state: $${stateAvg.toFixed(2)}/mi.`);
      } else if (globalAvg > 0) {
        lines.push(isEs ? `• Tu RPM promedio global: $${globalAvg.toFixed(2)}/mi.` : `• Your global average RPM: $${globalAvg.toFixed(2)}/mi.`);
      }

      lines.push(`💬 ${isEs ? `Recomendación rápida: **${action}**. ${emoji}` : `Quick recommendation: **${action}**. ${emoji}`}`);
    } else {
      lines.push(isEs
        ? 'Para darte un sí o no rápido necesito al menos el RPM aproximado ($/milla) de la oferta.'
        : 'To give you a quick yes or no I need at least the approximate RPM ($/mile) of the offer.');
      lines.push(isEs
        ? 'Ej: "Es bueno 1.10 para TX?" o "Me ofrecen 0.95 para GA, qué te parece?".'
        : 'E.g.: "Is 1.10 good for TX?" or "They\'re offering 0.95 for GA, what do you think?".');
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
        debugLog('[LEX-ROUTER] Error en lexDetectIntent:', e);
      }
    }

    // 🎭 Sentiment Analysis - Detect user's emotional state
    const sentiment = typeof window.SentimentAnalyzer !== 'undefined'
      ? window.SentimentAnalyzer.analyzeSentiment(originalText)
      : { type: 'NEUTRAL', intensity: 0 };

    if (sentiment.type !== 'NEUTRAL') {
      debugLog('[LEX-ROUTER] 🎭 Sentiment:', sentiment.type, 'Intensity:', sentiment.intensity.toFixed(2));
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

    const _isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';

    if (typeof window.setLexState === 'function') {
      window.setLexState('thinking', {
        message: internal
          ? (_isEs ? 'Estoy revisando lo que ya aprendí de tus cargas… 📊' : 'Reviewing what I know about your loads… 📊')
          : (_isEs ? 'Esto parece una pregunta externa, más adelante usaré una API 🌐' : 'This looks like an external question, I\'ll use an API for that soon 🌐'),
        duration: 2500
      });
    }

    const replyFn = typeof window.appendLexMessageFromRouter === 'function'
      ? window.appendLexMessageFromRouter
      : null;

    // 3️⃣ Si es externa → mensaje genérico y salir
    if (!internal) {
      if (replyFn) {
        replyFn(_isEs
          ? 'Eso suena a una pregunta externa (clima, noticias, precios globales...). Más adelante conectaré una API para ayudarte también con eso. 🌐'
          : 'That sounds like an external question (weather, news, global prices...). I\'ll connect an API for that soon. 🌐'
        );
      }
      return;
    }

    // 💰 3.4 FINANCES Handler - Resúmenes financieros
    const isFinances = intentResult && intentResult.intent === 'FINANCES';

    if (isFinances) {
      if (typeof window.analyzeLexFinances === 'function') {
        if (replyFn) replyFn(_isEs
          ? '💰 Dame un segundo, estoy calculando el resumen de tus finanzas...'
          : '💰 Give me a second, calculating your financial summary...'
        );
        window.analyzeLexFinances().then(result => {
          if (!result && replyFn) {
            replyFn(_isEs
              ? 'No encontré suficientes datos financieros. Asegúrate de registrar gastos y cobros. 🔧'
              : 'Not enough financial data found. Make sure to log your expenses and revenue. 🔧'
            );
          }
        }).catch(err => {
          debugLog('Error generando finanzas desde el chat:', err);
          if (replyFn) replyFn(_isEs ? 'Tuve un pequeño problema leyendo los números. 🛠️' : 'Had a small problem reading the numbers. 🛠️');
        });
      } else {
        if (replyFn) replyFn(_isEs
          ? 'El módulo financiero está apagado en este momento. Inténtalo recargando la página. 📊'
          : 'The financial module is off right now. Try reloading the page. 📊'
        );
      }
      return;
    }

    // 🎓 3.5 APP_INFO Handler - Educational queries (no profile needed)
    const isAppInfo = intentResult && intentResult.intent === 'APP_INFO';

    if (isAppInfo) {
      const ACADEMY_RESOURCES = _isEs ? {
        rpm: { title: 'Entender el RPM real', url: 'academy/module-1/lesson-1.html', description: 'Aprende qué es el RPM y por qué el 90% lo calcula mal' },
        costos: { title: 'Costos y Break-even', url: 'academy/module-1/lesson-2.html', description: 'Costos visibles vs invisibles y tu número de supervivencia' },
        ganancia: { title: 'Ganancia bruta vs real', url: 'academy/module-1/lesson-4.html', description: 'Por qué "carga pagada" no significa "carga rentable"' },
        zonas: { title: 'Análisis de zonas y rutas', url: 'academy/module-2/index.html', description: 'Aprende a evaluar zonas geográficas y rutas rentables' },
        negociacion: { title: 'Negociación y rates', url: 'academy/module-3/index.html', description: 'Técnicas de negociación y cómo defender tu rate' },
        deadhead: { title: 'Deadhead calculation', url: 'academy/module-1/lesson-3.html', description: 'Cómo calcular y considerar millas vacías en tus decisiones' },
        finanzas: { title: 'Finanzas del negocio', url: 'academy/module-4/index.html', description: 'Manejo financiero y contable de tu operación' }
      } : {
        rpm: { title: 'Understanding Real RPM', url: 'academy/module-1/lesson-1.html', description: 'Learn what RPM is and why 90% of drivers calculate it wrong' },
        costos: { title: 'Costs & Break-even', url: 'academy/module-1/lesson-2.html', description: 'Visible vs hidden costs and your survival number' },
        ganancia: { title: 'Gross vs Real Profit', url: 'academy/module-1/lesson-4.html', description: 'Why "paid load" doesn\'t mean "profitable load"' },
        zonas: { title: 'Zone & Route Analysis', url: 'academy/module-2/index.html', description: 'How to evaluate geographic zones and profitable routes' },
        negociacion: { title: 'Negotiation & Rates', url: 'academy/module-3/index.html', description: 'Negotiation techniques and how to defend your rate' },
        deadhead: { title: 'Deadhead Calculation', url: 'academy/module-1/lesson-3.html', description: 'How to calculate and factor in empty miles' },
        finanzas: { title: 'Business Finances', url: 'academy/module-4/index.html', description: 'Financial and accounting management for your operation' }
      };

      function findAcademyResources(text) {
        const resources = [];
        const lowerText = text.toLowerCase();
        if (lowerText.includes('rpm') || lowerText.includes('tarifa') || lowerText.includes('rate')) resources.push(ACADEMY_RESOURCES.rpm);
        if (lowerText.includes('cost') || lowerText.includes('gast') || lowerText.includes('bre')) resources.push(ACADEMY_RESOURCES.costos);
        if (lowerText.includes('ganancia') || lowerText.includes('profit') || lowerText.includes('rentab')) resources.push(ACADEMY_RESOURCES.ganancia);
        if (lowerText.includes('zona') || lowerText.includes('zone') || lowerText.includes('ruta') || lowerText.includes('route')) resources.push(ACADEMY_RESOURCES.zonas);
        if (lowerText.includes('negoc') || lowerText.includes('contraofer') || lowerText.includes('counter') || lowerText.includes('pedir')) resources.push(ACADEMY_RESOURCES.negociacion);
        if (lowerText.includes('deadhead') || lowerText.includes('vaci') || lowerText.includes('empty')) resources.push(ACADEMY_RESOURCES.deadhead);
        if (lowerText.includes('finanz') || lowerText.includes('finance') || lowerText.includes('contab') || lowerText.includes('dinero')) resources.push(ACADEMY_RESOURCES.finanzas);
        return resources;
      }

      const lowerText = text.toLowerCase();
      const academyResources = findAcademyResources(lowerText);

      let response = '';
      if (academyResources.length > 0) {
        response = _isEs ? '📚 Encontré recursos relacionados en la Academia:\n\n' : '📚 Found related resources in the Academy:\n\n';
        academyResources.forEach((resource, index) => {
          response += `${index + 1}. **${resource.title}**\n`;
          response += `   ${resource.description}\n`;
          response += `   👉 [${_isEs ? 'Ir a la lección' : 'Go to lesson'}](${resource.url})\n\n`;
        });
        response += _isEs
          ? 'También puedo ayudarte con análisis en tiempo real si tienes datos específicos (RPM, estado, millas, etc.). 💡'
          : 'I can also help with real-time analysis if you have specific data (RPM, state, miles, etc.). 💡';
      } else {
        response = _isEs
          ? 'No tengo información específica sobre eso aún, pero puedo ayudarte con:\n• Análisis de cargas y RPM\n• Información de zonas trap (CA, FL, NV)\n• Comparación con tu historial\n• Sugerencias de negociación\n\n📚 También puedes explorar la [Academia](academy/start-here/index.html) para aprender más sobre trucking. 🎓'
          : 'I don\'t have specific info on that yet, but I can help you with:\n• Load and RPM analysis\n• Trap zone info (CA, FL, NV)\n• Comparison with your history\n• Negotiation suggestions\n\n📚 You can also explore the [Academy](academy/start-here/index.html) to learn more about trucking. 🎓';
      }

      replyFn && replyFn(response);
      return;
    }

    // 🧠 3.6 Multi-Intent Processing - Combine primary + secondary intents
    const hasSecondaryIntents = intentResult && intentResult.secondary && intentResult.secondary.length > 0;

    if (intentResult && window.ResponseBuilders) {
      if (hasSecondaryIntents) {
        debugLog('[LEX-ROUTER] Processing multi-intent query with', intentResult.secondary.length, 'secondary intents');
      }

      // Load profile for multi-intent processing
      const profile = await getLexProfile();
      const profileForMultiIntent = profile || await getProfileSafe();

      // 🧠 Pattern Learning - Analyze user's decision history
      let patterns = null;
      if (window.PatternLearner && profileForMultiIntent?.recentDecisions?.length >= 10) {
        try {
          patterns = window.PatternLearner.analyzePatterns(profileForMultiIntent.recentDecisions);
          if (patterns) {
            debugLog('[LEX-ROUTER] 🧠 Patterns learned:', {
              states: Object.keys(patterns.rpmThresholds).length,
              acceptanceRate: (patterns.acceptanceRate.rate * 100).toFixed(0) + '%'
            });
          }
        } catch (error) {
          debugLog('[LEX-ROUTER] Error analyzing patterns:', error);
        }
      }

      if (profileForMultiIntent) {
        const responses = [];

        // Collect all intents (primary always, secondary if exist)
        const allIntents = [
          { intent: intentResult.intent, confidence: intentResult.confidence, isSecondary: false }
        ];
        if (hasSecondaryIntents) {
          allIntents.push(...intentResult.secondary.map(s => ({ ...s, isSecondary: true })));
        }

        for (const intentInfo of allIntents) {
          let snippet = null;

          switch (intentInfo.intent) {
            case 'PRICING':
              snippet = window.ResponseBuilders.buildPricingSnippet(
                profileForMultiIntent, state, rpm, { isSecondary: intentInfo.isSecondary, sentiment }
              );
              break;

            case 'NEGOTIATION':
              snippet = window.ResponseBuilders.buildNegotiationSnippet(
                profileForMultiIntent, state, rpm, { isSecondary: intentInfo.isSecondary, sentiment }
              );
              break;

            case 'COMPARE_HISTORY':
              snippet = window.ResponseBuilders.buildHistorySnippet(
                profileForMultiIntent, state, rpm, { isSecondary: intentInfo.isSecondary, sentiment }
              );
              break;

            case 'DECISION_HELP':
              snippet = window.ResponseBuilders.buildDecisionSnippet(
                profileForMultiIntent, state, rpm, { isSecondary: intentInfo.isSecondary, sentiment }
              );
              break;
          }

          if (snippet) {
            responses.push(snippet);
          }
        }

        // 🧠 Add pattern prediction if available
        if (patterns && state && rpm) {
          const prediction = window.PatternLearner.predictAcceptance(patterns, state, rpm);

          if (prediction && prediction.confidence > 0.7) {
            const _isEsP = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
            responses.push({
              type: 'PATTERN_PREDICTION',
              title: _isEsP ? '🧠 Basado en tu historial' : '🧠 Based on your history',
              content: _isEsP
                ? `${prediction.willAccept ? '✅' : '❌'} Usualmente ${prediction.willAccept ? 'aceptas' : 'rechazas'} cargas así\n${prediction.reasons.join('\n')}`
                : `${prediction.willAccept ? '✅' : '❌'} You usually ${prediction.willAccept ? 'accept' : 'reject'} loads like this\n${prediction.reasons.join('\n')}`,
              priority: 2
            });
          }
        }

        debugLog('[LEX-ROUTER] Total responses collected:', responses.length);

        // Check for trap zones
        if (state) {
          const stateWarning = window.ResponseBuilders.buildStateWarningSnippet(state, { sentiment });
          if (stateWarning) {
            responses.push(stateWarning);
          }
        }

        // Combine responses
        if (responses.length > 0) {
          responses.sort((a, b) => a.priority - b.priority);

          let combinedMessage = '';
          responses.forEach((response, index) => {
            if (index > 0) combinedMessage += '\n\n';
            combinedMessage += `${response.title}\n${response.content}`;
          });

          replyFn && replyFn(combinedMessage);
          return;
        }
      }
    }

    // 4️⃣ Cargar perfil de Lex (aprendizaje interno)
    const profile = await getProfileSafe();

    if (!profile) {
      if (replyFn) {
        const _isEsNP = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
        replyFn(_isEsNP
          ? 'Todavía no tengo perfil de aprendizaje cargado. Asegúrate de tener historial de cargas y de haber inicializado Lex Learning. 🧠'
          : 'I don\'t have a learning profile loaded yet. Make sure you have load history and have initialized Lex Learning. 🧠'
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
        debugLog('[LEX-CHAT] getLexProfile no está definido');
        const _isEsIC = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
        return _isEsIC
          ? 'Todavía no tengo listo mi perfil de aprendizaje. Pronto podré usar tus datos reales. 😉'
          : 'My learning profile isn\'t ready yet. Soon I\'ll be able to use your real data. 😉';
      }
    } catch (e) {
      debugLog('[LEX-CHAT] Error cargando perfil:', e);
      const _isEsIC2 = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
      return _isEsIC2
        ? 'Hubo un problema leyendo tus datos. Intenta de nuevo en un momento. 🛠️'
        : 'There was a problem reading your data. Try again in a moment. 🛠️';
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
    const _isEsIC3 = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    return _isEsIC3
      ? ('Puedo ayudarte mejor si me das al menos un estado o ciudad y opcionalmente el RPM.\n' +
        'Ejemplos:\n' +
        '• "Es bueno 1.10 para TX?"\n' +
        '• "Cómo está GA para mí últimamente?"\n' +
        '• "Qué precio aceptar en Miami?"')
      : ('I can help better if you give me at least a state or city and optionally the RPM.\n' +
        'Examples:\n' +
        '• "Is 1.10 good for TX?"\n' +
        '• "How has GA been performing for me lately?"\n' +
        '• "What rate should I accept in Miami?"'
    );
  }

  // Opcional: respuesta para preguntas externas (futuro API)
  async function handleExternalChatMessage(originalText) {
    const isEs = (window.i18n?.currentLang || localStorage.getItem('app_language') || 'en') === 'es';
    return isEs
      ? 'Esta pregunta parece necesitar info de fuera de la app (noticias, clima, etc.). Más adelante conectaré una API para ayudarte también con eso. 🌐'
      : 'This question seems to need info from outside the app (news, weather, etc.). I\'ll connect an API for that soon. 🌐';
  }
})();
