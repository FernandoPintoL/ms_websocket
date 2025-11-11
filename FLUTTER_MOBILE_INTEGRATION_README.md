# Documentación Completa: Integración Apollo GraphQL + WebSocket en Flutter

## Bienvenida

Esta documentación proporciona una guía completa para integrar **Apollo GraphQL con WebSocket** en tu aplicación Flutter, permitiendo comunicación en tiempo real entre paramedicos, usuarios de control central y el servidor de despachos.

---

## Contenido de la Documentación

### 📘 1. **FLUTTER_APOLLO_GRAPHQL_GUIDE.md** - Configuración Base
Guía completa de instalación y configuración inicial.

**Incluye:**
- Instalación de dependencias
- Configuración de Apollo Client
- Documentos GraphQL (Queries, Mutations, Subscriptions)
- Autenticación y manejo de tokens
- Suscripciones en tiempo real
- Notificaciones de asistencias médicas
- Seguimiento de ruta de ambulancia
- Mejores prácticas
- Solución de problemas

**Para comenzar:** Lee esta guía primero

---

### 🎨 2. **FLUTTER_UI_EXAMPLES.md** - Ejemplos de Pantallas
Implementación completa de interfaces de usuario con ejemplo de código.

**Incluye:**
- Pantalla de autenticación
- Pantalla principal del paramédico
- Pantalla de notificaciones
- Pantalla de seguimiento en mapa
- Pantalla de comunicación (chat)
- Componentes reutilizables
- Configuración de rutas
- Esquemas de color

**Para desarrollar:** Usa los ejemplos como punto de partida para tus pantallas

---

### 🚀 3. **FLUTTER_DEPLOYMENT_GUIDE.md** - Despliegue y Testing
Guía completa para testing, debugging y despliegue en producción.

**Incluye:**
- Configuración de ambiente de desarrollo
- Testing unitarios e integración
- Debugging avanzado
- Compilación para Android e iOS
- Configuración de certificados
- Monitoreo con Firebase
- Troubleshooting avanzado
- Checklist predespliegue

**Para publicar:** Sigue esta guía antes de enviar a App Stores

---

## Flujo de Trabajo Recomendado

### Fase 1: Configuración (Día 1-2)
```
1. Leer FLUTTER_APOLLO_GRAPHQL_GUIDE.md (secciones 1-4)
2. Instalar dependencias
3. Configurar .env files
4. Probar conexión al servidor GraphQL
5. Verificar autenticación funciona
```

### Fase 2: Desarrollo (Día 3-7)
```
1. Leer FLUTTER_UI_EXAMPLES.md
2. Implementar pantallas básicas
3. Crear servicios y providers
4. Implementar suscripciones
5. Integrar notificaciones
6. Agregar seguimiento de ubicación
```

### Fase 3: Testing (Día 8-9)
```
1. Escribir tests unitarios
2. Escribir tests de widgets
3. Hacer debugging con DevTools
4. Probar en dispositivos reales
5. Verificar performance
```

### Fase 4: Despliegue (Día 10)
```
1. Seguir FLUTTER_DEPLOYMENT_GUIDE.md
2. Compilar APK/IPA
3. Configurar Firebase
4. Subir a App Stores
5. Monitorear errores en producción
```

---

## Arquitectura General

```
┌─────────────────────────────────────────────┐
│         Flutter App (Paramedics)            │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   UI Layer (Screens & Widgets)       │  │
│  └──────────────────────────────────────┘  │
│                    ↓                        │
│  ┌──────────────────────────────────────┐  │
│  │   State Management (Providers)       │  │
│  └──────────────────────────────────────┘  │
│                    ↓                        │
│  ┌──────────────────────────────────────┐  │
│  │   Services (Auth, GraphQL, etc)      │  │
│  └──────────────────────────────────────┘  │
│                    ↓                        │
└────────────────────│─────────────────────────┘
                     │
       ┌─────────────┴──────────────┐
       │                            │
       ↓                            ↓
   HTTP/REST                   WebSocket
   (Queries)                (Subscriptions)
       │                            │
       └──────────────┬─────────────┘
                      ↓
    ┌──────────────────────────────────┐
    │  MS-WebSocket Server (Node.js)   │
    │  ┌────────────────────────────┐  │
    │  │  Apollo GraphQL Server     │  │
    │  ├────────────────────────────┤  │
    │  │  WebSocket/Socket.IO       │  │
    │  ├────────────────────────────┤  │
    │  │  Redis Pub/Sub             │  │
    │  └────────────────────────────┘  │
    └──────────────────────────────────┘
                      ↓
    ┌──────────────────────────────────┐
    │   Otros Microservicios           │
    │   (Despachos, Ambulancias, etc)  │
    └──────────────────────────────────┘
```

---

## Modelos de Datos Principales

