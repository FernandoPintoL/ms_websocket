# 📱 Configuración de Flutter para Conexión desde IP Local

## Tu Situación Actual

- **Servidor:** `192.168.1.38:4004`
- **Protocolo:** `http://` (desarrollo)
- **WebSocket:** `ws://` (NO `wss://`)

---

## Configuración de Flutter (.env)

```env
# ✅ CORRECTO para desarrollo con IP local
FLUTTER_ENV=development
GRAPHQL_HOST=192.168.1.38
GRAPHQL_PORT=4004
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://192.168.1.38:4004/graphql

# ❌ NO USAR HTTPS en desarrollo sin certificados
# ❌ NO USAR: wss://192.168.1.38:4004/graphql
```

---

## Código en GraphQLService

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

class GraphQLService {
  Future<void> initialize({required String authToken}) async {
    // ✅ CORRECTO - Usar IP local y ws://
    final wsUrl = dotenv.env['GRAPHQL_WS_URL'] ?? 'ws://192.168.1.38:4004/graphql';

    // ✅ Para WebSocket en desarrollo
    final wsLink = WebSocketLink(
      wsUrl,  // ws:// para desarrollo, wss:// para producción
      subProtocol: GraphQLWsSubProtocol.graphqlWs,
    );

    // ✅ Para HTTP queries
    final httpLink = HttpLink(
      'http://192.168.1.38:4004/graphql',  // http:// en desarrollo
    );

    final authLink = AuthLink(
      getToken: () async => 'Bearer $authToken',
    );

    final link = authLink.concat(wsLink.concat(httpLink));

    _client = GraphQLClient(
      link: link,
      cache: GraphQLCache(store: HiveStore()),
    );
  }
}
```

---

## Tabla de Configuración

| Protocolo | URL | Desarrollo | Producción |
|-----------|-----|-----------|-----------|
| **HTTP/WS** | `http://192.168.1.38:4004` | ✅ OK | ❌ No |
| **HTTPS/WSS** | `https://192.168.1.38:4004` | ❌ Error | ✅ OK |
| **localhost** | `http://localhost:4004` | ✅ OK (local) | ❌ No |

---

## Por Qué `ws://` No `wss://`

### Desarrollo (Tu caso)
```
El servidor corre en: http://192.168.1.38:4004
WebSocket usa:        ws://192.168.1.38:4004
Certficados SSL:      NO necesarios
```

### Producción (Futuro)
```
El servidor correrá en: https://api.tudominio.com
WebSocket usará:        wss://api.tudominio.com
Certificados SSL:       SÍ necesarios
```

---

## Verificación en Flutter

### Test 1: Conectar desde emulador Android

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load();

  // Verificar configuración
  print('GRAPHQL_HOST: ${dotenv.env['GRAPHQL_HOST']}');
  print('GRAPHQL_PORT: ${dotenv.env['GRAPHQL_PORT']}');
  print('GRAPHQL_WS_URL: ${dotenv.env['GRAPHQL_WS_URL']}');

  // Debe mostrar:
  // GRAPHQL_HOST: 192.168.1.38
  // GRAPHQL_PORT: 4004
  // GRAPHQL_WS_URL: ws://192.168.1.38:4004/graphql

  final authService = AuthService();
  await authService.initialize();

  if (authService.isAuthenticated) {
    await GraphQLService().initialize(authToken: authService.currentToken!);
  }

  runApp(const MyApp());
}
```

### Test 2: Probar conexión HTTP

```dart
import 'package:dio/dio.dart';

