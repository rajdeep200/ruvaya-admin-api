import { NextResponse } from "next/server";
import { ZodError } from "zod";
export type ApiErrorCode = "VALIDATION_ERROR" | "AUTH_EXPIRED" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "IDEMPOTENCY_CONFLICT" | "IDEMPOTENCY_IN_PROGRESS" | "RATE_LIMITED" | "PRODUCT_UNAVAILABLE" | "PRICE_CHANGED" | "PAYMENT_PENDING" | "PAYMENT_FAILED" | "NOT_CONFIGURED" | "INTERNAL_ERROR";
export function ok<T>(data: T, status = 200, headers?: HeadersInit) { return NextResponse.json({ success: true, data }, { status, headers }); }
export function fail(code: ApiErrorCode, message: string, status: number, details?: unknown) { return NextResponse.json({ success: false, error: { code, message, ...(details === undefined ? {} : { details }) } }, { status }); }
export async function parseJson(request: Request): Promise<unknown> { try { return await request.json(); } catch { throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON", 422); } }
export class ApiError extends Error { constructor(public code: ApiErrorCode, message: string, public status = 400, public details?: unknown) { super(message); } }
export function handleError(error: unknown) { if (error instanceof ApiError) return fail(error.code, error.message, error.status, error.details); if (error instanceof ZodError) return fail("VALIDATION_ERROR", "Validation failed", 422, error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message }))); console.error(error); return fail("INTERNAL_ERROR", "An unexpected error occurred. Retry is safe for read operations.", 500); }
