import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export const randomToken=()=>randomBytes(32).toString("base64url");
export const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
export function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
