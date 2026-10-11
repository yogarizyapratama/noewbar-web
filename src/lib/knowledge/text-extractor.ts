/**
 * Safe plain text extractor for knowledge documents.
 * Extracts clean, searchable text from uploaded files (TXT, MD, CSV, JSON, HTML, PDF, DOCX).
 */

export function extractTextFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // Plain text types: direct utf8 conversion
  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "csv", "json", "xml", "html", "htm"].includes(ext)
  ) {
    const raw = buffer.toString("utf-8");
    // Strip HTML tags if HTML
    if (ext === "html" || ext === "htm" || mimeType.includes("html")) {
      return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
    return raw.trim();
  }

  // PDF text stream extraction (lightweight & safe without heavy C++ deps)
  if (ext === "pdf" || mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }

  // DOCX / ZIP based XML extraction
  if (
    ext === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDocx(buffer);
  }

  // Fallback: extract printable strings
  return extractPrintableStrings(buffer);
}

function extractTextFromPdf(buffer: Buffer): string {
  try {
    const raw = buffer.toString("binary");
    const textPieces: string[] = [];

    // Search for text blocks: BT ... ET
    const btRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;
    while ((match = btRegex.exec(raw)) !== null) {
      const block = match[0];
      // Search for Tj strings: (text) Tj or [(t)(e)(x)(t)] TJ
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textPieces.push(tjMatch[1]);
      }

      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let arrayMatch: RegExpExecArray | null;
      while ((arrayMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = arrayMatch[1];
        const subStrings = inner.match(/\((.*?)\)/g);
        if (subStrings) {
          textPieces.push(subStrings.map((s) => s.slice(1, -1)).join(""));
        }
      }
    }

    if (textPieces.length > 0) {
      const result = textPieces
        .join(" ")
        .replace(/\\([()\\])/g, "$1") // unescape parens
        .replace(/\\r|\\n/g, "\n")
        .replace(/\s+/g, " ")
        .trim();
      if (result.length >= 20) return result;
    }
  } catch {
    // fallback below
  }

  return extractPrintableStrings(buffer);
}

function extractTextFromDocx(buffer: Buffer): string {
  try {
    const raw = buffer.toString("binary");
    // In docx (zip), document.xml contains <w:t>text</w:t>
    const wtRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
    const pieces: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = wtRegex.exec(raw)) !== null) {
      pieces.push(match[1]);
    }
    if (pieces.length > 0) {
      return pieces.join(" ").replace(/\s+/g, " ").trim();
    }
  } catch {
    // fallback
  }

  return extractPrintableStrings(buffer);
}

function extractPrintableStrings(buffer: Buffer): string {
  const text = buffer.toString("latin1");
  const words = text.match(/[A-Za-z0-9\u00C0-\u024F\s.,;:!?'"()\-\u2013\u2014]{4,}/g);
  if (!words) return "";
  return words
    .filter((w) => w.trim().length > 3)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000);
}
