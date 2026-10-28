export async function readContextFiles(paths: string[]): Promise<string> {
  const texts = await Promise.all(
    paths.map(async (path) => {
      const file = Bun.file(path);
      return (await file.exists()) ? (await file.text()).trim() : "";
    }),
  );
  return texts.filter((text) => text !== "").join("\n\n");
}
