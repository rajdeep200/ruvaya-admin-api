import{ok,fail}from"@/lib/http/api";import{prisma}from"@/lib/db/prisma";import{serviceStatus}from"@/config/env";
export async function GET(){try{await prisma.$queryRaw`SELECT 1`;return ok({status:"ok",database:"connected",services:serviceStatus,timestamp:new Date().toISOString()})}catch{return fail("INTERNAL_ERROR","Database unavailable",503,{status:"degraded",services:serviceStatus})}}
