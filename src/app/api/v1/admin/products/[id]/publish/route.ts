import{handleError,ok}from"@/lib/http/api";import{requireAdmin}from"@/modules/auth/service";import{publishProduct}from"@/modules/products/service";
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){try{const admin=await requireAdmin("catalogue.write");return ok(await publishProduct((await params).id,admin.id))}catch(e){return handleError(e)}}
