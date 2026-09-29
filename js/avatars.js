// =====================================================================
//  الشخصيات — رسومات SVG خفيفة جداً (بدون صور)
// =====================================================================

const INK = '#1E1640';

const face = (skin, { eyes = true, cheeks = true } = {}) => `
  <circle cx="60" cy="60" r="30" fill="${skin}"/>
  ${eyes ? `<circle cx="49" cy="61" r="4.2" fill="${INK}"/><circle cx="71" cy="61" r="4.2" fill="${INK}"/>
  <circle cx="50.4" cy="59.6" r="1.4" fill="#fff"/><circle cx="72.4" cy="59.6" r="1.4" fill="#fff"/>` : ''}
  <path d="M51 72 Q60 80 69 72" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  ${cheeks ? `<circle cx="41" cy="70" r="4.5" fill="#FF7A93" opacity=".45"/><circle cx="79" cy="70" r="4.5" fill="#FF7A93" opacity=".45"/>` : ''}`;

const body = color => `<path d="M28 138 C28 106 42 94 60 94 C78 94 92 106 92 138Z" fill="${color}"/>`;
const shadow = `<ellipse cx="60" cy="136" rx="34" ry="4" fill="#000" opacity=".15"/>`;

export const AVATARS = [
  {
    name: 'المغامر',
    svg: `${shadow}${body('#1F8FD1')}
      <path d="M44 98 L44 136 M76 98 L76 136" stroke="#8A4B1F" stroke-width="5"/>
      ${face('#E7B48A')}
      <path d="M31 50 Q33 24 60 24 Q87 24 89 50 Z" fill="#E5484D"/>
      <path d="M58 46 H96 Q100 46 99 51 H58 Z" fill="#B8262B"/>
      <circle cx="60" cy="27" r="4" fill="#FFC53D"/>`
  },
  {
    name: 'المغامِرة',
    svg: `${shadow}${body('#F2711C')}
      <path d="M26 66 Q26 22 60 22 Q94 22 94 66 L96 106 Q60 120 24 106 Z" fill="#7B4FD0"/>
      <path d="M35 64 Q35 36 60 36 Q85 36 85 64 Q85 92 60 92 Q35 92 35 64Z" fill="#F0C29B"/>
      <circle cx="50" cy="63" r="4" fill="${INK}"/><circle cx="70" cy="63" r="4" fill="${INK}"/>
      <circle cx="51.3" cy="61.7" r="1.3" fill="#fff"/><circle cx="71.3" cy="61.7" r="1.3" fill="#fff"/>
      <path d="M52 74 Q60 81 68 74" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <circle cx="43" cy="71" r="4" fill="#FF7A93" opacity=".45"/><circle cx="77" cy="71" r="4" fill="#FF7A93" opacity=".45"/>
      <path d="M74 30 l4 -8 l4 8 l8 1 l-6 5 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -5z" fill="#FFC53D"/>`
  },
  {
    name: 'رائد الفضاء',
    svg: `${shadow}${body('#E9EEF6')}
      <rect x="48" y="104" width="24" height="14" rx="3" fill="#1F8FD1"/>
      <circle cx="54" cy="111" r="2.5" fill="#E5484D"/><circle cx="66" cy="111" r="2.5" fill="#FFC53D"/>
      <circle cx="60" cy="60" r="40" fill="#E9EEF6" stroke="#B7C2D6" stroke-width="3"/>
      ${face('#C98B5E')}
      <path d="M32 50 Q40 26 72 26" stroke="#fff" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round"/>
      <line x1="60" y1="20" x2="60" y2="8" stroke="#B7C2D6" stroke-width="3"/><circle cx="60" cy="7" r="5" fill="#E5484D"/>`
  },
  {
    name: 'العالِم الصغير',
    svg: `${shadow}${body('#FFFFFF')}
      <path d="M60 94 L52 138 H68 Z" fill="#2FBF8F"/>
      <path d="M28 138 C28 106 42 94 60 94 C78 94 92 106 92 138" fill="none" stroke="#C9D2E3" stroke-width="2"/>
      ${face('#F3C9A0')}
      <path d="M30 52 Q28 24 50 26 Q56 16 66 24 Q88 20 90 50 Q84 38 74 40 Q66 32 56 38 Q42 34 30 52Z" fill="#5A3A22"/>
      <rect x="36" y="38" width="20" height="13" rx="6" fill="#7FD3F7" stroke="${INK}" stroke-width="3"/>
      <rect x="64" y="38" width="20" height="13" rx="6" fill="#7FD3F7" stroke="${INK}" stroke-width="3"/>
      <line x1="56" y1="44" x2="64" y2="44" stroke="${INK}" stroke-width="3"/>`
  },
  {
    name: 'المستكشف',
    svg: `${shadow}${body('#6E8B3D')}
      <rect x="47" y="106" width="10" height="14" rx="4" fill="${INK}"/><rect x="63" y="106" width="10" height="14" rx="4" fill="${INK}"/>
      <rect x="55" y="110" width="10" height="5" fill="${INK}"/>
      ${face('#8D5A3B')}
      <ellipse cx="60" cy="40" rx="46" ry="9" fill="#C9A26A"/>
      <path d="M36 40 Q38 16 60 16 Q82 16 84 40 Z" fill="#DDB77E"/>
      <rect x="36" y="33" width="48" height="6" fill="#8A4B1F"/>`
  },
  {
    name: 'الرياضي',
    svg: `${shadow}${body('#138A5E')}
      <text x="60" y="126" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="20" fill="#fff">10</text>
      ${face('#E0A87C')}
      <path d="M31 52 Q30 26 60 26 Q90 26 89 52 Q80 40 60 40 Q40 40 31 52Z" fill="#2A1B12"/>
      <rect x="30" y="42" width="60" height="8" rx="4" fill="#E5484D"/>
      <path d="M88 44 l10 -6 l-2 10z" fill="#E5484D"/>`
  },
  {
    name: 'الروبوت',
    svg: `${shadow}
      <rect x="32" y="96" width="56" height="40" rx="12" fill="#5B6B8C"/>
      <rect x="44" y="106" width="32" height="14" rx="4" fill="#2B3553"/>
      <circle cx="52" cy="113" r="3" fill="#2FBF8F"/><circle cx="60" cy="113" r="3" fill="#FFC53D"/><circle cx="68" cy="113" r="3" fill="#E5484D"/>
      <rect x="28" y="32" width="64" height="58" rx="18" fill="#8FA3C8"/>
      <rect x="36" y="44" width="48" height="30" rx="12" fill="#2B3553"/>
      <rect x="44" y="53" width="10" height="10" rx="3" fill="#7FF0FF"/><rect x="66" y="53" width="10" height="10" rx="3" fill="#7FF0FF"/>
      <path d="M52 80 H68" stroke="#2B3553" stroke-width="4" stroke-linecap="round"/>
      <line x1="60" y1="32" x2="60" y2="18" stroke="#5B6B8C" stroke-width="4"/><circle cx="60" cy="15" r="6" fill="#FFC53D"/>
      <rect x="22" y="52" width="6" height="16" rx="3" fill="#5B6B8C"/><rect x="92" y="52" width="6" height="16" rx="3" fill="#5B6B8C"/>`
  },
  {
    name: 'البطل العربي',
    svg: `${shadow}
      <path d="M24 138 L34 100 L86 100 L96 138 Z" fill="#C8313A"/>
      ${body('#FFFFFF')}
      <path d="M60 96 V136" stroke="#D9DEE8" stroke-width="2"/>
      <path d="M26 58 Q26 22 60 22 Q94 22 94 58 L98 104 Q86 96 82 80 L38 80 Q34 96 22 104 Z" fill="#FFFFFF" stroke="#D9DEE8" stroke-width="2"/>
      ${face('#D39A6A')}
      <path d="M30 42 Q60 30 90 42" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M31 50 Q60 38 89 50" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`
  }
];

export function avatarSVG(i, extraClass = '') {
  const a = AVATARS[i] || AVATARS[0];
  return `<svg class="av ${extraClass}" viewBox="0 0 120 140" aria-hidden="true" focusable="false">${a.svg}</svg>`;
}
