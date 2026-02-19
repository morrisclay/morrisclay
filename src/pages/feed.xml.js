export function GET() {
  const site = 'https://morrisclay.com';

  const posts = [
    {
      title: 'Shape Work',
      slug: 'shape-work',
      date: '2026-02-16',
      description: 'The most consequential decisions in frontier tech aren\u2019t about technology \u2014 they\u2019re about shape. Introducing shape work: the discipline of seeing the form a product takes when it meets the world.',
    },
    {
      title: 'The Shape of the Thing',
      slug: 'the-shape-of-the-thing',
      date: '2026-02-17',
      description: 'Why the most expensive mistake in frontier tech keeps happening by accident. When the container doesn\u2019t fit the thing inside it, nothing downstream works.',
    },
    {
      title: 'The Seven Shapes',
      slug: 'the-seven-shapes',
      date: '2026-02-24',
      description: 'A taxonomy of form. Every product holds seven shapes at once \u2014 imagined, founder, made, measured, felt, ruled, enacted. Naming them is how you start to see.',
    },
    {
      title: 'The Pull Between',
      slug: 'the-pull-between',
      date: '2026-02-25',
      description: 'What happens when shapes don\u2019t agree. The tension between competing shapes isn\u2019t a bug \u2014 it\u2019s where the real decisions live.',
    },
    {
      title: 'The Room',
      slug: 'the-room',
      date: '2026-02-26',
      description: 'The friction that compounds. When competing product shapes collide, the pressure produces something irreplaceable: taste.',
    },
    {
      title: 'The Drift',
      slug: 'the-drift',
      date: '2026-03-05',
      description: 'Shapes don\u2019t hold still. Understanding shape injection and temporal drift is essential to navigating how products change.',
    },
    {
      title: 'The Simplest Move',
      slug: 'the-simplest-move',
      date: '2026-03-02',
      description: 'What naming does. The most powerful move in shape work is the simplest: naming which shape the room is in.',
    },
    {
      title: 'Acquired Taste',
      slug: 'acquired-taste',
      date: '2026-03-04',
      description: 'What survives when execution gets cheap. Taste as accumulated capacity \u2014 built through years of friction, not aesthetic preference.',
    },
  ];

  const items = posts
    .map(
      (post) => `    <item>
      <title>${post.title}</title>
      <link>${site}/blog/${post.slug}</link>
      <guid isPermaLink="true">${site}/blog/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date + 'T12:00:00Z').toUTCString()}</pubDate>
    </item>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Morris Clay</title>
    <link>${site}</link>
    <description>Writing on shape work, frontier technology, and the forms products take when they meet the world.</description>
    <language>en</language>
    <atom:link href="${site}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
