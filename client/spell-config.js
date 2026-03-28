// spell-config.js — Single source of truth for all spell stats & casting config
// ─────────────────────────────────────────────────────────────────────────────
// Every spell is a LONG-RANGE PROJECTILE. Nova is wider/slower but still travels.

window.SPELL_CONFIG = {

    // ── Global casting settings ──────────────────────────────────────────────
    CAST_COOLDOWN_MS: 2000,       // Minimum time between casts
    RECORD_DURATION_MS: 2500,     // How long mic records before auto-stop
    CASTING_SPEED_MULT: 0.5,     // Movement multiplier while recording

    // ── Volume → Scale mapping ───────────────────────────────────────────────
    VOLUME_THRESHOLDS: [
        { max: 50,  scale: 1.0 },   // Normal
        { max: 85,  scale: 1.5 },   // Yelling
        { max: 100, scale: 2.0 },   // Screaming
    ],

    // ── Spell definitions ────────────────────────────────────────────────────
    // All spells are long-range projectiles with distinct behaviour.
    SPELLS: {

        fireball: {
            displayName: 'FIREBALL',
            color:       0xff8800,
            glowColor:   '#ff8800',
            radius:      12,
            speed:       500,         // medium speed
            damage:      12,          // medium damage
            gravity:     false,
            lifetime:    4000,        // ms before auto-destroy
            trail:       true,
            description: 'Burning DoT',
            debuff:      'burn',
            debuffDuration: 3000,
        },

        frostbite: {
            displayName: 'FROSTBITE',
            color:       0x44ddff,
            glowColor:   '#44ddff',
            radius:      10,
            speed:       420,         // slightly slower
            damage:      10,          // medium damage
            gravity:     false,
            lifetime:    4500,
            trail:       true,
            description: 'Slow enemy',
            debuff:      'slow',
            debuffDuration: 2500,
        },

        bolt: {
            displayName: 'BOLT',
            color:       0xffee22,
            glowColor:   '#ffee22',
            radius:      7,
            speed:       1100,        // very fast
            damage:      6,           // low damage
            gravity:     false,
            lifetime:    2500,
            trail:       true,
            description: 'Fast, low dmg',
            debuff:      null,
            debuffDuration: 0,
        },

        nova: {
            displayName: 'NOVA',
            color:       0xbb44ff,
            glowColor:   '#bb44ff',
            radius:      22,          // BIG projectile
            speed:       300,         // slow travel
            damage:      15,          // high damage
            gravity:     false,
            lifetime:    3500,
            trail:       true,
            description: 'Slow, high dmg + knockback',
            debuff:      'knockback',
            debuffDuration: 0,        // instant
            knockbackForce: 700,
        },
    },
};

/**
 * Maps a mic-volume reading (1–100) to a spell scale multiplier
 * using the thresholds defined above.
 */
function volumeToScale(volume) {
    const thresholds = window.SPELL_CONFIG.VOLUME_THRESHOLDS;
    for (const t of thresholds) {
        if (volume <= t.max) return t.scale;
    }
    return 2.0;
}
