// Reads page text and page count from a PDF in the browser with pdf.js.
// pdf.js is loaded on demand so it is not part of the initial bundle.

export type ExtractedPdf = { pageCount: number; pages: string[] };

export async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<ExtractedPdf> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : " ");
      }
      pages.push(text.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim());
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
    return { pageCount: doc.numPages, pages };
  } finally {
    await doc.destroy();
  }
}
