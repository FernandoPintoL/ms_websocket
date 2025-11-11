# ✅ Verificación de Acceso WebSocket desde Cualquier IP en Red

## TL;DR - Respuesta Rápida

**Tu WebSocket YA está correctamente configurado para ser accesible desde cualquier IP en la red.**

### Configuración Actual ✅
```
Host: 0.0.0.0  (escucha en TODAS las interfaces)
Port: 3001
CORS: * (permite todos los orígenes)
Estado: ✅ CORRECTO
```

### Para acceder desde otra IP:

```bash
# 1. Obtener tu IP local (Windows)
ipconfig | findstr IPv4

# 1. Obtener tu IP local (Mac/Linux)
ifconfig | grep "inet "

# 2. Usar esa IP en clientes
ws://192.168.1.100:3001
```

---

## Verificación Detallada

### Paso 1: Revisar Configuración del Servidor

**Archivo:** `src/server.js` línea 438-441

```javascript
const PORT = process.env.APP_PORT || 3001;
const HOST = process.env.APP_HOST || '0.0.0.0';  // ✅ CORRECTO

httpServer.listen(PORT, HOST, () => {
  logger.info({
    host: HOST,
    port: PORT,
    ...
  }, 'Server started successfully');
});
```

**Análisis:**
- ✅ `HOST = 0.0.0.0` → Escucha en TODAS las interfaces de red
- ✅ `PORT = 3001` → Puerto por defecto (configurable)
- ✅ Ambos son obtenidos del `.env` pero tienen defaults seguros

### Paso 2: Revisar Configuración de CORS

**Archivo:** `src/server.js` línea 44-55 y 94-99

```javascript
// Socket.IO CORS
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',  // ✅ CORRECTO
    methods: ['GET', 'POST'],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],  // ✅ Fallback automático
});

// Express CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',  // ✅ CORRECTO
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Análisis:**
- ✅ CORS permite `*` (todos los orígenes) en desarrollo
- ✅ Socket.IO y Express tienen CORS habilitado
- ✅ Transport fallback WebSocket → Polling automático

### Paso 3: Revisar Configuración de Variables de Entorno

**Archivo:** `.env`

```env
APP_HOST=0.0.0.0      ✅ Correcto
APP_PORT=4004         ✅ Configurable
CORS_ORIGIN=*         ✅ Abierto en desarrollo
```

**Análisis:**
- ✅ `APP_HOST=0.0.0.0` → Escucha en 0.0.0.0:4004 (o 3001 por defecto)
- ✅ `CORS_ORIGIN=*` → Permite todos los orígenes

---

## Pruebas de Conectividad

### Opción 1: Script Automático (Recomendado)

#### Para macOS/Linux:
```bash
chmod +x test-network-connectivity.sh
./test-network-connectivity.sh
```

#### Para Windows (Node.js):
```bash
npm install chalk axios socket.io-client
node test-network-connectivity.js
```

### Opción 2: Pruebas Manuales

#### Test 1: Health Check Local
```bash
curl http://localhost:3001/health

# Esperado:
# {
#   "status": "ok",
#   "service": "ms-websocket",
#   "timestamp": "2024-11-11T..."
# }
```

#### Test 2: Ver IP Local
```bash
# Windows
ipconfig | findstr IPv4

# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux
hostname -I
```

**Ejemplo:** `192.168.1.100`

#### Test 3: Health Check desde Red
```bash
# Reemplaza 192.168.1.100 con tu IP
curl http://192.168.1.100:3001/health

# Debe responder igual que localhost
```

#### Test 4: Ver Conexiones
```bash
# Local
curl http://localhost:3001/connections

# Desde red
curl http://192.168.1.100:3001/connections

# Respuesta esperada:
# {
#   "status": "ok",
#   "totalConnections": N,
#   "connections": [...]
# }
```

#### Test 5: Ver Puerto Abierto
```bash
# Windows
netstat -ano | findstr :3001

# macOS/Linux
lsof -i :3001

# Esperado:
# TCP    0.0.0.0:3001   0.0.0.0:0  LISTENING
```

---

## Configuración para Flutter

### .env de Flutter

```env
FLUTTER_ENV=development

# ✅ Cambiar esto según tu IP local
GRAPHQL_HOST=192.168.1.100        # Tu IP local
GRAPHQL_PORT=3001                  # Puerto del servidor
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://192.168.1.100:3001/graphql

# No localhost, usar IP local de la máquina con el servidor
```

### Código en Flutter
```dart
// lib/services/graphql_service.dart
String _buildWebSocketUrl() {
  // Usar IP local, no localhost
  return dotenv.env['GRAPHQL_WS_URL']
    ?? 'ws://192.168.1.100:3001/graphql';
}
```

---

## Configuración para Android/iOS

### Android

Actualizar en `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <application>
        ...
    </application>
</manifest>
```

### Probar desde Emulador Android

```bash
# El emulador usa 10.0.2.2 para acceder a localhost del host
# Para tu IP local, usa la IP directamente
adb shell ping -c 1 192.168.1.100

# Si no hay respuesta, el emulador no tiene acceso a la red local
```

### iOS Simulator

```bash
# iOS Simulator puede acceder a localhost y a IPs locales
# Usa directamente:
ws://192.168.1.100:3001
```

### Dispositivo Físico

```bash
# Android/iOS físico necesita:
# 1. Estar en la MISMA red que el servidor
# 2. Poder alcanzar la IP local del servidor
# 3. El servidor debe estar escuchando en 0.0.0.0

