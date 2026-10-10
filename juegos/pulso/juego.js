// PULSO FIRME
// El juego del alambre: pasa el aro de un extremo a otro del cable sin tocarlo.
// Si lo tocas, calambrazo y pasas al siguiente. 10 cables por ronda, cada uno
// generado al azar y más difícil que el anterior; el último se mueve un poco.
// En VR el aro va en la mano y gira con la muñeca (en las curvas hay que inclinarlo).
// Con ratón o con el dedo el aro se orienta solo y el cable es plano.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const CABLES = 10;
const TIEMPO_LIMITE = 45;        // segundos por cable
const PUNTOS_CABLE = 100;        // por completarlo, más 2 por cada segundo que sobre
const ANCHO = 1.0;               // distancia entre los dos postes
const Z_CABLE = -0.38;           // el cable queda a un brazo de distancia
const Y_MESA = 0.8;
const Y_MIN = 0.98;              // alturas permitidas para el cable
const Y_MAX = 1.6;
const TRAMO_SEGURO = 0.09;       // zonas de salida (verde) y llegada (dorada), sin corriente
const RADIO_CABLE = 0.0045;
const GROSOR_ARO = 0.005;        // radio del alambre del aro
const CONTACTO = RADIO_CABLE + GROSOR_ARO;
const SEPARACION = 0.004;        // distancia entre los puntos con los que se comprueba el choque
const LARGO_MANGO = 0.16;        // del puño al aro
const VELOCIDAD_RATON = 0.9;     // m/s máximos del aro con ratón (si no, sería demasiado fácil)
const DESVIO_TACTIL = 0.15;      // con el dedo, el aro va un poco por encima para que el dedo no lo tape
// El aro se hace más pequeño cable a cable
const radioAro = (nivel) => 0.045 - 0.015 * (nivel / (CABLES - 1));

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x30343f);
  ctx.sueloBase(false);
  // Sin gafas miramos el cable un poco de lado: de frente, el aro se vería de canto
  if (ctx.tactil) ctx.vistaEscritorio(new THREE.Vector3(-0.22, 1.5, 0.62), new THREE.Vector3(0.0, 1.3, -0.45));
  else ctx.vistaEscritorio(new THREE.Vector3(-0.45, 1.55, 0.8), new THREE.Vector3(0.08, 1.36, -0.5));

  // ─── Taller ────────────────────────────────────────────────────────────
  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  const suelo = new THREE.Mesh(
    escalarUV(R(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2)), 10 / 3),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x9a7350, { semilla: 12 })) })),
  );
  raiz.add(suelo);
  const matPared = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x8d5a48, 0x5a4a44, { semilla: 4 })) }));
  const pared = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(8, 3.5)), 8 / 2.5, 3.5 / 2.5), matPared);
  pared.position.set(0, 1.75, -2.4);
  raiz.add(pared);
  for (const s of [-1, 1]) {
    const lado = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(6, 3.5)), 6 / 2.5, 3.5 / 2.5), matPared);
    lado.rotation.y = -s * Math.PI / 2;
    lado.position.set(s * 3, 1.75, 0.6);
    raiz.add(lado);
  }

  // Banco de trabajo
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8d6e63, { semilla: 9 })) }));
  const tablero = new THREE.Mesh(R(new THREE.BoxGeometry(1.5, 0.05, 0.55)), matMadera);
  tablero.position.set(0, Y_MESA - 0.025, Z_CABLE);
  raiz.add(tablero);
  const geoPata = R(new THREE.BoxGeometry(0.06, Y_MESA - 0.05, 0.06));
  const matPata = R(new THREE.MeshLambertMaterial({ color: 0x4e342e }));
  for (const x of [-0.68, 0.68]) {
    for (const z of [Z_CABLE - 0.22, Z_CABLE + 0.22]) {
      const pata = new THREE.Mesh(geoPata, matPata);
      pata.position.set(x, (Y_MESA - 0.05) / 2, z);
      raiz.add(pata);
    }
  }
  // Caja del zumbador con su bombilla
  const caja = new THREE.Mesh(R(new THREE.BoxGeometry(0.2, 0.09, 0.12)), R(new THREE.MeshLambertMaterial({ color: 0xc62828 })));
  caja.position.set(0, Y_MESA + 0.045, Z_CABLE - 0.17);
  raiz.add(caja);
  const matBombilla = R(new THREE.MeshStandardMaterial({ color: 0xfff8e1, emissive: 0x000000, roughness: 0.2, transparent: true, opacity: 0.9 }));
  const bombilla = new THREE.Mesh(R(new THREE.SphereGeometry(0.035, 16, 12)), matBombilla);
  bombilla.position.set(0, Y_MESA + 0.125, Z_CABLE - 0.17);
  raiz.add(bombilla);
  let luzBombilla = 0;
  const colorBombilla = new THREE.Color();

  // ─── Cable (se genera de nuevo en cada nivel) ──────────────────────────
  // El grupo se puede reflejar (scale.x = -1) para que la salida quede en el lado del aro,
  // y en el último nivel se mueve. Los choques se calculan en su espacio local.
  const grupoCable = new THREE.Group();
  raiz.add(grupoCable);
  const matCable = R(new THREE.MeshStandardMaterial({ color: 0xd08a4a, metalness: 0.85, roughness: 0.3 }));
  const matSalida = R(new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 }));
  const matLlegada = R(new THREE.MeshStandardMaterial({ color: 0xffc400, metalness: 0.4, roughness: 0.4 }));
  const matPoste = R(new THREE.MeshLambertMaterial({ color: 0x37474f }));
  const geoPoste = R(new THREE.CylinderGeometry(0.012, 0.016, 1, 10));
  const postes = [0, 1].map(() => {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    grupoCable.add(poste);
    return poste;
  });
  let mallas = [];   // tubos del cable actual (se liberan al cambiar de cable)
  let puntos = [];   // puntos del cable cada SEPARACION metros, en espacio local
  let tangentes = [];
  let iInicio = 0;   // a partir de aquí hay corriente…
  let iFin = 0;      // …y aquí empieza la llegada

  // Tramos con formas distintas; u va de 0 a 1 y la forma devuelve [dy, dz] respecto al inicio del tramo.
  // Todas empiezan en 0; "fin" es la altura con la que acaban. La inclinación se limita según
  // lo ancho que es el tramo: así el cable nunca pasa tan cerca de sí mismo que no quepa el aro.
  const PENDIENTE = 1.1;          // ~48°
  const PENDIENTE_TIRABUZON = 1.6;
  function elegirTramo(d, vr, largo) {
    const azar = Math.random;
    const signo = () => (azar() < 0.5 ? -1 : 1);
    const opciones = ['onda', 'escalon'];
    if (d >= 0.2) opciones.push('zigzag');
    if (d >= 0.25 && vr) opciones.push('profundidad');
    if (d >= 0.45) opciones.push('tirabuzon', 'zigzag');
    const tipo = opciones[Math.floor(azar() * opciones.length)];
    switch (tipo) {
      case 'onda': {
        const m = 1 + Math.floor(azar() * (1 + 2 * d));
        const a = signo() * Math.min(0.05 + 0.1 * d, (PENDIENTE * largo) / (Math.PI * m));
        return { pasos: 30, fin: 0, forma: (u) => [a * Math.sin(Math.PI * m * u), 0] };
      }
      case 'zigzag': {
        const m = 2 + Math.floor(azar() * 2);
        const a = signo() * Math.min(0.05 + 0.1 * d, (PENDIENTE * largo) / (2 * m));
        return { pasos: 40, fin: 0, forma: (u) => [a * (1 - Math.abs(2 * ((u * m) % 1) - 1)), 0] };
      }
      case 'escalon': {
        const h = signo() * Math.min(0.1 + 0.12 * d, (PENDIENTE * 0.4 * largo) / 1.5);
        return { pasos: 24, fin: h, forma: (u) => [h * THREE.MathUtils.smoothstep(u, 0.3, 0.7), 0] };
      }
      case 'profundidad': {
        // El cable se acerca o se aleja de ti: hay que girar la muñeca
        const p = signo() * Math.min(0.08 + 0.07 * d, (PENDIENTE * largo) / Math.PI);
        const a = signo() * 0.03;
        return { pasos: 30, fin: 0, forma: (u) => [a * Math.sin(Math.PI * u), p * Math.sin(Math.PI * u)] };
      }
      case 'tirabuzon': {
        // Una vuelta alrededor del eje del cable (con ratón se ve como una onda)
        const r = Math.min(0.035 + 0.02 * d, (PENDIENTE_TIRABUZON * largo) / (2 * Math.PI));
        const giro = signo();
        return {
          pasos: 40,
          fin: 0,
          forma: (u) => {
            const a = 2 * Math.PI * u;
            return [giro * r * Math.sin(a), vr ? r * (Math.cos(a) - 1) : 0];
          },
        };
      }
    }
    return null;
  }

  // Media móvil de las posiciones (los extremos no se mueven)
  function suavizar(lista, ventana, pasadas) {
    let actual = lista;
    for (let pasada = 0; pasada < pasadas; pasada++) {
      actual = actual.map((p, i) => {
        const w = Math.min(ventana, i, actual.length - 1 - i);
        const media = new THREE.Vector3();
        for (let k = i - w; k <= i + w; k++) media.add(actual[k]);
        return media.divideScalar(2 * w + 1);
      });
    }
    return actual;
  }

  function generarCable(nivel, vr) {
    for (const m of mallas) {
      grupoCable.remove(m);
      m.geometry.dispose();
    }
    const d = nivel / (CABLES - 1);
    const x0 = -ANCHO / 2;
    const x1 = ANCHO / 2;
    const control = [];
    let y = 1.22 + (Math.random() - 0.5) * 0.12;
    const poner = (x, yy, dz) => control.push(new THREE.Vector3(x, THREE.MathUtils.clamp(yy, Y_MIN, Y_MAX), Z_CABLE + dz));
    poner(x0, y, 0);
    poner(x0 + TRAMO_SEGURO, y, 0);
    const xa = x0 + TRAMO_SEGURO + 0.03;
    const xb = x1 - TRAMO_SEGURO - 0.03;
    const tramos = 2 + Math.round(d * 2);
    const largo = (xb - xa) / tramos;
    for (let k = 0; k < tramos; k++) {
      const tramo = elegirTramo(d, vr, largo);
      // Que el escalón no se salga de las alturas permitidas
      if (y + tramo.fin > Y_MAX - 0.05 || y + tramo.fin < Y_MIN + 0.05) {
        const forma = tramo.forma;
        tramo.forma = (u) => { const [dy, dz] = forma(u); return [-dy, dz]; };
        tramo.fin = -tramo.fin;
      }
      for (let i = 1; i <= tramo.pasos; i++) {
        const u = i / tramo.pasos;
        const [dy, dz] = tramo.forma(u);
        poner(xa + (k + u) * largo, y + dy, dz);
      }
      y = THREE.MathUtils.clamp(y + tramo.fin, Y_MIN, Y_MAX);
    }
    poner(x1 - TRAMO_SEGURO, y, 0);
    poner(x1, y, 0);
    // Une el primer tramo recto con el primer punto de las formas
    control.splice(2, 0, new THREE.Vector3(xa, control[1].y, Z_CABLE));

    const curva = new THREE.CatmullRomCurve3(control, false, 'centripetal');
    const n = Math.max(50, Math.round(curva.getLength() / SEPARACION));
    // Redondeamos las esquinas (unos 2-3 cm): una esquina en punta cruzaría el aro
    // aunque lo llevaras perfecto
    puntos = suavizar(curva.getSpacedPoints(n), 6, 2);
    tangentes = puntos.map((p, i) => {
      const a = puntos[Math.max(0, i - 1)];
      const b = puntos[Math.min(puntos.length - 1, i + 1)];
      return new THREE.Vector3().subVectors(b, a).normalize();
    });
    iInicio = puntos.findIndex((p) => p.x >= x0 + TRAMO_SEGURO);
    iFin = puntos.findIndex((p) => p.x >= x1 - TRAMO_SEGURO);

    const tubo = (desde, hasta, radio, material, lados) => {
      const trozo = new THREE.CatmullRomCurve3(puntos.slice(desde, hasta + 1));
      const malla = new THREE.Mesh(new THREE.TubeGeometry(trozo, Math.max(4, Math.round((hasta - desde) / 2)), radio, lados), material);
      grupoCable.add(malla);
      mallas.push(malla);
    };
    mallas = [];
    tubo(0, puntos.length - 1, RADIO_CABLE, matCable, 6);
    tubo(0, iInicio, 0.011, matSalida, 10);
    tubo(iFin, puntos.length - 1, 0.011, matLlegada, 10);

    // Postes de la mesa a cada extremo (largos: en el último nivel el cable sube y baja)
    for (const [poste, p] of [[postes[0], puntos[0]], [postes[1], puntos[puntos.length - 1]]]) {
      const alto = p.y - Y_MESA + 0.08;
      poste.scale.y = alto;
      poste.position.set(p.x, p.y - alto / 2, p.z);
    }
  }

  // ─── Aros ──────────────────────────────────────────────────────────────
  // Varita: puño en el origen, mango hacia delante (-Z) y el aro al final.
  // El aro está en el plano YZ: su eje (por donde pasa el cable) es el X local.
  const geosAro = Array.from({ length: CABLES }, (_, i) => R(new THREE.TorusGeometry(radioAro(i), GROSOR_ARO, 8, 40).rotateY(Math.PI / 2)));
  const matAro = R(new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.9, roughness: 0.25 }));
  const geoMango = R(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 12).rotateX(Math.PI / 2).translate(0, 0, -0.01));
  const matMango = R(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.7 }));
  const geoVarilla = R(new THREE.CylinderGeometry(0.004, 0.004, 1, 6).rotateX(Math.PI / 2));

  function crearVarita() {
    const varita = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matMango);
    const varilla = new THREE.Mesh(geoVarilla, matAro);
    const aro = new THREE.Mesh(geosAro[0], matAro);
    varita.add(mango, varilla, aro);
    varita.userData = { varilla, aro };
    return varita;
  }
  function ajustarVarita(varita, nivel) {
    const r = radioAro(nivel);
    const { varilla, aro } = varita.userData;
    aro.geometry = geosAro[nivel];
    aro.position.z = -(LARGO_MANGO + r);
    // La varilla va del mango hasta el borde del aro
    varilla.scale.z = LARGO_MANGO - 0.05;
    varilla.position.z = -(0.05 + LARGO_MANGO) / 2;
  }

  const varitasVR = ctx.manos.map((mano) => ({ mano, objeto: ctx.adjuntarAMano(mano, crearVarita()) }));
  let ladoAro = 'right';
  const varitaRaton = crearVarita();
  raiz.add(varitaRaton);

  // ─── Chispas ───────────────────────────────────────────────────────────
  const geoChispa = R(new THREE.BoxGeometry(0.006, 0.006, 0.02));
  const matChispa = R(new THREE.MeshBasicMaterial({ color: 0xffe082 }));
  const chispas = Array.from({ length: 24 }, () => {
    const malla = new THREE.Mesh(geoChispa, matChispa);
    malla.visible = false;
    raiz.add(malla);
    return { malla, vel: new THREE.Vector3(), vida: 0 };
  });
  function soltarChispas(punto) {
    for (const c of chispas) {
      c.malla.position.copy(punto);
      c.vel.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(0.8 + Math.random() * 1.6);
      c.malla.lookAt(tmp.copy(punto).add(c.vel));
      c.vida = 0.3 + Math.random() * 0.35;
      c.malla.visible = true;
    }
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.4 });
  marcador.mesh.position.set(0, 1.98, -1.0);
  marcador.mesh.rotation.x = 0.12;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'esperando' | 'listo' | 'recorrido' | 'resultado' | 'fin'
  let reloj = 3;
  let nivel = 0;
  let resultados = [];  // { completado, tiempo, progreso, puntos }
  let record = ctx.leer('record', 0);
  let tiempo = 0;       // del cable actual
  let progreso = 0;     // 0..1
  let indice = 0;       // punto del cable más cercano al aro
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let modoCable = null; // true si el cable actual se generó para VR
  let cerca = 0;        // 0..1: lo cerca que está el aro del cable (para el zumbido)
  let siguienteVibracion = 0;
  const zumbido = ctx.sonidoContinuo('zumbido');

  // Aro en el espacio del cable: centro y eje, en este fotograma y en el anterior
  const aro = { centro: new THREE.Vector3(), eje: new THREE.Vector3(1, 0, 0), centroAnterior: new THREE.Vector3(), ejeAnterior: new THREE.Vector3(1, 0, 0), listo: false, mano: null };
  const destinoRaton = new THREE.Vector3(0, 1.2, Z_CABLE);
  const posRaton = new THREE.Vector3(-ANCHO / 2 - 0.15, 1.2, Z_CABLE);
  const planoCable = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_CABLE);
  const rayoTactil = new THREE.Raycaster();
  const ndcTactil = new THREE.Vector2();
  const inversa = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e = new THREE.Vector3();
  const v = new THREE.Vector3();
  const base = new THREE.Matrix4();

  const total = () => resultados.reduce((s, r) => s + r.puntos, 0);
  const fila = () => Array.from({ length: CABLES }, (_, i) => (i < resultados.length ? (resultados[i].completado ? '✔' : '✘') : '·')).join(' ');

  function actualizarMarcador() {
    const pie = { texto: `${fila()}   ·   ${total()} puntos   ·   Récord: ${record}`, tam: 0.75, color: '#ffe082' };
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'PULSO FIRME', tam: 1.3, color: '#ffe082' },
        { texto: 'Lleva el aro de la zona verde a la dorada sin tocar el cable', tam: 0.75 },
        { texto: `${CABLES} cables · ${TIEMPO_LIMITE} s cada uno · Récord: ${record}`, tam: 0.75, color: '#ffe082' },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Fin! ${total()} puntos`, tam: 1.3, color: '#ffe082' },
        { texto: `${resultados.filter((r) => r.completado).length} de ${CABLES} cables completados`, tam: 0.75 },
        { texto: `${fila()}   ·   Récord: ${record} · otra ronda en ${Math.ceil(reloj)}`, tam: 0.75, color: '#ffe082' },
      ]);
    } else if (estado === 'resultado') {
      marcador.escribir([{ texto: mensaje, tam: 1.3, color: colorMensaje }, { texto: `Cable ${nivel + 1} de ${CABLES}`, tam: 0.75 }, pie]);
    } else if (estado === 'recorrido') {
      const queda = TIEMPO_LIMITE - tiempo;
      marcador.escribir([
        { texto: `${tiempo.toFixed(1)} s`, tam: 1.3, color: queda < 10 ? '#ff8a80' : '#ffffff' },
        { texto: `Cable ${nivel + 1} de ${CABLES} · ${Math.round(progreso * 100)} % · quedan ${Math.ceil(queda)} s`, tam: 0.75 },
        pie,
      ]);
    } else {
      let ayuda;
      if (ctx.enVR()) {
        ayuda = estado === 'listo' ? '¡Adelante! El tiempo empieza al salir de la zona verde' : 'Mete el aro en la zona verde · el gatillo de la otra mano cambia de mano';
      } else {
        ayuda = estado === 'listo' ? '¡Adelante! El tiempo empieza al salir de la zona verde' : `${ctx.tactil ? 'Arrastra' : 'Lleva'} el aro hasta la zona verde`;
      }
      marcador.escribir([
        { texto: nivel === CABLES - 1 ? `Último cable: ¡se mueve!` : `Cable ${nivel + 1} de ${CABLES}`, tam: 1.3, color: nivel === CABLES - 1 ? '#ffab40' : '#ffffff' },
        { texto: ayuda, tam: 0.75 },
        pie,
      ]);
    }
  }

  // ─── Niveles ───────────────────────────────────────────────────────────
  function prepararCable() {
    modoCable = ctx.enVR();
    generarCable(nivel, modoCable);
    for (const vv of varitasVR) ajustarVarita(vv.objeto, nivel);
    ajustarVarita(varitaRaton, nivel);
    estado = 'esperando';
    tiempo = 0;
    progreso = 0;
    indice = 0;
    moverCable();
  }

  // Último cable: sube, baja y se balancea un poco alrededor de su centro.
  // Los demás, quietos.
  let reloj2 = 0; // tiempo total, para el movimiento del cable
  function moverCable() {
    if (nivel !== CABLES - 1) {
      grupoCable.position.set(0, 0, 0);
      grupoCable.rotation.set(0, 0, 0);
      return;
    }
    const giro = 0.035 * Math.sin(reloj2 * 1.3);
    const yCentro = 1.25;
    // Girar alrededor de (0, yCentro): posición = centro − giro(centro)
    grupoCable.rotation.set(0, 0, giro);
    grupoCable.position.set(
      yCentro * Math.sin(giro),
      yCentro * (1 - Math.cos(giro)) + 0.035 * Math.sin(reloj2 * 1.9),
      modoCable ? 0.02 * Math.sin(reloj2 * 1.1) : 0,
    );
  }

  function terminar(completado, punto) {
    const puntosCable = completado ? PUNTOS_CABLE + Math.round(Math.max(0, TIEMPO_LIMITE - tiempo) * 2) : 0;
    resultados.push({ completado, tiempo, progreso, puntos: puntosCable });
    estado = 'resultado';
    reloj = 2.4;
    zumbido.ajustar(0, 0);
    if (completado) {
      mensaje = `¡Completado! ${tiempo.toFixed(1)} s · +${puntosCable}`;
      colorMensaje = '#b9f6ca';
      ctx.sonido('boton');
      ctx.destello(0xffc400, 0.25);
      luzBombilla = 1;
      colorBombilla.setHex(0x69f0ae);
    } else {
      mensaje = punto ? `¡Calambrazo! Al ${Math.round(progreso * 100)} %` : `¡Tiempo! Al ${Math.round(progreso * 100)} %`;
      colorMensaje = '#ff8a80';
      if (punto) {
        ctx.sonido('calambre');
        ctx.destello(0xff1744, 0.45);
        soltarChispas(punto);
        luzBombilla = 1;
        colorBombilla.setHex(0xff1744);
        if (aro.mano) ctx.vibrar(aro.mano, 1, 450);
      } else {
        ctx.sonido('fallo');
      }
    }
  }

  // ─── Posición del aro ──────────────────────────────────────────────────
  function moverAro(dt) {
    const enVR = ctx.enVR();
    if (enVR) {
      varitaRaton.visible = false;
      const activas = ctx.manos.filter((m) => m.activa);
      // Cambiar de mano solo antes de empezar el cable
      if (estado !== 'recorrido' && estado !== 'listo') {
        for (const m of activas) {
          if (m.gatilloPulsado && (m.lado === 'left' || m.lado === 'right') && m.lado !== ladoAro) {
            ladoAro = m.lado;
            ctx.sonido('tic');
          }
        }
      }
      const mano = activas.find((m) => m.lado === ladoAro) || activas[0] || null;
      for (const vv of varitasVR) vv.objeto.visible = vv.mano === mano;
      // La salida queda en el lado de la mano del aro
      if (estado !== 'recorrido' && estado !== 'listo') grupoCable.scale.x = (mano?.lado ?? ladoAro) === 'left' ? 1 : -1;
      if (!mano) {
        aro.listo = false;
        aro.mano = null;
        return false;
      }
      if (mano !== aro.mano) aro.listo = false;
      aro.mano = mano;
      mano.grip.updateMatrixWorld(true);
      c.set(0, 0, -(LARGO_MANGO + radioAro(nivel)));
      mano.grip.localToWorld(c);
      e.set(1, 0, 0).transformDirection(mano.grip.matrixWorld);
    } else {
      aro.mano = null;
      grupoCable.scale.x = 1;
      const raton = ctx.raton;
      let rayo = raton.rayo;
      if (ctx.tactil) {
        ndcTactil.set(raton.ndc.x, raton.ndc.y + DESVIO_TACTIL);
        rayoTactil.setFromCamera(ndcTactil, ctx.camara);
        rayo = rayoTactil;
      }
      planoCable.constant = -(Z_CABLE + grupoCable.position.z);
      if (raton.dentro && rayo.ray.intersectPlane(planoCable, tmp)) destinoRaton.copy(tmp);
      // El aro va hacia el ratón con velocidad limitada
      const paso = tmp2.subVectors(destinoRaton, posRaton);
      const maximo = VELOCIDAD_RATON * dt;
      if (paso.length() > maximo) paso.setLength(maximo);
      posRaton.add(paso);
      c.copy(posRaton);
      // El aro se orienta solo: su eje sigue al cable
      grupoCable.updateMatrixWorld(true);
      inversa.copy(grupoCable.matrixWorld).invert();
      const local = tmp.copy(c).applyMatrix4(inversa);
      const i = masCercano(local, 0, puntos.length - 1).i;
      e.copy(estado === 'esperando' && local.distanceTo(puntos[i]) > radioAro(nivel) ? tmp2.set(1, 0, 0) : tangentes[i]).transformDirection(grupoCable.matrixWorld);
      // Varita: mango hacia la cámara, aro con su eje en la dirección del cable
      tmp.set(0, 0, 1);
      tmp2.crossVectors(tmp, e).normalize();
      base.makeBasis(e, tmp2, tmp);
      varitaRaton.quaternion.setFromRotationMatrix(base);
      varitaRaton.position.copy(c).addScaledVector(tmp, LARGO_MANGO + radioAro(nivel));
      varitaRaton.visible = raton.dentro || estado === 'recorrido';
    }
    // Al espacio del cable
    grupoCable.updateMatrixWorld(true);
    inversa.copy(grupoCable.matrixWorld).invert();
    aro.centro.copy(c).applyMatrix4(inversa);
    aro.eje.copy(e).transformDirection(inversa);
    if (!aro.listo) {
      aro.centroAnterior.copy(aro.centro);
      aro.ejeAnterior.copy(aro.eje);
      aro.listo = true;
    }
    return true;
  }

  // Punto del cable más cercano a p entre los índices desde..hasta
  function masCercano(p, desde, hasta) {
    let mejor = Infinity;
    let i = desde;
    for (let k = Math.max(0, desde); k <= Math.min(puntos.length - 1, hasta); k++) {
      const d2 = puntos[k].distanceToSquared(p);
      if (d2 < mejor) {
        mejor = d2;
        i = k;
      }
    }
    return { i, d: Math.sqrt(mejor) };
  }

  // Distancia más corta del cable (con corriente) al alambre del aro, y dónde.
  // Distancia de un punto a una circunferencia (centro, eje, radio): √(h² + (ρ − r)²).
  const contacto = new THREE.Vector3();
  function distanciaAlAro(centro, eje, r) {
    let minima = Infinity;
    const alcance = (r + 0.03) ** 2;
    for (let k = iInicio; k <= iFin; k++) {
      const p = puntos[k];
      if (p.distanceToSquared(centro) > alcance) continue;
      v.subVectors(p, centro);
      const h = v.dot(eje);
      const rho = Math.sqrt(Math.max(0, v.lengthSq() - h * h));
      const d = Math.sqrt(h * h + (rho - r) ** 2);
      if (d < minima) {
        minima = d;
        contacto.copy(p);
      }
    }
    return minima;
  }

  // ¿Pasa el cable por dentro del aro cerca de la salida?
  function enhebradoEnSalida(centro, eje, r) {
    const { i, d } = masCercano(centro, 0, iInicio + 5);
    return d < r - CONTACTO && Math.abs(eje.dot(tangentes[i])) > 0.3;
  }

  // Avanza el aro por subpasos (para que un movimiento rápido no atraviese el cable)
  function comprobar() {
    const r = radioAro(nivel);
    const movimiento = aro.centro.distanceTo(aro.centroAnterior);
    const giro = aro.eje.angleTo(aro.ejeAnterior);
    const pasos = Math.min(24, Math.max(1, Math.ceil(Math.max(movimiento / 0.004, giro / 0.06))));
    let minimo = Infinity;
    for (let k = 1; k <= pasos; k++) {
      const f = k / pasos;
      tmp.lerpVectors(aro.centroAnterior, aro.centro, f);
      tmp2.lerpVectors(aro.ejeAnterior, aro.eje, f).normalize();

      if (estado === 'esperando') {
        if (enhebradoEnSalida(tmp, tmp2, r)) {
          estado = 'listo';
          indice = masCercano(tmp, 0, iInicio).i;
          ctx.sonido('tic');
        }
        continue;
      }
      // Seguimos el avance del aro a lo largo del cable (cerca del punto anterior,
      // para no saltar entre vueltas del tirabuzón)
      const cercano = masCercano(tmp, indice - 40, indice + 40);
      indice = cercano.i;
      const fuera = cercano.d > r - CONTACTO * 0.5; // el cable ya no pasa por dentro del aro

      if (estado === 'listo') {
        if (fuera && indice <= iInicio) {
          estado = 'esperando';
          continue;
        }
        if (indice > iInicio) {
          estado = 'recorrido';
          tiempo = 0;
        } else {
          continue;
        }
      }
      // Recorrido. Si se saca el aro por la zona verde, el cable vuelve a empezar (sin penalizar)
      if (fuera && indice <= iInicio) {
        estado = 'esperando';
        tiempo = 0;
        progreso = 0;
        return Infinity;
      }
      const d = distanciaAlAro(tmp, tmp2, r);
      minimo = Math.min(minimo, d);
      if (d < CONTACTO) {
        terminar(false, contacto.clone().applyMatrix4(grupoCable.matrixWorld));
        return Infinity;
      }
      if (fuera && indice > iInicio && indice < iFin) {
        terminar(false, puntos[indice].clone().applyMatrix4(grupoCable.matrixWorld));
        return Infinity;
      }
      progreso = THREE.MathUtils.clamp((indice - iInicio) / (iFin - iInicio), 0, 1);
      if (indice >= iFin) {
        progreso = 1;
        terminar(true);
        return Infinity;
      }
    }
    return minimo;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarRonda() {
    nivel = 0;
    resultados = [];
    prepararCable();
  }

  function actualizar(dt, t) {
    reloj -= dt;

    // Si se entra o se sale de VR a mitad de un cable, se genera de nuevo sin penalizar
    if (modoCable !== null && modoCable !== ctx.enVR() && ['esperando', 'listo', 'recorrido'].includes(estado)) prepararCable();

    reloj2 = t;
    if (estado !== 'fin') moverCable();

    const hayAro = moverAro(dt);
    let minimo = Infinity;
    if (hayAro && ['esperando', 'listo', 'recorrido'].includes(estado)) minimo = comprobar();
    if (hayAro) {
      aro.centroAnterior.copy(aro.centro);
      aro.ejeAnterior.copy(aro.eje);
    }

    switch (estado) {
      case 'intro':
        if (reloj <= 0) estado = 'esperando'; // el primer cable ya está puesto
        break;
      case 'recorrido':
        tiempo += dt;
        if (tiempo >= TIEMPO_LIMITE) terminar(false, null);
        break;
      case 'resultado':
        if (reloj <= 0) {
          nivel++;
          if (nivel >= CABLES) {
            estado = 'fin';
            reloj = 8;
            if (total() > record) {
              record = total();
              ctx.guardar('record', record);
            }
            ctx.sonido('fin');
          } else {
            prepararCable();
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) empezarRonda();
        break;
    }

    // Zumbido y vibración: más fuertes cuanto más cerca del cable
    cerca = estado === 'recorrido' && minimo < Infinity ? THREE.MathUtils.clamp(1 - (minimo - CONTACTO) / 0.02, 0, 1) : 0;
    zumbido.ajustar(cerca, estado === 'recorrido' ? 0.02 + cerca * 0.13 : 0);
    if (aro.mano && cerca > 0.25 && t >= siguienteVibracion) {
      ctx.vibrar(aro.mano, 0.05 + cerca * 0.35, 30);
      siguienteVibracion = t + 0.09;
    }

    // Bombilla y chispas
    luzBombilla = Math.max(0, luzBombilla - dt * 1.2);
    matBombilla.emissive.copy(colorBombilla).multiplyScalar(luzBombilla);
    for (const ch of chispas) {
      if (ch.vida <= 0) continue;
      ch.vida -= dt;
      ch.vel.y -= 6 * dt;
      ch.malla.position.addScaledVector(ch.vel, dt);
      ch.malla.visible = ch.vida > 0;
    }

    actualizarMarcador();
  }

  prepararCable();
  estado = 'intro';
  reloj = 3;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      zumbido.parar();
      for (const m of mallas) m.geometry.dispose();
      mallas = [];
    },
  };
}
