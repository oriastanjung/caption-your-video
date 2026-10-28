import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readContextFiles } from "../../src/infrastructure/context-files";

const dir = await mkdtemp(join(tmpdir(), "context-files-"));
afterAll(() => rm(dir, { recursive: true }));

describe("readContextFiles", () => {
  test("joins every file that exists, in order, without surrounding whitespace", async () => {
    await Bun.write(join(dir, "context.txt"), "  Terms: foreign key  \n");
    await Bun.write(join(dir, "story.md"), "\nShe inserts data, then hits an error.\n");
    const context = await readContextFiles([join(dir, "context.txt"), join(dir, "story.md")]);
    expect(context).toBe("Terms: foreign key\n\nShe inserts data, then hits an error.");
  });

  test("skips files that are missing or empty", async () => {
    await Bun.write(join(dir, "empty.md"), "  \n");
    const context = await readContextFiles([join(dir, "missing.txt"), join(dir, "empty.md"), join(dir, "story.md")]);
    expect(context).toBe("She inserts data, then hits an error.");
  });
});
