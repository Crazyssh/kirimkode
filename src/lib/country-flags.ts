/**
 * Convert country name to emoji flag.
 * Uses ISO 3166-1 alpha-2 → regional indicator symbols.
 */

const COUNTRY_MAP: Record<string, string> = {
  // A
  afghanistan: "AF", albania: "AL", algeria: "DZ", angola: "AO", anguilla: "AI",
  "antigua and barbuda": "AG", argentina: "AR", armenia: "AM", aruba: "AW",
  australia: "AU", austria: "AT", azerbaijan: "AZ",
  // B
  bahamas: "BS", bahrain: "BH", bangladesh: "BD", barbados: "BB", belarus: "BY",
  belgium: "BE", belize: "BZ", benin: "BJ", bermuda: "BM", bhutan: "BT",
  bolivia: "BO", "bosnia and herzegovina": "BA", botswana: "BW", brazil: "BR",
  brunei: "BN", bulgaria: "BG", "burkina faso": "BF", burundi: "BI",
  // C
  cambodia: "KH", cameroon: "CM", canada: "CA", "cape verde": "CV",
  "cayman islands": "KY", "central african republic": "CF", chad: "TD",
  chile: "CL", china: "CN", colombia: "CO", comoros: "KM", congo: "CG",
  "congo democratic republic": "CD", "costa rica": "CR", "cote d'ivoire": "CI",
  "ivory coast": "CI", croatia: "HR", cuba: "CU", curacao: "CW", cyprus: "CY",
  "czech republic": "CZ", czechia: "CZ",
  // D
  denmark: "DK", djibouti: "DJ", dominica: "DM", "dominican republic": "DO",
  // E
  ecuador: "EC", egypt: "EG", "el salvador": "SV", "equatorial guinea": "GQ",
  eritrea: "ER", estonia: "EE", eswatini: "SZ", ethiopia: "ET",
  // F
  fiji: "FJ", finland: "FI", france: "FR", "french guiana": "GF",
  "french polynesia": "PF",
  // G
  gabon: "GA", gambia: "GM", georgia: "GE", germany: "DE", ghana: "GH",
  gibraltar: "GI", greece: "GR", greenland: "GL", grenada: "GD",
  guadeloupe: "GP", guam: "GU", guatemala: "GT", guinea: "GN",
  "guinea-bissau": "GW", guyana: "GY",
  // H
  haiti: "HT", honduras: "HN", "hong kong": "HK", hungary: "HU",
  // I
  iceland: "IS", india: "IN", indonesia: "ID", iran: "IR", iraq: "IQ",
  ireland: "IE", israel: "IL", italy: "IT",
  // J
  jamaica: "JM", japan: "JP", jordan: "JO",
  // K
  kazakhstan: "KZ", kenya: "KE", kiribati: "KI", kosovo: "XK",
  kuwait: "KW", kyrgyzstan: "KG",
  // L
  laos: "LA", latvia: "LV", lebanon: "LB", lesotho: "LS", liberia: "LR",
  libya: "LY", liechtenstein: "LI", lithuania: "LT", luxembourg: "LU",
  // M
  macao: "MO", macau: "MO", madagascar: "MG", malawi: "MW", malaysia: "MY",
  maldives: "MV", mali: "ML", malta: "MT", martinique: "MQ", mauritania: "MR",
  mauritius: "MU", mayotte: "YT", mexico: "MX", moldova: "MD", monaco: "MC",
  mongolia: "MN", montenegro: "ME", montserrat: "MS", morocco: "MA",
  mozambique: "MZ", myanmar: "MM", "north macedonia": "MK", macedonia: "MK",
  // N
  namibia: "NA", nepal: "NP", netherlands: "NL", "new caledonia": "NC",
  "new zealand": "NZ", nicaragua: "NI", niger: "NE", nigeria: "NG",
  "north korea": "KP", norway: "NO",
  // O
  oman: "OM",
  // P
  pakistan: "PK", palestine: "PS", panama: "PA", "papua new guinea": "PG",
  paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL", portugal: "PT",
  "puerto rico": "PR",
  // Q
  qatar: "QA",
  // R
  reunion: "RE", romania: "RO", russia: "RU", rwanda: "RW",
  // S
  "saint kitts and nevis": "KN", "saint lucia": "LC",
  "saint vincent and the grenadines": "VC", samoa: "WS", "sao tome and principe": "ST",
  "saudi arabia": "SA", senegal: "SN", serbia: "RS", seychelles: "SC",
  "sierra leone": "SL", singapore: "SG", slovakia: "SK", slovenia: "SI",
  "solomon islands": "SB", somalia: "SO", "south africa": "ZA",
  "south korea": "KR", "south sudan": "SS", spain: "ES", "sri lanka": "LK",
  sudan: "SD", suriname: "SR", sweden: "SE", switzerland: "CH", syria: "SY",
  // T
  taiwan: "TW", tajikistan: "TJ", tanzania: "TZ", thailand: "TH",
  "timor-leste": "TL", "east timor": "TL", togo: "TG", tonga: "TO",
  "trinidad and tobago": "TT", tunisia: "TN", turkey: "TR", turkmenistan: "TM",
  "turks and caicos islands": "TC", tuvalu: "TV",
  // U
  uganda: "UG", ukraine: "UA", "united arab emirates": "AE", uae: "AE",
  "united kingdom": "GB", uk: "GB", england: "GB",
  "united states": "US", usa: "US", uruguay: "UY", uzbekistan: "UZ",
  // V
  vanuatu: "VU", venezuela: "VE", vietnam: "VN",
  "virgin islands": "VI",
  // Y
  yemen: "YE",
  // Z
  zambia: "ZM", zimbabwe: "ZW",
};

/**
 * Get ISO code for a country name.
 */
export function getCountryIso(name: string): string | null {
  const key = name.toLowerCase().trim();
  return COUNTRY_MAP[key] || null;
}

/**
 * Get flag image URL for a country name.
 * Uses flagcdn.com CDN.
 * @example getCountryFlagUrl("Indonesia") => "https://flagcdn.com/24x18/id.png"
 */
export function getCountryFlagUrl(name: string, size: "16x12" | "24x18" | "32x24" | "48x36" = "24x18"): string | null {
  const iso = getCountryIso(name);
  if (!iso) return null;
  return `https://flagcdn.com/${size}/${iso.toLowerCase()}.png`;
}

/**
 * Get flag emoji for a country name (works on macOS/Linux, broken on Windows).
 */
export function getCountryFlag(name: string): string {
  const iso = getCountryIso(name);
  if (!iso) return "🏳️";
  const [a, b] = iso.toUpperCase().split("");
  return String.fromCodePoint(
    0x1F1E6 + a.charCodeAt(0) - 65,
    0x1F1E6 + b.charCodeAt(0) - 65
  );
}
