# ⚡ Quick Start - Flutter + Apollo GraphQL en 30 Minutos

¿Tienes prisa? Esta guía te lleva desde cero a una app funcional en 30 minutos.

## Paso 1: Crear Proyecto (5 min)

```bash
# Crear proyecto nuevo
flutter create ambulance_dispatch

# Entrar a carpeta
cd ambulance_dispatch

# Obtener dependencias
flutter pub get

# Verificar todo está bien
flutter doctor
```

## Paso 2: Agregar Dependencias (5 min)

Abre `pubspec.yaml` y reemplaza `dependencies:` con:

```yaml
dependencies:
  flutter:
    sdk: flutter
  graphql_flutter: ^5.1.0
  web_socket_channel: ^2.4.0
  jwt_decoder: ^2.0.1
  shared_preferences: ^2.2.0
  provider: ^6.0.0
  logger: ^2.0.0
  flutter_dotenv: ^5.1.0

dev_dependencies:
  flutter_test:
    sdk: flutter
```

Luego corre:
```bash
flutter pub get
```

## Paso 3: Crear .env (2 min)

Crea archivo `.env` en raíz del proyecto:

```env
FLUTTER_ENV=development
GRAPHQL_HOST=127.0.0.1
GRAPHQL_PORT=3001
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://127.0.0.1:3001/graphql
DEBUG_GRAPHQL=true
LOG_LEVEL=DEBUG
```

## Paso 4: GraphQL Service (5 min)

Crea `lib/services/graphql_service.dart`:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

class GraphQLService {
  static final GraphQLService _instance = GraphQLService._internal();
  late GraphQLClient _client;
  String? _authToken;

  factory GraphQLService() => _instance;

  GraphQLService._internal();

  Future<void> initialize({required String authToken}) async {
    _authToken = authToken;

    final httpLink = HttpLink(
      'http://${dotenv.env['GRAPHQL_HOST']}:${dotenv.env['GRAPHQL_PORT']}/graphql',
    );

    final authLink = AuthLink(
      getToken: () async => 'Bearer $_authToken',
    );

    final link = authLink.concat(httpLink);

    _client = GraphQLClient(
      link: link,
      cache: GraphQLCache(store: HiveStore()),
    );
  }

  GraphQLClient get client => _client;

  Future<QueryResult> query(QueryOptions options) async {
    return await _client.query(options);
  }

  Future<QueryResult> mutate(MutationOptions options) async {
    return await _client.mutate(options);
  }

  Stream<QueryResult> subscribe(SubscriptionOptions options) {
    return _client.subscribe(options);
  }
}
```

## Paso 5: Auth Service (5 min)

Crea `lib/services/auth_service.dart`:

```dart
import 'package:shared_preferences/shared_preferences.dart';
import 'package:jwt_decoder/jwt_decoder.dart';
import 'graphql_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  late SharedPreferences _prefs;
  String? _currentToken;

  factory AuthService() => _instance;

  AuthService._internal();

  Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    _currentToken = _prefs.getString('auth_token');
  }

  Future<bool> login({required String token}) async {
    if (JwtDecoder.isExpired(token)) return false;

    _currentToken = token;
    await _prefs.setString('auth_token', token);
    await GraphQLService().initialize(authToken: token);

    return true;
  }

  Future<void> logout() async {
    _currentToken = null;
    await _prefs.remove('auth_token');
  }

  bool get isAuthenticated => _currentToken != null && !JwtDecoder.isExpired(_currentToken!);
  String? get currentToken => _currentToken;
}
```

## Paso 6: Crear Queries (3 min)

Crea `lib/graphql/queries.dart`:

```dart
import 'package:graphql_flutter/graphql_flutter.dart';

class DispatchQueries {
  static const String getDispatchesQuery = r'''
    query GetDispatches($limit: Int) {
      despachos(limit: $limit) {
        id
        numero
        estado
        paciente
        ambulanciaPlaca
        driverName
        fechaCreacion
      }
    }
  ''';
}
```

## Paso 7: Provider de Estado (5 min)

Crea `lib/providers/dispatch_provider.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import '../services/graphql_service.dart';
import '../graphql/queries.dart';

