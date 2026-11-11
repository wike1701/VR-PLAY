import * as THREE from 'three';
import { t, idioma } from '../idiomas/idiomas.js';

// ─── Catálogo dentro de la realidad virtual ─────────────────────────────
// Con las gafas puestas, «Volver al catálogo» no sale de la VR: se cierra el juego y aparece
// delante una pared curva con los mismos juegos que la portada de la web (portada, título,
// género, partidas, «me gusta» y favoritos), los filtros por género y por favoritos y páginas.
// Se elige apuntando con cualquier mando y apretando el gatillo (o con la palanca, de página
// en página). Cada tarjeta es un solo plano con su dibujo en un canvas: pocas llamadas de dibujo.

const DISTANCIA = 1.3;           // metros delante de los ojos
const COLUMNAS = 4;
const FILAS = 2;
const POR_PAGINA = COLUMNAS * FILAS;
const ANCHO_TARJETA = 0.3;
const ALTO_TARJETA = 0.375;
const PASO_X = 0.335;
const PASO_Y = 0.41;
const CURVA = 0.32;              // la pared se curva hacia el jugador por los lados
const ANCHO_CHIP = 0.2;
const ALTO_CHIP = 0.055;
const CHIPS_POR_FILA = 7;
const RES_TARJETA = 320;         // píxeles de ancho del dibujo de cada tarjeta

const FONDO = '#13151d';
const LINEA = '#272b38';
const TEXTO = '#f4f5f8';
const APAGADO = '#8e93a6';
const CORAL = '#ff6a3d';
const FUENTE = 'Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Un plano con su propio canvas (se dibuja en 2D y se ve en 3D)
function crearPlano(ancho, alto, resolucion) {
  const canvas = document.createElement('canvas');
  canvas.width = resolucion;
  canvas.height = Math.round((resolucion * alto) / ancho);
  const g = canvas.getContext('2d');
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), material);
  mesh.renderOrder = 980; // es interfaz: siempre por encima del suelo y del decorado
  return { mesh, canvas, g, textura };
}

function rectRedondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Parte un texto en líneas que quepan en "ancho" (como mucho "maximo"; la última acaba en …)
function partirLineas(g, texto, ancho, maximo) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (g.measureText(prueba).width <= ancho) actual = prueba;
    else {
      if (actual) lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maximo) {
    lineas.length = maximo;
    lineas[maximo - 1] = lineas[maximo - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lineas;
}

export class CatalogoVR {
  constructor(renderer, escena) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'catalogo-vr';
    this.grupo.visible = false;
    escena.add(this.grupo);
    this.abierto = false;
    this.corto = new Intl.NumberFormat(idioma, { notation: 'compact', maximumFractionDigits: 1 });

    // Cabecera: título y número de juegos
    this.cabecera = crearPlano(1.3, 0.12, 1040);
    this.cabecera.mesh.position.set(0, 0.7, 0);
    this.grupo.add(this.cabecera.mesh);

    // Rejilla: una tarjeta por hueco (se le cambia la textura según la página)
    this.huecos = [];
    for (let i = 0; i < POR_PAGINA; i++) {
      const c = i % COLUMNAS;
      const f = Math.floor(i / COLUMNAS);
      const x = (c - (COLUMNAS - 1) / 2) * PASO_X;
      const z = CURVA * x * x;
      const malla = new THREE.Mesh(
        new THREE.PlaneGeometry(ANCHO_TARJETA, ALTO_TARJETA),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
      );
      malla.renderOrder = 980;
      malla.position.set(x, 0.24 - f * PASO_Y, z);
      malla.rotation.y = Math.atan2(-x, DISTANCIA - z);
      malla.userData = { tipo: 'juego', z };
      this.grupo.add(malla);
      this.huecos.push(malla);
    }

    // Flechas de página a los lados
    this.flechas = [-1, 1].map((lado) => {
      const p = crearPlano(0.09, 0.14, 128);
      const x = lado * ((COLUMNAS / 2) * PASO_X + 0.05);
      p.mesh.position.set(x, 0.03, CURVA * x * x);
      p.mesh.rotation.y = Math.atan2(-x, DISTANCIA - p.mesh.position.z);
      p.mesh.userData = { tipo: 'pagina', valor: lado };
      this.grupo.add(p.mesh);
      return p;
    });

    // Debajo: página, detalle del juego apuntado y botones
    this.pie = crearPlano(0.6, 0.05, 480);
    this.pie.mesh.position.set(0, -0.42, 0);
    this.grupo.add(this.pie.mesh);
    this.detalle = crearPlano(1.3, 0.2, 1040);
    this.detalle.mesh.position.set(0, -0.58, 0.02);
    this.grupo.add(this.detalle.mesh);
    this.botonAnterior = crearPlano(0.5, 0.07, 512);
    this.botonAnterior.mesh.userData = { tipo: 'anterior' };
    this.botonSalir = crearPlano(0.5, 0.07, 512);
    this.botonSalir.mesh.userData = { tipo: 'salir' };
    this.grupo.add(this.botonAnterior.mesh, this.botonSalir.mesh);

    this.chips = []; // se crean al abrir (dependen de los géneros y de si hay favoritos)

    // Punteros láser (los mismos mandos que el menú de pausa, con su propio rayo)
    const geoLaser = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const matLaser = new THREE.LineBasicMaterial({ color: 0xff8a62, transparent: true, opacity: 0.85 });
    this.punteros = [0, 1].map((i) => {
      const controlador = renderer.xr.getController(i);
      escena.add(controlador);
      const laser = new THREE.Line(geoLaser, matLaser);
      laser.visible = false;
      controlador.add(laser);
      return { controlador, laser, palancaAntes: 0 };
    });
    this.rayo = new THREE.Raycaster();
    this.matrizGiro = new THREE.Matrix4();
    this.delante = new THREE.Vector3();

    this.cache = new Map();   // id → { plano, imagen }
    this.encima = null;
    this.encimaJuego = null;
  }

  // datos: { juegos, indices (los que se enseñan), favoritos: Set, meGusta: Set, estadisticas, anterior: título|null }
  abrir(datos, cabezaPos, cabezaDir) {
    this.datos = datos;
    this.filtro = '*todos';
    this.pagina = 0;
    this.crearChips();
    this.pintarBotones();
    this.pintar();
    this.delante.set(cabezaDir.x, 0, cabezaDir.z);
    if (this.delante.lengthSq() < 1e-6) this.delante.set(0, 0, -1);
    this.delante.normalize();
    this.grupo.position.copy(cabezaPos).addScaledVector(this.delante, DISTANCIA);
    this.grupo.position.y = cabezaPos.y - 0.08;
    this.grupo.lookAt(cabezaPos.x, this.grupo.position.y, cabezaPos.z);
    this.grupo.visible = true;
    this.abierto = true;
  }

  cerrar() {
    this.grupo.visible = false;
    this.abierto = false;
    for (const p of this.punteros) p.laser.visible = false;
  }

  // Cuando llegan las partidas y los «me gusta» del servidor
  actualizarEstadisticas(estadisticas) {
    if (!this.datos) return;
    this.datos.estadisticas = estadisticas;
    for (const id of this.cache.keys()) this.dibujarTarjeta(this.datos.juegos.find((j) => j.id === id));
  }

  // ─── Filtros ─────────────────────────────────────────────────────────
  crearChips() {
    for (const c of this.chips) {
      this.grupo.remove(c.plano.mesh);
      c.plano.mesh.geometry.dispose();
      c.plano.mesh.material.dispose();
      c.plano.textura.dispose();
    }
    const { juegos, indices, favoritos } = this.datos;
    const generos = new Map();
    for (const i of indices) generos.set(juegos[i].generoId, juegos[i].genero);
    const opciones = [
      { id: '*todos', texto: t('inicio.todos') },
      ...(favoritos.size ? [{ id: '*favoritos', texto: `★ ${t('inicio.favoritos')}` }] : []),
      ...[...generos].map(([id, texto]) => ({ id, texto })),
    ];
    const filas = Math.ceil(opciones.length / CHIPS_POR_FILA);
    this.chips = opciones.map((o, i) => {
      const fila = Math.floor(i / CHIPS_POR_FILA);
      const enFila = Math.min(CHIPS_POR_FILA, opciones.length - fila * CHIPS_POR_FILA);
      const col = i % CHIPS_POR_FILA;
      const plano = crearPlano(ANCHO_CHIP, ALTO_CHIP, 256);
      plano.mesh.position.set((col - (enFila - 1) / 2) * (ANCHO_CHIP + 0.012), 0.56 - fila * (ALTO_CHIP + 0.012), 0);
      plano.mesh.userData = { tipo: 'filtro', valor: o.id };
      this.grupo.add(plano.mesh);
      return { ...o, plano };
    });
    // Con dos filas de filtros, la cabecera sube un poco
    this.cabecera.mesh.position.y = 0.7 + (filas - 1) * 0.03;
    this.pintarChips();
  }

  pintarChips() {
    for (const c of this.chips) {
      const { g, canvas, textura } = c.plano;
      const w = canvas.width;
      const h = canvas.height;
      const activo = c.id === this.filtro;
      const encima = this.encima === c.plano.mesh;
      g.clearRect(0, 0, w, h);
      rectRedondo(g, 2, 2, w - 4, h - 4, (h - 4) / 2);
      g.fillStyle = activo ? CORAL : encima ? '#232737' : FONDO;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = activo ? CORAL : encima ? '#ff8a62' : LINEA;
      g.stroke();
      g.fillStyle = activo ? '#1a0d07' : TEXTO;
      g.font = `600 ${Math.round(h * 0.42)}px ${FUENTE}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(c.texto, w / 2, h / 2 + 1, w * 0.88);
      textura.needsUpdate = true;
    }
  }

  lista() {
    const { juegos, indices, favoritos } = this.datos;
    return indices.filter((i) => this.filtro === '*todos'
      || (this.filtro === '*favoritos' ? favoritos.has(juegos[i].id) : juegos[i].generoId === this.filtro));
  }

  paginas() {
    return Math.max(1, Math.ceil(this.lista().length / POR_PAGINA));
  }

  // ─── Dibujo ──────────────────────────────────────────────────────────
  pintar() {
    const lista = this.lista();
    this.pagina = Math.min(this.pagina, this.paginas() - 1);
    const desde = this.pagina * POR_PAGINA;
    this.huecos.forEach((malla, k) => {
      const i = lista[desde + k];
      malla.visible = i !== undefined;
      if (i === undefined) return;
      const juego = this.datos.juegos[i];
      malla.userData.indice = i;
      malla.userData.juego = juego;
      malla.material.map = this.tarjeta(juego).textura;
      malla.material.needsUpdate = true;
    });
    // Cabecera
    {
      const { g, canvas, textura } = this.cabecera;
      const w = canvas.width;
      const h = canvas.height;
      g.clearRect(0, 0, w, h);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillStyle = TEXTO;
      g.font = `700 ${Math.round(h * 0.5)}px ${FUENTE}`;
      g.fillText('VR Play', 8, h / 2);
      const ancho = g.measureText('VR Play ').width;
      g.fillStyle = CORAL;
      g.font = `600 ${Math.round(h * 0.36)}px ${FUENTE}`;
      g.fillText(t('catalogoVR.titulo'), 8 + ancho + 10, h / 2 + 2);
      g.textAlign = 'right';
      g.fillStyle = APAGADO;
      g.fillText(t('inicio.juegosN', { n: lista.length }), w - 8, h / 2 + 2);
      textura.needsUpdate = true;
    }
    // Flechas (solo si hay más de una página)
    const varias = this.paginas() > 1;
    for (const f of this.flechas) {
      f.mesh.visible = varias;
      const { g, canvas, textura } = f;
      const w = canvas.width;
      const h = canvas.height;
      const encima = this.encima === f.mesh;
      g.clearRect(0, 0, w, h);
      rectRedondo(g, 3, 3, w - 6, h - 6, w * 0.3);
      g.fillStyle = encima ? CORAL : FONDO;
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = encima ? CORAL : LINEA;
      g.stroke();
      g.fillStyle = encima ? '#1a0d07' : TEXTO;
      g.font = `700 ${Math.round(w * 0.55)}px ${FUENTE}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(f.mesh.userData.valor < 0 ? '‹' : '›', w / 2, h / 2);
      textura.needsUpdate = true;
    }
    // Página
    {
      const { g, canvas, textura } = this.pie;
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (varias) {
        g.fillStyle = APAGADO;
        g.font = `600 ${Math.round(canvas.height * 0.6)}px ${FUENTE}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(t('catalogoVR.pagina', { n: this.pagina + 1, total: this.paginas() }), canvas.width / 2, canvas.height / 2);
      }
      textura.needsUpdate = true;
    }
    this.pintarDetalle();
  }

  // Textura de la tarjeta de un juego (portada, título, género y cifras), guardada para reutilizarla
  tarjeta(juego) {
    let e = this.cache.get(juego.id);
    if (!e) {
      const canvas = document.createElement('canvas');
      canvas.width = RES_TARJETA;
      canvas.height = Math.round((RES_TARJETA * ALTO_TARJETA) / ANCHO_TARJETA);
      const textura = new THREE.CanvasTexture(canvas);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 4;
      const imagen = new Image();
      e = { canvas, textura, imagen, lista: false };
      this.cache.set(juego.id, e);
      imagen.onload = () => {
        e.lista = true;
        this.dibujarTarjeta(juego);
      };
      imagen.src = juego.miniatura;
      this.dibujarTarjeta(juego);
    }
    return e;
  }

  dibujarTarjeta(juego) {
    const e = this.cache.get(juego?.id);
    if (!e) return;
    const { canvas, textura, imagen, lista } = e;
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const { favoritos, meGusta, estadisticas } = this.datos;
    g.clearRect(0, 0, w, h);
    rectRedondo(g, 2, 2, w - 4, h - 4, 26);
    g.fillStyle = FONDO;
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = LINEA;
    g.stroke();
    // Portada cuadrada arriba
    const m = 12;
    const lado = w - m * 2;
    g.save();
    rectRedondo(g, m, m, lado, lado, 18);
    g.clip();
    if (lista) g.drawImage(imagen, m, m, lado, lado);
    else {
      g.fillStyle = '#1a1d27';
      g.fillRect(m, m, lado, lado);
    }
    g.restore();
    // Partidas y «me gusta» sobre la portada (abajo a la izquierda, como en la web)
    const cifras = estadisticas?.[juego.id] || {};
    const insignias = [];
    if (cifras.partidas) insignias.push({ texto: `▶ ${this.corto.format(cifras.partidas)}`, color: TEXTO });
    if (cifras.meGusta) insignias.push({ texto: `♥ ${this.corto.format(cifras.meGusta)}`, color: meGusta.has(juego.id) ? '#ff7aa2' : TEXTO });
    let x = m + 10;
    g.font = `600 22px ${FUENTE}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    for (const ins of insignias) {
      const ancho = g.measureText(ins.texto).width + 20;
      rectRedondo(g, x, m + lado - 42, ancho, 32, 16);
      g.fillStyle = 'rgba(10,11,16,0.78)';
      g.fill();
      g.fillStyle = ins.color;
      g.fillText(ins.texto, x + 10, m + lado - 26);
      x += ancho + 8;
    }
    // Título (con ★ si es favorito) y género
    const yTitulo = m + lado + 34;
    g.fillStyle = TEXTO;
    g.font = `700 30px ${FUENTE}`;
    const titulo = juego.titulo + (favoritos.has(juego.id) ? '  ★' : '');
    g.fillText(titulo, m + 4, yTitulo, w - m * 2 - 8);
    g.fillStyle = APAGADO;
    g.font = `500 22px ${FUENTE}`;
    g.fillText(juego.genero, m + 4, yTitulo + 34, w - m * 2 - 8);
    textura.needsUpdate = true;
  }

  pintarDetalle() {
    const { g, canvas, textura } = this.detalle;
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    const juego = this.encimaJuego;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    if (!juego) {
      g.fillStyle = APAGADO;
      g.font = `500 ${Math.round(h * 0.17)}px ${FUENTE}`;
      g.textAlign = 'center';
      g.fillText(t('catalogoVR.apunta'), w / 2, h * 0.38);
    } else {
      g.fillStyle = TEXTO;
      g.font = `700 ${Math.round(h * 0.2)}px ${FUENTE}`;
      g.fillText(juego.titulo, 10, 4);
      const anchoTitulo = g.measureText(juego.titulo).width;
      g.fillStyle = CORAL;
      g.font = `600 ${Math.round(h * 0.15)}px ${FUENTE}`;
      g.fillText(`▶ ${t('inicio.jugar')}`, 10 + anchoTitulo + 24, 10);
      g.fillStyle = '#c9ccd8';
      g.font = `500 ${Math.round(h * 0.135)}px ${FUENTE}`;
      const lineas = partirLineas(g, juego.descripcion, w - 20, 3);
      lineas.forEach((l, i) => g.fillText(l, 10, h * 0.3 + i * h * 0.17));
      g.fillStyle = APAGADO;
      g.font = `500 ${Math.round(h * 0.12)}px ${FUENTE}`;
      g.fillText((juego.etiquetas || []).slice(0, 4).map((e) => '#' + e).join('   '), 10, h * 0.84);
    }
    textura.needsUpdate = true;
  }

  pintarBotones() {
    const { anterior } = this.datos;
    const botones = [
      ...(anterior ? [{ plano: this.botonAnterior, texto: `⟲  ${t('jugar.volverA', { juego: anterior })}` }] : []),
      { plano: this.botonSalir, texto: `✕  ${t('catalogoVR.salirVR')}` },
    ];
    this.botonAnterior.mesh.visible = !!anterior;
    botones.forEach((b, i) => {
      b.plano.mesh.position.set((i - (botones.length - 1) / 2) * 0.54, -0.76, 0.02);
      const { g, canvas, textura } = b.plano;
      const w = canvas.width;
      const h = canvas.height;
      const encima = this.encima === b.plano.mesh;
      g.clearRect(0, 0, w, h);
      rectRedondo(g, 3, 3, w - 6, h - 6, (h - 6) / 2);
      g.fillStyle = encima ? '#232737' : FONDO;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = encima ? '#ff8a62' : LINEA;
      g.stroke();
      g.fillStyle = TEXTO;
      g.font = `600 ${Math.round(h * 0.4)}px ${FUENTE}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(b.texto, w / 2, h / 2 + 1, w * 0.9);
      textura.needsUpdate = true;
    });
  }

  // ─── Cada fotograma ──────────────────────────────────────────────────
  // Devuelve { accion: { tipo: 'jugar', indice } | { tipo: 'anterior' } | { tipo: 'salir' } | null,
  //            pasar: mano que acaba de pasar por encima de algo (para vibrar) | null }
  actualizar(manos) {
    const resultado = { accion: null, pasar: null };
    if (!this.abierto) return resultado;
    const interactivos = [
      ...this.huecos.filter((m) => m.visible), ...this.chips.map((c) => c.plano.mesh),
      ...this.flechas.filter((f) => f.mesh.visible).map((f) => f.mesh),
      ...(this.botonAnterior.mesh.visible ? [this.botonAnterior.mesh] : []), this.botonSalir.mesh,
    ];
    let encima = null;
    let manoEncima = null;
    let elegido = null;
    manos.forEach((m, i) => {
      const p = this.punteros[i];
      p.laser.visible = m.activa;
      if (!m.activa) return;
      this.matrizGiro.identity().extractRotation(p.controlador.matrixWorld);
      this.rayo.ray.origin.setFromMatrixPosition(p.controlador.matrixWorld);
      this.rayo.ray.direction.set(0, 0, -1).applyMatrix4(this.matrizGiro);
      const choque = this.rayo.intersectObjects(interactivos, false)[0];
      p.laser.scale.z = choque ? choque.distance : 2;
      if (choque) {
        encima = choque.object;
        manoEncima = m;
        if (m.gatilloPulsado) elegido = choque.object;
      }
      // Palanca a los lados: página anterior o siguiente
      const ejeX = m.fuente?.gamepad?.axes?.[2] ?? 0;
      const palanca = ejeX > 0.7 ? 1 : ejeX < -0.7 ? -1 : 0;
      if (palanca && palanca !== p.palancaAntes) this.cambiarPagina(palanca);
      p.palancaAntes = palanca;
    });

    // Resaltar lo apuntado (la tarjeta se adelanta y crece un poco)
    if (encima !== this.encima) {
      this.encima = encima;
      if (encima) resultado.pasar = manoEncima;
      this.encimaJuego = encima?.userData.tipo === 'juego' ? encima.userData.juego : null;
      this.pintarChips();
      this.pintarBotones();
      this.pintar();
    }
    for (const malla of this.huecos) {
      const activo = malla === this.encima;
      malla.scale.setScalar(activo ? 1.07 : 1);
      malla.position.z = malla.userData.z + (activo ? 0.04 : 0);
      malla.renderOrder = activo ? 981 : 980; // la resaltada, por encima de sus vecinas
    }

    if (elegido) {
      const d = elegido.userData;
      if (d.tipo === 'juego') resultado.accion = { tipo: 'jugar', indice: d.indice };
      else if (d.tipo === 'filtro') {
        this.filtro = d.valor;
        this.pagina = 0;
        this.pintarChips();
        this.pintar();
      } else if (d.tipo === 'pagina') this.cambiarPagina(d.valor);
      else resultado.accion = { tipo: d.tipo };
    }
    return resultado;
  }

  cambiarPagina(sentido) {
    const n = this.paginas();
    if (n < 2) return;
    this.pagina = (this.pagina + sentido + n) % n;
    this.encima = null;
    this.encimaJuego = null;
    this.pintar();
  }
}
