import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './game-server';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error('PORT must be between 1 and 65535.');
const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const server = createGameServer({ staticDir });
await server.listen(port, process.env.HOST ?? '0.0.0.0');
console.log(`اسم فامیل is listening on http://localhost:${port}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await server.dispose();
    process.exit(0);
  });
}
