# Guía de Integración Apollo GraphQL con WebSocket para Flutter

## Índice
1. [Configuración Inicial](#configuración-inicial)
2. [Instalación de Dependencias](#instalación-de-dependencias)
3. [Configuración de Apollo Client](#configuración-de-apollo-client)
4. [Autenticación y Conexión](#autenticación-y-conexión)
5. [Suscripciones en Tiempo Real](#suscripciones-en-tiempo-real)
6. [Notificaciones de Asistencias Médicas](#notificaciones-de-asistencias-médicas)
7. [Seguimiento de Ruta de Ambulancia](#seguimiento-de-ruta-de-ambulancia)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Solución de Problemas](#solución-de-problemas)

---

## Configuración Inicial

### 1. Requisitos Previos
- Flutter 3.0 o superior
- Dart 3.0 o superior
- Token JWT válido del servidor de autenticación
- Servidor WebSocket en ejecución (ms_websocket)

### 2. Variables de Entorno
Crea un archivo `.env` en la raíz de tu proyecto Flutter:

```env
# Configuración de Servidor GraphQL
GRAPHQL_HOST=127.0.0.1
GRAPHQL_PORT=3001
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://127.0.0.1:3001/graphql

# Para producción
GRAPHQL_HOST_PROD=api.tudominio.com
GRAPHQL_WS_URL_PROD=wss://api.tudominio.com/graphql

# Configuración de Autenticación
AUTH_TOKEN_KEY=auth_token
AUTH_REFRESH_TOKEN_KEY=refresh_token

# Configuración de Timeouts
WEBSOCKET_TIMEOUT=30000
CONNECTION_TIMEOUT=10000
```

---

## Instalación de Dependencias

### Dependencias Requeridas

```yaml
dependencies:
  flutter:
    sdk: flutter

  # GraphQL y Apollo
  graphql: ^5.1.0
  graphql_flutter: ^5.1.0

  # WebSocket
  web_socket_channel: ^2.4.0

  # Utilidades
  dio: ^5.3.0
  jwt_decoder: ^2.0.1
  shared_preferences: ^2.2.0
  flutter_dotenv: ^5.1.0

  # Manejo de estado (Recomendado)
  provider: ^6.0.0

  # Logging
  logger: ^2.0.0

  # Serialización
  json_annotation: ^4.8.0
  freezed_annotation: ^2.4.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.0
  json_serializable: ^6.7.0
  freezed: ^2.4.0
```

### Comando de Instalación

```bash
flutter pub get
```

---

## Configuración de Apollo Client

### 1. Crear Servicio de Configuración de Apollo

Crea `lib/services/graphql_service.dart`:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:logger/logger.dart';

class GraphQLService {
  static final GraphQLService _instance = GraphQLService._internal();
  late GraphQLClient _client;
  late Logger _logger;
  String? _authToken;

  factory GraphQLService() {
    return _instance;
  }

  GraphQLService._internal() {
    _logger = Logger();
  }

  /// Inicializa el cliente de Apollo GraphQL
  Future<void> initialize({required String authToken}) async {
    _authToken = authToken;

    final httpLink = HttpLink(
      _buildGraphQLUrl(),
      httpClient: _buildHttpClient(),
    );

    final wsLink = WebSocketLink(
      _buildWebSocketUrl(),
      subProtocol: GraphQLWsSubProtocol.graphqlWs,
      config: SocketClientConfig(
        autoReconnect: true,
        inactivityTimeout: const Duration(seconds: 30),
      ),
    );

    final authLink = AuthLink(
      getToken: () async => 'Bearer $_authToken',
      headerKey: 'Authorization',
    );

    final link = authLink.concat(wsLink.concat(httpLink));

    _client = GraphQLClient(
      link: link,
      cache: GraphQLCache(store: HiveStore()),
    );

    _logger.i('Apollo Client initialized successfully');
  }

  /// Construye la URL del servidor GraphQL
  String _buildGraphQLUrl() {
    final env = dotenv.env['FLUTTER_ENV'] ?? 'development';

    if (env == 'production') {
      return 'https://${dotenv.env['GRAPHQL_HOST_PROD']}/graphql';
    }

    final host = dotenv.env['GRAPHQL_HOST'] ?? '127.0.0.1';
    final port = dotenv.env['GRAPHQL_PORT'] ?? '3001';
    return 'http://$host:$port/graphql';
  }

  /// Construye la URL de WebSocket
  String _buildWebSocketUrl() {
    final env = dotenv.env['FLUTTER_ENV'] ?? 'development';

    if (env == 'production') {
      return dotenv.env['GRAPHQL_WS_URL_PROD'] ?? 'wss://api.tudominio.com/graphql';
    }

    return dotenv.env['GRAPHQL_WS_URL'] ?? 'ws://127.0.0.1:3001/graphql';
  }

  /// Construye el cliente HTTP con configuración personalizada
  HttpClient _buildHttpClient() {
    final client = HttpClient()
      ..connectionTimeout = Duration(
        seconds: int.parse(dotenv.env['CONNECTION_TIMEOUT'] ?? '10') ~/ 1000,
      );

    return client;
  }

  /// Obtiene el cliente de GraphQL
  GraphQLClient get client => _client;

  /// Actualiza el token de autenticación
  void updateToken(String newToken) {
    _authToken = newToken;
    _logger.i('Authentication token updated');
  }

  /// Desconecta el cliente
  Future<void> disconnect() async {
    await _client.dispose();
    _logger.i('Apollo Client disconnected');
  }

  /// Realiza una consulta GraphQL
  Future<QueryResult> query(QueryOptions options) async {
    try {
      final result = await _client.query(options);

      if (result.hasException) {
        _logger.e('GraphQL Query Error: ${result.exception}');
      }

      return result;
    } catch (e) {
      _logger.e('Query Exception: $e');
      rethrow;
    }
  }

  /// Realiza una mutación GraphQL
  Future<QueryResult> mutate(MutationOptions options) async {
    try {
      final result = await _client.mutate(options);

      if (result.hasException) {
        _logger.e('GraphQL Mutation Error: ${result.exception}');
      }

      return result;
    } catch (e) {
      _logger.e('Mutation Exception: $e');
      rethrow;
    }
  }

  /// Se suscribe a cambios en tiempo real
  Stream<QueryResult> subscribe(SubscriptionOptions options) {
    return _client.subscribe(options);
  }
}
```

### 2. Documentos GraphQL (Queries, Mutations, Subscriptions)

Crea `lib/graphql/queries.dart`:

```dart
import 'package:graphql_flutter/graphql_flutter.dart';

class DispatchQueries {
  /// Obtener un despacho por ID
  static const String getDispatchQuery = r'''
    query GetDispatch($id: ID!) {
      dispatch(id: $id) {
        id
        numero
        estado
        paciente
        ubicacion {
          latitud
          longitud
          altitud
          accuracyMeters
        }
        ambulanciaId
        ambulanciaPlaca
        driverName
        notas
        fechaCreacion
        fechaActualizacion
        tiempoEstimado
        prioridad
      }
    }
  ''';

  /// Obtener todos los despachos con filtros opcionales
  static const String getDispatchesQuery = r'''
    query GetDispatches($estado: DispatchStatusEnum, $limit: Int, $offset: Int) {
      despachos(estado: $estado, limit: $limit, offset: $offset) {
        id
        numero
        estado
        paciente
        ubicacion {
          latitud
          longitud
        }
        ambulanciaPlaca
        driverName
        fechaCreacion
        tiempoEstimado
        prioridad
      }
    }
  ''';

  /// Obtener despachos por ambulancia
  static const String getDispatchesByAmbulanciaQuery = r'''
    query GetDispatchesByAmbulancia($ambulanciaId: ID!) {
      despachosByAmbulancia(ambulanciaId: $ambulanciaId) {
        id
        numero
        estado
        paciente
        ubicacion {
          latitud
          longitud
        }
        driverName
        fechaCreacion
      }
    }
  ''';

  /// Obtener usuarios en línea
  static const String getOnlineUsersQuery = r'''
    query GetOnlineUsers($limit: Int) {
      onlineUsers(limit: $limit) {
        userId
        nombre
        role
        connectionCount
        lastActivity
      }
    }
  ''';

  /// Obtener historial de rastreo de una ambulancia
  static const String getRastreoHistoriaQuery = r'''
    query GetRastreoHistoria($despachoId: ID!, $limit: Int) {
      rastreoHistoria(despachoId: $despachoId, limit: $limit) {
        id
        despachoId
        ubicacion {
          latitud
          longitud
          altitud
          accuracyMeters
        }
        velocidad
        timestamp
      }
    }
  ''';

  /// Obtener ambulancias disponibles por ubicación
  static const String getAmbulanciasByLocationQuery = r'''
    query GetAmbulanciasByLocation($latitud: Float!, $longitud: Float!, $radiusKm: Float!) {
      ambulanciasByUbicacion(
        latitud: $latitud
        longitud: $longitud
        radiusKm: $radiusKm
      ) {
        id
        placa
        estado
        ubicacion {
          latitud
          longitud
        }
        driverName
        disponibilidad
        ultimaActividad
      }
    }
  ''';

  /// Obtener historial de eventos
  static const String getEventsQuery = r'''
    query GetEvents($type: String, $limit: Int, $offset: Int) {
      events(type: $type, limit: $limit, offset: $offset) {
        events {
          id
          type
          data
          metadata
          timestamp
        }
        total
        limit
        offset
      }
    }
  ''';
}
```

Crea `lib/graphql/mutations.dart`:

```dart
class DispatchMutations {
  /// Crear un nuevo despacho
  static const String createDispatchMutation = r'''
    mutation CreateDispatch(
      $paciente: String
      $latitud: Float!
      $longitud: Float!
      $notas: String
    ) {
      createDispatch(
        paciente: $paciente
        latitud: $latitud
        longitud: $longitud
        notas: $notas
      ) {
        id
        numero
        estado
        paciente
        ubicacion {
          latitud
          longitud
        }
        fechaCreacion
      }
    }
  ''';

  /// Actualizar estado de un despacho
  static const String updateDispatchStatusMutation = r'''
    mutation UpdateDispatchStatus($despachoId: ID!, $estado: DispatchStatusEnum!) {
      updateDispatchStatus(despachoId: $despachoId, estado: $estado) {
        id
        numero
        estado
        fechaActualizacion
      }
    }
  ''';

  /// Cancelar un despacho
  static const String cancelDispatchMutation = r'''
    mutation CancelDispatch($despachoId: ID!, $razon: String) {
      cancelDispatch(despachoId: $despachoId, razon: $razon) {
        id
        numero
        estado
        notas
      }
    }
  ''';

  /// Actualizar ubicación (rastreo)
  static const String updateLocationMutation = r'''
    mutation UpdateLocation(
      $despachoId: ID!
      $latitud: Float!
      $longitud: Float!
      $velocidad: Float
    ) {
      updateLocation(
        despachoId: $despachoId
        latitud: $latitud
        longitud: $longitud
        velocidad: $velocidad
      ) {
        id
        despachoId
        ubicacion {
          latitud
          longitud
        }
        velocidad
        timestamp
      }
    }
  ''';

  /// Enviar mensaje broadcast
  static const String broadcastMessageMutation = r'''
    mutation BroadcastMessage($channel: String!, $message: String!) {
      broadcastMessage(channel: $channel, message: $message) {
        id
        channel
        message
        sender
        senderName
        timestamp
      }
    }
  ''';

  /// Enviar mensaje directo a un usuario
  static const String sendDirectMessageMutation = r'''
    mutation SendDirectMessage($userId: ID!, $message: String!) {
      sendDirectMessage(userId: $userId, message: $message) {
        id
        channel
        message
        sender
        senderName
        timestamp
      }
    }
  ''';

  /// Actualizar estado del usuario
  static const String updateUserStatusMutation = r'''
    mutation UpdateUserStatus($status: String!) {
      updateUserStatus(status: $status) {
        id
        nombre
        email
        role
        isOnline
        lastSeen
      }
    }
  ''';
}
```

Crea `lib/graphql/subscriptions.dart`:

```dart
class DispatchSubscriptions {
  /// Suscribirse a nuevos despachos creados
  static const String dispatchCreatedSubscription = r'''
    subscription OnDispatchCreated {
      dispatchCreated {
        id
        numero
        estado
        paciente
        ubicacion {
          latitud
          longitud
        }
        fechaCreacion
      }
    }
  ''';

  /// Suscribirse a cambios de estado de despacho
  static const String dispatchStatusChangedSubscription = r'''
    subscription OnDispatchStatusChanged($despachoId: ID!) {
      dispatchStatusChanged(despachoId: $despachoId) {
        id
        numero
        estado
        fechaActualizacion
      }
    }
  ''';

  /// Suscribirse a actualizaciones de ubicación
  static const String locationUpdatedSubscription = r'''
    subscription OnLocationUpdated($despachoId: ID!) {
      locationUpdated(despachoId: $despachoId) {
        despachoId
        rastreo {
          id
          despachoId
          ubicacion {
            latitud
            longitud
            altitud
            accuracyMeters
          }
          velocidad
          timestamp
        }
        timestamp
      }
    }
  ''';

  /// Suscribirse a cambios de estado de usuario
  static const String userStatusChangedSubscription = r'''
    subscription OnUserStatusChanged($userId: ID!) {
      userStatusChanged(userId: $userId) {
        userId
        status
        timestamp
      }
    }
  ''';

  /// Suscribirse a cambios de usuarios en línea
  static const String onlineUsersChangedSubscription = r'''
    subscription OnOnlineUsersChanged {
      onlineUsersChanged {
        userId
        nombre
        role
        connectionCount
        lastActivity
      }
    }
  ''';

  /// Suscribirse a actualizaciones de ubicación de ambulancia
  static const String ambulanciaLocationUpdatedSubscription = r'''
    subscription OnAmbulanciaLocationUpdated($ambulanciaId: ID!) {
      ambulanciaLocationUpdated(ambulanciaId: $ambulanciaId) {
        id
        placa
        estado
        ubicacion {
          latitud
          longitud
          altitud
          accuracyMeters
        }
        driverName
        disponibilidad
        ultimaActividad
      }
    }
  ''';

  /// Suscribirse a mensajes broadcast en un canal
  static const String messageBroadcastSubscription = r'''
    subscription OnMessageBroadcast($channel: String!) {
      messageBroadcast(channel: $channel) {
        id
        channel
        message
        sender
        senderName
        timestamp
      }
    }
  ''';

  /// Suscribirse a mensajes directos
  static const String directMessageSubscription = r'''
    subscription OnDirectMessage($fromUserId: ID!) {
      directMessage(fromUserId: $fromUserId) {
        id
        channel
        message
        sender
        senderName
        timestamp
      }
    }
  ''';

  /// Suscribirse a eventos
  static const String eventOccurredSubscription = r'''
    subscription OnEventOccurred($eventType: String) {
      eventOccurred(eventType: $eventType) {
        id
        type
        data
        metadata
        timestamp
      }
    }
  ''';
}
```

---

## Autenticación y Conexión

### 1. Servicio de Autenticación

Crea `lib/services/auth_service.dart`:

```dart
import 'package:shared_preferences/shared_preferences.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'package:logger/logger.dart';
import 'graphql_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  late SharedPreferences _prefs;
  late Logger _logger;
  String? _currentToken;
  String? _refreshToken;

  factory AuthService() {
    return _instance;
  }

  AuthService._internal() {
    _logger = Logger();
  }

  /// Inicializa el servicio de autenticación
  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    _currentToken = _prefs.getString('auth_token');
    _refreshToken = _prefs.getString('refresh_token');
    _logger.i('AuthService initialized');
  }

  /// Inicia sesión con credenciales
  Future<bool> login({required String token, String? refreshToken}) async {
    try {
      // Validar que el token sea válido
      if (JwtDecoder.isExpired(token)) {
        _logger.e('Token is already expired');
        return false;
      }

      _currentToken = token;
      _refreshToken = refreshToken;

      // Guardar tokens en almacenamiento local
      await _prefs.setString('auth_token', token);
      if (refreshToken != null) {
        await _prefs.setString('refresh_token', refreshToken);
      }

      // Inicializar Apollo Client con el nuevo token
      await GraphQLService().initialize(authToken: token);

      _logger.i('User logged in successfully');
      return true;
    } catch (e) {
      _logger.e('Login failed: $e');
      return false;
    }
  }

  /// Cierra la sesión del usuario
  Future<void> logout() async {
    try {
      _currentToken = null;
      _refreshToken = null;

      await _prefs.remove('auth_token');
      await _prefs.remove('refresh_token');

      await GraphQLService().disconnect();

      _logger.i('User logged out successfully');
    } catch (e) {
      _logger.e('Logout failed: $e');
    }
  }

  /// Obtiene el token actual
  String? get currentToken => _currentToken;

  /// Obtiene el token de actualización
  String? get refreshToken => _refreshToken;

  /// Verifica si el usuario está autenticado
  bool get isAuthenticated => _currentToken != null && !JwtDecoder.isExpired(_currentToken!);

  /// Obtiene los datos del usuario desde el token
  Map<String, dynamic>? getUserData() {
    if (_currentToken == null) return null;

    try {
      return JwtDecoder.decode(_currentToken!);
    } catch (e) {
      _logger.e('Error decoding token: $e');
      return null;
    }
  }

  /// Actualiza el token
  Future<bool> refreshAccessToken() async {
    try {
      if (_refreshToken == null) {
        _logger.w('No refresh token available');
        return false;
      }

      // Aquí implementarías la llamada a tu endpoint de refresh
      // Por ahora es un ejemplo
      _logger.i('Token refreshed successfully');
      return true;
    } catch (e) {
      _logger.e('Token refresh failed: $e');
      return false;
    }
  }
}
```

### 2. Inicialización en main.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'services/auth_service.dart';
import 'services/graphql_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Cargar variables de entorno
  await dotenv.load(fileName: '.env');

  // Inicializar servicios
  final authService = AuthService();
  await authService.initialize();

  // Si existe un token guardado, usarlo
  if (authService.isAuthenticated) {
    await GraphQLService().initialize(authToken: authService.currentToken!);
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ambulance Dispatch',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const HomeScreen(),
    );
  }
}
```

---

## Suscripciones en Tiempo Real

### Crear un Provider para Manejar Suscripciones

Crea `lib/providers/dispatch_provider.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import '../services/graphql_service.dart';
import '../graphql/subscriptions.dart';
import '../models/dispatch_model.dart';

class DispatchProvider extends ChangeNotifier {
  final GraphQLService _graphqlService = GraphQLService();

  List<DispatchModel> _dispatches = [];
  Map<String, dynamic> _currentDispatch = {};
  Stream<QueryResult>? _subscriptionStream;
  bool _isLoading = false;
  String? _error;

  List<DispatchModel> get dispatches => _dispatches;
  Map<String, dynamic> get currentDispatch => _currentDispatch;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Suscribirse a nuevos despachos creados
  void subscribeToNewDispatches() {
    _isLoading = true;
    notifyListeners();

    final options = SubscriptionOptions(
      document: gql(DispatchSubscriptions.dispatchCreatedSubscription),
    );

    _subscriptionStream = _graphqlService.subscribe(options);

    _subscriptionStream!.listen(
      (result) {
        if (result.hasException) {
          _error = result.exception.toString();
          notifyListeners();
          return;
        }

        if (result.data != null) {
          final newDispatch = result.data?['dispatchCreated'];
          if (newDispatch != null) {
            _dispatches.add(DispatchModel.fromJson(newDispatch));
            _error = null;
            notifyListeners();
          }
        }
      },
      onError: (error) {
        _error = error.toString();
        notifyListeners();
      },
    );
  }

  /// Suscribirse a cambios de estado de un despacho específico
  void subscribeToDispatchStatusChanges(String despachoId) {
    final options = SubscriptionOptions(
      document: gql(DispatchSubscriptions.dispatchStatusChangedSubscription),
      variables: {'despachoId': despachoId},
    );

    _subscriptionStream = _graphqlService.subscribe(options);

    _subscriptionStream!.listen(
      (result) {
        if (result.hasException) {
          _error = result.exception.toString();
          notifyListeners();
          return;
        }

        if (result.data != null) {
          final updatedDispatch = result.data?['dispatchStatusChanged'];
          if (updatedDispatch != null) {
            _currentDispatch = updatedDispatch;
            _error = null;
            notifyListeners();
          }
        }
      },
      onError: (error) {
        _error = error.toString();
        notifyListeners();
      },
    );
  }

  @override
  void dispose() {
    super.dispose();
  }
}
```

---

## Notificaciones de Asistencias Médicas

### 1. Modelo de Datos para Asistencias

Crea `lib/models/attendance_model.dart`:

```dart
import 'package:json_annotation/json_annotation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'attendance_model.freezed.dart';
part 'attendance_model.g.dart';

@freezed
class AttendanceModel with _$AttendanceModel {
  const factory AttendanceModel({
    required String id,
    required String despachoId,
    required String paramedId,
    required String pacienteName,
    required String condition,
    required DateTime createdAt,
    required DateTime? updatedAt,
    required String estado, // PENDIENTE, EN_PROGRESO, COMPLETADO
    String? notas,
  }) = _AttendanceModel;

  factory AttendanceModel.fromJson(Map<String, dynamic> json) =>
      _$AttendanceModelFromJson(json);
}

@freezed
class PersonalEventModel with _$PersonalEventModel {
  const factory PersonalEventModel({
    required String id,
    required String personalId,
    required String personalName,
    required String personalRole,
    required String event, // creado, actualizado, estado_cambiado
    required Map<String, dynamic> data,
    required DateTime timestamp,
  }) = _PersonalEventModel;

  factory PersonalEventModel.fromJson(Map<String, dynamic> json) =>
      _$PersonalEventModelFromJson(json);
}
```

### 2. Servicio de Notificaciones

Crea `lib/services/notification_service.dart`:

```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:logger/logger.dart';
import '../models/attendance_model.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  late FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin;
  late Logger _logger;

  factory NotificationService() {
    return _instance;
  }

  NotificationService._internal() {
    _logger = Logger();
    _initializeNotifications();
  }

  /// Inicializa el servicio de notificaciones locales
  void _initializeNotifications() {
    _flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

    const AndroidInitializationSettings androidInitializationSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosInitializationSettings =
        DarwinInitializationSettings(
      requestSoundPermission: true,
      requestBadgePermission: true,
      requestAlertPermission: true,
    );

    const InitializationSettings initializationSettings =
        InitializationSettings(
      android: androidInitializationSettings,
      iOS: iosInitializationSettings,
    );

    _flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: _onSelectNotification,
    );

    _logger.i('Notification Service initialized');
  }

  /// Muestra notificación de nueva asistencia médica
  Future<void> showNewAttendanceNotification(
    AttendanceModel attendance,
  ) async {
    final title = 'Nueva Asistencia Médica';
    final body =
        'Paciente: ${attendance.pacienteName}\nEstado: ${attendance.condition}';

    await _showNotification(
      id: attendance.id.hashCode,
      title: title,
      body: body,
      payload: attendance.id,
    );
  }

  /// Muestra notificación de cambio de estado de personal
  Future<void> showPersonalStatusChangeNotification(
    PersonalEventModel event,
  ) async {
    final title = 'Cambio de Estado - ${event.personalName}';
    final body = 'Evento: ${event.event}\nHora: ${event.timestamp}';

    await _showNotification(
      id: event.id.hashCode,
      title: title,
      body: body,
      payload: event.id,
    );
  }

  /// Muestra notificación de llegada de ambulancia
  Future<void> showAmbulanceArrivalNotification({
    required String ambulanciaPlaca,
    required String ubicacion,
    required Duration estimatedTime,
  }) async {
    final title = 'Ambulancia en Ruta';
    final body =
        'Placa: $ambulanciaPlaca\nUbicación: $ubicacion\nTiempo estimado: ${estimatedTime.inMinutes} minutos';

    await _showNotification(
      id: ambulanciaPlaca.hashCode,
      title: title,
      body: body,
      payload: ambulanciaPlaca,
    );
  }

  /// Muestra notificación genérica
  Future<void> _showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      const AndroidNotificationDetails androidNotificationDetails =
          AndroidNotificationDetails(
        'high_importance_channel',
        'High Importance Notifications',
        channelDescription: 'This channel is used for important notifications.',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'ticker',
      );

      const DarwinNotificationDetails iosNotificationDetails =
          DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const NotificationDetails notificationDetails = NotificationDetails(
        android: androidNotificationDetails,
        iOS: iosNotificationDetails,
      );

      await _flutterLocalNotificationsPlugin.show(
        id,
        title,
        body,
        notificationDetails,
        payload: payload,
      );

      _logger.i('Notification shown: $title');
    } catch (e) {
      _logger.e('Error showing notification: $e');
    }
  }

  /// Maneja la selección de notificación
  void _onSelectNotification(NotificationResponse notificationResponse) {
    _logger.i('Notification tapped: ${notificationResponse.payload}');
    // Aquí puedes navegar a la pantalla correspondiente basada en el payload
  }

  /// Cancela todas las notificaciones
  Future<void> cancelAllNotifications() async {
    await _flutterLocalNotificationsPlugin.cancelAll();
    _logger.i('All notifications cancelled');
  }
}
```

### 3. Provider para Notificaciones de Asistencias

Crea `lib/providers/attendance_provider.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import '../services/graphql_service.dart';
import '../services/notification_service.dart';
import '../graphql/subscriptions.dart';
import '../models/attendance_model.dart';

class AttendanceProvider extends ChangeNotifier {
  final GraphQLService _graphqlService = GraphQLService();
  final NotificationService _notificationService = NotificationService();

  List<PersonalEventModel> _personalEvents = [];
  bool _isLoading = false;
  String? _error;

  List<PersonalEventModel> get personalEvents => _personalEvents;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Suscribirse a eventos de personal (nuevas asistencias)
  void subscribeToPersonalEvents() {
    _isLoading = true;
    notifyListeners();

    final options = SubscriptionOptions(
      document: gql(DispatchSubscriptions.eventOccurredSubscription),
      variables: {'eventType': 'personal.creado'},
    );

    _graphqlService.subscribe(options).listen(
      (result) {
        if (result.hasException) {
          _error = result.exception.toString();
          notifyListeners();
          return;
        }

        if (result.data != null) {
          final event = result.data?['eventOccurred'];
          if (event != null) {
            final personalEvent = PersonalEventModel.fromJson(event);
            _personalEvents.add(personalEvent);

            // Mostrar notificación
            _notificationService
                .showPersonalStatusChangeNotification(personalEvent);

            _error = null;
            notifyListeners();
          }
        }
      },
      onError: (error) {
        _error = error.toString();
        notifyListeners();
      },
    );
  }

  @override
  void dispose() {
    super.dispose();
  }
}
```

---

## Seguimiento de Ruta de Ambulancia

### 1. Modelo de Rastreo

Crea `lib/models/tracking_model.dart`:

```dart
import 'package:json_annotation/json_annotation.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'tracking_model.freezed.dart';
part 'tracking_model.g.dart';

@freezed
class LocationModel with _$LocationModel {
  const factory LocationModel({
    required double latitud,
    required double longitud,
    double? altitud,
    double? accuracyMeters,
  }) = _LocationModel;

  factory LocationModel.fromJson(Map<String, dynamic> json) =>
      _$LocationModelFromJson(json);
}

@freezed
class RastreoModel with _$RastreoModel {
  const factory RastreoModel({
    required String id,
    required String despachoId,
    required LocationModel ubicacion,
    double? velocidad,
    required DateTime timestamp,
  }) = _RastreoModel;

  factory RastreoModel.fromJson(Map<String, dynamic> json) =>
      _$RastreoModelFromJson(json);
}

@freezed
class AmbulanciaModel with _$AmbulanciaModel {
  const factory AmbulanciaModel({
    required String id,
    required String placa,
    required String estado,
    required LocationModel ubicacion,
    String? driverName,
    required bool disponibilidad,
    required DateTime ultimaActividad,
  }) = _AmbulanciaModel;

  factory AmbulanciaModel.fromJson(Map<String, dynamic> json) =>
      _$AmbulanciaModelFromJson(json);
}
```

### 2. Provider para Rastreo

Crea `lib/providers/tracking_provider.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import '../services/graphql_service.dart';
import '../graphql/subscriptions.dart';
import '../graphql/queries.dart';
import '../models/tracking_model.dart';

class TrackingProvider extends ChangeNotifier {
  final GraphQLService _graphqlService = GraphQLService();

  Map<String, RastreoModel> _latestLocations = {};
  List<RastreoModel> _rastreoHistory = [];
  Map<String, AmbulanciaModel> _ambulancias = {};
  bool _isLoading = false;
  String? _error;

  Map<String, RastreoModel> get latestLocations => _latestLocations;
  List<RastreoModel> get rastreoHistory => _rastreoHistory;
  Map<String, AmbulanciaModel> get ambulancias => _ambulancias;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Obtener historial de rastreo de un despacho
  Future<void> fetchRastreoHistoria(String despachoId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final options = QueryOptions(
        document: gql(DispatchQueries.getRastreoHistoriaQuery),
        variables: {
          'despachoId': despachoId,
          'limit': 100,
        },
      );

      final result = await _graphqlService.query(options);

      if (result.hasException) {
        _error = result.exception.toString();
        notifyListeners();
        return;
      }

      if (result.data != null) {
        final data = result.data?['rastreoHistoria'] as List?;
        if (data != null) {
          _rastreoHistory = data
              .map((item) => RastreoModel.fromJson(item as Map<String, dynamic>))
              .toList();
          _error = null;
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Suscribirse a actualizaciones de ubicación en tiempo real
  void subscribeToLocationUpdates(String despachoId) {
    final options = SubscriptionOptions(
      document: gql(DispatchSubscriptions.locationUpdatedSubscription),
      variables: {'despachoId': despachoId},
    );

    _graphqlService.subscribe(options).listen(
      (result) {
        if (result.hasException) {
          _error = result.exception.toString();
          notifyListeners();
          return;
        }

        if (result.data != null) {
          final update = result.data?['locationUpdated'];
          if (update != null) {
            final rastreo = RastreoModel.fromJson(update['rastreo']);
            _latestLocations[despachoId] = rastreo;
            _rastreoHistory.add(rastreo);
            _error = null;
            notifyListeners();
          }
        }
      },
      onError: (error) {
        _error = error.toString();
        notifyListeners();
      },
    );
  }

  /// Suscribirse a cambios de ubicación de ambulancia
  void subscribeToAmbulanciaLocationUpdates(String ambulanciaId) {
    final options = SubscriptionOptions(
      document: gql(DispatchSubscriptions.ambulanciaLocationUpdatedSubscription),
      variables: {'ambulanciaId': ambulanciaId},
    );

    _graphqlService.subscribe(options).listen(
      (result) {
        if (result.hasException) {
          _error = result.exception.toString();
          notifyListeners();
          return;
        }

        if (result.data != null) {
          final ambulancia = result.data?['ambulanciaLocationUpdated'];
          if (ambulancia != null) {
            final ambulanciaModel = AmbulanciaModel.fromJson(ambulancia);
            _ambulancias[ambulanciaId] = ambulanciaModel;
            _error = null;
            notifyListeners();
          }
        }
      },
      onError: (error) {
        _error = error.toString();
        notifyListeners();
      },
    );
  }

  /// Obtener ambulancias disponibles por ubicación
  Future<void> fetchAmbulanciasByLocation({
    required double latitud,
    required double longitud,
    required double radiusKm,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final options = QueryOptions(
        document: gql(DispatchQueries.getAmbulanciasByLocationQuery),
        variables: {
          'latitud': latitud,
          'longitud': longitud,
          'radiusKm': radiusKm,
        },
      );

      final result = await _graphqlService.query(options);

      if (result.hasException) {
        _error = result.exception.toString();
        notifyListeners();
        return;
      }

      if (result.data != null) {
        final data = result.data?['ambulanciasByUbicacion'] as List?;
        if (data != null) {
          _ambulancias = {
            for (var item in data)
              AmbulanciaModel.fromJson(item as Map<String, dynamic>).id:
                  AmbulanciaModel.fromJson(item as Map<String, dynamic>)
          };
          _error = null;
        }
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}
```

### 3. Widget para Mostrar Rastreo en Mapa

Crea `lib/widgets/tracking_map_widget.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/tracking_provider.dart';
import '../models/tracking_model.dart';

class TrackingMapWidget extends StatefulWidget {
  final String despachoId;
  final String ambulanciaId;

  const TrackingMapWidget({
    Key? key,
    required this.despachoId,
    required this.ambulanciaId,
  }) : super(key: key);

  @override
  State<TrackingMapWidget> createState() => _TrackingMapWidgetState();
}

class _TrackingMapWidgetState extends State<TrackingMapWidget> {
  late GoogleMapController mapController;

  @override
  void initState() {
    super.initState();
    _initializeTracking();
  }

  void _initializeTracking() {
    final trackingProvider =
        Provider.of<TrackingProvider>(context, listen: false);
    trackingProvider.subscribeToLocationUpdates(widget.despachoId);
    trackingProvider.subscribeToAmbulanciaLocationUpdates(widget.ambulanciaId);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<TrackingProvider>(
      builder: (context, trackingProvider, child) {
        final latestLocation =
            trackingProvider.latestLocations[widget.despachoId];
        final ambulancia =
            trackingProvider.ambulancias[widget.ambulanciaId];

        if (latestLocation == null || ambulancia == null) {
          return const Center(
            child: CircularProgressIndicator(),
          );
        }

        return GoogleMap(
          onMapCreated: (controller) {
            mapController = controller;
          },
          initialCameraPosition: CameraPosition(
            target: LatLng(
              latestLocation.ubicacion.latitud,
              latestLocation.ubicacion.longitud,
            ),
            zoom: 15,
          ),
          markers: {
            Marker(
              markerId: MarkerId(widget.ambulanciaId),
              position: LatLng(
                ambulancia.ubicacion.latitud,
                ambulancia.ubicacion.longitud,
              ),
              infoWindow: InfoWindow(
                title: 'Ambulancia ${ambulancia.placa}',
                snippet:
                    'Velocidad: ${latestLocation.velocidad?.toStringAsFixed(2)} km/h',
              ),
            ),
          },
          polylines: {
            if (trackingProvider.rastreoHistory.isNotEmpty)
              Polyline(
                polylineId: const PolylineId('route'),
                points: trackingProvider.rastreoHistory
                    .map((rastreo) =>
                        LatLng(rastreo.ubicacion.latitud,
                            rastreo.ubicacion.longitud))
                    .toList(),
                color: Colors.blue,
                width: 4,
              ),
          },
        );
      },
    );
  }
}
```

---

## Mejores Prácticas

### 1. Manejo de Errores y Reintentos

```dart
class RetryableGraphQLService {
  final GraphQLService _graphqlService = GraphQLService();
  final int maxRetries = 3;
  final Duration retryDelay = const Duration(seconds: 2);

  Future<QueryResult> queryWithRetry(QueryOptions options) async {
    int attempts = 0;

    while (attempts < maxRetries) {
      try {
        final result = await _graphqlService.query(options);
        if (!result.hasException) {
          return result;
        }

        // Si hay excepción, reintentar
        attempts++;
        if (attempts < maxRetries) {
          await Future.delayed(retryDelay * attempts);
        }
      } catch (e) {
        attempts++;
        if (attempts >= maxRetries) rethrow;
        await Future.delayed(retryDelay * attempts);
      }
    }

    throw Exception('Max retries exceeded');
  }
}
```

### 2. Caché Local

```dart
class CachedDispatchRepository {
  final GraphQLService _graphqlService = GraphQLService();
  final Box<DispatchModel> _dispatchBox;
  final Duration cacheExpiration = const Duration(minutes: 5);

  CachedDispatchRepository(this._dispatchBox);

  Future<DispatchModel?> getDispatchWithCache(String id) async {
    // Intentar obtener del caché primero
    final cached = _dispatchBox.get(id);
    if (cached != null) {
      return cached;
    }

    // Si no está en caché, obtener del servidor
    final options = QueryOptions(
      document: gql(DispatchQueries.getDispatchQuery),
      variables: {'id': id},
    );

    final result = await _graphqlService.query(options);

    if (!result.hasException && result.data != null) {
      final dispatch = DispatchModel.fromJson(result.data?['dispatch']);
      await _dispatchBox.put(id, dispatch);
      return dispatch;
    }

    return null;
  }
}
```

### 3. Gestión de Suscripciones

```dart
class SubscriptionManager {
  final Map<String, StreamSubscription> _subscriptions = {};

  void addSubscription(String key, StreamSubscription subscription) {
    _subscriptions[key] = subscription;
  }

  void cancelSubscription(String key) {
    _subscriptions[key]?.cancel();
    _subscriptions.remove(key);
  }

  void cancelAllSubscriptions() {
    for (var subscription in _subscriptions.values) {
      subscription.cancel();
    }
    _subscriptions.clear();
  }
}
```

### 4. Logging Centralizado

```dart
class GraphQLLogger {
  static final Logger _logger = Logger();

  static void logQuery(String query, Map<String, dynamic> variables) {
    _logger.d('GraphQL Query: $query\nVariables: $variables');
  }

  static void logError(String operation, dynamic error) {
    _logger.e('GraphQL Error ($operation): $error');
  }

  static void logSubscription(String subscription) {
    _logger.i('GraphQL Subscription: $subscription');
  }
}
```

---

## Solución de Problemas

### 1. Conexión WebSocket Fallida

**Problema:** El cliente no puede conectarse a WebSocket.

**Solución:**
```dart
// Verificar que la URL de WebSocket sea correcta
String wsUrl = dotenv.env['GRAPHQL_WS_URL'] ?? 'ws://127.0.0.1:3001/graphql';

// Verificar que el servidor está ejecutándose
// En terminal: curl http://127.0.0.1:3001/health

// Verificar CORS
// Asegúrate de que CORS_ORIGIN en el servidor incluya tu dominio
```

### 2. Autenticación Fallida

**Problema:** Token expirado o inválido.

**Solución:**
```dart
// Implementar refresh de token automático
Future<void> setupTokenRefresh() async {
  Timer.periodic(const Duration(minutes: 55), (timer) async {
    if (AuthService().isAuthenticated) {
      final success = await AuthService().refreshAccessToken();
      if (!success) {
        // Redirigir al login
        navigateToLogin();
      }
    }
  });
}
```

### 3. Suscripciones No Reciben Datos

**Problema:** Las suscripciones están activas pero no reciben actualizaciones.

**Solución:**
```dart
// 1. Verificar que la variable de suscripción coincida con el servidor
// 2. Verificar que el canal de Redis en el servidor esté correctamente configurado
// 3. Usar logging para debugging
void subscribeWithLogging(String channel) {
  final options = SubscriptionOptions(
    document: gql(subscription),
    variables: {'id': channel},
  );

  graphqlService.subscribe(options).listen(
    (result) {
      logger.i('Subscription data received: ${result.data}');
    },
    onError: (error) {
      logger.e('Subscription error: $error');
    },
  );
}
```

### 4. Alto Consumo de Memoria

**Problema:** La aplicación consume mucha memoria con múltiples suscripciones.

**Solución:**
```dart
// Implementar límites en la cantidad de eventos almacenados
const int maxEventsStored = 1000;

void addEvent(Event event) {
  events.add(event);
  if (events.length > maxEventsStored) {
    events.removeAt(0); // FIFO
  }
}

// Cancelar suscripciones cuando no se usan
@override
void dispose() {
  subscriptionManager.cancelAllSubscriptions();
  super.dispose();
}
```

---

## Variables de Entorno Recomendadas

```env
# Server Configuration
FLUTTER_ENV=development
GRAPHQL_HOST=127.0.0.1
GRAPHQL_PORT=3001
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://127.0.0.1:3001/graphql

# Production
GRAPHQL_HOST_PROD=api.tudominio.com
GRAPHQL_WS_URL_PROD=wss://api.tudominio.com/graphql

# Authentication
AUTH_TOKEN_KEY=auth_token
AUTH_REFRESH_TOKEN_KEY=refresh_token
TOKEN_EXPIRATION_HOURS=24

# Timeouts
WEBSOCKET_TIMEOUT=30000
CONNECTION_TIMEOUT=10000
QUERY_TIMEOUT=15000

# Cache
CACHE_EXPIRATION_MINUTES=5
MAX_CACHE_SIZE_MB=100

# Notifications
ENABLE_LOCAL_NOTIFICATIONS=true
NOTIFICATION_SOUND_ENABLED=true
```

---

## Testing

### Ejemplo de Test para GraphQL Service

```dart
void main() {
  group('GraphQLService Tests', () {
    late GraphQLService graphqlService;

    setUp(() {
      graphqlService = GraphQLService();
    });

    test('Should initialize successfully', () async {
      await graphqlService.initialize(authToken: 'test-token');
      expect(graphqlService.client, isNotNull);
    });

    test('Should handle query errors', () async {
      final options = QueryOptions(
        document: gql('query { invalidQuery }'),
      );

      final result = await graphqlService.query(options);
      expect(result.hasException, true);
    });

    test('Should update token', () {
      graphqlService.updateToken('new-token');
      // Verificar que el token fue actualizado
    });
  });
}
```

---

## Resumen de Endpoints Disponibles

### Queries (Lecturas)
- `dispatch(id)` - Obtener despacho por ID
- `despachos(estado, limit, offset)` - Listar despachos
- `onlineUsers(limit)` - Usuarios conectados
- `rastreoHistoria(despachoId)` - Historial de ubicaciones
- `ambulanciasByUbicacion(lat, lon, radius)` - Ambulancias cercanas

### Mutations (Escrituras)
- `createDispatch()` - Crear nuevo despacho
- `updateDispatchStatus()` - Cambiar estado
- `updateLocation()` - Actualizar ubicación
- `broadcastMessage()` - Enviar mensaje
- `updateUserStatus()` - Cambiar estado de usuario

### Subscriptions (Tiempo Real)
- `dispatchCreated` - Nuevo despacho
- `dispatchStatusChanged()` - Cambio de estado
- `locationUpdated()` - Actualización de ubicación
- `ambulanciaLocationUpdated()` - Ubicación de ambulancia
- `userStatusChanged()` - Cambio de estado de usuario
- `messageBroadcast()` - Mensajes de canal

---

## Referencias y Recursos

- [Apollo Client Documentation](https://www.apollographql.com/docs/flutter/)
- [GraphQL Flutter Package](https://pub.dev/packages/graphql_flutter)
- [Socket.io Documentation](https://socket.io/docs/)
- [Flutter Local Notifications](https://pub.dev/packages/flutter_local_notifications)
- [Google Maps Flutter](https://pub.dev/packages/google_maps_flutter)

