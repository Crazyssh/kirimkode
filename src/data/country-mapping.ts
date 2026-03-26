/**
 * Country Name Normalization
 *
 * Maps provider-specific country names to standardized English names.
 * During sync, each provider country name is matched against keywords.
 * In unified mode, countries are grouped by normalizedName.
 *
 * Matching logic: provider name (lowercase) must CONTAIN at least one keyword.
 * Keywords are checked from most specific to least specific.
 */

interface CountryMapping {
  /** Our standardized name (English) */
  name: string;
  /** Keywords to match provider names against (lowercase). Order: most specific first. */
  keywords: string[];
}

/**
 * Master country mapping.
 * - Try keyword matches from top to bottom within each entry.
 * - If no match found, capitalize the provider name as-is.
 */
export const COUNTRY_MAPPINGS: CountryMapping[] = [
  // === A ===
  { name: "Afghanistan", keywords: ["afghanistan"] },
  { name: "Albania", keywords: ["albania"] },
  { name: "Algeria", keywords: ["algeria", "aljazair"] },
  { name: "Angola", keywords: ["angola"] },
  { name: "Antigua and Barbuda", keywords: ["antigua"] },
  { name: "Argentina", keywords: ["argentina"] },
  { name: "Armenia", keywords: ["armenia"] },
  { name: "Aruba", keywords: ["aruba"] },
  { name: "Australia", keywords: ["australia"] },
  { name: "Austria", keywords: ["austria"] },
  { name: "Azerbaijan", keywords: ["azerbaijan"] },

  // === B ===
  { name: "Bahamas", keywords: ["bahamas"] },
  { name: "Bahrain", keywords: ["bahrain"] },
  { name: "Bangladesh", keywords: ["bangladesh"] },
  { name: "Barbados", keywords: ["barbados"] },
  { name: "Belarus", keywords: ["belarus"] },
  { name: "Belgium", keywords: ["belgium", "belgia"] },
  { name: "Belize", keywords: ["belize"] },
  { name: "Benin", keywords: ["benin"] },
  { name: "Bhutan", keywords: ["bhutan"] },
  { name: "Bolivia", keywords: ["bolivia"] },
  { name: "Bosnia and Herzegovina", keywords: ["bosnia"] },
  { name: "Botswana", keywords: ["botswana"] },
  { name: "Brazil", keywords: ["brazil", "brasil"] },
  { name: "Brunei", keywords: ["brunei"] },
  { name: "Bulgaria", keywords: ["bulgaria"] },
  { name: "Burkina Faso", keywords: ["burkina"] },
  { name: "Burundi", keywords: ["burundi"] },

  // === C ===
  { name: "Cambodia", keywords: ["cambodia", "kamboja"] },
  { name: "Cameroon", keywords: ["cameroon", "kamerun"] },
  { name: "Canada", keywords: ["canada", "kanada"] },
  { name: "Cape Verde", keywords: ["cape verde"] },
  { name: "Central African Republic", keywords: ["central african"] },
  { name: "Chad", keywords: ["chad"] },
  { name: "Chile", keywords: ["chile"] },
  { name: "China", keywords: ["china", "tiongkok"] },
  { name: "Colombia", keywords: ["colombia", "kolombia"] },
  { name: "Comoros", keywords: ["comoros"] },
  { name: "Congo", keywords: ["congo"] },
  { name: "Costa Rica", keywords: ["costa rica"] },
  { name: "Croatia", keywords: ["croatia", "kroasia"] },
  { name: "Cuba", keywords: ["cuba", "kuba"] },
  { name: "Curacao", keywords: ["curacao"] },
  { name: "Cyprus", keywords: ["cyprus", "siprus"] },
  { name: "Czech Republic", keywords: ["czech", "ceko"] },

  // === D ===
  { name: "Denmark", keywords: ["denmark", "denmark"] },
  { name: "Djibouti", keywords: ["djibouti"] },
  { name: "Dominica", keywords: ["dominica"] },
  { name: "Dominican Republic", keywords: ["dominican"] },

  // === E ===
  { name: "East Timor", keywords: ["timor", "east timor"] },
  { name: "Ecuador", keywords: ["ecuador"] },
  { name: "Egypt", keywords: ["egypt", "mesir"] },
  { name: "El Salvador", keywords: ["el salvador", "salvador"] },
  { name: "Equatorial Guinea", keywords: ["equatorial guinea"] },
  { name: "Eritrea", keywords: ["eritrea"] },
  { name: "Estonia", keywords: ["estonia"] },
  { name: "Eswatini", keywords: ["eswatini", "swaziland"] },
  { name: "Ethiopia", keywords: ["ethiopia", "etiopia"] },

  // === F ===
  { name: "Fiji", keywords: ["fiji"] },
  { name: "Finland", keywords: ["finland", "finlandia"] },
  { name: "France", keywords: ["france", "prancis"] },
  { name: "French Guiana", keywords: ["french guiana", "guyana prancis"] },
  { name: "French Polynesia", keywords: ["french polynesia"] },

  // === G ===
  { name: "Gabon", keywords: ["gabon"] },
  { name: "Gambia", keywords: ["gambia"] },
  { name: "Georgia", keywords: ["georgia"] },
  { name: "Germany", keywords: ["germany", "jerman"] },
  { name: "Ghana", keywords: ["ghana"] },
  { name: "Greece", keywords: ["greece", "yunani"] },
  { name: "Grenada", keywords: ["grenada"] },
  { name: "Guadeloupe", keywords: ["guadeloupe"] },
  { name: "Guatemala", keywords: ["guatemala"] },
  { name: "Guinea", keywords: ["guinea"] },
  { name: "Guinea-Bissau", keywords: ["guinea-bissau", "guinea bissau"] },
  { name: "Guyana", keywords: ["guyana"] },

  // === H ===
  { name: "Haiti", keywords: ["haiti"] },
  { name: "Honduras", keywords: ["honduras"] },
  { name: "Hong Kong", keywords: ["hong kong", "hongkong"] },
  { name: "Hungary", keywords: ["hungary", "hungaria"] },

  // === I ===
  { name: "Iceland", keywords: ["iceland", "islandia"] },
  { name: "India", keywords: ["india"] },
  { name: "Indonesia", keywords: ["indonesia"] },
  { name: "Iran", keywords: ["iran"] },
  { name: "Iraq", keywords: ["iraq", "irak"] },
  { name: "Ireland", keywords: ["ireland", "irlandia"] },
  { name: "Israel", keywords: ["israel"] },
  { name: "Italy", keywords: ["italy", "italia"] },
  { name: "Ivory Coast", keywords: ["ivory coast", "cote d'ivoire", "pantai gading"] },

  // === J ===
  { name: "Jamaica", keywords: ["jamaica", "jamaika"] },
  { name: "Japan", keywords: ["japan", "jepang"] },
  { name: "Jordan", keywords: ["jordan", "yordania"] },

  // === K ===
  { name: "Kazakhstan", keywords: ["kazakhstan", "kazakstan"] },
  { name: "Kenya", keywords: ["kenya"] },
  { name: "Kosovo", keywords: ["kosovo"] },
  { name: "Kuwait", keywords: ["kuwait"] },
  { name: "Kyrgyzstan", keywords: ["kyrgyzstan", "kirgizstan"] },

  // === L ===
  { name: "Laos", keywords: ["laos"] },
  { name: "Latvia", keywords: ["latvia"] },
  { name: "Lebanon", keywords: ["lebanon", "libanon"] },
  { name: "Lesotho", keywords: ["lesotho"] },
  { name: "Liberia", keywords: ["liberia"] },
  { name: "Libya", keywords: ["libya"] },
  { name: "Liechtenstein", keywords: ["liechtenstein"] },
  { name: "Lithuania", keywords: ["lithuania", "lituania"] },
  { name: "Luxembourg", keywords: ["luxembourg", "luksemburg"] },

  // === M ===
  { name: "Macau", keywords: ["macau", "macao"] },
  { name: "Madagascar", keywords: ["madagascar", "madagaskar"] },
  { name: "Malawi", keywords: ["malawi"] },
  { name: "Malaysia", keywords: ["malaysia"] },
  { name: "Maldives", keywords: ["maldives", "maladewa"] },
  { name: "Mali", keywords: ["mali"] },
  { name: "Malta", keywords: ["malta"] },
  { name: "Martinique", keywords: ["martinique"] },
  { name: "Mauritania", keywords: ["mauritania"] },
  { name: "Mauritius", keywords: ["mauritius"] },
  { name: "Mexico", keywords: ["mexico", "meksiko"] },
  { name: "Moldova", keywords: ["moldova"] },
  { name: "Mongolia", keywords: ["mongolia"] },
  { name: "Montenegro", keywords: ["montenegro"] },
  { name: "Morocco", keywords: ["morocco", "maroko"] },
  { name: "Mozambique", keywords: ["mozambique", "mozambik"] },
  { name: "Myanmar", keywords: ["myanmar", "burma"] },

  // === N ===
  { name: "Namibia", keywords: ["namibia"] },
  { name: "Nepal", keywords: ["nepal"] },
  { name: "Netherlands", keywords: ["netherlands", "belanda"] },
  { name: "New Caledonia", keywords: ["new caledonia", "kaledonia"] },
  { name: "New Zealand", keywords: ["new zealand", "selandia baru"] },
  { name: "Nicaragua", keywords: ["nicaragua", "nikaragua"] },
  { name: "Niger", keywords: ["niger"] },
  { name: "Nigeria", keywords: ["nigeria"] },
  { name: "North Korea", keywords: ["north korea", "korea utara"] },
  { name: "North Macedonia", keywords: ["north macedonia", "makedonia"] },
  { name: "Norway", keywords: ["norway", "norwegia", "norwa"] },

  // === O ===
  { name: "Oman", keywords: ["oman"] },

  // === P ===
  { name: "Pakistan", keywords: ["pakistan"] },
  { name: "Palestine", keywords: ["palestine", "palestina"] },
  { name: "Panama", keywords: ["panama"] },
  { name: "Papua New Guinea", keywords: ["papua new guinea"] },
  { name: "Paraguay", keywords: ["paraguay"] },
  { name: "Peru", keywords: ["peru"] },
  { name: "Philippines", keywords: ["philippines", "filipina"] },
  { name: "Poland", keywords: ["poland", "polandia"] },
  { name: "Portugal", keywords: ["portugal"] },
  { name: "Puerto Rico", keywords: ["puerto rico"] },

  // === Q ===
  { name: "Qatar", keywords: ["qatar"] },

  // === R ===
  { name: "Reunion", keywords: ["reunion"] },
  { name: "Romania", keywords: ["romania"] },
  { name: "Russia", keywords: ["russia", "rusia"] },
  { name: "Rwanda", keywords: ["rwanda"] },

  // === S ===
  { name: "Saint Kitts and Nevis", keywords: ["saint kitts"] },
  { name: "Saint Lucia", keywords: ["saint lucia"] },
  { name: "Saint Vincent", keywords: ["saint vincent"] },
  { name: "Samoa", keywords: ["samoa"] },
  { name: "Saudi Arabia", keywords: ["saudi", "arab saudi"] },
  { name: "Senegal", keywords: ["senegal"] },
  { name: "Serbia", keywords: ["serbia"] },
  { name: "Sierra Leone", keywords: ["sierra leone"] },
  { name: "Singapore", keywords: ["singapore", "singapura"] },
  { name: "Slovakia", keywords: ["slovakia", "slowakia"] },
  { name: "Slovenia", keywords: ["slovenia"] },
  { name: "Solomon Islands", keywords: ["solomon"] },
  { name: "Somalia", keywords: ["somalia"] },
  { name: "South Africa", keywords: ["south africa", "afrika selatan"] },
  { name: "South Korea", keywords: ["south korea", "korea selatan", "korea"] },
  { name: "South Sudan", keywords: ["south sudan"] },
  { name: "Spain", keywords: ["spain", "spanyol"] },
  { name: "Sri Lanka", keywords: ["sri lanka"] },
  { name: "Sudan", keywords: ["sudan"] },
  { name: "Suriname", keywords: ["suriname"] },
  { name: "Sweden", keywords: ["sweden", "swedia"] },
  { name: "Switzerland", keywords: ["switzerland", "swiss"] },
  { name: "Syria", keywords: ["syria", "suriah"] },

  // === T ===
  { name: "Taiwan", keywords: ["taiwan"] },
  { name: "Tajikistan", keywords: ["tajikistan"] },
  { name: "Tanzania", keywords: ["tanzania"] },
  { name: "Thailand", keywords: ["thailand"] },
  { name: "Togo", keywords: ["togo"] },
  { name: "Tonga", keywords: ["tonga"] },
  { name: "Trinidad and Tobago", keywords: ["trinidad"] },
  { name: "Tunisia", keywords: ["tunisia"] },
  { name: "Turkey", keywords: ["turkey", "turki"] },
  { name: "Turkmenistan", keywords: ["turkmenistan"] },

  // === U ===
  { name: "Uganda", keywords: ["uganda"] },
  { name: "Ukraine", keywords: ["ukraine", "ukraina"] },
  { name: "United Arab Emirates", keywords: ["united arab emirates", "uae", "uni emirat"] },
  { name: "United Kingdom", keywords: ["united kingdom", "uk", "inggris", "england", "britain"] },
  { name: "United States", keywords: ["united states", "usa", "amerika", "us"] },
  { name: "Uruguay", keywords: ["uruguay"] },
  { name: "Uzbekistan", keywords: ["uzbekistan"] },

  // === V ===
  { name: "Vanuatu", keywords: ["vanuatu"] },
  { name: "Venezuela", keywords: ["venezuela"] },
  { name: "Vietnam", keywords: ["vietnam"] },

  // === Y ===
  { name: "Yemen", keywords: ["yemen"] },

  // === Z ===
  { name: "Zambia", keywords: ["zambia"] },
  { name: "Zimbabwe", keywords: ["zimbabwe"] },
];