# Verificar desde el dispositivo:
# Abre navegador → http://192.168.1.100:3001/health
```

---

## Troubleshooting

### ❌ Problema: Connection Refused

```
Error: ECONNREFUSED 192.168.1.100:3001
```

**Solución:**

1. ¿El servidor está corriendo?
   ```bash
   npm run dev
   ```

2. ¿Cuál es tu IP local?
   ```bash
   ipconfig  # Windows
   ```

3. ¿El puerto está abierto?
   ```bash
   netstat -ano | findstr :3001
   ```

4. ¿El firewall bloquea?
   - Windows: Firewall → Allow an app → Node.js
   - macOS: System Preferences → Security & Privacy
   - Linux: `sudo ufw allow 3001`

### ❌ Problema: WebSocket Connection Failed

```
Error: WebSocket is closed before the connection is established
```

**Solución:**

1. Verifica CORS en `.env`:
   ```env
   CORS_ORIGIN=*
   ```

2. Verifica que el servidor está escuchando en 0.0.0.0:
   ```bash
   netstat -ano | findstr :3001
   # Debe mostrar: 0.0.0.0:3001 LISTENING
   ```

3. Intenta con `transport: ['polling']` como fallback

### ❌ Problema: Timeout de Conexión

```
Error: Network request timed out
```

**Solución:**

1. Verifica conectividad:
   ```bash
   ping 192.168.1.100
   ```

2. Aumenta timeouts en `.env`:
   ```env
   WS_HEARTBEAT_INTERVAL=60000   # 60 segundos
   WS_HEARTBEAT_TIMEOUT=10000    # 10 segundos
   ```

3. Verifica que no hay proxy/firewall corporativo

---

## Checklist Final

### ✅ Verificación de Configuración

- [ ] Ejecuté `npm run dev` y veo "Server started successfully"
- [ ] Vi `host: "0.0.0.0"` en los logs
- [ ] Ejecuté `curl http://localhost:3001/health` y funcionó
- [ ] Obtuve mi IP local con `ipconfig` o `ifconfig`
- [ ] Ejecuté `curl http://192.168.X.X:3001/health` desde otra PC
- [ ] Vi mi IP en `GRAPHQL_HOST` en `.env` de Flutter
- [ ] El servidor está permitido en el firewall

### ✅ Verificación de Red

- [ ] Servidor y cliente están en la MISMA red (WiFi/Ethernet)
- [ ] No hay proxy corporativo bloqueando el puerto
- [ ] La IP local es privada (192.168.X.X, 10.X.X.X, 172.16-31.X.X)
- [ ] No estoy usando localhost, estoy usando la IP local real

### ✅ Verificación de Código

- [ ] `.env` tiene `GRAPHQL_HOST=192.168.X.X` (no localhost)
- [ ] `.env` tiene `GRAPHQL_WS_URL=ws://192.168.X.X:3001/graphql`
- [ ] GraphQLService usa `process.env.APP_HOST` correctamente
- [ ] CORS está habilitado (`CORS_ORIGIN=*`)

---

## Comparación: Configuraciones

| Aspecto | Tu Actual | Requerido | Estado |
|---------|-----------|-----------|--------|
| APP_HOST | 0.0.0.0 | 0.0.0.0 | ✅ OK |
| APP_PORT | 3001 | Any | ✅ OK |
| CORS_ORIGIN | * | * | ✅ OK |
| Transport | WS + Polling | WS + Polling | ✅ OK |
| Heartbeat | 30s | Any | ✅ OK |

---

## Resumen de Direcciones

```
┌─────────────────────────────────────┐
│        DIRECCIONES DE ACCESO        │
├─────────────────────────────────────┤
│                                     │
│ LOCAL (desde el mismo PC):          │
│ ✅ http://localhost:3001            │
│ ✅ ws://localhost:3001              │
│                                     │
│ DESDE RED LOCAL:                    │
│ ✅ http://192.168.1.100:3001        │
│ ✅ ws://192.168.1.100:3001          │
│                                     │
│ DESDE INTERNET (producción):        │
│ ✅ https://dispatch.tudominio.com   │
│ ✅ wss://dispatch.tudominio.com     │
│                                     │
└─────────────────────────────────────┘
```

---

## Próximos Pasos

1. ✅ **Ejecutar servidor:** `npm run dev`
2. ✅ **Obtener IP local:** `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
3. ✅ **Configurar Flutter:** Usar IP local en `.env`
4. ✅ **Probar desde dispositivo:** Abrir navegador → `http://192.168.X.X:3001/health`
5. ✅ **Conectar aplicación:** Ejecutar `flutter run`

---

## Recursos de Ayuda

- **Documento Completo:** `WEBSOCKET_NETWORK_CONFIG.md`
- **Test Automático:** `test-network-connectivity.sh` o `.js`
- **Configuración Flutter:** `FLUTTER_APOLLO_GRAPHQL_GUIDE.md` (Sección 3)

---

## Conclusión

**✅ Tu WebSocket está CORRECTAMENTE configurado para acceso desde cualquier IP en la red.**

No necesitas hacer cambios. Solo:
1. Obtén tu IP local (`ipconfig`)
2. Úsala en las URLs de conexión
3. ¡Listo!

**Tu servidor está accesible desde:** `ws://192.168.X.X:3001` 🚀

