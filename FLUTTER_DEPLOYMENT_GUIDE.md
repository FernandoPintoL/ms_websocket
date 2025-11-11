# Guía de Despliegue, Testing y Debugging para Flutter

## Índice
1. [Ambiente de Desarrollo](#ambiente-de-desarrollo)
2. [Testing](#testing)
3. [Debugging](#debugging)
4. [Despliegue en Producción](#despliegue-en-producción)
5. [Monitoreo y Logs](#monitoreo-y-logs)
6. [Troubleshooting Avanzado](#troubleshooting-avanzado)

---

## Ambiente de Desarrollo

### 1. Configuración Inicial del Proyecto

```bash
# Crear nuevo proyecto Flutter
flutter create ambulance_dispatch

# Navegar al proyecto
cd ambulance_dispatch

# Obtener dependencias
flutter pub get

# Verificar que todo esté correctamente instalado
flutter doctor

# Salida esperada:
# Flutter (Channel stable, 3.x.x, on macOS/Windows/Linux)
# Doctor summary: All checks pass!
```

### 2. Estructura de Carpetas Recomendada

```
ambulance_dispatch/
├── lib/
│   ├── config/
│   │   ├── constants.dart
│   │   ├── env_config.dart
│   │   └── routes.dart
│   ├── models/
│   │   ├── attendance_model.dart
│   │   ├── dispatch_model.dart
│   │   ├── tracking_model.dart
│   │   └── user_model.dart
│   ├── providers/
│   │   ├── attendance_provider.dart
│   │   ├── dispatch_provider.dart
│   │   ├── tracking_provider.dart
│   │   └── auth_provider.dart
│   ├── screens/
│   │   ├── auth_screen.dart
│   │   ├── paramedic_home_screen.dart
│   │   ├── notifications_screen.dart
│   │   ├── tracking_screen.dart
│   │   └── communication_screen.dart
│   ├── services/
│   │   ├── auth_service.dart
│   │   ├── graphql_service.dart
│   │   ├── notification_service.dart
│   │   └── location_service.dart
│   ├── graphql/
│   │   ├── queries.dart
│   │   ├── mutations.dart
│   │   └── subscriptions.dart
│   ├── widgets/
│   │   ├── dispatch_card.dart
│   │   ├── tracking_map_widget.dart
│   │   └── connection_status_indicator.dart
│   ├── utils/
│   │   ├── logger_util.dart
│   │   ├── validators.dart
│   │   └── formatters.dart
│   └── main.dart
├── test/
│   ├── graphql_service_test.dart
│   ├── auth_service_test.dart
│   └── widget_test.dart
├── .env.development
├── .env.production
├── pubspec.yaml
└── README.md
```

### 3. Archivo .env.development

```env
# Desarrollo Local
FLUTTER_ENV=development
GRAPHQL_HOST=127.0.0.1
GRAPHQL_PORT=3001
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://127.0.0.1:3001/graphql

# Debugging
DEBUG_GRAPHQL=true
DEBUG_WEBSOCKET=true
LOG_LEVEL=DEBUG

# Notificaciones
ENABLE_LOCAL_NOTIFICATIONS=true

# Mapas (si usas Google Maps)
GOOGLE_MAPS_API_KEY=your_api_key_here

# API externa
API_TIMEOUT_SECONDS=30
RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

### 4. Archivo .env.production

```env
# Producción
FLUTTER_ENV=production
GRAPHQL_HOST=api.tudominio.com
GRAPHQL_PORT=443
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=wss://api.tudominio.com/graphql

# Debugging
DEBUG_GRAPHQL=false
DEBUG_WEBSOCKET=false
LOG_LEVEL=ERROR

# Notificaciones
ENABLE_LOCAL_NOTIFICATIONS=true

# Mapas
GOOGLE_MAPS_API_KEY=your_production_api_key

# API externa
API_TIMEOUT_SECONDS=60
RETRY_ATTEMPTS=5
RETRY_DELAY_MS=2000
```

---

## Testing

### 1. Tests Unitarios para Servicios

Crea `test/services/graphql_service_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:mockito/mockito.dart';
import 'package:ambulance_dispatch/services/graphql_service.dart';

void main() {
  group('GraphQLService Tests', () {
    late GraphQLService graphqlService;

    setUp(() {
      graphqlService = GraphQLService();
    });

    test('Should initialize successfully with token', () async {
      await graphqlService.initialize(authToken: 'test-token-123');
      expect(graphqlService.client, isNotNull);
    });

    test('Should update token correctly', () {
      graphqlService.updateToken('new-token-456');
      // Verificación interna del servicio
      expect(graphqlService.client, isNotNull);
    });

    test('Should handle query errors gracefully', () async {
      await graphqlService.initialize(authToken: 'test-token');

      final options = QueryOptions(
        document: gql('query { invalid }'),
      );

      final result = await graphqlService.query(options);
      expect(result.hasException, true);
    });

    test('Should disconnect properly', () async {
      await graphqlService.initialize(authToken: 'test-token');
      await graphqlService.disconnect();
      // Verificar que el cliente fue limpiado
    });

    test('Should retry on connection failure', () async {
      // Simular fallo de conexión
      final options = QueryOptions(
        document: gql('query { test }'),
      );

      // El servicio debería intentar reconectar
      try {
        await graphqlService.query(options);
      } catch (e) {
        expect(e, isNotNull);
      }
    });
  });
}
```

Crea `test/services/auth_service_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ambulance_dispatch/services/auth_service.dart';

void main() {
  group('AuthService Tests', () {
    late AuthService authService;

    setUp(() async {
      // Mock SharedPreferences
      SharedPreferences.setMockInitialValues({});
      authService = AuthService();
      await authService.initialize();
    });

    test('Should login with valid token', () async {
      final result = await authService.login(
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      );
      expect(result, true);
    });

    test('Should prevent login with expired token', () async {
      // Crear un token expirado
      final expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

      final result = await authService.login(token: expiredToken);
      expect(result, false);
    });

    test('Should logout successfully', () async {
      await authService.login(
        token: 'valid-token',
      );

      await authService.logout();

      expect(authService.currentToken, isNull);
      expect(authService.isAuthenticated, false);
    });

    test('Should verify authentication status', () async {
      expect(authService.isAuthenticated, false);

      await authService.login(token: 'valid-token');

      expect(authService.isAuthenticated, true);
    });

    test('Should extract user data from token', () async {
      await authService.login(token: 'valid-token-with-data');

      final userData = authService.getUserData();
      expect(userData, isNotNull);
    });
  });
}
```

### 2. Tests de Widgets

Crea `test/widgets/dispatch_card_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ambulance_dispatch/widgets/dispatch_card.dart';
import 'package:ambulance_dispatch/models/dispatch_model.dart';

void main() {
  group('DispatchCard Widget Tests', () {
    late DispatchModel mockDispatch;

    setUp(() {
      mockDispatch = DispatchModel(
        id: '1',
        numero: 'D-001',
        estado: DispatchStatus.inRoute,
        paciente: 'Juan Pérez',
        ambulanciaPlaca: 'AMB-001',
        driverName: 'Carlos López',
        fechaCreacion: DateTime.now(),
        fechaActualizacion: DateTime.now(),
      );
    });

    testWidgets('Should display dispatch information', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DispatchCard(dispatch: mockDispatch),
          ),
        ),
      );

      expect(find.text('Despacho #D-001'), findsOneWidget);
      expect(find.text('Juan Pérez'), findsOneWidget);
      expect(find.text('AMB-001'), findsOneWidget);
    });

    testWidgets('Should call onTap callback when tapped', (WidgetTester tester) async {
      bool wasPressed = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DispatchCard(
              dispatch: mockDispatch,
              onTap: () {
                wasPressed = true;
              },
            ),
          ),
        ),
      );

      await tester.tap(find.byType(ListTile));
      await tester.pump();

      expect(wasPressed, true);
    });

    testWidgets('Should display correct status badge', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DispatchCard(dispatch: mockDispatch),
          ),
        ),
      );

      expect(find.text('En Ruta'), findsOneWidget);
    });
  });
}
```

### 3. Ejecución de Tests

```bash
# Ejecutar todos los tests
flutter test

