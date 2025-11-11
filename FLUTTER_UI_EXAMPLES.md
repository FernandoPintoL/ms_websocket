# Ejemplos de UI y Patrones de Pantallas en Flutter

## Índice
1. [Pantalla de Autenticación](#pantalla-de-autenticación)
2. [Pantalla Principal del Paramédico](#pantalla-principal-del-paramédico)
3. [Pantalla de Notificaciones de Asistencias](#pantalla-de-notificaciones-de-asistencias)
4. [Pantalla de Seguimiento de Ruta](#pantalla-de-seguimiento-de-ruta)
5. [Pantalla de Comunicación Central-Paramédico](#pantalla-de-comunicación-central-paramédico)
6. [Componentes Reutilizables](#componentes-reutilizables)

---

## Pantalla de Autenticación

Crea `lib/screens/auth_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/graphql_service.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({Key? key}) : super(key: key);

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _emailController;
  late TextEditingController _passwordController;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final email = _emailController.text;
      final password = _passwordController.text;

      // Aquí iría la llamada al endpoint de login en el servidor
      // Este es un ejemplo simplificado
      final token = await _loginWithCredentials(email, password);

      if (!mounted) return;

      // Inicializar Apollo Client
      await GraphQLService().initialize(authToken: token);

      // Guardar token
      final authService = AuthService();
      await authService.login(token: token);

      // Navegar a la pantalla principal
      Navigator.of(context).pushReplacementNamed('/home');
    } catch (error) {
      setState(() {
        _errorMessage = error.toString();
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<String> _loginWithCredentials(String email, String password) async {
    // TODO: Implementar llamada al servidor
    await Future.delayed(const Duration(seconds: 2));
    return 'mock-jwt-token';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Acceso Central de Despachos'),
        centerTitle: true,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Logo
                Container(
                  height: 120,
                  margin: const EdgeInsets.only(bottom: 40),
                  decoration: BoxDecoration(
                    color: Colors.blue[100],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.local_hospital,
                    size: 60,
                    color: Colors.blue,
                  ),
                ),

                // Email Field
                TextFormField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Correo Electrónico',
                    prefixIcon: const Icon(Icons.email),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  validator: (value) {
                    if (value?.isEmpty ?? true) {
                      return 'El correo es requerido';
                    }
                    if (!value!.contains('@')) {
                      return 'Ingresa un correo válido';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 16),

                // Password Field
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Contraseña',
                    prefixIcon: const Icon(Icons.lock),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  validator: (value) {
                    if (value?.isEmpty ?? true) {
                      return 'La contraseña es requerida';
                    }
                    if (value!.length < 6) {
                      return 'Mínimo 6 caracteres';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 24),

                // Error Message
                if (_errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[100],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: TextStyle(color: Colors.red[900]),
                    ),
                  ),

                const SizedBox(height: 24),

                // Login Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Ingresar'),
                ),

                const SizedBox(height: 16),

                // Help Text
                Center(
                  child: Text(
                    '¿Problemas para acceder? Contacta al administrador',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

---

## Pantalla Principal del Paramédico

Crea `lib/screens/paramedic_home_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/dispatch_provider.dart';
import '../providers/attendance_provider.dart';
import '../widgets/dispatch_card.dart';

class ParamedicHomeScreen extends StatefulWidget {
  const ParamedicHomeScreen({Key? key}) : super(key: key);

  @override
  State<ParamedicHomeScreen> createState() => _ParamedicHomeScreenState();
}

class _ParamedicHomeScreenState extends State<ParamedicHomeScreen> {
  @override
  void initState() {
    super.initState();
    _initializeProviders();
  }

  void _initializeProviders() {
    // Inicializar suscripciones de despachos
    Provider.of<DispatchProvider>(context, listen: false)
        .subscribeToNewDispatches();

    // Inicializar suscripciones de asistencias
    Provider.of<AttendanceProvider>(context, listen: false)
        .subscribeToPersonalEvents();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Centro de Despachos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications),
            onPressed: () {
              Navigator.of(context).pushNamed('/notifications');
            },
          ),
          IconButton(
            icon: const Icon(Icons.account_circle),
            onPressed: () {
              Navigator.of(context).pushNamed('/profile');
            },
          ),
        ],
      ),
      body: DefaultTabController(
        length: 3,
        child: Column(
          children: [
            TabBar(
              tabs: const [
                Tab(text: 'Activos', icon: Icon(Icons.pending_actions)),
                Tab(text: 'Historial', icon: Icon(Icons.history)),
                Tab(text: 'Estadísticas', icon: Icon(Icons.bar_chart)),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: [
                  // Tab 1: Despachos Activos
                  Consumer<DispatchProvider>(
                    builder: (context, dispatchProvider, child) {
                      if (dispatchProvider.isLoading) {
                        return const Center(
                          child: CircularProgressIndicator(),
                        );
                      }

                      if (dispatchProvider.error != null) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.error_outline,
                                size: 48,
                                color: Colors.red,
                              ),
                              const SizedBox(height: 16),
                              Text('Error: ${dispatchProvider.error}'),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: dispatchProvider.subscribeToNewDispatches,
                                child: const Text('Reintentar'),
                              ),
                            ],
                          ),
                        );
                      }

                      final dispatches = dispatchProvider.dispatches
                          .where((d) =>
                              d.estado != DispatchStatus.completed &&
                              d.estado != DispatchStatus.cancelled)
                          .toList();

                      if (dispatches.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.check_circle_outline,
                                size: 48,
                                color: Colors.green[300],
                              ),
                              const SizedBox(height: 16),
                              const Text('No hay despachos activos'),
                            ],
                          ),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: dispatches.length,
                        itemBuilder: (context, index) {
                          return DispatchCard(
                            dispatch: dispatches[index],
                            onTap: () {
                              Navigator.of(context).pushNamed(
                                '/dispatch-detail',
                                arguments: dispatches[index].id,
                              );
                            },
                          );
                        },
                      );
                    },
                  ),

                  // Tab 2: Historial
                  const DispatchHistoryTab(),

                  // Tab 3: Estadísticas
                  const DispatchStatsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).pushNamed('/new-dispatch');
        },
        label: const Text('Nuevo Despacho'),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class DispatchHistoryTab extends StatelessWidget {
  const DispatchHistoryTab({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<DispatchProvider>(
      builder: (context, dispatchProvider, child) {
        final history = dispatchProvider.dispatches
            .where((d) =>
                d.estado == DispatchStatus.completed ||
                d.estado == DispatchStatus.cancelled)
            .toList();

        if (history.isEmpty) {
          return const Center(
            child: Text('Sin historial'),
          );
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: history.length,
          itemBuilder: (context, index) {
            return DispatchCard(
              dispatch: history[index],
              isHistorical: true,
            );
          },
        );
      },
    );
  }
}

class DispatchStatsTab extends StatelessWidget {
  const DispatchStatsTab({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Consumer<DispatchProvider>(
      builder: (context, dispatchProvider, child) {
        final total = dispatchProvider.dispatches.length;
        final completed = dispatchProvider.dispatches
            .where((d) => d.estado == DispatchStatus.completed)
            .length;
        final inProgress = dispatchProvider.dispatches
            .where((d) => d.estado == DispatchStatus.inRoute)
            .length;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              StatCard(
                title: 'Total de Despachos',
                value: total.toString(),
                color: Colors.blue,
              ),
              const SizedBox(height: 16),
              StatCard(
                title: 'En Progreso',
                value: inProgress.toString(),
                color: Colors.orange,
              ),
              const SizedBox(height: 16),
              StatCard(
                title: 'Completados',
                value: completed.toString(),
                color: Colors.green,
              ),
            ],
          ),
        );
      },
    );
  }
}

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final Color color;

  const StatCard({
    Key? key,
    required this.title,
    required this.value,
    required this.color,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        border: Border.all(color: color.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
          ),
        ],
      ),
    );
  }
}
```

---

## Pantalla de Notificaciones de Asistencias

Crea `lib/screens/notifications_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/attendance_provider.dart';
import '../models/attendance_model.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({Key? key}) : super(key: key);

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    Provider.of<AttendanceProvider>(context, listen: false)
        .subscribeToPersonalEvents();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones de Asistencias'),
      ),
      body: Consumer<AttendanceProvider>(
        builder: (context, attendanceProvider, child) {
          final events = attendanceProvider.personalEvents;

          if (events.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off,
                    size: 48,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  const Text('Sin notificaciones'),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: events.length,
            itemBuilder: (context, index) {
              final event = events[index];
              return NotificationCard(event: event);
            },
          );
        },
      ),
    );
  }
}

