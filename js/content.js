// Textos de los tres diálogos informativos (basados en la presentación de marca).
export const DIALOGS = {
  concepto: {
    kicker: '01 / El concepto',
    title: '¿Qué es<br>Rufián?',
    html: `<p>Rufián Magazine es una marca de skate que nace de la cultura callejera, la creatividad y la rebeldía.</p>
           <p>Diseña tablas que combinan funcionalidad y expresión gráfica, pensadas tanto para quienes están descubriendo el skate como para quienes ya forman parte de su cultura.</p>
           <div class="formula">Movimiento + identidad + calle + creatividad</div>`,
  },
  tabla: {
    kicker: '02 / La tabla',
    title: 'El<br>producto',
    html: `<p>Las tablas Rufián ofrecen una experiencia accesible para nuevos riders sin abandonar la estética y el carácter de una marca de skate profesional.</p>
           <ul>
             <li>Diseño pensado para diferentes niveles</li>
             <li>Construcción resistente para la práctica del skate</li>
             <li>Gráficas originales y coleccionables</li>
             <li>Formato clásico de skate</li>
             <li>Identidad visual diferenciada</li>
           </ul>
           <p><b>Tip:</b> toca la tabla en la cámara para cambiar entre las tres gráficas de la serie 001.</p>`,
  },
  cultura: {
    kicker: '03 / La cultura',
    title: 'No pide<br>permiso',
    html: `<p>Rufián representa al personaje que se mueve al margen de lo establecido. No busca encajar. No pide permiso. No sigue una única forma de hacer las cosas.</p>
           <ul>
             <li>Rebelde</li><li>Callejero</li><li>Creativo</li><li>Experimental</li><li>Independiente</li>
           </ul>
           <p>La marca busca acercar el skate a nuevas personas y, al mismo tiempo, mantener una identidad fuerte dentro de la cultura urbana.</p>
           <div class="formula">Empezar no significa pertenecer menos.</div>`,
  },
};
export const DIALOG_ORDER = ['concepto', 'tabla', 'cultura'];
