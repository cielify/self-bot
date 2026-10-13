'use strict';
const { request } = require('../utils/request');

// ── language metadata ─────────────────────────────────────────────────────
const LANG = {
  af:'Afrikaans', am:'Amharic', ar:'Arabic', az:'Azerbaijani', be:'Belarusian',
  bg:'Bulgarian', bn:'Bengali', bs:'Bosnian', ca:'Catalan', cs:'Czech',
  cy:'Welsh', da:'Danish', de:'German', el:'Greek', en:'English',
  es:'Spanish', et:'Estonian', eu:'Basque', fa:'Persian', fi:'Finnish',
  fr:'French', gl:'Galician', gu:'Gujarati', he:'Hebrew', hi:'Hindi',
  hr:'Croatian', hu:'Hungarian', hy:'Armenian', id:'Indonesian', is:'Icelandic',
  it:'Italian', ja:'Japanese', ka:'Georgian', kk:'Kazakh', km:'Khmer',
  kn:'Kannada', ko:'Korean', lo:'Lao', lt:'Lithuanian', lv:'Latvian',
  mk:'Macedonian', ml:'Malayalam', mn:'Mongolian', mr:'Marathi', ms:'Malay',
  mt:'Maltese', my:'Burmese', ne:'Nepali', nl:'Dutch', no:'Norwegian',
  pa:'Punjabi', pl:'Polish', ps:'Pashto', pt:'Portuguese', ro:'Romanian',
  ru:'Russian', si:'Sinhala', sk:'Slovak', sl:'Slovenian', sq:'Albanian',
  sr:'Serbian', sv:'Swedish', sw:'Swahili', ta:'Tamil', te:'Telugu',
  tg:'Tajik', th:'Thai', tl:'Filipino', tr:'Turkish', uk:'Ukrainian',
  ur:'Urdu', uz:'Uzbek', vi:'Vietnamese', xh:'Xhosa', yi:'Yiddish',
  'zh-cn':'Chinese (Simplified)', 'zh-tw':'Chinese (Traditional)',
  zh:'Chinese', zu:'Zulu',
};

function langName(code) {
  if (!code) return code;
  const lc = code.toLowerCase();
  return LANG[lc] || LANG[lc.split('-')[0]] || code.toUpperCase();
}

// ── Google Translate (unofficial, no key needed) ──────────────────────────
async function googleTranslate(text, to = 'en') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const res  = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept':     'application/json',
    },
  });
  if (!res.ok) throw new Error(`translate API returned ${res.status}`);

  const data = await res.json();
  // data[0] = [[translated_seg, original_seg, ...], ...]
  // data[2] = detected source language code
  const translated = (data[0] || [])
    .map(seg => seg?.[0] || '')
    .join('');
  const from = data[2] || 'auto';
  return { translated, from };
}

// ── command ───────────────────────────────────────────────────────────────
// Usage (in Discord — must reply to a message):
//   .tr           → translate to English
//   .tr ja        → translate to Japanese
//   .tr pt        → translate to Portuguese
//   (any BCP-47 language code works)

module.exports = async function tr(args, ctx) {
  const { token, channelId, messageId, edit, isTerminal } = ctx;

  // terminal fallback
  if (isTerminal) {
    return edit('`.tr` only works in Discord — reply to a message then run it.');
  }

  // ── resolve the target message ────────────────────────────────────────
  let ref = ctx.referencedMessage;

  // if the cached referenced_message is absent, fetch it via the reference ids
  if (!ref && ctx.messageReference?.message_id) {
    const refChId  = ctx.messageReference.channel_id || channelId;
    const refMsgId = ctx.messageReference.message_id;
    ref = await request(token, 'GET', `/channels/${refChId}/messages/${refMsgId}`);
    if (ref?.code) ref = null;
  }

  if (!ref) {
    return edit('`reply to a message first, then run .tr`');
  }

  const text = (ref.content || '').trim();

  if (!text) {
    // message was image/embed/sticker only
    return edit('`nothing to translate — the message has no text content`');
  }

  // ── target language from args ─────────────────────────────────────────
  const target = (args[0] || 'en').toLowerCase().replace(/[^a-z-]/g, '') || 'en';

  // ── show loading ──────────────────────────────────────────────────────
  await edit('`translating...`');

  try {
    const { translated, from } = await googleTranslate(text, target);

    const fromName = langName(from);
    const toName   = langName(target);

    // already in the target language
    const fromBase = from.toLowerCase().split('-')[0];
    const toBase   = target.toLowerCase().split('-')[0];
    if (fromBase === toBase) {
      return edit(`\`already ${fromName} — no translation needed\``);
    }

    // truncate very long translations (Discord 2000 char limit)
    const header = `**[${fromName} → ${toName}]**\n`;
    const body   = translated.length > 1980 - header.length
      ? translated.slice(0, 1980 - header.length - 1) + '…'
      : translated;

    return edit(header + body);

  } catch (err) {
    return edit(`\`translate error: ${err.message.slice(0, 80)}\``);
  }
};
