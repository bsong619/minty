# Card Identification Reference

How TCG and sports cards encode their identity, with a focus on **modern English Pokémon TCG (2017–present)**. This is the ground-truth lookup the vision prompt uses to resolve a phone photo of a card to a canonical (set, number, year, illustrator) tuple, which we then match against eBay comps.

---

## 1. Pokémon TCG: bottom-of-card schema

On every modern English Pokémon card the **lower edge of the front face** carries a fixed-position metadata band. The order, left to right, has been stable since Sword & Shield (2020) and almost identical since the Sun & Moon era (2017):

```
[Illus. ARTIST]   [RegMark]  [###/###]  [•]  [© YEAR Pokémon ...]   [PokémonTCG wordmark]
   bottom-LEFT       middle-left/center           bottom-CENTER        bottom-RIGHT
```

Element-by-element:

| Element | Where | What it means | Example |
|---|---|---|---|
| `Illus. NAME` | Bottom-left, leftmost text | Artist credit. Single name, sometimes Japanese-romanized (e.g. `5ban Graphics`, `tetsuya koizumi`, `MAHOU`). | `Illus. MAHOU` |
| Regulation mark | Bottom-left, immediately to the right of the illustrator credit, **before** the card number | Single uppercase letter inside a small rounded box. Determines Standard-format legality. **Introduced on Sword & Shield base (Feb 2020).** Sun & Moon and earlier cards do not have one. | `D`, `E`, `F`, `G`, `H`, `I` |
| Card number | Bottom-left/center, fraction format | `###/###` — collector number over **printed total** of the set's base run. Promos use `SWSH###`, `SVP ###`, `SM###`, `XY###` etc. | `023/185` |
| Rarity dot/diamond/star | A single tiny glyph immediately after the card number | `●` = Common, `◆` = Uncommon, `★` = Rare, `★ H` (with H) = Holo Rare, `★★` = Double Rare (V/ex), `★★★` = Ultra/Hyper Rare, also `RR`/`AR`/`SR`/`SAR`/`UR` text-glyphs in S&V. | `●` after `023/185` |
| Set abbreviation | Sometimes shown in the same line as the number, sometimes only on promos | 2-3 letter code (e.g. `SSH`, `VIV`, `BRS`, `OBF`, `SCR`). On regular set cards this is usually omitted from the print and inferred from the set symbol. | (omitted on most main-set cards) |
| Set symbol | Top-right of card art, **not** bottom — but it is a primary disambiguator | Small icon unique to each expansion (Vivid Voltage = stylized "V" with a bolt). | (image only) |
| Copyright line | Bottom edge, center-right | `©YYYY Pokémon / Nintendo / Creatures / GAME FREAK`. Year matches print run, not set release. | `©2020 Pokémon` |
| Wordmark | Bottom-right corner | `PokémonTCG` lock-up. Confirms it is a real TCG card vs a sticker, fake, or Pocket digital screenshot. | `PokémonTCG` |

### Era differences (2017 → today)

- **Sun & Moon (SM, 2017–2019)**: No regulation mark. Bottom-left = `Illus.` only. Card number lower-right or lower-center. Rarity glyph next to number. Sets carry codes like `SM1` (Sun & Moon base), `SM12` (Cosmic Eclipse).
- **Sword & Shield (SSH/SWSH, 2020–2022)**: **Regulation mark D** introduced on Sword & Shield base. Mark **E** appears partway through Brilliant Stars (Feb 2022) and runs through Crown Zenith. Card-number layout settles into bottom-left exactly as the example "Illus. MAHOU / D / 023/185 / • / ©2020 Pokémon".
- **Scarlet & Violet (SV/SVI, 2023–present)**: Mark **F** for SV1–SV4, **G** for SV5–SV7 (rotation marker for the 2025–26 Standard cutoff), **H** for SV5+ depending on print run, **I** for late-2025/2026. Layout is unchanged. Some SV cards add a small **"Pokémon ex"** sub-bar above the artwork rather than the older "GX/V/VMAX" glyphs.
- **EX / BW / XY (pre-2017, out of scope)**: Same general layout but no regulation mark, and the wordmark uses the older logo. Mentioned only because the prompt may encounter older cards in user collections.

### Regulation mark → era mapping (authoritative)

