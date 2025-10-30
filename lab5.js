const {program}=require('commander');
const http = require('node:http');
const fs=require('fs');
const path = require('node:path');
program 
.requiredOption('-h,--host <string>','Input IP adress of server')
.requiredOption('-p,--port <number>','Input Port')
.requiredOption('-c, --cache <path>', 'Input path ')
.configureOutput({
    writeErr: () => {}  
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
const server = http.createServer(async(req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  //res.end('Server is running!');
});
server.listen(options.port, options.host, () => {
  console.log(`Server running on http://${options.host}:${options.port}`);
});