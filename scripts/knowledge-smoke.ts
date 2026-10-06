import sharp from "sharp";
import { embed, readPhoto, answer, providerAvailable } from "../server/knowledge/provider";
import type { KnowledgeCitation } from "../shared/knowledge";

// Explicit approval gate. Only hardcoded synthetic evidence is sent to OpenAI.
// This script never reads saves, uploads to S3, creates users or changes the DB.
async function main() {
  if (!process.argv.includes("--approve-openai-charges")) throw new Error("Explicit charge approval is required");
  if (!providerAvailable()) throw new Error("OpenAI configuration is unavailable");
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    if (requests >= 6) throw new Error("Smoke-test request cap reached");
    requests++;
    return originalFetch(...args);
  }) as typeof fetch;
  try {
    const note = "Garden sour: 2 ounces of gin, 3/4 ounce of fresh lime juice and 3/4 ounce of agave syrup. Shake with ice and strain into a glass.";
    const svg = `<svg width="1000" height="320" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="36" fill="black"><text x="40" y="65">Garden sour recipe</text><text x="40" y="125">2 oz gin</text><text x="40" y="185">3/4 oz lime juice</text><text x="40" y="245">3/4 oz agave syrup</text></g></svg>`;
    const image = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
    const photo = await readPhoto(`data:image/jpeg;base64,${image.toString("base64")}`);
    if (!/gin/i.test(photo.visibleText) || !/lime/i.test(photo.visibleText) || !/agave/i.test(photo.visibleText)) throw new Error("Photo extraction missed synthetic recipe text");
    const texts = [note, photo.visibleText];
    const vectors = await embed(texts);
    const query = "What amounts of gin, lime juice and agave are in my saved garden sour recipe?";
    const [queryVector] = await embed([query]);
    const norm = (v: number[]) => Math.sqrt(v.reduce((s, n) => s + n * n, 0));
    const similarity = vectors.map(v => v.reduce((s, n, i) => s + n * queryVector[i], 0) / (norm(v) * norm(queryVector)));
    const evidence: KnowledgeCitation[] = texts.map((excerpt, i) => ({
      id: `synthetic-${i}`, messageId: i + 1, sourceId: i ? "photo" : "note",
      title: "Synthetic garden sour recipe", kind: i ? "photo" : "note", coverage: "ready", excerpt,
    })).sort((a, b) => similarity[b.messageId - 1] - similarity[a.messageId - 1]);
    const result = await answer(query, evidence);
    if (!result.text || !result.citations.length) throw new Error("No validated cited answer returned");
    console.log(JSON.stringify({ verified: true, photoTextRecognized: true, dimensions: vectors[0].length,
      topSimilarity: Number(Math.max(...similarity).toFixed(3)), verifiedCitations: result.citations.length, requests }));
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => {
  // Never print provider request/response bodies or credentials.
  console.error(JSON.stringify({ verified: false, errorType: error?.name || "Error", providerStatus: error?.status ?? null }));
  process.exitCode = 1;
});