| Mark | English print window | Notes |
|---|---|---|
| (none) | pre-2020 | Sun & Moon and older. Always Expanded-only or unrestricted reprints. |
| `D` | Feb 2020 – Jan 2022 | SWSH base → Fusion Strike, Celebrations, plus parts of Brilliant Stars |
| `E` | Feb 2022 – Mar 2023 | Brilliant Stars partway → Crown Zenith |
| `F` | Mar 2023 – Mar 2024 | Scarlet & Violet base → Paldean Fates |
| `G` | Mar 2024 – Sep 2024 | Temporal Forces → Shrouded Fable; rotated out of Standard for the 2026 season |
| `H` | May 2024 – mid 2025 | Twilight Masquerade → Journey Together (overlap with G is real — this is a known Pokémon Co. quirk) |
| `I` | Mid 2025 – 2026 | Destined Rivals → Mega Evolution / Phantasmal Flames |
| `J` | Late 2026 | Just appearing on newest prints |

**Critical:** the regulation mark is **not** a set code. It is a rotation-block tag. Two different sets can share a regulation mark, and one set can sit at the boundary between two marks. Always disambiguate sets via `(printed_total, copyright_year, set_symbol)`, not the mark.

---

## 2. Pokémon TCG set table (English, 2017–2026)

This is the lookup table. Use the **printed total** (denominator) plus **copyright year** as the primary key. Verified against Bulbapedia, JustInBasil, TCG Collector, and PokéBeach; rows where two sources disagreed are flagged.

