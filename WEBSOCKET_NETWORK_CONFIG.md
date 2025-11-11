# 🌐 Configuración de WebSocket para Red Local - Acceso desde Cualquier IP

## Estado Actual ✅

Tu servidor WebSocket **YA ESTÁ CORRECTAMENTE CONFIGURADO** para ser accesible desde cualquier IP en la red.

```javascript
// Línea 439 en server.js
const HOST = process.env.APP_HOST || '0.0.0.0';

// Línea 441
httpServer.listen(PORT, HOST, () => {
  logger.info({
    host: HOST,
    port: PORT,
    ...
  }, 'Server started successfully');
});
```

### ✅ Configuración Correcta Verificada

| Parámetro | Valor | Estado |
|-----------|-------|--------|
| **HOST** | `0.0.0.0` | ✅ Correcto |
| **PORT** | `3001` (o `APP_PORT`) | ✅ Configurable |
| **CORS** | `*` | ✅ Abierto |
| **Transport** | WebSocket + Polling | ✅ Híbrido |

---

## Cómo Acceder Desde Otras IPs

### 1. Obtener tu IP Local

#### Windows
```bash
ipconfig

# Busca la sección "Ethernet adapter" o "Conexión de área local"
# IPv4 Address: 192.168.X.X o 10.0.X.X
```

#### macOS / Linux
```bash
ifconfig

# o

ip addr show
```

**Ejemplo de salida esperada:**
```
eth0: flags=UP,BROADCAST,RUNNING,MULTICAST
  inet 192.168.1.100  netmask 255.255.255.0
```

### 2. Verificar que el Server Está Escuchando

```bash
# Ver todos los puertos abiertos
netstat -an | findstr LISTENING    # Windows
netstat -tuln | grep 3001           # Linux/Mac

# Debería mostrar:
# 0.0.0.0:3001 LISTENING
```

### 3. Probar la Conexión Desde otra PC/Dispositivo

#### A. Prueba HTTP Simple
```bash
# Reemplaza 192.168.1.100 con tu IP local
curl http://192.168.1.100:3001/health

# Respuesta esperada:
# {
#   "status": "ok",
#   "service": "ms-websocket",
#   "timestamp": "2024-11-11T..."
# }
```

#### B. Ver Conexiones Activas
```bash
# Desde otra PC
curl http://192.168.1.100:3001/connections

# Deberías ver todas las conexiones conectadas
```

#### C. Probar WebSocket con Cliente Simple

**Cliente de prueba con Node.js:**

```javascript
// test-ws-client.js
const io = require('socket.io-client');

const socket = io('http://192.168.1.100:3001', {
  auth: {
    token: 'test-token'
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('✅ Conectado al servidor WebSocket');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado:', reason);
});

socket.on('error', (error) => {
  console.log('⚠️ Error:', error);
});

socket.on('connect_error', (error) => {
  console.log('⚠️ Error de conexión:', error.message);
});

setTimeout(() => {
  socket.disconnect();
}, 5000);
```

Ejecutar:
```bash
npm install socket.io-client
node test-ws-client.js
```

#### D. Probar WebSocket con Flutter

Actualiza `.env` en tu app Flutter:

```env
FLUTTER_ENV=development
GRAPHQL_HOST=192.168.1.100
GRAPHQL_PORT=3001
GRAPHQL_WS_URL=ws://192.168.1.100:3001/graphql
GRAPHQL_ENDPOINT=/graphql
```

---

## Arquitectura de Red - Cómo Funciona

