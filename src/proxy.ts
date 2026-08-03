import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API_PREFIX = "/api/v1/";
const ADMIN_API_PREFIX = "/api/v1/admin/";
const CASHFREE_WEBHOOK = "/api/v1/webhooks/cashfree";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_METHODS = "GET,POST,OPTIONS";
const ALLOWED_HEADERS = "Content-Type,Idempotency-Key,Authorization";

function normalizedOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function appendVary(headers: Headers, value: string) {
  const current = headers.get("vary")?.split(",").map((item) => item.trim()) ?? [];
  if (!current.includes(value)) headers.set("vary", [...current, value].join(", "));
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set(
    "content-security-policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self' https://api.cloudinary.com",
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

function applyStorefrontCors(response: NextResponse, origin: string) {
  response.headers.set("access-control-allow-origin", origin);
  response.headers.set("access-control-allow-methods", ALLOWED_METHODS);
  response.headers.set("access-control-allow-headers", ALLOWED_HEADERS);
  response.headers.set("access-control-allow-credentials", "true");
  appendVary(response.headers, "Origin");
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const origin = normalizedOrigin(request.headers.get("origin") ?? undefined);
  const storefrontOrigin = normalizedOrigin(process.env.STOREFRONT_ORIGIN);
  const appOrigin = normalizedOrigin(process.env.APP_URL);
  const isPublicApi = pathname.startsWith(PUBLIC_API_PREFIX) && !pathname.startsWith(ADMIN_API_PREFIX);
  const isApprovedStorefront = Boolean(origin && storefrontOrigin && origin === storefrontOrigin);

  if (
    pathname.startsWith(ADMIN_API_PREFIX) &&
    !SAFE_METHODS.has(request.method) &&
    origin &&
    (!appOrigin || origin !== appOrigin)
  ) {
    return applySecurityHeaders(
      NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Cross-site admin mutation rejected" } },
        { status: 403 },
      ),
    );
  }

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: isApprovedStorefront && isPublicApi ? 204 : 403 });
    if (isApprovedStorefront && isPublicApi) applyStorefrontCors(response, origin!);
    return applySecurityHeaders(response);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", request.headers.get("x-request-id") ?? crypto.randomUUID());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isApprovedStorefront && isPublicApi && pathname !== CASHFREE_WEBHOOK) {
    applyStorefrontCors(response, origin!);
  }
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
