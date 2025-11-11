# ✅ Checklist de Configuración Docker

## Pre-requisitos

- [ ] Docker Desktop instalado
- [ ] Docker daemon ejecutándose
- [ ] Redis/PostgreSQL/SQL Server corriendo en puerto local
- [ ] Puerto 4004 disponible (o modificado en docker-compose.yml)
- [ ] Suficiente espacio en disco para la imagen (~500MB)

---

## Antes de Ejecutar

### Seleccionar Base de Datos

- [ ] **Si usas Redis** (por defecto):
  ```bash
  # Verificar que Redis está corriendo
  redis-cli ping
  # Debe responder: PONG
  ```

- [ ] **Si usas PostgreSQL**:
  ```bash
  # Copiar configuración
  cp .env.docker.postgres .env.docker

  # Crear base de datos (si no existe)
  createdb -U postgres ms_websocket

  # Verificar conexión
  psql -U postgres -h localhost -d ms_websocket
  ```

- [ ] **Si usas SQL Server**:
  ```bash
  # Copiar configuración
  cp .env.docker.sqlserver .env.docker

  # Crear base de datos en SQL Server Management Studio:
  # CREATE DATABASE ms_websocket;
  ```

### Verificar Puertos

- [ ] Puerto 4004 disponible:
  ```bash
  # Windows
  netstat -ano | findstr :4004

  # Linux/Mac
  lsof -i :4004
  ```

  Si está en uso, edita `docker-compose.yml`:
  ```yaml
  ports:
    - "4005:3000"  # Cambiar a otro puerto
  ```

### Verificar Red

- [ ] Docker está en network_mode: host (para acceso a host.docker.internal)
- [ ] host.docker.internal es accesible desde Docker

---

## Ejecución

### Opción 1: Scripts Helper (Recomendado)

**Windows:**
- [ ] Ejecutar `docker-setup.bat`
- [ ] Seleccionar opción 1 (Iniciar con build)
- [ ] Esperar 10-15 segundos

**Linux/Mac:**
- [ ] Ejecutar `chmod +x docker-setup.sh`
- [ ] Ejecutar `./docker-setup.sh`
- [ ] Seleccionar opción 1
- [ ] Esperar 10-15 segundos

### Opción 2: Línea de Comandos

- [ ] Ejecutar `docker-compose up --build -d`
- [ ] Esperar mensaje de completación
- [ ] Esperar 10-15 segundos para que inicie

---

## Verificación Post-Deploy

### Health Check

- [ ] Ejecutar health check:
  ```bash
  curl http://localhost:4004/health
  ```
  Debe responder `{"status":"ok"}`

- [ ] Ver estado del contenedor:
  ```bash
  docker-compose ps
  ```
  Debe mostrar `Up`

- [ ] Ver logs sin errores:
  ```bash
  docker-compose logs --tail=20
  ```

### Conectividad

- [ ] Acceder a GraphQL:
  ```
  http://localhost:4004/graphql
  ```

- [ ] Acceder a Playground:
  ```
  http://localhost:4004/playground
  ```

- [ ] Verificar WebSocket:
  ```bash
  curl -i -N -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    http://localhost:4004/socket.io/
  ```

- [ ] Verificar conexión a BD:
  ```bash
  docker-compose exec ms-websocket \
    curl http://host.docker.internal:6379
  ```

---

## Pruebas Funcionales

- [ ] GraphQL Playground responde
- [ ] Endpoint /health responde `{"status":"ok"}`
- [ ] Endpoint /status muestra información
- [ ] Endpoint /metrics responde
- [ ] WebSocket es accesible en puerto 4004
- [ ] Logs muestran "Server started successfully"

---

## Integración con Otros Servicios

- [ ] Actualizar configuración en apollo-gateway:
  ```yaml
  MS_WEBSOCKET_URL=http://host.docker.internal:4004/graphql
  ```

- [ ] Actualizar configuración en frontend:
  ```env
  REACT_APP_WS_URL=http://localhost:4004
  ```

- [ ] Verificar conectividad bidireccional:
  ```bash
  # Desde ms_websocket hacia otros servicios
  docker-compose exec ms-websocket \
    curl http://host.docker.internal:8000/health
  ```

---

## Problemas y Soluciones

### ❌ "Cannot connect to Redis"
- [ ] Verificar que Redis está corriendo: `redis-cli ping`
- [ ] Verificar `.env.docker` tiene `REDIS_HOST=host.docker.internal`
- [ ] En Windows, verificar que host.docker.internal resuelve
- [ ] Probar: `ping host.docker.internal`

### ❌ "Port 4004 already in use"
- [ ] Detener contenedor actual: `docker-compose down`
- [ ] Liberar puerto: `lsof -i :4004 | kill -9`
- [ ] O cambiar puerto en docker-compose.yml

### ❌ El contenedor no inicia
- [ ] Ver logs: `docker-compose logs ms-websocket`
- [ ] Reconstruir: `docker-compose up --build --no-cache`
- [ ] Limpiar: `docker-compose down -v` (elimina volúmenes)

### ❌ "Cannot resolve host.docker.internal"
- [ ] En Linux, usar en su lugar: `172.17.0.1`
- [ ] Editar .env.docker: `REDIS_HOST=172.17.0.1`

---

## Monitoreo Continuado

- [ ] Monitorear logs periódicamente:
  ```bash
  docker-compose logs -f
  ```

- [ ] Monitorear uso de recursos:
  ```bash
  docker stats ms-websocket
  ```

- [ ] Verificar conexiones activas:
  ```bash
  curl http://localhost:4004/connections
  ```

---

## Detención y Limpieza

### Parar Temporalmente
- [ ] Ejecutar `docker-compose down`
- [ ] Contenedor se detiene pero persisten datos

### Limpieza Completa
- [ ] Ejecutar `docker-compose down -v`
- [ ] Se eliminan volúmenes y contenedores
- [ ] BD local no se ve afectada

### Eliminar Imagen
- [ ] Ejecutar `docker rmi ms_websocket`
- [ ] Se elimina la imagen local

---

## Producción

- [ ] Cambiar NODE_ENV a `production`
- [ ] Cambiar JWT_SECRET a valor seguro
- [ ] Disable GraphQL playground
- [ ] Configurar CORS_ORIGIN específicamente
- [ ] Usar BD remota en lugar de local
- [ ] Configurar certificados SSL/TLS
- [ ] Configurar backup de datos

---

## Checklist Final

- [ ] Dockerfile y docker-compose.yml creados ✅
- [ ] Variables de entorno configuradas ✅
- [ ] Scripts helper disponibles ✅
- [ ] Documentación completa ✅
- [ ] BD local verificada ✅
- [ ] Contenedor inicia correctamente ✅
- [ ] Health checks funcionan ✅
- [ ] Servicios conectan correctamente ✅
- [ ] Logs limpios (sin errores) ✅
- [ ] Listo para desarrollo ✅

---

**Fecha de Verificación:** ___________
**Estado:** ✅ Operacional
**Responsable:** ___________
