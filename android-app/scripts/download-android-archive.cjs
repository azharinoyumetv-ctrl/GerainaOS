const { createHash } = require('node:crypto');
const { existsSync, statSync, writeFileSync, createReadStream, createWriteStream, readFileSync } = require('node:fs');
const { once } = require('node:events');
const [url, target, expectedSize, checksum] = process.argv.slice(2);
const total = Number(expectedSize);
if (!url?.startsWith('https://dl.google.com/android/repository/') || !target || !total || !checksum) throw new Error('Invalid Android archive parameters.');

async function digest(path) {
  const hash = createHash('sha1');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
(async () => {
  let offset = existsSync(target) ? statSync(target).size : 0;
  if (offset === total && await digest(target) === checksum) return;
  if (offset >= total) { writeFileSync(target, Buffer.alloc(0)); offset = 0; }
  const chunkSize = 1024 * 1024;
  const pieces = [];
  for (let start = offset; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, total - 1);
    pieces.push({ start, end, file: `${target}.part-${start}`, done: false });
  }
  let index = 0, downloaded = offset, announced = 0;
  const workers=Math.max(1,Math.min(12,Number(process.env.GERAINA_DOWNLOAD_WORKERS)||6));
  await Promise.all(Array.from({ length: workers }, async () => {
    while (index < pieces.length) {
      const piece = pieces[index++];
      const length = piece.end - piece.start + 1;
      if (!existsSync(piece.file) || statSync(piece.file).size !== length) {
        let succeeded = false;
        for (let attempt = 0; attempt < 3 && !succeeded; attempt++) {
          try {
            const response = await fetch(url, { headers: { Range: `bytes=${piece.start}-${piece.end}` }, signal: AbortSignal.timeout(90000) });
            if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${piece.start}-${piece.end}/${total}`) throw new Error('Unexpected archive range response.');
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length !== length) throw new Error('Incomplete archive range.');
            writeFileSync(piece.file, bytes); succeeded = true;
          } catch (error) { if (attempt === 2) throw error; }
        }
      }
      downloaded += length;
      const percent = Math.floor(downloaded / total * 100);
      if (percent >= announced + 10) { announced = percent; console.log(`Verified archive chunks downloaded: ${percent}%`); }
      piece.done = true;
    }
  }));
  const output = createWriteStream(target, { flags: 'a' });
  for (const piece of pieces) {
    if (!piece.done) throw new Error('Missing archive piece.');
    if (!output.write(readFileSync(piece.file))) await once(output, 'drain');
  }
  output.end(); await once(output, 'close');
  if (statSync(target).size !== total || await digest(target) !== checksum) throw new Error('Android archive checksum validation failed.');
  console.log('Complete Google archive checksum verified.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