# Ejecutar tests con cobertura
flutter test --coverage

# Ejecutar tests específicos
flutter test test/services/auth_service_test.dart

# Ejecutar tests con output detallado
flutter test --verbose

# Ver cobertura con lcov
lcov --list coverage/lcov.info
```

---

## Debugging

### 1. Configurar Logging Centralizado

Crea `lib/utils/logger_util.dart`:

```dart
import 'package:logger/logger.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class LoggerUtil {
  static final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
      dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
    ),
  );

  static final bool _debugMode =
      dotenv.env['DEBUG_GRAPHQL'] == 'true';

  static void logGraphQLQuery(String query, Map<String, dynamic>? variables) {
    if (_debugMode) {
      _logger.d('''
GraphQL Query:
Query: $query
Variables: ${variables?.toString() ?? 'None'}
      ''');
    }
  }

  static void logGraphQLError(String operation, dynamic error, StackTrace? stackTrace) {
    _logger.e(
      'GraphQL Error ($operation)',
      error,
      stackTrace,
    );
  }

  static void logWebSocketEvent(String event, dynamic data) {
    if (_debugMode) {
      _logger.d('WebSocket Event: $event\nData: $data');
    }
  }

  static void logError(String message, dynamic error, StackTrace stackTrace) {
    _logger.e(message, error, stackTrace);
  }

  static void logInfo(String message) {
    _logger.i(message);
  }

  static void logWarning(String message) {
    _logger.w(message);
  }
}
```

### 2. Debugging en Android Studio / VS Code

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Flutter (Development)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "args": ["--dart-define=FLUTTER_ENV=development"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    },
    {
      "name": "Flutter (Production)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "args": ["--dart-define=FLUTTER_ENV=production"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### 3. DevTools Integration

```bash
# Abrir Flutter DevTools
flutter pub global activate devtools
flutter pub global run devtools