```
┌─────────────────────────────────────────────────────────────┐
│                        RED LOCAL                            │
│                    (192.168.1.0/24)                         │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │  PC Desktop          │      │  Android Phone       │   │
│  │  192.168.1.100       │      │  192.168.1.105       │   │
│  │                      │      │                      │   │
│  │  ┌────────────────┐  │      │  ┌────────────────┐  │   │
│  │  │ Node.js Server │  │      │  │  Flutter App   │  │   │
│  │  │ (Puerto 3001)  │  │      │  │  WebSocket     │  │   │
│  │  └────────────────┘  │      │  │  Client        │  │   │
│  └──────────────────────┘      └──────────────────────┘   │
│          ▲                              ▲                   │
│          │  WebSocket                   │                   │
│          │  ws://192.168.1.100:3001     │ WebSocket        │
│          └──────────────────────────────┘                   │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │  iOS iPhone          │      │  Tablet/Laptop       │   │
│  │  192.168.1.110       │      │  192.168.1.115       │   │
│  │                      │      │                      │   │
│  │  ┌────────────────┐  │      │  ┌────────────────┐  │   │
│  │  │  Flutter App   │  │      │  │    Browser     │   │   │
│  │  │  (WebSocket)   │  │      │  │  (GraphQL)     │   │   │
│  │  └────────────────┘  │      │  └────────────────┘   │   │
│  └──────────────────────┘      └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Variables de Entorno - Configuración Completa

### .env Actual (Correcto) ✅
```env
NODE_ENV=development
APP_HOST=0.0.0.0           # Escucha en todas las interfaces
APP_PORT=3001              # Puerto

REDIS_HOST=localhost
REDIS_PORT=6379

CORS_ORIGIN=*              # Permite todos los orígenes

GRAPHQL_ENABLED=true
GRAPHQL_ENDPOINT=/graphql

WS_HEARTBEAT_INTERVAL=30000
WS_HEARTBEAT_TIMEOUT=5000
```

### .env para Producción (Seguro)
```env
NODE_ENV=production
APP_HOST=0.0.0.0           # Sigue escuchando en todas interfaces
APP_PORT=3001

REDIS_HOST=redis.tudominio.com
REDIS_PORT=6379
REDIS_PASSWORD=strong_password

# IMPORTANTE: Especificar orígenes seguros
CORS_ORIGIN=https://tudominio.com,https://app.tudominio.com,wss://tudominio.com

GRAPHQL_ENABLED=true
GRAPHQL_ENDPOINT=/graphql

WS_HEARTBEAT_INTERVAL=30000
WS_HEARTBEAT_TIMEOUT=5000
```

---

## Checklist de Verificación - Red Local

### ✅ Paso 1: Verificar Servidor Ejecutándose
```bash
# En la carpeta del servidor
npm run dev

# Deberías ver:
# [info] Server started successfully
# {
#   "host": "0.0.0.0",
#   "port": 3001,
#   "environment": "development"
# }
```

### ✅ Paso 2: Verificar Escucha en 0.0.0.0
```bash
# Windows
netstat -ano | findstr :3001

# Esperado:
# TCP    0.0.0.0:3001           0.0.0.0:0              LISTENING       12345

# Linux/Mac
lsof -i :3001

# Esperado:
# node    12345   user   12u  IPv4  0x1234567   0t0    TCP *:3001 (LISTEN)
```

### ✅ Paso 3: Obtener IP Local
```bash
# Windows
ipconfig | findstr IPv4

# Linux/Mac
hostname -I

# Guardar tu IP local (ejemplo: 192.168.1.100)
```

### ✅ Paso 4: Probar Health Check desde Red
```bash
# Desde otra PC en la red (reemplaza IP)
curl http://192.168.1.100:3001/health

# Esperado: 200 OK con JSON
```

### ✅ Paso 5: Probar Conexiones desde Red
```bash
curl http://192.168.1.100:3001/connections

# Deberías ver lista de conexiones activas
```

### ✅ Paso 6: Probar Status desde Red
```bash
curl http://192.168.1.100:3001/status

