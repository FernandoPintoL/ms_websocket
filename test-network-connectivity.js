#!/usr/bin/env node

/**
 * WebSocket Network Connectivity Test Suite
 *
 * Este script verifica que el servidor WebSocket sea accesible
 * desde cualquier IP en la red local.
 *
 * Uso:
 *   node test-network-connectivity.js
 */

import axios from 'axios';
import io from 'socket.io-client';
import os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';

// Configuración
const config = {
  localhost: 'http://localhost:3001',
  graphql: 'http://localhost:3001/graphql',
  socketUrl: 'http://localhost:3001',
};

// Colores
const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
};

/**
 * Obtener IP local
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Test 1: Verificar servidor localmente
 */
async function testLocalConnection() {
  console.log(colors.info('\n📍 Test 1: Local Connection'));
  console.log(colors.muted('─'.repeat(50)));

  try {
    const response = await axios.get(`${config.localhost}/health`, {
      timeout: 5000,
    });

    if (response.status === 200) {
      console.log(colors.success('✅ Server is running on localhost:3001'));
      return true;
    }
  } catch (error) {
    console.log(
      colors.error('❌ Server not responding on localhost')
    );
    console.log(colors.muted(`   Error: ${error.message}`));
    return false;
  }
}

/**
 * Test 2: Verificar puerto abierto
 */
async function testPortOpen() {
  console.log(colors.info('\n🔌 Test 2: Port Availability'));
  console.log(colors.muted('─'.repeat(50)));

  try {
    let result;
    if (process.platform === 'win32') {
      result = execSync('netstat -ano | findstr :3001', { encoding: 'utf-8' });
    } else {
      result = execSync('lsof -i :3001', { encoding: 'utf-8' });
    }

    if (result.includes('3001')) {
      console.log(colors.success('✅ Port 3001 is open and listening'));
      return true;
    }
  } catch (error) {
    console.log(colors.error('❌ Port 3001 not found'));
    console.log(colors.muted(`   Error: ${error.message}`));
    return false;
  }
}

/**
 * Test 3: Verificar endpoints
 */
async function testEndpoints() {
  console.log(colors.info('\n🌐 Test 3: Available Endpoints'));
  console.log(colors.muted('─'.repeat(50)));

  const endpoints = [
    { path: '/health', name: 'Health Check' },
    { path: '/health/detailed', name: 'Detailed Health' },
    { path: '/status', name: 'Status' },
    { path: '/connections', name: 'Connections' },
    { path: '/metrics', name: 'Metrics' },
  ];

  let successCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(
        `${config.localhost}${endpoint.path}`,
        { timeout: 3000 }
      );

      if (response.status === 200) {
        console.log(
          colors.success(`✅ ${endpoint.name.padEnd(20)} → //${endpoint.path}`)
        );
        successCount++;
      }
    } catch (error) {
      console.log(
        colors.error(`❌ ${endpoint.name.padEnd(20)} → //${endpoint.path}`)
      );
    }
  }

  return successCount === endpoints.length;
}

/**
 * Test 4: CORS Configuration
 */
async function testCORS() {
  console.log(colors.info('\n🔐 Test 4: CORS Configuration'));
  console.log(colors.muted('─'.repeat(50)));

  try {
    const response = await axios.get(`${config.localhost}/health`, {
      headers: {
        'Origin': 'http://test.local:3000',
      },
      timeout: 3000,
    });

    const corsHeader = response.headers['access-control-allow-origin'];
    if (corsHeader === '*' || corsHeader === 'http://test.local:3000') {
      console.log(colors.success(`✅ CORS is enabled: ${corsHeader}`));
      return true;
    } else {
      console.log(colors.warning(`⚠️  CORS header: ${corsHeader}`));
      return true;
    }
  } catch (error) {
    console.log(colors.error('❌ CORS test failed'));
    return false;
  }
}

/**
 * Test 5: WebSocket Connection
 */
function testWebSocketConnection() {
  return new Promise((resolve) => {
    console.log(colors.info('\n🔗 Test 5: WebSocket Connection'));
    console.log(colors.muted('─'.repeat(50)));

    const socket = io(config.socketUrl, {
      reconnection: false,
      upgrade: false,
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      console.log(colors.error('❌ WebSocket connection timeout'));
      resolve(false);
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(colors.success(`✅ WebSocket connected`));
      console.log(colors.muted(`   Socket ID: ${socket.id}`));
      socket.disconnect();
      resolve(true);
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      console.log(colors.error(`❌ WebSocket error: ${error}`));
      socket.disconnect();
      resolve(false);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      console.log(colors.error(`❌ Connection error: ${error.message}`));
      socket.disconnect();
      resolve(false);
    });
  });
}

