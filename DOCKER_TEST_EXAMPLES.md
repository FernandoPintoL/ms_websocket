# 🧪 Ejemplos de Prueba - Docker ms_websocket

## Antes de Empezar

```bash
# Asegúrate que el contenedor está corriendo
docker-compose ps

# Si no está corriendo
docker-compose up --build -d
```

---

## 1. Verificaciones Básicas

### Health Check
```bash
curl -i http://localhost:4004/health

# Respuesta esperada:
# HTTP/1.1 200 OK
# {"status":"ok"}
```

### Status
```bash
curl http://localhost:4004/status | jq

# Respuesta:
# {
#   "status": "ok",
#   "service": "ms-websocket",
#   "version": "1.0.0",
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "uptime": 125.5,
#   "connections": 0
# }
```

### Configuración
```bash
curl http://localhost:4004/config | jq

# Respuesta:
# {
#   "wsProtocol": "ws",
#   "wsSecure": false,
#   "nodeEnv": "development",
#   "isDevelopment": true
# }
```

---

## 2. Pruebas GraphQL

### Acceder a Playground
```
http://localhost:4004/playground
```

O usar curl:

### Query Simple
```bash
curl -X POST http://localhost:4004/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name } } }"}'
```

### Mutation de Ejemplo
```bash
curl -X POST http://localhost:4004/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { broadcastEvent(data: { type: \"test\" }) { id type } }"
  }'
```

---

## 3. Pruebas WebSocket

### Usando websocat
```bash
# Instalar si no lo tienes
# macOS: brew install websocat
# Ubuntu: cargo install websocat
# Windows: descarga desde github

websocat ws://localhost:4004/socket.io/
# Se conecta y puedes enviar mensajes
```

### Usando Node.js
```javascript
// test-websocket.js
const io = require('socket.io-client');

const socket = io('http://localhost:4004', {
  auth: {
    token: 'your-jwt-token-here'  // Opcional
  }
});

socket.on('connect', () => {
  console.log('✅ Conectado');
  socket.emit('dispatch:track', {
    dispatcho_id: 'test-123'
  });
});

socket.on('disconnect', () => {
  console.log('❌ Desconectado');
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

socket.on('ambulancia:location-updated', (data) => {
  console.log('📍 Location:', data);
});
```

Ejecutar:
```bash
node test-websocket.js
```

### Usando Python
```python
# test-websocket.py
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print('✅ Conectado')
    sio.emit('dispatch:track', {'dispatch_id': 'test-123'})

@sio.event
def disconnect():
    print('❌ Desconectado')

@sio.on('ambulancia:location-updated')
def on_location(data):
    print(f'📍 Location: {data}')

sio.connect('http://localhost:4004')
```

Ejecutar:
```bash
pip install python-socketio python-engineio
python test-websocket.py
```

---

## 4. Pruebas de Conexión a BD

### Verificar Acceso a Redis
```bash
docker-compose exec ms-websocket \
  nc -zv host.docker.internal 6379

# Respuesta:
# Connection to host.docker.internal 6379 port [tcp/*] succeeded!
```

### Verificar Acceso a PostgreSQL
```bash
docker-compose exec ms-websocket \
  nc -zv host.docker.internal 5432

# Respuesta:
# Connection to host.docker.internal 5432 port [tcp/*] succeeded!
```

### Verificar Acceso a SQL Server
```bash
docker-compose exec ms-websocket \
  nc -zv host.docker.internal 1433

# Respuesta:
# Connection to host.docker.internal 1433 port [tcp/*] succeeded!
```

---

## 5. Pruebas de Performance

### Latencia
```bash
# Medir tiempo de respuesta
time curl http://localhost:4004/health

# Esperar tiempo < 100ms
```

### Conexiones Simultáneas
```bash
# Crear 10 conexiones simultaneas
for i in {1..10}; do
  curl -N http://localhost:4004/health &
done
wait

# Ver número de conexiones
curl http://localhost:4004/status | jq .connections
```

### Carga de Trabajo
```bash
# Usar Apache Bench
ab -n 100 -c 10 http://localhost:4004/health

# Usar wrk
wrk -t4 -c100 -d30s http://localhost:4004/health
```

---

## 6. Pruebas de Logs

