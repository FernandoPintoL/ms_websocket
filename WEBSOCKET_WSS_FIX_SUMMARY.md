# WebSocket WSS Fix - Complete Solution

## Problem Summary

When accessing the WebSocket server from another device on the local network via IP address (e.g., `http://192.168.1.38:4004`), the browser automatically upgraded the connection from `ws://` (WebSocket) to `wss://` (WebSocket Secure/HTTPS), causing connection failures.

### Why This Happened

The browser security model treats IP addresses as "untrustworthy origins" when accessed over HTTP (not HTTPS). When detecting an untrustworthy origin, modern browsers automatically attempt to upgrade to a secure connection (`wss://`), but:
- The server was only configured to accept `ws://` connections
- The mismatch caused immediate connection failures

### Error Symptoms

- Connection shows "connecting" for a moment then immediately fails
- Browser console shows: `WebSocket connection to 'wss://192.168.1.38:4004/...' failed`
- Works fine with `localhost` but fails with IP addresses on the same local network

## Solution Applied

### 1. **Server-Side Configuration** (src/server.js)

Added comprehensive security headers and CORS configuration:

```javascript
// Socket.IO CORS with dynamic callback for development
const io = new SocketServer(httpServer, {
  cors: {
    origin: function(origin, callback) {
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);  // Allow ALL origins in development
      } else {
        const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',');
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowEIO3: true
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  perMessageDeflate: false  // Disable compression for development
});

// Helmet.js security configuration
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? true : {
    directives: {
      connectSrc: ["'self'", "ws://localhost:*", "ws://*:*", "wss://*:*", "http://*:*", "https://*:*"]
      // ... other CSP directives
    }
  },
  crossOriginOpenerPolicy: false,  // Allow from any origin for development
  crossOriginEmbedderPolicy: false // Allow embedded resources from any origin
}));

// Custom security headers for development
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  }
  next();
});
```

### 2. **Client-Side Configuration** (test.html)

**The KEY FIX** - Added `upgrade: false` in Socket.IO options:

```javascript
const socketOptions = {
  transports: ['websocket', 'polling'],
  upgrade: false,  // ⭐ THIS PREVENTS UPGRADE TO WSS
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  forceBase64: false,
  enablesXDR: false,
  rejectUnauthorized: false,
  extraHeaders: {
    'X-Requested-With': 'XMLHttpRequest'
  }
};

// For local IP addresses, explicitly disable secure mode
if (!isLocalhost && !fullUrl.includes('https')) {
  socketOptions.secure = false;
}

socket = io(fullUrl, socketOptions);
```

### 3. **Environment Configuration** (.env)

Already properly configured:
```env
NODE_ENV=development
APP_HOST=0.0.0.0
APP_PORT=4004
CORS_ORIGIN=*
```

## Verification

A comprehensive test (`test-websocket-connection.js`) was created to verify the fix:

```bash
node test-websocket-connection.js
```

### Test Results

```
✅ Localhost Connection (http://localhost:4004)
   - Status: PASS
   - Protocol: ws:// (correct)
   - Socket ID: 0IW-l7Yx1grEt00sAAAB

✅ IP Address Connection (http://192.168.1.38:4004)
   - Status: PASS
   - Protocol: ws:// (correct)
   - Socket ID: 5cVCvrFbMBJIkzw6AAAD

🎉 Both connections now use ws:// instead of wss://
```

## How It Works

### Before Fix
```
Browser detects IP access over HTTP
    ↓
"This is untrustworthy, upgrade to HTTPS"
    ↓
Attempts wss:// (WebSocket Secure)
    ↓
Server expects ws:// only
    ↓
❌ Connection fails
```

### After Fix
```
Socket.IO client with upgrade: false
    ↓
Refuses to upgrade ws:// to wss://
    ↓
Uses ws:// directly
    ↓
Server accepts ws:// connections
    ↓
✅ Connection succeeds
```

## Key Settings Explanation

| Setting | Value | Why |
|---------|-------|-----|
| `upgrade: false` | Disabled | Prevents automatic protocol upgrade to wss:// |
| `secure: false` | For IP | Explicitly tells Socket.IO: "This is HTTP, not HTTPS" |
| `crossOriginOpenerPolicy` | `unsafe-none` | Allows embedded content from any origin |
| `crossOriginEmbedderPolicy` | `unsafe-none` | Allows cross-origin requests in development |
| `cors: origin` | Function callback | Dynamic CORS validation by environment |
| `NODE_ENV` | `development` | Enables all development-friendly settings |

## Testing Checklist

- ✅ Localhost connection works: `http://localhost:4004/test.html`
- ✅ IP address connection works: `http://192.168.1.38:4004/test.html`
- ✅ Server responds with correct headers:
  - `Cross-Origin-Opener-Policy: unsafe-none`
  - `Cross-Origin-Embedder-Policy: unsafe-none`
- ✅ WebSocket protocol is `ws://` (not `wss://`)
- ✅ Connection from another device on same WiFi network works
- ✅ Redis connection active
- ✅ GraphQL endpoint functional

## Production Considerations

For production deployment, you MUST:

1. **Use HTTPS/WSS**
   ```env
   NODE_ENV=production
   ```

2. **Configure proper CORS**
   ```env
   CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
   ```

3. **Use valid SSL certificates** (not self-signed)

4. **Update Helmet.js CSP**
   ```javascript
   crossOriginOpenerPolicy: true,  // Enable in production
   crossOriginEmbedderPolicy: true,
   ```

5. **Test with production headers**:
   ```bash
   curl -i https://yourdomain.com:4004/health
   ```

## Files Modified

| File | Changes |
|------|---------|
| `src/server.js` | Added comprehensive CORS, CSP, and security header configuration |
| `test.html` | Added `upgrade: false` and `secure: false` to Socket.IO options |
| `.env` | Already correctly configured (no changes needed) |
| `package.json` | Added `socket.io-client` for testing |

## Testing the Fix

### From Browser

1. Clear browser cache: `Ctrl+Shift+Delete`
2. Open test page: `http://192.168.1.38:4004/test.html`
3. Enter URL: `http://192.168.1.38:4004`
4. Click "Conectar"
5. Check status shows "Conectado" ✅

### From Node.js

```bash
node test-websocket-connection.js
```

### From Other Devices

Same WiFi network required:
```
Android/iOS: http://192.168.1.38:4004/test.html
Laptop: http://192.168.1.38:4004/test.html
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Still seeing `wss://` | Old cached page | Ctrl+Shift+Delete cache |
| Connection refused | Server not running | `npm run dev` |
| Cannot reach host | Different network | Check same WiFi network |
| Timeout on connection | Firewall blocking | Allow port 4004 |

## References

- [Socket.IO CORS Documentation](https://socket.io/docs/v4/server-api/#new-server-options)
- [Socket.IO Client Options](https://socket.io/docs/v4/client-api/#new-Manager-url-options)
- [Helmet.js Security Headers](https://helmetjs.github.io/)
- [CORS Protocol](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

**Status**: ✅ FIXED

**Test Result**: 🎉 Both localhost and IP address connections working with `ws://`

**Ready for**: Flutter mobile app integration with WebSocket subscriptions
