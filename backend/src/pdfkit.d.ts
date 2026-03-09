declare module 'pdfkit' {
  interface PDFDocumentOptions {
    margin?: number;
    size?: string;
    [key: string]: unknown;
  }

  interface PDFDocument {
    on(event: 'data', cb: (chunk: Buffer) => void): this;
    on(event: 'end', cb: () => void): this;
    on(event: 'error', cb: (err: Error) => void): this;
    font(path?: string, size?: number): this;
    fontSize(size: number): this;
    text(text: string, x?: number, y?: number, options?: { width?: number; align?: string; continued?: boolean }): this;
    moveDown(n?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(color?: string): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color?: string): this;
    fillColor(color: string): this;
    end(): void;
    [key: string]: unknown;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
  }

  export default PDFDocument;
}