### 1. **Despacho (Dispatch)**
```graphql
type Dispatch {
  id: ID!
  numero: String!
  estado: DispatchStatusEnum!  # PENDIENTE, ASIGNADO, EN_ROUTE, LLEGADA, COMPLETADO
  paciente: String
  ubicacion: Location!
  ambulanciaId: ID
  ambulanciaPlaca: String
  driverName: String
  notas: String
  fechaCreacion: DateTime!
  fechaActualizacion: DateTime!
  tiempoEstimado: Int
  prioridad: Int
}
```

### 2. **Rastreo (Tracking)**
```graphql
type Rastreo {
  id: ID!
  despachoId: ID!
  ubicacion: Location!
  velocidad: Float
  timestamp: DateTime!
}
```

### 3. **Ambulancia**
```graphql
type Ambulancia {
  id: ID!
  placa: String!
  estado: String!
  ubicacion: Location!
  driverName: String
  disponibilidad: Boolean!
  ultimaActividad: DateTime!
}
```

### 4. **Personal (Paramédicos)**
```graphql
type User {
  id: ID!
  nombre: String!
  email: String!
  role: UserRoleEnum!  # ADMIN, DISPATCHER, DRIVER, MONITOR
  isOnline: Boolean!
  lastSeen: DateTime!
  createdAt: DateTime!
}
```

---

## Operaciones GraphQL Principales

### Queries (Obtener Datos)
```graphql
# Obtener despacho específico
query GetDispatch($id: ID!) {
  dispatch(id: $id) { ... }
}

# Listar despachos activos
query GetDispatches {
  despachos(estado: EN_ROUTE, limit: 50) { ... }
}

# Historial de ubicaciones
query GetRastreoHistoria($despachoId: ID!) {
  rastreoHistoria(despachoId: $despachoId) { ... }
}
```

### Mutations (Cambiar Datos)
```graphql
# Crear nuevo despacho
mutation CreateDispatch {
  createDispatch(paciente: "...", latitud: 0, longitud: 0) { ... }
}

# Actualizar estado
mutation UpdateStatus {
  updateDispatchStatus(despachoId: "...", estado: EN_ROUTE) { ... }
}

# Actualizar ubicación (rastreo)
mutation UpdateLocation {
  updateLocation(despachoId: "...", latitud: 0, longitud: 0) { ... }
}
```

### Subscriptions (Tiempo Real)
```graphql
# Escuchar nuevos despachos
subscription OnDispatchCreated {
  dispatchCreated { ... }
}

# Escuchar cambios de estado
subscription OnDispatchStatusChanged($despachoId: ID!) {
  dispatchStatusChanged(despachoId: $despachoId) { ... }
}

# Escuchar actualizaciones de ubicación
subscription OnLocationUpdated($despachoId: ID!) {
  locationUpdated(despachoId: $despachoId) { ... }
}

# Escuchar cambios de usuarios en línea
subscription OnOnlineUsersChanged {
  onlineUsersChanged { ... }
}
```

---

## Casos de Uso Principales

### 1. **Paramédico Recibe Nueva Asistencia**

```
Server publica en Redis
        ↓
WebSocket emite evento
        ↓
Flutter recibe mediante suscripción
        ↓
Provider actualiza estado
        ↓
UI muestra notificación
        ↓
Paramédico ve nuevo despacho en lista
```

### 2. **Central Rastrea Ambulancia en Ruta**

```
Ambulancia envía ubicación (mutation)
        ↓
Server almacena en BD y publica en Redis
        ↓
WebSocket emite a subscriptores
        ↓
Mapa en Flutter se actualiza en tiempo real
        ↓
Central ve posición exacta y velocidad
```

### 3. **Comunicación Bidireccional**

```
Paramédico envía mensaje (mutation)
        ↓
Server publica en canal específico
        ↓
Central recibe mediante suscripción
        ↓
Ambos ven historial de conversación
```

---

## Configuración Rápida (5 minutos)

### 1. Clonar dependencias
```bash
flutter pub get
```

### 2. Crear .env
```env
GRAPHQL_HOST=localhost
GRAPHQL_PORT=3001
GRAPHQL_WS_URL=ws://localhost:3001/graphql
```

### 3. Inicializar en main.dart
```dart
void main() async {
  await dotenv.load();
  await AuthService().initialize();
  runApp(const MyApp());
}
```

### 4. Usar GraphQL
```dart
final result = await GraphQLService().query(options);
```

---

## Patrones de Comunicación

### Patrón 1: Fetch + Subscribe
```dart
// 1. Obtener datos iniciales
await fetchData();

// 2. Suscribirse a cambios futuros
subscribeToUpdates();
```

### Patrón 2: Mutation + Broadcast
```dart
// 1. Enviar cambio
await mutate(data);

// 2. Escuchar confirmación
listenForConfirmation();
```

### Patrón 3: Real-time Sync
```dart
// Mantener datos sincronizados constantemente
subscribeToAllChanges();
handleIncomingUpdates();
```

---

## Variables de Entorno Requeridas

### Desarrollo
```env
FLUTTER_ENV=development
GRAPHQL_HOST=127.0.0.1
GRAPHQL_PORT=3001
GRAPHQL_ENDPOINT=/graphql
GRAPHQL_WS_URL=ws://127.0.0.1:3001/graphql
DEBUG_GRAPHQL=true
LOG_LEVEL=DEBUG
```

