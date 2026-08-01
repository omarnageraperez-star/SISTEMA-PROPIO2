const fs = require('fs');
const { execSync } = require('child_process');

const version = process.argv[2];
if (!version) {
  console.log("ERROR: Por favor, especifica una versión.");
  console.log("Ejemplo de uso: npm run release 1.0.5");
  process.exit(1);
}

// 1. Actualizar package.json
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// 2. Actualizar o crear .env para que Vite lea la versión
fs.writeFileSync('./.env', `VITE_APP_VERSION=${version}\n`);

console.log(`\n==============================================`);
console.log(`Versión configurada a: ${version}`);
console.log(`==============================================\n`);
console.log(`Iniciando compilación del instalador .exe...\n`);

try {
  execSync('npm run build-exe', { stdio: 'inherit' });
  console.log(`\n¡ÉXITO! Tu instalador está listo con el nombre: AGS SALES ERP Setup ${version}.exe`);
} catch (e) {
  console.log(`\nHubo un error durante la compilación.`);
}
