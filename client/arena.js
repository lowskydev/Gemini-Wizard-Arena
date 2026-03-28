// Arena definitions. Each arena provides:
//   preload(scene)         — load any arena-specific assets
//   buildBackground(scene) — draw background layers
//   buildPlatforms(scene, width, height) — create static platform group
//
// GameScene calls these hooks so zero arena logic lives in game.js itself.
// Selected arena key is stored in window.selectedArena (set by MenuScene).
// ─────────────────────────────────────────────────────────────────────────────

window.selectedArena = 'ruins'; // default

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns a value in [min, max) */
const randRange = (min, max) => Math.random() * (max - min) + min;

/** Place a tileSprite platform and add it to a staticGroup */
const makeTilePlat = (scene, group, textureKey, frameKey, x, y, w, tileScale = 1.5) => {
    const h = 16 * tileScale; // One tile high
    const plat = frameKey
        ? scene.add.tileSprite(x, y, w, h, textureKey, frameKey)
        : scene.add.tileSprite(x, y, w, h, textureKey);
    plat.tileScaleX = tileScale;
    plat.tileScaleY = tileScale;
    scene.physics.add.existing(plat, true);
    group.add(plat);
    return plat;
};

/** Place a solid-colour obstacle box and add it to a staticGroup */
const makeObstacle = (scene, group, x, y, w, h, color = 0x4a3060) => {
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRect(-w / 2, -h / 2, w, h);
    gfx.lineStyle(2, 0x7a50a0, 1);
    gfx.strokeRect(-w / 2, -h / 2, w, h);
    gfx.generateTexture('_obs_' + Math.random(), w, h);
    gfx.destroy();

    // Use a plain rectangle body via a zone/image combo
    const img = scene.physics.add.image(x, y, Phaser.Utils.Array.GetRandom(
        scene.textures.getTextureKeys().filter(k => k.startsWith('_obs_'))
    ));
    img.setImmovable(true);
    img.body.allowGravity = false;
    group.add(img);
    return img;
};

// ─────────────────────────────────────────────────────────────────────────────

