# 📚 Guía de Nuevas Implementaciones - FASE 2 Extended

Esta guía describe los archivos y características agregadas a FASE 2 para completar el microservicio WebSocket.

---

## 🗂️ REPOSITORIES (Data Access Layer)

### ConnectionRepository.js
**Ubicación:** `src/repositories/ConnectionRepository.js`
**Líneas:** 450
**Propósito:** Gestionar conexiones de Socket.IO en Redis

**Métodos principales:**
```javascript
// Guardar nueva conexión
await connectionRepo.saveConnection(socketId, userId, metadata);

// Obtener conexión por ID
const connection = await connectionRepo.getConnection(socketId);

// Obtener todas las conexiones de un usuario
const userConns = await connectionRepo.getUserConnections(userId);

// Limpiar conexiones antiguas
const cleaned = await connectionRepo.cleanupStaleConnections(86400);

// Obtener conteos
const total = await connectionRepo.getConnectionCount();
const userCount = await connectionRepo.getUserConnectionCount(userId);
```

**Uso en Servicios:**
```javascript
import { ConnectionRepository } from './repositories/ConnectionRepository.js';

const connRepo = new ConnectionRepository(redisClient);
```

---

### EventRepository.js
**Ubicación:** `src/repositories/EventRepository.js`
**Líneas:** 580
**Propósito:** Almacenar y recuperar eventos del sistema

**Métodos principales:**
```javascript
// Guardar evento
const event = await eventRepo.saveEvent('dispatch:created', data, metadata);

// Obtener eventos por tipo
const events = await eventRepo.getEventsByType('dispatch:created', 100, 0);

// Filtrar eventos
const filtered = await eventRepo.getEventsByTypeAndFilter(
  'dispatch:created',
  { userId: '123' },
  50
);

// Obtener estadísticas
const stats = await eventRepo.getEventStatistics();
// { totalEvents: 1500, eventTypes: {...}, totalEventTypes: 8 }

// Limpiar eventos antiguos
const deleted = await eventRepo.deleteOldEvents(7); // 7 días
```

**Uso en Servicios:**
```javascript
import { EventRepository } from './repositories/EventRepository.js';

const eventRepo = new EventRepository(redisClient);
```

---

### SessionRepository.js
**Ubicación:** `src/repositories/SessionRepository.js`
**Líneas:** 520
**Propósito:** Gestionar sesiones de usuario

**Métodos principales:**
```javascript
// Crear sesión
const session = await sessionRepo.createSession(userId, { device: 'mobile' });

// Obtener sesión
const sess = await sessionRepo.getSession(sessionId);

// Obtener sesiones activas de usuario
const active = await sessionRepo.getActiveUserSessions(userId, 30); // últimos 30 min

// Eliminar sesiones inactivas
const deleted = await sessionRepo.deleteInactiveSessions(userId, 60); // 60 min inactivo

// Estadísticas
const stats = await sessionRepo.getSessionStatistics();
// { totalSessions: 250, activeSessions: 180, inactiveSessions: 70 }
```

**Uso en Servicios:**
```javascript
import { SessionRepository } from './repositories/SessionRepository.js';

const sessionRepo = new SessionRepository(redisClient);
```

---

## 📊 GRAPHQL (API Type-Safe)

### schema.js
**Ubicación:** `src/graphql/schema.js`
**Líneas:** 600
**Propósito:** Definir schema GraphQL completo

**Tipos principales:**
```graphql
# Query para obtener despachos
query GetDespachos {
  despachos(limit: 10) {
    id
    numero
    estado
    paciente
    ubicacion {
      latitud
      longitud
    }
  }
}

# Mutation para actualizar estado
mutation UpdateDispatchStatus {
  updateDispatchStatus(despachoId: "123", estado: EN_ROUTE) {
    id
    estado
    updatedAt
  }
}

# Subscription para cambios en tiempo real
subscription OnDispatchUpdate {
  dispatchUpdated(despachoId: "123") {
    dispatch {
      id
      estado
    }
    changeType
    timestamp
  }
}
```

**Integración en server.js:**
```javascript
import { typeDefs, createResolvers } from './graphql/schema.js';

// Los resolvers se crean automáticamente
const resolvers = createResolvers(services);

// Se integran con Apollo Server
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers
});
```

---

### dispatchResolvers.js
**Ubicación:** `src/graphql/resolvers/dispatchResolvers.js`
**Líneas:** 200
**Propósito:** Resolver operaciones de despachos

**Funcionalidades:**
- ✅ Consultar despachos (con filtros)
- ✅ Crear nuevos despachos
- ✅ Actualizar estado
- ✅ Cancelar despachos
- ✅ Subscripciones en tiempo real

---

### userResolvers.js
**Ubicación:** `src/graphql/resolvers/userResolvers.js`
**Líneas:** 180
**Propósito:** Resolver operaciones de usuarios

**Funcionalidades:**
- ✅ Obtener usuario por ID
- ✅ Ver usuarios conectados
- ✅ Actualizar estado de usuario
- ✅ Notificaciones de cambios

---