class DispatchProvider extends ChangeNotifier {
  final GraphQLService _graphql = GraphQLService();
  List<dynamic> _dispatches = [];
  bool _loading = false;

  List<dynamic> get dispatches => _dispatches;
  bool get loading => _loading;

  Future<void> fetchDispatches() async {
    _loading = true;
    notifyListeners();

    try {
      final options = QueryOptions(
        document: gql(DispatchQueries.getDispatchesQuery),
        variables: {'limit': 50},
      );

      final result = await _graphql.query(options);

      if (!result.hasException) {
        _dispatches = result.data?['despachos'] ?? [];
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
```

## Paso 8: UI Principal (5 min)

Reemplaza `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/graphql_service.dart';
import 'providers/dispatch_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');

  final authService = AuthService();
  await authService.initialize();

  // Token de prueba - reemplaza con tu token real
  if (!authService.isAuthenticated) {
    await authService.login(token: 'your-jwt-token-here');
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => DispatchProvider()),
      ],
      child: MaterialApp(
        title: 'Dispatch',
        theme: ThemeData(primarySwatch: Colors.blue),
        home: const HomeScreen(),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    Provider.of<DispatchProvider>(context, listen: false).fetchDispatches();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Despachos'),
      ),
      body: Consumer<DispatchProvider>(
        builder: (context, provider, _) {
          if (provider.loading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.dispatches.isEmpty) {
            return const Center(child: Text('Sin despachos'));
          }

          return ListView.builder(
            itemCount: provider.dispatches.length,
            itemBuilder: (context, index) {
              final dispatch = provider.dispatches[index];
              return ListTile(
                title: Text('Despacho #${dispatch['numero']}'),
                subtitle: Text(dispatch['paciente'] ?? 'Sin paciente'),
                trailing: Text(dispatch['estado']),
              );
            },
          );
        },
      ),
    );
  }
}
```

## Paso 9: Ejecutar Aplicación (1 min)

```bash
# Verificar que el servidor está corriendo en puerto 3001
curl http://127.0.0.1:3001/health

# Si OK, ejecutar la app
flutter run
```

## ✅ ¡Listo! Tu App Funciona

Ya tienes una app Flutter conectada a Apollo GraphQL mostrando despachos en tiempo real.

## 🔄 Próximos Pasos

Para agregar más funcionalidades:

1. **Suscripciones en tiempo real:**
   ```dart
   // En dispatch_provider.dart
   void subscribeToUpdates() {
     final options = SubscriptionOptions(
       document: gql('''
         subscription {
           dispatchCreated {
             id
             numero
             estado
           }
         }
       '''),
     );

     _graphql.subscribe(options).listen((result) {
       if (result.data != null) {
         _dispatches.add(result.data?['dispatchCreated']);
         notifyListeners();
       }
     });
   }
   ```

2. **Notifications:**
   Instala `flutter_local_notifications` y muestra alerts

3. **Maps:**
   Instala `google_maps_flutter` para rastreo

4. **Más pantallas:**
   Copia el patrón de `HomeScreen` para otras pantallas

## 📚 Documentación Completa

Para más detalles, lee:
- `FLUTTER_APOLLO_GRAPHQL_GUIDE.md` - Guía completa
- `FLUTTER_UI_EXAMPLES.md` - Ejemplos de UI
- `FLUTTER_DEPLOYMENT_GUIDE.md` - Deploy a stores

## 🐛 Debugging

Si algo no funciona:

```bash
# Ver logs detallados
flutter run -v

# Limpiar y rebuild
flutter clean && flutter pub get && flutter run

# Verificar servidor
curl http://127.0.0.1:3001/status
```

## 💡 Tips Rápidos

- Reemplaza `'your-jwt-token-here'` con un token real
- El servidor debe estar corriendo en `http://127.0.0.1:3001`
- Verifica CORS está habilitado en el servidor
- Usa `flutter format lib/` para formatear código
- Ejecuta `flutter analyze` para verificar problemas

## ⏱️ Tiempo Total: ~30 minutos

Felicitaciones, ¡acabas de crear una app Flutter con Apollo GraphQL! 🎉

