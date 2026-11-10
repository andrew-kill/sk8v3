# RUFIÁN MAGAZINE — Entrega final · Realidades Expandidas

Experiencia web de marca para **Rufián Magazine** (tablas de skate), hecha con **Three.js** y **MindAR**. Línea gráfica en blanco y negro, inspirada en las marcas clásicas de skate: tablero de ajedrez, tipografía condensada pesada y alto contraste.

**Link:** https://sk8v3.vercel.app

## Qué incluye (según la rúbrica)

| Criterio | Dónde está |
|---|---|
| **General: página de inicio con dos botones** | `index.html`: botón **01 Escanea la tabla** (seguimiento de imagen) y botón **02 Ponte el casco** (filtro facial). |
| **General: elemento impreso con QR** | `impresos/rufian-impresos.pdf`: afiche A4 con el marcador + QR y hoja de tarjetas (frente = marcador, reverso = QR). El QR lleva a `https://sk8v3.vercel.app/ar`. |
| **Seguimiento de imagen** | `ar.html` + `js/ar.js`: al detectar el afiche aparece la tabla Rufián modelada en Three.js (gira, hace kickflip y cambia entre 3 gráficas), un panel de **video** con sonido, un anillo de tablero y **tres botones 3D** (01 Concepto, 02 La tabla, 03 Cultura) que abren diálogos con información del producto. Los mismos tres botones también están en la barra inferior. Efectos de sonido al detectar el marcador y al tocar. |
| **Filtro facial** | `filtro.html` + `js/filtro.js`: casco negro brillante con púas (como el ícono de la marca), máscara que se ajusta a la cara y lentes de malla blanca. **Subir las cejas** → los ojos se encienden en azul con sonido de carga tipo repulsor; **abrir la boca** con la máscara encendida → disparo de energía con sonido. Botón para tomar y guardar/compartir foto. |
| **Muestra de diseño / coherencia visual** | El mismo sistema B/N en la web, la experiencia AR, el filtro y los impresos. |

## Estructura

```
index.html            Página de inicio (dos accesos)
ar.html               Experiencia de seguimiento de imagen
filtro.html           Filtro facial
css/rufian.css        Sistema visual
js/ar.js              Lógica AR (MindAR image)
js/filtro.js          Lógica del filtro (MindAR face + gestos)
js/models/deck.js     Modelo 3D de la tabla (Three.js)
js/models/helmet.js   Modelo 3D del casco (Three.js)
js/sfx.js             Efectos de sonido (Web Audio)
js/content.js         Textos de los tres diálogos
assets/marker/        target.jpg (imagen de seguimiento) + targets.mind (precompilado)
assets/sfx/           Sonidos: carga/zumbido/apagado/disparo del repulsor, UI, obturador
assets/video/         Clip de marca para el panel de video
assets/textures/      Gráficas de la tabla, lija y malla de las lentes
editor/               casco-rufian.json y tabla-rufian.json → se pueden abrir en el editor de Three.js (File › Import)
impresos/             PDF para imprimir (afiche + tarjetas con QR)
tools/                Vista previa de los modelos y compilador del marcador
```

## Probar localmente

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`. La cámara solo funciona con `localhost` o HTTPS (Vercel ya da HTTPS). Para probar en el celular usa el link de Vercel.

## Publicar (GitHub + Vercel)

1. Sube todo el contenido de esta carpeta al repositorio `sk8v3` (reemplazando lo anterior).
2. Vercel publica solo: proyecto estático, sin build (Framework: **Other**, Output Directory: `.`).
3. Abre `https://sk8v3.vercel.app` en el celular.

## Notas

- La primera vez, el filtro descarga el modelo facial de MediaPipe (unos MB): necesita internet.
- El video del panel es un clip de marca generado para la entrega; puedes reemplazar `assets/video/rufian-clip.mp4` por un video real de trucos con el mismo nombre (formato cuadrado, H.264).
- Si cambias la imagen del afiche, genera un nuevo `targets.mind` con `tools/compilar-marcador.html`. Si no existe el `.mind`, la página compila la imagen en el navegador (más lento).
- Si el dominio de Vercel cambia, hay que regenerar el QR del PDF.
