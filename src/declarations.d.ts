declare module "*.css";

declare module "pdfkit" {
    export class PDFDocument {
        constructor(options?: Record<string, unknown>);
    }

    export default PDFDocument;
}

declare module "pdfkit/output" {
    export function toBlob(document: {
        on(event: string, listener: (...args: unknown[]) => void): unknown;
        off(event: string, listener: (...args: unknown[]) => void): unknown;
    }): Promise<Blob>;

    export function toBytes(document: {
        on(event: string, listener: (...args: unknown[]) => void): unknown;
        off(event: string, listener: (...args: unknown[]) => void): unknown;
    }): Promise<Uint8Array>;
}