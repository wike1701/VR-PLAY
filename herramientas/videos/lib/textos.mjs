// Textos de los vídeos que no están en la web: gancho, llamada a jugar y hashtags, en los 9 idiomas
// de la web (es, en, fr, de, it, pt, ja, ko, zh).
// Todo lo demás (título, descripción, controles, etiquetas, puntuación) sale de idiomas/ y de la
// propia partida, así que un juego nuevo no necesita nada aquí.
// No van en idiomas/ porque no son textos de la web: son de las publicaciones.
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
  fr: {
    gancho: {
      tiempo: 'Tu descends sous {texto} ?',
      diferencia: 'Tu gagnes avec plus de {texto} d’écart ?',
      otro: 'Tu fais mieux que {texto} ?',
      sinPuntuacion: 'Tu tiens combien de temps ?',
    },
    juegaGratis: 'Joue gratuitement sur',
    ventajas: 'Sans téléchargement · Casque VR, mobile ou ordinateur',
    puntuacion: 'Mon score',
    lenta: 'Ralenti',
    pegatinas: ['BAM !', 'BOUM !', 'YES !', 'OUAH !'],
    otraVez: 'Encore une fois',
    publicacion: '{titulo} : {descripcion}\n\nJ’ai fait {texto}. Tu fais mieux ? 👇\nJoue gratuitement dans ton navigateur, sans rien télécharger, avec un casque VR, un mobile ou un ordinateur :\n{enlace}',
    publicacionSinPuntuacion: '{titulo} : {descripcion}\n\nJoue gratuitement dans ton navigateur, sans rien télécharger, avec un casque VR, un mobile ou un ordinateur :\n{enlace}',
    hashtags: ['#VRPlay', '#jeuxVR', '#realitevirtuelle', '#MetaQuest', '#jeuxgratuits', '#jeuxvideo', '#gaming'],
    borrador: '{frase}\n\nJoue gratuitement dans ton navigateur, sans rien télécharger, avec un casque VR, un mobile ou un ordinateur :\n{enlace}',
    traducir: '[Traduis la phrase du clip : « {frase} »]',
  },
  de: {
    gancho: {
      tiempo: 'Schaffst du es unter {texto}?',
      diferencia: 'Gewinnst du mit mehr als {texto} Vorsprung?',
      otro: 'Knackst du {texto}?',
      sinPuntuacion: 'Wie lange hältst du durch?',
    },
    juegaGratis: 'Spiel kostenlos auf',
    ventajas: 'Kein Download · VR-Brille, Handy oder Computer',
    puntuacion: 'Mein Score',
    lenta: 'Zeitlupe',
    pegatinas: ['ZACK!', 'WUMMS!', 'KRASS!', 'JAAA!'],
    otraVez: 'Nochmal',
    publicacion: '{titulo}: {descripcion}\n\nIch hab {texto} geschafft. Schlägst du das? 👇\nSpiel kostenlos im Browser, ohne Download, mit VR-Brille, Handy oder Computer:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\nSpiel kostenlos im Browser, ohne Download, mit VR-Brille, Handy oder Computer:\n{enlace}',
    hashtags: ['#VRPlay', '#VRSpiele', '#virtualreality', '#MetaQuest', '#gratisspiele', '#zocken', '#gaming'],
    borrador: '{frase}\n\nSpiel kostenlos im Browser, ohne Download, mit VR-Brille, Handy oder Computer:\n{enlace}',
    traducir: '[Übersetze den Satz aus dem Clip: „{frase}“]',
  },
  it: {
    gancho: {
      tiempo: 'Scendi sotto {texto}?',
      diferencia: 'Vinci con più di {texto} di scarto?',
      otro: 'Riesci a battere {texto}?',
      sinPuntuacion: 'Quanto resisti?',
    },
    juegaGratis: 'Gioca gratis su',
    ventajas: 'Niente download · Visore VR, telefono o computer',
    puntuacion: 'Il mio punteggio',
    lenta: 'Rallentatore',
    pegatinas: ['BAM!', 'BOOM!', 'GRANDE!', 'SÌ!'],
    otraVez: 'Ancora',
    publicacion: '{titulo}: {descripcion}\n\nIo ho fatto {texto}. Mi batti? 👇\nGioca gratis nel browser, senza scaricare niente, con visore VR, telefono o computer:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\nGioca gratis nel browser, senza scaricare niente, con visore VR, telefono o computer:\n{enlace}',
    hashtags: ['#VRPlay', '#giochiVR', '#realtavirtuale', '#MetaQuest', '#giochigratis', '#videogiochi', '#gaming'],
    borrador: '{frase}\n\nGioca gratis nel browser, senza scaricare niente, con visore VR, telefono o computer:\n{enlace}',
    traducir: '[Traduci la frase del clip: «{frase}»]',
  },
  pt: {
    gancho: {
      tiempo: 'Consegue fazer em menos de {texto}?',
      diferencia: 'Consegue ganhar por mais de {texto}?',
      otro: 'Consegue passar de {texto}?',
      sinPuntuacion: 'Quanto tempo você aguenta?',
    },
    juegaGratis: 'Jogue grátis em',
    ventajas: 'Sem downloads · Óculos VR, celular ou computador',
    puntuacion: 'Minha pontuação',
    lenta: 'Câmera lenta',
    pegatinas: ['PÁ!', 'BUM!', 'ISSO!', 'TOMA!'],
    otraVez: 'De novo',
    publicacion: '{titulo}: {descripcion}\n\nEu fiz {texto}. Consegue me superar? 👇\nJogue grátis no navegador, sem baixar nada, com óculos VR, celular ou computador:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\nJogue grátis no navegador, sem baixar nada, com óculos VR, celular ou computador:\n{enlace}',
    hashtags: ['#VRPlay', '#jogosVR', '#realidadevirtual', '#MetaQuest', '#jogosgratis', '#jogosonline', '#gaming'],
    borrador: '{frase}\n\nJogue grátis no navegador, sem baixar nada, com óculos VR, celular ou computador:\n{enlace}',
    traducir: '[Traduza a frase do clipe: “{frase}”]',
  },
  ja: {
    gancho: {
      tiempo: '{texto}を切れる？',
      diferencia: '{texto}以上の差で勝てる？',
      otro: '{texto}を超えられる？',
      sinPuntuacion: 'どこまで耐えられる？',
    },
    juegaGratis: '無料で遊べる',
    ventajas: 'ダウンロード不要 · VRヘッドセット、スマホ、PC対応',
    puntuacion: 'マイスコア',
    lenta: 'スロー',
    pegatinas: ['ドーン！', 'バシッ！', 'ナイス！', 'よっしゃ！'],
    otraVez: 'もう一回',
    publicacion: '{titulo}：{descripcion}\n\n記録は{texto}！超えられる？👇\nブラウザで無料プレイ。ダウンロード不要で、VRヘッドセット・スマホ・PCで遊べるよ：\n{enlace}',
    publicacionSinPuntuacion: '{titulo}：{descripcion}\n\nブラウザで無料プレイ。ダウンロード不要で、VRヘッドセット・スマホ・PCで遊べるよ：\n{enlace}',
    hashtags: ['#VRPlay', '#VRゲーム', '#メタクエスト', '#MetaQuest', '#無料ゲーム', '#ブラウザゲーム', '#ゲーム'],
    borrador: '{frase}\n\nブラウザで無料プレイ。ダウンロード不要で、VRヘッドセット・スマホ・PCで遊べるよ：\n{enlace}',
    traducir: '[クリップのセリフを翻訳：「{frase}」]',
  },
  ko: {
    gancho: {
      tiempo: '{texto}보다 빨리 깰 수 있어?',
      diferencia: '{texto} 이상 차이로 이길 수 있어?',
      otro: '{texto} 넘을 수 있어?',
      sinPuntuacion: '얼마나 버틸 수 있어?',
    },
    juegaGratis: '무료로 즐기는',
    ventajas: '다운로드 없이 · VR 헤드셋, 휴대폰, 컴퓨터로 플레이',
    puntuacion: '내 점수',
    lenta: '슬로 모션',
    pegatinas: ['쾅!', '퍽!', '나이스!', '좋아!'],
    otraVez: '한 번 더',
    publicacion: '{titulo}: {descripcion}\n\n내 기록은 {texto}! 이길 수 있어? 👇\n다운로드 없이 브라우저에서 무료로 플레이! VR 헤드셋, 휴대폰, 컴퓨터 다 돼:\n{enlace}',
    publicacionSinPuntuacion: '{titulo}: {descripcion}\n\n다운로드 없이 브라우저에서 무료로 플레이! VR 헤드셋, 휴대폰, 컴퓨터 다 돼:\n{enlace}',
    hashtags: ['#VRPlay', '#VR게임', '#가상현실', '#MetaQuest', '#메타퀘스트', '#무료게임', '#게임'],
    borrador: '{frase}\n\n다운로드 없이 브라우저에서 무료로 플레이! VR 헤드셋, 휴대폰, 컴퓨터 다 돼:\n{enlace}',
    traducir: '[클립 대사 번역: “{frase}”]',
  },
  zh: {
    gancho: {
      tiempo: '你能在{texto}内完成吗？',
      diferencia: '你能净胜{texto}以上吗？',
      otro: '你能超过{texto}吗？',
      sinPuntuacion: '你能撑多久？',
    },
    juegaGratis: '免费畅玩',
    ventajas: '无需下载 · VR头显、手机、电脑都能玩',
    puntuacion: '我的得分',
    lenta: '慢动作',
    pegatinas: ['砰！', '漂亮！', '爽！', '太强了！'],
    otraVez: '再来一次',
    publicacion: '{titulo}：{descripcion}\n\n我的成绩是{texto}，你能超过我吗？👇\n浏览器里免费玩，无需下载，VR头显、手机、电脑都能玩：\n{enlace}',
    publicacionSinPuntuacion: '{titulo}：{descripcion}\n\n浏览器里免费玩，无需下载，VR头显、手机、电脑都能玩：\n{enlace}',
    hashtags: ['#VRPlay', '#VR游戏', '#虚拟现实', '#MetaQuest', '#免费游戏', '#网页游戏', '#游戏'],
    borrador: '{frase}\n\n浏览器里免费玩，无需下载，VR头显、手机、电脑都能玩：\n{enlace}',
    traducir: '[翻译片段台词：“{frase}”]',
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
