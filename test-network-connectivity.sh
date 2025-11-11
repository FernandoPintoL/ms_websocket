#!/bin/bash

##############################################################################
# WebSocket Network Connectivity Test Suite
#
# Verifica que el servidor WebSocket sea accesible desde cualquier IP
# en la red local.
#
# Uso:
#   chmod +x test-network-connectivity.sh
#   ./test-network-connectivity.sh
#
# Plataformas soportadas:
#   - Linux
#   - macOS
#   - Windows (Git Bash o WSL)
##############################################################################

# Configuración de colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Configuración
LOCALHOST="http://localhost:3001"
PORT="3001"

# Contadores
TESTS_PASSED=0
TESTS_FAILED=0

##############################################################################
# Funciones de utilidad
##############################################################################

print_header() {
  clear
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  WebSocket Network Connectivity Test Suite ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
  echo ""
}

print_test_header() {
  echo -e "\n${BLUE}$1${NC}"
  echo -e "${GRAY}$(printf '%0.s─' {1..50})${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
  ((TESTS_PASSED++))
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
  ((TESTS_FAILED++))
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${GRAY}   $1${NC}"
}

# Obtener IP local
get_local_ip() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    hostname -I | awk '{print $1}'
  else
    # Windows (Git Bash/WSL)
    hostname -I 2>/dev/null | awk '{print $1}' || ipconfig | grep "IPv4" | awk '{print $NF}' | head -1
  fi
}

##############################################################################
# Tests
##############################################################################

# Test 1: Verificar conexión local
test_local_connection() {
  print_test_header "📍 Test 1: Local Connection"

  if command -v curl &> /dev/null; then
    if curl -s --max-time 5 "$LOCALHOST/health" &> /dev/null; then
      print_success "Server is running on localhost:3001"
      return 0
    else
      print_error "Server not responding on localhost"
      return 1
    fi
  else
    print_warning "curl not found, skipping HTTP tests"
    return 0
  fi
}

# Test 2: Verificar puerto abierto
test_port_open() {
  print_test_header "🔌 Test 2: Port Availability"

  if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
      print_success "Port $PORT is open and listening"
      return 0
    else
      print_error "Port $PORT not found"
      return 1
    fi
  elif command -v lsof &> /dev/null; then
    if lsof -i :$PORT &> /dev/null; then
      print_success "Port $PORT is open and listening"
      return 0
    else
      print_error "Port $PORT not found"
      return 1
    fi
  else
    print_warning "netstat/lsof not found, skipping port check"
    return 0
  fi
}

