# ARK Bloodlines

A dependency-free, offline ARK breeding ledger. Open `index.html` directly in a modern browser; no server or installation is required.

This repository also includes the companion **ARK Bloodlines Scanner** ASA mod. The mod adds a creature radial-menu action that allows the user to export breeding data directly into the app via copy/pasting a code.

## Repository layout

- `index.html`, `app.js`, and `styles.css` — the dependency-free browser application
- `species-data.js` and `color-data.js` — bundled offline ARK data
- `mod/ArkBloodlinesScanner/` — the complete ASA DevKit plugin
- `devkit/` — Blueprint clipboard exports, generators, validation helpers, and release documentation
- `assets/branding/` — application and mod branding sources

For DevKit setup, cloud cooking, and unpublished-build testing, see [`mod/README.md`](mod/README.md).

ARK Bloodlines is released under the [MIT License](LICENSE). The bundled ARK Smart Breeding-derived data retains its original MIT attribution in [`ASB-LICENSE.txt`](ASB-LICENSE.txt).

## What it tracks

- Dinos, species, breeding line, sex, status, six mapped ARK color regions, and notes
- Multiple named incubators with ten numbered egg slots each
- Full editable egg records with Hatch-to-Growing and Delete workflows
- Inherited wild/breeding stat rolls plus explicit per-stat mutation stacks (`+2` points per stack)
- Player-added levels per stat and optional current displayed values
- Unique in-game Dino IDs, trait tags, imprint percentage, and imprinter
- Maternal and paternal mutation counters
- Mother/father relationships and top-down, depth-controlled pedigrees with collapsed older branches
- Per-stat lineage tracing with mother/father provenance and signed parent deltas
- Parent-to-offspring inheritance, explicit mutation-stack labels, and likely `+2` mutation detection when no stack was recorded
- Pair projections between `Breeder`-status dinos, trait-adjusted inheritance odds, best possible base level, mutation eligibility, and a stable sample of possible inherited colors
- Species-relative F-to-S genetic quality grades and explained Breed/Hold/Donor/Replace recommendations
- Live displayed-stat estimates from species data, imprint, player levels, taming effectiveness, and server multipliers
- Local custom-species profiles for unsupported or modded creatures

## Data and backups

Records and incubators are saved to the browser's `localStorage` under `ark-bloodlines-ledger-v1`. Use **Data → Export JSON** regularly. Importing a backup replaces the ledger currently stored in that browser.

Each resulting stat is calculated as `Inherited roll + (2 × mutation stacks)`. Base level is `1 +` all seven resulting stats, and current level is the base level plus every player-added level. The resulting mutation-adjusted values are used consistently in breeding, pedigree, quality, and displayed-stat calculations; optional current values remain reference fields because imprinting and server multipliers can change the displayed result.

Version 1 browser records and backups stored final point totals. When they are opened by this version, the app separates any recorded stack bonuses from those totals so the resulting stats and levels do not change during migration.

Version 3 adds incubator entities and egg placement without changing older dino records. Eggs remain complete dino records with parents, inherited stats, mutation counters, colors, traits, and notes, but they are excluded from the Herd register, breeding candidates, and active-line quality comparisons until **Hatch** changes their status to `Growing`. If an imported egg has a missing or conflicting placement, the app moves it into an automatically created recovered incubator rather than hiding or discarding it.

Legacy color notes such as `R0 62 R1 0 R2 36` are mapped automatically into six ARK color-region selectors. The bundled IDs, names, and swatches are derived from the same MIT-licensed ARK Smart Breeding data used by the stat calculator and include ASA's dye-derived creature colors at IDs 128–254; IDs 101–127 are unused. Breeding Lab color samples are deterministic for a selected pair so the display remains stable, but the game still rolls each differing region independently.

When tracked parents are selected while adding a specimen, the first selected parent sets the species automatically. Inherited rolls and carried stat-mutation stacks are then prefilled from the higher parent value—the normal 55% favorite where the parents differ. Color regions are also prefilled: matching parent colors carry through, while each differing region gets an independent 50/50 mother-or-father coin flip for that new entry. The guess stays fixed while the form is open; the Breeding Lab keeps its deterministic sample for easy pair comparisons. Manually edited stat and color fields are preserved unless the relevant **Prefill from parents** button is pressed explicitly.

