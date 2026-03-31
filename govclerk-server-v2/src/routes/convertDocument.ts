import { Hono } from 'hono';
import { clerkAuthMiddleware } from '../middleware/clerkAuth.js';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

// html-to-docx has no bundled type declarations
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import HTMLtoDOCX from 'html-to-docx';

export const convertDocumentRoute = new Hono();

type OutputType = 'docx' | 'pdf' | 'html' | 'odt';

convertDocumentRoute.post('/convert-document', clerkAuthMiddleware, async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid multipart form data' }, 400);
  }

  const fileField = formData.get('file');
  const outputType = (formData.get('output_type') as string | null)?.toLowerCase() as OutputType | null;
  const inputType = (formData.get('input_type') as string | null) ?? 'gfm';

  if (!fileField) {
    return c.json({ error: "Missing required field 'file'" }, 400);
  }
  if (!outputType) {
    return c.json({ error: "Missing required field 'output_type'" }, 400);
  }
  if (!['docx', 'pdf', 'html', 'odt'].includes(outputType)) {
    return c.json({ error: `Unsupported output_type '${outputType}'. Supported: docx, pdf, html, odt` }, 400);
  }

  // Read file content as text (markdown or HTML)
  let inputText: string;
  try {
    if (typeof (fileField as unknown as { text?: () => Promise<string> }).text === 'function') {
      inputText = await (fileField as unknown as { text: () => Promise<string> }).text();
    } else {
      inputText = String(fileField);
    }
  } catch {
    return c.json({ error: 'Failed to read file content' }, 400);
  }

  // Convert input to HTML first (unless already HTML)
  let htmlContent: string;
  if (inputType === 'html') {
    htmlContent = inputText;
  } else {
    // Treat as markdown (gfm or other markdown variants)
    try {
      htmlContent = await marked.parse(inputText, { gfm: true, breaks: true });
    } catch (err) {
      console.error('[convert-document] markdown parse error:', err);
      return c.json({ error: 'Failed to parse input as markdown' }, 422);
    }
  }

  // Wrap in a styled HTML document for better rendering
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.5; margin: 2cm; color: #222; }
  h1, h2, h3 { color: #1a1a2e; }
  h1 { font-size: 20pt; border-bottom: 2px solid #1a1a2e; padding-bottom: 6px; }
  h2 { font-size: 16pt; }
  h3 { font-size: 13pt; }
  p { margin: 0.5em 0; }
  ul, ol { margin: 0.5em 0; padding-left: 2em; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #f0f0f0; }
  blockquote { border-left: 4px solid #ccc; margin: 0.5em 0; padding-left: 1em; color: #555; }
  code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 10pt; }
  pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  try {
    if (outputType === 'html') {
      return new Response(fullHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="document.html"',
        },
      });
    }

    if (outputType === 'docx' || outputType === 'odt') {
      // Convert HTML → DOCX using html-to-docx.
      // Both 'docx' and 'odt' produce a .docx file (OOXML), since no pure-JS ODT library is available.
      const docxBuffer: Buffer = await HTMLtoDOCX(fullHtml, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      });

      return new Response(new Uint8Array(docxBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="document.docx"',
        },
      });
    }

    if (outputType === 'pdf') {
      // Convert HTML → PDF using puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      let pdfBuffer: Uint8Array;
      try {
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
          printBackground: true,
        });
      } finally {
        await browser.close();
      }

      return new Response(pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"',
        },
      });
    }

    return c.json({ error: 'Unsupported output type' }, 400);
  } catch (err) {
    console.error('[convert-document] conversion error:', err);
    return c.json({ error: 'Document conversion failed' }, 500);
  }
});

