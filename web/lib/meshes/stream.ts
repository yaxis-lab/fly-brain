export interface Stream<TOutput> {
  start(): Promise<void>;
}

export interface StreamOptions<TInput, TOutput> {
  readonly items: readonly TInput[];
  readonly load: (item: TInput) => Promise<TOutput>;
  readonly onItemLoaded: (item: TOutput) => void;
}

export function createMeshStream<TInput, TOutput>(
  options: StreamOptions<TInput, TOutput>,
): Stream<TOutput> {
  const { items, load, onItemLoaded } = options;

  return {
    async start(): Promise<void> {
      await Promise.all(
        items.map(async (item) => {
          const loadedItem = await load(item);

          onItemLoaded(loadedItem);
        }),
      );
    },
  };
}
