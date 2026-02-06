#!/usr/bin/env node
//
// Generate audio narration for blog posts using ElevenLabs TTS.
// Extracts text from the agent-view (clean prose), sends to ElevenLabs,
// and saves the MP3 to public/audio/<slug>.mp3.
//
// Usage:
//   ELEVENLABS_API_KEY=sk-... node scripts/generate-audio.js src/pages/blog/post.html
//
// Options:
//   --voice ID    ElevenLabs voice ID (default: Adam — pNInz6obpgDQGcFmaJgB)
//   --model ID    Model ID (default: eleven_multilingual_v2)
//   --list-voices Print available voices and exit

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, join, resolve } from 'path';

const CHUNK_LIMIT = 4500;
const DEFAULT_VOICE = 'TX3LPaxmHKxFdv7VOQHJ'; // Liam
const DEFAULT_MODEL = 'eleven_multilingual_v2';

// ——— CLI ———

const args = process.argv.slice(2);
const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY environment variable.');
  process.exit(1);
}

if (args.includes('--list-voices')) {
  await listVoices(apiKey);
  process.exit(0);
}

let voiceId = DEFAULT_VOICE;
let modelId = DEFAULT_MODEL;
const files = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--voice' && args[i + 1]) { voiceId = args[++i]; continue; }
  if (args[i] === '--model' && args[i + 1]) { modelId = args[++i]; continue; }
  files.push(args[i]);
}

if (!files.length) {
  console.log('Usage: node scripts/generate-audio.js <blog-post.html> [options]');
  console.log('');
  console.log('  ELEVENLABS_API_KEY=...   Required env var');
  console.log('  --voice ID              Voice ID (default: Adam)');
  console.log('  --model ID              Model ID (default: eleven_multilingual_v2)');
  console.log('  --list-voices           Print available voices');
  process.exit(0);
}

for (const file of files) {
  await generate(resolve(file), apiKey, voiceId, modelId);
}

// ——— Text extraction ———

function extractText(htmlPath) {
  const html = readFileSync(htmlPath, 'utf-8');

  const blocks = [];
  const re = /<(?:div|span) class="md-(?:h1|sub|p)"[^>]*>([\s\S]*?)<\/(?:div|span)>/g;
  let m;

  while ((m = re.exec(html)) !== null) {
    let text = m[1]
      .replace(/<[^>]+>/g, '')            // strip nested HTML tags
      .replace(/\*\*(.+?)\*\*/g, '$1')   // strip **bold**
      .replace(/\*(.+?)\*/g, '$1')       // strip *italic*
      .replace(/^#\s+/, '')              // strip heading marker
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, ' ')
      .replace(/&thinsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

    if (text) blocks.push(text);
  }

  if (!blocks.length) {
    throw new Error(`No agent-view content found in ${htmlPath}`);
  }

  // Add periods to title/subtitle/byline so TTS pauses between them
  const bylineIdx = blocks.findIndex(b => /\d{4}$/.test(b));
  for (let i = 0; i <= Math.max(bylineIdx, 1); i++) {
    if (blocks[i] && !/[.!?]$/.test(blocks[i])) {
      blocks[i] += '.';
    }
  }

  // Insert automated-voice disclaimer after the byline
  if (bylineIdx !== -1) {
    blocks.splice(bylineIdx + 1, 0, 'This text is read by an automated voice.');
  }

  return blocks.join('\n\n');
}

// ——— Chunking ———

function chunkText(text, limit) {
  if (text.length <= limit) return [text];

  const paragraphs = text.split('\n\n');
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current && (current.length + para.length + 2) > limit) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ——— Generation ———

async function generate(htmlPath, apiKey, voiceId, modelId) {
  const slug = basename(htmlPath, '.html');

  console.log(`\n  ${basename(htmlPath)}`);

  const text = extractText(htmlPath);
  console.log(`  ${text.length} characters extracted`);

  const chunks = chunkText(text, CHUNK_LIMIT);
  if (chunks.length > 1) console.log(`  Split into ${chunks.length} chunks`);

  const buffers = [];

  for (let i = 0; i < chunks.length; i++) {
    const label = chunks.length > 1 ? ` (chunk ${i + 1}/${chunks.length})` : '';
    process.stdout.write(`  Generating audio${label}...`);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: chunks[i],
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      console.log(' failed');
      const err = await res.text();
      throw new Error(`ElevenLabs API error (${res.status}): ${err}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    buffers.push(buf);
    console.log(` ${(buf.length / 1024).toFixed(0)} KB`);
  }

  const outDir = join(process.cwd(), 'public', 'audio');
  mkdirSync(outDir, { recursive: true });

  const outPath = join(outDir, `${slug}.mp3`);
  const combined = Buffer.concat(buffers);
  writeFileSync(outPath, combined);

  const sizeMB = (combined.length / 1024 / 1024).toFixed(1);
  console.log(`  Saved ${outPath} (${sizeMB} MB)`);
}

// ——— Utility ———

async function listVoices(apiKey) {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error (${res.status}): ${err}`);
  }

  const { voices } = await res.json();
  console.log('\nAvailable voices:\n');
  for (const v of voices) {
    const labels = v.labels ? Object.values(v.labels).join(', ') : '';
    console.log(`  ${v.voice_id}  ${v.name}${labels ? '  (' + labels + ')' : ''}`);
  }
}
