import { expect, test } from "@playwright/test";
import { allWarnings } from "../../lib/solver";
import type { Project } from "../../lib/schema";

test("suggested layouts run in the browser worker and keep every hard constraint", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".layout-option")).toHaveCount(3);
  await page.getByRole("button", { name: "Suggest three layouts" }).click();
  await expect(
    page.getByRole("button", { name: "Suggest three layouts" }),
  ).toBeEnabled();
  await expect(page.locator(".layout-active")).toHaveCount(1);
  const project = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(
    allWarnings(project.room, project.items, project.placements, project.brief),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test("a new room requires confirmation, then a custom measured piece can be added", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New room", exact: true }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Check every measurement",
  );
  await page.getByLabel("Room name", { exact: true }).fill("My measured room");
  await page.getByRole("button", { name: "Confirm the room" }).click();
  await expect(
    page.getByRole("heading", { name: "My measured room", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fit-status")).toContainText("not placed yet");
  await page
    .getByRole("button", { name: "Add a piece", exact: true })
    .first()
    .click();
  await page.getByLabel("Piece name", { exact: true }).fill("My measured desk");
  await page.getByLabel("Width (inches)", { exact: true }).fill("48");
  await page.getByLabel("Depth (inches)", { exact: true }).fill("24");
  await page.getByLabel("Height (inches)", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Add this piece", exact: true })
    .click();
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(p.room.confirmed).toBe(true);
  expect(p.items.find((i) => i.name === "My measured desk")?.width).toBeCloseTo(
    121.92,
  );
  expect(p.placements).toEqual([]);
});

test("drawing near sheet edges and in its center closes at desktop and mobile widths", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [left, right] of [
      [0.06, 0.25],
      [0.35, 0.65],
    ]) {
      await page.goto("/");
      await page.getByRole("button", { name: "New room", exact: true }).click();
      await page.getByRole("button", { name: "Draw the walls" }).click();
      const sheet = page.locator(".draw-sheet");
      const box = await sheet.boundingBox();
      expect(box).not.toBeNull();
      for (const [x, y] of [
        [left, 0.2],
        [right, 0.2],
        [right, 0.7],
        [left, 0.7],
      ]) {
        await sheet.click({
          position: { x: box!.width * x, y: box!.height * y },
        });
      }
      await expect(sheet.locator("circle")).toHaveCount(4);
      await page.getByRole("button", { name: "Close the room" }).click();
      await expect(page.getByRole("dialog")).toContainText(
        "Check every measurement",
      );
      await page.getByLabel("Room name", { exact: true }).fill("Drawn room");
      await page.getByRole("button", { name: "Confirm the room" }).click();
      const project = await page.evaluate(
        () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
      );
      expect(project.room.confirmed).toBe(true);
      expect(project.room.polygon).toHaveLength(4);
      expect(Math.max(...project.room.polygon.map((p) => p.x))).toBeGreaterThan(
        100,
      );
      expect(Math.max(...project.room.polygon.map((p) => p.y))).toBeGreaterThan(
        250,
      );
    }
  }
});

test("plan keyboard edits rotate in 15 degree steps and update persisted coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  const bed = page.locator(".plan-sheet [data-item=bed]");
  await bed.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("r");
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  const bedPlacement = p.placements.find((i) => i.itemId === "bed")!;
  expect(bedPlacement.rotation).toBe(15);
  expect(bedPlacement.x).toBeGreaterThan(130.96);
  await expect(
    page.getByRole("button", {
      name: "Rotate selected piece right 15 degrees",
    }),
  ).toBeVisible();
});