# Esperado:
# {
#   "status": "ok",
#   "service": "ms-websocket",
#   "connections": N
# }
```

---

## Solución de Problemas - No Puedo Conectar

### ❌ Problema: "Connection Refused"

```
Síntoma: ERR_CONNECTION_REFUSED o ECONNREFUSED
```

**Soluciones en orden:**

1. **¿El server está corriendo?**
   ```bash
   # Verificar server está activo
   curl http://localhost:3001/health

   # Si falla, iniciar servidor:
   npm run dev
   ```

2. **¿Puerto 3001 está abierto?**
   ```bash
   # Windows
   netstat -ano | findstr :3001

   # Linux/Mac
   lsof -i :3001

   # Si no aparece, el server no está escuchando
   ```

3. **¿Firewall bloquea el puerto?**

   **Windows:**
   - Ir a: Control Panel → Windows Defender Firewall → Allow an app
   - Buscar "Node.js" o agregarlo manualmente
   - Puerto 3001 debe permitir entrada/salida

   **Linux:**
   ```bash
   sudo ufw allow 3001
   sudo ufw allow 3001/tcp
   sudo ufw allow 3001/udp
   ```

   **macOS:**
   ```bash
   # Firewall → Options
   # Permitir: Node.js
   # O permitir puerto 3001
   ```

4. **¿IP local es correcta?**
   ```bash
   # Verificar tu IP
   ipconfig          # Windows
   ifconfig          # Mac
   ip addr show      # Linux

   # Luego probar:
   curl http://192.168.X.X:3001/health
   ```

### ❌ Problema: "WebSocket Connection Failed"

```
Síntoma: Error handshake ws://192.168.1.100:3001
```

**Soluciones:**

1. **CORS no permite el origen**
   ```env
   # En .env, cambia:
   CORS_ORIGIN=*  # Permite todos temporalmente para testing

   # Reinicia servidor
   npm run dev
   ```

2. **WebSocket Upgrade falla**
   ```bash
   # Verificar headers con curl verbose
   curl -v http://192.168.1.100:3001/health

   # Deberías ver: Connection: keep-alive
   ```

3. **Proxy o NAT interfiere**
   - Si estás tras proxy, configura:
   ```env
   CORS_ORIGIN=*
   WS_HEARTBEAT_INTERVAL=60000  # Aumentar heartbeat
   ```

### ❌ Problema: "Timeout"

```
Síntoma: Conexión se abre pero nunca completa
```

**Soluciones:**

1. **Firewall bloquea conexión persistente**
   - Permitir conexiones entrantes/salientes en puerto 3001

2. **Heartbeat muy agresivo**
   ```env
   # Aumentar timeouts
   WS_HEARTBEAT_INTERVAL=60000   # 60 segundos
   WS_HEARTBEAT_TIMEOUT=10000    # 10 segundos
   ```

3. **MTU muy pequeño**
   - En router/firewall, verificar MTU es 1500

---

## Caso de Uso: Múltiples Dispositivos en Red

### Escenario: 1 Servidor + 5 Clientes

```
Servidor (PC con ms_websocket):
IP: 192.168.1.100
Puerto: 3001
Status: Running ✅

Clientes conectados:
├─ Android Phone (192.168.1.105): ws://192.168.1.100:3001
├─ iPhone (192.168.1.110): ws://192.168.1.100:3001
├─ Android Tablet (192.168.1.111): ws://192.168.1.100:3001
├─ Web Browser (192.168.1.115): http://192.168.1.100:3001/graphql
└─ Node.js Client (192.168.1.120): ws://192.168.1.100:3001
```

### Pasos a Seguir:

#### 1. En el Servidor (PC)

```bash
# Obtener IP local
ipconfig | findstr IPv4
# Resultado: IPv4 Address: 192.168.1.100

# Iniciar servidor
npm run dev

# Debería mostrar:
# Server started successfully
# { host: "0.0.0.0", port: 3001 }
```

#### 2. En Cada Cliente

**Android/iOS (Flutter):**
```env
GRAPHQL_HOST=192.168.1.100
GRAPHQL_PORT=3001
GRAPHQL_WS_URL=ws://192.168.1.100:3001/graphql
```

**Node.js:**
```javascript
const io = require('socket.io-client');
const socket = io('http://192.168.1.100:3001');
```

**Browser Web:**
```javascript
const client = new ApolloClient({
  link: new WebSocketLink({
    uri: 'ws://192.168.1.100:3001/graphql',
  }),
});
```

#### 3. Verificar Conexiones

```bash
# Desde servidor
curl http://localhost:3001/connections

