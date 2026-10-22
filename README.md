# RUFIÁN — Skate Underground / Experiencia AR

Experiencia web de marca construida con Three.js y MindAR Image Tracking. Conserva la escena Three.js del proyecto inicial (`app.json` y runtime dentro de `js/`), añade una portada responsive de estilo skate underground, tres diálogos informativos, sonido de interfaz y seguimiento de imagen.

## Imagen de seguimiento

La imagen que se detecta es `assets/marker/target.jpg` (imagen de RUFIÁN MAGAZINE entregada para este proyecto). Para evitar usar por error el archivo `.mind` que venía del marcador de otra marca, la aplicación compila el target en el navegador al pulsar **Activar experiencia AR**. El archivo compilado queda temporalmente en memoria durante esa sesión, por lo que no hay que generar ni reemplazar manualmente `targets.mind`.

La compilación inicial puede tardar un poco más que una experiencia con target precompilado y requiere conexión a internet para cargar MindAR como módulo ES. El proyecto intenta jsDelivr y, si falla, usa un CDN alternativo (unpkg). Para mejorar el reconocimiento, imprime o muestra la imagen completa, plana, nítida, con buena iluminación y sin reflejos; evita que el logotipo o los detalles queden tapados.

## Probar localmente

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta un servidor HTTP, por ejemplo con Python:

   ```bash
   python -m http.server 8000
   ```

3. Abre `http://localhost:8000`.
4. Pulsa **Activar experiencia AR**, acepta el permiso de cámara y apunta a la imagen de seguimiento de Rufián.

No abras directamente `index.html` como archivo (`file://`), porque los módulos y el acceso a cámara pueden fallar. En móvil, usa la URL pública HTTPS después del despliegue.

## Publicar en GitHub y Vercel

1. Descomprime el ZIP y sube todo el contenido de esta carpeta al repositorio. Mantén las carpetas `assets/`, `css/` y `js/` junto a `index.html` y `app.json`.
2. En Vercel, importa el repositorio.
3. Selecciona **Other** como framework. Deja el Build Command vacío y usa `.` como Output Directory.
4. Despliega. Abre la URL HTTPS desde un teléfono y concede acceso a la cámara.

`vercel.json` configura el proyecto como una web estática. No requiere un proceso de build.

## Controles y contenido

- **Activar experiencia AR**: carga la escena, compila la imagen de seguimiento y abre la cámara.
- **El concepto**, **La tabla** y **La cultura**: abren tres diálogos distintos con información de la marca y reproducen un sonido breve.
- **×**: cierra el modo de cámara.
- Añade `?debug=1` a la URL para dibujar ayudas de depuración sobre el marcador.

## Requisitos y observaciones

- La cámara requiere HTTPS o `localhost`, permiso explícito y un navegador compatible con WebRTC/WebGL.
- Los módulos de MindAR y las fuentes visuales se cargan de servicios externos; la primera carga requiere internet. El compilador se importa como módulo ES (MindAR 1.2.5), no como script clásico global.
- El audio de la escena se ha apuntado al archivo local `assets/bubbles.mp3`.
- Se conserva `app.json` para no descartar la escena Three.js del proyecto original.

## Línea gráfica aplicada según el manual de marca

- Base de color negro y blanco, con acentos chartreuse/neón, azul eléctrico, rojo y naranja, en bloques y detalles geométricos inspirados en las páginas 1, 5, 7 y 8 del manual.
- Poppins para los textos. Oswald se usa como sustituto web accesible de la tipografía condensada Heading Now indicada para titulares en el manual.
- Se añadió el símbolo de marca en el encabezado y una composición tipo collage/estampado en la ilustración de la tabla.
- Se mantuvieron los botones, diálogos, textos de la experiencia, lógica de cámara, archivos de Three.js/MindAR y escena del proyecto; el cambio se centra en la identidad visual y la interfaz.
