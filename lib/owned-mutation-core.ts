/** Framework-independent ownership primitive for async client mutations. */
export class MutationOwner {
  private generation = 0;
  private controller: AbortController | null = null;

  begin() {
    this.controller?.abort();
    this.controller = new AbortController();
    const generation = ++this.generation;
    return { generation, signal: this.controller.signal };
  }

  isCurrent(generation: number) {
    return generation === this.generation;
  }

  cancel() {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }
}
