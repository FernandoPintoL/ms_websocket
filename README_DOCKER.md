# 🐳 ms_websocket - Docker Edition

## 📖 Índice de Documentación Docker

Bienvenido a la versión dockerizada de ms_websocket. Aquí encontrarás todo lo necesario para ejecutar el servicio en Docker.

### 🚀 Para Empezar Rápido (5 minutos)
**Archivo:** [`QUICK_START_DOCKER.md`](./QUICK_START_DOCKER.md)
- Inicio rápido en 5 pasos
- Comandos esenciales
- URLs importantes
- Troubleshooting básico

### 📚 Documentación Completa
**Archivo:** [`DOCKER_SETUP.md`](./DOCKER_SETUP.md)
- Requisitos detallados
- Configuración paso a paso
- Solución de problemas extendida
- Integración con otros servicios
- Monitoreo y mantenimiento

### 📋 Resumen de Configuración
**Archivo:** [`DOCKER_SUMMARY.md`](./DOCKER_SUMMARY.md)
- Qué se configuró
- Arquitectura
- Estructura de archivos
- Diferencias Docker vs Local
- Próximos pasos

### ✅ Checklist de Setup
**Archivo:** [`DOCKER_CHECKLIST.md`](./DOCKER_CHECKLIST.md)
- Pre-requisitos
- Pasos de configuración
- Verificaciones post-deploy
- Pruebas funcionales
- Checklist final

### 🧪 Ejemplos de Prueba
**Archivo:** [`DOCKER_TEST_EXAMPLES.md`](./DOCKER_TEST_EXAMPLES.md)
- Ejemplos de curl
- Pruebas GraphQL
- Pruebas WebSocket
- Pruebas de BD
- Pruebas E2E

### 🔌 Integración Global
**Archivo:** [`../DOCKER_INTEGRATION.md`](../DOCKER_INTEGRATION.md)
- Cómo integrar en docker-compose principal
- Opciones de integración
- Notas importantes

---

## ⚡ Inicio Rápido (En 3 Pasos)

### 1️⃣ Verificar BD Local
```bash
# Redis (por defecto)
redis-cli ping
# Respuesta: PONG
```

### 2️⃣ Iniciar Contenedor
**Windows:**
```bash
docker-setup.bat
# Selecciona opción 1
```

**Linux/Mac:**
```bash
chmod +x docker-setup.sh
./docker-setup.sh
# Selecciona opción 1
```

**Manual:**
```bash
docker-compose up --build -d
```

### 3️⃣ Verificar Funcionamiento
```bash
curl http://localhost:4004/health
# Debe responder: {"status":"ok"}
```

¡Listo! El servicio está corriendo en `http://localhost:4004`

---

## 📁 Archivos Docker Creados

```
ms_websocket/
├── docker-compose.yml              ✨ Config principal Docker
├── .env.docker                     ✨ Variables de entorno (Redis)
├── .env.docker.postgres            ✨ Variables para PostgreSQL
├── .env.docker.sqlserver           ✨ Variables para SQL Server
├── docker-setup.sh                 ✨ Script helper (Linux/Mac)
├── docker-setup.bat                ✨ Script helper (Windows)
├── .dockerignore                   ✅ (ya existía)
├── Dockerfile                      ✅ (ya existía)
│
├── README_DOCKER.md                ✨ Este archivo
├── QUICK_START_DOCKER.md           ✨ Inicio rápido
├── DOCKER_SETUP.md                 ✨ Documentación completa
├── DOCKER_SUMMARY.md               ✨ Resumen
├── DOCKER_CHECKLIST.md             ✨ Checklist
└── DOCKER_TEST_EXAMPLES.md         ✨ Ejemplos de prueba
```

---

## 🎯 Características

✅ **Dockerizado** - Corre en contenedor Node.js 18 Alpine
✅ **BD Local** - Usa Redis/PostgreSQL/SQL Server de tu máquina
✅ **Puerto 4004** - Mapeado y listo
✅ **host.docker.internal** - Acceso transparente a servicios del host
✅ **Health Checks** - Verificación automática de salud
✅ **Logs Persistentes** - Volumen para logs
✅ **Scripts Helper** - Menús interactivos en Windows y Linux/Mac
✅ **Documentación Completa** - Todo lo que necesitas saber

