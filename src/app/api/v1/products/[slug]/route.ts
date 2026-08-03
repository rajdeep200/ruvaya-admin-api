import { handleError,ok } from "@/lib/http/api";import { getPublicProduct } from "@/modules/products/service";import { productDetailDto } from "@/contracts/public/mappers";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){try{return ok(productDetailDto(await getPublicProduct((await params).slug)))}catch(e){return handleError(e)}}
