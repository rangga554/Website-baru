import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listDevelopers, addDeveloper } from "@/lib/developer";
import { logAction } from "@/lib/auditLog";
export async function GET() { const session=await getServerSession(authOptions); if(!session)return Response.json({error:"Unauthorized"},{status:401}); const login=(session as any).login as string; if(!isOwner(login))return Response.json({error:"Cuma owner yang bisa melihat developer"},{status:403}); try{return Response.json(await listDevelopers())}catch(e:any){return Response.json({error:e.message},{status:500})} }
export async function POST(req:Request){const session=await getServerSession(authOptions);if(!session)return Response.json({error:"Unauthorized"},{status:401});const login=(session as any).login as string;if(!isOwner(login))return Response.json({error:"Cuma owner yang bisa menambah developer"},{status:403});const body=await req.json().catch(()=>null);if(!body?.login)return Response.json({error:"Username wajib diisi"},{status:400});try{await addDeveloper(body.login,login);logAction(login,"add_developer",`Tambah developer: ${body.login}`);return Response.json({ok:true})}catch(e:any){return Response.json({error:e.message},{status:400})}}