---

## 🔧 Seleccionar Base de Datos

### 🔴 Redis (Recomendado)
Por defecto. Verifica que Redis está corriendo:
```bash
redis-cli ping
# Respuesta: PONG
```

### 🔵 PostgreSQL
```bash
cp .env.docker.postgres .env.docker
# Edita DB_PASSWORD si es necesario
docker-compose up --build
```

### 🟦 SQL Server
```bash
cp .env.docker.sqlserver .env.docker
# Edita DB_PASSWORD si es necesario
docker-compose up --build
```

---

## 📊 Puertos y URLs

| Recurso | Puerto | URL |
|---------|--------|-----|
| **WebSocket** | 4004 | `http://localhost:4004` |
| Health Check | 4004 | `http://localhost:4004/health` |
| GraphQL API | 4004 | `http://localhost:4004/graphql` |
| GraphQL Playground | 4004 | `http://localhost:4004/playground` |
| Status/Metrics | 4004 | `http://localhost:4004/metrics` |

---

## 🛠️ Comandos Básicos

```bash
# Iniciar
docker-compose up --build -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f

# Status
docker-compose ps

# Shell
docker-compose exec ms-websocket sh

# Limpiar
docker-compose down -v
```

---

## 🎓 Estructura de Aprendizaje

1. **Primero:** Lee [`QUICK_START_DOCKER.md`](./QUICK_START_DOCKER.md) (5 min)
2. **Luego:** Ejecuta los pasos de inicio rápido
3. **Verifica:** Usa el [`DOCKER_CHECKLIST.md`](./DOCKER_CHECKLIST.md)
4. **Prueba:** Sigue ejemplos en [`DOCKER_TEST_EXAMPLES.md`](./DOCKER_TEST_EXAMPLES.md)
5. **Profundiza:** Lee [`DOCKER_SETUP.md`](./DOCKER_SETUP.md) si necesitas

---

## 🆘 Ayuda Rápida

### El contenedor no inicia
```bash
# Ver logs de error
docker-compose logs ms-websocket

# Reconstruir
docker-compose up --build --no-cache
```

### No se conecta a BD
```bash
# Verificar que BD está corriendo
redis-cli ping
# O para PostgreSQL
psql -U postgres -h localhost
```

### Puerto 4004 en uso
```bash
# Ver qué lo usa
netstat -tlnp | grep 4004

# O cambiar en docker-compose.yml:
# ports:
#   - "4005:3000"
```

---

## 📞 Soporte

Para más información:
- 📖 **Documentación:** Archivos `.md` en este directorio
- 🐛 **Problemas:** Ver sección Troubleshooting en `DOCKER_SETUP.md`
- 💬 **Preguntas:** Revisar ejemplos en `DOCKER_TEST_EXAMPLES.md`

---

## ✨ Próximos Pasos

1. ✅ Lee `QUICK_START_DOCKER.md`
2. ✅ Ejecuta `docker-compose up --build`
3. ✅ Verifica `curl http://localhost:4004/health`
4. ✅ Prueba GraphQL en `http://localhost:4004/playground`
5. ✅ Revisa logs: `docker-compose logs -f`

---

## 📝 Notas Importantes

- **host.docker.internal** permite que Docker acceda a servicios en tu máquina
- **network_mode: host** mantiene compatibilidad con la configuración existente
- **BD Local** no se incluye en Docker (tú la controlas)
- **Logs** se guardan en `./logs/` dentro del contenedor
- **Desarrollo rápido** - Cambios en código requieren rebuild o nodemon

---

## 🎉 ¡Listo!

Tu ms_websocket está completamente dockerizado y listo para:
- ✅ Desarrollo local
- ✅ Testing
- ✅ Integración con otros servicios
- ✅ Deployment en producción (con ajustes)

**¡Comienza ahora:**
```bash
docker-compose up --build
```

---

**Última actualización:** 2024
**Estado:** ✅ Operacional
**Versión:** 1.0