Future<void> testConnection() async {
  final dio = Dio();

  try {
    final response = await dio.get(
      'http://192.168.1.38:4004/health',
      options: Options(
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );

    print('✅ HTTP Connection OK');
    print('Response: $response');
  } catch (e) {
    print('❌ HTTP Connection Failed');
    print('Error: $e');
  }
}
```

### Test 3: Probar WebSocket

```dart
Future<void> testWebSocket() async {
  final wsUrl = 'ws://192.168.1.38:4004/graphql';

  try {
    final socket = io(wsUrl, {
      'reconnection': true,
      'reconnectionDelay': 1000,
    });

    socket.on('connect', () {
      print('✅ WebSocket Connected');
    });

    socket.on('error', (error) {
      print('❌ WebSocket Error: $error');
    });
  } catch (e) {
    print('❌ WebSocket Failed: $e');
  }
}
```

---

## Problema Común: "Connection Refused"

```
Error: Connection refused
```

**Causas:**
1. ❌ Estás usando `wss://` en lugar de `ws://`
2. ❌ IP incorrecta
3. ❌ Puerto incorrecto
4. ❌ Servidor no está corriendo
5. ❌ Firewall bloquea el puerto

**Soluciones:**
```dart
// ❌ MAL
final wsUrl = 'wss://192.168.1.38:4004/graphql';

// ✅ BIEN
final wsUrl = 'ws://192.168.1.38:4004/graphql';
```

---

## Configuración por Ambiente

### Desarrollo (.env)
```env
FLUTTER_ENV=development
GRAPHQL_HOST=192.168.1.38        # Tu IP local
GRAPHQL_PORT=4004
GRAPHQL_WS_URL=ws://192.168.1.38:4004/graphql
GRAPHQL_ENDPOINT=/graphql
```

### Testing (.env.test)
```env
FLUTTER_ENV=testing
GRAPHQL_HOST=localhost            # Local
GRAPHQL_PORT=4004
GRAPHQL_WS_URL=ws://localhost:4004/graphql
GRAPHQL_ENDPOINT=/graphql
```

### Producción (.env.prod)
```env
FLUTTER_ENV=production
GRAPHQL_HOST=api.tudominio.com   # Dominio
GRAPHQL_PORT=443
GRAPHQL_WS_URL=wss://api.tudominio.com/graphql   # wss:// seguro
GRAPHQL_ENDPOINT=/graphql
```

---

## Cargar .env Dinámicamente

```dart
Future<void> loadEnv() async {
  final env = dotenv.env['FLUTTER_ENV'] ?? 'development';

  if (env == 'production') {
    await dotenv.load(fileName: '.env.prod');
  } else if (env == 'testing') {
    await dotenv.load(fileName: '.env.test');
  } else {
    await dotenv.load(fileName: '.env');
  }
}
```

---

## Verificar en Dispositivo Real

### Android
```bash
# Conectar dispositivo Android en la misma red WiFi
adb devices

# El emulador usa 10.0.2.2 para acceder a localhost del host
# Pero para IP local, usa la IP directamente
```

### iOS Simulator
```bash
# iOS Simulator puede acceder a localhost y a IPs locales
# Usa directamente:
ws://192.168.1.38:4004/graphql
```

### Dispositivo Físico
```bash
# Debe estar en la MISMA red WiFi que el servidor
# Usa la IP local:
ws://192.168.1.38:4004/graphql
```

---

## Troubleshooting

### ❌ Error: "Unable to connect"

```
Solución:
1. Verifica que estés en la misma red WiFi
2. Verifica IP local: ipconfig (Windows) o ifconfig (Mac/Linux)
3. Verifica puerto abierto: netstat -ano | findstr :4004
4. Usa ws:// (no wss://) para desarrollo
```

### ❌ Error: "Connection timeout"

```
Solución:
1. Aumenta timeout en GraphQL
2. Verifica firewall permite puerto 4004
3. Verifica que el servidor está corriendo: npm run dev
```

### ❌ Error: "SSL_ERROR_WRONG_VERSION_NUMBER"

```
¡IMPORTANTE! Este error significa que estás intentando usar HTTPS/WSS
pero el servidor está en HTTP/WS

Solución:
Cambia de: wss://192.168.1.38:4004/graphql
A:         ws://192.168.1.38:4004/graphql
```

---

## Resumen

| Concepto | Desarrollo | Producción |
|----------|-----------|-----------|
| **Protocol** | `http://` | `https://` |
| **WebSocket** | `ws://` | `wss://` |
| **Host** | `192.168.1.38` | `api.tudominio.com` |
| **Port** | `4004` | `443` |
| **Certificado SSL** | No | Sí |

---

## Próximos Pasos

1. ✅ Configura `.env` con IP local
2. ✅ Usa `ws://` (no `wss://`) en desarrollo
3. ✅ Prueba desde dispositivo en la misma red
4. ✅ Verifica con curl primero:
   ```bash
   curl http://192.168.1.38:4004/health
   ```

---

**¡Tu Flutter debería conectarse ahora! 🚀**

