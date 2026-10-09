// ─────────────────────────────────────────────────────────────────────────
// KIT GRÁFICO COMÚN
// Cosas baratas que suben mucho la calidad visual sin tocar el rendimiento:
//   - Cielo con degradado (una sola esfera) en lugar de un color plano.
//   - Mapa de entorno generado a partir de ese cielo, para que los materiales
//     MeshStandardMaterial tengan reflejos suaves y brillos.
//   - Texturas procedurales (madera, césped, grava...) dibujadas en un canvas
//     una sola vez, con mipmaps y filtrado anisótropo.
//   - Sombras "de mancha": un plano con un degradado radial bajo cada objeto.
//     Mucho más baratas que las sombras reales (que en las gafas son caras).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ─── Cielo ───────────────────────────────────────────────────────────────
const RADIO_CIELO = 80;

const sombreadorCielo = {
  uniforms: {
    cenit: { value: new THREE.Color() },
    horizonte: { value: new THREE.Color() },
    suelo: { value: new THREE.Color() },
    solDir: { value: new THREE.Vector3(0.35, 0.75, -0.55).normalize() },
    solColor: { value: new THREE.Color() },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww; // siempre al fondo, nunca tapa nada
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 cenit;
    uniform vec3 horizonte;
    uniform vec3 suelo;
    uniform vec3 solDir;
    uniform vec3 solColor;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 c = h > 0.0
        ? mix(horizonte, cenit, pow(clamp(h, 0.0, 1.0), 0.55))
        : mix(horizonte, suelo, clamp(-h * 6.0, 0.0, 1.0));
      // Halo suave alrededor del sol (o de la luz principal en escenas de noche)
      float s = max(dot(d, solDir), 0.0);
      c += solColor * (pow(s, 8.0) * 0.25 + pow(s, 400.0) * 1.5);
      gl_FragColor = vec4(c, 1.0);
      // Sin tone mapping: three.js aplica la niebla después del tone mapping, así que
      // el horizonte solo casa con la niebla si el cielo tampoco lo lleva.
      #include <colorspace_fragment>
    }`,
};

// Deriva un cielo completo (cenit, horizonte y suelo) a partir de un color.
// Los colores claros se tratan como cielo de día; los oscuros, como interior o noche.
export function coloresCielo(hex) {
  const base = new THREE.Color(hex);
  const hsl = {};
  base.getHSL(hsl);
  const dia = hsl.l > 0.45;
  const cenit = base.clone();
  const horizonte = base.clone();
  const suelo = base.clone();
  if (dia) {
    cenit.setHSL(hsl.h, Math.min(1, hsl.s * 1.2), hsl.l * 0.58);
    horizonte.setHSL(hsl.h, hsl.s * 0.9, Math.min(0.88, hsl.l * 1.06));
    suelo.setHSL(hsl.h, hsl.s * 0.3, hsl.l * 0.55);
  } else {
    cenit.setHSL(hsl.h, hsl.s, hsl.l * 0.45);
    horizonte.setHSL(hsl.h, Math.min(1, hsl.s * 1.1), Math.min(0.5, hsl.l * 1.6 + 0.03));
    suelo.setHSL(hsl.h, hsl.s, hsl.l * 0.6);
  }
  return { dia, cenit, horizonte, suelo };
}

export function crearCielo() {
  const material = new THREE.ShaderMaterial({
    ...sombreadorCielo,
    uniforms: THREE.UniformsUtils.clone(sombreadorCielo.uniforms),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(RADIO_CIELO, 32, 16), material);
  mesh.name = 'cielo';
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;

  return {
    mesh,
    // colores: { cenit, horizonte, suelo, dia } (THREE.Color o hex)
    aplicar(colores, solColor) {
      const u = material.uniforms;
      u.cenit.value.set(colores.cenit);
      u.horizonte.value.set(colores.horizonte);
      u.suelo.value.set(colores.suelo);
      u.solColor.value.set(solColor ?? (colores.dia ? 0xfff2d6 : 0x000000));
    },
    get solDir() { return material.uniforms.solDir.value; },
  };
}

// ─── Mapa de entorno ─────────────────────────────────────────────────────
// Se genera desde una copia del cielo con un "sol" brillante y una banda clara
// en el horizonte, para que el metal y el plástico tengan brillos creíbles.
export function crearGeneradorEntorno(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const escenaEntorno = new THREE.Scene();
  const cielo = crearCielo();
  cielo.mesh.material.depthTest = false;
  escenaEntorno.add(cielo.mesh);

  const foco = new THREE.Mesh(
    new THREE.SphereGeometry(6, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  escenaEntorno.add(foco);

  let actual = null;
  return {
    generar(colores, intensidadFoco = 1) {
      cielo.aplicar(colores, 0x000000);
      foco.position.copy(cielo.solDir).multiplyScalar(RADIO_CIELO * 0.7);
      foco.material.color.setScalar(colores.dia ? 6 * intensidadFoco : 3 * intensidadFoco);
      // El tone mapping no debe aplicarse dentro del mapa de entorno
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NoToneMapping;
      const rt = pmrem.fromScene(escenaEntorno, 0, 0.1, RADIO_CIELO * 2);
      renderer.toneMapping = tm;
      actual?.dispose();
      actual = rt;
      return rt.texture;
    },
  };
}

// ─── Texturas procedurales ───────────────────────────────────────────────
let anisotropia = 4;
export function configurarTexturas(renderer) {
  anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());
}

// Generador pseudoaleatorio con semilla: las texturas salen siempre iguales.
function aleatorio(semilla = 1) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Crea una textura dibujando en un canvas. dibujar(g, tam, azar) pinta en el canvas.
// repetir: cuántas veces se repite en cada eje (la textura se hace "en mosaico").
export function texturaCanvas(dibujar, { tam = 256, repetir = [1, 1], semilla = 1, color = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = tam;
  const g = canvas.getContext('2d');
  dibujar(g, tam, aleatorio(semilla));
  const textura = new THREE.CanvasTexture(canvas);
  if (color) textura.colorSpace = THREE.SRGBColorSpace;
  textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(repetir[0], repetir[1]);
  textura.anisotropy = anisotropia;
  return textura;
}

function hexCss(hex) {
  return '#' + new THREE.Color(hex).getHexString();
}

// Moteado: el color base con manchas claras y oscuras (tierra, grava, arena...).
function moteado(g, tam, azar, base, { cantidad = 1800, tamMin = 1, tamMax = 3, contraste = 0.18 } = {}) {
  g.fillStyle = hexCss(base);
  g.fillRect(0, 0, tam, tam);
  for (let i = 0; i < cantidad; i++) {
    const claro = azar() < 0.5;
    g.fillStyle = claro ? `rgba(255,255,255,${azar() * contraste})` : `rgba(0,0,0,${azar() * contraste * 1.4})`;
    const r = tamMin + azar() * (tamMax - tamMin);
    const x = azar() * tam;
    const y = azar() * tam;
    // Dibujar también en los bordes opuestos para que el mosaico no tenga cortes
    for (const dx of [0, -tam, tam]) {
      for (const dy of [0, -tam, tam]) {
        if (x + dx + r < 0 || x + dx - r > tam || y + dy + r < 0 || y + dy - r > tam) continue;
        g.beginPath();
        g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

export const texturas = {
  // Grava, arena, tierra batida...
  grano(base, opciones = {}) {
    return texturaCanvas((g, tam, azar) => moteado(g, tam, azar, base, opciones), opciones);
  },

  // Césped: briznas finas sobre un verde con variaciones suaves.
  cesped(base = 0x4caf50, opciones = {}) {
    return texturaCanvas((g, tam, azar) => {
      moteado(g, tam, azar, base, { cantidad: 120, tamMin: tam * 0.02, tamMax: tam * 0.07, contraste: 0.035 });
      for (let i = 0; i < tam * 14; i++) {
        const x = azar() * tam;
        const y = azar() * tam;
        g.strokeStyle = azar() < 0.5 ? `rgba(255,255,200,${azar() * 0.16})` : `rgba(0,30,0,${azar() * 0.2})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (azar() - 0.5) * 3, y - 2 - azar() * 4);
        g.stroke();
      }
    }, opciones);
  },

  // Madera: vetas horizontales (en la dirección U de la textura).
  madera(base = 0x8d6e63, opciones = {}) {
    return texturaCanvas((g, tam, azar) => {
      g.fillStyle = hexCss(base);
      g.fillRect(0, 0, tam, tam);
      for (let i = 0; i < 70; i++) {
        const y = azar() * tam;
        const grosor = 0.5 + azar() * 2.5;
        g.strokeStyle = azar() < 0.6 ? `rgba(40,20,5,${0.05 + azar() * 0.14})` : `rgba(255,230,190,${azar() * 0.1})`;
        g.lineWidth = grosor;
        g.beginPath();
        const ondas = 1 + Math.floor(azar() * 3);
        const amp = azar() * 4;
        const fase = azar() * Math.PI * 2;
        for (let x = 0; x <= tam; x += 8) {
          const yy = y + Math.sin((x / tam) * Math.PI * 2 * ondas + fase) * amp;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
      }
    }, opciones);
  },

  // Parquet / tarima: tablas con juntas y tonos ligeramente distintos.
  tablas(base = 0xc8935a, { tablas = 8, ...opciones } = {}) {
    return texturaCanvas((g, tam, azar) => {
      const alto = tam / tablas;
      const c = new THREE.Color(base);
      for (let i = 0; i < tablas; i++) {
        const desfase = azar() * tam;
        for (const x0 of [desfase - tam, desfase]) {
          const v = 0.9 + azar() * 0.2;
          g.fillStyle = hexCss(c.clone().multiplyScalar(v));
          g.fillRect(x0, i * alto, tam, alto);
        }
        // Vetas
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = `rgba(60,30,10,${0.04 + azar() * 0.08})`;
          g.lineWidth = 1;
          const y = i * alto + azar() * alto;
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(tam, y + (azar() - 0.5) * 2);
          g.stroke();
        }
        // Junta entre tablas
        g.fillStyle = 'rgba(40,20,5,0.35)';
        g.fillRect(0, i * alto, tam, 1);
        g.fillRect(desfase % tam, i * alto, 1, alto);
      }
    }, opciones);
  },

  // Ladrillo o azulejo: rectángulos al tresbolillo con juntas claras.
  ladrillos(base = 0x8d4b3a, junta = 0x5a4a44, { filas = 8, columnas = 4, ...opciones } = {}) {
    return texturaCanvas((g, tam, azar) => {
      g.fillStyle = hexCss(junta);
      g.fillRect(0, 0, tam, tam);
      const alto = tam / filas;
      const ancho = tam / columnas;
      const c = new THREE.Color(base);
      for (let f = 0; f < filas; f++) {
        const desfase = f % 2 ? ancho / 2 : 0;
        for (let k = -1; k <= columnas; k++) {
          g.fillStyle = hexCss(c.clone().multiplyScalar(0.85 + azar() * 0.25));
          g.fillRect(k * ancho + desfase + 1.5, f * alto + 1.5, ancho - 3, alto - 3);
        }
      }
    }, opciones);
  },

  // Tela o moqueta: trama fina.
  tela(base = 0x6d4c41, opciones = {}) {
    return texturaCanvas((g, tam, azar) => {
      moteado(g, tam, azar, base, { cantidad: 900, tamMin: 0.5, tamMax: 1.5, contraste: 0.12 });
      g.fillStyle = 'rgba(0,0,0,0.07)';
      for (let i = 0; i < tam; i += 3) {
        g.fillRect(i, 0, 1, tam);
        g.fillRect(0, i, tam, 1);
      }
    }, opciones);
  },
};