### locationResolvers.js
**Ubicación:** `src/graphql/resolvers/locationResolvers.js`
**Líneas:** 150
**Propósito:** Resolver operaciones de ubicación

**Funcionalidades:**
- ✅ Obtener historial de rastreo
- ✅ Actualizar ubicación
- ✅ Validar coordenadas
- ✅ Broadcast de actualizaciones

---

### broadcastResolvers.js
**Ubicación:** `src/graphql/resolvers/broadcastResolvers.js`
**Líneas:** 150
**Propósito:** Resolver mensajes broadcast

**Funcionalidades:**
- ✅ Obtener histórico de canal
- ✅ Enviar mensaje a todos
- ✅ Mensaje directo usuario a usuario
- ✅ Subscripciones a canales

---

## 🔒 MIDDLEWARE (Capas de Seguridad)

### authentication.js
**Ubicación:** `src/middleware/authentication.js`
**Líneas:** 450
**Propósito:** Autenticación y autorización

**Funciones principales:**
```javascript
import { authenticateSocket, authorizeSocket } from './middleware/authentication.js';

// En server.js
io.use(authenticateSocket(process.env.JWT_SECRET, authService));
io.use(refreshTokenMiddleware(authService));

// Para proteger eventos
const protectedHandler = authorizeSocket('DISPATCHER')(eventHandler);

// Validar entrada
io.on('connection', (socket) => {
  socket.on('dispatch:create', validateSchema(dispatchSchema), (data, cb) => {
    // data es validado
  });
});
```

**Características:**
- ✅ JWT verification
- ✅ Role-based access (ADMIN, DISPATCHER, DRIVER, MONITOR)
- ✅ Permission checking
- ✅ Automatic token refresh
- ✅ Input validation with Joi
- ✅ Event logging

---

### errorHandler.js
**Ubicación:** `src/middleware/errorHandler.js`
**Líneas:** 500
**Propósito:** Manejo robusto de errores

**Clases de error disponibles:**
```javascript
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError
} from './middleware/errorHandler.js';

// Uso
throw new ValidationError('Invalid dispatch data', {
  field: 'latitud',
  message: 'Must be between -90 and 90'
});

throw new AuthorizationError('Drivers cannot create dispatches');

throw new RateLimitError('Too many requests', 60);
```

**Patrones avanzados:**
```javascript
// Circuit Breaker
const breaker = new CircuitBreaker();
const result = await breaker.execute(
  () => externalServiceCall(),
  () => fallbackValue // usado cuando circuit está abierto
);

// Retry con backoff exponencial
const result = await retryWithBackoff(
  () => unstableOperation(),
  { maxAttempts: 3, initialDelay: 1000 }
);
```

---

### rateLimiter.js
**Ubicación:** `src/middleware/rateLimiter.js`
**Líneas:** 200
**Propósito:** Control de rate limiting

**4 Estrategias disponibles:**

1. **Token Bucket (Básico)**
```javascript
const limiter = new RateLimiter(redisClient, {
  windowMs: 60000,      // 1 minuto
  maxRequests: 100      // 100 requests por minuto
});

app.use(limiter.createExpressMiddleware());
io.use(limiter.createSocketMiddleware());
```

2. **Sliding Window (Preciso)**
```javascript
const swLimiter = new SlidingWindowRateLimiter(redisClient);
const result = await swLimiter.checkAndIncrement('user-123');
// { allowed: true/false, remaining: 45, retryAfter: ... }
```

3. **Per-Event Rate Limiting**
```javascript
const eventLimiter = new DistributedSocketRateLimiter(redisClient);

eventLimiter.setEventLimit('dispatch:create', 10, 60000);  // 10 per minute
eventLimiter.setEventLimit('dispatch:location-update', 100, 60000);

const handler = eventLimiter.createEventHandler('dispatch:create', actualHandler);
```

4. **Adaptive (Basado en Carga)**
```javascript
const adaptive = new AdaptiveRateLimiter(redisClient, {
  baseLimit: 100,
  memoryThreshold: 85  // Reduce limits si memoria > 85%
});

io.use(adaptive.createMiddleware());
```

---

## ✅ TESTS (64 Casos de Prueba)

### Unit Tests

#### AuthService.test.js
**Ubicación:** `tests/unit/services/AuthService.test.js`
**Líneas:** 200
**Casos:** 12
```javascript
// Ejecución
npm run test tests/unit/services/AuthService.test.js

// Casos cubiertos:
✅ JWT token verification (valid, invalid, expired)
✅ Token creation with user data
✅ Permission checking
✅ Role validation
✅ Token refresh
✅ Logout functionality
```

#### DispatchService.test.js
**Ubicación:** `tests/unit/services/DispatchService.test.js`
**Líneas:** 350
**Casos:** 15
```javascript
// Casos cubiertos:
✅ Get all dispatches with filtering
✅ Get single dispatch
✅ Create dispatch with validation
✅ Update status with broadcasting
✅ Add location tracking
✅ Subscribe/unsubscribe to dispatch
✅ Get location history
✅ Error handling
```