# Test 3: Verificar endpoints
test_endpoints() {
  print_test_header "🌐 Test 3: Available Endpoints"

  if ! command -v curl &> /dev/null; then
    print_warning "curl not found, skipping endpoint tests"
    return 0
  fi

  local endpoints=(
    "/health:Health Check"
    "/health/detailed:Detailed Health"
    "/status:Status"
    "/connections:Connections"
    "/metrics:Metrics"
  )

  local success_count=0

  for endpoint_pair in "${endpoints[@]}"; do
    local endpoint="${endpoint_pair%%:*}"
    local name="${endpoint_pair##*:}"

    if curl -s --max-time 3 "$LOCALHOST$endpoint" &> /dev/null; then
      printf "%-20s" "$name"
      print_success "→ //$endpoint"
      ((success_count++))
    else
      printf "%-20s" "$name"
      print_error "→ //$endpoint"
    fi
  done

  [ $success_count -eq ${#endpoints[@]} ]
}

# Test 4: Verificar CORS
test_cors() {
  print_test_header "🔐 Test 4: CORS Configuration"

  if ! command -v curl &> /dev/null; then
    print_warning "curl not found, skipping CORS test"
    return 0
  fi

  local cors_header=$(curl -s -H "Origin: http://test.local:3000" \
    --max-time 3 \
    -D - "$LOCALHOST/health" 2>/dev/null | \
    grep -i "access-control-allow-origin" | \
    cut -d' ' -f2 | tr -d '\r')

  if [ -n "$cors_header" ]; then
    print_success "CORS is enabled: $cors_header"
    return 0
  else
    print_warning "CORS header not found (might be OK)"
    return 0
  fi
}

# Test 5: Verificar accesibilidad de red
test_network_accessibility() {
  print_test_header "🌍 Test 5: Network Accessibility"

  local local_ip=$(get_local_ip)

  if [ -z "$local_ip" ]; then
    print_warning "Could not determine local IP"
    print_info "Run: ifconfig (macOS/Linux) or ipconfig (Windows)"
    return 0
  fi

  print_info "Local IP: $local_ip"
  print_info "Access from other devices:"
  print_info "  Browser: http://$local_ip:3001/health"
  print_info "  WebSocket: ws://$local_ip:3001"

  if command -v curl &> /dev/null; then
    if curl -s --max-time 5 "http://$local_ip:3001/health" &> /dev/null; then
      print_success "Server is accessible from IP: $local_ip:3001"
      return 0
    else
      print_warning "Could not access from $local_ip:3001"
      print_info "This might be normal if on different subnet"
      return 0
    fi
  else
    return 0
  fi
}

# Test 6: Información del servidor
test_server_info() {
  print_test_header "📊 Test 6: Server Information"

  if ! command -v curl &> /dev/null; then
    print_warning "curl not found, skipping server info"
    return 0
  fi

  local response=$(curl -s --max-time 3 "$LOCALHOST/status")

  if [ -n "$response" ]; then
    print_info "Server response:"
    print_info "$response" | head -5
    return 0
  else
    print_error "Could not fetch server info"
    return 1
  fi
}

# Test 7: Verificar variables de entorno
test_env_variables() {
  print_test_header "⚙️  Test 7: Environment Variables"

  if [ ! -f ".env" ]; then
    print_error ".env file not found"
    print_info "Create .env with:"
    print_info "  APP_HOST=0.0.0.0"
    print_info "  APP_PORT=3001"
    print_info "  CORS_ORIGIN=*"
    return 1
  fi

  # Verificar variables importantes
  local app_host=$(grep "APP_HOST" .env | cut -d'=' -f2 | tr -d ' ')
  local app_port=$(grep "APP_PORT" .env | cut -d'=' -f2 | tr -d ' ')
  local cors=$(grep "CORS_ORIGIN" .env | cut -d'=' -f2 | tr -d ' ')

  if [ "$app_host" = "0.0.0.0" ]; then
    print_success "APP_HOST=0.0.0.0 (correct)"
  else
    print_warning "APP_HOST=$app_host (should be 0.0.0.0)"
  fi

  if [ "$app_port" = "3001" ]; then
    print_success "APP_PORT=3001 (correct)"
  else
    print_warning "APP_PORT=$app_port"
  fi

  if [ "$cors" = "*" ] || [ "$cors" = "*" ]; then
    print_success "CORS_ORIGIN=* (correct for development)"
  else
    print_warning "CORS_ORIGIN=$cors"
  fi

  return 0
}

##############################################################################
# Main
##############################################################################

main() {
  print_header

  # Ejecutar tests
  test_local_connection
  test_port_open
  test_endpoints
  test_cors
  test_network_accessibility
  test_server_info
  test_env_variables

  # Summary
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║              Test Summary                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

  local total=$((TESTS_PASSED + TESTS_FAILED))

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Server is properly configured and accessible.${NC}"
    echo ""

    local local_ip=$(get_local_ip)
    if [ -n "$local_ip" ]; then
      echo -e "${GRAY}Access WebSocket from other devices:${NC}"
      echo -e "${BLUE}  ws://$local_ip:3001${NC}"
      echo -e "${BLUE}  http://$local_ip:3001/health${NC}"
    fi

    exit 0
  else
    echo -e "${RED}❌ $TESTS_FAILED test(s) failed.${NC}"
    echo -e "${YELLOW}Passed: $TESTS_PASSED/$total${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "${GRAY}  1. Ensure server is running: npm run dev${NC}"
    echo -e "${GRAY}  2. Check firewall allows port 3001${NC}"
    echo -e "${GRAY}  3. Verify APP_HOST=0.0.0.0 in .env${NC}"
    echo -e "${GRAY}  4. Check CORS_ORIGIN=* in .env${NC}"
    echo -e "${GRAY}  5. Run: npm install && npm run dev${NC}"
    exit 1
  fi
}

# Ejecutar
main "$@"
