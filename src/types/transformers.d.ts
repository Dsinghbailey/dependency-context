declare module '@xenova/transformers' {
  export function pipeline(
    task: string,
    model: string
  ): Promise<(input: string, options?: any) => Promise<{ data: Float32Array | Float64Array }>>;
}