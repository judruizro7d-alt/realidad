# PICAFUEGO · Experiencia WebAR

Dos experiencias de realidad aumentada en una sola página web, sin instalar nada:

1. **Escanear imagen** → al apuntar la cámara a `imagenescaneable.png` aparece el **chile bailando entre llamas animadas** y 3 iconos interactivos (Hecho artesanal · Ingredientes · Nivel de picante) con sus tarjetas informativas y efectos de sonido.
2. **Activa tu modo PICAFUEGO** → filtro facial en tiempo real con **fuego en la boca**, **bigote mexicano** sobre el labio y **chile en la mejilla**.

Funciona en celulares (Android / iPhone) y en computadores con webcam. Es un sitio estático: **no necesita compilación**.

---

## Estructura

```
picafuego-webar/
├── index.html              Portada + pantallas de escaneo y filtro
├── vercel.json             Cabeceras y caché para Vercel
├── package.json            Servidor local (npm run dev)
├── css/app.css             Estilos (paleta PICAFUEGO, responsive)
├── js/
│   ├── main.js             Controlador: navegación, botones, tarjetas, errores
│   ├── config.js           ⭐ Rutas de recursos, icono ↔ tarjeta ↔ sonido
│   ├── ar-experience.js    Reconocimiento de imagen (MindAR + Three.js), chile y llamas
│   ├── face-filter.js      Filtro facial (MediaPipe Face Mesh)
│   ├── fire.js             Fuego procedural con el estilo de la marca
│   ├── audio.js            Sonidos sintetizados (Web Audio) + silencio
│   ├── webcamera.js        Cámara, detección de dispositivo, errores legibles
│   ├── three.*.js          Three.js r186 (del proyecto base)
│   ├── mindar/             MindAR 1.2.5 (autoalojado, sin CDN)
│   └── facemesh/           MediaPipe Face Mesh (autoalojado, sin CDN)
└── assets/
    ├── marker/             imagenescaneable.png  +  targets.mind (imagen compilada)
    ├── img/                logo, chile, iconos 1-3, tarjetas 1-3
    ├── face/bigote.svg     Bigote mexicano del filtro
    └── fonts/              Anton + Poppins (autoalojadas)
```

Todo está autoalojado: **no depende de ningún CDN** ni de claves/credenciales. No hay variables de entorno.

---

## Requisitos previos

