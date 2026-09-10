import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Opt these out of Server Components / Route Handler bundling so they load via
  // native Node.js require from node_modules. pdf-parse wraps pdfjs-dist, whose
  // fake-worker loader does `await import("./pdf.worker.mjs")` (a path relative to
  // its own module). If Next.js bundles pdf.mjs into .next/server/chunks/, that
  // relative import resolves to a non-existent chunks/pdf.worker.mjs and document
  // processing fails with: Setting up fake worker failed: Cannot find module
  // '.../.next/server/chunks/pdf.worker.mjs'. Externalizing keeps pdf.mjs at its
  // real node_modules path where pdf.worker.mjs exists.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
