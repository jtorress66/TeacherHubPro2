// The integration run's global setup (packages/adapters/test/postgres) provides the database URL.
declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

export {};
