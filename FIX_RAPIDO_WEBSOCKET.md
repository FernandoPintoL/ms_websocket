# ⚡ FIX RÁPIDO - Conexión WebSocket

## El Problema en 1 Línea

**El navegador intenta conectar con `wss://` pero tu servidor espera `ws://`**

---

## La Solución en 3 Pasos

### 1️⃣ Abre el navegador
```
http://192.168.1.38:4004/test.html
```

### 2️⃣ En el input de "URL del Servidor", cambia
```
DE: https://192.168.1.38:4004
A:  http://192.168.1.38:4004
```

### 3️⃣ Haz clic en "Conectar"
```
✅ Debe funcionar ahora
```

---

## ¿Por qué pasó?

```
http://  → WebSocket sin seguridad (ws://)    ✅ Desarrollo
https:// → WebSocket con seguridad (wss://)   ❌ Producción + HTTPS
```

Tu servidor está en HTTP (desarrollo), así que necesita `ws://`, no `wss://`

---

## ✅ Verificación

- [ ] Abrí: `http://192.168.1.38:4004/test.html`
- [ ] Ingresé: `http://192.168.1.38:4004`
- [ ] Hice clic en "Conectar"
- [ ] Veo: ✅ "Conectado al servidor WebSocket"

---

## Si no funciona todavía

```bash
# 1. Verifica que el servidor está corriendo
npm run dev

# 2. Desde otra PC, prueba esto
curl http://192.168.1.38:4004/health

# 3. Abre la consola del navegador (F12)
# Deberías ver: "Conectando a: http://192.168.1.38:4004"
# NO: "wss://..." (si ves esto, no está usando http://)
```

---

**¡Eso es! El archivo ya está arreglado. Solo usa `http://` en el navegador 🚀**

