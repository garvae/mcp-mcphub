# Caddy

## Example Caddyfile

```caddyfile
mcp.example.com {
  encode zstd gzip

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "no-referrer"
  }

  reverse_proxy 127.0.0.1:7345 {
    header_up Host {host}
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-For {remote_host}
  }
}
```

## Recommended Runtime Pairing

Run the application locally on the same host:

```bash
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=7345
MCP_HTTP_ALLOWED_HOSTS=mcp.example.com
MCP_HTTP_ALLOWED_ORIGINS=https://claude.ai,https://chat.openai.com
mcp-mcphub http
```

## Notes

- Keep the node listener on localhost.
- Terminate TLS at Caddy.
- Set `MCP_HTTP_ALLOWED_HOSTS` to the external hostname that Caddy forwards.
- Keep origin allowlists explicit when browser-based clients are involved.
