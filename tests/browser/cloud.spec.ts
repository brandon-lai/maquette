import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import postgres from "postgres";
import type { Project } from "../../lib/schema";

test("optional cloud stores an exact snapshot behind a hashed capability with RLS", async ({
  page,
  request,
}) => {
  const base = process.env.CLOUD_BASE_URL;
  const url = process.env.CLOUD_DATABASE_URL;
  test.skip(
    !base || !url,
    "Requires a separate database-enabled server and disposable room-snapshot database.",
  );
  if (!base || !url)
    throw new Error("Cloud integration configuration is missing.");
  const sql = postgres(url, { prepare: false, max: 1 });
  let hash = "";
  try {
    expect(await (await request.get(`${base}/api/rooms`)).json()).toMatchObject(
      { cloudStorage: true },
    );
    await page.goto(base);
    await page.getByRole("button", { name: /Switch to metric/ }).click();
    const project = await page.evaluate(
      () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
    );
    const headers = { Origin: base };
    expect(
      (await request.post(`${base}/api/rooms`, { data: project })).status(),
    ).toBe(403);
    expect(
      (await request.post(`${base}/api/rooms`, { headers, data: {} })).status(),
    ).toBe(400);
    const saved = await request.post(`${base}/api/rooms`, {
      headers,
      data: project,
    });
    expect(saved.status()).toBe(201);
    const { token } = (await saved.json()) as { token: string };
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    hash = createHash("sha256").update(token).digest("hex");
    const loaded = await request.get(`${base}/api/rooms/${token}`);
    expect(loaded.status()).toBe(200);
    expect(await loaded.json()).toEqual(project);
    expect(loaded.headers()["cache-control"]).toBe("private, no-store");
    expect(
      (await request.get(`${base}/api/rooms/${"f".repeat(64)}`)).status(),
    ).toBe(404);
    expect((await request.get(`${base}/api/rooms/invalid`)).status()).toBe(400);
    const [row] =
      await sql`select token_hash, jsonb_typeof(project) as kind from public.room_snapshots where token_hash=${hash}`;
    expect(row).toEqual({ token_hash: hash, kind: "object" });
    expect(
      (
        await sql`select relrowsecurity from pg_class where oid='public.room_snapshots'::regclass`
      )[0].relrowsecurity,
    ).toBe(true);
    expect(
      await sql`select column_name from information_schema.columns where table_schema='public' and table_name='room_snapshots' and column_name ~ '(^|_)ip($|_)'`,
    ).toEqual([]);
  } finally {
    if (hash)
      await sql`delete from public.room_snapshots where token_hash=${hash}`;
    await sql.end();
  }
});
