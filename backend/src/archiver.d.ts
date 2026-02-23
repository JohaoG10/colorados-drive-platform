declare module 'archiver' {
  interface Archiver {
    pipe(dest: NodeJS.WritableStream): void;
    append(source: Buffer | NodeJS.ReadableStream, opts: { name: string }): void;
    finalize(): Promise<void>;
    on(event: 'error', cb: (err: Error) => void): void;
  }
  function archiver(format: string, options?: object): Archiver;
  export default archiver;
}