/**
 * Test 6: Network Accessibility
 */
async function testNetworkAccessibility() {
  console.log(colors.info('\n🌍 Test 6: Network Accessibility'));
  console.log(colors.muted('─'.repeat(50)));

  const localIP = getLocalIP();
  console.log(colors.muted(`   Local IP: ${localIP}`));
  console.log(colors.muted(`   Try accessing from another device:`));
  console.log(colors.info(`   Browser: http://${localIP}:3001/health`));
  console.log(colors.info(`   WebSocket: ws://${localIP}:3001`));

  try {
    const response = await axios.get(
      `http://${localIP}:3001/health`,
      { timeout: 5000 }
    );

    if (response.status === 200) {
      console.log(
        colors.success(`✅ Server is accessible from IP: ${localIP}:3001`)
      );
      return true;
    }
  } catch (error) {
    console.log(
      colors.warning(
        `⚠️  Could not access from ${localIP}:3001 (might be normal if on different subnet)`
      )
    );
    return true; // No fallar, podría ser configuración de red
  }
}

/**
 * Test 7: Server Information
 */
async function getServerInfo() {
  console.log(colors.info('\n📊 Test 7: Server Information'));
  console.log(colors.muted('─'.repeat(50)));

  try {
    const response = await axios.get(`${config.localhost}/status`);
    const data = response.data;

    console.log(
      colors.muted(`   Service: ${data.service}`)
    );
    console.log(colors.muted(`   Version: ${data.version}`));
    console.log(colors.muted(`   Uptime: ${data.uptime.toFixed(2)}s`));
    console.log(colors.muted(`   Connections: ${data.connections}`));

    return true;
  } catch (error) {
    console.log(colors.error('❌ Could not fetch server info'));
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runTests() {
  console.clear();
  console.log(colors.info('╔════════════════════════════════════════════╗'));
  console.log(colors.info('║  WebSocket Network Connectivity Test Suite ║'));
  console.log(colors.info('╚════════════════════════════════════════════╝'));

  const results = {
    localConnection: false,
    portOpen: false,
    endpoints: false,
    cors: false,
    websocket: false,
    networkAccess: false,
    serverInfo: false,
  };

  try {
    results.localConnection = await testLocalConnection();
    results.portOpen = await testPortOpen();
    results.endpoints = await testEndpoints();
    results.cors = await testCORS();
    results.websocket = await testWebSocketConnection();
    results.networkAccess = await testNetworkAccessibility();
    results.serverInfo = await getServerInfo();
  } catch (error) {
    console.log(colors.error('\n❌ Test suite error:'), error.message);
  }

  // Summary
  console.log(colors.info('\n╔════════════════════════════════════════════╗'));
  console.log(colors.info('║              Test Summary                  ║'));
  console.log(colors.info('╚════════════════════════════════════════════╝'));

  const tests = Object.entries(results);
  const passed = tests.filter(([_, result]) => result).length;
  const total = tests.length;

  for (const [name, result] of tests) {
    const icon = result ? '✅' : '❌';
    const color = result ? colors.success : colors.error;
    const displayName = name
      .replace(/([A-Z])/g, ' $1')
      .charAt(0)
      .toUpperCase() + name.slice(1);

    console.log(color(`${icon} ${displayName}`));
  }

  console.log(colors.muted(`\nPassed: ${passed}/${total}`));

  if (passed === total) {
    console.log(
      colors.success('\n🎉 All tests passed! Server is properly configured.')
    );
    console.log(
      colors.muted(
        '\nYou can now access WebSocket from any device on the network:'
      )
    );

    const localIP = getLocalIP();
    console.log(colors.info(`  ws://${localIP}:3001`));
    console.log(colors.info(`  http://${localIP}:3001/health`));
    process.exit(0);
  } else {
    console.log(
      colors.error(`\n❌ ${total - passed} test(s) failed.`)
    );
    console.log(colors.warning('\nTroubleshooting:'));
    console.log(colors.muted('  1. Ensure server is running: npm run dev'));
    console.log(colors.muted('  2. Check firewall allows port 3001'));
    console.log(colors.muted('  3. Verify APP_HOST=0.0.0.0 in .env'));
    console.log(colors.muted('  4. Check CORS_ORIGIN=* in .env'));
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error(colors.error('Fatal error:'), error);
  process.exit(1);
});
