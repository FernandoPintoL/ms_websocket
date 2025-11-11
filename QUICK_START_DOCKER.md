# 🐳 Inicio Rápido - ms_websocket en Docker

## En 5 Minutos

### 1️⃣ Requisitos
- Docker Desktop instalado
- Redis/PostgreSQL/SQL Server corriendo en tu máquina local
- Puerto 4004 disponible

### 2️⃣ Iniciar

**Windows:**
```bash
docker-setup.bat
# Selecciona opción 1 (Iniciar con build)
```

**Linux/Mac:**
```bash
chmod +x docker-setup.sh
./docker-setup.sh
# Selecciona opción 1
```

**Manualmente:**
```bash
docker-compose up --build -d
```

### 3️⃣ Verificar

```bash
# Esperamos ~10 segundos para que inicie

# ✅ Verificar salud
curl http://localhost:4004/health

# ✅ Ver logs
docker-compose logs -f

# ✅ Acceder a GraphQL
http://localhost:4004/graphql

# ✅ Ver Playground
http://localhost:4004/playground
```

### 4️⃣ Parar

```bash
docker-compose down
```

---

## Qué Hace Esta Configuración

✅ **Dockeriza ms_websocket** - Corre en un contenedor Node.js
✅ **BD Local** - Conecta a Redis/PostgreSQL/SQL Server en tu máquina
✅ **Puerto 4004** - Expone en puerto 4004
✅ **host.docker.internal** - Permite que Docker acceda a servicios del host

---

## Elegir BD

### Por Defecto: Redis ✅
Usa `.env.docker` tal cual está

### PostgreSQL
```bash
cp .env.docker.postgres .env.docker
# Edita y cambia DB_PASSWORD
docker-compose up --build
```

### SQL Server
```bash
cp .env.docker.sqlserver .env.docker
# Edita y cambia DB_PASSWORD
docker-compose up --build
```

---

## URLs Importantes

| Recurso | URL |
|---------|-----|
| WebSocket | `ws://localhost:4004` |
| Health Check | `http://localhost:4004/health` |
| GraphQL | `http://localhost:4004/graphql` |
| Playground | `http://localhost:4004/playground` |
| Status | `http://localhost:4004/status` |

---

## Problemas Comunes

### ❌ "Cannot connect to Redis"
```bash
# Verifica Redis
redis-cli ping
# Debe responder: PONG
```

### ❌ "Connection refused"
El servicio en tu máquina no está corriendo. Verifica:
```bash
# Redis
redis-cli ping

# PostgreSQL
psql -U postgres -h localhost

# SQL Server
sqlcmd -S localhost -U sa
```

### ❌ Puerto 4004 en uso
```bash
# Encuentra qué está usando el puerto
netstat -tlnp | grep 4004

# O edita docker-compose.yml y cambia:
ports:
  - "4004:3000"  # Cambia el primer número
```

---

## Scripts Disponibles

| Sistema | Script |
|---------|--------|
| Windows | `docker-setup.bat` |
| Linux/Mac | `docker-setup.sh` |

Ambos ofrecen menú interactivo para:
- Iniciar/parar contenedor
- Ver logs
- Ver estado
- Verificar conexiones
- Limpiar

---

## Documentación Completa

Para más detalles, ver `DOCKER_SETUP.md`

---

## Desarrollo

### Ver logs en tiempo real
```bash
docker-compose logs -f
```

### Acceder a shell del contenedor
```bash
docker-compose exec ms-websocket sh
```

### Reconstruir sin caché
```bash
docker-compose up --build --no-cache
```

### Eliminar volúmenes
```bash
docker-compose down -v
```

---

¡Listo! El ms_websocket está corriendo en Docker en puerto 4004, conectado a tu BD local. 🎉
