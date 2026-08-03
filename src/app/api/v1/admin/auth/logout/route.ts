import{handleError,ok}from"@/lib/http/api";import{logout}from"@/modules/auth/service";export async function POST(){try{await logout();return ok({loggedOut:true})}catch(e){return handleError(e)}}