- [Node.js 18+](https://nodejs.org) (solo para el servidor local; el sitio en sí es estático).
- Cuenta en [GitHub](https://github.com) y [Vercel](https://vercel.com).

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. La cámara funciona en `localhost` sin HTTPS.

> Para probar desde el celular en la misma red necesitas HTTPS (los navegadores bloquean la cámara en `http://192.168...`). Lo más fácil es desplegar en Vercel y abrir ese enlace en el celular.

## Subir a GitHub

```bash
git init
git add .
git commit -m "PICAFUEGO WebAR"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/picafuego-webar.git
git push -u origin main
```

## Desplegar en Vercel

1. En [vercel.com/new](https://vercel.com/new) importa el repositorio de GitHub.
2. **Framework Preset:** `Other`. **Build Command:** déjalo vacío (o el que sugiere el `package.json`). **Output Directory:** déjalo vacío (se publica la raíz).
3. Pulsa **Deploy**. Vercel entrega una URL con **HTTPS**, que es lo que exige el navegador para la cámara.
4. (Opcional) Añade tu dominio en *Settings → Domains*.

Para el QR: genera un código QR con la URL final y colócalo junto a `imagenescaneable.png`.

---

## Cómo usar la experiencia

**Escaneo:** pulsa *Escanear imagen* → permite la cámara → apunta a `assets/marker/imagenescaneable.png` (impresa, en un empaque o mostrada en otra pantalla; con buena luz, completa y a 20–40 cm). Aparece el chile bailando y los 3 iconos. Toca un icono para abrir su tarjeta; toca otro para cambiar; cierra con la **X** de la tarjeta, tocando fuera o con `Esc`. Si pierdes la imagen, el contenido se oculta y reaparece al volver a apuntar.

**Filtro:** pulsa *Activa tu modo PICAFUEGO* → permite la cámara → aparecen fuego, bigote y chile. Puedes activar/desactivar cada efecto o el filtro completo, cambiar de cámara, tomar una foto (se descarga) y cerrar la cámara.

**Sonido:** suena una bienvenida muy suave. Si el navegador bloquea el audio automático, suena en la primera interacción. El botón de altavoz (arriba a la derecha) silencia todo y recuerda tu preferencia. Ningún efecto dura más de 3 s (los reales duran ≈0.6–1.2 s).

---

## Personalización

Todo en **`js/config.js`**:

| Qué | Cómo |
|---|---|
| Orden de iconos/tarjetas/sonidos | Edita el arreglo `sections` (cada elemento enlaza `icon` ↔ `card` ↔ `sound`). Hoy: `icono-N` ↔ `tarjeta-N`. |
| Bigote propio | Pon `bigote.png` (fondo transparente) en `assets/face/` y cambia `face.mustache`. |
| Chile de la mejilla | `face.cheekChile` |
| Zona táctil de la “X” de cada tarjeta | `sections[i].close` (fracciones del tamaño de la tarjeta) |

**Si cambias `imagenescaneable.png`** debes volver a generar `assets/marker/targets.mind`: entra a <https://hiukim.github.io/mind-ar-js-doc/tools/compile>, sube la imagen, descarga `targets.mind` y reemplázalo.

---

## Decisiones técnicas

- **Reconocimiento de imagen:** MindAR (Image Tracking) + Three.js, el mismo stack del proyecto base. `targets.mind` se recompiló con `imagenescaneable.png` (un solo objetivo). El contenido 3D está construido por código y anclado a la imagen.
- **Filtro facial:** MediaPipe **Face Mesh** (468 puntos), copiado a `js/facemesh/` para no depender de CDN. Se eligió esta versión porque su modelo viaja dentro del paquete npm (la API *Tasks Vision* exige descargar el modelo desde un servidor externo). Es estable y funciona en Chrome, Edge y Safari.
- **Módulos separados:** escaneo y filtro se cargan solo cuando se usan (importación dinámica), así la portada abre rápido.
- **Sonidos:** sintetizados con Web Audio (sin archivos ni derechos de autor).
- **Fuego, bigote:** el proyecto no traía recursos aislados de fuego ni bigote, así que se dibujaron con el estilo de la marca (fuego procedural animado; `bigote.svg`). Puedes reemplazarlos por los tuyos.
- **Archivos del proyecto base que ya no se usan:** `app.json` (escena del editor de Three.js con 2 objetivos de ejemplo), `js/app.js` y `js/mindar/mindar_controller.js`. Se reemplazaron por módulos propios porque la escena ahora es un único objetivo con contenido generado por código.

## Compatibilidad

| Navegador | Escaneo | Filtro |
|---|---|---|
| Android · Chrome | ✅ esperado | ✅ esperado |
| iPhone · Safari (iOS 16.4+) | ✅ esperado | ✅ esperado |
| Windows · Chrome / Edge | ✅ esperado | ✅ esperado |
| macOS · Safari / Chrome | ✅ esperado | ✅ esperado |

Requiere HTTPS (o localhost) y permiso de cámara. Si el permiso se niega, la página muestra instrucciones claras y un botón *Reintentar*. En iPhone abre el enlace en **Safari** (no dentro del navegador interno de apps como Instagram/WhatsApp, que suelen bloquear la cámara).

## Estado de las pruebas

**Verificado** (Chromium con cámara simulada, escritorio y viewport de celular):
reconocimiento de `imagenescaneable.png` · aparición del chile y llamas animadas · 3 botones con su tarjeta correcta · abrir/cerrar/cambiar tarjetas · pérdida y recuperación del reconocimiento · seguimiento facial con fuego, bigote y chile alineados · activar/desactivar efectos · cerrar cámara · duración de cada sonido (0.6–1.2 s) · manejo de permiso de cámara denegado · sin errores de JavaScript en consola.

**Pendiente de prueba física** (requiere dispositivos reales): iPhone Safari, Android Chrome, macOS Safari y Edge; rendimiento (FPS) en celulares de gama baja; estabilidad del seguimiento con la imagen impresa en distintas condiciones de luz; ajuste fino del filtro con rostros reales en movimiento y giros de cabeza.