### Producción
```env
FLUTTER_ENV=production
GRAPHQL_HOST=api.tudominio.com
GRAPHQL_PORT=443
GRAPHQL_WS_URL=wss://api.tudominio.com/graphql
DEBUG_GRAPHQL=false
LOG_LEVEL=ERROR
GOOGLE_MAPS_API_KEY=your_key_here
```

---

## Solución de Problemas Comunes

### No me conecta al servidor
```
✓ Verificar que ms_websocket está corriendo
✓ Verificar URL en .env es correcta
✓ Verificar CORS está habilitado
✓ Checar firewall no bloquea puerto
```

### Las suscripciones no reciben datos
```
✓ Verificar subscription está correcta
✓ Verificar variables coinciden
✓ Verificar Redis está corriendo
✓ Checar logs del servidor
```

### Token expirado
```
✓ Implementar refresh automático
✓ Guardar token en secure storage
✓ Validar token antes de usarlo
```

### Performance lento
```
✓ Reducir cantidad de items en memoria
✓ Desuscribirse cuando sea necesario
✓ Usar paginación para listas grandes
✓ Activar mode release
```

---

## Stack Tecnológico

### Frontend (Flutter)
- **UI Framework:** Flutter 3.x
- **State Management:** Provider
- **GraphQL:** graphql_flutter
- **WebSocket:** web_socket_channel
- **Local Storage:** shared_preferences
- **Maps:** google_maps_flutter
- **Notifications:** flutter_local_notifications
- **Logging:** logger

### Backend (Existente)
- **Server:** Node.js + Express
- **GraphQL:** Apollo Server
- **WebSocket:** Socket.io + graphql-ws
- **Pub/Sub:** Redis
- **Database:** (Según tu configuración)

---

## Checklist de Implementación

- [ ] Leer documentación completa
- [ ] Instalar dependencias Flutter
- [ ] Configurar .env files
- [ ] Crear servicios (AuthService, GraphQLService)
- [ ] Implementar queries y mutations
- [ ] Implementar subscriptions
- [ ] Crear providers con state management
- [ ] Implementar UI screens
- [ ] Integrar notificaciones push
- [ ] Integrar Google Maps para tracking
- [ ] Escribir tests
- [ ] Testing en dispositivo real
- [ ] Configurar signing para publicación
- [ ] Enviar a App Stores

---

## Recursos Útiles

### Documentación Oficial
- [Apollo Flutter Documentation](https://www.apollographql.com/docs/flutter/)
- [Flutter Documentation](https://flutter.dev/docs)
- [GraphQL Spec](https://spec.graphql.org/)
- [Socket.io Documentation](https://socket.io/docs/)

### Herramientas Recomendadas
- [GraphQL Playground](https://www.apollographql.com/docs/apollo-server/testing/graphql-playground/)
- [Postman/Insomnia](https://www.postman.com/)
- [Charles Proxy](https://www.charlesproxy.com/) (Network debugging)
- [Firebase Console](https://console.firebase.google.com/)

### Librerías Complementarias
```yaml
provider: ^6.0.0              # State management
graphql_flutter: ^5.1.0       # Apollo Client
web_socket_channel: ^2.4.0    # WebSocket
google_maps_flutter: ^2.5.0   # Maps
flutter_local_notifications: ^15.0.0  # Notifications
shared_preferences: ^2.2.0    # Local storage
dio: ^5.3.0                   # HTTP client
logger: ^2.0.0                # Logging
freezed: ^2.4.0               # Code generation
json_serializable: ^6.7.0     # JSON serialization
```

---

## Soporte y Contacto

Para dudas o problemas:

1. **Revisar documentación:** Consulta la guía relevante
2. **Debugging:** Activar logs y revisar errores
3. **Testing:** Crear un test case mínimo reproducible
4. **Monitoreo:** Verificar logs del servidor

---

## Notas Importantes

### Seguridad
- Nunca guardes tokens en texto plano
- Usa secure storage para credenciales
- Valida todos los datos del servidor
- Implementa rate limiting en cliente

### Performance
- Desuscribirse cuando no sea necesario
- Limitar cantidad de items en caché
- Usar pagination para listas grandes
- Implementar lazy loading

### Mantenimiento
- Mantener dependencias actualizadas
- Revisar logs regularmente
- Monitorear crashes en producción
- Implementar analytics

---

## Versión de Documentación

- **Versión:** 1.0.0
- **Actualización:** Noviembre 2024
- **Compatible con:** Flutter 3.x, Dart 3.x
- **Node.js Backend:** v18+

---

## Próximos Pasos

1. **Comenzar con FLUTTER_APOLLO_GRAPHQL_GUIDE.md**
2. **Implementar ejemplos de FLUTTER_UI_EXAMPLES.md**
3. **Seguir pruebas en FLUTTER_DEPLOYMENT_GUIDE.md**
4. **Publicar usando checklist de despliegue**

¡Buena suerte con tu aplicación de despacho de ambulancias!

