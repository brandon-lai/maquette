import { createHash, randomBytes } from "node:crypto";
import { database, hasDatabase } from "@/lib/server/db";
import { validateProject } from "@/lib/storage";
import { requestOrigin } from "@/lib/server/request-origin";

export async function GET() {
  return Response.json({
    cloudStorage: hasDatabase,
    mode: hasDatabase ? "cloud-capable" : "local-first",
  });
}
export async function POST(request: Request) {
  if (!hasDatabase)
    return Response.json(
      {
        error:
          "Cloud storage is not configured. Your room remains in this browser; use a snapshot link or export.",
      },
      { status: 503 },
    );
  if (request.headers.get("origin") !== requestOrigin(request))
    return Response.json(
      { error: "Cloud snapshots must be created from this app." },
      { status: 403 },
    );
  const text = await request.text();
  if (text.length > 100000)
    return Response.json({ error: "The room is too large." }, { status: 413 });
  let project;
  try {
    project = validateProject(JSON.parse(text));
  } catch {
    return Response.json(
      {
        error:
          "The room data is invalid. Confirm the dimensions and try again.",
      },
      { status: 400 },
    );
  }
  try {
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const sql = database();
    await sql`insert into public.room_snapshots (token_hash, project) values (${hash}, ${sql.json(project)})`;
    return Response.json({ token }, { status: 201 });
  } catch (error) {
    console.error("Cloud room save failed:", error);
    return Response.json(
      {
        error:
          "The cloud room could not be saved. Your local copy is unchanged.",
      },
      { status: 503 },
    );
  }
}
