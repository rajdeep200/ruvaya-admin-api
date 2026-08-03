import "server-only";
import { prisma } from "@/lib/db/prisma";
const SENSITIVE=/password|token|secret|authorization|cookie/i;
function redact(value:unknown):unknown { if(Array.isArray(value)) return value.map(redact); if(value&&typeof value==="object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,SENSITIVE.test(k)?"[REDACTED]":redact(v)])); return value; }
export async function audit(input:{adminUserId?:string;action:string;entityType:string;entityId?:string;before?:unknown;after?:unknown;reason?:string;requestId?:string}) { await prisma.auditLog.create({data:{...input,before:input.before?redact(input.before) as object:undefined,after:input.after?redact(input.after) as object:undefined}}); }
