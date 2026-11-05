/** Waits before trying again; injected so tests never sleep. */
export interface Delay {
  wait(milliseconds: number): Promise<void>;
}
