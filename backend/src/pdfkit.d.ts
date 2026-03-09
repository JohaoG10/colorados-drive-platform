declare module 'pdfkit' {
  interface PDFDocumentOptions {
    margin?: number;
    size?: string;
    [key: string]: unknown;
  }

  interface PDFPage {
    width: number;
    height: number;
  }

  interface PDFDocument {
    on(event: 'data', cb: (chunk: Buffer) => void): this;
    on(event: 'end', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    font(path?: string, size?: number): this;
    fontSize(size: number): this;
    text(text: string, options?: { align?: string; width?: number; continued?: boolean }): this;
    text(text: string, x: number, y: number, options?: { width?: number; align?: string }): this;
    moveDown(n?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(color?: string): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color?: string): this;
    fillColor(color: string): this;
    addPage(): this;
    end(): void;
    y: number;
    page: PDFPage;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    y: number;
    page: PDFPage;
  }

  export default PDFDocument;
}
