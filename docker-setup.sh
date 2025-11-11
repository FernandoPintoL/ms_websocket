#!/bin/bash

# MS WebSocket Docker Helper Script
# Facilita la gestión del contenedor Docker

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Mostrar menú
show_menu() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════${NC}"
  echo -e "${BLUE}   MS WebSocket - Docker Helper${NC}"
  echo -e "${BLUE}═══════════════════════════════════════${NC}"
  echo ""
  echo "1) Iniciar contenedor (build)"
  echo "2) Iniciar contenedor (sin rebuild)"
  echo "3) Parar contenedor"
  echo "4) Ver logs"
  echo "5) Ver estado"
  echo "6) Limpiar (eliminar contenedor)"
  echo "7) Verificar conexión a BD"
  echo "8) Acceder a shell del contenedor"
  echo "9) Salir"
  echo ""
}

# Verificar si Docker está instalado
check_docker() {
  if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado o no está en el PATH"
    exit 1
  fi

  if ! docker ps &> /dev/null; then
    print_error "Docker daemon no está ejecutándose"
    exit 1
  fi
}

# Verificar BD local
check_redis() {
  print_info "Verificando conexión a Redis..."
  if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
      print_success "Redis está corriendo en localhost:6379"
      return 0
    else
      print_error "Redis no responde. Verifica que está ejecutándose."
      return 1
    fi
  else
    print_warning "redis-cli no encontrado, pero puedes tener Redis corriendo"
    return 0
  fi
}

# Iniciar contenedor con build
start_with_build() {
  print_info "Construyendo e iniciando contenedor..."
  docker-compose up --build -d
  print_success "Contenedor iniciado"
  sleep 2
  check_health
}

# Iniciar contenedor sin build
start_no_build() {
  print_info "Iniciando contenedor..."
  docker-compose up -d
  print_success "Contenedor iniciado"
  sleep 2
  check_health
}

# Parar contenedor
stop_container() {
  print_info "Parando contenedor..."
  docker-compose down
  print_success "Contenedor parado"
}

# Ver logs
view_logs() {
  print_info "Mostrando logs (Ctrl+C para salir)..."
  docker-compose logs -f --tail=50
}

# Ver estado
view_status() {
  print_info "Estado del contenedor:"
  echo ""
  docker-compose ps
  echo ""
  print_info "Intentando verificar salud..."
  if curl -f http://localhost:4004/health &> /dev/null; then
    print_success "Servicio está saludable"
    print_info "Puertos:"
    echo "  - WebSocket: http://localhost:4004"
    echo "  - Health: http://localhost:4004/health"
    echo "  - GraphQL: http://localhost:4004/graphql"
    echo "  - Playground: http://localhost:4004/playground"
  else
    print_warning "No se pudo verificar salud (el servicio podría estar iniciándose)"
  fi
}

# Limpiar
cleanup() {
  print_warning "Esto eliminará el contenedor y los volúmenes"
  read -p "¿Estás seguro? (s/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Limpiando..."
    docker-compose down -v
    print_success "Limpieza completada"
  else
    print_info "Cancelado"
  fi
}

# Acceder a shell
shell_access() {
  print_info "Accediendo a shell del contenedor..."
  docker-compose exec ms-websocket sh
}

# Verificar conexiones
check_connections() {
  echo ""
  echo "Verificando BD local:"
  check_redis

  echo ""
  print_info "Verificando otros servicios (desde Docker):"

  # Intentar conectar a otros servicios desde Docker
  if docker-compose exec -T ms-websocket curl -s http://host.docker.internal:8000/health &> /dev/null; then
    print_success "MS Autentificación (8000) está disponible"
  else
    print_warning "MS Autentificación (8000) no responde"
  fi

  if docker-compose exec -T ms-websocket curl -s http://host.docker.internal:8001/api/health &> /dev/null; then
    print_success "MS Despacho (8001) está disponible"
  else
    print_warning "MS Despacho (8001) no responde"
  fi
}

# Main loop
check_docker

while true; do
  show_menu
  read -p "Selecciona una opción: " option

  case $option in
    1)
      start_with_build
      ;;
    2)
      start_no_build
      ;;
    3)
      stop_container
      ;;
    4)
      view_logs
      ;;
    5)
      view_status
      ;;
    6)
      cleanup
      ;;
    7)
      check_connections
      ;;
    8)
      shell_access
      ;;
    9)
      print_info "¡Hasta luego!"
      exit 0
      ;;
    *)
      print_error "Opción no válida"
      ;;
  esac
done
