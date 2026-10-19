// Starter designs for the playground. Each is the body of
// draw(ctx, width, height, t, text, measure, wrap, lineHeight, fonts).
// Shapes: the canvas 2D API. Text: text(fontId, string, x, y, {align}) with the bundled
// bitmap fonts; x, y is the top-left of the line box. Never ctx.fillText (it antialiases).
export const EXAMPLES = {
  'Watch face': `// A clock that updates every second: turn on "Re-run every 1000 ms"
// and watch partial refreshes change only the digits.
const now = new Date();
const hh = String(now.getHours()).padStart(2, '0');
const mm = String(now.getMinutes()).padStart(2, '0');
const ss = String(now.getSeconds()).padStart(2, '0');

text('spleen-32x64', hh + ':' + mm, width / 2, height / 2 - 48, {align: 'center'});
text('terminus-24', ss, width / 2, height / 2 + 24, {align: 'center'});
text('terminus-16', now.toDateString(), width / 2, 24, {align: 'center'});

// status strip: white text on an ink bar
ctx.fillRect(0, height - 24, width, 24);
ctx.fillStyle = '#fff';
text('terminus-16-bold', 'Wi-Fi ▮▮▮', 8, height - 20);
text('terminus-16-bold', '87%', width - 8, height - 20, {align: 'right'});`,

  'List screen': `// A menu. Change the selected index and re-run with a partial refresh
// to see how little of the panel moves (and the ghost the old bar leaves).
const items = ['Messages', 'Calls', 'Contacts', 'Departures', 'Timer', 'Settings'];
const selected = 2;
const rowHeight = 32;

text('terminus-20-bold', 'Apps', 12, 8);
ctx.fillRect(0, 36, width, 2);

items.forEach((item, i) => {
  const y = 44 + i * rowHeight;
  if (i === selected) {
    ctx.fillRect(0, y, width, rowHeight);
    ctx.fillStyle = '#fff';
  }
  text('terminus-20', item, 16, y + 6);
  text('terminus-20', '›', width - 20, y + 6);
  ctx.fillStyle = '#000';
});`,

  'Font specimen': `// Every bundled face at its size. Which one reads best at arm's length?
let y = 4;
for (const id of Object.keys(fonts)) {
  if (y + lineHeight(id) > height) break;
  text(id, id + '  The quick brown fox 0123', 4, y);
  y += lineHeight(id) + 2;
}`,

  Paragraph: `// Word-wrapped body text with a bold heading and a gray (dithered) panel.
const body = 'E-paper holds an image without power, so a screen can stay on all day. ' +
  'But each change takes about half a second and leaves a faint ghost, and every few ' +
  'updates the panel must flash to clean itself. Design for few, deliberate changes.';
text('terminus-20-bold', 'About e-paper', 12, 10);
let y = 40;
for (const line of wrap('terminus-16', body, width - 24)) {
  text('terminus-16', line, 12, y);
  y += lineHeight('terminus-16');
}
// a gray box: switch Dither to bayer or floyd-steinberg to see it as a pattern
ctx.fillStyle = '#888';
ctx.fillRect(12, y + 12, width - 24, 40);
ctx.fillStyle = '#000';
text('terminus-14', 'gray fill → dither pattern', 20, y + 24);`,

  'Progress bar': `// Re-run every 200 ms: frequent partial updates build ghosting
// until the panel's automatic full refresh (fullEvery) cleans it.
const p = (t / 4000) % 1;
text('terminus-20-bold', 'Downloading…', 16, 40);
ctx.strokeStyle = '#000';
ctx.lineWidth = 2;
ctx.strokeRect(16, 80, width - 32, 24);
ctx.fillRect(18, 82, (width - 36) * p, 20);
text('terminus-16', Math.round(p * 100) + '%', 16, 116);`,

  Blank: `// Start from scratch. Black ink on white paper.
text('terminus-24-bold', 'Hello, paper', 20, 40);`,
};
