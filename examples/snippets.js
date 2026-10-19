// Starter designs for the playground. Each is the body of draw(ctx, width, height, t).
export const EXAMPLES = {
  'Watch face': `// A clock that updates every second: turn on "Re-run every 1000 ms"
// and watch partial refreshes change only the digits.
const now = new Date();
const hh = String(now.getHours()).padStart(2, '0');
const mm = String(now.getMinutes()).padStart(2, '0');
const ss = String(now.getSeconds()).padStart(2, '0');

ctx.textAlign = 'center';
ctx.font = 'bold 64px system-ui';
ctx.fillText(hh + ':' + mm, width / 2, height / 2 - 10);
ctx.font = '24px system-ui';
ctx.fillText(ss, width / 2, height / 2 + 30);

ctx.font = '16px system-ui';
ctx.fillText(now.toDateString(), width / 2, 40);

// status strip
ctx.fillRect(0, height - 28, width, 28);
ctx.fillStyle = '#fff';
ctx.font = '14px system-ui';
ctx.textAlign = 'left';
ctx.fillText('Wi-Fi  ▮▮▮', 10, height - 9);
ctx.textAlign = 'right';
ctx.fillText('87%', width - 10, height - 9);`,

  'List screen': `// A menu. Edit the selected index and re-run with a partial refresh
// to see how little of the panel moves (and the ghost the old bar leaves).
const items = ['Messages', 'Calls', 'Contacts', 'Departures', 'Timer', 'Settings'];
const selected = 2;
const rowHeight = 40;

ctx.font = 'bold 18px system-ui';
ctx.fillText('Apps', 12, 30);
ctx.fillRect(0, 42, width, 2);

ctx.font = '18px system-ui';
items.forEach((item, i) => {
  const y = 56 + i * rowHeight;
  if (i === selected) {
    ctx.fillRect(0, y, width, rowHeight);
    ctx.fillStyle = '#fff';
  }
  ctx.fillText(item, 16, y + 26);
  ctx.fillStyle = '#000';
});`,

  'Text and gray': `// Antialiased text becomes 1-bit. Compare thresholds and dithers
// for small type, and see how gray fills dither on paper.
ctx.font = '12px serif';
const lines = [
  'The quick brown fox jumps over the lazy dog.',
  'Small serif text at 12 px: check the threshold.',
  'Bold wins on e-paper; thin strokes break up.',
];
lines.forEach((line, i) => ctx.fillText(line, 8, 24 + i * 18));
ctx.font = 'bold 12px sans-serif';
lines.forEach((line, i) => ctx.fillText(line, 8, 90 + i * 18));

// gray ramp
for (let i = 0; i < 8; i++) {
  const v = Math.round((i / 7) * 255);
  ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
  ctx.fillRect(8 + i * ((width - 16) / 8), 150, (width - 16) / 8, 40);
}
ctx.fillStyle = '#000';
ctx.font = '12px sans-serif';
ctx.fillText('Gray ramp: switch Dither to bayer or floyd-steinberg', 8, 210);`,

  'Progress bar': `// Re-run every 200 ms: frequent partial updates build ghosting
// until the panel's automatic full refresh (fullEvery) cleans it.
const p = (t / 4000) % 1;
ctx.font = 'bold 20px system-ui';
ctx.fillText('Downloading…', 16, 60);
ctx.strokeStyle = '#000';
ctx.lineWidth = 2;
ctx.strokeRect(16, 80, width - 32, 24);
ctx.fillRect(18, 82, (width - 36) * p, 20);
ctx.font = '16px system-ui';
ctx.fillText(Math.round(p * 100) + '%', 16, 130);`,

  Blank: `// Start from scratch. Black ink on white paper; ctx is a 2D context.
ctx.font = 'bold 24px system-ui';
ctx.fillText('Hello, paper', 20, 50);`,
};