| Set name | Code | Year | Printed total (denominator) | Reg. mark | Notes |
|---|---|---|---|---|---|
| **Sun & Moon era** | | | | | |
| Sun & Moon | SUM / SM1 | 2017 | 149 | — | Plus 14 secret rares (150–163) |
| Guardians Rising | GRI / SM2 | 2017 | 145 | — | + 24 secrets |
| Burning Shadows | BUS / SM3 | 2017 | 147 | — | + 22 secrets |
| Shining Legends | SLG / SM3.5 | 2017 | 73 | — | Special expansion, all-foil intent |
| Crimson Invasion | CIN / SM4 | 2017 | 111 | — | + 15 secrets |
| Ultra Prism | UPR / SM5 | 2018 | 156 | — | + 17 secrets |
| Forbidden Light | FLI / SM6 | 2018 | 131 | — | + 15 secrets |
| Celestial Storm | CES / SM7 | 2018 | 168 | — | + 15 secrets |
| Dragon Majesty | DRM / SM7.5 | 2018 | 70 | — | Special expansion |
| Lost Thunder | LOT / SM8 | 2018 | 214 | — | Largest SM set; + 22 secrets |
| Team Up | TEU / SM9 | 2019 | 181 | — | + 15 secrets |
| Detective Pikachu | DET | 2019 | 18 | — | Movie tie-in mini-set |
| Unbroken Bonds | UNB / SM10 | 2019 | 214 | — | + 20 secrets |
| Unified Minds | UNM / SM11 | 2019 | 236 | — | + 22 secrets — largest SM set |
| Hidden Fates | HIF / SM11.5 | 2019 | **68** | — | Plus 94-card Shiny Vault subset (`SV01/SV94`) |
| Cosmic Eclipse | CEC / SM12 | 2019 | 236 | — | Final SM set; + 35 secrets |
| **Sword & Shield era** | | | | | |
| Sword & Shield | SSH / SWSH1 | 2020 | 202 | D | + 14 secrets |
| Rebel Clash | RCL / SWSH2 | 2020 | 192 | D | + 17 secrets |
| Darkness Ablaze | DAA / SWSH3 | 2020 | 189 | D | + 12 secrets |
| Champion's Path | CPA | 2020 | **73** | D | Mini-set |
| Vivid Voltage | VIV / SWSH4 | 2020 | **185** | D | + 18 secrets. **(Reference card: 023/185 = Charmander, illus. MAHOU.)** |
| Shining Fates | SHF | 2021 | **72** | D | Plus 122-card Shiny Vault (`SV001/SV122`) |
| Battle Styles | BST / SWSH5 | 2021 | 163 | D | + 20 secrets |
| Chilling Reign | CRE / SWSH6 | 2021 | 198 | D | + 35 secrets |
| Evolving Skies | EVS / SWSH7 | 2021 | 203 | D | + 34 secrets — Charizard set |
| Celebrations | CEL | 2021 | **25** | D | 25th-anniversary set; plus 25-card Classic Collection |
| Fusion Strike | FST / SWSH8 | 2021 | 264 | D | + 20 secrets |
| Brilliant Stars | BRS / SWSH9 | 2022 | 172 | D / E | Print runs split between marks; first Trainer Gallery (`TG01/TG30`) |
| Astral Radiance | ASR / SWSH10 | 2022 | 189 | E | + 27 secrets; Trainer Gallery `TG01/TG30` |
| Pokémon GO | PGO | 2022 | **78** | E | Mini-set |
| Lost Origin | LOR / SWSH11 | 2022 | 196 | E | + 21 secrets; Trainer Gallery `TG01/TG30` |
| Silver Tempest | SIT / SWSH12 | 2022 | 195 | E | + 20 secrets; Trainer Gallery `TG01/TG30` |
| Crown Zenith | CRZ / SWSH12.5 | 2023 | **159** | E | + 71-card Galarian Gallery subset (`GG01/GG70`) |
| **Scarlet & Violet era** | | | | | |
| Scarlet & Violet | SVI / SV1 | 2023 | 198 | F | + 60 secrets |
| Paldea Evolved | PAL / SV2 | 2023 | 193 | F | + 86 secrets — total 279 |
| Obsidian Flames | OBF / SV3 | 2023 | 197 | F | + 33 secrets — total 230 |
| 151 | MEW / SV3.5 | 2023 | **165** | F | Kanto-only mini-set; + 42 secrets |
| Paradox Rift | PAR / SV4 | 2023 | 182 | F | + 84 secrets — total 266 |
| Paldean Fates | PAF / SV4.5 | 2024 | **91** | F | Plus Shiny subset numbered `###/###` continuing past 91 |
| Temporal Forces | TEF / SV5 | 2024 | 162 | G | + 56 secrets — total 218 |
| Twilight Masquerade | TWM / SV6 | 2024 | **167** | H | + 59 secrets — total 226 |
| Shrouded Fable | SFA / SV6.5 | 2024 | **64** | H | Mini-set; + 35 secrets — total 99 |
| Stellar Crown | SCR / SV7 | 2024 | **142** | H | + 33 secrets — total 175 |
| Surging Sparks | SSP / SV8 | 2024 | **191** | H | + 61 secrets — total 252 |
| Prismatic Evolutions | PRE / SV8.5 | 2025 | **131** | H | Eeveelution-themed special set |
| Journey Together | JTG / SV9 | 2025 | **159** | H | + 31 secrets — total 190 |
| Destined Rivals | DRI / SV10 | 2025 | ~182 | I | Team Rocket return; total ~244 |
| Black Bolt | BLK / SV-BB | 2025 | **172** | I | Companion to White Flare |
| White Flare | WHF / SV-WF | 2025 | **173** | I | Companion to Black Bolt |
| Mega Evolution | MEG / SV11 | 2025 | ~150 | I | Reintroduces Mega Evolution mechanic; total ~188 |
| Phantasmal Flames | PHF / SV11.5 | 2025 | ~100 | I | Mega Evolution sub-expansion; total ~130 |
| Ascended Heroes | ASH / SV12 | 2026 | TBD | I/J | Released Jan 30, 2026 |
| Perfect Order | PFO / SV12.5 | 2026 | TBD | J | Released Mar 27, 2026 |
| Chaos Rising | CHR / SV13 | 2026 | TBD | J | Releases May 22, 2026 |

**Disambiguation rule the prompt should apply:**

```
key = (printed_total, copyright_year)
```

The printed total alone is *not* unique — `/68` exists for Hidden Fates (2019) but also a few older Japanese promos. `/159` shows up for both Crown Zenith (2023) and Journey Together (2025). The (total, year) tuple is unique for almost every modern English set. When still ambiguous, fall back to the set symbol (visual) or the card name + Pokémon name combination.

**Promo numbering**: Promos do not follow `N/NNN`. Instead they use a leading set-code: `SWSH001`–`SWSH299` (Sword & Shield Black Star Promos), `SVP 001`+ (Scarlet & Violet Black Star Promos), `SM001`+, `XY001`+. If you see this format, the card is a promo, not a main-set card, and the eBay query should include "Black Star Promo" or "Promo".

---

## 3. Sports cards (Topps, Panini, Bowman, Upper Deck)

Unlike Pokémon, **sports cards put the card number on the back**, not the front. The front carries player name, team logo, and brand wordmark (e.g. `TOPPS`, `BOWMAN`, `PANINI PRIZM`, `UPPER DECK`). Identification flow:

| Brand | Where number lives | Year encoding | Set encoding |
|---|---|---|---|
| **Topps** (baseball, football, soccer) | Back, top-right or top-left, format `### ` or `RC-NN` (rookie cup), `US###` (Update Series) | Bottom of back: `© YYYY TOPPS COMPANY` plus copyright fine print | Set logo printed on back, e.g. "TOPPS SERIES ONE", "TOPPS CHROME" |
| **Panini** (basketball, NFL, soccer) | Back, top-right, often with a small set glyph | Year shown bottom of back in fine print, often as a year range "2023-24" for NBA | Set wordmark on back: "PRIZM", "DONRUSS", "SELECT", "MOSAIC", "OPTIC" |
| **Bowman** (baseball, owned by Topps) | Back, top corner; prospects use `BCP-###` (Bowman Chrome Prospects), `BDP-###` (Bowman Draft) | Bottom of back, year + Topps copyright | "BOWMAN", "BOWMAN CHROME", "BOWMAN DRAFT" wordmark |
| **Upper Deck** (hockey, college football) | Back, top-right | Bottom-back, "© YYYY THE UPPER DECK COMPANY, LLC" | "UPPER DECK", "SP AUTHENTIC", "THE CUP" |
| **Fleer / SkyBox / Score** (legacy) | Back | Bottom-back copyright | Brand wordmark on back |

Two extra patterns to handle:

1. **Serial numbering**: `12/99`, `/25`, `1/1`. Stamped or printed in foil on the front bottom or the back. This is rarity, not the card number — both can appear on the same card.
2. **Parallel suffixes**: Topps Chrome refractors and Panini Prizm parallels are identified by **color of the foil/finish** on the front. The card number stays the same as the base; the parallel is a visual property. Vision must read color of the background pattern (rainbow refractor vs silver prizm vs gold mojo etc.).

For this app, sports-card identification has to read the **back** of the card. The user should be prompted to take a back photo for sports, or the app should ask "is this a sports card?" up front and route accordingly.

---

## 4. Recommended JSON output schema

Have Claude return one object per card. **Never** invent a value — if the field cannot be read directly from the photo, return `null` and lower the confidence.

```json
{
  "category": "pokemon" | "sports" | "other_tcg" | "unknown",
  "language": "en" | "ja" | "fr" | "de" | "es" | "it" | "pt" | "ko" | "zh" | "unknown",
  "cardName": "Charmander",
  "pokemonName": "Charmander",
  "setName": "Vivid Voltage",
  "setCode": "VIV",
  "cardNumber": "023",
  "totalCount": 185,
  "year": 2020,
  "illustrator": "MAHOU",
  "regulationMark": "D",
  "rarity": "Common",
  "rarityGlyph": "●",
  "isPromo": false,
  "isHolo": false,
  "isReverseHolo": false,
  "subType": null,
  "serialNumber": null,
  "language_confidence": 0.97,
  "fields_read_directly": ["cardNumber", "totalCount", "illustrator", "regulationMark", "year"],
  "fields_inferred": ["setName", "setCode"],
  "confidence_overall": 0.86,
  "ambiguity_notes": "totalCount=185 + year=2020 uniquely matches Vivid Voltage."
}
```

For sports:

```json
{
  "category": "sports",
  "sport": "baseball" | "basketball" | "football" | "hockey" | "soccer" | "unknown",
  "playerName": "Mike Trout",
  "team": "Los Angeles Angels",
  "brand": "Topps",
  "setName": "Topps Series One",
  "cardNumber": "27",
  "year": 2023,
  "parallel": "Rainbow Foil",
  "serialNumber": "12/99",
  "isRookie": false,
  "isAutograph": false,
  "isRelic": false,
  "confidence_overall": 0.81,
  "ambiguity_notes": "..."
}
```

**Strict rules to put in the prompt**:

- Return `null` rather than guess. Guessing destroys downstream eBay matching.
- `confidence_overall` is a float 0–1. Below 0.6, the app should ask the user for a second photo.
- `fields_read_directly` lists keys whose values came from pixels in the image. `fields_inferred` lists keys we resolved by joining (totalCount, year) → set table.
- If the card number is partially occluded, return what you can read with `?` in place of unreadable digits (e.g. `"02?"`), not a guess.
- If the language is non-English, mark `language` and **do not** look up `setName` against the English table — return `setName: null` with a note.

---

## 5. Verification data sources

Use one of these to verify a Claude prediction post-hoc, before showing the user a final answer or pulling eBay comps.