# O directamente desde la línea de comandos
flutter run -v

# Luego acceder a: http://localhost:9100
```

### 4. Inspeccionar WebSocket

```dart
// En tu graphql_service.dart, agregar logging detallado

import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketDebugger {
  static void debugWebSocketConnection(String url) {
    print('>>> WebSocket Connection Attempt');
    print('>>> URL: $url');
    print('>>> Timestamp: ${DateTime.now()}');

    try {
      final channel = WebSocketChannel.connect(Uri.parse(url));
      channel.stream.listen(
        (message) {
          print('>>> WebSocket Message Received: $message');
        },
        onError: (error) {
          print('>>> WebSocket Error: $error');
        },
        onDone: () {
          print('>>> WebSocket Connection Closed');
        },
      );
    } catch (e) {
      print('>>> WebSocket Connection Failed: $e');
    }
  }
}
```

### 5. Inspect Network Calls

```bash
# Usar Charles Proxy o similar para inspeccionar tráfico HTTP/WebSocket
# O usar Fiddler en Windows

# Alternativamente, activar logging en Dio (si lo usas):
# Dio tiene interceptores para loguear requests/responses

dio.interceptors.add(
  LoggingInterceptor(),
);
```

---

## Despliegue en Producción

### 1. Compilación para Android

```bash
# Crear APK de release
flutter build apk --release

# O crear App Bundle (recomendado para Google Play)
flutter build appbundle --release

# Ubicación de salida:
# APK: build/app/outputs/apk/release/app-release.apk
# Bundle: build/app/outputs/bundle/release/app-release.aab
```

### 2. Compilación para iOS

```bash
# Crear IPA de release
flutter build ios --release

