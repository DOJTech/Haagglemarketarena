# Languages and the Naija flavour

The game ships in three languages: **English** (with Nigerian touches: naira, owambe, NEPA, aso ebi, "Make we do am"), **Naija Pidgin** and **Français**. Players switch with the picker at the top; the choice is remembered on their phone.

## How it works
- Every sentence in the pages is written in plain English in the code. `public/i18n.js` holds the Pidgin and French versions in `DICT`. If a sentence is missing from a language, the English shows. Nothing breaks.
- Shopper dialogue is chosen in the browser from a few lines per language (`OPEN` and `HIGH` in `public/app.js`), so shoppers do not sound the same every time.
- Scenario names, descriptions and objectives come from the server in English and are translated in the browser by the same dictionary.

## Before you launch: get native review
The Pidgin and French were drafted by an AI assistant, not a native-speaker professional. They are good for testing, but have a Nigerian Pidgin speaker and a French speaker read every screen before you promote the game. Fix any line by editing it in `DICT`. `npm test` fails if a French line is missing or a `{placeholder}` or bold tag no longer matches the English.

## Adding Yoruba, Hausa or Igbo
1. Add the language to `LANGS`, `LOCALES` and `HTML_LANG` in `public/i18n.js` (for example `yo`, `ha`, `ig`), to the `<select id="lang">` in `public/index.html`, and to the allowed values for `haggle.lang` in `public/common.js`.
2. Copy the `pcm` block in `DICT`, rename it, and translate each value. Keep every `{placeholder}` and `<b>` tag exactly as it is.
3. Have a native speaker review it, then add it to the checks in `test/i18n.test.js`.

## Extra languages
`public/i18n-more.js` adds Spanish, Portuguese, German, Swahili, Hausa, Yoruba, Igbo, Arabic (right-to-left) and Hindi for the main screens; other text falls back to English. Have native speakers review Hausa, Yoruba and Igbo before launch.
