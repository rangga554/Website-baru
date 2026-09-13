import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inviteCollaborator, listCollaboratorsForRepo, revokeCollaborator } from "@/lib/collaboration";

// GET ?owner=&repo= -> daftar collaborator (pending + accepted) buat repo itu
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  if (!myLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) return Response.json({ error: "owner & repo wajib diisi" }, { status: 400 });
  if (owner.toLowerCase() !== myLogin.toLowerCase()) {
    return Response.json({ error: "Cuma owner repo yang bisa lihat ini" }, { status: 403 });
  }

  try {
    const list = await listCollaboratorsForRepo(owner, repo);
    return Response.json(list);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { repo, invitedLogin }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  if (!myLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { repo, invitedLogin } = await req.json();
    if (!repo || !invitedLogin) {
      return Response.json({ error: "repo & invitedLogin wajib diisi" }, { status: 400 });
    }
    const invite = await inviteCollaborator({ ownerLogin: myLogin, repo, invitedLogin });
    return Response.json(invite);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

// Body: { repo, invitedLogin }
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  if (!myLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { repo, invitedLogin } = await req.json();
    await revokeCollaborator({ ownerLogin: myLogin, repo, invitedLogin });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
