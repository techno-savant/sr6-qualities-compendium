const MODULE_ID = "sr6-qualities-compendium";

// ── Helper to build an ActiveEffect change ──────────────────────────
function ae(key, value, mode = 2) {
  // mode 2 = CONST.ACTIVE_EFFECT_MODES.ADD
  return { key, value: String(value), mode };
}

// ── Helper to build a quality item ──────────────────────────────────
function quality(name, {
  genesisID = "",
  category = "ADVANTAGE",
  karma = 0,
  description = "",
  page = 0,
  effects = [],
  explain = "",
  leveled = false,     // true if this quality has multiple levels
  perLevel = null,     // { key, value } — effect value is multiplied by level
  maxLevel = 1,        // maximum level for this quality
} = {}) {
  const item = {
    name,
    type: "quality",
    img: category === "ADVANTAGE"
      ? "icons/svg/upgrade.svg"
      : "icons/svg/downgrade.svg",
    system: {
      genesisID: genesisID || name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      description,
      product: "SR6 Core Rulebook",
      page,
      category,
      level: false,
      value: karma,
      explain,
      modifier: [],
    },
  };
  if (effects.length > 0) {
    item.effects = [{
      name: `${name} Effect`,
      icon: item.img,
      changes: effects,
      disabled: false,
      transfer: true,
    }];
  }
  // Store leveling metadata as a flag for the sync hook
  if (leveled && perLevel) {
    item.flags = {
      [MODULE_ID]: {
        leveled: true,
        perLevel,  // { key, value } per level
        maxLevel,
      },
    };
  }
  return item;
}

// ── Leveled quality definitions ─────────────────────────────────────
// Maps genesisID → { key, value (per level), maxLevel }
const LEVELED_QUALITIES = {
  built_tough:    { key: "system.physical.mod",  value: 1,  maxLevel: 4 },
  glass_jaw:      { key: "system.stun.mod",      value: -1, maxLevel: 6 },
  will_to_live:   { key: "system.overflow.mod",  value: 2,  maxLevel: 3 },
};

/**
 * Extract the level from a quality name like "Built Tough 3" or "Built Tough (3)".
 * Returns 1 if no level suffix is found.
 */
