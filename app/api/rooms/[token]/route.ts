import { createHash } from "node:crypto";
import { database, hasDatabase } from "@/lib/server/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  if (!hasDatabase)
    return Response.json(
      { error: "Cloud storage is not configured." },
      { status: 503 },
    );
  const { token } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(token))
    return Response.json(
      { error: "This room link is invalid." },
      { status: 400 },
    );
  try {
    const hash = createHash("sha256").update(token).digest("hex");
    const rows =
      await database()`select project from public.room_snapshots where token_hash = ${hash}`;
    if (!rows.length)
      return Response.json(
        { error: "This room was not found." },
        { status: 404 },
      );
    return Response.json(rows[0].project, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Cloud room read failed:", error);
    return Response.json(
      { error: "This room could not be loaded. Try again later." },
      { status: 503 },
    );
  }
}