test("share is an immutable view-only snapshot and exports a real PNG", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Share room", exact: true }).click();
  const link = await page.getByLabel("View-only room link").inputValue();
  expect(link).toContain("/share#");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save plan PNG" }).click();
  const output = await download;
  expect(output.suggestedFilename()).toBe("maquette-plan.png");
  expect(await output.failure()).toBeNull();
  const shared = await context.newPage();
  await shared.goto(link);
  await expect(
    shared.getByRole("banner").getByText("View-only snapshot", { exact: true }),
  ).toBeVisible();
  await expect(
    shared.getByRole("button", { name: "New room", exact: true }),
  ).toHaveCount(0);
  await expect(
    shared.getByRole("button", { name: "Edit room", exact: true }),
  ).toHaveCount(0);
  await shared.getByRole("tab", { name: "Plan", exact: true }).click();
  expect(await shared.locator(".plan-sheet [data-item]").count()).toBe(4);
});

test("measured positioning works without dragging and the sun slider has a keyboard name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.locator(".plan-sheet [data-item=bed]").click();
  await page
    .getByRole("button", { name: "Move selected piece", exact: true })
    .click();
  await page.getByLabel("Center X (inches)", { exact: true }).fill("72");
  await page.getByLabel("Center Y (inches)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "Apply position", exact: true })
    .click();
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(p.placements.find((i) => i.itemId === "bed")).toMatchObject({
    x: 182.88,
    y: 254,
  });
  const sun = page.getByRole("slider", { name: "Time of day", exact: true });
  await sun.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#sun-label")).toHaveText("4:00 pm");
});

