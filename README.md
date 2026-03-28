4. The 5.5-Hour Hackathon Battle Plan
If you want to finish with a playable game, stick to this timeline ruthlessly.

Hour 0.0 – 0.5: Setup & Alignment

Person 1 runs the Initialization Prompt, pushes the repo to GitHub.

Everyone pulls the repo and runs npm install in the /server folder.

Verify everyone can run node server.js and see a blank index.html on localhost.

Hour 0.5 – 2.0: The Parallel Sprint (Isolated)

Person 1: Builds the Socket.io relay.

Person 2: Builds the Phaser arena, movement, and click-to-cast spells.

Person 3: Builds the audio recorder and proves the Gemini API returns the correct JSON.

Rule: Do not look at each other's code. Just get your piece working locally.

Hour 2.0 – 3.0: Integration Part 1 (The Cyborg Wizard)

Person 3 gives audio.js to Person 2.

Person 2 integrates it: Instead of clicking to cast, holding SHIFT slows the player down, records audio, gets the JSON from Gemini, and then fires the spell in Phaser based on the JSON result.

Goal: You have a single-player game where you can yell "Fireball!" and it shoots.

Hour 3.0 – 4.0: Integration Part 2 (Multiplayer Mayhem)

Person 2 hands the complete /client folder to Person 1.

Person 1 wires the Phaser events to the Socket.io events.

When Player 1 casts a spell locally, emit SPELL_CAST to the server. The server broadcasts it, and Player 2's Phaser engine renders the incoming spell.

Goal: Two browser windows open, moving independently, casting spells at each other.

Hour 4.0 – 5.0: Anomalies, Pickups, & Polish

Now that the core loop works, split up again.

One person adds the Map Pickups (Blood Vial, Demon Orb).

One person adds the Global Anomalies (Meteor Shower, Targeted Silence).

One person adds the "Fel Magic" backfire logic (if backfire: true, explode on the caster).

Hour 5.0 – 5.5: Code Freeze & Bug Squashing

Stop adding features.

Play the game. Fix the game-breaking bugs using the 05-systematic-debugging skill.

Hardcode some values if you have to. If the volume scaling is acting weird, scrap it and make all spells 1.0x scale. An MVP that works perfectly is better than a complex game that crashes.