# Abrir en Xcode para más configuración
open ios/Runner.xcworkspace

# O usar directamente Flutter para compilar
flutter build ipa --release

# Ubicación: build/ios/ipa/
```

### 3. Configuración de Certificados (iOS)

```bash
# Crear provisioning profiles en Apple Developer
# 1. Crear App ID
# 2. Crear certificados de desarrollo y distribution
# 3. Crear provisioning profiles
# 4. Configurar en Xcode

# En Runner/General:
# - Bundle ID: com.tucompañia.ambulancedispatch
# - Signing Certificate: Development / Distribution
```

### 4. Configuración de Firma (Android)

Crea `android/key.properties`:

```properties
storePassword=tu_contrasena
keyPassword=tu_contrasena_key
keyAlias=upload
storeFile=upload-keystore.jks
```

Genera el keystore:

```bash
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10950 -alias upload
```

### 5. Configurar Firebase (Opcional)

```bash
# Instalar herramientas de Firebase
flutter pub global activate flutterfire_cli

# Configurar Firebase
flutterfire configure

# Esto generará:
# - google-services.json (Android)
# - GoogleService-Info.plist (iOS)
```

### 6. Script de Compilación Automatizado

Crea `scripts/build.sh`:

```bash
#!/bin/bash

set -e

echo "Building Flutter App for Production"
echo "===================================="

# Variables
VERSION=$(grep version pubspec.yaml | awk '{print $2}')
BUILD_NAME="ambulance_dispatch_${VERSION}_$(date +%Y%m%d_%H%M%S)"

# Android
echo "Building Android App Bundle..."
flutter build appbundle --release \
  --dart-define=FLUTTER_ENV=production

# iOS
echo "Building iOS App..."
flutter build ios --release \
  --dart-define=FLUTTER_ENV=production

