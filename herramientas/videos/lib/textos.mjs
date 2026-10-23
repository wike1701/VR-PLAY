// Textos de los vídeos que no están en la web: gancho, llamada a jugar y hashtags, en ES y EN.
// Todo lo demás (título, descripción, controles, etiquetas, puntuación) sale de idiomas/ y de la
// propia partida, así que un juego nuevo no necesita nada aquí.
// No van en idiomas/ porque no son textos de la web: son de las publicaciones, y solo en ES y EN.
const TEXTOS = {
  es: {
    // Gancho de los 3 primeros segundos, según la unidad del marcador (juegos/marcadores.js)
    gancho: {
      tiempo: '¿Bajas de {texto}?',
      diferencia: '¿Ganas por más de {texto}?',
      otro: '¿Superas {texto}?',
      sinPuntuacion: '¿Cuánto aguantas?',
    },
    juegaGratis: 'Juega gratis en',
    ventajas: 'Sin descargas · Gafas VR, móvil u ordenador',
    puntuacion: 'Mi puntuación',
    lenta: 'Cámara lenta',
    // Edición pro (--estilo pro): pegatinas sobre los golpes y el rótulo del rebobinado
    pegatinas: ['¡ZAS!', '¡TOMA!', '¡BOOM!', '¡OLÉ!'],
    otraVez: 'Otra vez',
    publicacion: '{titulo}: {descripcion}\n\nYo he hecho {texto}. ¿Me superas? 👇\nJuega gratis en el navegador, sin descargar nada, con gafas VR, móvil u ordenador:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\nJuega gratis en el navegador, sin descargar nada, con gafas VR, móvil u ordenador:\n{enlace}',
    hashtags: ['#VRPlay', '#juegosVR', '#realidadvirtual', '#MetaQuest', '#juegosgratis', '#juegosonline', '#gaming'],
    // Borrador para los clips de «editar» ({frase}: la primera frase del clip)
    borrador: '{frase}\n\nJuega gratis en el navegador, sin descargar nada, con gafas VR, móvil u ordenador:\n{enlace}',
    traducir: '[Traduce la frase del clip: «{frase}»]',
  },
  en: {
    gancho: {
      tiempo: 'Can you beat {texto}?',
      diferencia: 'Can you win by more than {texto}?',
      otro: 'Can you beat {texto}?',
      sinPuntuacion: 'How long can you last?',
    },
    juegaGratis: 'Play free at',
    ventajas: 'No downloads · VR headset, phone or computer',
    puntuacion: 'My score',
    lenta: 'Slow motion',
    pegatinas: ['WHAM!', 'BOOM!', 'NICE!', 'YES!'],
    otraVez: 'Again',
    publicacion: '{titulo}: {descripcion}\n\nI got {texto}. Can you beat me? 👇\nPlay free in your browser, nothing to download, on a VR headset, phone or computer:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\nPlay free in your browser, nothing to download, on a VR headset, phone or computer:\n{enlace}',
    hashtags: ['#VRPlay', '#VRgames', '#virtualreality', '#MetaQuest', '#freegames', '#browsergames', '#gaming'],
    borrador: '{frase}\n\nPlay free in your browser, nothing to download, on a VR headset, phone or computer:\n{enlace}',
    traducir: '[Translate the clip line: «{frase}»]',
  },
};

export const DOMINIO = 'vrplaygame.com';
const rellenar = (plantilla, datos) => plantilla.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? '');

export function textosVideo(idioma) {
  if (!TEXTOS[idioma]) throw new Error(`Los vídeos solo están en ${Object.keys(TEXTOS).join(' y ')} (pediste «${idioma}»)`);
  return TEXTOS[idioma];
}

export function gancho(idioma, unidad, puntuacion) {
  const g = textosVideo(idioma).gancho;
  if (!puntuacion) return g.sinPuntuacion;
  return rellenar(g[unidad] || g.otro, { texto: puntuacion.texto });
}

// Hashtag de una etiqueta: «tiro con arco» → #tiroconarco (sin tildes, que en TikTok separan)
const hashtag = (texto) => '#' + texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');

// El texto de la publicación con 8-12 hashtags: los fijos, el título y las primeras etiquetas del juego
export function publicacion({ idioma, id, juego, puntuacion }) {
  const t = textosVideo(idioma);
  const enlace = `https://${DOMINIO}/juego/${id}?lang=${idioma}`;
  const cuerpo = rellenar(puntuacion ? t.publicacion : t.publicacionSinPuntuacion, {
    titulo: juego.titulo, descripcion: juego.descripcion, texto: puntuacion?.texto, enlace,
  });
  const etiquetas = [hashtag(juego.titulo), ...(juego.etiquetas || []).map(hashtag)];
  const todas = [...new Set([...t.hashtags, ...etiquetas].map((h) => h.toLowerCase()))]
    .map((h) => [...t.hashtags, ...etiquetas].find((x) => x.toLowerCase() === h))
    .filter((h) => h.length > 2)
    .slice(0, 12);
  return `${cuerpo}\n\n${todas.join(' ')}\n`;
}

// Borrador de publicación de un clip de «editar»: la frase del clip (o un aviso para traducirla si
// el vídeo está en otro idioma), la llamada a jugar y los hashtags fijos. Siempre para revisar a mano.
export function borradorClip({ idioma, frase, idiomaVideo }) {
  const t = textosVideo(idioma);
  const texto = idioma === idiomaVideo ? frase : rellenar(t.traducir, { frase });
  return `${rellenar(t.borrador, { frase: texto, enlace: `https://${DOMINIO}/?lang=${idioma}` })}\n\n${t.hashtags.join(' ')}\n`;
}
