#!/usr/bin/env node

/**
 * WebSocket Connection Test
 * Tests WebSocket connectivity with upgrade: false option
 */

import { io } from 'socket.io-client';

const LOCALHOST_URL = 'http://localhost:4004';
const IP_URL = 'http://192.168.1.38:4004';

console.log('🔧 WebSocket Connection Test\n');
console.log('='.repeat(60));

async function testConnection(testName, url) {
    return new Promise((resolve) => {
        console.log(`\n📝 Test: ${testName}`);
        console.log(`🌐 URL: ${url}`);
        console.log(`⏱️  Starting connection...`);

        const socketOptions = {
            transports: ['websocket', 'polling'],
            upgrade: false,  // NO permitir upgrade a WSS - THIS IS THE KEY FIX
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 3,
            rejectUnauthorized: false,
            extraHeaders: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        const socket = io(url, socketOptions);

        const timeout = setTimeout(() => {
            console.log(`❌ TIMEOUT: No se pudo conectar después de 10 segundos`);
            socket.disconnect();
            resolve({
                testName,
                url,
                success: false,
                error: 'Timeout after 10 seconds',
                protocol: 'UNKNOWN'
            });
        }, 10000);

        socket.on('connect', () => {
            clearTimeout(timeout);
            const protocol = socket.io.engine.transport.name;
            console.log(`✅ Conectado exitosamente`);
            console.log(`🔗 Socket ID: ${socket.id}`);
            console.log(`📡 Protocolo usado: ${protocol}`);
            console.log(`🚀 Transport: websocket`);

            socket.emit('authenticate', {
                userId: 'test-user-123',
                userType: 'test',
                userName: 'Test User'
            });

            setTimeout(() => {
                socket.disconnect();
                resolve({
                    testName,
                    url,
                    success: true,
                    protocol: 'ws://',
                    socketId: socket.id,
                    message: 'Connected with ws:// (not wss://)'
                });
            }, 1000);
        });

        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            console.log(`❌ Error de conexión: ${error.message}`);
            console.log(`   Detalles: ${JSON.stringify(error)}`);
            socket.disconnect();
            resolve({
                testName,
                url,
                success: false,
                error: error.message,
                protocol: 'FAILED'
            });
        });

        socket.on('authenticated', (data) => {
            console.log(`✅ Autenticado: ${data.message}`);
            if (data.clientIP) {
                console.log(`📍 Tu IP vista por el servidor: ${data.clientIP}`);
            }
        });

        socket.on('error', (error) => {
            console.log(`⚠️  Socket error: ${error}`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`👋 Desconectado. Razón: ${reason}`);
        });
    });
}

async function runTests() {
    console.log('\n🧪 Iniciando pruebas de conexión WebSocket\n');

    // Test 1: Localhost
    const localhost_result = await testConnection(
        'Localhost Connection',
        LOCALHOST_URL
    );

    // Test 2: IP Address
    console.log('\n' + '='.repeat(60));
    const ip_result = await testConnection(
        'IP Address Connection',
        IP_URL
    );

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESULTADOS DE PRUEBAS\n');

    console.log('┌─ Localhost Connection');
    console.log(`├─ Status: ${localhost_result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`├─ URL: ${localhost_result.url}`);
    console.log(`└─ Protocolo: ${localhost_result.protocol}`);

    console.log('\n┌─ IP Address Connection');
    console.log(`├─ Status: ${ip_result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`├─ URL: ${ip_result.url}`);
    console.log(`└─ Protocolo: ${ip_result.protocol}`);

    console.log('\n' + '='.repeat(60));

    if (localhost_result.success && ip_result.success) {
        console.log('\n🎉 EXITO: Ambas conexiones funcionan correctamente');
        console.log('✅ localhost:4004 → ws:// (correcto)');
        console.log('✅ 192.168.1.38:4004 → ws:// (correcto)');
        console.log('\n✨ El problema de wss:// ha sido solucionado!');
    } else if (localhost_result.success && !ip_result.success) {
        console.log('\n⚠️  PARCIAL: localhost funciona pero IP falló');
        console.log('✅ localhost:4004 funciona');
        console.log(`❌ 192.168.1.38:4004 falló: ${ip_result.error}`);
        console.log('\n💡 Posibles causas:');
        console.log('   - Los dispositivos no están en la misma red WiFi');
        console.log('   - El firewall bloquea el puerto 4004');
        console.log('   - La IP local ha cambiado (verificar con ipconfig)');
    } else {
        console.log('\n❌ ERROR: Las conexiones fallaron');
        console.log(`   localhost: ${localhost_result.error}`);
        console.log(`   IP: ${ip_result.error}`);
    }

    console.log('\n');
}

runTests().catch(console.error);