/**
 * Normalize a provider country name to our standardized English name.
 *
 * Strategy:
 * 1. Lowercase + strip non-alpha chars for matching
 * 2. Check against keywords (longest match wins to avoid false positives)
 * 3. Remove VIP/Virtual/Premium suffixes before matching for the base country
 * 4. If no match found, capitalize the input as-is
 *
 * Returns: { normalizedName: string, suffix: string | null }
 * e.g. "Amerika VIP" → { normalizedName: "United States", suffix: "VIP" }
 * Result name: "United States (VIP)" if suffix exists
 */
export function normalizeCountryName(providerName: string): string {
  const original = providerName.trim();
  const lower = original.toLowerCase();

  // Extract suffix (VIP, Virtual, Premium, etc.)
  const suffixMatch = lower.match(/\b(vip|virtual|premium|special|real)\b/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null;

  // Clean name for matching: remove suffix, trim, remove extra whitespace
  const cleanName = lower
    .replace(/\b(vip|virtual|premium|special|real)\b/gi, "")
    .replace(/[^a-z\s'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Try to find matching country
  for (const mapping of COUNTRY_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (cleanName.includes(keyword) || cleanName === keyword) {
        return suffix ? `${mapping.name} (${suffix})` : mapping.name;
      }
    }
  }

  // No match: capitalize original name
  const capitalized = original
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return capitalized;
}
