import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, writeFileSync } from 'fs';

const pages = [
  { slug: 'home', title: 'Morris Clay', subtitle: 'Frontier tech investor at Lunar' },
  { slug: 'shape-work', title: 'Shape Work', subtitle: 'The discipline of seeing the form a product takes' },
  { slug: 'the-shape-of-the-thing', title: 'The Shape of\nthe Thing', subtitle: 'When the container doesn\u2019t fit the thing inside it' },
  { slug: 'the-seven-shapes', title: 'The Seven\nShapes', subtitle: 'A taxonomy of form' },
  { slug: 'the-pull-between', title: 'The Pull\nBetween', subtitle: 'What happens when shapes don\u2019t agree' },
  { slug: 'the-room', title: 'The Room', subtitle: 'The friction that compounds' },
  { slug: 'the-drift', title: 'The Drift', subtitle: 'Shapes don\u2019t hold still' },
  { slug: 'the-simplest-move', title: 'The Simplest\nMove', subtitle: 'What naming does' },
  { slug: 'acquired-taste', title: 'Acquired Taste', subtitle: 'What survives when execution gets cheap' },
];

function makeSvg({ title, subtitle, slug }) {
  const isHome = slug === 'home';
  const titleFontSize = isHome ? 64 : 72;
  const subtitleFontSize = 24;

  // Split title into lines for multi-line support
  const titleLines = title.split('\n');
  const lineHeight = titleFontSize * 1.15;
  const titleBlockHeight = titleLines.length * lineHeight;

  // Position title+subtitle block centered vertically
  const totalBlockHeight = titleBlockHeight + 48 + subtitleFontSize;
  const titleStartY = (630 - totalBlockHeight) / 2 + titleFontSize;

  const titleTspans = titleLines
    .map((line, i) => {
      const y = titleStartY + i * lineHeight;
      return `<tspan x="600" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const subtitleY = titleStartY + (titleLines.length - 1) * lineHeight + 48;

  // Generate a decorative shape based on slug
  const shapeMarkup = generateShape(slug);

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@300;400;500');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#f0ece4"/>

  <!-- Subtle border -->
  <rect x="32" y="32" width="1136" height="566" rx="4" fill="none" stroke="#cdc6b8" stroke-width="1"/>

  <!-- Decorative shape -->
  ${shapeMarkup}

  <!-- Title -->
  <text x="600" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="400" font-size="${titleFontSize}" fill="#2b2926" letter-spacing="0.02em">
    ${titleTspans}
  </text>

  <!-- Subtitle -->
  <text x="600" y="${subtitleY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="300" font-size="${subtitleFontSize}" fill="#918a7e" font-style="italic">
    ${escapeXml(subtitle)}
  </text>

  <!-- Author line -->
  <text x="600" y="580" text-anchor="middle" font-family="'Courier New', monospace" font-weight="300" font-size="13" fill="#918a7e" letter-spacing="0.15em" text-transform="uppercase">
    ${isHome ? 'MORRISCLAY.COM' : 'MORRIS CLAY'}
  </text>
</svg>`;
}

function generateShape(slug) {
  const cx = 600;
  const cy = 315;

  // Map slugs to different polygon vertex counts
  const shapeMap = {
    'home': 5,
    'shape-work': 6,
    'the-shape-of-the-thing': 4,
    'the-seven-shapes': 7,
    'the-pull-between': 3,
    'the-room': 8,
    'the-drift': 5,
    'the-simplest-move': 3,
    'acquired-taste': 6,
  };

  const n = shapeMap[slug] || 5;
  const r = 240;

  // Generate polygon points
  const points = [];
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }

  return `<polygon points="${points.join(' ')}" fill="none" stroke="rgba(92, 124, 90, 0.12)" stroke-width="1.5"/>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate all OG images
mkdirSync('public/og', { recursive: true });

for (const page of pages) {
  const svg = makeSvg(page);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: { loadSystemFonts: true },
  });
  const png = resvg.render().asPng();
  writeFileSync(`public/og/${page.slug}.png`, png);
  console.log(`  Generated: public/og/${page.slug}.png`);
}

console.log('Done — all OG images generated.');
