#!/usr/bin/env node
//
// Generate the same paragraph with multiple ElevenLabs voices for comparison.
//
// Usage:
//   ELEVENLABS_API_KEY=sk-... node scripts/voice-test.js
//

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY environment variable.');
  process.exit(1);
}

const TEXT = `Nobody shapes alone. The shape that actually ships is a negotiation between the founder's vision and everything else — the constraints of the technology, the expectations of the first design partner, the platform it runs on, the investor narrative that got the round closed. Some of these aren't even people — they're systems, habits, market structures. But they all participate.

And the negotiation never ends. Every major customer reshapes you. Every platform change reopens the question. The founders who navigate this well aren't the ones who found a shape early and locked it in. They're the ones who got good at the negotiation itself — who developed a feel for when the current shape is holding and when it's starting to crack.`;

const VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'adam' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'daniel' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'charlie' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'callum' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'josh' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'liam' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'george' },
  { id: 'ODq5zmih8GrVes37Dizd', name: 'patrick' },
];

const MODEL = 'eleven_multilingual_v2';

const outDir = join(process.cwd(), 'public', 'audio', 'voice-tests');
mkdirSync(outDir, { recursive: true });

console.log(`\n  Generating ${VOICES.length} voice samples...\n`);

// Run in batches of 3 to respect concurrency limit
async function runBatch(voices) {
  return Promise.allSettled(voices.map(voice => generateVoice(voice)));
}

async function generateVoice(voice) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: TEXT,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${voice.name}: API error (${res.status}): ${err}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = join(outDir, `${voice.name}.mp3`);
    writeFileSync(outPath, buf);
    const kb = (buf.length / 1024).toFixed(0);
    console.log(`  ✓ ${voice.name.padEnd(10)} ${kb} KB  →  ${outPath}`);
  return { voice: voice.name, size: buf.length };
}

const BATCH_SIZE = 3;
for (let i = 0; i < VOICES.length; i += BATCH_SIZE) {
  const batch = VOICES.slice(i, i + BATCH_SIZE);
  const results = await runBatch(batch);
  for (const r of results) {
    if (r.status === 'rejected') console.error(`  ✗ ${r.reason.message}`);
  }
}

console.log(`\n  Done. Files in ${outDir}\n`);
