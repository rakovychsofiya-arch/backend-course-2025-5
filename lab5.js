const { program } = require('commander');
const http = require('node:http');
const fs = require('node:fs').promises;
const path = require('node:path');
const fsSync = require('node:fs');
const superagent = require('superagent');
program
  .requiredOption('-h,--host <string>', 'Input IP adress of server')
  .requiredOption('-p,--port <number>', 'Input Port')
  .requiredOption('-c, --cache <path>', 'Input path ')
  .configureOutput({
    writeErr: () => { }
  });
program.exitOverride();

try {
  program.parse(process.argv);
} catch (err) {
  // Якщо не вказано обов'язкову опцію
  if (err.code === 'commander.missingMandatoryOptionValue' ||
    err.message.includes('required option')) {
    console.error('Please do required option');
    process.exit(1);
  }
  throw err;
}
const options = program.opts();

// --- НАЛАШТУВАННЯ КЕШУ 
const cachePath = path.resolve(options.cache);

console.log(`Перевірка директорії кешу: ${cachePath}`);
try {
  // 1. Перевіряємо, чи папка ВЖЕ ІСНУЄ
  if (!fsSync.existsSync(cachePath)) {
    // 2. Якщо ні - створюємо її
    fsSync.mkdirSync(cachePath, { recursive: true });
    console.log('Директорію кешу успішно створено.');
  } else {
    console.log('Директорія кешу вже існує.');
  }
} catch (err) {
  console.error(`Помилка при створенні директорії кешу: ${err.message}`);
  process.exit(1); // Не можемо запустити сервер без кешу
}
const server = http.createServer(async (req, res) => {
  console.log(`NEW REQUEST: ${req.method} ${req.url}`);
  const fileId = req.url.slice(1);

  const filePath = path.join(options.cache, fileId + '.jpeg');

  // --- (GET) ---

  if (req.method === 'GET') {
    try {
      const data = await fs.readFile(filePath)
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data); // Відправляємо дані (буфер) картинки
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Файл не знайдено - це очікувана помилка
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        // Інша, неочікувана помилка (напр. EACCES - немає прав)
        console.error('Помилка сервера при читанні файлу:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    }
    // --- (PUT) ---
  } else if (req.method === 'PUT') {

    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    req.on('end', async () => {
      const data = Buffer.concat(chunks);
      try {
        await fs.writeFile(filePath, data)
        res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Created');
      } catch (err) {
        console.error('Помилка сервера при записі файлу:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    });
    req.on('error', (err) => {
      console.error('Помилка запиту PUT:', err);
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
    });
    // --- (DELETE) ---

  } else if (req.method === 'DELETE') {
    try {
      const data = await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Не можемо видалити те, чого немає - це 404
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        // Інша помилка (немає прав на видалення тощо)
        console.error('Помилка сервера при видаленні файлу:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    }
  } else {

    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
  }
});
server.listen(options.port, options.host, () => {
  console.log(`Server running on http://${options.host}:${options.port}`);
});