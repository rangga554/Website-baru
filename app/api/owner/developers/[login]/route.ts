import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { removeDeveloper } from "@/lib/developer";
import { logAction } from "@/lib/auditLog";
export async function DELETE(req:Request,{params}:{params:{login:string}}){const session=await getServerSession(authOptions);if(!session)return Response.json({error:"Unauthorized"},{status:401});const login=(session as any).login as string;if(!isOwner(login))return Response.json({error:"Cuma owner yang bisa mencabut developer"},{status:403});try{const target=decodeURIComponent(params.login);await removeDeveloper(target);logAction(login,"remove_developer",`Cabut developer: ${target}`);return Response.json({ok:true})}catch(e:any){return Response.json({error:e.message},{status:500})}}