test("Base UI select menus remain above the dialog, Escape restores focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "Room settings",
    exact: true,
  });
  await trigger.click();
  await page.getByRole("combobox", { name: "Room purpose" }).click();
  await expect(
    page.getByRole("option", { name: "Bedroom", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Bedroom", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("uploaded image proposals stay uncertain until dimensions are confirmed", async ({
  page,
}) => {
  await page.goto("/");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 500;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f7f4ed";
    ctx.fillRect(0, 0, 600, 500);
    ctx.strokeStyle = "#302820";
    ctx.lineWidth = 4;
    ctx.strokeRect(60, 50, 480, 400);
    ctx.font = "28px sans-serif";
    ctx.fillStyle = "#302820";
    ctx.fillText("480 cm", 240, 32);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("button", { name: "New room", exact: true }).click();
  await page
    .getByLabel("One known wall length (inches)", { exact: true })
    .fill("100");
  await page
    .locator('input[type="file"][accept*="application/pdf"]')
    .setInputFiles({
      name: "measured-plan.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect(page.getByRole("dialog")).toContainText("low-confidence");
  await expect(
    page.getByRole("button", { name: "Confirm the room" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm the room" }).click();
  await expect(
    page.getByRole("heading", { name: "measured-plan", exact: true }),
  ).toBeVisible();
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(p.room.polygon[1].x).toBe(480);
});

test("layout warning, corrupt sharing, and WebGL failure remain usable states", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: /Rotatable three-dimensional miniature/ }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("maquette-webgl-lost")),
  );
  await expect(page.locator(".scene-fallback")).toContainText(
    "3D is unavailable",
  );
  await expect(page.locator(".scene-fallback svg")).toBeVisible();
  await page.goto("/share#invalid");
  await expect(
    page.getByRole("heading", { name: "This room link lost its plan" }),
  ).toBeVisible();
});

test("PDF vector dimensions survive rendering and require the same confirmation", async ({
  page,
}) => {
  const content =
    "0 0 0 RG 3 w 60 50 480 400 re S\nBT /F1 18 Tf 220 465 Td (480 cm) Tj ET\nBT /F1 18 Tf 200 20 Td (400 cm) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page.goto("/");
  await page.getByRole("button", { name: "New room", exact: true }).click();
  await page
    .getByLabel("One known wall length (inches)", { exact: true })
    .fill("100");
  await page
    .locator('input[type="file"][accept*="application/pdf"]')
    .setInputFiles({
      name: "vector-plan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
  await expect(page.getByRole("dialog")).toContainText(
    "Printed dimensions and line gaps were found",
  );
  await page.getByRole("button", { name: "Confirm the room" }).click();
  await expect(
    page.getByRole("heading", { name: "vector-plan", exact: true }),
  ).toBeVisible();
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(p.room.polygon[1]).toEqual({ x: 480, y: 0 });
  expect(p.room.polygon[2]).toEqual({ x: 480, y: 400 });
});

test("no-credential cloud writes refuse explicitly and import blocks private targets", async ({
  request,
}) => {
  const cloud = await request.get("/api/rooms");
  expect(await cloud.json()).toMatchObject({ cloudStorage: false });
  expect((await request.post("/api/rooms", { data: {} })).status()).toBe(503);
  const refused = await request.post("/api/import", {
    data: { url: "https://127.0.0.1" },
  });
  expect(refused.status()).toBe(422);
  expect(await refused.json()).toHaveProperty("error");
});

test("browser-origin imports reach the public-URL guard rather than rejecting their own app", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add a piece", exact: true })
    .first()
    .click();
  await page.getByLabel("Product link (optional)").fill("https://127.0.0.1");
  const response = page.waitForResponse((r) => r.url().endsWith("/api/import"));
  await page.getByRole("button", { name: "Read product", exact: true }).click();
  expect((await response).status()).toBe(422);
  await expect(page.getByRole("alert")).toBeVisible();
});

test("long room and address labels wrap inside the exported title block", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New room", exact: true }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page
    .getByLabel("Room name", { exact: true })
    .fill(
      "South-facing studio with reading nook, work corner and a place for guests",
    );
  await page
    .getByLabel("Title-block address (optional)", { exact: true })
    .fill(
      "Example building, north wing, fourth floor, room beside the communal library",
    );
  await page
    .getByRole("button", { name: "Confirm the room", exact: true })
    .click();
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  const spill = await page
    .locator(".plan-sheet .title-block")
    .evaluate((block) =>
      [...block.querySelectorAll("text")]
        .filter((text) => {
          const b = text.getBBox();
          return b.x < -1 || b.x + b.width > 481;
        })
        .map((text) => text.textContent),
    );
  expect(spill).toEqual([]);
});

test("narrow screens retain legible controls without clipped elements", async ({
  page,
}) => {
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflows = await page.evaluate(() =>
      [...document.querySelectorAll("header *, main *")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.right > innerWidth + 1;
        })
        .map((e) => e.className),
    );
    expect(overflows).toEqual([]);
    const settings = await page
      .getByRole("button", { name: "Room settings", exact: true })
      .boundingBox();
    expect(settings?.width).toBeGreaterThanOrEqual(44);
    expect(settings?.height).toBeGreaterThanOrEqual(44);
    if (width === 390)
      await expect(page.locator(".mobile-save-status")).toHaveText(
        "Sample room",
      );
    await page
      .getByRole("button", { name: "Your pieces", exact: false })
      .click();
    await expect(
      page.getByRole("button", { name: "Add a piece", exact: true }).first(),
    ).toBeVisible();
  }
});

test("unavailable retailer images report a fallback without discarding imported measurements", async ({
  page,
}) => {
  await page.route("**/api/import", (route) =>
    route.fulfill({
      json: {
        name: "Measured chair",
        source: "Example store",
        url: "https://example.test/chair",
        image: "https://example.test/product.png",
        width: 55,
        depth: 60,
        height: 82,
        price: 9900,
        currency: "USD",
        color: null,
        review: [],
      },
    }),
  );
  await page.route("https://example.test/product.png", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add a piece", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Product link (optional)")
    .fill("https://example.test/chair");
  await page.getByRole("button", { name: "Read product", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "The store image could not load",
  );
  await expect(page.getByLabel("Piece name", { exact: true })).toHaveValue(
    "Measured chair",
  );
  await page
    .getByRole("button", { name: "Add this piece", exact: true })
    .click();
  const p = await page.evaluate(
    () => JSON.parse(localStorage.getItem("maquette.room.v1")!) as Project,
  );
  expect(p.items.find((i) => i.name === "Measured chair")?.price).toBe(9900);
});
