// Envío de correos con Resend (https://resend.com). La clave va en el secreto RESEND_API_KEY.
// Los textos están en idiomas/<código>.js, en cuenta.email, como el resto de la web.
import es from '../idiomas/es.js';
import en from '../idiomas/en.js';
import fr from '../idiomas/fr.js';
import de from '../idiomas/de.js';
import it from '../idiomas/it.js';
import pt from '../idiomas/pt.js';
import ja from '../idiomas/ja.js';
import ko from '../idiomas/ko.js';
import zh from '../idiomas/zh.js';

const TEXTOS = { es, en, fr, de, it, pt, ja, ko, zh };
export const idiomaValido = (codigo) => (Object.hasOwn(TEXTOS, codigo) ? codigo : 'en');

const REMITENTE = 'VR Play <no-reply@vrplaygame.com>';
const RESPONDER_A = 'contact@vrplaygame.com';

function texto(idioma, clave, datos = {}) {
  const v = TEXTOS[idioma].cuenta.email[clave] ?? TEXTOS.es.cuenta.email[clave];
  return v.replace(/\{(\w+)\}/g, (marca, nombre) => (nombre in datos ? String(datos[nombre]) : marca));
}

const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Correo con el enlace para entrar y el código de 6 cifras (para escribirlo en otro dispositivo, como las gafas)
export async function enviarEnlace(env, { correo, enlace, codigo, idioma }) {
  if (!env.RESEND_API_KEY) throw new Error('Falta el secreto RESEND_API_KEY');
  const t = (clave, datos) => texto(idioma, clave, datos);
  const codigoBonito = `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
  const html = `<!DOCTYPE html><html lang="${idioma}"><body style="margin:0;padding:24px;background:#0e0d16;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f1effa">
<div style="max-width:480px;margin:0 auto;padding:28px;border-radius:16px;background:#1a1828;border:1px solid #34304f">
  <p style="margin:0 0 20px;font-size:22px;font-weight:700;letter-spacing:.04em">VR<span style="color:#8f6bff">·</span>Play</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapar(t('texto'))}</p>
  <p style="margin:0 0 24px"><a href="${escapar(enlace)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#8f6bff;color:#ffffff;font-weight:600;text-decoration:none">${escapar(t('boton'))}</a></p>
  <p style="margin:0 0 6px;font-size:14px;color:#a19cbd">${escapar(t('codigo'))}</p>
  <p style="margin:0 0 24px;font-size:30px;font-weight:700;letter-spacing:.2em;font-family:ui-monospace,Menlo,Consolas,monospace">${codigoBonito}</p>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#a19cbd">${escapar(t('caduca'))}<br>${escapar(t('noFuiste'))}</p>
</div></body></html>`;
  const plano = `${t('texto')}\n\n${enlace}\n\n${t('codigo')} ${codigoBonito}\n\n${t('caduca')}\n${t('noFuiste')}\n`;

  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE, to: [correo], reply_to: RESPONDER_A, subject: t('asunto'), html, text: plano }),
  });
  if (!respuesta.ok) throw new Error(`Resend respondió ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
}