// ─── Sombras de mancha ───────────────────────────────────────────────────
// Una textura de degradado radial que comparten todas las sombras.
let texturaSombra = null;
function obtenerTexturaSombra() {
  if (texturaSombra) return texturaSombra;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  texturaSombra = new THREE.CanvasTexture(canvas);
  texturaSombra.userData.compartido = true;
  return texturaSombra;
}

const geoSombra = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
geoSombra.userData.compartido = true;

// Crea una sombra de mancha. La textura y la geometría son de la shell (liberarRecurso
// se las salta); el material es del juego y se libera con él.
export function crearSombra({ radio = 0.1, opacidad = 0.45 } = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: obtenerTexturaSombra(),
    color: 0x000000,
    transparent: true,
    opacity: opacidad,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geoSombra, material);
  mesh.scale.setScalar(radio * 2);
  mesh.renderOrder = -1;
  mesh.userData.radio = radio;
  mesh.userData.opacidad = opacidad;
  return mesh;
}

// Coloca una sombra bajo un objeto: se hace más grande y clara cuanto más alto está.
export function colocarSombra(sombra, posicion, ySuelo = 0) {
  const altura = Math.max(0, posicion.y - ySuelo);
  const f = 1 / (1 + altura * 0.9);
  sombra.position.set(posicion.x, ySuelo + 0.004, posicion.z);
  sombra.scale.setScalar(sombra.userData.radio * 2 * (1 + altura * 0.35));
  sombra.material.opacity = sombra.userData.opacidad * f;
  sombra.visible = f > 0.05;
}