Every Add/Edit form includes a live **Transfer code** field. Its `ABL1:` Base64URL string contains portable creature data without exposing the app's internal record IDs. Paste a code to populate the fields atomically, or edit any normal field to regenerate the code for copying. Pasting never saves automatically. App-generated codes include identity, parent references, counters, inherited and player-added points, mutation stacks, observed values, colors, traits, imprint data, and notes. The companion scanner can provide the creature's in-game IDs, parents, sex, species, name, stats, mutation counters, color regions, traits, taming effectiveness, and imprint data. Parent references resolve by in-game Dino ID first and by a unique same-species name second. Scanner payloads may provide resulting inherited points as `wildPoints` or `effectiveStats`; the importer subtracts any supplied or already-recorded per-stat mutation stacks before storing the inherited roll.

Scanner payloads deliberately use a flatter schema than app-generated records so the ASA Blueprint graph can remain small. During import, the app joins ARK's `DinoID1` and `DinoID2` components into the same decimal string shown by the game, removes the ` - Lvl N` suffix from ancestor names, maps known ARK name tags such as `Argent` to their canonical species name, and translates scanner field aliases into the app's nested record shape. ASA can expose an ancestor ID component in the wrong numbered field, so each surviving parent-ID component must match either boundary of the tracked game ID; all supplied components must corroborate the same-species parent-name match instead of selecting by name alone.

The herd register includes a dedicated sortable **Line** column. Its headers—including the calculated `G0`, `G1`, and later generation labels—cycle through ascending, descending, and the default species-then-line-then-name order. Program sorting uses the numeric quality score; Top genes sorting compares the displayed inherited gene values from strongest to weakest.

Retired, Culled, and Cryo dinos are archived statuses hidden from the Herd register by default. **Show archived** reveals them, and that device-local preference is remembered without changing exported breeding data. Choosing any archived status in the status filter reveals its records automatically. Archived dinos remain in pedigrees and historical breeding records but are excluded from active-line quality comparisons.

## Incubators

The **Incubators** workspace manages any number of uniquely named incubators. Each one has ten numbered slots, and each slot can contain one `Egg` record. Add an egg from an empty slot or edit an existing dino into `Egg` status and choose its incubator and slot. Egg names are optional; a blank name remains blank in the saved record and input while the interface displays a contextual label such as `Unnamed Egg · Argy Hatchery A · S03`. Female egg labels and sex markers are pink; male labels and markers are blue. The selected incubator shows both a physical ten-slot layout and the same inherited-stat grid used by the Herd register.

**Hatch** records the current date when no hatch date was entered, changes the egg to `Growing`, clears its slot assignment, moves it into the Herd register, and immediately opens its specimen editor for naming and final details. Incubators can be renamed at any time and can be deleted once all ten slots are empty.

## Stat calculator

The calculator follows ARK's standard creature-stat equation and ships with an offline, reduced species dataset derived from [ARK Smart Breeding](https://github.com/cadon/ARKStatsExtractor). The source dataset is MIT licensed; see `ASB-LICENSE.txt`. Official-style multipliers are the default and can be changed from **Data → Stat calculator settings**.

For missing or modded creatures, use **Data → Custom species profiles**. Each profile stores the base value, wild-level increase, domestic-level increase, additive taming bonus, taming-affinity bonus, imprint multiplier, and tamed-base-health multiplier required by the formula.

Servers using `bUseSingleplayerSettings=True` can enable **Apply Single Player Settings stat boosts** under **Data → Calculator & quality settings**. The checkbox preserves the base multiplier values shown in ARK’s Advanced settings and applies the hidden Health and Melee factors during calculation while preserving the separate imprint-scale setting.

Recognized breeding traits use names such as `Weight-Frail III`, `Health-Robust II`, or `Mutable Melee I`. Frail/Robust tiers adjust the normal 55% higher-stat inheritance estimate by 1.5, 2.25, or 3 percentage points. Mutable tiers add 1, 1.5, or 2 percentage points to the planner's mutation estimate. Other trait names remain tracked as labels but do not change stat calculations.

## Quality scores

Quality is genetic, not a measure of current combat strength: player-added levels, imprint, and displayed values do not raise the grade. Each dino is ranked only against active dinos with the same species and **Line** value, using the inherited stats selected under **Data → Calculator & quality settings**. Blank Line values form an `Unassigned` cohort. The score also considers progress over tracked parents, useful `+2` mutations, remaining mutation capacity, unique best genes, and whether recognized Frail/Robust/Mutable traits support the selected goals.

The recommendation is deliberately conservative. **Replace** is strongest when another active dino of the same species and sex matches or beats every target stat with no greater mutation burden. **Stat donor** preserves valuable genes on a mutation-capped line, while **Hold** is used when the cohort is too small or the result is inconclusive. All reasons are shown on the specimen card.
