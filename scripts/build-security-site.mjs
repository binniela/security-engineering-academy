import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const staticRoot = join(projectRoot, "fde_api_academy", "web", "static");
const outputRoot = join(projectRoot, "security-dist");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(join(outputRoot, "data"), { recursive: true });

const standaloneHtml = await readFile(join(staticRoot, "security.html"), "utf8");
await writeFile(join(outputRoot, "index.html"), standaloneHtml, "utf8");

for (const asset of ["styles.css", "security-coding.js", "security-coding-worker.js", "security.js"]) {
  await cp(join(staticRoot, asset), join(outputRoot, asset));
}

for (const asset of ["security_coding_challenges.json", "security_course.json", "security_interview_bank.json", "security_notes.md", "security_oral_boards.json"]) {
  await cp(join(staticRoot, "data", asset), join(outputRoot, "data", asset));
}

console.log("Built standalone Security Engineering Academy in security-dist/");