class NotificationCard extends StatelessWidget {
  final PersonalEventModel event;

  const NotificationCard({
    Key? key,
    required this.event,
  }) : super(key: key);

  Color _getEventColor() {
    switch (event.event) {
      case 'creado':
        return Colors.green;
      case 'actualizado':
        return Colors.blue;
      case 'estado_cambiado':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  IconData _getEventIcon() {
    switch (event.event) {
      case 'creado':
        return Icons.check_circle;
      case 'actualizado':
        return Icons.edit;
      case 'estado_cambiado':
        return Icons.info;
      default:
        return Icons.notifications;
    }
  }

  String _getEventLabel() {
    switch (event.event) {
      case 'creado':
        return 'Nueva Asistencia';
      case 'actualizado':
        return 'Asistencia Actualizada';
      case 'estado_cambiado':
        return 'Cambio de Estado';
      default:
        return 'Notificación';
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getEventColor();
    final timestamp = DateFormat('HH:mm - dd/MM/yyyy').format(event.timestamp);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.2),
          child: Icon(
            _getEventIcon(),
            color: color,
          ),
        ),
        title: Text(_getEventLabel()),
        subtitle: Text(event.personalName),
        trailing: Text(
          timestamp,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Personal: ',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    Text(event.personalName),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      'Rol: ',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    Text(event.personalRole),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      'Hora: ',
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                    Text(timestamp),
                  ],
                ),
                const SizedBox(height: 12),
                if (event.data.isNotEmpty)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Detalles',
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          event.data.toString(),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Pantalla de Seguimiento de Ruta

Crea `lib/screens/tracking_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../providers/tracking_provider.dart';
import '../widgets/tracking_map_widget.dart';

class TrackingScreen extends StatefulWidget {
  final String despachoId;
  final String ambulanciaId;

  const TrackingScreen({
    Key? key,
    required this.despachoId,
    required this.ambulanciaId,
  }) : super(key: key);

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _initializeTracking();
  }

  void _initializeTracking() {
    final trackingProvider =
        Provider.of<TrackingProvider>(context, listen: false);
    trackingProvider.fetchRastreoHistoria(widget.despachoId);
    trackingProvider.subscribeToLocationUpdates(widget.despachoId);
    trackingProvider.subscribeToAmbulanciaLocationUpdates(widget.ambulanciaId);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Seguimiento de Ambulancia'),
      ),
      body: Consumer<TrackingProvider>(
        builder: (context, trackingProvider, child) {
          final latestLocation =
              trackingProvider.latestLocations[widget.despachoId];
          final ambulancia =
              trackingProvider.ambulancias[widget.ambulanciaId];

          return Column(
            children: [
              // Mapa
              Expanded(
                flex: 2,
                child: TrackingMapWidget(
                  despachoId: widget.despachoId,
                  ambulanciaId: widget.ambulanciaId,
                ),
              ),

              // Información de la Ambulancia
              Expanded(
                flex: 1,
                child: SingleChildScrollView(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (ambulancia != null) ...[
                          Text(
                            'Información de la Ambulancia',
                            style:
                                Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 16),
                          _buildInfoRow(
                            'Placa',
                            ambulancia.placa,
                            Icons.directions_car,
                          ),
                          _buildInfoRow(
                            'Conductor',
                            ambulancia.driverName ?? 'No asignado',
                            Icons.person,
                          ),
                          _buildInfoRow(
                            'Estado',
                            ambulancia.estado,
                            Icons.info,
                          ),
                          if (latestLocation != null)
                            _buildInfoRow(
                              'Velocidad',
                              '${latestLocation.velocidad?.toStringAsFixed(2) ?? '0'} km/h',
                              Icons.speed,
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.blue),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                ),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Pantalla de Comunicación Central-Paramédico

Crea `lib/screens/communication_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/dispatch_provider.dart';
import '../services/graphql_service.dart';
import '../graphql/mutations.dart';

class CommunicationScreen extends StatefulWidget {
  final String despachoId;
  final String recipientId;

  const CommunicationScreen({
    Key? key,
    required this.despachoId,
    required this.recipientId,
  }) : super(key: key);

  @override
  State<CommunicationScreen> createState() => _CommunicationScreenState();
}

class _CommunicationScreenState extends State<CommunicationScreen> {
  late TextEditingController _messageController;
  final List<ChatMessage> _messages = [];
  late ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _messageController = TextEditingController();
    _scrollController = ScrollController();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage(String message) async {
    if (message.trim().isEmpty) return;

    // Agregar mensaje localmente primero (optimistic update)
    setState(() {
      _messages.add(
        ChatMessage(
          id: DateTime.now().toString(),
          text: message,
          sender: 'current_user',
          timestamp: DateTime.now(),
          status: MessageStatus.sending,
        ),
      );
    });

    _messageController.clear();
    _scrollToBottom();

    try {
      final options = MutationOptions(
        document: gql(DispatchMutations.sendDirectMessageMutation),
        variables: {
          'userId': widget.recipientId,
          'message': message,
        },
      );

      final result = await GraphQLService().mutate(options);

      if (result.hasException) {
        // Marcar como error
        if (mounted) {
          setState(() {
            _messages.last.status = MessageStatus.error;
          });
        }
        return;
      }

      // Marcar como enviado
      if (mounted) {
        setState(() {
          _messages.last.status = MessageStatus.sent;
        });
      }
    } catch (e) {
      // Marcar como error
      if (mounted) {
        setState(() {
          _messages.last.status = MessageStatus.error;
        });
      }
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Comunicación'),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Área de mensajes
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                return _buildMessageBubble(_messages[index]);
              },
            ),
          ),

          // Área de entrada
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: InputDecoration(
                      hintText: 'Escribir mensaje...',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      prefixIcon: const Icon(Icons.message),
                    ),
                    maxLines: null,
                    textInputAction: TextInputAction.newline,
                  ),
                ),
                const SizedBox(width: 8),
                FloatingActionButton(
                  mini: true,
                  onPressed: () {
                    _sendMessage(_messageController.text);
                  },
                  child: const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage message) {
    final isCurrentUser = message.sender == 'current_user';

    return Align(
      alignment: isCurrentUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.7,
        ),
        decoration: BoxDecoration(
          color: isCurrentUser ? Colors.blue[500] : Colors.grey[300],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment:
              isCurrentUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              message.text,
              style: TextStyle(
                color: isCurrentUser ? Colors.white : Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(message.timestamp),
                  style: TextStyle(
                    fontSize: 12,
                    color: isCurrentUser
                        ? Colors.white.withOpacity(0.7)
                        : Colors.grey[600],
                  ),
                ),
                if (isCurrentUser) ...[
                  const SizedBox(width: 4),
                  _buildStatusIcon(message.status),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIcon(MessageStatus status) {
    switch (status) {
      case MessageStatus.sending:
        return SizedBox(
          width: 12,
          height: 12,
          child: CircularProgressIndicator(
            strokeWidth: 1,
            valueColor: AlwaysStoppedAnimation<Color>(
              Colors.white.withOpacity(0.7),
            ),
          ),
        );
      case MessageStatus.sent:
        return Icon(
          Icons.done,
          size: 12,
          color: Colors.white.withOpacity(0.7),
        );
      case MessageStatus.error:
        return Icon(
          Icons.error,
          size: 12,
          color: Colors.red[200],
        );
    }
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}

class ChatMessage {
  final String id;
  final String text;
  final String sender;
  final DateTime timestamp;
  MessageStatus status;

  ChatMessage({
    required this.id,
    required this.text,
    required this.sender,
    required this.timestamp,
    required this.status,
  });
}

enum MessageStatus { sending, sent, error }
```

---

## Componentes Reutilizables

### DispatchCard

Crea `lib/widgets/dispatch_card.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/dispatch_model.dart';

class DispatchCard extends StatelessWidget {
  final DispatchModel dispatch;
  final VoidCallback? onTap;
  final bool isHistorical;

  const DispatchCard({
    Key? key,
    required this.dispatch,
    this.onTap,
    this.isHistorical = false,
  }) : super(key: key);

  Color _getStatusColor() {
    switch (dispatch.estado) {
      case DispatchStatus.pending:
        return Colors.orange;
      case DispatchStatus.assigned:
        return Colors.blue;
      case DispatchStatus.inRoute:
        return Colors.purple;
      case DispatchStatus.arrived:
        return Colors.green;
      case DispatchStatus.completed:
        return Colors.green;
      case DispatchStatus.cancelled:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _getStatusLabel() {
    switch (dispatch.estado) {
      case DispatchStatus.pending:
        return 'Pendiente';
      case DispatchStatus.assigned:
        return 'Asignado';
      case DispatchStatus.inRoute:
        return 'En Ruta';
      case DispatchStatus.arrived:
        return 'Llegada';
      case DispatchStatus.completed:
        return 'Completado';
      case DispatchStatus.cancelled:
        return 'Cancelado';
      default:
        return 'Desconocido';
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    final dateFormat = DateFormat('HH:mm - dd/MM');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: CircleAvatar(
          backgroundColor: statusColor.withOpacity(0.2),
          child: Icon(
            Icons.local_hospital,
            color: statusColor,
          ),
        ),
        title: Text(
          'Despacho #${dispatch.numero}',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text(
              dispatch.paciente ?? 'Paciente sin especificar',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            Text(
              'Ambulancia: ${dispatch.ambulanciaPlaca ?? 'No asignada'}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 4),
            Text(
              dateFormat.format(dispatch.fechaCreacion),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 6,
              ),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                _getStatusLabel(),
                style: TextStyle(
                  color: statusColor,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
            if (!isHistorical) ...[
              const SizedBox(height: 8),
              Icon(
                Icons.arrow_forward,
                color: Colors.grey[400],
                size: 16,
              ),
            ],
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}

enum DispatchStatus {
  pending,
  assigned,
  inRoute,
  arrived,
  completed,
  cancelled,
}
```

### ConnectionStatusIndicator

Crea `lib/widgets/connection_status_indicator.dart`:

```dart
import 'package:flutter/material.dart';

class ConnectionStatusIndicator extends StatelessWidget {
  final bool isConnected;
  final String? message;

  const ConnectionStatusIndicator({
    Key? key,
    required this.isConnected,
    this.message,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isConnected
            ? Colors.green.withOpacity(0.1)
            : Colors.red.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isConnected ? Colors.green : Colors.red,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: isConnected ? Colors.green : Colors.red,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            message ?? (isConnected ? 'Conectado' : 'Desconectado'),
            style: TextStyle(
              color: isConnected ? Colors.green : Colors.red,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## Rutas y Navegación

Crea `lib/config/routes.dart`:

```dart
import 'package:flutter/material.dart';
import '../screens/auth_screen.dart';
import '../screens/paramedic_home_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/tracking_screen.dart';
import '../screens/communication_screen.dart';

class AppRoutes {
  static const String auth = '/auth';
  static const String home = '/home';
  static const String notifications = '/notifications';
  static const String tracking = '/tracking';
  static const String communication = '/communication';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case auth:
        return MaterialPageRoute(builder: (_) => const AuthScreen());
      case home:
        return MaterialPageRoute(builder: (_) => const ParamedicHomeScreen());
      case notifications:
        return MaterialPageRoute(builder: (_) => const NotificationsScreen());
      case tracking:
        final args = settings.arguments as Map<String, String>;
        return MaterialPageRoute(
          builder: (_) => TrackingScreen(
            despachoId: args['despachoId']!,
            ambulanciaId: args['ambulanciaId']!,
          ),
        );
      case communication:
        final args = settings.arguments as Map<String, String>;
        return MaterialPageRoute(
          builder: (_) => CommunicationScreen(
            despachoId: args['despachoId']!,
            recipientId: args['recipientId']!,
          ),
        );
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
        );
    }
  }
}
```

---

## Esquema de Colores Recomendado

```dart
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: Colors.blue,
        brightness: Brightness.light,
      ),
      appBarTheme: const AppBarTheme(
        elevation: 2,
        centerTitle: true,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        elevation: 4,
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}
```

---

## Conclusión

Esta guía proporciona las estructuras básicas de UI para tu aplicación de despacho de ambulancias en Flutter. Personaliza los estilos según tu marca y experiencia de usuario deseada.

