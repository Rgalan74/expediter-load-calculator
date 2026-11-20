# F2 integrado: entorno local

La aplicación original contiene los enganches F2. El modo sombra permanece
inactivo salvo selección explícita del laboratorio en localhost.

- `auth.html?f2shadow=1` o `app.html?f2shadow=1`: proyecto demo, F2 ON.
- `auth.html?f2emulator=1` o `app.html?f2emulator=1`: proyecto demo, F2 OFF.
- La selección se conserva en sessionStorage de esa pestaña durante las
  redirecciones auth/app. Cerrar la pestaña elimina la selección.
- Auth: `127.0.0.1:9099`; Firestore: `127.0.0.1:8180`;
  proyecto exclusivo: `demo-smartload-f2`. Usar solo identidades ficticias.

Con los emuladores existentes activos:

```powershell
node scripts/test-f2-integrated.cjs
```

Si no están activos, Java debe estar en PATH:

```powershell
firebase emulators:exec --project demo-smartload-f2 --only auth,firestore --config scripts/f2-emulator/firebase.json 'node scripts/test-f2-integrated.cjs'
```

El test usa el SDK Firebase ya instalado en la carpeta temporal
`SmartLoad-F2-E2E-v01/SmartLoad_F2_E2E_Emulator_v01`, sin instalar dependencias.
`SLS_F2_SDK_ROOT` permite indicar otra carpeta con `node_modules/firebase`.
Se ejecutan los scripts originales completos de calculadora, CPMEngine y F2,
con SDK y transacciones reales contra Emulator. El DOM es simulado; esto no
certifica presentación visual ni navegación completa del navegador.

Resultado obtenido: 6/6 escenarios aprobados. El único cambio de ganancia
observado en el escenario con peajes es intencional: F2 excluye peajes del CPM
base (0.30 frente a 0.33 legacy), diferencia $30 en 1,000 millas. El panel
visible conserva el resultado legacy. Las preferencias no se sobrescriben.

Las reglas de esta carpeta son únicamente para pruebas, nunca para despliegue.
No se modifican firebase.json, reglas o dependencias del proyecto principal.
