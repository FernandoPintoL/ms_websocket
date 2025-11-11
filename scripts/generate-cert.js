#!/usr/bin/env node

/**
 * Script para generar certificado auto-firmado para desarrollo
 * Uso: npm run generate-cert
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.join(__dirname, '../certs');

// Crear directorio de certificados si no existe
if (!existsSync(certDir)) {
  mkdirSync(certDir, { recursive: true });
  console.log(`✅ Directorio creado: ${certDir}`);
}

try {
  console.log('🔒 Generando certificado auto-firmado para desarrollo...\n');

  // Generar certificado auto-firmado con OpenSSL
  const cmd = `openssl req -x509 -newkey rsa:2048 -keyout "${path.join(certDir, 'key.pem')}" -out "${path.join(certDir, 'cert.pem')}" -days 3650 -nodes -subj "/CN=192.168.1.38"`;

  execSync(cmd, { stdio: 'inherit' });

  console.log('\n✅ Certificado generado exitosamente!');
  console.log(`📁 Ubicación: ${certDir}`);
  console.log('');
  console.log('⚠️  IMPORTANTE - Para usar en el navegador:');
  console.log('   1. Abre https://192.168.1.38:4004 en tu navegador');
  console.log('   2. Acepta la advertencia de certificado no confiable');
  console.log('   3. WebSocket usará wss:// automáticamente');
  console.log('');
  console.log('💡 Para otros dispositivos:');
  console.log('   - Usa la URL: https://192.168.1.38:4004');
  console.log('   - Y acepta el certificado auto-firmado');
  console.log('');
} catch (error) {
  console.error('❌ Error generando certificado:', error.message);
  console.error('');
  console.error('Asegúrate de tener OpenSSL instalado:');
  console.error('  - Windows: https://slproweb.com/products/Win32OpenSSL.html');
  console.error('  - macOS: brew install openssl');
  console.error('  - Linux: apt-get install openssl');
  process.exit(1);
}
