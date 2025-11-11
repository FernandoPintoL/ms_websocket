# Dockerización de ms_websocket con BD Local

Este guía explica cómo ejecutar el ms_websocket en Docker usando la base de datos de tu máquina local.

## Requisitos Previos

1. **Docker Desktop** instalado y ejecutándose
2. **Redis** instalado en tu máquina local (puerto 6379 por defecto)
   - O PostgreSQL (puerto 5432)
   - O SQL Server (puerto 1433)
3. El servicio debe estar ejecutándose en tu máquina host

## Configuración Rápida

### 1. Verificar BD Local Instalada

**Para Redis:**
```bash
redis-cli ping
# Debe responder: PONG
```

**Para PostgreSQL:**
```bash
psql -U postgres -h localhost
```

**Para SQL Server:**
```bash
sqlcmd -S localhost -U sa
```

### 2. Actualizar Variables de Entorno

El archivo `.env.docker` ya está configurado para usar `host.docker.internal` que permite que el contenedor Docker acceda a servicios en tu máquina host.

Si necesitas cambiar credenciales de BD, edita `.env.docker`:

```bash
# Redis (por defecto)
REDIS_HOST=host.docker.internal
REDIS_PORT=6379

# O para PostgreSQL, descomenta:
# DB_TYPE=postgresql
# DB_HOST=host.docker.internal
# DB_PORT=5432
# DB_NAME=ms_websocket
# DB_USER=postgres
# DB_PASSWORD=tu_contraseña
```

### 3. Ejecutar Docker Compose

```bash
# Navega al directorio de ms_websocket
cd ms_websocket

# Construye e inicia el contenedor
docker-compose up --build

# O en segundo plano:
docker-compose up -d --build
```

### 4. Verificar que está Funcionando

```bash
# Ver logs del contenedor
docker-compose logs -f

# Verificar salud del servicio
curl http://localhost:4004/health

# Ver configuración
curl http://localhost:4004/config

# Acceder a GraphQL Playground
# Abre navegador en: http://localhost:4004/playground
```

### 5. Detener el Contenedor

```bash
# Parar el servicio
docker-compose down

# Parar y eliminar volúmenes
docker-compose down -v
```

## Puertos Mapeados

| Servicio | Puerto Host | Puerto Contenedor |
|----------|------------|-------------------|
| ms_websocket | **4004** | 3000 |

## Conectarse desde otros Servicios

Desde otros contenedores Docker en la misma red, usa:
```
http://ms-websocket:3000
```

Desde servicios en el host, usa:
```
http://localhost:4004
```

## Troubleshooting

### Error: "Cannot connect to Redis"
- Verifica que Redis está corriendo: `redis-cli ping`
- En Windows, asegúrate que Redis está escuchando en `127.0.0.1:6379`
- Comprueba que `.env.docker` tiene `REDIS_HOST=host.docker.internal`

### Error: "Connection refused"
- Verifica que el servicio en el host está realmente ejecutándose
- Para Redis: `redis-cli ping` debe responder `PONG`
- Para PostgreSQL: `psql -U postgres -h localhost` debe conectarse

### El contenedor inicia pero se apaga inmediatamente
```bash
# Ver logs de error
docker-compose logs ms-websocket

# Reconstruir sin caché
docker-compose up --build --no-cache
```

### Permisos en Linux/Mac
```bash
# Si obtienes errores de permisos
docker-compose down
sudo docker-compose up --build
```

## Información de Conexión para Microservicios

El ms_websocket está configurado para conectarse a otros servicios en el host:

```
MS_AUTH_URL=http://host.docker.internal:8000
MS_DESPACHO_URL=http://host.docker.internal:8001
MS_DECISION_URL=http://host.docker.internal:8002
```

Si estos servicios NO están corriendo, el ms_websocket seguirá funcionando pero las integraciones fallarán.

## Usar en Production

Para production, usa variables de entorno diferentes:

```bash
docker-compose -f docker-compose.yml up -d \
  -e NODE_ENV=production \
  -e JWT_SECRET=your_production_secret
```

O crea un archivo `docker-compose.prod.yml` específico.

## Integración con docker-compose global

Si tienes un docker-compose.yml en la raíz del proyecto, puedes incluir ms_websocket así:

```yaml
services:
  ms-websocket:
    build:
      context: ./ms_websocket
      dockerfile: Dockerfile
    container_name: ms-websocket
    ports:
      - "4004:3000"
    env_file:
      - ./ms_websocket/.env.docker
    network_mode: host
    restart: unless-stopped
```

## Monitoreo en Tiempo Real

```bash
# Ver logs en vivo
docker-compose logs -f --tail=50

# Ver estadísticas de uso
docker stats ms-websocket

# Acceder a la shell del contenedor
docker-compose exec ms-websocket sh
```

## Limpiar

```bash
# Eliminar contenedor y volúmenes
docker-compose down -v

# Eliminar imagen local
docker rmi ms_websocket

# Limpiar todo (¡cuidado!)
docker system prune -a
