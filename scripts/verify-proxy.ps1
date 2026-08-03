param([string]$BaseUrl = "http://localhost:3101", [string]$StorefrontOrigin = "http://localhost:3000")
$ErrorActionPreference = "Stop"
curl.exe -sS -D - -o NUL -H "Origin: $StorefrontOrigin" "$BaseUrl/api/v1/health"
curl.exe -sS -D - -o NUL -H "Origin: https://hostile.example" "$BaseUrl/api/v1/health"
curl.exe -sS -D - -o NUL -X OPTIONS -H "Origin: $StorefrontOrigin" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type,Idempotency-Key" "$BaseUrl/api/v1/checkout"
curl.exe -sS -D - -o NUL -X POST -H "Origin: https://hostile.example" "$BaseUrl/api/v1/admin/auth/logout"
curl.exe -sS -D - -o NUL -X POST -H "Origin: https://hostile.example" -H "Content-Type: application/json" -d "{}" "$BaseUrl/api/v1/webhooks/cashfree"
