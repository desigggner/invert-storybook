import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/vladislav/Desktop/mcp';

function read(name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function write(name, data) {
  fs.writeFileSync(path.join(root, name), data, 'utf8');
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function minifyJs(js) {
  const lines = js.split(/\r?\n/);
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('//')) continue;
    out.push(line);
  }
  return out.join('\n');
}

function build() {
  const css = read('styles.css');
  const js = read('app.js');

  const cssMin = minifyCss(css);
  const jsMin = minifyJs(js);

  write('styles.min.css', cssMin + '\n');
  write('app.min.js', jsMin + '\n');

  const index = read('index.html')
    .replace(/href="styles\.css"/g, 'href="styles.min.css"')
    .replace(/src="app\.js"\s+defer/g, 'src="app.min.js" defer');

  write('index.prod.html', index);

  console.log('Built: styles.min.css, app.min.js, index.prod.html');
  console.log('Sizes:');
  console.log(' styles.css ->', css.length, 'chars');
  console.log(' styles.min.css ->', cssMin.length, 'chars');
  console.log(' app.js ->', js.length, 'chars');
  console.log(' app.min.js ->', jsMin.length, 'chars');
}

build();
