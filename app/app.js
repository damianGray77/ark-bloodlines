(() => {
  "use strict";

  const STORAGE_KEY = "ark-bloodlines-ledger-v1";
  const UI_STORAGE_KEY = "ark-bloodlines-ui-v1";
  const DATA_VERSION = 3;
  const TRANSFER_CODE_PREFIX = "ABL1:";
  const SCANNER_TRANSFER_CODE_PREFIX = "ABLS1:";
  const TRANSFER_CODE_FORMAT = "ark-bloodlines";
  const SCANNER_TRANSFER_CODE_FORMAT = "ark-bloodlines-scan";
  const TRANSFER_CODE_VERSION = 1;
  const TRANSFER_CODE_MAX_LENGTH = 50000;
  const INCUBATOR_CAPACITY = 10;
  const DINO_STATUSES = ["Breeder", "Growing", "Candidate", "Egg", "Retired", "Culled", "Cryo"];
  const ARCHIVED_STATUSES = new Set(["Retired", "Culled", "Cryo"]);
  const STAT_DEFS = [
    { key: "health", label: "Health", short: "HP", unit: "" },
    { key: "stamina", label: "Stamina", short: "ST", unit: "" },
    { key: "oxygen", label: "Oxygen", short: "OX", unit: "" },
    { key: "food", label: "Food", short: "FD", unit: "" },
    { key: "weight", label: "Weight", short: "WT", unit: "" },
    { key: "melee", label: "Melee", short: "DM", unit: "%" },
    { key: "speed", label: "Speed", short: "SP", unit: "%" }
  ];
  const SPECIES = [
    "Allosaurus", "Ankylosaurus", "Argentavis", "Baryonyx", "Basilosaurus", "Brontosaurus",
    "Carcharodontosaurus", "Castoroides", "Daeodon", "Deinonychus", "Desmodus", "Dire Bear",
    "Direwolf", "Doedicurus", "Fjordhawk", "Giganotosaurus", "Griffin", "Maewing", "Magmasaur",
    "Mammoth", "Managarmr", "Megatherium", "Mosasaurus", "Otter", "Ovis", "Paraceratherium",
    "Parasaur", "Procoptodon", "Pteranodon", "Quetzal", "Raptor", "Ravager", "Rex", "Rock Drake",
    "Shadowmane", "Snow Owl", "Spino", "Stegosaurus", "Tapejara", "Tek Rex", "Therizinosaur",
    "Thylacoleo", "Triceratops", "Tusoteuthis", "Velonasaur", "Fire Wyvern", "Lightning Wyvern", "Poison Wyvern", "Ice Wyvern", "Yutyrannus"
  ];
  const SPECIES_ALIASES = { daedon: "daeodon", spinosaurus: "spino", therizinosaurus: "therizinosaur" };
  const TRANSFER_SPECIES_ALIASES = { argent: "Argentavis" };
  const OFFICIAL_SETTINGS = {
    imprintScale: 1,
    multipliers: {
      health: { wild: 1, domestic: .2, tameAdd: .14, tameAffinity: .44 },
      stamina: { wild: 1, domestic: 1, tameAdd: 1, tameAffinity: 1 },
      oxygen: { wild: 1, domestic: 1, tameAdd: 1, tameAffinity: 1 },
      food: { wild: 1, domestic: 1, tameAdd: 1, tameAffinity: 1 },
      weight: { wild: 1, domestic: 1, tameAdd: 1, tameAffinity: 1 },
      melee: { wild: 1, domestic: .17, tameAdd: .14, tameAffinity: .44 },
      speed: { wild: 1, domestic: 1, tameAdd: 1, tameAffinity: 1 }
    }
  };
  const SINGLE_PLAYER_STAT_FACTORS = {
    health: { domestic: 2.125, tameAdd: 3.5714285, tameAffinity: 2.2727273 },
    melee: { domestic: 2.3529413, tameAdd: 3.5714285, tameAffinity: 2.2727273 }
  };
  const LEGACY_SINGLE_PLAYER_EFFECTIVE_VALUES = {
    health: { domestic: .425, tameAdd: .5, tameAffinity: 1 },
    melee: { domestic: .4, tameAdd: .5, tameAffinity: 1 }
  };
  const DEFAULT_BREEDING_GOAL = {
    health: "high",
    stamina: "high",
    oxygen: "ignore",
    food: "ignore",
    weight: "high",
    melee: "high",
    speed: "ignore"
  };
  const QUALITY_MODES = ["high", "low", "ignore"];
  const COLOR_REGION_COUNT = 6;
  const COLOR_DATA = Array.isArray(globalThis.ARK_COLOR_DATA) && globalThis.ARK_COLOR_DATA.length
    ? globalThis.ARK_COLOR_DATA
    : [{ id: 0, name: "No color / unused", hex: "#777777" }];
  const COLOR_BY_ID = new Map(COLOR_DATA.map(color => [color.id, color]));
  const COLOR_BY_NAME = new Map(COLOR_DATA.map(color => [color.name.toLowerCase().replace(/[^a-z0-9]/g, ""), color]));

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const toInt = value => Math.max(0, Number.parseInt(value, 10) || 0);
  const toPercent = value => Math.min(100, toInt(value));
  const uid = () => globalThis.crypto?.randomUUID?.() || `dino-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  const statMutationStacks = (dino, statKey) => toInt(dino?.mutationStacks?.[statKey]);
  const mutationPointBonus = (dino, statKey) => statMutationStacks(dino, statKey) * 2;
  const effectiveStatPoints = (dino, statKey) => toInt(dino?.stats?.[statKey]) + mutationPointBonus(dino, statKey);
  const statSum = dino => STAT_DEFS.reduce((sum, stat) => sum + effectiveStatPoints(dino, stat.key), 0);
  const baseLevel = dino => 1 + statSum(dino);
  const playerLevelSum = dino => STAT_DEFS.reduce((sum, stat) => sum + toInt(dino?.leveledStats?.[stat.key]), 0);
  const currentLevel = dino => baseLevel(dino) + playerLevelSum(dino);
  const mutationTotal = dino => toInt(dino?.mutationsMaternal) + toInt(dino?.mutationsPaternal);
  const recordedMutationStackTotal = dino => STAT_DEFS.reduce((sum, stat) => sum + statMutationStacks(dino, stat.key), 0);
  const isArchivedDino = dino => ARCHIVED_STATUSES.has(dino?.status);
  const isEggDino = dino => dino?.status === "Egg";
  const isActiveDino = dino => !isArchivedDino(dino) && !isEggDino(dino);
  const getDino = id => state.dinos.find(dino => dino.id === id);
  const getIncubator = id => state.incubators.find(incubator => incubator.id === id);
  const incubatorEggs = id => state.dinos.filter(dino => isEggDino(dino) && dino.incubatorId === id).sort((a, b) => a.incubatorSlot - b.incubatorSlot);
  const getParents = dino => [getDino(dino?.motherId), getDino(dino?.fatherId)];
  const formatPercent = value => `${(value * 100).toFixed(value < .1 ? 1 : 0)}%`;
  const signed = value => value == null ? "—" : `${value > 0 ? "+" : ""}${value}`;
  const normalizeSpeciesName = name => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const displayLineName = dino => String(dino?.tag || "").trim();
  const normalizeLineName = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  let state = loadState();
  let uiPreferences = loadUiPreferences();
  let selectedId = state.dinos.find(dino => !isEggDino(dino))?.id || state.dinos[0]?.id || "";
  let selectedIncubatorId = state.incubators[0]?.id || "";
  let activeView = "herd";
  let rosterSort = { key: "", direction: "" };
  let toastTimer;
  let dinoFormPrefill = { editing: false, manualStats: new Set(), manualColors: new Set(), colorSuggestions: new Map(), suggestions: {} };
  let transferCodeSyncing = false;
  let transferCodeInputTimer;

  function emptyStats() {
    return Object.fromEntries(STAT_DEFS.map(stat => [stat.key, 0]));
  }

  function normalizeColorId(value) {
    if (value === "" || value == null) return null;
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id >= 0 && id <= 255 ? id : null;
  }

  function parseLegacyColorRegions(value) {
    const regions = Array(COLOR_REGION_COUNT).fill(null);
    const text = String(value || "");
    const pattern = /R(?:egion)?\s*([0-5])\s*[:=#-]?\s*(.+?)(?=\s+R(?:egion)?\s*[0-5]\b|[,;]|$)/gi;
    for (const match of text.matchAll(pattern)) {
      const region = Number(match[1]);
      const token = match[2].trim();
      const numeric = token.match(/^\d{1,3}\b/);
      if (numeric) {
        regions[region] = normalizeColorId(numeric[0]);
        continue;
      }
      const named = COLOR_BY_NAME.get(token.toLowerCase().replace(/[^a-z0-9]/g, ""));
      if (named) regions[region] = named.id;
    }
    return regions;
  }

  function normalizeColorRegions(rawRegions, legacyValue = "") {
    const legacy = parseLegacyColorRegions(legacyValue);
    return Array.from({ length: COLOR_REGION_COUNT }, (_, region) => {
      const candidate = Array.isArray(rawRegions) ? rawRegions[region] : rawRegions?.[region] ?? rawRegions?.[`R${region}`];
      const normalized = normalizeColorId(candidate);
      return normalized == null ? legacy[region] : normalized;
    });
  }

  function formatColorRegions(regions) {
    return normalizeColorRegions(regions).map((id, region) => id == null ? "" : `R${region} ${id}`).filter(Boolean).join(" ");
  }

  function colorInfo(id) {
    const normalized = normalizeColorId(id);
    return normalized == null
      ? { id: null, name: "Unknown", hex: "#777777" }
      : COLOR_BY_ID.get(normalized) || { id: normalized, name: `Color ${normalized}`, hex: "#777777" };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !Array.isArray(parsed.dinos)) return { version: DATA_VERSION, dinos: [], incubators: [], settings: normalizeSettings() };
      return normalizeState(parsed);
    } catch {
      return { version: DATA_VERSION, dinos: [], incubators: [], settings: normalizeSettings() };
    }
  }

  function normalizeIncubator(raw = {}, fallbackIndex = 0) {
    const now = new Date().toISOString();
    return {
      id: String(raw.id || uid()),
      name: String(raw.name || `Incubator ${fallbackIndex + 1}`).trim() || `Incubator ${fallbackIndex + 1}`,
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now
    };
  }

  function normalizeState(raw = {}, fallbackSettings) {
    const sourceVersion = toInt(raw.version) || 1;
    const usedIds = new Set();
    const usedNames = new Set();
    const incubators = (Array.isArray(raw.incubators) ? raw.incubators : []).map((item, index) => {
      const incubator = normalizeIncubator(item, index);
      while (usedIds.has(incubator.id)) incubator.id = uid();
      let name = incubator.name;
      let suffix = 2;
      while (usedNames.has(name.toLowerCase())) name = `${incubator.name} ${suffix++}`;
      incubator.name = name;
      usedIds.add(incubator.id);
      usedNames.add(name.toLowerCase());
      return incubator;
    });
    const dinos = (Array.isArray(raw.dinos) ? raw.dinos : []).map(dino => normalizeDino(dino, sourceVersion));
    const occupied = new Map(incubators.map(incubator => [incubator.id, new Set()]));
    const nextRecoveredName = () => {
      const root = "Recovered incubator";
      let name = root;
      let suffix = 2;
      while (usedNames.has(name.toLowerCase())) name = `${root} ${suffix++}`;
      usedNames.add(name.toLowerCase());
      return name;
    };
    const findOpenPlacement = () => {
      for (const incubator of incubators) {
        const slots = occupied.get(incubator.id);
        for (let slot = 1; slot <= INCUBATOR_CAPACITY; slot += 1) {
          if (!slots.has(slot)) return { incubator, slot };
        }
      }
      const incubator = normalizeIncubator({ name: nextRecoveredName() }, incubators.length);
      incubators.push(incubator);
      occupied.set(incubator.id, new Set());
      return { incubator, slot: 1 };
    };
    dinos.filter(isEggDino).forEach(dino => {
      const slots = occupied.get(dino.incubatorId);
      const validSlot = dino.incubatorSlot >= 1 && dino.incubatorSlot <= INCUBATOR_CAPACITY;
      if (slots && validSlot && !slots.has(dino.incubatorSlot)) {
        slots.add(dino.incubatorSlot);
        return;
      }
      const placement = findOpenPlacement();
      dino.incubatorId = placement.incubator.id;
      dino.incubatorSlot = placement.slot;
      occupied.get(placement.incubator.id).add(placement.slot);
    });
    return {
      version: DATA_VERSION,
      dinos,
      incubators,
      settings: normalizeSettings(raw.settings || fallbackSettings)
    };
  }

  function loadUiPreferences() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UI_STORAGE_KEY));
      return { showArchived: parsed?.showArchived === true };
    } catch {
      return { showArchived: false };
    }
  }

  function saveUiPreferences() {
    try {
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiPreferences));
    } catch {
      // The filter still works for this session if browser storage is unavailable.
    }
  }

  function normalizeBreedingGoal(raw = {}) {
    return Object.fromEntries(STAT_DEFS.map(stat => [stat.key, QUALITY_MODES.includes(raw[stat.key]) ? raw[stat.key] : DEFAULT_BREEDING_GOAL[stat.key]]));
  }

  function usesLegacySinglePlayerPreset(multipliers) {
    const nearlyEqual = (left, right) => Math.abs(Number(left) - Number(right)) < .000001;
    return ["health", "melee"].every(statKey =>
      ["domestic", "tameAdd", "tameAffinity"].every(type =>
        nearlyEqual(multipliers?.[statKey]?.[type], LEGACY_SINGLE_PLAYER_EFFECTIVE_VALUES[statKey][type])
      )
    );
  }

  function normalizeSettings(raw = {}) {
    const settings = {
      imprintScale: Number.isFinite(Number(raw.imprintScale)) ? Math.max(0, Number(raw.imprintScale)) : OFFICIAL_SETTINGS.imprintScale,
      singlePlayerSettings: raw.singlePlayerSettings === true,
      multipliers: {},
      customSpecies: {},
      breedingGoals: {}
    };
    STAT_DEFS.forEach(stat => {
      settings.multipliers[stat.key] = {};
      ["wild", "domestic", "tameAdd", "tameAffinity"].forEach(type => {
        const value = Number(raw.multipliers?.[stat.key]?.[type]);
        settings.multipliers[stat.key][type] = Number.isFinite(value) && value >= 0 ? value : OFFICIAL_SETTINGS.multipliers[stat.key][type];
      });
    });
    if (settings.singlePlayerSettings && usesLegacySinglePlayerPreset(settings.multipliers)) {
      ["health", "melee"].forEach(statKey => {
        ["domestic", "tameAdd", "tameAffinity"].forEach(type => {
          settings.multipliers[statKey][type] = OFFICIAL_SETTINGS.multipliers[statKey][type];
        });
      });
    }
    Object.entries(raw.customSpecies || {}).forEach(([key, profile]) => {
      const normalized = normalizeCustomProfile(profile);
      if (normalized) settings.customSpecies[normalizeSpeciesName(key || normalized.name)] = normalized;
    });
    Object.entries(raw.breedingGoals || {}).forEach(([key, goal]) => {
      settings.breedingGoals[normalizeSpeciesName(key)] = normalizeBreedingGoal(goal);
    });
    return settings;
  }

  function normalizeCustomProfile(raw) {
    if (!raw?.name) return null;
    const stats = {};
    const imprint = {};
    STAT_DEFS.forEach(stat => {
      const values = raw.stats?.[stat.key];
      stats[stat.key] = Array.isArray(values) && values.length >= 5 ? values.slice(0, 5).map(value => Number(value) || 0) : null;
      imprint[stat.key] = Math.max(0, Number(raw.imprint?.[stat.key]) || 0);
    });
    return { name: String(raw.name).trim(), stats, imprint, tbhm: Math.max(0, Number(raw.tbhm) || 1), custom: true, unsupported: false };
  }

  function normalizeDino(raw = {}, sourceVersion = DATA_VERSION) {
    const mutationStacks = Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt(raw.mutationStacks?.[stat.key])]));
    const legacyFinalPoints = sourceVersion < 2;
    const colorRegions = normalizeColorRegions(raw.colorRegions, raw.colors);
    const status = DINO_STATUSES.includes(raw.status) ? raw.status : "Breeder";
    const enteredName = String(raw.name ?? "").trim();
    const recordedName = status === "Egg" && /^Unnamed Egg · .+ · S\d{2}$/.test(enteredName) ? "" : enteredName;
    return {
      id: String(raw.id || uid()),
      name: recordedName,
      species: String(raw.species || "Unknown"),
      sex: raw.sex === "Male" ? "Male" : "Female",
      status,
      incubatorId: status === "Egg" ? String(raw.incubatorId || "") : "",
      incubatorSlot: status === "Egg" ? Math.min(INCUBATOR_CAPACITY, toInt(raw.incubatorSlot)) : 0,
      tag: String(raw.tag || ""),
      gameId: String(raw.gameId || ""),
      origin: raw.origin === "tamed" ? "tamed" : "bred",
      tamingEffectiveness: Math.min(100, Math.max(0, Number(raw.tamingEffectiveness ?? 100) || 0)),
      born: String(raw.born || ""),
      motherId: String(raw.motherId || ""),
      fatherId: String(raw.fatherId || ""),
      mutationsMaternal: toInt(raw.mutationsMaternal),
      mutationsPaternal: toInt(raw.mutationsPaternal),
      stats: Object.fromEntries(STAT_DEFS.map(stat => {
        const storedPoints = toInt(raw.stats?.[stat.key]);
        return [stat.key, Math.max(0, storedPoints - (legacyFinalPoints ? mutationStacks[stat.key] * 2 : 0))];
      })),
      mutationStacks,
      leveledStats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt(raw.leveledStats?.[stat.key])])),
      currentStats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, String(raw.currentStats?.[stat.key] ?? "")])),
      traits: Array.isArray(raw.traits) ? raw.traits.map(String).map(item => item.trim()).filter(Boolean) : String(raw.traits || "").split(",").map(item => item.trim()).filter(Boolean),
      imprintPercent: toPercent(raw.imprintPercent),
      imprinter: String(raw.imprinter || ""),
      colorRegions,
      colors: String(raw.colors || formatColorRegions(colorRegions)),
      notes: String(raw.notes || ""),
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function saveState(message) {
    state.version = DATA_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) showToast(message);
  }

  function generationOf(dino, trail = new Set()) {
    if (!dino || trail.has(dino.id)) return 0;
    const nextTrail = new Set(trail).add(dino.id);
    const parents = getParents(dino).filter(Boolean);
    return parents.length ? 1 + Math.max(...parents.map(parent => generationOf(parent, nextTrail))) : 0;
  }

  function speciesBest(species) {
    const cohort = state.dinos.filter(dino => dino.species === species && isActiveDino(dino));
    return Object.fromEntries(STAT_DEFS.map(stat => [stat.key, Math.max(0, ...cohort.map(dino => effectiveStatPoints(dino, stat.key)))]));
  }

  function getSpeciesProfile(species) {
    const normalized = normalizeSpeciesName(species);
    const key = SPECIES_ALIASES[normalized] || normalized;
    return state.settings.customSpecies[normalized] || state.settings.customSpecies[key] || globalThis.ARK_SPECIES_DATA?.[key] || null;
  }

  function parseBreedingTrait(name) {
    const cleaned = String(name || "").trim().toLowerCase().replace(/[–—_]/g, "-");
    const tierMatch = cleaned.match(/(?:\s|-)(iii|ii|i|[1-3])$/i);
    const tierToken = tierMatch?.[1]?.toLowerCase();
    const tier = tierToken === "iii" || tierToken === "3" ? 3 : tierToken === "ii" || tierToken === "2" ? 2 : 1;
    const core = tierMatch ? cleaned.slice(0, tierMatch.index).trim() : cleaned;
    const stat = STAT_DEFS.find(item => new RegExp(`\\b${item.key}\\b`, "i").test(core));
    const kind = ["frail", "robust", "mutable"].find(type => new RegExp(`\\b${type}\\b`, "i").test(core));
    if (!stat || !kind) return null;
    const values = kind === "mutable" ? [1, 1.5, 2] : [1.5, 2.25, 3];
    return { statKey: stat.key, kind, tier, percentagePoints: values[tier - 1], name };
  }

  function pairTraitEffects(mother, father, statKey) {
    const parsed = [...(mother?.traits || []), ...(father?.traits || [])].map(parseBreedingTrait).filter(Boolean).filter(trait => trait.statKey === statKey);
    const robust = parsed.filter(trait => trait.kind === "robust").reduce((sum, trait) => sum + trait.percentagePoints, 0);
    const frail = parsed.filter(trait => trait.kind === "frail").reduce((sum, trait) => sum + trait.percentagePoints, 0);
    const mutable = parsed.filter(trait => trait.kind === "mutable").reduce((sum, trait) => sum + trait.percentagePoints, 0);
    return { robust, frail, mutable, inheritanceChance: Math.min(1, Math.max(0, .55 + (robust - frail) / 100)), parsed };
  }

  function effectiveStatMultipliers(statKey, baseMultipliers = state.settings.multipliers[statKey], singlePlayerEnabled = state.settings.singlePlayerSettings) {
    const factors = singlePlayerEnabled ? SINGLE_PLAYER_STAT_FACTORS[statKey] : null;
    return {
      wild: baseMultipliers.wild,
      domestic: baseMultipliers.domestic * (factors?.domestic || 1),
      tameAdd: baseMultipliers.tameAdd * (factors?.tameAdd || 1),
      tameAffinity: baseMultipliers.tameAffinity * (factors?.tameAffinity || 1)
    };
  }

  function calculateStatValue(dino, statKey) {
    const profile = getSpeciesProfile(dino?.species);
    const raw = profile?.stats?.[statKey];
    if (!profile || profile.unsupported || !raw) return null;
    const [base, wildIncrease, domesticIncrease, tameAdd, tameAffinity] = raw;
    const multipliers = effectiveStatMultipliers(statKey);
    const wildLevels = effectiveStatPoints(dino, statKey);
    const domesticLevels = toInt(dino.leveledStats?.[statKey]);
    const imprint = dino.origin === "bred" ? toPercent(dino.imprintPercent) / 100 : 0;
    const tamingEffectiveness = dino.origin === "bred" ? 1 : Math.min(1, Math.max(0, Number(dino.tamingEffectiveness) / 100));
    const imprintMultiplier = Number(profile.imprint?.[statKey] || 0);
    const tamedBaseHealth = statKey === "health" ? Number(profile.tbhm || 1) : 1;
    const affinityEffectiveness = tameAffinity > 0 ? tamingEffectiveness : 1;
    const postTame = (base * (1 + wildLevels * wildIncrease * multipliers.wild) * tamedBaseHealth * (1 + imprint * imprintMultiplier * state.settings.imprintScale) + tameAdd * multipliers.tameAdd)
      * (1 + affinityEffectiveness * tameAffinity * multipliers.tameAffinity);
    return postTame * (1 + domesticLevels * domesticIncrease * multipliers.domestic);
  }

  function formatStatValue(value, stat) {
    if (value == null || !Number.isFinite(value)) return "—";
    if (stat.unit === "%") return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const decimals = value < 1000 && !Number.isInteger(value) ? 1 : 0;
    return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  }

  function statProvenance(dino, statKey) {
    const [mother, father] = getParents(dino);
    const child = effectiveStatPoints(dino, statKey);
    const childBase = toInt(dino?.stats?.[statKey]);
    const mutationStacks = statMutationStacks(dino, statKey);
    const mutationPoints = mutationStacks * 2;
    const motherValue = mother ? effectiveStatPoints(mother, statKey) : null;
    const fatherValue = father ? effectiveStatPoints(father, statKey) : null;
    const values = [motherValue, fatherValue].filter(value => value != null);
    const deltaMother = motherValue == null ? null : child - motherValue;
    const deltaFather = fatherValue == null ? null : child - fatherValue;
    let source = "foundation";
    let label = "Foundation";
    let parentSource = "";
    let newMutationStacks = 0;
    if (values.length) {
      const mutationCandidates = [
        mother ? { role: "mother", base: toInt(mother.stats[statKey]), stacks: statMutationStacks(mother, statKey) } : null,
        father ? { role: "father", base: toInt(father.stats[statKey]), stacks: statMutationStacks(father, statKey) } : null
      ].filter(parent => parent && parent.base === childBase && mutationStacks > parent.stacks);
      if (mutationCandidates.length) {
        const closestStackCount = Math.max(...mutationCandidates.map(parent => parent.stacks));
        const closestParents = mutationCandidates.filter(parent => parent.stacks === closestStackCount);
        newMutationStacks = mutationStacks - closestStackCount;
        source = "mutation";
        parentSource = closestParents.length === 2 ? "both" : closestParents[0].role;
        label = `${newMutationStacks} new ${newMutationStacks === 1 ? "stack" : "stacks"} (+${newMutationStacks * 2}) · ${mutationStacks} total`;
      } else if (motherValue != null && fatherValue != null && child === motherValue && child === fatherValue) {
        source = "both";
        parentSource = "both";
        label = mutationStacks ? `Both parents · ${mutationStacks} ${mutationStacks === 1 ? "stack" : "stacks"}` : "Both parents";
      } else if (motherValue != null && child === motherValue) {
        source = "mother";
        parentSource = "mother";
        label = mutationStacks ? `Mother · ${mutationStacks} ${mutationStacks === 1 ? "stack" : "stacks"}` : "Mother";
      } else if (fatherValue != null && child === fatherValue) {
        source = "father";
        parentSource = "father";
        label = mutationStacks ? `Father · ${mutationStacks} ${mutationStacks === 1 ? "stack" : "stacks"}` : "Father";
      }
      const high = Math.max(...values);
      if (source === "foundation" && !mutationStacks && child === high + 2) {
        source = "mutation";
        label = "Likely +2 mutation";
        newMutationStacks = 1;
        parentSource = motherValue === high && fatherValue === high ? "both" : motherValue === high ? "mother" : "father";
      }
      else if (source === "foundation" && child > high) { source = "above"; label = "Above both"; }
      else if (source === "foundation" && child < Math.min(...values)) { source = "below"; label = "Below both"; }
      else if (source === "foundation") { source = "unverified"; label = "Does not match"; }
    } else if (mutationStacks) {
      source = "mutation";
      label = `Carries ${mutationStacks} ${mutationStacks === 1 ? "stack" : "stacks"} (+${mutationPoints})`;
    }
    return { child, childBase, motherValue, fatherValue, deltaMother, deltaFather, source, label, parentSource, mutationStacks, mutationPoints, newMutationStacks };
  }

  function analyzeInheritance(dino) {
    const [mother, father] = getParents(dino);
    if (!mother && !father) return [];
    return STAT_DEFS.map(stat => {
      const provenance = statProvenance(dino, stat.key);
      const child = provenance.child;
      const values = [mother, father].filter(Boolean).map(parent => effectiveStatPoints(parent, stat.key));
      const high = Math.max(...values);
      let kind = "unverified";
      let text = "Does not match a tracked parent";
      if (provenance.source === "mutation") {
        kind = "mutation";
        text = provenance.mutationStacks
          ? `${provenance.newMutationStacks || provenance.mutationStacks} recorded ${(provenance.newMutationStacks || provenance.mutationStacks) === 1 ? "stack" : "stacks"} contributes +${(provenance.newMutationStacks || provenance.mutationStacks) * 2} points`
          : `Likely +2 mutation above the parent high of ${high}`;
      } else if (["mother", "father", "both"].includes(provenance.source)) {
        kind = child === high ? "high" : "low";
        text = child === high ? "Inherited the higher tracked value" : "Inherited the lower tracked value";
      }
      return { ...stat, ...provenance, child, high, kind, text };
    });
  }

  function getBreedingGoal(species) {
    return state.settings.breedingGoals[normalizeSpeciesName(species)] || normalizeBreedingGoal();
  }

  function qualityGrade(score) {
    if (score >= 90) return "S";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  function qualityAssessment(dino) {
    const normalizedSpecies = normalizeSpeciesName(dino.species);
    const normalizedLine = normalizeLineName(dino.tag);
    const lineName = displayLineName(dino);
    const activeLine = state.dinos.filter(item => normalizeSpeciesName(item.species) === normalizedSpecies && normalizeLineName(item.tag) === normalizedLine && isActiveDino(item));
    const cohort = activeLine.some(item => item.id === dino.id) ? activeLine : [...activeLine, dino];
    const goal = getBreedingGoal(dino.species);
    const targets = STAT_DEFS.map(stat => ({ ...stat, mode: goal[stat.key] })).filter(stat => stat.mode !== "ignore");
    if (!targets.length) {
      return {
        score: 50,
        grade: "C",
        recommendation: { code: "hold", label: "HOLD" },
        reasons: [`No breeding goals are selected for ${dino.species}.`, "Choose at least one High or Low target before making a cull decision."],
        components: { genes: 50, lineage: 50, mutation: 50 },
        targetCount: 0
      };
    }

    const rankings = targets.map(stat => {
      const value = effectiveStatPoints(dino, stat.key);
      const values = cohort.map(item => effectiveStatPoints(item, stat.key));
      const betterCount = values.filter(other => stat.mode === "high" ? other < value : other > value).length;
      const equalCount = values.filter(other => other === value).length;
      const percentile = cohort.length === 1 ? 50 : (betterCount + Math.max(0, equalCount - 1) / 2) / (cohort.length - 1) * 100;
      const lineBest = stat.mode === "high" ? Math.max(...values) : Math.min(...values);
      const bestCount = values.filter(other => other === lineBest).length;
      return { ...stat, value, percentile, best: value === lineBest, unique: cohort.length > 1 && value === lineBest && bestCount === 1 };
    });
    const geneScore = rankings.reduce((sum, item) => sum + item.percentile, 0) / rankings.length;
    const uniqueBest = rankings.filter(item => item.unique);

    const parents = getParents(dino).filter(Boolean);
    const lineageRows = targets.map(stat => {
      const parentValues = parents.map(parent => effectiveStatPoints(parent, stat.key));
      if (!parentValues.length) return { ...stat, delta: null, score: 50 };
      const idealParent = stat.mode === "high" ? Math.max(...parentValues) : Math.min(...parentValues);
      const value = effectiveStatPoints(dino, stat.key);
      const delta = stat.mode === "high" ? value - idealParent : idealParent - value;
      const score = delta > 0 ? Math.min(100, 80 + delta * 5) : delta === 0 ? 72 : Math.max(0, 45 + delta * 7);
      return { ...stat, delta, score };
    });
    const lineageScore = lineageRows.reduce((sum, item) => sum + item.score, 0) / lineageRows.length;
    const progressed = lineageRows.filter(item => item.delta > 0);
    const regressed = lineageRows.filter(item => item.delta < 0);
    const targetedMutations = targets.filter(stat => stat.mode === "high" && (statMutationStacks(dino, stat.key) > 0 || statProvenance(dino, stat.key).source === "mutation"));

    const totalMutations = mutationTotal(dino);
    const mutationScore = targetedMutations.length && totalMutations < 20 ? 90 : totalMutations === 0 ? 75 : totalMutations < 20 ? 65 : 25;
    const traitEffects = (dino.traits || []).map(parseBreedingTrait).filter(Boolean).map(trait => {
      const target = targets.find(stat => stat.key === trait.statKey);
      if (!target) return { ...trait, impact: 0 };
      if (trait.kind === "mutable") return { ...trait, impact: totalMutations < 20 ? trait.percentagePoints * .75 : 0 };
      const aligned = (trait.kind === "robust" && target.mode === "high") || (trait.kind === "frail" && target.mode === "low");
      return { ...trait, impact: aligned ? trait.percentagePoints : -trait.percentagePoints };
    });
    const traitAdjustment = Math.max(-5, Math.min(5, traitEffects.reduce((sum, trait) => sum + trait.impact, 0)));
    const uniqueBonus = Math.min(5, uniqueBest.length * 2);
    const score = Math.max(0, Math.min(100, Math.round(geneScore * .7 + lineageScore * .2 + mutationScore * .1 + traitAdjustment + uniqueBonus)));

    const replacement = activeLine
      .filter(other => other.id !== dino.id && other.sex === dino.sex)
      .find(other => {
        const comparisons = targets.map(stat => {
          const candidate = effectiveStatPoints(dino, stat.key);
          const alternative = effectiveStatPoints(other, stat.key);
          return stat.mode === "high" ? alternative - candidate : candidate - alternative;
        });
        return comparisons.every(delta => delta >= 0) && comparisons.some(delta => delta > 0) && mutationTotal(other) <= totalMutations;
      });
    const sameSexLine = activeLine.filter(other => other.sex === dino.sex);

    let recommendation;
    if (isEggDino(dino)) recommendation = { code: "egg", label: "INCUBATING" };
    else if (isArchivedDino(dino)) recommendation = { code: "archive", label: "ARCHIVED" };
    else if (cohort.length < 2) recommendation = { code: "hold", label: "HOLD" };
    else if (replacement) recommendation = { code: "replace", label: "REPLACE" };
    else if (uniqueBest.length || targetedMutations.length) recommendation = { code: "priority", label: "PRIORITY BREED" };
    else if (sameSexLine.length < 2) recommendation = { code: "hold", label: "HOLD" };
    else if (totalMutations >= 20 && score < 80) recommendation = { code: "donor", label: "STAT DONOR" };
    else if (score >= 65) recommendation = { code: "breed", label: score >= 80 ? "BREED" : "BREED SELECTIVELY" };
    else if (score >= 50) recommendation = { code: "hold", label: "HOLD" };
    else recommendation = { code: "replace", label: "REPLACE" };

    const reasons = [];
    if (isEggDino(dino)) reasons.push("This egg remains outside active-line comparisons until it is hatched.");
    else if (isArchivedDino(dino)) reasons.push(`This record is marked ${dino.status} and is excluded from active-line comparisons.`);
    else if (cohort.length < 2) reasons.push(`Add another active ${dino.species} to the ${lineName || "Unassigned"} line before making a cull decision.`);
    else if (sameSexLine.length < 2 && !uniqueBest.length && !targetedMutations.length) reasons.push(`This is the only active ${dino.sex.toLowerCase()} in the ${lineName || "Unassigned"} line; keep it until a replacement is proven.`);
    if (replacement) reasons.push(`${displayDinoName(replacement)} matches or beats every target gene for the same sex with no greater mutation burden.`);
    if (recommendation.code === "replace" && !replacement) reasons.push("Overall genetic quality is below the retention threshold and no unique target gene offsets it.");
    if (uniqueBest.length) reasons.push(`${uniqueBest.map(stat => stat.label).join(", ")} ${uniqueBest.length === 1 ? "is" : "are"} uniquely best in the active line.`);
    if (targetedMutations.length) reasons.push(`Targeted +2 progress detected in ${targetedMutations.map(stat => stat.label).join(", ")}.`);
    if (progressed.length) reasons.push(`Improves ${progressed.map(stat => stat.label).join(", ")} beyond the best tracked parent value.`);
    if (regressed.length) reasons.push(`${regressed.map(stat => stat.label).join(", ")} ${regressed.length === 1 ? "falls" : "fall"} behind the preferred parent value.`);
    if (totalMutations >= 20) reasons.push(`${totalMutations} ancestry mutations block this dino's side from rolling new mutations.`);
    const alignedTraits = traitEffects.filter(trait => trait.impact > 0);
    const opposingTraits = traitEffects.filter(trait => trait.impact < 0);
    if (alignedTraits.length) reasons.push(`${alignedTraits.map(trait => trait.name).join(", ")} supports the selected breeding goals.`);
    if (opposingTraits.length) reasons.push(`${opposingTraits.map(trait => trait.name).join(", ")} works against the selected breeding goals.`);
    if (reasons.length < 2) reasons.push(`Target genes rank at percentile ${Math.round(geneScore)} among ${cohort.length} active ${dino.species} in the ${lineName || "Unassigned"} line.`);
    if (reasons.length < 2) reasons.push(score >= 65 ? "No same-sex breeder in this line currently dominates every selected target gene." : "No unique best target gene is currently recorded on this dino.");

    return {
      score,
      grade: qualityGrade(score),
      recommendation,
      reasons: [...new Set(reasons)].slice(0, 3),
      components: { genes: Math.round(geneScore), lineage: Math.round(lineageScore), mutation: Math.round(mutationScore) },
      targetCount: targets.length,
      uniqueBest,
      replacement
    };
  }

  function renderAll() {
    if (selectedId && !getDino(selectedId)) selectedId = state.dinos.find(dino => !isEggDino(dino))?.id || state.dinos[0]?.id || "";
    if (selectedIncubatorId && !getIncubator(selectedIncubatorId)) selectedIncubatorId = state.incubators[0]?.id || "";
    renderSpeciesDatalist();
    renderMetrics();
    populateSpeciesFilter();
    renderRoster();
    renderInspector();
    renderIncubators();
    populateDinoSelects();
    renderLineage();
    renderPlanner();
  }

  function renderSpeciesDatalist() {
    const names = new Set([...SPECIES, ...state.dinos.map(dino => dino.species), ...Object.values(state.settings.customSpecies).map(profile => profile.name)]);
    $("#species-list").innerHTML = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b)).map(species => `<option value="${esc(species)}"></option>`).join("");
  }

  function renderMetrics() {
    const hatched = state.dinos.filter(dino => !isEggDino(dino));
    const levels = hatched.map(currentLevel);
    $("#metric-dinos").textContent = hatched.length;
    $("#metric-lines").textContent = new Set(state.dinos.map(dino => dino.species.toLowerCase())).size;
    $("#metric-mutations").textContent = state.dinos.reduce((sum, dino) => sum + mutationTotal(dino), 0);
    $("#metric-level").textContent = levels.length ? Math.max(...levels) : "—";
  }

  function populateSpeciesFilter() {
    const filter = $("#species-filter");
    const current = filter.value;
    const species = [...new Set(state.dinos.map(dino => dino.species))].sort((a, b) => a.localeCompare(b));
    filter.innerHTML = `<option value="all">All species</option>${species.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
    filter.value = species.includes(current) ? current : "all";
  }

  function filteredDinos() {
    const query = $("#search-input").value.trim().toLowerCase();
    const species = $("#species-filter").value;
    const sex = $("#sex-filter").value;
    const status = $("#status-filter").value;
    const includeArchived = uiPreferences.showArchived || ARCHIVED_STATUSES.has(status);
    const dinos = [...state.dinos]
      .filter(dino => !isEggDino(dino))
      .filter(dino => includeArchived || !isArchivedDino(dino))
      .filter(dino => !query || [displayDinoName(dino), dino.species, dino.tag, dino.status, dino.gameId, dino.imprinter, dino.traits.join(" ")].some(value => value.toLowerCase().includes(query)))
      .filter(dino => species === "all" || dino.species === species)
      .filter(dino => sex === "all" || dino.sex === sex)
      .filter(dino => status === "all" || dino.status === status);
    return dinos.sort(compareRosterDinos);
  }

  function defaultRosterCompare(a, b) {
    return a.species.localeCompare(b.species, undefined, { sensitivity: "base", numeric: true })
      || normalizeLineName(a.tag).localeCompare(normalizeLineName(b.tag), undefined, { sensitivity: "base", numeric: true })
      || displayDinoName(a).localeCompare(displayDinoName(b), undefined, { sensitivity: "base", numeric: true });
  }

  function rankedGenesForDino(dino) {
    const best = speciesBest(dino.species);
    return STAT_DEFS
      .map(stat => ({ ...stat, value: effectiveStatPoints(dino, stat.key), best: effectiveStatPoints(dino, stat.key) === best[stat.key] && best[stat.key] > 0 }))
      .sort((a, b) => Number(b.best) - Number(a.best) || b.value - a.value);
  }

  function topGeneValues(dino) {
    return rankedGenesForDino(dino).slice(0, 3).map(stat => stat.value);
  }

  function compareTopGenes(a, b) {
    const aValues = topGeneValues(a);
    const bValues = topGeneValues(b);
    for (let index = 0; index < aValues.length; index += 1) {
      if (aValues[index] !== bValues[index]) return aValues[index] - bValues[index];
    }
    return 0;
  }

  function compareRosterDinos(a, b) {
    if (!rosterSort.key || !rosterSort.direction) return defaultRosterCompare(a, b);
    let comparison = 0;
    if (rosterSort.key === "specimen") comparison = displayDinoName(a).localeCompare(displayDinoName(b), undefined, { sensitivity: "base", numeric: true });
    else if (rosterSort.key === "line") comparison = normalizeLineName(a.tag).localeCompare(normalizeLineName(b.tag), undefined, { sensitivity: "base", numeric: true });
    else if (rosterSort.key === "sex") comparison = a.sex.localeCompare(b.sex);
    else if (rosterSort.key === "generation") comparison = generationOf(a) - generationOf(b);
    else if (rosterSort.key === "level") comparison = currentLevel(a) - currentLevel(b);
    else if (rosterSort.key === "mutations") comparison = mutationTotal(a) - mutationTotal(b);
    else if (rosterSort.key === "program") comparison = qualityAssessment(a).score - qualityAssessment(b).score;
    else if (rosterSort.key === "genes") comparison = compareTopGenes(a, b);
    const direction = rosterSort.direction === "ascending" ? 1 : -1;
    return comparison * direction || defaultRosterCompare(a, b);
  }

  function cycleRosterSort(key) {
    if (rosterSort.key !== key) rosterSort = { key, direction: "ascending" };
    else if (rosterSort.direction === "ascending") rosterSort.direction = "descending";
    else rosterSort = { key: "", direction: "" };
    renderRoster();
  }

  function updateRosterSortHeaders() {
    $$("[data-sort-column]").forEach(header => {
      const key = header.dataset.sortColumn;
      const active = rosterSort.key === key && Boolean(rosterSort.direction);
      const button = $("[data-sort-key]", header);
      const indicator = $(".sort-indicator", header);
      header.setAttribute("aria-sort", active ? rosterSort.direction : "none");
      indicator.textContent = active ? (rosterSort.direction === "ascending" ? "↑" : "↓") : "↕";
      button.setAttribute("aria-label", `${button.dataset.sortLabel}. ${active ? `Sorted ${rosterSort.direction}.` : "Default sort."} Activate to ${!active ? "sort ascending" : rosterSort.direction === "ascending" ? "sort descending" : "restore the default sort"}.`);
    });
  }

  function rosterRowMarkup(dino, context = "herd") {
    const quality = qualityAssessment(dino);
    const ranked = rankedGenesForDino(dino).slice(0, 3);
    const inHerd = context === "herd";
    const slotLabel = isEggDino(dino) ? ` · Slot ${dino.incubatorSlot}` : "";
    const displayName = displayDinoName(dino);
    const lineName = displayLineName(dino);
    return `<tr class="roster-row ${inHerd && dino.id === selectedId ? "is-selected" : ""}" ${inHerd ? `data-select-id="${esc(dino.id)}" tabindex="0"` : ""}>
      <td><div class="specimen-cell"><span class="specimen-avatar">${esc(initials(displayName))}</span><div><strong>${esc(displayName)}</strong><small title="${dino.gameId ? `Dino ID: ${esc(dino.gameId)}` : ""}">${esc(dino.species)}${slotLabel}${dino.gameId ? ` · ID ${esc(dino.gameId)}` : ""}</small></div></div></td>
      <td class="line-cell ${lineName ? "" : "is-unassigned"}"><span title="${esc(lineName || "Unassigned line")}">${esc(lineName || "Unassigned")}</span></td>
      <td><span class="sex-badge ${dino.sex.toLowerCase()}">${dino.sex === "Female" ? "♀" : "♂"} ${esc(dino.sex)}</span></td>
      <td class="generation-cell">G${generationOf(dino)}</td>
      <td class="level-cell"><strong>${currentLevel(dino)}</strong><small>base ${baseLevel(dino)}${playerLevelSum(dino) ? ` · +${playerLevelSum(dino)}` : ""}</small></td>
      <td class="mut-cell">${mutationTotal(dino)}</td>
      <td><div class="program-cell"><span class="quality-grade grade-${quality.grade.toLowerCase()}" title="Quality ${quality.score} out of 100"><b>${quality.grade}</b><small>${quality.score}</small></span><span class="recommendation rec-${quality.recommendation.code}">${esc(quality.recommendation.label)}</span></div></td>
      <td><div class="gene-stack">${ranked.map(stat => `<span class="gene-chip ${stat.best ? "best" : ""}">${stat.short} <b>${stat.value}</b></span>`).join("")}</div></td>
      <td><div class="row-menu">${isEggDino(dino) ? `<button class="row-action hatch-row-action" type="button" data-hatch-id="${esc(dino.id)}" aria-label="Hatch ${esc(displayName)}">Hatch</button>` : ""}<button class="row-action" type="button" data-edit-id="${esc(dino.id)}" aria-label="Edit ${esc(displayName)}">✎</button><button class="row-action" type="button" data-delete-id="${esc(dino.id)}" aria-label="Delete ${esc(displayName)}">×</button></div></td>
    </tr>`;
  }

  function renderRoster() {
    const dinos = filteredDinos();
    const body = $("#roster-body");
    const herdRecords = state.dinos.filter(dino => !isEggDino(dino));
    body.innerHTML = dinos.map(dino => rosterRowMarkup(dino)).join("") || (herdRecords.length ? `<tr><td colspan="9"><div class="empty-state"><h3>No matching specimens</h3><p>Try a broader search or clear one of the filters.</p></div></td></tr>` : "");

    $("#herd-view .table-wrap").hidden = herdRecords.length === 0;
    $("#herd-empty").hidden = herdRecords.length !== 0;
    if (!herdRecords.length) {
      $("#herd-empty h3").textContent = state.dinos.some(isEggDino) ? "No hatched dinos in the Herd register" : "No specimens in the archive";
      $("#herd-empty p").textContent = state.dinos.some(isEggDino) ? "Your eggs are waiting in the Incubators workspace. Hatch one to move it into the herd." : "Add your first breeder, or load a small demo family to see the lineage tools in action.";
      $("#load-demo-button").hidden = state.dinos.length > 0;
    }
    $("#roster-count").textContent = `${dinos.length} ${dinos.length === 1 ? "record" : "records"}${dinos.length !== herdRecords.length ? ` of ${herdRecords.length}` : ""}`;
    updateRosterSortHeaders();
  }

  function renderIncubators() {
    const eggCount = state.dinos.filter(isEggDino).length;
    $("#incubator-nav-count").textContent = eggCount;
    $("#incubator-total-count").textContent = `${state.incubators.length} ${state.incubators.length === 1 ? "incubator" : "incubators"}`;
    if (!selectedIncubatorId || !getIncubator(selectedIncubatorId)) selectedIncubatorId = state.incubators[0]?.id || "";
    $("#incubator-list").innerHTML = state.incubators.length
      ? state.incubators.map(incubator => {
        const eggs = incubatorEggs(incubator.id);
        return `<button class="incubator-list-item ${incubator.id === selectedIncubatorId ? "is-active" : ""}" type="button" data-select-incubator-id="${esc(incubator.id)}"><span><strong>${esc(incubator.name)}</strong><small>${eggs.length} of ${INCUBATOR_CAPACITY} occupied</small></span><b>${eggs.length}</b></button>`;
      }).join("")
      : `<div class="incubator-list-empty">No incubators yet.</div>`;

    const incubator = getIncubator(selectedIncubatorId);
    $("#incubator-empty").hidden = Boolean(incubator);
    $("#incubator-detail").hidden = !incubator;
    $("#incubator-roster-panel").hidden = !incubator;
    if (!incubator) return;

    const eggs = incubatorEggs(incubator.id);
    const bySlot = new Map(eggs.map(egg => [egg.incubatorSlot, egg]));
    $("#incubator-name").textContent = incubator.name;
    $("#incubator-occupancy").textContent = `${eggs.length} of ${INCUBATOR_CAPACITY} occupied · ${INCUBATOR_CAPACITY - eggs.length} open`;
    $("#incubator-table-title").textContent = incubator.name;
    $("#incubator-slots").innerHTML = Array.from({ length: INCUBATOR_CAPACITY }, (_, index) => {
      const slot = index + 1;
      const egg = bySlot.get(slot);
      if (!egg) {
        return `<article class="incubator-slot is-empty"><header><span>Slot ${String(slot).padStart(2, "0")}</span><small>EMPTY</small></header><button type="button" data-add-egg-incubator-id="${esc(incubator.id)}" data-add-egg-slot="${slot}"><span aria-hidden="true">＋</span>Add egg</button></article>`;
      }
      const ranked = rankedGenesForDino(egg).slice(0, 3);
      const displayName = displayDinoName(egg);
      const sexClass = egg.sex.toLowerCase();
      const sexSymbol = egg.sex === "Female" ? "♀" : "♂";
      const sexLetter = egg.sex === "Female" ? "F" : "M";
      return `<article class="incubator-slot is-occupied">
        <header><span>Slot ${String(slot).padStart(2, "0")}</span><small class="egg-sex-label ${sexClass}">${sexSymbol} EGG</small></header>
        <div class="incubator-egg-identity"><span class="specimen-avatar">${esc(initials(displayName))}</span><div><strong>${esc(displayName)}</strong><small><span class="egg-sex-marker ${sexClass}" aria-label="${esc(egg.sex)}">${sexSymbol} ${sexLetter}</span>${esc(egg.species)} · Base ${baseLevel(egg)}</small></div></div>
        <div class="gene-stack">${ranked.map(stat => `<span class="gene-chip ${stat.best ? "best" : ""}">${stat.short} <b>${stat.value}</b></span>`).join("")}</div>
        <div class="incubator-slot-actions"><button type="button" data-edit-id="${esc(egg.id)}">Edit</button><button type="button" data-hatch-id="${esc(egg.id)}">Hatch</button><button class="danger-text" type="button" data-delete-id="${esc(egg.id)}">Delete</button></div>
      </article>`;
    }).join("");
    $("#incubator-roster-body").innerHTML = eggs.length
      ? eggs.map(egg => rosterRowMarkup(egg, "incubator")).join("")
      : `<tr><td colspan="9"><div class="empty-state compact-empty"><h3>This incubator is empty</h3><p>Choose an open slot above to add an egg.</p></div></td></tr>`;
    $("#incubator-roster-count").textContent = `${eggs.length} ${eggs.length === 1 ? "egg" : "eggs"} · ${INCUBATOR_CAPACITY - eggs.length} open ${INCUBATOR_CAPACITY - eggs.length === 1 ? "slot" : "slots"}`;
  }

  function openIncubatorDialog(id = "") {
    const incubator = getIncubator(id);
    $("#incubator-form").reset();
    $("#incubator-id").value = incubator?.id || "";
    $("#incubator-dialog-kicker").textContent = incubator ? "EDIT INCUBATOR" : "NEW INCUBATOR";
    $("#incubator-dialog-title").textContent = incubator ? `Rename ${incubator.name}` : "Add incubator";
    $("#incubator-name-input").value = incubator?.name || `Incubator ${state.incubators.length + 1}`;
    $("#incubator-dialog").showModal();
    setTimeout(() => $("#incubator-name-input").select(), 0);
  }

  function saveIncubatorFromForm(event) {
    event.preventDefault();
    const id = $("#incubator-id").value;
    const name = $("#incubator-name-input").value.trim();
    if (!name) return;
    const duplicate = state.incubators.find(incubator => incubator.id !== id && incubator.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      alert(`An incubator named ${duplicate.name} already exists. Choose a unique name.`);
      $("#incubator-name-input").focus();
      return;
    }
    const existing = getIncubator(id);
    const incubator = normalizeIncubator({
      ...(existing || {}),
      id: id || uid(),
      name,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, state.incubators.length);
    const index = state.incubators.findIndex(item => item.id === incubator.id);
    if (index >= 0) state.incubators[index] = incubator;
    else state.incubators.push(incubator);
    selectedIncubatorId = incubator.id;
    $("#incubator-dialog").close();
    saveState(index >= 0 ? `${incubator.name} updated` : `${incubator.name} added`);
    switchView("incubators");
  }

  function deleteSelectedIncubator() {
    const incubator = getIncubator(selectedIncubatorId);
    if (!incubator) return;
    const eggs = incubatorEggs(incubator.id);
    if (eggs.length) {
      alert(`${incubator.name} still contains ${eggs.length} ${eggs.length === 1 ? "egg" : "eggs"}. Hatch, move, or delete them before removing the incubator.`);
      return;
    }
    if (!confirm(`Delete the empty incubator ${incubator.name}?`)) return;
    state.incubators = state.incubators.filter(item => item.id !== incubator.id);
    selectedIncubatorId = state.incubators[0]?.id || "";
    saveState(`${incubator.name} deleted`);
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function defaultDinoName(status, incubatorId = "", incubatorSlot = 0) {
    if (status !== "Egg") return "Unnamed";
    const incubatorName = getIncubator(incubatorId)?.name || "Incubator";
    const suffix = ` · S${String(toInt(incubatorSlot)).padStart(2, "0")}`;
    const prefix = "Unnamed Egg · ";
    return `${prefix}${incubatorName.slice(0, Math.max(1, 50 - prefix.length - suffix.length))}${suffix}`;
  }

  function displayDinoName(dino) {
    const recordedName = String(dino?.name ?? "").trim();
    return recordedName || defaultDinoName(dino?.status, dino?.incubatorId, dino?.incubatorSlot);
  }

  function hatchEgg(id) {
    const egg = getDino(id);
    const displayName = displayDinoName(egg);
    if (!isEggDino(egg) || !confirm(`Hatch ${displayName}? It will leave its incubator, enter the Herd register as Growing, and open for naming.`)) return;
    const index = state.dinos.findIndex(dino => dino.id === egg.id);
    state.dinos[index] = normalizeDino({
      ...egg,
      status: "Growing",
      incubatorId: "",
      incubatorSlot: 0,
      born: egg.born || localDateString(),
      updatedAt: new Date().toISOString()
    });
    selectedId = egg.id;
    saveState(`${displayName} hatched`);
    switchView("herd");
    openDinoDialog(egg.id);
  }

  function colorSwatchMarkup(id, extraClass = "") {
    const color = colorInfo(id);
    const unknown = color.id == null;
    return `<span class="color-swatch ${unknown ? "is-unknown" : ""} ${extraClass}" style="--swatch:${esc(color.hex)}" title="${esc(color.name)}${unknown ? "" : ` · ID ${color.id}`}"></span>`;
  }

  function renderDinoColorRecord(dino) {
    const regions = normalizeColorRegions(dino.colorRegions, dino.colors);
    const recorded = regions.map((id, region) => ({ id, region })).filter(item => item.id != null);
    if (!recorded.length) return dino.colors ? `<p class="notes-text"><strong>Colors:</strong> ${esc(dino.colors)}</p>` : "";
    return `<div class="color-chip-grid">${recorded.map(item => {
      const color = colorInfo(item.id);
      return `<span class="color-chip ${color.id == null ? "is-unknown" : ""}">${colorSwatchMarkup(item.id)}<strong>R${item.region} · ${item.id}</strong><small>${esc(color.name)}</small></span>`;
    }).join("")}</div>`;
  }

  function renderInspector() {
    const panel = $("#specimen-panel");
    const dino = getDino(selectedId);
    if (!dino) {
      panel.innerHTML = `<div class="inspector-empty"><span>◇</span><p>Select a specimen to inspect its genes and parent trail.</p></div>`;
      return;
    }
    const best = speciesBest(dino.species);
    const [mother, father] = getParents(dino);
    const analysis = analyzeInheritance(dino);
    const recordedStatMutations = STAT_DEFS
      .map(stat => ({ ...stat, stacks: statMutationStacks(dino, stat.key) }))
      .filter(stat => stat.stacks > 0);
    const likelyMutations = analysis.filter(item => item.kind === "mutation" && !item.mutationStacks);
    const children = state.dinos.filter(child => child.motherId === dino.id || child.fatherId === dino.id);
    const profile = getSpeciesProfile(dino.species);
    const quality = qualityAssessment(dino);
    const displayName = displayDinoName(dino);
    panel.innerHTML = `
      <div class="specimen-cover"></div>
      <div class="specimen-detail">
        <span class="large-avatar">${esc(initials(displayName))}</span>
        <div class="detail-actions">
          <button class="row-action" type="button" data-lineage-id="${esc(dino.id)}" aria-label="View lineage">⌁</button>
          <button class="row-action" type="button" data-edit-id="${esc(dino.id)}" aria-label="Edit ${esc(displayName)}">✎</button>
        </div>
        <h3 class="detail-name">${esc(displayName)}</h3>
        <p class="detail-subtitle">${esc(dino.species)} · Current level ${currentLevel(dino)} · Base ${baseLevel(dino)}</p>
        <div class="detail-badges">
          <span class="badge ${dino.sex.toLowerCase()}">${dino.sex === "Female" ? "♀" : "♂"} ${esc(dino.sex)}</span>
          <span class="badge status">${esc(dino.status)}</span>
          <span class="badge">G${generationOf(dino)}</span>
          <span class="badge">${dino.mutationsMaternal}M / ${dino.mutationsPaternal}P</span>
          ${recordedMutationStackTotal(dino) ? `<span class="badge mutation-stack-badge">${recordedMutationStackTotal(dino)} stat ${recordedMutationStackTotal(dino) === 1 ? "stack" : "stacks"}</span>` : ""}
          ${playerLevelSum(dino) ? `<span class="badge">+${playerLevelSum(dino)} player levels</span>` : ""}
          <span class="badge ${dino.imprintPercent === 100 ? "imprint-complete" : dino.imprintPercent > 0 ? "imprint-partial" : ""}">Imprint ${dino.imprintPercent}%</span>
        </div>
        <section class="quality-card">
          <div class="quality-summary">
            <span class="quality-orb grade-${quality.grade.toLowerCase()}"><strong>${quality.grade}</strong><small>${quality.score}/100</small></span>
            <div class="quality-call"><span>PROGRAM CALL</span><strong class="rec-${quality.recommendation.code}">${esc(quality.recommendation.label)}</strong><p>Relative to ${quality.targetCount} target ${quality.targetCount === 1 ? "stat" : "stats"} among active ${esc(dino.species)} in the ${esc(displayLineName(dino) || "Unassigned")} line.</p></div>
            <button class="quality-settings-link" type="button" data-quality-settings="${esc(dino.species)}">Edit goals</button>
          </div>
          <div class="quality-components"><span>Genes <b>${quality.components.genes}</b></span><span>Lineage <b>${quality.components.lineage}</b></span><span>Mutation room <b>${quality.components.mutation}</b></span></div>
          <ul>${quality.reasons.map(reason => `<li>${esc(reason)}</li>`).join("")}</ul>
        </section>
        <div class="detail-stat-grid">
          ${STAT_DEFS.map(stat => {
            const provenance = statProvenance(dino, stat.key);
            const calculated = calculateStatValue(dino, stat.key);
            const observed = dino.currentStats[stat.key];
            const effectivePoints = effectiveStatPoints(dino, stat.key);
            const mutationBonus = mutationPointBonus(dino, stat.key);
            return `<div class="detail-stat ${effectivePoints === best[stat.key] && best[stat.key] > 0 ? "best" : ""}"><span>${stat.label}</span><strong>${effectivePoints}${dino.leveledStats[stat.key] ? `<em>+${dino.leveledStats[stat.key]}</em>` : ""}</strong>${mutationBonus ? `<span class="mutation-breakdown">${dino.stats[stat.key]} inherited + ${mutationBonus} mutation</span>` : ""}<span class="current-value">${calculated != null ? `${formatStatValue(calculated, stat)} calculated` : observed !== "" ? `${esc(observed)}${stat.unit} observed` : "No calculated value"}</span>${observed !== "" && calculated != null ? `<span class="observed-value">Observed ${esc(observed)}${stat.unit}</span>` : ""}${provenance.source !== "foundation" ? `<span class="provenance-mini ${provenance.source}">${provenance.label}</span>` : ""}</div>`;
          }).join("")}
          <div class="detail-stat"><span>Level split</span><strong>${baseLevel(dino)}<em>+${playerLevelSum(dino)}</em></strong><span class="current-value">Current ${currentLevel(dino)}</span></div>
        </div>
        ${!profile ? `<p class="inheritance-note">No automatic stat profile matches “${esc(dino.species)}”. Choose a supported species name or keep using observed values.</p>` : profile.unsupported ? `<p class="inheritance-note">This species uses a special stat model, so observed values are shown without an automatic estimate.</p>` : ""}
        ${recordedStatMutations.length ? `<p class="inheritance-note mutation">Recorded stat mutations: ${recordedStatMutations.map(stat => `${stat.short} ×${stat.stacks} (+${stat.stacks * 2})`).join(", ")}. The bonuses are included in the resulting stat values and level.</p>` : ""}
        ${likelyMutations.length ? `<p class="inheritance-note mutation">Likely stat mutation: ${likelyMutations.map(item => `${item.short} ${item.child}`).join(", ")}. Confirm against the incubator before relying on this flag.</p>` : analysis.length ? `<p class="inheritance-note">${analysis.filter(item => item.kind === "high").length} of 7 stats match the higher tracked parent value.</p>` : ""}
        ${dino.gameId || dino.imprinter ? `<div class="detail-section"><h4>Specimen record</h4>${dino.gameId ? `<p class="notes-text record-id"><strong>Dino ID:</strong> ${esc(dino.gameId)}</p>` : ""}${dino.imprinter ? `<p class="notes-text"><strong>Imprinted by:</strong> ${esc(dino.imprinter)}</p>` : ""}</div>` : ""}
        ${dino.traits.length ? `<div class="detail-section"><h4>Traits · ${dino.traits.length}</h4><div class="trait-list">${dino.traits.map(trait => `<span class="trait-chip">${esc(trait)}</span>`).join("")}</div></div>` : ""}
        <div class="detail-section"><h4>Parents</h4><div class="parent-links">${parentLink(mother, "Mother")} ${parentLink(father, "Father")}</div></div>
        ${children.length ? `<div class="detail-section"><h4>Offspring · ${children.length}</h4><div class="children-list">${children.slice(0, 6).map(child => `<button class="child-chip" type="button" data-select-id="${esc(child.id)}">${esc(displayDinoName(child))} · Base ${baseLevel(child)}</button>`).join("")}</div></div>` : ""}
        ${dino.colors || dino.colorRegions?.some(id => id != null) || dino.notes ? `<div class="detail-section"><h4>Field notes</h4>${renderDinoColorRecord(dino)}${dino.notes ? `<p class="notes-text">${esc(dino.notes)}</p>` : ""}</div>` : ""}
      </div>`;
  }

  function parentLink(parent, role) {
    return parent
      ? `<button class="parent-link" type="button" data-select-id="${esc(parent.id)}"><small>${role}</small>${esc(displayDinoName(parent))} · Base ${baseLevel(parent)}</button>`
      : `<button class="parent-link" type="button" disabled><small>${role}</small>Unknown</button>`;
  }

  function populateDinoSelects() {
    const sorted = [...state.dinos].sort((a, b) => a.species.localeCompare(b.species) || displayDinoName(a).localeCompare(displayDinoName(b)));
    const lineage = $("#lineage-select");
    const lineageValue = selectedId || lineage.value;
    lineage.innerHTML = sorted.length ? sorted.map(dino => `<option value="${esc(dino.id)}">${esc(displayDinoName(dino))} · ${esc(dino.species)}</option>`).join("") : `<option value="">No dinos tracked</option>`;
    lineage.value = getDino(lineageValue) ? lineageValue : sorted[0]?.id || "";

    const breeders = sorted.filter(dino => dino.status === "Breeder");
    populatePlannerSelect($("#planner-mother"), breeders.filter(dino => dino.sex === "Female"), "Choose a female breeder");
    populatePlannerSelect($("#planner-father"), breeders.filter(dino => dino.sex === "Male"), "Choose a male breeder");
  }

  function populatePlannerSelect(select, dinos, placeholder) {
    const current = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>${dinos.map(dino => `<option value="${esc(dino.id)}">${esc(displayDinoName(dino))} · ${esc(dino.species)}</option>`).join("")}`;
    if (dinos.some(dino => dino.id === current)) select.value = current;
  }

  function renderLineage() {
    const canvas = $("#lineage-canvas");
    const dino = getDino($("#lineage-select").value || selectedId);
    if (!dino) {
      canvas.innerHTML = `<div class="lineage-empty">Add a dino to begin a pedigree.</div>`;
      return;
    }
    const traceKey = $("#trace-stat-select").value || "health";
    const traceStat = STAT_DEFS.find(stat => stat.key === traceKey) || STAT_DEFS[0];
    const focusProvenance = statProvenance(dino, traceKey);
    const depthSetting = $("#lineage-depth-select").value || "all";
    const ancestry = buildAncestorMap(dino, traceKey, depthSetting);
    const children = state.dinos.filter(child => child.motherId === dino.id || child.fatherId === dino.id);
    const widestGeneration = Math.max(1, ...ancestry.generations.map(entries => entries.length), ancestry.collapsedSlotCount);
    const pedigreeWidth = widestGeneration * 220 + Math.max(0, widestGeneration - 1) * 12;
    canvas.innerHTML = `<div class="pedigree">
      <div class="trace-banner"><div><span>TRACING</span><strong>${traceStat.label}</strong></div><p>${focusProvenance.source === "foundation" ? "No tracked parents for this stat." : `${esc(displayDinoName(dino))} has ${focusProvenance.child} points · ${focusProvenance.label}.`}</p></div>
      <div class="pedigree-summary"><p><strong>${ancestry.uniqueAncestorCount}</strong> unique tracked ${ancestry.uniqueAncestorCount === 1 ? "ancestor" : "ancestors"} across <strong>${ancestry.generations.length}</strong> ${ancestry.generations.length === 1 ? "generation" : "generations"}.</p><span><b>M</b> mother <b>F</b> father · highlighted cards contributed the traced stat</span></div>
      ${ancestry.truncated ? `<p class="lineage-warning">${depthSetting === "all" ? "The ancestry map reached its safety limit; narrow the focus to continue farther up that branch." : "Older tracked ancestry exists. Choose a deeper view to reveal it."}</p>` : ""}
      ${ancestry.cycles ? `<p class="lineage-warning danger">${ancestry.cycles} circular parent ${ancestry.cycles === 1 ? "reference was" : "references were"} skipped.</p>` : ""}
      <div class="pedigree-map" tabindex="0" aria-label="Top-down ancestry map">
        <div class="pedigree-columns" style="--pedigree-width:${pedigreeWidth}px">
          <div class="lineage-connectors" aria-hidden="true"></div>
          ${ancestry.generations.map((entries, depth) => {
            const label = depth === 0 ? "Focus" : depth === 1 ? "Parents" : depth === 2 ? "Grandparents" : depth === 3 ? "Great-grandparents" : `Generation ${depth} ancestors`;
            return `<section class="pedigree-generation" style="--node-count:${entries.length}"><header><span>${label}</span><small>${entries.length} tracked</small></header><div class="pedigree-generation-nodes">${entries.map(entry => pedigreeNode(entry.dino, depth === 0, traceKey, entry.contributes && depth > 0 ? "contributor" : "", entry.path)).join("")}</div></section>`;
          }).join("")}
          ${ancestry.collapsedBranches.length ? `<section class="pedigree-generation collapsed-generation" style="--node-count:${ancestry.collapsedSlotCount}"><header><span>Older ancestry</span><small>Choose a deeper view to expand</small></header><div class="pedigree-generation-nodes">${ancestry.collapsedBranches.map(branch => collapsedPedigreeBranch(branch)).join("")}</div></section>` : ""}
        </div>
      </div>
      ${renderStatComparison(dino)}
      <div class="children-strip"><h3>Direct offspring · ${children.length}</h3><div class="children-list">${children.length ? children.map(child => `<button type="button" class="child-chip" data-lineage-id="${esc(child.id)}">${esc(displayDinoName(child))} · G${generationOf(child)} · Base ${baseLevel(child)}</button>`).join("") : `<span class="notes-text">No tracked offspring yet.</span>`}</div></div>
    </div>`;
    requestAnimationFrame(drawLineageConnectors);
  }

  function buildAncestorMap(focus, traceKey, depthSetting) {
    const requestedDepth = depthSetting === "all" ? 50 : Math.max(1, toInt(depthSetting));
    const nodeLimit = 750;
    const generations = [[{ dino: focus, path: "", contributes: true, trail: new Set([focus.id]) }]];
    let appearances = 0;
    let truncated = false;
    let cycles = 0;

    for (let depth = 1; depth < requestedDepth; depth += 1) {
      const previous = generations[generations.length - 1];
      const next = [];
      let limitReached = false;
      for (const entry of previous) {
        const provenance = statProvenance(entry.dino, traceKey);
        const contributingSource = provenance.parentSource || provenance.source;
        const parentEntries = [
          { dino: getDino(entry.dino.motherId), letter: "M", sources: ["mother", "both"] },
          { dino: getDino(entry.dino.fatherId), letter: "F", sources: ["father", "both"] }
        ];
        for (const parent of parentEntries) {
          if (!parent.dino) continue;
          if (entry.trail.has(parent.dino.id)) {
            cycles += 1;
            continue;
          }
          if (appearances >= nodeLimit) {
            limitReached = true;
            break;
          }
          next.push({
            dino: parent.dino,
            path: `${entry.path}${parent.letter}`,
            contributes: entry.contributes && parent.sources.includes(contributingSource),
            trail: new Set(entry.trail).add(parent.dino.id)
          });
          appearances += 1;
        }
        if (limitReached) break;
      }
      if (next.length) generations.push(next);
      if (limitReached) {
        truncated = true;
        break;
      }
      if (!next.length) break;
    }

    if (generations.length === requestedDepth) {
      truncated = truncated || generations[generations.length - 1].some(entry => getParents(entry.dino).some(parent => parent && !entry.trail.has(parent.id)));
    }
    const collapsedBranches = [];
    if (truncated) {
      generations.at(-1)?.forEach((entry, slotIndex) => {
        const olderParents = getParents(entry.dino).filter(parent => parent && !entry.trail.has(parent.id));
        if (!olderParents.length) return;
        collapsedBranches.push({
          path: `${entry.path}X`,
          parentPath: entry.path,
          parentName: displayDinoName(entry.dino),
          olderCount: olderParents.length,
          slot: slotIndex + 1
        });
      });
    }
    const collapsedSlotCount = generations.at(-1)?.length || 1;
    const uniqueAncestorIds = new Set(generations.slice(1).flatMap(entries => entries.map(entry => entry.dino.id)));
    return { generations, collapsedBranches, collapsedSlotCount, uniqueAncestorCount: uniqueAncestorIds.size, truncated, cycles };
  }

  function ancestryPathLabel(path) {
    if (!path) return "Focus specimen";
    return path.split("").map(letter => letter === "M" ? "mother" : "father").join(" → ");
  }

  function pedigreeNode(dino, focus = false, traceKey = "health", extraClass = "", path = "") {
    if (!dino) return `<div class="pedigree-node unknown">UNTRACKED</div>`;
    const stat = STAT_DEFS.find(item => item.key === traceKey) || STAT_DEFS[0];
    const provenance = statProvenance(dino, traceKey);
    const displayName = displayDinoName(dino);
    return `<button type="button" class="pedigree-node ${focus ? "focus" : ""} ${extraClass}" data-lineage-id="${esc(dino.id)}" data-ancestry-path="${path}" title="${esc(ancestryPathLabel(path))}"><span class="ancestry-path">${path || "FOCUS"}</span><span class="node-avatar">${esc(initials(displayName))}</span><span class="node-copy"><strong>${esc(displayName)}</strong><small>${dino.sex === "Female" ? "♀" : "♂"} ${esc(dino.species)} · Base ${baseLevel(dino)}</small>${provenance.source !== "foundation" ? `<em>${provenance.label}</em>` : ""}</span><span class="node-stat"><small>${stat.short}</small>${effectiveStatPoints(dino, traceKey)}</span></button>`;
  }

  function collapsedPedigreeBranch(branch) {
    return `<div class="pedigree-node collapsed-branch" data-ancestry-path="${esc(branch.path)}" style="grid-column:${branch.slot}"><span class="ancestry-path">${esc(branch.parentPath)}+</span><span class="collapsed-marker" aria-hidden="true">＋</span><span class="node-copy"><strong>Older ancestry</strong><small>Beyond ${esc(branch.parentName)} · ${branch.olderCount} tracked ${branch.olderCount === 1 ? "parent" : "parents"} next</small></span></div>`;
  }

  function drawLineageConnectors() {
    const columns = $("#lineage-canvas .pedigree-columns");
    const layer = columns?.querySelector(".lineage-connectors");
    if (!columns || !layer || columns.offsetWidth === 0) return;
    const columnRect = columns.getBoundingClientRect();
    const nodes = [...columns.querySelectorAll("[data-ancestry-path]")];
    const byPath = new Map(nodes.map(node => [node.dataset.ancestryPath, node]));
    layer.replaceChildren();

    const addSegment = (orientation, left, top, length, contributing) => {
      if (length <= 0) return;
      const segment = document.createElement("span");
      segment.className = `lineage-connector ${orientation}${contributing ? " contributor" : ""}`;
      segment.style.left = `${Math.round(left)}px`;
      segment.style.top = `${Math.round(top)}px`;
      segment.style[orientation === "horizontal" ? "width" : "height"] = `${Math.max(1, Math.round(length))}px`;
      layer.append(segment);
    };

    nodes.forEach(ancestorNode => {
      const path = ancestorNode.dataset.ancestryPath;
      if (!path) return;
      const childNode = byPath.get(path.slice(0, -1));
      if (!childNode) return;
      const ancestorRect = ancestorNode.getBoundingClientRect();
      const childRect = childNode.getBoundingClientRect();
      const startX = childRect.left - columnRect.left + childRect.width / 2;
      const startY = childRect.bottom - columnRect.top;
      const endX = ancestorRect.left - columnRect.left + ancestorRect.width / 2;
      const endY = ancestorRect.top - columnRect.top;
      const elbowY = startY + (endY - startY) / 2;
      const contributing = ancestorNode.classList.contains("contributor");
      addSegment("vertical", startX, startY, elbowY - startY, contributing);
      addSegment("horizontal", Math.min(startX, endX), elbowY, Math.abs(endX - startX), contributing);
      addSegment("vertical", endX, elbowY, endY - elbowY, contributing);
    });
  }

  function renderStatComparison(dino) {
    const [mother, father] = getParents(dino);
    return `<section class="lineage-comparison"><div class="comparison-heading"><div><p class="eyebrow">INHERITANCE AUDIT</p><h3>All stat origins</h3></div><p>Signed differences compare the focus specimen with each tracked parent.</p></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>Stat</th><th>Focus</th><th>Mother</th><th>Δ Mother</th><th>Father</th><th>Δ Father</th><th>Source</th></tr></thead><tbody>${STAT_DEFS.map(stat => {
      const value = statProvenance(dino, stat.key);
      return `<tr class="${stat.key === $("#trace-stat-select").value ? "is-traced" : ""}"><th>${stat.label}</th><td><strong>${value.child}</strong></td><td>${mother ? value.motherValue : "—"}</td><td class="delta ${value.deltaMother > 0 ? "positive" : value.deltaMother < 0 ? "negative" : ""}">${signed(value.deltaMother)}</td><td>${father ? value.fatherValue : "—"}</td><td class="delta ${value.deltaFather > 0 ? "positive" : value.deltaFather < 0 ? "negative" : ""}">${signed(value.deltaFather)}</td><td><span class="source-badge ${value.source}">${value.label}</span></td></tr>`;
    }).join("")}</tbody></table></div></section>`;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pairColorInheritance(mother, father) {
    const maternal = normalizeColorRegions(mother?.colorRegions, mother?.colors);
    const paternal = normalizeColorRegions(father?.colorRegions, father?.colors);
    return Array.from({ length: COLOR_REGION_COUNT }, (_, region) => {
      const motherId = maternal[region];
      const fatherId = paternal[region];
      const bothRecorded = motherId != null && fatherId != null;
      const differs = bothRecorded && motherId !== fatherId;
      let sampleId = motherId ?? fatherId;
      let source = motherId != null ? "mother" : fatherId != null ? "father" : "unknown";
      if (bothRecorded && motherId === fatherId) source = "both";
      else if (differs) {
        source = stableHash(`${mother.id}|${father.id}|color|${region}`) % 2 ? "father" : "mother";
        sampleId = source === "mother" ? motherId : fatherId;
      }
      return { region, motherId, fatherId, sampleId, source, bothRecorded, differs };
    });
  }

  function colorParentOption(id, sex) {
    const color = colorInfo(id);
    return `<span class="color-parent-option">${colorSwatchMarkup(id)}<b>${sex} ${color.id == null ? "—" : color.id}</b></span>`;
  }

  function renderPlannerColors(colorRows) {
    const recorded = colorRows.filter(row => row.motherId != null || row.fatherId != null);
    if (!recorded.length) {
      return `<section class="offspring-colors"><div class="offspring-colors-heading"><h4>Color inheritance sample</h4></div><p class="report-note">No mapped parent color regions are recorded yet.</p></section>`;
    }
    const differing = recorded.filter(row => row.differs).length;
    const exactSampleChance = Math.pow(.5, differing);
    return `<section class="offspring-colors">
      <div class="offspring-colors-heading"><h4>Color inheritance sample</h4><small>${differing ? `${differing} differing region${differing === 1 ? "" : "s"} · ${formatPercent(exactSampleChance)} exact sample` : "Recorded regions match"}</small></div>
      <div class="color-inheritance-grid">${recorded.map(row => {
        const sample = colorInfo(row.sampleId);
        const sampleNote = row.source === "both" ? "both parents" : row.bothRecorded ? `sampled ${row.source}` : `${row.source} only recorded`;
        return `<div class="color-inheritance-card"><span>Region ${row.region}</span><div class="color-parent-options">${colorParentOption(row.motherId, "♀")}<i>×</i>${colorParentOption(row.fatherId, "♂")}</div><div class="color-sample-result">${colorSwatchMarkup(row.sampleId)}<b>${sample.id == null ? "Unknown" : `${sample.id} · ${esc(sample.name)}`}</b><small>${sampleNote}</small></div></div>`;
      }).join("")}</div>
    </section>`;
  }

  function renderPlanner() {
    const mother = getDino($("#planner-mother").value);
    const father = getDino($("#planner-father").value);
    $("#mother-summary").textContent = mother ? `Base ${baseLevel(mother)} · current ${currentLevel(mother)} · ${mutationTotal(mother)} mutation counter` : "Select from tracked females";
    $("#father-summary").textContent = father ? `Base ${baseLevel(father)} · current ${currentLevel(father)} · ${mutationTotal(father)} mutation counter` : "Select from tracked males";
    const compatibility = $("#compatibility");
    const report = $("#offspring-report");
    if (!mother || !father) {
      compatibility.className = "compatibility";
      compatibility.textContent = "Choose both parents to calculate the pairing.";
      report.innerHTML = `<div class="report-empty"><div><strong>Offspring projection waiting</strong>Select one female and one male from your archive.</div></div>`;
      return;
    }
    const compatible = mother.species.toLowerCase() === father.species.toLowerCase();
    compatibility.className = `compatibility ${compatible ? "good" : "bad"}`;
    compatibility.textContent = compatible ? `Compatible ${mother.species} pairing. Values below assume normal stat inheritance.` : `Species mismatch: ${mother.species} and ${father.species} cannot normally breed.`;

    const rows = STAT_DEFS.map(stat => {
      const m = effectiveStatPoints(mother, stat.key);
      const f = effectiveStatPoints(father, stat.key);
      const traitEffects = pairTraitEffects(mother, father, stat.key);
      return { ...stat, mother: m, father: f, high: Math.max(m, f), differs: m !== f, traitEffects };
    });
    const differing = rows.filter(row => row.differs).length;
    const allBestChance = rows.filter(row => row.differs).reduce((chance, row) => chance * row.traitEffects.inheritanceChance, 1);
    const motherEligible = mutationTotal(mother) < 20;
    const fatherEligible = mutationTotal(father) < 20;
    const eligibleSides = Number(motherEligible) + Number(fatherEligible);
    const baseMutationChance = 1 - Math.pow(1 - (.025 * eligibleSides / 2), 3);
    const mutableBonus = rows.reduce((sum, row) => sum + row.traitEffects.mutable, 0);
    const mutationChance = Math.min(1, baseMutationChance + mutableBonus / 100);
    const projectedLevel = 1 + rows.reduce((sum, row) => sum + row.high, 0);
    const colorRows = pairColorInheritance(mother, father);
    report.innerHTML = `
      <div class="report-header"><div><p class="eyebrow">BEST UNMUTATED ROLL</p><h3>${esc(displayDinoName(mother))} × ${esc(displayDinoName(father))}</h3><p>${esc(mother.species)} gene comparison</p></div><div class="projected-level"><small>PROJECTED BASE LEVEL</small><strong>${projectedLevel}</strong></div></div>
      <div class="probability-grid">
        <div class="probability-card"><span>All higher stats</span><strong>${formatPercent(allBestChance)}</strong><small>${differing} different stat ${differing === 1 ? "value" : "values"}</small></div>
        <div class="probability-card"><span>Mutation estimate</span><strong>${formatPercent(mutationChance)}</strong><small>${formatPercent(baseMutationChance)} base${mutableBonus ? ` + ${mutableBonus}%pt mutable traits` : ""}</small></div>
        <div class="probability-card"><span>Child counters</span><strong>${mutationTotal(mother)} / ${mutationTotal(father)}</strong><small>maternal / paternal before new mutation</small></div>
      </div>
      <div class="offspring-stats">
        ${rows.map(row => `<div class="offspring-stat-row"><span class="stat-name">${row.label}${row.traitEffects.robust || row.traitEffects.frail || row.traitEffects.mutable ? `<small>${row.traitEffects.robust ? `+${row.traitEffects.robust}% robust ` : ""}${row.traitEffects.frail ? `-${row.traitEffects.frail}% frail ` : ""}${row.traitEffects.mutable ? `+${row.traitEffects.mutable}% mutable` : ""}</small>` : ""}</span><span class="parent-value ${row.mother >= row.father ? "high" : ""}">♀ ${row.mother}</span><span class="inherit-arrow">→</span><span class="parent-value ${row.father >= row.mother ? "high" : ""}">♂ ${row.father}</span><span class="best-value">${formatPercent(row.traitEffects.inheritanceChance)} high <span>${row.high}</span></span></div>`).join("")}
      </div>
      ${renderPlannerColors(colorRows)}
      <p class="report-note">Higher-stat inheritance starts at 55%. Recognized Robust and Frail trait tiers adjust that chance by ±1.5, ±2.25, or ±3 percentage points; Mutable tiers add 1, 1.5, or 2 points to the mutation estimate. The color sample is stable for this pairing so comparisons do not jump around; ARK still rolls each differing color region independently before any color mutation.</p>`;
  }

  function encodeBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decodeBase64Url(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - base64.length % 4) % 4)}`;
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function transferParentReference(id) {
    const parent = getDino(id);
    if (!parent) return null;
    return {
      gameId: parent.gameId || "",
      name: parent.name || "",
      species: parent.species,
      sex: parent.sex
    };
  }

  function transferCreatureFromForm() {
    const status = $("#dino-status").value;
    const incubator = status === "Egg" ? getIncubator($("#dino-incubator").value) : null;
    return {
      name: $("#dino-name").value.trim(),
      species: $("#dino-species").value.trim(),
      sex: $("#dino-sex").value,
      status,
      line: $("#dino-tag").value.trim(),
      gameId: $("#dino-game-id").value.trim(),
      origin: $("#dino-origin").value,
      tamingEffectiveness: Number($("#dino-taming-effectiveness").value) || 0,
      born: $("#dino-born").value,
      placement: incubator ? { incubator: incubator.name, slot: toInt($("#dino-incubator-slot").value) } : null,
      parents: {
        mother: transferParentReference($("#dino-mother").value),
        father: transferParentReference($("#dino-father").value)
      },
      mutations: {
        maternal: toInt($("#mutations-maternal").value),
        paternal: toInt($("#mutations-paternal").value)
      },
      stats: STAT_DEFS.map(stat => toInt($(`[data-stat="${stat.key}"]`).value)),
      mutationStacks: STAT_DEFS.map(stat => toInt($(`[data-mutation-stack="${stat.key}"]`).value)),
      leveledStats: STAT_DEFS.map(stat => toInt($(`[data-leveled-stat="${stat.key}"]`).value)),
      observedStats: STAT_DEFS.map(stat => $(`[data-current-stat="${stat.key}"]`).value.trim()),
      imprintPercent: toPercent($("#dino-imprint").value),
      imprinter: $("#dino-imprinter").value.trim(),
      traits: $("#dino-traits").value.split(",").map(item => item.trim()).filter(Boolean),
      colorRegions: readColorRegionsFromForm(),
      notes: $("#dino-notes").value.trim()
    };
  }

  function encodeTransferCode(creature = transferCreatureFromForm()) {
    const payload = { format: TRANSFER_CODE_FORMAT, version: TRANSFER_CODE_VERSION, creature };
    return `${TRANSFER_CODE_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
  }

  function decodeTransferCode(rawCode) {
    const raw = String(rawCode || "").trim();
    if (!raw) throw new Error("Paste an ARK Bloodlines transfer code.");
    if (raw.length > TRANSFER_CODE_MAX_LENGTH) throw new Error("This transfer code is too large.");
    let payload;
    if (raw.startsWith(SCANNER_TRANSFER_CODE_PREFIX)) {
      const json = raw.slice(SCANNER_TRANSFER_CODE_PREFIX.length).trim();
      if (!json) throw new Error("The scanner transfer code is incomplete.");
      try {
        payload = JSON.parse(json);
      } catch {
        throw new Error("The scanner transfer code contains invalid JSON.");
      }
    } else {
      const compact = raw.replace(/\s+/g, "");
      if (!compact.startsWith(TRANSFER_CODE_PREFIX)) {
        throw new Error(`Transfer codes must begin with ${TRANSFER_CODE_PREFIX} or ${SCANNER_TRANSFER_CODE_PREFIX}`);
      }
      const encoded = compact.slice(TRANSFER_CODE_PREFIX.length);
      if (!encoded || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) throw new Error("The transfer code is incomplete or contains invalid characters.");
      try {
        payload = JSON.parse(decodeBase64Url(encoded));
      } catch {
        throw new Error("The transfer code is incomplete or invalid.");
      }
    }
    const format = payload?.format;
    const version = Number(payload?.version);
    if (![TRANSFER_CODE_FORMAT, SCANNER_TRANSFER_CODE_FORMAT].includes(format)) throw new Error("This is not an ARK Bloodlines transfer code.");
    if (version !== TRANSFER_CODE_VERSION) throw new Error(`Transfer-code version ${version || "unknown"} is not supported.`);
    const creature = payload?.creature;
    if (!creature || typeof creature !== "object" || Array.isArray(creature)) throw new Error("No creature record was found in this transfer code.");
    return { creature, format };
  }

  function setTransferCodeStatus(message, kind = "") {
    const status = $("#transfer-code-status");
    const input = $("#dino-transfer-code");
    status.textContent = message;
    status.classList.remove("is-valid", "is-imported", "is-invalid");
    if (kind) status.classList.add(kind);
    input.setAttribute("aria-invalid", kind === "is-invalid" ? "true" : "false");
  }

  function syncTransferCodeFromForm(message = "") {
    if (transferCodeSyncing || !$("#dino-transfer-code")) return;
    transferCodeSyncing = true;
    try {
      const code = encodeTransferCode();
      $("#dino-transfer-code").value = code;
      $("#copy-transfer-code").disabled = false;
      setTransferCodeStatus(message || `Ready to copy · ${code.length.toLocaleString()} characters`, message ? "is-imported" : "is-valid");
    } finally {
      transferCodeSyncing = false;
    }
  }

  function transferSeries(value) {
    if (Array.isArray(value)) {
      return Object.fromEntries(STAT_DEFS.map((stat, index) => [stat.key, value[index]]).filter(([, item]) => item !== undefined));
    }
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(STAT_DEFS.filter(stat => Object.prototype.hasOwnProperty.call(value, stat.key)).map(stat => [stat.key, value[stat.key]]));
  }

  function transferredSpeciesName(value) {
    const species = String(value ?? "").trim();
    const descriptiveName = species.match(/\s*-\s*Lvl\s+\d+\s*\(([^()]*)\)\s*$/i);
    const cleaned = descriptiveName?.[1]?.trim() || species;
    return TRANSFER_SPECIES_ALIASES[normalizeSpeciesName(cleaned)] || cleaned;
  }

  function transferredDinoIdPart(value) {
    const part = String(value ?? "").trim();
    if (!/^-?\d+$/.test(part)) return part;
    try {
      return BigInt.asUintN(32, BigInt(part)).toString();
    } catch {
      return part;
    }
  }

  function transferredGameId(value, details = {}) {
    const direct = String(value ?? "").trim();
    if (direct) return direct;
    const first = details.dinoId1 ?? details.DinoID1;
    const second = details.dinoId2 ?? details.DinoID2;
    if (first == null && second == null) return "";
    const parts = [transferredDinoIdPart(first), transferredDinoIdPart(second)];
    if (parts.every(part => !part || part === "0")) return "";
    return parts.every(part => !part || /^\d+$/.test(part))
      ? parts.join("")
      : parts.filter(Boolean).join("-");
  }

  function transferredParentName(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s*-\s*Lvl\s+\d+(?:\s*\([^()]*\))?\s*$/i, "")
      .trim();
  }

  function comparableGameId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "");
  }

  function transferredParentIdentity(details) {
    const direct = String(details.gameId ?? details.dinoId ?? details.id ?? "").trim();
    if (direct) return { exact: comparableGameId(direct), parts: [] };
    const first = transferredDinoIdPart(details.dinoId1 ?? details.DinoID1);
    const second = transferredDinoIdPart(details.dinoId2 ?? details.DinoID2);
    const parts = [...new Set(
      [first, second]
        .filter(part => part && part !== "0")
        .map(comparableGameId)
        .filter(Boolean)
    )];
    return {
      exact: parts.length === 2 ? comparableGameId(transferredGameId("", details)) : "",
      parts
    };
  }

  function resolveTransferParent(reference, sex, species) {
    if (!reference) return "";
    const details = typeof reference === "string" ? { gameId: reference, name: reference } : reference;
    const identity = transferredParentIdentity(details);
    if (identity.exact) {
      const byGameId = state.dinos.find(dino =>
        dino.id !== $("#dino-id").value
        && dino.sex === sex
        && comparableGameId(dino.gameId) === identity.exact
      );
      if (byGameId) return byGameId.id;
    }
    const name = transferredParentName(details.name).toLowerCase();
    if (!name) return "";
    const referenceSpecies = transferredSpeciesName(details.species || species || "");
    const matches = state.dinos.filter(dino =>
      dino.id !== $("#dino-id").value
      && dino.sex === sex
      && (!referenceSpecies || normalizeSpeciesName(dino.species) === normalizeSpeciesName(referenceSpecies))
      && [dino.name, displayDinoName(dino)].some(value => transferredParentName(value).toLowerCase() === name)
    );
    const corroboratedMatches = identity.parts.length
      ? matches.filter(dino => {
          const gameId = comparableGameId(dino.gameId);
          return identity.parts.every(part => gameId.startsWith(part) || gameId.endsWith(part));
        })
      : matches;
    return corroboratedMatches.length === 1 ? corroboratedMatches[0].id : "";
  }

  function transferParentHasData(reference) {
    if (typeof reference === "string") return Boolean(reference.trim());
    if (!reference || typeof reference !== "object") return false;
    return ["gameId", "dinoId", "dinoId1", "dinoId2", "name"].some(key => {
      const value = reference[key];
      return value != null && String(value).trim() && String(value).trim() !== "0";
    });
  }

  function applyTransferCode(rawCode) {
    const { creature, format } = decodeTransferCode(rawCode);
    const isScannerTransfer = format === SCANNER_TRANSFER_CODE_FORMAT;
    const has = (object, key) => object && Object.prototype.hasOwnProperty.call(object, key);
    const setValue = (selector, value) => {
      const field = $(selector);
      if (field && value !== undefined) field.value = value == null ? "" : String(value);
    };
    transferCodeSyncing = true;
    try {
      if (has(creature, "name")) setValue("#dino-name", creature.name);
      if (has(creature, "species")) setValue("#dino-species", transferredSpeciesName(creature.species));
      if (has(creature, "sex") && ["Female", "Male"].includes(creature.sex)) setValue("#dino-sex", creature.sex);
      if (has(creature, "status") && DINO_STATUSES.includes(creature.status)) setValue("#dino-status", creature.status);
      if (has(creature, "line") || has(creature, "tag")) setValue("#dino-tag", creature.line ?? creature.tag);
      if (has(creature, "gameId") || has(creature, "dinoId") || has(creature, "dinoId1") || has(creature, "dinoId2")) {
        setValue("#dino-game-id", transferredGameId(creature.gameId ?? creature.dinoId, creature));
      }
      if (has(creature, "origin") && ["bred", "tamed"].includes(creature.origin)) setValue("#dino-origin", creature.origin);
      if (has(creature, "tamingEffectiveness")) {
        setValue("#dino-taming-effectiveness", Math.min(100, Math.max(0, Number(creature.tamingEffectiveness) || 0)));
      } else if (has(creature, "tamedIneffectivenessModifier")) {
        setValue("#dino-taming-effectiveness", Math.min(100, Math.max(0, (1 - (Number(creature.tamedIneffectivenessModifier) || 0)) * 100)));
      }
      if (has(creature, "born")) setValue("#dino-born", creature.born);
      if (has(creature, "notes")) setValue("#dino-notes", creature.notes);
      if (has(creature, "imprintPercent")) {
        setValue("#dino-imprint", toPercent(creature.imprintPercent));
      } else if (has(creature, "imprintQuality")) {
        setValue("#dino-imprint", toPercent((Number(creature.imprintQuality) || 0) * 100));
      }
      if (has(creature, "imprinter")) setValue("#dino-imprinter", creature.imprinter);
      if (has(creature, "traits")) {
        const traits = Array.isArray(creature.traits) ? creature.traits : String(creature.traits || "").split(/[,;\r\n|]+/);
        setValue("#dino-traits", traits.map(String).map(item => item.trim()).filter(Boolean).join(", "));
      }

      const mutations = creature.mutations && typeof creature.mutations === "object" ? creature.mutations : creature;
      if (has(mutations, "maternal") || has(creature, "mutationsMaternal")) setValue("#mutations-maternal", toInt(mutations.maternal ?? creature.mutationsMaternal));
      if (has(mutations, "paternal") || has(creature, "mutationsPaternal")) setValue("#mutations-paternal", toInt(mutations.paternal ?? creature.mutationsPaternal));

      const stackSeries = transferSeries(creature.mutationStacks);
      Object.entries(stackSeries).forEach(([statKey, value]) => {
        const suppliedValue = toInt(value);
        // ASA supplies the raw +2 mutation bonus; app transfer codes store mutation-stack counts.
        const stackCount = isScannerTransfer ? Math.floor(suppliedValue / 2) : suppliedValue;
        $(`[data-mutation-stack="${statKey}"]`).value = stackCount;
        dinoFormPrefill.manualStats.add(statKey);
      });
      const baseSeries = transferSeries(creature.stats);
      Object.entries(baseSeries).forEach(([statKey, value]) => {
        const pointValue = value && typeof value === "object" ? value.base ?? value.points : value;
        $(`[data-stat="${statKey}"]`).value = toInt(pointValue);
        dinoFormPrefill.manualStats.add(statKey);
      });
      if (!Object.keys(baseSeries).length) {
        const effectiveSeries = transferSeries(creature.effectiveStats ?? creature.wildPoints);
        Object.entries(effectiveSeries).forEach(([statKey, value]) => {
          const stackCount = toInt($(`[data-mutation-stack="${statKey}"]`).value);
          $(`[data-stat="${statKey}"]`).value = Math.max(0, toInt(value) - stackCount * 2);
          dinoFormPrefill.manualStats.add(statKey);
        });
      }
      const leveledSeries = transferSeries(creature.leveledStats ?? creature.leveledPoints);
      Object.entries(leveledSeries).forEach(([statKey, value]) => { $(`[data-leveled-stat="${statKey}"]`).value = toInt(value); });
      const observedSeries = transferSeries(creature.observedStats ?? creature.currentStats);
      Object.entries(observedSeries).forEach(([statKey, value]) => { $(`[data-current-stat="${statKey}"]`).value = value == null ? "" : String(value); });

      const colors = creature.colorRegions ?? creature.colors;
      if (colors !== undefined) {
        let colorSeries;
        if (Array.isArray(colors)) {
          colorSeries = Object.fromEntries(Array.from({ length: COLOR_REGION_COUNT }, (_, region) => [region, colors[region]]).filter(([, value]) => value !== undefined));
        } else if (colors && typeof colors === "object") {
          colorSeries = colors;
        } else {
          const legacy = parseLegacyColorRegions(colors);
          const sequential = legacy.some(value => value != null)
            ? legacy
            : (String(colors || "").match(/\d{1,3}/g) || []).slice(0, COLOR_REGION_COUNT).map(normalizeColorId);
          colorSeries = Object.fromEntries(sequential.map((value, region) => [region, value]).filter(([, value]) => value != null));
        }
        Object.entries(colorSeries || {}).forEach(([regionValue, value]) => {
          const region = Number(regionValue);
          if (Number.isInteger(region) && region >= 0 && region < COLOR_REGION_COUNT) {
            setColorRegionInput(region, value);
            dinoFormPrefill.manualColors.add(region);
          }
        });
      }

      const parents = creature.parents && typeof creature.parents === "object" ? creature.parents : null;
      const motherSpecified = has(parents, "mother") || has(creature, "motherGameId") || has(creature, "motherDinoId1") || has(creature, "motherName");
      const fatherSpecified = has(parents, "father") || has(creature, "fatherGameId") || has(creature, "fatherDinoId1") || has(creature, "fatherName");
      const motherReference = parents?.mother ?? {
        gameId: creature.motherGameId,
        dinoId1: creature.motherDinoId1,
        dinoId2: creature.motherDinoId2,
        name: creature.motherName
      };
      const fatherReference = parents?.father ?? {
        gameId: creature.fatherGameId,
        dinoId1: creature.fatherDinoId1,
        dinoId2: creature.fatherDinoId2,
        name: creature.fatherName
      };
      if (motherSpecified) $("#dino-mother-breeders-only").checked = !transferParentHasData(motherReference);
      if (fatherSpecified) $("#dino-father-breeders-only").checked = !transferParentHasData(fatherReference);
      populateParentSelects($("#dino-id").value, $("#dino-species").value.trim());
      if (motherSpecified) {
        $("#dino-mother").value = resolveTransferParent(motherReference, "Female", $("#dino-species").value);
      }
      if (fatherSpecified) {
        $("#dino-father").value = resolveTransferParent(fatherReference, "Male", $("#dino-species").value);
      }

      const placement = creature.placement && typeof creature.placement === "object" ? creature.placement : {};
      const requestedIncubator = String(placement.incubator || placement.incubatorName || "").trim().toLowerCase();
      const matchingIncubator = requestedIncubator ? state.incubators.find(incubator => incubator.name.toLowerCase() === requestedIncubator) : null;
      syncEggPlacementFields(matchingIncubator?.id || "", placement.slot);
      syncOriginFields();
      updateColorInputSwatches();
      updateFormPreview();
    } finally {
      transferCodeSyncing = false;
    }
    const label = [$("#dino-name").value.trim(), $("#dino-species").value.trim()].filter(Boolean).join(" · ") || "creature";
    syncTransferCodeFromForm(`Imported ${label} into the form · review before saving`);
  }

  function handleTransferCodeInput() {
    if (transferCodeSyncing) return;
    clearTimeout(transferCodeInputTimer);
    const rawCode = $("#dino-transfer-code").value;
    const trimmedCode = rawCode.trim();
    $("#copy-transfer-code").disabled = true;
    if (!trimmedCode) {
      setTransferCodeStatus("Paste an ABL1 or ABLS1 transfer code to fill the form.");
      return;
    }
    if (![TRANSFER_CODE_PREFIX, SCANNER_TRANSFER_CODE_PREFIX].some(prefix => trimmedCode.startsWith(prefix))) {
      setTransferCodeStatus(`Transfer codes must begin with ${TRANSFER_CODE_PREFIX} or ${SCANNER_TRANSFER_CODE_PREFIX}`, "is-invalid");
      return;
    }
    setTransferCodeStatus("Checking transfer code…");
    transferCodeInputTimer = setTimeout(() => {
      try {
        applyTransferCode(rawCode);
      } catch (error) {
        setTransferCodeStatus(error.message, "is-invalid");
      }
    }, 120);
  }

  async function copyTransferCode() {
    const input = $("#dino-transfer-code");
    try {
      decodeTransferCode(input.value);
    } catch (error) {
      setTransferCodeStatus(error.message, "is-invalid");
      return;
    }
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(input.value);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      input.focus();
      input.select();
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setTransferCodeStatus(`Copied transfer code · ${input.value.length.toLocaleString()} characters`, "is-valid");
      showToast("Transfer code copied");
    } else {
      input.focus();
      input.select();
      setTransferCodeStatus("Transfer code selected · press Ctrl+C to copy", "is-imported");
    }
  }

  function buildStatsInputs() {
    $("#stats-entry").innerHTML = STAT_DEFS.map(stat => `<div class="stat-entry-card"><strong>${stat.label}<span>${stat.short}</span></strong><label>Inherited roll<input type="number" name="stat-${stat.key}" data-stat="${stat.key}" min="0" max="255" step="1" value="0" inputmode="numeric"></label><label>Mutation stacks<input type="number" name="mutation-${stat.key}" data-mutation-stack="${stat.key}" min="0" max="127" step="1" value="0" inputmode="numeric" aria-describedby="mutation-stack-help"></label><output class="effective-stat-output" data-effective-stat="${stat.key}">Result 0</output></div>`).join("");
    $("#progression-entry").innerHTML = STAT_DEFS.map(stat => `<div class="progression-stat-card"><strong>${stat.label}</strong><label>Added levels<input type="number" name="leveled-${stat.key}" data-leveled-stat="${stat.key}" min="0" max="255" step="1" value="0" inputmode="numeric"></label><label>Observed value<div class="value-input ${stat.unit ? "has-unit" : ""}"><input type="number" name="current-${stat.key}" data-current-stat="${stat.key}" min="0" step="any" inputmode="decimal" placeholder="—">${stat.unit ? `<span>${stat.unit}</span>` : ""}</div></label><output class="calculated-output" data-calculated-stat="${stat.key}">Calculated —</output></div>`).join("");
  }

  function buildColorInputs() {
    const options = `<option value="">Unknown</option>${COLOR_DATA.map(color => `<option value="${color.id}">${color.id} · ${esc(color.name)} · ${color.hex}</option>`).join("")}`;
    $("#color-regions-entry").innerHTML = Array.from({ length: COLOR_REGION_COUNT }, (_, region) => `<div class="color-region-card is-unknown" data-color-region-card="${region}">${colorSwatchMarkup(null)}<label>Region ${region}<select data-color-region="${region}" aria-label="Color region ${region}">${options}</select></label></div>`).join("");
    updateColorInputSwatches();
  }

  function setColorRegionInput(region, value) {
    const select = $(`[data-color-region="${region}"]`);
    const id = normalizeColorId(value);
    if (id != null && !$(`option[value="${id}"]`, select)) {
      select.insertAdjacentHTML("beforeend", `<option value="${id}">${id} · Unmapped color ID</option>`);
    }
    select.value = id == null ? "" : String(id);
  }

  function readColorRegionsFromForm() {
    return Array.from({ length: COLOR_REGION_COUNT }, (_, region) => normalizeColorId($(`[data-color-region="${region}"]`).value));
  }

  function updateColorInputSwatches() {
    $$("[data-color-region]").forEach(select => {
      const region = Number(select.dataset.colorRegion);
      const color = colorInfo(select.value);
      const card = $(`[data-color-region-card="${region}"]`);
      const swatch = $(".color-swatch", card);
      card.classList.toggle("is-unknown", color.id == null);
      swatch.classList.toggle("is-unknown", color.id == null);
      swatch.style.setProperty("--swatch", color.hex);
      swatch.title = `${color.name}${color.id == null ? "" : ` · ID ${color.id}`}`;
    });
  }

  function inheritedParentGuess(mother, father, statKey) {
    if (!mother && !father) return null;
    if (!mother || !father) return mother || father;
    const maternal = effectiveStatPoints(mother, statKey);
    const paternal = effectiveStatPoints(father, statKey);
    if (maternal !== paternal) return maternal > paternal ? mother : father;
    return stableHash(`${mother.id}|${father.id}|stat|${statKey}`) % 2 ? father : mother;
  }

  function randomParentSource() {
    if (globalThis.crypto?.getRandomValues) {
      const randomByte = new Uint8Array(1);
      globalThis.crypto.getRandomValues(randomByte);
      return randomByte[0] % 2 ? "father" : "mother";
    }
    return Math.random() < .5 ? "mother" : "father";
  }

  function prefillInheritedStatsFromParents(force = false) {
    const mother = getDino($("#dino-mother").value);
    const father = getDino($("#dino-father").value);
    const summary = $("#parent-prefill-summary");
    const button = $("#prefill-parent-stats");
    button.disabled = !mother && !father;
    if (!mother && !father) {
      summary.classList.remove("is-active");
      summary.textContent = "Choose tracked parents to prefill the most likely inherited values.";
      updateFormPreview();
      return;
    }
    if (dinoFormPrefill.editing && !force) {
      summary.classList.remove("is-active");
      summary.textContent = "Existing stat values are preserved. Use “Prefill from parents” to replace them deliberately.";
      updateFormPreview();
      return;
    }
    if (force) dinoFormPrefill.manualStats.clear();
    let filled = 0;
    STAT_DEFS.forEach(stat => {
      if (!force && dinoFormPrefill.manualStats.has(stat.key)) return;
      const parent = inheritedParentGuess(mother, father, stat.key);
      if (!parent) return;
      const base = toInt(parent.stats?.[stat.key]);
      const stacks = statMutationStacks(parent, stat.key);
      $(`[data-stat="${stat.key}"]`).value = base;
      $(`[data-mutation-stack="${stat.key}"]`).value = stacks;
      dinoFormPrefill.suggestions[stat.key] = { base, stacks, parentId: parent.id };
      filled += 1;
    });
    summary.classList.toggle("is-active", filled > 0);
    summary.textContent = filled
      ? `Prefilled ${filled} ${filled === 1 ? "stat" : "stats"} from the selected parents, using the higher value where they differ. Verify the actual baby in the incubator.`
      : "Your manually entered stat values were preserved. Use “Prefill from parents” to replace them.";
    updateFormPreview();
  }

  function prefillColorRegionsFromParents(force = false) {
    const mother = getDino($("#dino-mother").value);
    const father = getDino($("#dino-father").value);
    const summary = $("#color-prefill-summary");
    const button = $("#prefill-parent-colors");
    button.disabled = !mother && !father;
    if (!mother && !father) {
      summary.classList.remove("is-active");
      summary.textContent = "Choose tracked parents to prefill an inherited color sample.";
      return;
    }
    if (dinoFormPrefill.editing && !force) {
      summary.classList.remove("is-active");
      summary.textContent = "Existing colors are preserved. Use “Prefill from parents” to replace them deliberately.";
      return;
    }
    if (force) {
      dinoFormPrefill.manualColors.clear();
      dinoFormPrefill.colorSuggestions.clear();
    }
    const inheritance = pairColorInheritance(mother, father);
    let filled = 0;
    let coinFlips = 0;
    inheritance.forEach(row => {
      if (!force && dinoFormPrefill.manualColors.has(row.region)) return;
      let sampleId = row.sampleId;
      if (row.differs) {
        const suggestionKey = `${mother.id}|${father.id}|${row.region}`;
        let source = dinoFormPrefill.colorSuggestions.get(suggestionKey);
        if (!source) {
          source = randomParentSource();
          dinoFormPrefill.colorSuggestions.set(suggestionKey, source);
        }
        sampleId = source === "mother" ? row.motherId : row.fatherId;
        coinFlips += 1;
      }
      setColorRegionInput(row.region, sampleId);
      if (sampleId != null) filled += 1;
    });
    updateColorInputSwatches();
    summary.classList.toggle("is-active", filled > 0);
    summary.textContent = filled
      ? `Prefilled ${filled} recorded color ${filled === 1 ? "region" : "regions"}${coinFlips ? ` with ${coinFlips} independent 50/50 ${coinFlips === 1 ? "coin flip" : "coin flips"}` : ""}. Verify the actual baby in game.`
      : "Neither selected parent has mapped color regions to prefill.";
    syncTransferCodeFromForm();
  }

  function handleDinoParentChange(event) {
    const selectedParent = getDino(event?.target?.value);
    if (selectedParent) {
      const speciesInput = $("#dino-species");
      if (normalizeSpeciesName(speciesInput.value) !== normalizeSpeciesName(selectedParent.species)) {
        speciesInput.value = selectedParent.species;
        populateParentSelects($("#dino-id").value, selectedParent.species);
      }
    }
    prefillInheritedStatsFromParents(false);
    prefillColorRegionsFromParents(false);
  }

  function handleStatsEntryInput(event) {
    const statKey = event.target.dataset.stat || event.target.dataset.mutationStack;
    if (statKey) dinoFormPrefill.manualStats.add(statKey);
    updateFormPreview();
  }

  function handleColorRegionChange(event) {
    const region = Number(event.target.dataset.colorRegion);
    if (Number.isInteger(region)) dinoFormPrefill.manualColors.add(region);
    updateColorInputSwatches();
  }

  function handleDinoFormTransferChange(event) {
    if (event.target.id === "dino-transfer-code") return;
    syncTransferCodeFromForm();
  }

  function populateParentSelects(editingId = "", species = "") {
    const currentMother = $("#dino-mother").value;
    const currentFather = $("#dino-father").value;
    const candidates = state.dinos.filter(dino => !isEggDino(dino) && dino.id !== editingId && (!species || dino.species.toLowerCase() === species.toLowerCase()));
    const fill = (select, sex, current, breedersOnly) => {
      const matches = candidates
        .filter(dino => dino.sex === sex && (!breedersOnly || dino.status === "Breeder"))
        .sort((a, b) => displayDinoName(a).localeCompare(displayDinoName(b)));
      select.innerHTML = `<option value="">Unknown / untracked</option>${matches.map(dino => `<option value="${esc(dino.id)}">${esc(displayDinoName(dino))} · Base ${baseLevel(dino)}</option>`).join("")}`;
      if (matches.some(dino => dino.id === current)) select.value = current;
    };
    fill($("#dino-mother"), "Female", currentMother, $("#dino-mother-breeders-only").checked);
    fill($("#dino-father"), "Male", currentFather, $("#dino-father-breeders-only").checked);
  }

  function handleParentFilterChange() {
    populateParentSelects($("#dino-id").value, $("#dino-species").value.trim());
    handleDinoParentChange();
  }

  function syncEggPlacementFields(preferredIncubatorId = "", preferredSlot = 0) {
    const eggMode = $("#dino-status").value === "Egg";
    const placement = $("#egg-placement-fields");
    placement.hidden = !eggMode;
    if (!eggMode) return;
    $("#dino-origin").value = "bred";
    syncOriginFields();
    const editingId = $("#dino-id").value;
    const incubatorSelect = $("#dino-incubator");
    const currentIncubatorId = preferredIncubatorId || incubatorSelect.value;
    incubatorSelect.innerHTML = state.incubators.length
      ? state.incubators.map(incubator => `<option value="${esc(incubator.id)}">${esc(incubator.name)} · ${incubatorEggs(incubator.id).length}/${INCUBATOR_CAPACITY}</option>`).join("")
      : `<option value="">No incubators configured</option>`;
    incubatorSelect.disabled = state.incubators.length === 0;
    incubatorSelect.value = getIncubator(currentIncubatorId) ? currentIncubatorId : state.incubators[0]?.id || "";

    const slotSelect = $("#dino-incubator-slot");
    const selectedIncubator = getIncubator(incubatorSelect.value);
    const occupiedSlots = new Set(state.dinos
      .filter(dino => dino.id !== editingId && isEggDino(dino) && dino.incubatorId === selectedIncubator?.id)
      .map(dino => dino.incubatorSlot));
    slotSelect.innerHTML = selectedIncubator
      ? Array.from({ length: INCUBATOR_CAPACITY }, (_, index) => {
        const slot = index + 1;
        return `<option value="${slot}" ${occupiedSlots.has(slot) ? "disabled" : ""}>Slot ${String(slot).padStart(2, "0")}${occupiedSlots.has(slot) ? " · occupied" : ""}</option>`;
      }).join("")
      : `<option value="">No slots available</option>`;
    const requestedSlot = toInt(preferredSlot) || toInt(slotSelect.value);
    const firstOpenSlot = Array.from({ length: INCUBATOR_CAPACITY }, (_, index) => index + 1).find(slot => !occupiedSlots.has(slot)) || 0;
    const selectedSlot = requestedSlot && !occupiedSlots.has(requestedSlot) ? requestedSlot : firstOpenSlot;
    slotSelect.value = selectedSlot ? String(selectedSlot) : "";
    slotSelect.disabled = !selectedIncubator || !selectedSlot;
    $("#egg-placement-help").textContent = !state.incubators.length
      ? "Add an incubator from the Incubators workspace before saving this egg."
      : selectedSlot
        ? "Egg records stay in the Incubators workspace until hatched."
        : `${selectedIncubator.name} is full. Choose another incubator or free a slot.`;
  }

  function openDinoDialog(id = "", placement = null) {
    const dino = getDino(id);
    const incubator = getIncubator(placement?.incubatorId);
    dinoFormPrefill = { editing: Boolean(dino), manualStats: new Set(), manualColors: new Set(), colorSuggestions: new Map(), suggestions: {} };
    $("#dino-form").reset();
    $("#dino-id").value = dino?.id || "";
    $("#dino-name").placeholder = placement ? `Optional · ${defaultDinoName("Egg", placement.incubatorId, placement.incubatorSlot)}` : "Optional · defaults to Unnamed";
    $("#dialog-kicker").textContent = dino ? (isEggDino(dino) ? "EDIT EGG" : "EDIT SPECIMEN") : placement ? "NEW EGG" : "NEW SPECIMEN";
    $("#dialog-title").textContent = dino ? `Edit ${displayDinoName(dino)}` : placement ? `Add egg to ${incubator?.name || "incubator"} · Slot ${placement.incubatorSlot}` : "Add dino";
    $("#save-dino-button").textContent = dino ? "Save changes" : placement ? "Save egg" : "Save specimen";
    if (!dino && placement) {
      $("#dino-status").value = "Egg";
    }
    $("#dino-mother-breeders-only").checked = !dino?.motherId;
    $("#dino-father-breeders-only").checked = !dino?.fatherId;
    if (dino) {
      $("#dino-name").value = dino.name;
      $("#dino-species").value = dino.species;
      $("#dino-sex").value = dino.sex;
      $("#dino-status").value = dino.status;
      $("#dino-tag").value = dino.tag;
      $("#dino-game-id").value = dino.gameId;
      $("#dino-origin").value = dino.origin;
      $("#dino-taming-effectiveness").value = dino.tamingEffectiveness;
      $("#dino-born").value = dino.born;
      $("#mutations-maternal").value = dino.mutationsMaternal;
      $("#mutations-paternal").value = dino.mutationsPaternal;
      $("#dino-notes").value = dino.notes;
      $("#dino-traits").value = dino.traits.join(", ");
      $("#dino-imprint").value = dino.imprintPercent;
      $("#dino-imprinter").value = dino.imprinter;
      STAT_DEFS.forEach(stat => {
        $(`[data-stat="${stat.key}"]`).value = dino.stats[stat.key];
        $(`[data-mutation-stack="${stat.key}"]`).value = dino.mutationStacks[stat.key];
        $(`[data-leveled-stat="${stat.key}"]`).value = dino.leveledStats[stat.key];
        $(`[data-current-stat="${stat.key}"]`).value = dino.currentStats[stat.key];
      });
    }
    populateParentSelects(dino?.id || "", dino?.species || "");
    $("#dino-mother").value = dino?.motherId || "";
    $("#dino-father").value = dino?.fatherId || "";
    Array.from({ length: COLOR_REGION_COUNT }, (_, region) => setColorRegionInput(region, dino?.colorRegions?.[region]));
    updateColorInputSwatches();
    syncEggPlacementFields(dino?.incubatorId || placement?.incubatorId || "", dino?.incubatorSlot || placement?.incubatorSlot || 0);
    syncOriginFields();
    prefillInheritedStatsFromParents(false);
    prefillColorRegionsFromParents(false);
    syncTransferCodeFromForm();
    $("#dino-dialog").showModal();
    setTimeout(() => $("#dino-name").focus(), 0);
  }

  function closeDinoDialog() {
    $("#dino-dialog").close();
  }

  function syncOriginFields() {
    const bred = $("#dino-origin").value === "bred";
    $("#dino-taming-effectiveness").disabled = bred;
    if (bred) $("#dino-taming-effectiveness").value = 100;
  }

  function updateFormPreview() {
    const stats = Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-stat="${stat.key}"]`).value)]));
    const mutationStacks = Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-mutation-stack="${stat.key}"]`).value)]));
    const leveledStats = Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-leveled-stat="${stat.key}"]`).value)]));
    const draft = { species: $("#dino-species").value.trim(), stats, mutationStacks, leveledStats, origin: $("#dino-origin").value, tamingEffectiveness: Number($("#dino-taming-effectiveness").value) || 0, imprintPercent: toPercent($("#dino-imprint").value), motherId: $("#dino-mother").value, fatherId: $("#dino-father").value };
    $("#level-preview").textContent = baseLevel(draft);
    $("#progression-base-preview").textContent = baseLevel(draft);
    $("#player-levels-preview").textContent = playerLevelSum(draft);
    $("#current-level-preview").textContent = currentLevel(draft);
    $("#generation-preview").textContent = `G${generationOf(draft)}`;
    const profile = getSpeciesProfile(draft.species);
    $("#calculator-profile").textContent = profile ? `${profile.custom ? "Custom" : "Built-in"} · ${profile.name}` : "Not found";
    $("#calculator-profile-note").textContent = profile?.unsupported ? "Special model; observed values only" : profile ? "Live values available" : "Define a custom profile";
    $("#define-profile-button").textContent = profile?.custom ? "Edit profile" : profile ? "Override profile" : "Define profile";
    STAT_DEFS.forEach(stat => {
      const value = calculateStatValue(draft, stat.key);
      $(`[data-calculated-stat="${stat.key}"]`).textContent = `Calculated ${formatStatValue(value, stat)}`;
      $(`[data-effective-stat="${stat.key}"]`).textContent = `Result ${effectiveStatPoints(draft, stat.key)}`;
    });
    const analysis = analyzeInheritance(draft);
    const recordedMutations = STAT_DEFS.map(stat => ({ ...stat, stacks: mutationStacks[stat.key] })).filter(stat => stat.stacks > 0);
    const mutations = analysis.filter(item => item.kind === "mutation" && !item.mutationStacks);
    const mismatches = analysis.filter(item => item.kind === "unverified");
    const preview = $("#mutation-preview");
    if (recordedMutations.length) preview.textContent = `Applied stacks: ${recordedMutations.map(stat => `${stat.short} ×${stat.stacks} (+${stat.stacks * 2})`).join(", ")}. The result and level include these bonuses.`;
    else if (!analysis.length) preview.textContent = "Choose tracked parents to analyze inheritance.";
    else if (mutations.length) preview.textContent = `Likely +2 mutation: ${mutations.map(item => `${item.short} ${item.child}`).join(", ")}.`;
    else if (mismatches.length) preview.textContent = `${mismatches.length} stat ${mismatches.length === 1 ? "value does" : "values do"} not match the tracked parents.`;
    else preview.textContent = "All entered stats match a tracked parent value.";
    syncTransferCodeFromForm();
  }

  function saveDinoFromForm(event) {
    event.preventDefault();
    const id = $("#dino-id").value;
    const existing = getDino(id);
    const colorRegions = readColorRegionsFromForm();
    const status = $("#dino-status").value;
    const incubatorId = status === "Egg" ? $("#dino-incubator").value : "";
    const incubatorSlot = status === "Egg" ? toInt($("#dino-incubator-slot").value) : 0;
    const name = $("#dino-name").value.trim();
    if (status === "Egg") {
      const incubator = getIncubator(incubatorId);
      if (!incubator) {
        alert("Choose an incubator before saving this egg.");
        return;
      }
      if (incubatorSlot < 1 || incubatorSlot > INCUBATOR_CAPACITY) {
        alert(`Choose an open slot in ${incubator.name}.`);
        return;
      }
      const occupant = state.dinos.find(dino => dino.id !== id && isEggDino(dino) && dino.incubatorId === incubatorId && dino.incubatorSlot === incubatorSlot);
      if (occupant) {
        alert(`Slot ${incubatorSlot} in ${incubator.name} is already occupied by ${displayDinoName(occupant)}.`);
        syncEggPlacementFields(incubatorId);
        return;
      }
    }
    const dino = normalizeDino({
      ...(existing || {}),
      id: id || uid(),
      name,
      species: $("#dino-species").value.trim(),
      sex: $("#dino-sex").value,
      status,
      incubatorId,
      incubatorSlot,
      tag: $("#dino-tag").value.trim(),
      gameId: $("#dino-game-id").value.trim(),
      origin: $("#dino-origin").value,
      tamingEffectiveness: $("#dino-taming-effectiveness").value,
      born: $("#dino-born").value,
      motherId: $("#dino-mother").value,
      fatherId: $("#dino-father").value,
      mutationsMaternal: $("#mutations-maternal").value,
      mutationsPaternal: $("#mutations-paternal").value,
      stats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-stat="${stat.key}"]`).value)])),
      mutationStacks: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-mutation-stack="${stat.key}"]`).value)])),
      leveledStats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, toInt($(`[data-leveled-stat="${stat.key}"]`).value)])),
      currentStats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, $(`[data-current-stat="${stat.key}"]`).value.trim()])),
      traits: $("#dino-traits").value.split(",").map(item => item.trim()).filter(Boolean),
      imprintPercent: $("#dino-imprint").value,
      imprinter: $("#dino-imprinter").value.trim(),
      colorRegions,
      colors: formatColorRegions(colorRegions),
      notes: $("#dino-notes").value.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString()
    });
    if (!dino.species) return;
    const duplicateId = dino.gameId && state.dinos.find(item => item.id !== dino.id && item.gameId.toLowerCase() === dino.gameId.toLowerCase());
    if (duplicateId) {
      alert(`That Dino ID is already assigned to ${displayDinoName(duplicateId)}.`);
      $("#dino-game-id").focus();
      return;
    }
    const index = state.dinos.findIndex(item => item.id === dino.id);
    if (index >= 0) state.dinos[index] = dino;
    else state.dinos.push(dino);
    if (isEggDino(dino)) selectedIncubatorId = dino.incubatorId;
    else selectedId = dino.id;
    closeDinoDialog();
    const incubator = getIncubator(dino.incubatorId);
    const displayName = displayDinoName(dino);
    saveState(index >= 0 ? `${displayName} updated` : isEggDino(dino) ? `${displayName} added to ${incubator?.name || "incubator"} · Slot ${dino.incubatorSlot}` : `${displayName} added to the archive`);
    if (isEggDino(dino)) switchView("incubators");
    else if (isEggDino(existing)) switchView("herd");
  }

  function deleteDino(id) {
    const dino = getDino(id);
    const displayName = displayDinoName(dino);
    const prompt = isEggDino(dino)
      ? `Delete the egg ${displayName}? This removes its incubator record and cannot be undone.`
      : `Delete ${displayName}? Offspring records will keep their stats, but this parent link will become unknown.`;
    if (!dino || !confirm(prompt)) return;
    state.dinos = state.dinos.filter(item => item.id !== id).map(item => ({
      ...item,
      motherId: item.motherId === id ? "" : item.motherId,
      fatherId: item.fatherId === id ? "" : item.fatherId
    }));
    if (selectedId === id) selectedId = state.dinos.find(item => item.id !== id && !isEggDino(item))?.id || "";
    saveState(`${displayName} deleted`);
  }

  function switchView(view) {
    activeView = view;
    if (view === "herd" && isEggDino(getDino(selectedId))) {
      selectedId = state.dinos.find(dino => !isEggDino(dino))?.id || "";
      renderRoster();
      renderInspector();
    }
    $$(".nav-tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.view === view));
    $$('[data-view-panel]').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    if (view === "lineage") {
      $("#lineage-select").value = getDino(selectedId) ? selectedId : $("#lineage-select").value;
      renderLineage();
    }
    if (view === "incubators") renderIncubators();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildSettingsInputs() {
    $("#multiplier-settings-body").innerHTML = STAT_DEFS.map(stat => `<tr><th>${stat.label}</th>${["wild", "domestic", "tameAdd", "tameAffinity"].map(type => `<td><input type="number" min="0" step="0.01" inputmode="decimal" data-setting-stat="${stat.key}" data-setting-type="${type}" aria-label="${stat.label} ${type}"></td>`).join("")}</tr>`).join("");
    $("#profile-stats-body").innerHTML = STAT_DEFS.map(stat => `<tr><th>${stat.label}</th>${["base", "wild", "domestic", "tameAdd", "affinity", "imprint"].map(type => `<td><input type="number" ${["tameAdd", "affinity"].includes(type) ? "" : 'min="0"'} step="any" inputmode="decimal" data-profile-stat="${stat.key}" data-profile-field="${type}" aria-label="${stat.label} ${type}" placeholder="—"></td>`).join("")}</tr>`).join("");
    $("#trace-stat-select").innerHTML = STAT_DEFS.map(stat => `<option value="${stat.key}">${stat.label}</option>`).join("");
    $("#quality-goal-grid").innerHTML = STAT_DEFS.map(stat => `<label class="quality-goal-card"><span>${stat.label}</span><select data-quality-goal="${stat.key}" aria-label="${stat.label} breeding goal"><option value="high">Prefer high</option><option value="low">Prefer low</option><option value="ignore">Ignore</option></select></label>`).join("");
  }

  function populateQualitySpeciesSelect(preferredSpecies = "") {
    const select = $("#quality-species-select");
    const names = [...new Set([...SPECIES, ...state.dinos.map(dino => dino.species), ...Object.values(state.settings.customSpecies).map(profile => profile.name)])].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const preferred = typeof preferredSpecies === "string" && preferredSpecies ? preferredSpecies : getDino(selectedId)?.species || names[0] || "";
    select.innerHTML = names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
    const exact = names.find(name => normalizeSpeciesName(name) === normalizeSpeciesName(preferred));
    select.value = exact || names[0] || "";
    loadQualityGoalEditor();
  }

  function loadQualityGoalEditor() {
    const species = $("#quality-species-select").value;
    const goal = getBreedingGoal(species);
    $$('[data-quality-goal]').forEach(select => select.value = goal[select.dataset.qualityGoal]);
    const customized = Boolean(state.settings.breedingGoals[normalizeSpeciesName(species)]);
    $("#reset-quality-goal").textContent = customized ? "Use default goals" : "Default goals active";
    $("#reset-quality-goal").disabled = !customized;
  }

  function saveQualityGoal() {
    const species = $("#quality-species-select").value;
    if (!species) return;
    const goal = Object.fromEntries($$('[data-quality-goal]').map(select => [select.dataset.qualityGoal, select.value]));
    state.settings.breedingGoals[normalizeSpeciesName(species)] = normalizeBreedingGoal(goal);
    saveState(`${species} breeding goals saved`);
    loadQualityGoalEditor();
  }

  function resetQualityGoal() {
    const species = $("#quality-species-select").value;
    if (!species) return;
    delete state.settings.breedingGoals[normalizeSpeciesName(species)];
    saveState(`${species} now uses default breeding goals`);
    loadQualityGoalEditor();
  }

  function openSettingsDialog(preferredSpecies = "") {
    $("#setting-imprint-scale").value = state.settings.imprintScale;
    $("#setting-single-player").checked = state.settings.singlePlayerSettings;
    $$('[data-setting-stat]').forEach(input => input.value = state.settings.multipliers[input.dataset.settingStat][input.dataset.settingType]);
    updateSinglePlayerPresetSummary();
    populateQualitySpeciesSelect(preferredSpecies);
    $(".file-menu").removeAttribute("open");
    $("#settings-dialog").showModal();
  }

  function saveSettings(event) {
    event.preventDefault();
    const next = {
      imprintScale: Number($("#setting-imprint-scale").value),
      singlePlayerSettings: $("#setting-single-player").checked,
      multipliers: {},
      customSpecies: state.settings.customSpecies,
      breedingGoals: state.settings.breedingGoals
    };
    STAT_DEFS.forEach(stat => {
      next.multipliers[stat.key] = {};
      ["wild", "domestic", "tameAdd", "tameAffinity"].forEach(type => {
        next.multipliers[stat.key][type] = Number($(`[data-setting-stat="${stat.key}"][data-setting-type="${type}"]`).value);
      });
    });
    state.settings = normalizeSettings(next);
    $("#settings-dialog").close();
    saveState("Calculator and quality settings saved");
  }

  function updateSinglePlayerPresetSummary() {
    const enabled = $("#setting-single-player").checked;
    const read = (statKey, type) => Number($(`[data-setting-stat="${statKey}"][data-setting-type="${type}"]`).value);
    const effective = statKey => effectiveStatMultipliers(statKey, {
      wild: read(statKey, "wild"),
      domestic: read(statKey, "domestic"),
      tameAdd: read(statKey, "tameAdd"),
      tameAffinity: read(statKey, "tameAffinity")
    }, enabled);
    const compact = value => Number(value.toFixed(6)).toString();
    const summary = $("#single-player-preset-summary");
    summary.classList.toggle("is-active", enabled);
    if (!enabled) {
      summary.textContent = "Unchecked uses the base multiplier values shown in the table.";
      return;
    }
    const health = effective("health");
    const melee = effective("melee");
    summary.textContent = `Effective behind the scenes · Health ${compact(health.domestic)} / ${compact(health.tameAdd)} / ${compact(health.tameAffinity)} · Melee ${compact(melee.domestic)} / ${compact(melee.tameAdd)} / ${compact(melee.tameAffinity)}`;
  }

  function restoreOfficialSettings() {
    state.settings = normalizeSettings({ customSpecies: state.settings.customSpecies, breedingGoals: state.settings.breedingGoals });
    $("#setting-imprint-scale").value = state.settings.imprintScale;
    $("#setting-single-player").checked = false;
    $$('[data-setting-stat]').forEach(input => input.value = state.settings.multipliers[input.dataset.settingStat][input.dataset.settingType]);
    updateSinglePlayerPresetSummary();
    showToast("Official-style defaults restored");
  }

  function blankProfile() {
    return { name: "", tbhm: 1, stats: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, null])), imprint: Object.fromEntries(STAT_DEFS.map(stat => [stat.key, ["health", "food", "weight", "melee"].includes(stat.key) ? .2 : 0])) };
  }

  function openProfileDialog(speciesName = "") {
    const normalized = normalizeSpeciesName(speciesName);
    const key = SPECIES_ALIASES[normalized] || normalized;
    const custom = state.settings.customSpecies[normalized] || state.settings.customSpecies[key];
    const profile = custom || getSpeciesProfile(speciesName) || blankProfile();
    $("#profile-form").dataset.key = custom ? key : "";
    $("#profile-name").value = speciesName || profile.name || "";
    $("#profile-tbhm").value = profile.tbhm ?? 1;
    STAT_DEFS.forEach(stat => {
      const values = profile.stats?.[stat.key];
      const fields = { base: values?.[0], wild: values ? values[1] * 100 : "", domestic: values ? values[2] * 100 : "", tameAdd: values?.[3], affinity: values ? values[4] * 100 : "", imprint: (profile.imprint?.[stat.key] ?? 0) * 100 };
      Object.entries(fields).forEach(([field, value]) => $(`[data-profile-stat="${stat.key}"][data-profile-field="${field}"]`).value = value ?? "");
    });
    $("#delete-profile").hidden = !custom;
    renderCustomProfileList();
    $(".file-menu").removeAttribute("open");
    if (!$("#profile-dialog").open) $("#profile-dialog").showModal();
    setTimeout(() => $("#profile-name").focus(), 0);
  }

  function renderCustomProfileList() {
    const profiles = Object.values(state.settings.customSpecies).sort((a, b) => a.name.localeCompare(b.name));
    $("#custom-profile-list").innerHTML = profiles.length ? profiles.map(profile => `<button type="button" data-edit-profile="${esc(profile.name)}"><span>${esc(profile.name)}</span><small>Edit local override</small></button>`).join("") : `<p>No custom profiles saved yet.</p>`;
  }

  function saveCustomProfile(event) {
    event.preventDefault();
    const name = $("#profile-name").value.trim();
    if (!name) return;
    const stats = {};
    const imprint = {};
    STAT_DEFS.forEach(stat => {
      const read = field => $(`[data-profile-stat="${stat.key}"][data-profile-field="${field}"]`).value;
      const base = read("base");
      stats[stat.key] = base === "" ? null : [Number(base), Number(read("wild")) / 100 || 0, Number(read("domestic")) / 100 || 0, Number(read("tameAdd")) || 0, Number(read("affinity")) / 100 || 0];
      imprint[stat.key] = Number(read("imprint")) / 100 || 0;
    });
    const profile = normalizeCustomProfile({ name, tbhm: $("#profile-tbhm").value, stats, imprint });
    const oldKey = $("#profile-form").dataset.key;
    const newKey = normalizeSpeciesName(name);
    if (oldKey && oldKey !== newKey) delete state.settings.customSpecies[oldKey];
    state.settings.customSpecies[newKey] = profile;
    $("#profile-dialog").close();
    saveState(`${name} calculator profile saved`);
    if ($("#dino-dialog").open) updateFormPreview();
  }

  function deleteCustomProfile() {
    const key = $("#profile-form").dataset.key;
    const profile = state.settings.customSpecies[key];
    if (!profile || !confirm(`Delete the custom calculator profile for ${profile.name}?`)) return;
    delete state.settings.customSpecies[key];
    $("#profile-dialog").close();
    saveState(`${profile.name} profile deleted`);
    if ($("#dino-dialog").open) updateFormPreview();
  }

  function exportData() {
    const payload = JSON.stringify({ app: "ARK Bloodlines", version: DATA_VERSION, exportedAt: new Date().toISOString(), dinos: state.dinos, incubators: state.incubators, settings: state.settings }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ark-bloodlines-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    $(".file-menu").removeAttribute("open");
    showToast("Backup exported");
  }

  async function importData(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.dinos)) throw new Error("No dino records found");
      if ((state.dinos.length || state.incubators.length) && !confirm(`Replace your ${state.dinos.length} current records and ${state.incubators.length} incubators with ${parsed.dinos.length} imported records?`)) return;
      state = normalizeState(parsed, state.settings);
      selectedId = state.dinos.find(dino => !isEggDino(dino))?.id || state.dinos[0]?.id || "";
      selectedIncubatorId = state.incubators[0]?.id || "";
      saveState(`${state.dinos.length} records and ${state.incubators.length} ${state.incubators.length === 1 ? "incubator" : "incubators"} imported`);
    } catch (error) {
      alert(`That file could not be imported. ${error.message}`);
    } finally {
      $("#import-file").value = "";
    }
  }

  function loadDemo() {
    if (state.dinos.length && !confirm("Replace the current dino and egg records with the demo family? Incubator entities will remain configured but empty.")) return;
    const motherId = uid();
    const fatherId = uid();
    const childId = uid();
    state.dinos = [
      normalizeDino({ id: motherId, name: "Vega", species: "Rex", sex: "Female", status: "Breeder", tag: "HP line", mutationsMaternal: 0, mutationsPaternal: 3, stats: { health: 46, stamina: 34, oxygen: 24, food: 28, weight: 40, melee: 39, speed: 18 }, traits: ["Weight-Frail III"], colors: "R0 forest, R4 cream", notes: "Foundation health breeder." }),
      normalizeDino({ id: fatherId, name: "Knox", species: "Rex", sex: "Male", status: "Breeder", tag: "Melee line", mutationsMaternal: 2, mutationsPaternal: 0, stats: { health: 40, stamina: 38, oxygen: 22, food: 27, weight: 36, melee: 47, speed: 20 }, colors: "R0 charcoal, R5 red" }),
      normalizeDino({ id: childId, name: "Ember", species: "Rex", sex: "Female", status: "Growing", tag: "F1 combine", gameId: "ASA-REX-00427", motherId, fatherId, mutationsMaternal: 3, mutationsPaternal: 2, stats: { health: 46, stamina: 38, oxygen: 24, food: 28, weight: 40, melee: 47, speed: 20 }, mutationStacks: { health: 1 }, leveledStats: { health: 18, stamina: 8, weight: 12, melee: 22 }, currentStats: { health: "30800", stamina: "2520", weight: "918", melee: "765.4" }, traits: ["Mutable Health III", "Kingslayer II"], imprintPercent: 100, imprinter: "Survivor", colors: "R0 charcoal, R5 red", notes: "Health rolled +2 over Vega; keep for the next combine." })
    ];
    selectedId = childId;
    saveState("Demo family loaded");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function handleDocumentClick(event) {
    const sort = event.target.closest("[data-sort-key]");
    if (sort) return cycleRosterSort(sort.dataset.sortKey);
    const addIncubator = event.target.closest("[data-add-incubator]");
    if (addIncubator) return openIncubatorDialog();
    const selectIncubator = event.target.closest("[data-select-incubator-id]");
    if (selectIncubator) {
      selectedIncubatorId = selectIncubator.dataset.selectIncubatorId;
      renderIncubators();
      return;
    }
    const addEgg = event.target.closest("[data-add-egg-incubator-id]");
    if (addEgg) return openDinoDialog("", { incubatorId: addEgg.dataset.addEggIncubatorId, incubatorSlot: toInt(addEgg.dataset.addEggSlot) });
    const hatch = event.target.closest("[data-hatch-id]");
    if (hatch) { event.stopPropagation(); return hatchEgg(hatch.dataset.hatchId); }
    const add = event.target.closest("#add-dino-button, [data-add-dino]");
    if (add) return openDinoDialog();
    const qualitySettings = event.target.closest("[data-quality-settings]");
    if (qualitySettings) return openSettingsDialog(qualitySettings.dataset.qualitySettings);
    const edit = event.target.closest("[data-edit-id]");
    if (edit) { event.stopPropagation(); return openDinoDialog(edit.dataset.editId); }
    const remove = event.target.closest("[data-delete-id]");
    if (remove) { event.stopPropagation(); return deleteDino(remove.dataset.deleteId); }
    const select = event.target.closest("[data-select-id]");
    if (select) { selectedId = select.dataset.selectId; renderRoster(); renderInspector(); return; }
    const lineage = event.target.closest("[data-lineage-id]");
    if (lineage) {
      selectedId = lineage.dataset.lineageId;
      $("#lineage-select").value = selectedId;
      if (activeView !== "lineage") switchView("lineage"); else renderLineage();
    }
    const profile = event.target.closest("[data-edit-profile]");
    if (profile) openProfileDialog(profile.dataset.editProfile);
  }

  function init() {
    buildStatsInputs();
    buildColorInputs();
    buildSettingsInputs();
    $("#show-archived").checked = uiPreferences.showArchived;
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("resize", () => { if (activeView === "lineage") drawLineageConnectors(); });
    $$(".nav-tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));
    ["#search-input", "#species-filter", "#sex-filter", "#status-filter"].forEach(selector => $(selector).addEventListener(selector === "#search-input" ? "input" : "change", renderRoster));
    $("#show-archived").addEventListener("change", event => {
      uiPreferences.showArchived = event.target.checked;
      saveUiPreferences();
      renderRoster();
    });
    $("#dino-form").addEventListener("submit", saveDinoFromForm);
    $("#dino-form").addEventListener("input", handleDinoFormTransferChange);
    $("#dino-form").addEventListener("change", handleDinoFormTransferChange);
    $("#dino-transfer-code").addEventListener("input", handleTransferCodeInput);
    $("#copy-transfer-code").addEventListener("click", copyTransferCode);
    $("#dino-status").addEventListener("change", () => syncEggPlacementFields());
    $("#dino-incubator").addEventListener("change", event => syncEggPlacementFields(event.target.value));
    $("#close-dialog").addEventListener("click", closeDinoDialog);
    $("#cancel-dialog").addEventListener("click", closeDinoDialog);
    $("#dino-dialog").addEventListener("click", event => { if (event.target === $("#dino-dialog")) closeDinoDialog(); });
    $("#stats-entry").addEventListener("input", handleStatsEntryInput);
    $("#progression-entry").addEventListener("input", updateFormPreview);
    $("#dino-mother").addEventListener("change", handleDinoParentChange);
    $("#dino-father").addEventListener("change", handleDinoParentChange);
    $("#dino-mother-breeders-only").addEventListener("change", handleParentFilterChange);
    $("#dino-father-breeders-only").addEventListener("change", handleParentFilterChange);
    $("#prefill-parent-stats").addEventListener("click", () => prefillInheritedStatsFromParents(true));
    $("#prefill-parent-colors").addEventListener("click", () => prefillColorRegionsFromParents(true));
    $("#color-regions-entry").addEventListener("change", handleColorRegionChange);
    $("#dino-species").addEventListener("input", updateFormPreview);
    $("#dino-species").addEventListener("change", () => {
      populateParentSelects($("#dino-id").value, $("#dino-species").value.trim());
      handleDinoParentChange();
    });
    $("#dino-origin").addEventListener("change", () => { syncOriginFields(); updateFormPreview(); });
    $("#dino-taming-effectiveness").addEventListener("input", updateFormPreview);
    $("#dino-imprint").addEventListener("input", updateFormPreview);
    $("#lineage-select").addEventListener("change", event => { selectedId = event.target.value; renderLineage(); });
    $("#trace-stat-select").addEventListener("change", renderLineage);
    $("#lineage-depth-select").addEventListener("change", renderLineage);
    $("#planner-mother").addEventListener("change", renderPlanner);
    $("#planner-father").addEventListener("change", renderPlanner);
    $("#export-button").addEventListener("click", exportData);
    $("#import-button").addEventListener("click", () => $("#import-file").click());
    $("#import-file").addEventListener("change", event => importData(event.target.files[0]));
    $("#settings-button").addEventListener("click", () => openSettingsDialog());
    $("#settings-form").addEventListener("submit", saveSettings);
    $("#setting-single-player").addEventListener("change", updateSinglePlayerPresetSummary);
    $("#multiplier-settings-body").addEventListener("input", updateSinglePlayerPresetSummary);
    $("#quality-species-select").addEventListener("change", loadQualityGoalEditor);
    $("#save-quality-goal").addEventListener("click", saveQualityGoal);
    $("#reset-quality-goal").addEventListener("click", resetQualityGoal);
    $("#close-settings").addEventListener("click", () => $("#settings-dialog").close());
    $("#cancel-settings").addEventListener("click", () => $("#settings-dialog").close());
    $("#reset-settings").addEventListener("click", restoreOfficialSettings);
    $("#settings-dialog").addEventListener("click", event => { if (event.target === $("#settings-dialog")) $("#settings-dialog").close(); });
    $("#profiles-button").addEventListener("click", () => openProfileDialog());
    $("#define-profile-button").addEventListener("click", () => openProfileDialog($("#dino-species").value.trim()));
    $("#profile-form").addEventListener("submit", saveCustomProfile);
    $("#close-profile").addEventListener("click", () => $("#profile-dialog").close());
    $("#cancel-profile").addEventListener("click", () => $("#profile-dialog").close());
    $("#delete-profile").addEventListener("click", deleteCustomProfile);
    $("#profile-dialog").addEventListener("click", event => { if (event.target === $("#profile-dialog")) $("#profile-dialog").close(); });
    $("#incubator-form").addEventListener("submit", saveIncubatorFromForm);
    $("#close-incubator-dialog").addEventListener("click", () => $("#incubator-dialog").close());
    $("#cancel-incubator-dialog").addEventListener("click", () => $("#incubator-dialog").close());
    $("#incubator-dialog").addEventListener("click", event => { if (event.target === $("#incubator-dialog")) $("#incubator-dialog").close(); });
    $("#rename-incubator").addEventListener("click", () => openIncubatorDialog(selectedIncubatorId));
    $("#delete-incubator").addEventListener("click", deleteSelectedIncubator);
    $("#clear-button").addEventListener("click", () => {
      if ((!state.dinos.length && !state.incubators.length) || !confirm("Clear every dino, egg, and incubator from this browser? Export a backup first if you may need it.")) return;
      state = { version: DATA_VERSION, dinos: [], incubators: [], settings: state.settings };
      selectedId = "";
      selectedIncubatorId = "";
      saveState("Archive cleared");
      $(".file-menu").removeAttribute("open");
    });
    $("#load-demo-button").addEventListener("click", loadDemo);
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        switchView("herd");
        $("#search-input").focus();
      }
      if (event.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !$("#dino-dialog").open) {
        event.preventDefault();
        openDinoDialog();
      }
      const row = event.target.closest?.(".roster-row");
      if (row?.dataset.selectId && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        selectedId = row.dataset.selectId;
        renderRoster();
        renderInspector();
      }
    });
    renderAll();
  }

  init();
})();
