import{z}from"zod";import{handleError,ok,parseJson}from"@/lib/http/api";import{login}from"@/modules/auth/service";
export async function POST(request:Request){try{const input=z.object({email:z.string().email(),password:z.string().min(1)}).parse(await parseJson(request));return ok(await login(input.email,input.password))}catch(e){return handleError(e)}}
