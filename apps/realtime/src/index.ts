import { parseRealtimeConfig } from './config.ts';
import { createRealtime } from './container.ts';

const config = parseRealtimeConfig(process.env);
if (!config.ok) {
  process.stderr.write(`${config.error}\n`);
  process.exit(1);
}

const { server, close } = createRealtime(config.value);
server.listen(config.value.port, () => {
  process.stdout.write(`Realtime server started on port ${String(config.value.port)}.\n`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close();
    void close().then(() => process.exit(0));
  });
}
