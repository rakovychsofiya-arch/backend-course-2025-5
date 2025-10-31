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
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  console.log(`NEW REQUEST: ${req.method} ${req.url}`);
  const fileId = req.url.slice(1);

  if (!fileId) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const filePath = path.join(cachePath, fileId + '.jpeg');

  // --- (GET) з логікою http.cat ---
  if (req.method === 'GET') {
    try {
      // 1. Намагаємось прочитати файл з кешу
      const data = await fs.readFile(filePath);
      console.log(`Беремо ${fileId} з кешу`);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 2. Файлу немає. ІДЕМО В ІНТЕРНЕТ

        try {
          const catUrl = `https://http.cat/${fileId}`;
          console.log(`Кешу немає. Роблю запит на: ${catUrl}`);


          const response = await superagent.get(catUrl).buffer(true);


          if (response.type === 'image/jpeg') {
            const imageData = response.body;


            await fs.writeFile(filePath, imageData);
            console.log(`Зберіг картинку в кеш: ${filePath}`);


            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            res.end(imageData);
          } else {

            throw new Error('http.cat did not return an image.');
          }
        } catch (httpErr) {

          console.error(`Помилка під час запиту до http.cat: ${httpErr.message}`);
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
        }
      } else {
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
        await fs.writeFile(filePath, data);
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
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        console.error('Помилка сервера при видаленні файлу:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
    }

    // --- (ІНШІ МЕТОДИ) ---
  } else {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Server running on http://${options.host}:${options.port}`);
});