### Ver Logs en Tiempo Real
```bash
docker-compose logs -f --tail=100
```

### Filtrar Logs
```bash
# Solo errores
docker-compose logs | grep -i error

# Solo eventos de conexión
docker-compose logs | grep -i "connected\|disconnected"

# Últimas 50 líneas
docker-compose logs --tail=50
```

### Exportar Logs
```bash
# A archivo
docker-compose logs > ms-websocket.log

# Con timestamp
docker-compose logs --timestamps
```

---

## 7. Pruebas de Integración

### Verificar Acceso a Otros Microservicios
```bash
docker-compose exec ms-websocket \
  curl http://host.docker.internal:8000/health

docker-compose exec ms-websocket \
  curl http://host.docker.internal:8001/api/health

docker-compose exec ms-websocket \
  curl http://host.docker.internal:8002/api/health
```

### Enviar Evento GraphQL desde ms_websocket
```bash
# Entrar al contenedor
docker-compose exec ms-websocket sh

# Dentro del contenedor
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

---

## 8. Pruebas de Recursos

### Uso de CPU
```bash
docker stats ms-websocket --no-stream

# Buscar CPU %
```

### Uso de Memoria
```bash
docker stats ms-websocket --no-stream

# Buscar MEM USAGE
```

### Logs del Contenedor
```bash
docker container logs ms-websocket

# Ver solo errores
docker container logs ms-websocket 2>&1 | grep -i error
```

---

## 9. Pruebas de Recuperación

### Reiniciar Contenedor
```bash
docker-compose restart ms-websocket

# Ver que reinicia sin errores
docker-compose logs --tail=20
```

### Parar y Arrancar
```bash
docker-compose down
sleep 5
docker-compose up -d

# Verificar que sigue funcionando
curl http://localhost:4004/health
```

### Simular Fallo de BD
```bash
# Parar Redis
redis-cli shutdown

# Ver que ms_websocket intenta reconectar
docker-compose logs | grep -i "redis\|error"

# Reiniciar Redis
redis-server
```

---

## 10. Prueba End-to-End Completa

```bash
#!/bin/bash

echo "=== Prueba E2E ms_websocket ==="

echo "1. Verificar contenedor..."
docker-compose ps | grep ms-websocket || { echo "❌ Contenedor no corre"; exit 1; }
echo "✅ Contenedor corriendo"

echo "2. Health check..."
curl -f http://localhost:4004/health || { echo "❌ Health check falló"; exit 1; }
echo "✅ Health check OK"

echo "3. GraphQL..."
curl -f -X POST http://localhost:4004/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}' || { echo "❌ GraphQL falló"; exit 1; }
echo "✅ GraphQL OK"

echo "4. BD local..."
docker-compose exec -T ms-websocket \
  nc -zv host.docker.internal 6379 || { echo "❌ BD local falló"; exit 1; }
echo "✅ BD local accesible"

echo "5. Status..."
curl -f http://localhost:4004/status > /dev/null || { echo "❌ Status falló"; exit 1; }
echo "✅ Status OK"

echo ""
echo "✅ ¡TODAS LAS PRUEBAS PASARON!"
```

Guardar como `test-e2e.sh` y ejecutar:
```bash
chmod +x test-e2e.sh
./test-e2e.sh
```

---

## Notas

- Reemplaza `localhost` con `127.0.0.1` si tienes problemas
- Usa `jq` para formatear JSON: `curl ... | jq`
- En Windows, usa `curl.exe` si tienes Git Bash
- Para WebSocket, necesitas un cliente compatible (websocat, socket.io-client, etc)

---

## Troubleshooting de Pruebas

### "Connection refused"
- Verificar que contenedor está corriendo: `docker-compose ps`
- Verificar que puerto 4004 está mapeado correctamente

### "Cannot connect to database"
- Verificar que BD está corriendo en tu máquina
- Verificar host.docker.internal resuelve: `ping host.docker.internal`

### "GraphQL errors"
- Ver logs: `docker-compose logs | grep -i "error\|graphql"`
- Verificar JWT_SECRET en .env.docker

### Timeout en WebSocket
- Aumentar timeout en cliente
- Ver logs para errores de conexión
- Verificar firewall

---

**Última actualización:** 2024
**Estado:** Listo para pruebas