echo "Build completed successfully!"
echo "Android Bundle: build/app/outputs/bundle/release/app-release.aab"
echo "iOS App: build/ios/ipa/"
```

Hacer ejecutable:

```bash
chmod +x scripts/build.sh
./scripts/build.sh
```

---

## Monitoreo y Logs

### 1. Configuración de Analytics

```dart
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  static Future<void> logDispatchCreated(String dispatchId) async {
    await _analytics.logEvent(
      name: 'dispatch_created',
      parameters: {
        'dispatch_id': dispatchId,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  static Future<void> logLocationUpdate(String despachoId, double latitude, double longitude) async {
    await _analytics.logEvent(
      name: 'location_updated',
      parameters: {
        'despacho_id': despachoId,
        'latitude': latitude,
        'longitude': longitude,
      },
    );
  }

  static Future<void> logError(String errorCode, String errorMessage) async {
    await _analytics.logEvent(
      name: 'app_error',
      parameters: {
        'error_code': errorCode,
        'error_message': errorMessage,
      },
    );
  }
}
```

### 2. Configuración de Crashlytics

```dart
import 'package:firebase_crashlytics/firebase_crashlytics.dart';

void setupCrashlytics() {
  FlutterError.onError = (errorDetails) {
    FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };
}
```

### 3. Sistema de Logs Centralizado

```dart
class LogService {
  static final List<LogEntry> _logs = [];
  static const int _maxLogs = 1000;

  static void addLog(String message, LogLevel level) {
    _logs.add(
      LogEntry(
        timestamp: DateTime.now(),
        level: level,
        message: message,
      ),
    );

    // Mantener límite de logs en memoria
    if (_logs.length > _maxLogs) {
      _logs.removeAt(0);
    }

    // Enviar a servidor si es error crítico
    if (level == LogLevel.error) {
      _sendToServer(_logs.last);
    }
  }

  static Future<void> _sendToServer(LogEntry log) async {
    // Implementar envío a servidor
  }

  static List<LogEntry> getLogs([LogLevel? level]) {
    if (level == null) return _logs;
    return _logs.where((log) => log.level == level).toList();
  }
}

class LogEntry {
  final DateTime timestamp;
  final LogLevel level;
  final String message;

  LogEntry({
    required this.timestamp,
    required this.level,
    required this.message,
  });
}

enum LogLevel { info, warning, error, debug }
```

---

## Troubleshooting Avanzado

### Problema: WebSocket Desconecta Frecuentemente

**Solución:**

```dart
// Implementar reconexión automática con backoff exponencial
class ReconnectionManager {
  int _reconnectAttempts = 0;
  final int _maxReconnectAttempts = 5;
  Duration _reconnectDelay = const Duration(seconds: 1);

  Future<void> reconnect(Function onReconnect) async {
    while (_reconnectAttempts < _maxReconnectAttempts) {
      try {
        await Future.delayed(_reconnectDelay);
        await onReconnect();
        _reconnectAttempts = 0;
        _reconnectDelay = const Duration(seconds: 1);
        return;
      } catch (e) {
        _reconnectAttempts++;
        _reconnectDelay *= 2; // Exponential backoff
        print('Reconnection attempt $_reconnectAttempts failed: $e');
      }
    }
    throw Exception('Max reconnection attempts exceeded');
  }
}
```

### Problema: Alto Consumo de Memoria

**Solución:**

```dart
// Implementar límites en suscripciones y caché
class MemoryManagedProvider extends ChangeNotifier {
  final int _maxItemsInMemory = 500;
  final List<dynamic> _items = [];

  void addItem(dynamic item) {
    _items.add(item);
    if (_items.length > _maxItemsInMemory) {
      _items.removeAt(0);
    }
    notifyListeners();
  }

  void clearOldItems(Duration age) {
    _items.removeWhere((item) {
      if (item is TimestampedItem) {
        return DateTime.now().difference(item.timestamp) > age;
      }
      return false;
    });
    notifyListeners();
  }

  @override
  void dispose() {
    _items.clear();
    super.dispose();
  }
}
```

### Problema: Token Expirado Durante Suscripción

**Solución:**

```dart
class TokenRefreshMiddleware {
  final AuthService _authService = AuthService();
  final GraphQLService _graphqlService = GraphQLService();

  Future<void> setupTokenRefresh() async {
    Timer.periodic(const Duration(minutes: 55), (timer) async {
      try {
        if (_authService.isAuthenticated) {
          final newToken = await _authService.refreshAccessToken();
          if (newToken != null) {
            _graphqlService.updateToken(newToken);
          } else {
            // Token inválido, redirigir al login
            _handleUnauthorized();
          }
        }
      } catch (e) {
        print('Token refresh error: $e');
      }
    });
  }

  void _handleUnauthorized() {
    // Navigatir a login
  }
}
```

---

## Resumen de Comandos Útiles

```bash
# Limpiar caché y rebuilt
flutter clean
flutter pub get

# Ejecutar en desarrollo
flutter run -v
flutter run --debug

# Ejecutar en release (más rápido)
flutter run --release

# Profiling
flutter run --profile

# Tests
flutter test
flutter test --coverage

# Build
flutter build apk --release
flutter build appbundle --release
flutter build ios --release
flutter build ipa --release

# Formato de código
flutter format lib/

# Análisis estático
flutter analyze

# Ver dependencias
flutter pub deps
flutter pub outdated
```

---

## Checklist Predespliegue

- [ ] Todos los tests pasan
- [ ] No hay warnings en `flutter analyze`
- [ ] Código formateado con `flutter format`
- [ ] Variables de entorno configuradas para producción
- [ ] API keys y secretos almacenados correctamente
- [ ] Certificados y provisioning profiles actualizados
- [ ] Versión incrementada en pubspec.yaml
- [ ] Changelog actualizado
- [ ] Screenshots y descripción para stores listos
- [ ] Release notes preparadas