window.ARENAS = {

    // ── Arena 1: Mountain Ruins ───────────────────────────────────────────────
    ruins: {
        name: 'Mountain Ruins',
        bgColor: '#1a1a2e',
        description: 'A crumbling ruin at dusk',

        preload(scene) {
            scene.load.image('bg1', 'assets/parallax_mountain_pack/layers/parallax-mountain-bg.png');
            scene.load.image('bg2', 'assets/parallax_mountain_pack/layers/parallax-mountain-montain-far.png');
            scene.load.image('bg3', 'assets/parallax_mountain_pack/layers/parallax-mountain-mountains.png');
            scene.load.image('bg4', 'assets/parallax_mountain_pack/layers/parallax-mountain-trees.png');
            scene.load.image('bg5', 'assets/parallax_mountain_pack/layers/parallax-mountain-foreground-trees.png');
            scene.load.image('platformertiles', 'assets/platformertiles.png');
        },

        buildBackground(scene) {
            const { width, height } = scene.scale;
            scene.add.image(width / 2, height / 2, 'bg1').setDisplaySize(width, height).setDepth(-5);
            scene.add.image(width / 2, height / 2, 'bg2').setDisplaySize(width, height).setDepth(-4);
            scene.add.image(width / 2, height / 2, 'bg3').setDisplaySize(width, height).setDepth(-3);
            scene.add.image(width / 2, height / 2, 'bg4').setDisplaySize(width, height).setDepth(-2);
            scene.add.image(width / 2, height / 2, 'bg5').setDisplaySize(width, height).setDepth(-1);
        },

        buildPlatforms(scene, width, height) {
            // Extract mossy rock from platformertiles (guessing 48,0 or similar)
            if (!scene.textures.get('platformertiles').has('ruins_plat')) {
                scene.textures.get('platformertiles').add('ruins_plat', 0, 48, 0, 16, 16);
            }

            const group = scene.physics.add.staticGroup();

            // ── Fixed layout ─────────────────────────────────────────────
            const plats = [
                makeTilePlat(scene, group, 'platformertiles', 'ruins_plat', width * 0.25, height - 150, 256, 2.0),
                makeTilePlat(scene, group, 'platformertiles', 'ruins_plat', width * 0.75, height - 250, 256, 2.0),
                makeTilePlat(scene, group, 'platformertiles', 'ruins_plat', width * 0.5, height - 400, 256, 2.0)
            ];
            
            // Brighter golden tint + white top-highlight for maximum contrast
            const highlightCol = 0xfff0aa;
            plats.forEach(p => {
                p.setTint(highlightCol);
                const line = scene.add.graphics().setDepth(p.depth + 1);
                line.lineStyle(3, 0xffffff, 0.6);
                line.lineBetween(p.x - p.width/2, p.y - p.height/2 + 2, p.x + p.width/2, p.y - p.height/2 + 2);
            });

            return group;
        }
    },

    // ── Arena 2: Crypt of Shadows ─────────────────────────────────────────────
    crypt: {
        name: 'Crypt of Shadows',
        bgColor: '#050510',
        description: 'A moonlit underground crypt',

        preload(scene) {
            scene.load.image('platformertiles', 'assets/platformertiles.png');
            scene.load.image('mountains-far', 'assets/parallax_mountain_pack/layers/parallax-mountain-montain-far.png');
            scene.load.image('mountains-mid', 'assets/parallax_mountain_pack/layers/parallax-mountain-mountains.png');
        },

        buildBackground(scene) {
            const { width, height } = scene.scale;

            // 1. Deep night sky gradient
            const bg = scene.add.graphics().setDepth(-10);
            bg.fillGradientStyle(0x050510, 0x050510, 0x0a0525, 0x0a0525, 1);
            bg.fillRect(0, 0, width, height);

            // 2. Procedural Stars
            const stars = scene.add.graphics().setDepth(-9);
            stars.fillStyle(0xffffff, 0.4);
            for (let i = 0; i < 60; i++) {
                stars.fillCircle(Math.random() * width, Math.random() * (height * 0.5), 1);
            }

            // 3. Distant Mountains (Asset-based)
            const mount1 = scene.add.image(width / 2, height / 2, 'mountains-far').setDisplaySize(width, height).setDepth(-8.7);
            mount1.setTint(0x050515);
            const mount2 = scene.add.image(width / 2, height / 2, 'mountains-mid').setDisplaySize(width, height).setDepth(-8.5);
            mount2.setTint(0x080820);

            // 4. Distant Background Arches (Silhouettes)
            const archGfx = scene.add.graphics().setDepth(-8);
            archGfx.fillStyle(0x08081a, 1);
            const archCount = 4;
            const archSpacing = width / archCount;
            for (let i = 0; i < archCount; i++) {
                const ax = archSpacing * i + archSpacing/2;
                const ay = height - 120;
                const aw = 120, ah = 280;
                archGfx.fillEllipse(ax, ay, aw, ah);
                archGfx.fillRect(ax - aw/2, ay, aw, ah/2);
            }

            // 5. Moon with Outer Glow
            const moonGfx = scene.add.graphics().setDepth(-7);
            moonGfx.fillStyle(0x4a4a8a, 0.2);
            moonGfx.fillCircle(width * 0.5, height * 0.18, 70);
            moonGfx.fillStyle(0xd8e8ff, 0.9);
            moonGfx.fillCircle(width * 0.5, height * 0.18, 48);
            moonGfx.fillStyle(0xffffff, 0.3);
            moonGfx.fillCircle(width * 0.5, height * 0.18, 52);

            // Atmospheric dark vignette
            const vig = scene.add.graphics().setDepth(-3);
            vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0.0, 0.0);
            vig.fillRect(0, 0, width / 2, height);
            const vig2 = scene.add.graphics().setDepth(-3);
            vig2.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.0, 0.0, 0.6, 0.6);
            vig2.fillRect(width / 2, 0, width / 2, height);

            // Crypt stone floor strip
            const floor = scene.add.graphics().setDepth(-2);
            floor.fillStyle(0x1a1025, 1);
            floor.fillRect(0, height - 60, width, 60);
            floor.lineStyle(2, 0x3a2050, 1);
            floor.strokeRect(0, height - 60, width, 60);

            // Border walls
            if (!scene.textures.get('platformertiles').has('crypt_brick')) {
                scene.textures.get('platformertiles').add('crypt_brick', 0, 0, 0, 16, 16);
            }
            const wallW = 48;
            scene.add.tileSprite(wallW / 2, height / 2, wallW, height, 'platformertiles', 'crypt_brick').setDepth(-1).setTileScale(2);
            scene.add.tileSprite(width - wallW / 2, height / 2, wallW, height, 'platformertiles', 'crypt_brick').setDepth(-1).setTileScale(2);
        },

        buildPlatforms(scene, width, height) {
            // Extract a solid stone brick tile from platformertiles (row 2, dark stone area)
            if (!scene.textures.get('platformertiles').has('crypt_plat')) {
                scene.textures.get('platformertiles').add('crypt_plat', 0, 0, 16, 16, 16);
            }

            const group = scene.physics.add.staticGroup();

            // ── Fixed layout ─────────────────────────────────────────────
            const plats = [
                makeTilePlat(scene, group, 'platformertiles', 'crypt_plat', width * 0.22, height - 160, 220, 2.0),
                makeTilePlat(scene, group, 'platformertiles', 'crypt_plat', width * 0.78, height - 220, 220, 2.0),
                makeTilePlat(scene, group, 'platformertiles', 'crypt_plat', width * 0.5, height - 380, 250, 2.0)
            ];

            // Brighter purple tint + white top-highlight
            const highlightCol = 0xcab2ff;
            plats.forEach(p => {
                p.setTint(highlightCol);
                const line = scene.add.graphics().setDepth(p.depth + 1);
                line.lineStyle(3, 0xffffff, 0.6);
                line.lineBetween(p.x - p.width/2, p.y - p.height/2 + 2, p.x + p.width/2, p.y - p.height/2 + 2);
            });

            return group;
        }
    }
};