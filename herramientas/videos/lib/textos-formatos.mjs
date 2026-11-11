// Textos de los formatos de varios juegos (lib/formatos.mjs): anuncio, top, reto, duelo y foro.
// Como lib/textos.mjs, no van en idiomas/ porque no son de la web. {n}, {juego}, {valor}… se
// rellenan al montar. En las líneas de rótulo, un objeto { texto, caja: true } va en caja de color.
// Los títulos de los juegos salen de idiomas/<idioma>.js. Si falta un idioma, se usa el inglés.
export const TEXTOS_FORMATOS = {
  es: {
    anuncio: {
      ganchos: [
        ['¿Juegos de VR', { texto: 'SIN DESCARGAR', caja: true }, 'NADA? 🤯'],
        ['POV:', 'abres una web…', { texto: 'y ya estás en VR', caja: true }],
        ['+{n} juegos de VR', { texto: 'GRATIS', caja: true }, 'y nadie lo sabe 🤫'],
      ],
      frases: [
        ['Abres la web…', { texto: 'y JUEGAS 🎮', caja: true }],
        ['Cambias de juego', { texto: 'SIN QUITARTE', caja: true }, { texto: 'LAS GAFAS 🥽', caja: true }],
        ['Meta Quest 🥽', 'Móvil 📱', { texto: 'y PC 💻', caja: true }],
        [{ texto: '+{n} JUEGOS', caja: true }, { texto: 'GRATIS 🔥', caja: true }],
      ],
      titulo: '+{n} juegos VR gratis',
      publicacion: '¿Sabías que puedes jugar a +{n} juegos de VR gratis sin descargar nada? 🤯\nFunciona en las gafas (Meta Quest), en el móvil y en el ordenador: {enlace}',
    },
    top: {
      gancho: ['Los 5 juegos de VR', { texto: 'MÁS JUGADOS', caja: true }, 'en VR Play 👇'],
      dato: '{n} partidas',
      suspense: ['Y el número 1…', { texto: '¿lo adivinas? 👀', caja: true }],
      titulo: 'El top 5 de VR Play',
      publicacion: 'Los 5 juegos más jugados de VR Play 🏆 ¿Cuál es tu favorito? 👇\nTodos gratis, en el navegador de tus gafas, el móvil o el ordenador: {enlace}',
    },
    reto: {
      gancho: ['El récord de', { texto: '{juego}', caja: true }, 'está en {valor} 😳'],
      sinRecord: ['Nadie tiene récord', 'en {juego}…', { texto: '¿serás el primero?', caja: true }],
      pregunta: [{ texto: '¿Lo superas? 👀', caja: true }],
      final: ['Juega y entra', { texto: 'en la clasificación 🏆', caja: true }],
      publicacion: 'El récord de {juego} en VR Play está en {valor}. ¿Lo superas? 👀\nJuega gratis en el navegador (gafas VR, móvil u ordenador) y entra en la clasificación: {enlace}',
      publicacionSinRecord: 'Nadie tiene todavía el récord de {juego} en VR Play. ¿Serás el primero? 🏆\nGratis en el navegador (gafas VR, móvil u ordenador): {enlace}',
    },
    duelo: {
      gancho: ['¿Cuál juegas', { texto: 'PRIMERO?', caja: true }],
      comenta: ['Comenta', { texto: '1️⃣ o 2️⃣ 👇', caja: true }],
      publicacion: '{a} o {b}: ¿cuál juegas primero? Comenta 1️⃣ o 2️⃣ 👇\nLos dos gratis en VR Play, desde el navegador: {enlace}',
    },
    foro: {
      etiqueta: 'Alguien pidió en el foro:',
      estado: 'Hecho',
      hecho: ['Y lo hemos', { texto: 'HECHO 👇', caja: true }],
      pide: ['¿Qué juego quieres?', { texto: 'Pídelo en el foro', caja: true }],
      publicacion: 'Lo pidieron en el foro de VR Play y ya está: {juego} 🎮\n¿Qué juego quieres tú? Pídelo en vrplaygame.com/foro.html\nJuega gratis: {enlace}',
    },
    hashtags: ['#VRPlay', '#juegosVR', '#realidadvirtual', '#MetaQuest', '#juegosgratis', '#gaming'],
  },
  en: {
    anuncio: {
      ganchos: [
        ['VR games', { texto: 'WITHOUT DOWNLOADING', caja: true }, 'ANYTHING? 🤯'],
        ['POV:', 'you open a website…', { texto: "and you're in VR", caja: true }],
        ['{n}+ VR games', { texto: 'FOR FREE', caja: true }, 'and nobody knows 🤫'],
      ],
      frases: [
        ['Open the site…', { texto: 'and PLAY 🎮', caja: true }],
        ['Switch games', { texto: 'WITHOUT TAKING', caja: true }, { texto: 'OFF YOUR HEADSET 🥽', caja: true }],
        ['Meta Quest 🥽', 'Phone 📱', { texto: 'and PC 💻', caja: true }],
        [{ texto: '{n}+ GAMES', caja: true }, { texto: 'FREE 🔥', caja: true }],
      ],
      titulo: '{n}+ free VR games',
      publicacion: 'Did you know you can play {n}+ VR games for free without downloading anything? 🤯\nWorks on your headset (Meta Quest), phone and computer: {enlace}',
    },
    top: {
      gancho: ['The 5 most played', { texto: 'VR GAMES', caja: true }, 'on VR Play 👇'],
      dato: '{n} games played',
      suspense: ['And number 1…', { texto: 'can you guess? 👀', caja: true }],
      titulo: 'The VR Play top 5',
      publicacion: 'The 5 most played games on VR Play 🏆 Which one is your favorite? 👇\nAll free, in your headset browser, phone or computer: {enlace}',
    },
    reto: {
      gancho: ['The record in', { texto: '{juego}', caja: true }, 'is {valor} 😳'],
      sinRecord: ['Nobody holds the record', 'in {juego} yet…', { texto: 'will you be first?', caja: true }],
      pregunta: [{ texto: 'Can you beat it? 👀', caja: true }],
      final: ['Play and get on', { texto: 'the leaderboard 🏆', caja: true }],
      publicacion: 'The {juego} record on VR Play is {valor}. Can you beat it? 👀\nPlay free in your browser (VR headset, phone or computer) and get on the leaderboard: {enlace}',
      publicacionSinRecord: 'Nobody holds the {juego} record on VR Play yet. Will you be first? 🏆\nFree in your browser (VR headset, phone or computer): {enlace}',
    },
    duelo: {
      gancho: ['Which one do you', { texto: 'PLAY FIRST?', caja: true }],
      comenta: ['Comment', { texto: '1️⃣ or 2️⃣ 👇', caja: true }],
      publicacion: '{a} or {b}: which one do you play first? Comment 1️⃣ or 2️⃣ 👇\nBoth free on VR Play, right in your browser: {enlace}',
    },
    foro: {
      etiqueta: 'Someone asked on our forum:',
      estado: 'Done',
      hecho: ['So we', { texto: 'MADE IT 👇', caja: true }],
      pide: ['What game do you want?', { texto: 'Ask on the forum', caja: true }],
      publicacion: 'Someone asked for it on the VR Play forum and here it is: {juego} 🎮\nWhat game do you want? Ask at vrplaygame.com/foro.html\nPlay free: {enlace}',
    },
    hashtags: ['#VRPlay', '#VRgames', '#virtualreality', '#MetaQuest', '#freegames', '#gaming'],
  },
};

export const textosFormato = (idioma) => TEXTOS_FORMATOS[idioma] || TEXTOS_FORMATOS.en;