| Source | Free? | API key? | Rate limit | (set_total, year, number) lookup? | Notes |
|---|---|---|---|---|---|
| **pokemontcg.io** ([docs](https://docs.pokemontcg.io/)) | Yes | Optional but recommended | 1,000/day no key, 20,000/day with key, contact for higher | Yes — `/v2/cards?q=set.printedTotal:185 number:23 set.releaseDate:2020*` works | Best primary source. Returns image URL, TCGPlayer/Cardmarket prices. |
| **TCGPlayer API** | Yes (with approval) | Yes — apply via [tcgplayer.com developer portal](https://docs.tcgplayer.com/) | Per partner agreement | Yes — by `productId` after lookup | Best for live US prices. Approval is slow; 2–4 weeks. |
| **pkmncards.com** | Yes | No public API; HTML scraping | None enforced; be polite | Yes via search URL: `pkmncards.com/?s=...` | Excellent ground truth for printed total and illustrator; ad-supported, scrape sparingly. |
| **Bulbapedia** ([wiki](https://bulbapedia.bulbagarden.net/)) | Yes | No (MediaWiki API works) | Standard MediaWiki limits | Yes — each set has a page with full card list | Authoritative for set metadata, slower for individual lookups. |
| **TCG Collector** | Free tier | No public API | n/a | Web scrape only | Strong for printed totals incl. secret rares. |
| **PSA / CGC / BGS pop reports** | Public web | No | n/a | Yes (after card identification) | Used for grade-comp post-identification, not identification itself. |

**Recommended chain for the app:**
1. Claude vision returns the JSON above.
2. Server hits `pokemontcg.io` with `set.printedTotal:{totalCount} number:{cardNumber}` and filters by `releaseDate` year.
3. If exactly one card matches, lock the identity, attach `pokemontcg.io` image, query eBay sold-listings for `"{setName} {cardNumber}/{totalCount} {pokemonName}"`.
4. If 0 or >1 matches, surface ambiguity to the user.

---

## 6. Prompt-engineering recommendations for the bottom-left strip

Tell Claude **explicitly** to look at the bottom-left strip of the front of the card, in this order:

1. **Illustrator credit**: read the text immediately after `Illus.` (or `Illust.` on some prints). Stop at the next visual element. **Do not** confuse the illustrator name with the Pokémon name — the Pokémon name is at the **top-left** of the card, not the bottom.
2. **Regulation mark**: a single uppercase letter inside a small rounded rectangle, sitting between the illustrator and the card number. Allowed values: D, E, F, G, H, I, J. Anything else → `null`. **Do not** confuse this with the set abbreviation; set abbreviations are 2–3 letters and live elsewhere.
3. **Card number / total**: read as `NNN/NNN`. Always two integers separated by a slash. The numerator can have a leading zero (`023`). The denominator is the printed total of the set's base run. If part of the number is glare-occluded, return `?` for unreadable digits and lower confidence.
4. **Rarity glyph**: the small symbol immediately after the total. ● = Common, ◆ = Uncommon, ★ = Rare. Other glyphs (RR, AR, SR, SAR, UR, hyphenated text) appear on Scarlet & Violet ex/illustration-rare cards.
5. **Copyright year**: read the 4-digit year after `©`. This is a print-run year, not necessarily the set year, but the two are usually within ±1.

### Failure modes to call out in the system prompt

- **Illustrator name confused with Pokémon name** — guard with "the Pokémon name is at the top-left of the card; the illustrator credit at the bottom-left always begins with `Illus.`".
- **Regulation mark confused with set code** — guard with "the regulation mark is a single uppercase letter; set codes are 2–3 letters and never appear immediately before the card number on main-set cards".
- **Card number cut off in framing** — instruct the user to retake if the bottom 5% of the card is missing.
- **Glare on bottom-left** — common on holo cards under direct light. If glare obscures the strip, lower confidence and ask for retake.
- **Reverse-holo confusion** — reverse-holos have the same number/total as the base card. They are a print variant, not a separate card. Set `isReverseHolo: true` and keep the same cardNumber.
- **Japanese vs English** — Japanese cards use the same layout but `Illus.` is replaced with the kanji for "illustrator", and totals are usually `/SS`, `/Sx`, or `/SV-P`. Set `language: "ja"` and skip the English set table.
- **Pokémon TCG Pocket screenshots** — phone screenshots of the digital game look superficially like cards. The wordmark differs (`Pokémon TCG Pocket` instead of `PokémonTCG`) and there's no physical illustrator strip in the same exact layout. Detect screenshots and reject them.
- **Counterfeits** — fakes often have wrong fonts, missing regulation marks on cards that should have them, or off-by-one totals (`/186` instead of `/185`). The (total, year) lookup will naturally flag these as "no match found".

---

## 7. Honest accuracy ceiling

**100% identification accuracy from a single phone photo is not achievable.** What is realistic, with a strong prompt and good lighting:

| Task | Realistic accuracy |
|---|---|
| Read printed total `/NNN` correctly when bottom-left is in frame & in focus | 97–99% |
| Read full card number `NNN/NNN` | 94–98% |
| Read illustrator name verbatim | 85–92% — cursive/stylized fonts on full-art cards drop this |
| Read regulation mark | 95–99% |
| Resolve to correct set via (total, year) table | 96–99% conditional on the previous reads being correct |
| End-to-end: photo → correct (set, number, name) | **88–94%** for in-focus, well-lit, undamaged Pokémon cards |
| End-to-end on borderline photos (glare, motion blur, partial framing) | 60–75% |
| Sports cards with back photo only, no occlusion | 80–90% |
| Predicting PSA/CGC/BGS grade from a phone photo | 50–70% within ±1 grade. **A phone camera cannot replace a loupe** — surface scratches, print lines, and centering at sub-millimeter precision are the bottleneck. |

**Dominant failure modes**, ranked:
1. Card-number total partially occluded by the user's finger or a card sleeve.
2. Glare across the bottom edge of holo cards.
3. Confusion between two sets that share `/159` or another common total when copyright year is also occluded.
4. Foreign-language cards routed against the English set table.
5. Reverse-holo / promo / non-English variants that exist for the same cardNumber.
6. Grade prediction overconfidence — corner wear and centering are the two largest grade drivers and both are hard from a phone photo.

**Recommendation for the UI**: if `confidence_overall < 0.85`, show the user the proposed identification and let them confirm/edit before pulling comps. If `< 0.6`, ask for a retake with specific guidance ("hold the camera straight above the card; avoid direct overhead light"). Build a "the bottom-left of the card is the most important — make sure it's sharp" hint into the camera capture screen.

---

## Appendix: the reference card

The user's example card resolves as follows:

```
Bottom-left reads: "Illus. MAHOU   D   023/185   •   ©2020 Pokémon"

→ illustrator        = "MAHOU"
→ regulationMark     = "D"
→ cardNumber         = "023"
→ totalCount         = 185
→ rarityGlyph        = "●"  (Common)
→ year               = 2020
→ (185, 2020)        → Vivid Voltage (VIV / SWSH4)
→ card 23/185        → Charmander, Common
→ confirmed via      → pkmncards.com, pokemontcg.io, Bulbapedia
```

This is the gold-standard read. If the prompt produces this exact JSON for this exact card, the pipeline is working.

---

## Sources

- [Pokémon TCG API docs](https://docs.pokemontcg.io/) — primary post-hoc verification API.
- [Bulbapedia — Standard format (TCG)](https://bulbapedia.bulbagarden.net/wiki/Standard_format_(TCG)) — regulation mark canon.
- [Bulbapedia — Twilight Masquerade](https://bulbapedia.bulbagarden.net/wiki/Twilight_Masquerade_(TCG)), [Surging Sparks](https://bulbapedia.bulbagarden.net/wiki/Surging_Sparks_(TCG)), [Shrouded Fable](https://bulbapedia.bulbagarden.net/wiki/Shrouded_Fable_(TCG)) — printed totals.
- [JustInBasil — Set Symbols and Abbreviations](https://www.justinbasil.com/guide/appendix1) — set codes.
- [TCG Collector — Pokémon TCG sets](https://www.tcgcollector.com/sets/intl) — printed totals cross-check.
- [PokéBeach Stellar Crown / Surging Sparks set guides](https://www.pokebeach.com/) — recent SV-era totals.
- [Wargamer — Pokémon TCG expansions in order](https://www.wargamer.com/pokemon-trading-card-game/pokemon-tcg-expansions) — release dates.
- [TCGPlayer Developer Portal](https://docs.tcgplayer.com/) — pricing API.
- [Ballcardgenius — numbers on the back of baseball cards](https://ballcardgenius.com/blog/number-on-back-of-cards/) — sports back-of-card schema.
- [Beckett — How to identify your sports cards](https://www.beckett.com/news/how-to-identify-your-sports-cards/) — sports card identification.