#### ConnectionService.test.js
**Ubicación:** `tests/unit/services/ConnectionService.test.js`
**Líneas:** 250
**Casos:** 12
```javascript
// Casos cubiertos:
✅ Record connection with metadata
✅ Remove connection
✅ Get user connections
✅ Connection counting
✅ Connection notifications
✅ Metadata updates
✅ Activity tracking
```

---

### Integration Tests

#### socket.integration.test.js
**Ubicación:** `tests/integration/socket.integration.test.js`
**Líneas:** 400+
**Casos:** 17
```javascript
// Ejecución (requiere servidor corriendo)
npm run test:integration

// Casos cubiertos:
✅ WebSocket connection with token
✅ Socket events (ping, status, etc)
✅ Dispatch subscription and updates
✅ Location updates with validation
✅ Broadcast messages
✅ Error handling
✅ Multiple concurrent connections
✅ Real-time synchronization
```

---

### E2E Tests

#### dispatch.e2e.test.js
**Ubicación:** `tests/e2e/dispatch.e2e.test.js`
**Líneas:** 650+
**Casos:** 8
```javascript
// Ejecución (requiere servicio completo)
npm run test:e2e

// Flujos cubiertos:
✅ Complete dispatch lifecycle (creation → completion)
✅ State consistency across clients
✅ Permission-based access
✅ Location tracking with multiple updates
✅ Connection loss and recovery
✅ High volume updates handling
```

---

## 🚀 CÓMO USAR LOS NUEVOS ARCHIVOS

### Paso 1: Verificar Instalación
```bash
cd ms_websocket
npm install
```

### Paso 2: Configurar Variables
```bash
cp .env.example .env
# Editar .env con valores reales
```

### Paso 3: Ejecutar Tests
```bash
# Unit tests
npm run test:unit

# Integration tests (requiere Redis)
npm run test:integration

# E2E tests (requiere servidor completo)
npm run test:e2e

# Todo
npm test
```

### Paso 4: Iniciar Servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

### Paso 5: Probar GraphQL
```
# Abrir navegador
http://localhost:3000/graphql

# Probar query
query {
  despachos(limit: 5) {
    id
    numero
    estado
  }
}
```

---

## 📋 CHECKLIST DE INTEGRACIÓN

- [ ] Instalar dependencias (`npm install`)
- [ ] Crear archivo `.env` desde `.env.example`
- [ ] Ejecutar tests para verificar setup (`npm test`)
- [ ] Iniciar Redis localmente o en Docker
- [ ] Iniciar servidor (`npm run dev`)
- [ ] Verificar health endpoint (`curl http://localhost:3000/health`)
- [ ] Acceder a GraphQL Playground (`http://localhost:3000/graphql`)
- [ ] Ejecutar tests de integración (`npm run test:integration`)
- [ ] Ejecutar tests E2E (`npm run test:e2e`)

---

## 🔗 REFERENCIAS RÁPIDAS

| Componente | Archivo | Líneas | Métodos |
|-----------|---------|--------|---------|
| ConnectionRepository | `repositories/ConnectionRepository.js` | 450 | 10 |
| EventRepository | `repositories/EventRepository.js` | 580 | 11 |
| SessionRepository | `repositories/SessionRepository.js` | 520 | 15 |
| GraphQL Schema | `graphql/schema.js` | 600 | - |
| Dispatch Resolvers | `graphql/resolvers/dispatchResolvers.js` | 200 | 10 |
| User Resolvers | `graphql/resolvers/userResolvers.js` | 180 | 8 |
| Location Resolvers | `graphql/resolvers/locationResolvers.js` | 150 | 5 |
| Broadcast Resolvers | `graphql/resolvers/broadcastResolvers.js` | 150 | 5 |
| Authentication Middleware | `middleware/authentication.js` | 450 | 6 |
| Error Handler | `middleware/errorHandler.js` | 500 | 8+ |
| Rate Limiter | `middleware/rateLimiter.js` | 200 | 4 |
| Auth Service Tests | `tests/unit/services/AuthService.test.js` | 200 | 12 |
| Dispatch Service Tests | `tests/unit/services/DispatchService.test.js` | 350 | 15 |
| Connection Service Tests | `tests/unit/services/ConnectionService.test.js` | 250 | 12 |
| Socket Integration Tests | `tests/integration/socket.integration.test.js` | 400+ | 17 |
| Dispatch E2E Tests | `tests/e2e/dispatch.e2e.test.js` | 650+ | 8 |

---

## 💡 TIPS ÚTILES

### Debug Logging
```bash
DEBUG=ms-websocket:* npm run dev
```

### Health Check
```bash
# Básico
curl http://localhost:3000/health

# Detallado
curl http://localhost:3000/health/detailed
```

### Metrics
```bash
curl http://localhost:3000/metrics | grep ws_
```

### Verificar Rate Limit
```javascript
const limiter = new RateLimiter(redis);
const status = await limiter.checkLimit('user-123');
console.log(status);
// { current: 45, limit: 100, remaining: 55, isLimited: false }
```

---

**Documento generado:** 2025-11-07
**Estado:** ✅ Completo
**Próximo paso:** Revisar FASE2_COMPLETADA_EXTENDED.md para overview completo
