import { notFound } from "next/navigation";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { getAdminProduct } from "@/modules/products/service";
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){let data;try{data=await getAdminProduct((await params).id)}catch{notFound()}const product=JSON.parse(JSON.stringify(data.product));const collections=data.collections.map(item=>({...item,publishedAt:item.publishedAt?.toISOString()??null}));return<><div className="header"><div><h1>Edit {product.name}</h1><p className="muted">Manage the complete product record without exposing private source or cost data.</p></div></div><ProductEditor initialProduct={product} collections={collections}/></>}
