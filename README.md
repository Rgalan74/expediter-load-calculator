# 🚐 Expediter Load Calculator

Aplicación web diseñada para transportistas **cargo van expediters**, que permite calcular costos, ingresos y ganancias por carga de manera rápida y precisa.  

Incluye módulos de:
- 📊 **Calculadora de cargas** (costos reales, RPM, márgenes, etc.)
- 📝 **Historial de cargas** (con edición, notas y filtros por mes/estado)
- 📈 **Dashboard** (KPIs, gráficos de ingresos, gastos y eficiencia)
- 🗺️ **Mapa interactivo de zonas** (con rentabilidad por estado)
- ⚙️ **Configuración de costos reales** (personalizable por usuario)

---

## 🚀 Flujo de trabajo con Git

Para mantener este proyecto actualizado en tu máquina local:

1. **Clonar el repositorio (solo la primera vez):**
   ```bash
   git clone https://github.com/Rgalan74/expediter-load-calculator.git
   cd expediter-load-calculator
   ```

2. **Sincronizar cambios del repo antes de trabajar:**
   ```bash
   git pull
   ```

3. **Guardar tus avances después de trabajar:**
   ```bash
   git add .
   git commit -m "Descripción clara del cambio"
   git push
   ```

📌 Ejemplos de commits:
- `Fix: validación de deadheadMiles = 0`
- `Feature: modal de edición con scroll en body`
- `Update: dashboard con selector de meses`
- `Docs: actualizar README con instrucciones`

---

## 🗂️ Estructura del proyecto

```
public/
 ├── index.html          # Landing page
 ├── app.html            # App principal
 ├── auth.html           # Login/registro
 ├── css/                # Estilos
 ├── js/                 # Lógica separada (calculator.js, dashboard.js, etc.)
 ├── img/                # Imágenes
 ├── manifest.json       # Configuración PWA
 └── service-worker.js   # Soporte offline
```

---

## 📦 Tecnologías usadas
- **HTML5 / CSS3 / JavaScript (ES6)**
- **Firebase** (Auth, Firestore, Hosting)
- **Chart.js** (gráficas dinámicas)
- **TailwindCSS** (estilos responsive)
- **Google Maps API**

---

## ✨ Futuras mejoras
- Exportación avanzada de reportes 📑  
- Panel de control con rutas más rentables 🗺️  
- Integración con pagos de suscripción 💳  

---

## 👨‍💻 Autor
Proyecto creado por **Ricardo Galán** 🚀  
Optimizado para transportistas cargo van en EE.UU. y Canadá.