function parseLevelFromName(name) {
  const match = name.match(/[\s(]+(\d+)\)?$/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * When a leveled quality is created or renamed on an actor, sync its
 * ActiveEffect value to match the parsed level. For example, if a GM
 * renames "Built Tough" to "Built Tough 3", the Physical CM mod
 * becomes +3 automatically.
 */
async function syncLeveledEffect(item) {
  if (item.type !== "quality" || !item.parent) return;
  const gid = (item.system?.genesisID || "").toLowerCase().trim();
  const config = LEVELED_QUALITIES[gid];
  if (!config) return;

  const level = Math.min(parseLevelFromName(item.name), config.maxLevel);
  const targetValue = String(config.value * level);

  // Find the transferred effect on the actor (or the embedded effect on the item)
  const effect = item.effects?.contents?.[0];
  if (!effect) return;

  const currentChange = effect.changes?.[0];
  if (currentChange && currentChange.value === targetValue) return; // already correct

  await effect.update({
    changes: [{ key: config.key, value: targetValue, mode: 2 }],
  });
  console.log(`${MODULE_ID} | Synced ${item.name} effect: ${config.key} = ${targetValue}`);
}

// ── Positive Qualities ──────────────────────────────────────────────

const POSITIVE_QUALITIES = [
  quality("Ambidextrous", {
    genesisID: "ambidextrous",
    karma: 4,
    page: 70,
    description: "You are equally adept at using either your right or left side. Whether shooting a gun, throwing a grenade, or kicking a ball, you can switch it up with the best of them.<br/><br/><b>Cost:</b> 4 Karma<br/><b>Game Effect:</b> No penalty for off-hand weapon use (see p. 110).",
    explain: "No off-hand penalty",
  }),
  // Analytical Mind is provided by sr6-edge-qualities module
  quality("Aptitude", {
    genesisID: "aptitude",
    karma: 12,
    page: 70,
    description: "The best look up to you. You have the natural potential to be even better than the best in a particular skill.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> Your skill maximum for the selected skill is 10, instead of 9, and your maximum starting rank is 7, instead of 6.",
    explain: "Selected skill max 10 (starting max 7)",
  }),
  quality("Astral Chameleon", {
    genesisID: "astral_chameleon",
    karma: 9,
    page: 70,
    description: "Your aura never seems to stabilize for very long. You have the ability to blend in with the astral environment around you and make it harder to identify and read your aura and astral signature.<br/><br/><b>Cost:</b> 9 Karma<br/><b>Game Effect:</b> Characters receive \u20132 dice on tests to recognize your aura or astral signature. Your astral signature fades in half the normal time (see p. 159).",
    explain: "-2 dice vs aura/signature recognition; signature fades 2x faster",
  }),
  quality("Blandness", {
    genesisID: "blandness",
    karma: 8,
    page: 70,
    description: "You are the least interesting person in the world. Nothing at all about you tends to stand out, and that can be extremely useful.<br/><br/><b>Cost:</b> 8 Karma<br/><b>Game Effect:</b> Characters take a \u20132 penalty on Memory tests (p. 67) to remember if they have seen you before, and the threshold on tests to notice if you are following or observing them is increased by 1. If the character acquires something permanent and distinctive, they lose this quality.",
    explain: "-2 to others' Memory tests; +1 threshold to spot you tailing",
  }),
  quality("Built Tough", {
    genesisID: "built_tough",
    karma: 4,
    page: 70,
    description: "You\u2019re built like a brick drekhouse. You\u2019re pretty good at taking a few extra hits before the lights go out.<br/><br/><b>Cost:</b> 4 Karma per level (max 4)<br/><b>Game Effect:</b> You have a number of additional boxes on your Physical Condition Monitor equal to the rank of this quality.",
    explain: "+1 Physical CM per level (rename to 'Built Tough 2' etc. to auto-scale)",
    effects: [ae("system.physical.mod", 1)],
    leveled: true,
    perLevel: { key: "system.physical.mod", value: 1 },
    maxLevel: 4,
  }),
  quality("Catlike", {
    genesisID: "catlike",
    karma: 12,
    page: 71,
    description: "You have an innate grace usually seen only in the genus Felis that translates into smooth movements and a propensity for always landing on your feet.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus Edge on all tests for balance, falling, and landing safely.",
    explain: "+1 Edge on balance/falling/landing tests",
  }),
  quality("Dermal Deposits", {
    genesisID: "dermal_deposits",
    karma: 7,
    page: 71,
    description: "You have calciferous deposits growing on or through your flesh, making you tougher and a little rough around the edges.<br/><br/><b>Cost:</b> 7 Karma<br/><b>Game Effect:</b> You gain 1 level of natural Armor. Your Unarmed Melee attacks inflict Physical damage.",
    explain: "+1 Defense Rating (natural armor)",
    effects: [ae("system.defenserating.physical.mod", 1)],
  }),
  quality("Double Jointed", {
    genesisID: "double_jointed",
    karma: 12,
    page: 71,
    description: "Your joints bend beyond normal metahuman ranges. Your hands narrow to as small as your wrists, your shoulders rotate and bend in every direction.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus Edge on all tests involving grappling, escaping bonds, flexibility, or fitting into tight spaces.",
    explain: "+1 Edge on grapple/escape/flexibility tests",
  }),
  quality("Elemental Resistance", {
    genesisID: "elemental_resistance",
    karma: 12,
    page: 71,
    description: "Through genetics or training, you have developed a powerful resistance and tolerance for certain forms of damaging energy.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> When choosing this quality, select an elemental form of damage (p. 109). When attacked with a weapon or spell that does this form of damage, gain a point of Edge before making your Defense test.",
    explain: "+1 Edge on Defense vs chosen element",
  }),
  quality("Exceptional Attribute", {
    genesisID: "exceptional_attribute",
    karma: 12,
    page: 71,
    description: "You\u2019re just naturally built to be better.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> Select a Physical or Mental attribute. That attribute\u2019s maximum (but not current) rank increases by 1. This quality can only be purchased once per attribute.",
    explain: "Selected attribute max +1",
  }),
  quality("First Impression", {
    genesisID: "first_impression",
    karma: 12,
    page: 71,
    description: "You know how to make an entrance. Your wit, charm, and subtle flattery put everyone you meet off their guard.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain 2 Edge for Social Tests during your first meeting with anyone, and both your Heat and Reputation are ignored for this first encounter.",
    explain: "+2 Edge on first-meeting Social tests; ignore Heat/Rep",
  }),
  quality("Focused Concentration", {
    genesisID: "focused_concentration",
    karma: 12,
    page: 71,
    description: "You know how to compartmentalize your mind and keep hold of arcane and emergent manipulations without straining yourself.<br/><br/><b>Cost:</b> 12 Karma per level (max 3)<br/><b>Game Effect:</b> For each level, you can sustain 1 additional spell or complex form without suffering the associated penalty. The spell cannot have a modified Drain Value of 7 or greater.",
    explain: "Sustain 1 extra spell/CF without penalty per level (DV < 7)",
  }),
  quality("Gearhead", {
    genesisID: "gearhead",
    karma: 10,
    page: 71,
    description: "If it\u2019s meant to move but currently isn\u2019t moving so well, you know how to get it back into tip-top shape in a jiffy.<br/><br/><b>Cost:</b> 10 Karma<br/><b>Game Effect:</b> You gain an Edge on Repair tests for any vehicle and can spend Edge during downtime to make Extended Repair tests.",
    explain: "+1 Edge on vehicle Repair tests",
  }),
  quality("Guts", {
    genesisID: "guts",
    karma: 12,
    page: 71,
    description: "It\u2019s not a lack of fear, just a lack of cowardice! You can stand up to the most intimidating opponents and hold your tongue under the toughest interrogations.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain an Edge when resisting Intimidation or effects that cause the Frightened status.",
    explain: "+1 Edge vs Intimidation/Frightened",
  }),
  quality("Hardening", {
    genesisID: "hardening",
    karma: 10,
    page: 72,
    description: "Your physical form actually helps absorb some of the injuries coming at your Matrix persona.<br/><br/><b>Cost:</b> 10 Karma<br/><b>Game Effect:</b> You gain a bonus Edge when making Matrix Damage Resistance tests. When struck by any damage in the Matrix, you can convert up to two boxes to Stun Damage, rather than Matrix damage.",
    explain: "+1 Edge on Matrix Damage Resistance; convert up to 2 Matrix dmg to Stun",
  }),
  quality("High Pain Tolerance", {
    genesisID: "high_pain_tolerance",
    karma: 7,
    page: 72,
    description: "Pain is but an illusion of the mind. You don\u2019t suffer the ill effects of injury and pain like others.<br/><br/><b>Cost:</b> 7 Karma<br/><b>Game Effect:</b> When wounded, reduce your wound penalty by one (to a minimum of 0).",
    explain: "Wound penalty reduced by 1 (min 0)",
  }),
  quality("Home Ground", {
    genesisID: "home_ground",
    karma: 10,
    page: 72,
    description: "Spend enough time somewhere, and you get to know it like the back of your hand.<br/><br/><b>Cost:</b> 10 Karma<br/><b>Game Effect:</b> Select a neighborhood or Matrix host each time you take this quality. Outdoors and Perception tests made in your Home Ground gain an Edge for use on that test.",
    explain: "+1 Edge on Outdoors/Perception in chosen area",
  }),
  quality("Human-Looking", {
    genesisID: "human-looking",
    karma: 8,
    page: 72,
    description: "Whether through genetics or modifications, you do not look like your birth metatype; you appear human.<br/><br/><b>Cost:</b> 8 Karma<br/><b>Game Effect:</b> You generally appear human at first glance and gain +2 dice on Disguise tests to hide your metatype. Non-human metatypes only.",
    explain: "+2 dice on Disguise to appear human",
  }),
  quality("Indomitable", {
    genesisID: "indomitable",
    karma: 12,
    page: 72,
    description: "Your mind is hard to break. You can hold out longer under interrogation, shrug off mild injuries with ease, and hold your mind against incoming mana.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> Edge Boost costs are reduced by 1 on tests involving Willpower.",
    explain: "-1 Edge Boost cost on Willpower tests",
  }),
  quality("Juryrigger", {
    genesisID: "juryrigger",
    karma: 12,
    page: 72,
    description: "When you don\u2019t have the time or the parts to do it right, you can still get it done.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> When performing a Juryrigging test (see p. 95), you gain a point of Edge that must be spent on that test, or it goes away.",
    explain: "+1 Edge on Juryrigging (use it or lose it)",
  }),
  quality("Long Reach", {
    genesisID: "long_reach",
    karma: 12,
    page: 72,
    description: "Whether it\u2019s because of long arms, long legs, or some exceptional physical grace, you are able to reach people with melee weapons easier than others.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> When you are using a melee weapon, Close range is extended to 5 meters instead of 3.",
    explain: "Melee Close range = 5m (instead of 3m)",
  }),
  quality("Low-Light Vision", {
    genesisID: "low-light_vision",
    karma: 6,
    page: 72,
    description: "You are capable of operating in light levels that would leave others essentially blind.<br/><br/><b>Cost:</b> 6 Karma<br/><b>Game Effect:</b> You can see clearly in any light level that is not total darkness (see Environment and Visibility, p. 118).",
  }),
  quality("Magic Resistance", {
    genesisID: "magic_resistance",
    karma: 8,
    page: 72,
    description: "Mana just doesn\u2019t seem to want to connect with you. Whether it\u2019s a manabolt or a healing spell, it\u2019s just harder to get magic to work on you.<br/><br/><b>Cost:</b> 8 Karma<br/><b>Game Effect:</b> You gain a bonus Edge for use on any Magic Resistance test. When a Health spell is cast on you, treat your Essence as if it were 2 points lower than it actually is.",
    explain: "+1 vs direct & indirect spells; Health spells treat Essence as -2",
    effects: [
      ae("system.defensepool.spells_direct.mod", 1),
      ae("system.defensepool.spells_indirect.mod", 1),
    ],
  }),
  quality("Mentor Spirit", {
    genesisID: "mentor_spirit",
    karma: 10,
    page: 73,
    description: "You believe in something other than yourself to help guide and channel your magic, and that something believes in you.<br/><br/><b>Cost:</b> 10 Karma<br/><b>Game Effect:</b> You gain the benefits listed with the description of your mentor spirit (see p. 162). If you fail to keep aligned with one of those tenets, you lose your connection to your mentor and all associated bonuses.",
  }),
  quality("Photographic Memory", {
    genesisID: "photographic_memory",
    karma: 12,
    page: 73,
    description: "Most people store life in clips, but you keep the recording running all the time.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus Edge point when making a Memory test (p. 67).",
    explain: "+1 Edge on Memory tests",
  }),
  quality("Quick Healer", {
    genesisID: "quick_healer",
    karma: 8,
    page: 73,
    description: "You tend to heal from injury quicker than your peers.<br/><br/><b>Cost:</b> 8 Karma<br/><b>Game Effect:</b> Cut the interval for any natural healing test (p. 120) in half, meaning you can heal Stun Damage after half an hour and Physical Damage after half a day.",
    explain: "Healing intervals halved (Stun: 30min, Physical: 12hr)",
  }),
  quality("Resistance to Pathogens", {
    genesisID: "resistance_pathogens",
    karma: 12,
    page: 73,
    description: "You have a very healthy immune system that has mastered the art of fighting off any and all comers.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus point of Edge when you make a Pathogen Resistance test.",
    explain: "+1 Edge on Pathogen Resistance tests",
  }),
  quality("Spirit Affinity", {
    genesisID: "spirit_affinity",
    karma: 14,
    page: 73,
    description: "You have earned respect among a particular group of spirits.<br/><br/><b>Cost:</b> 14 Karma<br/><b>Game Effect:</b> When selecting this quality, choose a type of spirit. You gain a bonus point of Edge when making a Conjuring test for your chosen class of spirits. This quality can be taken multiple times.",
    explain: "+1 Edge on Conjuring for chosen spirit type",
  }),
  quality("Sprite Affinity", {
    genesisID: "sprite_affinity",
    karma: 14,
    page: 73,
    description: "You have earned respect among a particular group of sprites.<br/><br/><b>Cost:</b> 14 Karma<br/><b>Game Effect:</b> When selecting this quality, choose a type of sprite. You gain a bonus point of Edge when making a Tasking test for your chosen class of sprites. This quality can be taken multiple times.",
    explain: "+1 Edge on Tasking for chosen sprite type",
  }),
  quality("Thermographic Vision", {
    genesisID: "thermographic_vision",
    karma: 8,
    page: 73,
    description: "Your vision allows you to see differences in temperature on and around objects and people.<br/><br/><b>Cost:</b> 8 Karma<br/><b>Game Effect:</b> You can see the heat of objects in total darkness (assuming they are warmer or colder than the ambient temperature), allowing you to operate in such conditions.",
  }),
  quality("Toughness", {
    genesisID: "toughness",
    karma: 12,
    page: 73,
    description: "You can take a bit more of a beating and shrug off the injuries better than most.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus point of Edge when making Damage Resistance tests.",
    explain: "+1 to soak pool (Damage Resistance)",
    effects: [ae("system.defensepool.damage_physical.mod", 1)],
  }),
  quality("Toxin Resistance", {
    genesisID: "toxin_resistance",
    karma: 12,
    page: 73,
    description: "You\u2019re able to better resist the effects of toxins in the Sixth World.<br/><br/><b>Cost:</b> 12 Karma<br/><b>Game Effect:</b> You gain a bonus point of Edge when you make a Toxin Resistance test (p. 121).",
    explain: "+1 to Toxin Resistance pool",
    effects: [ae("system.defensepool.toxin.mod", 1)],
  }),
  quality("Will to Live", {
    genesisID: "will_to_live",
    karma: 8,
    page: 74,
    description: "No matter how hard the hit, you have the tenacity to hold on to the bitter end.<br/><br/><b>Cost:</b> 8 Karma per level (max 3)<br/><b>Game Effect:</b> For every rank of this quality you possess, you gain two additional Damage Overflow boxes (see p. 121).",
    explain: "+2 Overflow per level (rename to 'Will to Live 2' etc. to auto-scale)",
    effects: [ae("system.overflow.mod", 2)],
    leveled: true,
    perLevel: { key: "system.overflow.mod", value: 2 },
    maxLevel: 3,
  }),
];

// ── Negative Qualities ──────────────────────────────────────────────

const NEGATIVE_QUALITIES = [
  quality("Addiction", {
    genesisID: "addiction",
    category: "DISADVANTAGE",
    karma: 2,
    page: 74,
    description: "Some habits just can\u2019t be kicked.<br/><br/><b>Bonus:</b> 2 Karma per level (max 6)<br/><b>Game Effect:</b> You cannot earn Edge or spend Edge in any form while suffering withdrawal. Withdrawal times and requirements are based on the level of addiction.",
    explain: "No Edge while in withdrawal; -2 dice pool on all tests",
  }),
  quality("Allergy", {
    genesisID: "allergy",
    category: "DISADVANTAGE",
    karma: 2,
    page: 74,
    description: "You suffer some level of discomfort from a substance found in the Sixth World.<br/><br/><b>Bonus:</b> 2 to 20 Karma (based on rarity and severity)<br/><b>Game Effect:</b> Select an allergen and severity. You cannot spend or earn Edge while exposed to your allergen. Secondary effects vary by severity (see p. 74).",
    explain: "No Edge while exposed; penalty varies by severity",
  }),
  quality("AR Vertigo", {
    genesisID: "ar_vertigo",
    category: "DISADVANTAGE",
    karma: 10,
    page: 75,
    description: "You get dizzy and nauseated when utilizing AR.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> You cannot gain or spend Edge while utilizing AR of any sort. You also gain the Nauseated status while using AR and for one hour after you exit it.",
    explain: "No Edge in AR; Nauseated status while in AR + 1hr after",
  }),
  quality("Astral Beacon", {
    genesisID: "astral_beacon",
    category: "DISADVANTAGE",
    karma: 10,
    page: 75,
    description: "Your bright aura makes you stick out like a sore thumb on the astral.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> You are considered Untrained for all Stealth tests in the astral plane. You can never take the masking metamagic. Assensing tests against you get a free Edge and reduced thresholds. Astral Tracking tests against you gain 2 Edge and halved thresholds.",
    explain: "Untrained astral Stealth; no Masking; others get Edge vs you astrally",
  }),
  quality("Bad Luck", {
    genesisID: "bad_luck",
    category: "DISADVANTAGE",
    karma: 10,
    page: 75,
    description: "Things just go wrong around you. Often.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> Glitches occur more frequently. Count dice showing both 1 and 2 for determining a glitch. This does not affect critical glitches, only regular glitches.",
    explain: "1s AND 2s count for glitches (not critical glitches)",
  }),
  quality("Bad Rep", {
    genesisID: "bad_rep",
    category: "DISADVANTAGE",
    karma: 8,
    page: 75,
    description: "Word on the street does not speak favorably of you.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> You cannot spend Edge on Social tests. If you engage in a Teamwork test to assist a Social test, no one can spend Edge, and the opposing individual gains a point of Edge.",
    explain: "No Edge on Social tests; poison Teamwork Social tests",
  }),
  quality("Combat Paralysis", {
    genesisID: "combat_paralysis",
    category: "DISADVANTAGE",
    karma: 8,
    page: 75,
    description: "You just can\u2019t help but jump and freeze that first time they start shooting.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> Your Initiative Score is divided in half at the start of combat. You cannot take a Move or Sprint action in the first round, and you act last in that round.",
    explain: "Init/2 round 1; no Move/Sprint round 1; act last",
  }),
  quality("Dependents", {
    genesisID: "dependents",
    category: "DISADVANTAGE",
    karma: 4,
    page: 75,
    description: "You have people relying on you for financial support.<br/><br/><b>Bonus:</b> 4 Karma per level (max 3)<br/><b>Game Effect:</b> Level 1: 5% of scores. Level 2: 10% of scores. Level 3: 25% of scores.",
    explain: "Lose 5%/10%/25% of income per level",
  }),
  quality("Distinctive Style", {
    genesisID: "distinctive_style",
    category: "DISADVANTAGE",
    karma: 6,
    page: 76,
    description: "You only fit in when you\u2019re in places where no one fits in.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> You cannot gain or spend Edge when you\u2019re not rocking your distinctive look. Others get a +2 dice pool bonus on Memory tests to recall your appearance.",
    explain: "No Edge without your look; +2 to others' Memory tests",
  }),
  quality("Elf Poser", {
    genesisID: "elf_poser",
    category: "DISADVANTAGE",
    karma: 6,
    page: 76,
    description: "Your blood may be human or ork, but you present yourself as an elf.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> Elves, orks, and trolls gain a point of Edge in Influence (Etiquette) tests made against you. Humans and orks only.",
    explain: "Elves/orks/trolls get +1 Edge on Etiquette vs you",
  }),
  quality("Glass Jaw", {
    genesisID: "glass_jaw",
    category: "DISADVANTAGE",
    karma: 4,
    page: 76,
    description: "Doesn\u2019t take much to lay you on your hoop.<br/><br/><b>Bonus:</b> 4 Karma per level (max 6)<br/><b>Game Effect:</b> You have 1 less Stun Box for each level of this quality, down to a minimum of 2.",
    explain: "-1 Stun CM per level (rename to 'Glass Jaw 2' etc. to auto-scale)",
    effects: [ae("system.stun.mod", -1)],
    leveled: true,
    perLevel: { key: "system.stun.mod", value: -1 },
    maxLevel: 6,
  }),
  quality("Gremlins", {
    genesisID: "gremlins",
    category: "DISADVANTAGE",
    karma: 6,
    page: 76,
    description: "Any and every thing that could go wrong with tech in your hands has gone wrong.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> Whenever you use any device, roll 2D6. If you get a 1 on either die, the device fails (glitch). Snake eyes means catastrophic failure (critical glitch).",
    explain: "Roll 2D6 per device use; any 1 = glitch, snake eyes = critical",
  }),
  quality("Honorbound", {
    genesisID: "honorbound",
    category: "DISADVANTAGE",
    karma: 10,
    page: 76,
    description: "You have a code. You live by the code. You die by the code.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> You cannot spend or earn Edge for twenty-four hours after you break a tenet of your code. Repeated violations extend the duration.",
    explain: "No Edge for 24hr after breaking code; stacks on repeat",
  }),
  quality("Impaired", {
    genesisID: "impaired",
    category: "DISADVANTAGE",
    karma: 8,
    page: 76,
    description: "A bum knee, poor genetics, or an illness has you lacking the maximum achievement level of your peers.<br/><br/><b>Bonus:</b> 8 Karma per level (max 6)<br/><b>Game Effect:</b> For each level, the character\u2019s maximum for the chosen attribute decreases by 1, to a minimum of 2.",
    explain: "Chosen attribute max -1 per level (min 2)",
  }),
  quality("Incompetent", {
    genesisID: "incompetent",
    category: "DISADVANTAGE",
    karma: 10,
    page: 76,
    description: "No matter how much you practice, there are some skills you just can\u2019t manage to get right.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> Select a skill. You are unable to gain ranks in the selected skill. This quality may only be selected once.",
    explain: "Cannot gain ranks in chosen skill",
  }),
  quality("In Debt", {
    genesisID: "in_debt",
    category: "DISADVANTAGE",
    karma: 0,
    page: 77,
    description: "Sometimes to get cash you need to owe cash.<br/><br/><b>Bonus:</b> None (extra nuyen at creation)<br/><b>Game Effect:</b> Each Karma spent gets 5,000\u00a5 instead of 2,000\u00a5 but also puts you 5,000\u00a5 in debt. Monthly interest of 500\u00a5 per Karma spent. Character creation only.",
    explain: "5,000/Karma at creation; 500/Karma monthly interest",
  }),
  quality("Insomnia", {
    genesisID: "insomnia",
    category: "DISADVANTAGE",
    karma: 4,
    page: 77,
    description: "You just can\u2019t get a good night\u2019s rest.<br/><br/><b>Bonus:</b> 4 Karma<br/><b>Game Effect:</b> Each day make a Body + Willpower (3) test. On failure, you cannot earn more than 2 Edge from any source and cannot spend more than 2 Edge on any test that day.",
    explain: "Daily BOD+WIL(3) or Edge capped at 2 earn/spend",
  }),
  quality("Loss of Confidence", {
    genesisID: "loss_confidence",
    category: "DISADVANTAGE",
    karma: 6,
    page: 78,
    description: "Imposter syndrome or too many failures have left you doubting yourself.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> During any encounter, you must make a Willpower (2) test as a Minor Action. Failure means you cannot earn or spend Edge for the entire encounter.",
    explain: "WIL(2) per encounter or no Edge",
  }),
  quality("Low Pain Tolerance", {
    genesisID: "low_pain_tolerance",
    category: "DISADVANTAGE",
    karma: 10,
    page: 78,
    description: "You\u2019ve got sensitive nerves or a generally sensitive nature.<br/><br/><b>Bonus:</b> 10 Karma<br/><b>Game Effect:</b> All wound modifiers are doubled.",
    explain: "Wound modifiers x2",
  }),
  quality("Ork Poser", {
    genesisID: "ork_poser",
    category: "DISADVANTAGE",
    karma: 6,
    page: 78,
    description: "Your blood may be human or elf, but you present yourself as an ork.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> Elves, orks, and trolls gain a point of Edge in Influence (Etiquette) tests made against you. Humans and elves only.",
    explain: "Elves/orks/trolls get +1 Edge on Etiquette vs you",
  }),
  quality("Prejudiced", {
    genesisID: "prejudiced",
    category: "DISADVANTAGE",
    karma: 8,
    page: 78,
    description: "You have deep-seated views about a certain group.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> Select a specific group. You are unable to gain or use Edge while the object of your prejudice is present (unless directly opposing them).",
    explain: "No Edge when target group is present (unless opposing them)",
  }),
  quality("Scorched", {
    genesisID: "scorched",
    category: "DISADVANTAGE",
    karma: 6,
    page: 78,
    description: "A Matrix, simsense, or BTL experience has fried your neurons.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> You cannot spend Edge while accessing the Matrix. This includes through use of commlinks, smartlinks, and any other source of data.",
    explain: "No Edge while on the Matrix (any device)",
  }),
  quality("Sensitive System", {
    genesisID: "sensitive_system",
    category: "DISADVANTAGE",
    karma: 8,
    page: 78,
    description: "Your body does not like to have anything grafted or merged with it that isn\u2019t part of its natural code.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> Essence costs are doubled for all cyberware, bioware, and nanoware. Geneware suffers no ill effects. Cannot have Magic or Resonance.",
    explain: "Essence costs x2 for cyber/bio/nanoware",
  }),
  quality("Simsense Vertigo", {
    genesisID: "simsense_vertigo",
    category: "DISADVANTAGE",
    karma: 6,
    page: 78,
    description: "Whenever you log onto the Matrix in VR, your disorientation is nauseating.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> You cannot gain or spend Edge while accessing the Matrix via VR. You also receive the Nauseated status for one hour after you log off.",
    explain: "No Edge in VR; Nauseated 1hr after logout",
  }),
  quality("SINner", {
    genesisID: "sinner",
    category: "DISADVANTAGE",
    karma: 8,
    page: 78,
    description: "You have a legitimate SIN that links back to biometric data.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> You pay taxes (10% increase in lifestyle cost). You are easier to track, giving opponents a point of Edge every time they attempt a Trace Icon action against you.",
    explain: "+10% lifestyle cost; others get +1 Edge on Trace Icon vs you",
  }),
  quality("Social Stress", {
    genesisID: "social_stress",
    category: "DISADVANTAGE",
    karma: 8,
    page: 78,
    description: "There is a social situation that simply does not work for you.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> Select a stressor. When encountering it, make a Charisma (2) test as a Minor Action. Failure means you cannot earn or spend Edge until you succeed.",
    explain: "CHA(2) when stressor present or no Edge",
  }),
  quality("Spirit Bane", {
    genesisID: "spirit_bane",
    category: "DISADVANTAGE",
    karma: 12,
    page: 79,
    description: "A certain type of spirit has an inherent dislike for you.<br/><br/><b>Bonus:</b> 12 Karma<br/><b>Game Effect:</b> Choose a type of spirit. They gain a bonus point of Edge when you attempt a Conjuring test against them. They will attack you first and relentlessly in combat.",
    explain: "Chosen spirits get +1 Edge vs you; target you first",
  }),
  quality("Sprite Bane", {
    genesisID: "sprite_bane",
    category: "DISADVANTAGE",
    karma: 12,
    page: 79,
    description: "A certain type of sprite has an inherent dislike for you.<br/><br/><b>Bonus:</b> 12 Karma<br/><b>Game Effect:</b> Choose a type of sprite. They gain a bonus point of Edge when you attempt a Tasking test against them. They will attack you first and relentlessly in combat.",
    explain: "Chosen sprites get +1 Edge vs you; target you first",
  }),
  quality("Uncouth", {
    genesisID: "uncouth",
    category: "DISADVANTAGE",
    karma: 6,
    page: 79,
    description: "The filter between your thoughts and your mouth has disappeared.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> You cannot spend Edge on any test using Charisma.",
    explain: "No Edge on CHA-linked tests",
  }),
  quality("Uneducated", {
    genesisID: "uneducated",
    category: "DISADVANTAGE",
    karma: 6,
    page: 79,
    description: "Book learning just wasn\u2019t your thing.<br/><br/><b>Bonus:</b> 6 Karma<br/><b>Game Effect:</b> You cannot spend Edge on any test using Logic.",
    explain: "No Edge on LOG-linked tests",
  }),
  quality("Unsteady Hands", {
    genesisID: "unsteady_hands",
    category: "DISADVANTAGE",
    karma: 4,
    page: 79,
    description: "Nervous tics, excessive caffeine intake, or general clumsiness.<br/><br/><b>Bonus:</b> 4 Karma<br/><b>Game Effect:</b> You cannot spend Edge on any test using Agility that directly involves your hands.",
    explain: "No Edge on AGI tests involving hands",
  }),
  quality("Weak Immune System", {
    genesisID: "weak_immune_system",
    category: "DISADVANTAGE",
    karma: 8,
    page: 79,
    description: "You\u2019ve never met an infection you didn\u2019t want to take home.<br/><br/><b>Bonus:</b> 8 Karma<br/><b>Game Effect:</b> You cannot spend Edge to resist infection effects. The threshold for fighting off any infection is increased by 1. While ill, you suffer a \u20131 dice pool modifier to all tests.",
    explain: "No Edge vs infection; +1 threshold; -1 dice pool while ill",
  }),
];

// ── Pack map ────────────────────────────────────────────────────────

const QUALITIES = {
  "positive-qualities": POSITIVE_QUALITIES,
  "negative-qualities": NEGATIVE_QUALITIES,
};

// ── Compendium population ───────────────────────────────────────────

async function populateCompendium(packName, items) {
  const packKey = `${MODULE_ID}.${packName}`;
  const pack = game.packs.get(packKey);
  if (!pack) {
    console.warn(`${MODULE_ID} | Pack '${packKey}' not found`);
    return;
  }

  const wasLocked = pack.locked;
  if (wasLocked) {
    await pack.configure({ locked: false });
  }

  try {
    const existing = await pack.getDocuments();
    const existingNames = new Set(existing.map((i) => i.name));

    for (const itemData of items) {
      if (existingNames.has(itemData.name)) continue;
      await Item.create(itemData, { pack: packKey });
      console.log(`${MODULE_ID} | Created: ${itemData.name} in ${packName}`);
    }
  } finally {
    if (wasLocked) {
      await pack.configure({ locked: true });
    }
  }
}

// ── Initialization ──────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing SR6 Core Qualities Compendium`);
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  console.log(`${MODULE_ID} | Populating quality compendiums...`);

  for (const [packName, items] of Object.entries(QUALITIES)) {
    await populateCompendium(packName, items);
  }

  console.log(`${MODULE_ID} | Done`);
});

// ── Leveled quality auto-sync ───────────────────────────────────────
// When a leveled quality is added to a character or renamed,
// parse the level from the name and update the ActiveEffect value.
// Examples: "Built Tough 3" → +3 Physical CM
//           "Glass Jaw 2"   → -2 Stun CM
//           "Will to Live 2" → +4 Overflow

Hooks.on("createItem", (item) => {
  if (!game.user.isGM) return;
  syncLeveledEffect(item);
});

Hooks.on("updateItem", (item, changes) => {
  if (!game.user.isGM) return;
  // Only re-sync if the name changed (user edited the level)
  if (changes.name) {
    syncLeveledEffect(item);
  }
});