# Debería mostrar 5 conexiones activas
```

---

## Script de Prueba Automática

Crea `test-network.sh`:

```bash
#!/bin/bash

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Tu IP local - CAMBIA ESTO
SERVER_IP="192.168.1.100"
SERVER_PORT="3001"

echo "╔════════════════════════════════════════════╗"
echo "║     Network Configuration Test Suite       ║"
echo "╚════════════════════════════════════════════╝"

echo ""
echo "Target: ws://$SERVER_IP:$SERVER_PORT"
echo ""

# Test 1: Local connection
echo -n "Test 1 - Local Connection: "
if curl -s http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
  exit 1
fi

# Test 2: Network connection
echo -n "Test 2 - Network Connection: "
if curl -s http://$SERVER_IP:$SERVER_PORT/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FAILED - Server not reachable from network${NC}"
  exit 1
fi

# Test 3: CORS enabled
echo -n "Test 3 - CORS Configuration: "
if curl -s -H "Origin: http://test.com" http://$SERVER_IP:$SERVER_PORT/health | grep -q "status"; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
fi

# Test 4: Get connections count
echo -n "Test 4 - Connections Endpoint: "
CONN=$(curl -s http://$SERVER_IP:$SERVER_PORT/connections | jq '.totalConnections' 2>/dev/null)
if [ ! -z "$CONN" ]; then
  echo -e "${GREEN}✅ OK (${CONN} connections)${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
fi

# Test 5: GraphQL endpoint
echo -n "Test 5 - GraphQL Endpoint: "
if curl -s -X GET http://$SERVER_IP:$SERVER_PORT/graphql > /dev/null 2>&1; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${YELLOW}⚠️ Not accessible via GET (expected)${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          All Tests Completed!              ║"
echo "╚════════════════════════════════════════════╝"
```

Ejecutar:
```bash
chmod +x test-network.sh
./test-network.sh
```

---

## Endpoints Disponibles para Prueba

| Endpoint | Método | Descripción | Ejemplo |
|----------|--------|-------------|---------|
| `/health` | GET | Health check básico | `curl http://192.168.1.100:3001/health` |
| `/health/detailed` | GET | Health check detallado | `curl http://192.168.1.100:3001/health/detailed` |
| `/status` | GET | Estado del servidor | `curl http://192.168.1.100:3001/status` |
| `/connections` | GET | Listado de conexiones | `curl http://192.168.1.100:3001/connections` |
| `/metrics` | GET | Métricas Prometheus | `curl http://192.168.1.100:3001/metrics` |
| `/graphql` | POST | GraphQL endpoint | Ver FLUTTER_APOLLO_GRAPHQL_GUIDE.md |

---

## Recomendaciones de Seguridad

### Desarrollo (Actual - OK para Red Local)
```env
CORS_ORIGIN=*
APP_HOST=0.0.0.0
NODE_ENV=development
```

### Producción (Para Internet)
```env
# Especificar dominios permitidos
CORS_ORIGIN=https://tudominio.com,https://app.tudominio.com

# Usar dominio en lugar de IP
# En lugar de 192.168.1.100, usar: dispatch.tudominio.com

# Cambiar puerto
APP_PORT=443  # HTTPS

# Autenticación
# Requerir JWT token válido
# Implementar rate limiting
```

---

## Resumen - Tu Configuración es ✅ CORRECTA

1. **HOST = 0.0.0.0** ✅ Escucha en todas las interfaces
2. **PORT = 3001** ✅ Configurable
3. **CORS = \*** ✅ Permite todos en desarrollo
4. **Transport = WebSocket + Polling** ✅ Fallback automático

### Para acceder desde otra IP:

1. Obtén tu IP local: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
2. Usa esa IP en clientes: `ws://192.168.X.X:3001`
3. Asegúrate que firewall permite puerto 3001
4. Verifica con: `curl http://192.168.X.X:3001/health`

---

## Próximos Pasos

- Configurar Flutter apps con tu IP local
- Probar conexión desde diferentes dispositivos
- Monitorear logs en servidor con: `npm run dev`
- Si todo funciona, preparar para producción

¡Tu WebSocket está listo para red local! 🚀

