import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// One database file per worker process.
//
// Vitest runs test files in separate processes, and both tests/setup.js and
// tests/test-models.js open the database at import time. Pointing them all at
// one shared file made the workers contend for SQLite's write lock, which
// surfaced as intermittent "database is locked" failures. Each worker now owns
// a private file, so there is nothing to contend for. Files run sequentially
// within a worker, so sharing a file between two of them is still safe.
//
// This must run as the first setupFile: DB_PATH has to be set before anything
// imports src/models/index.js, which opens the database at module load.
const worker = process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || 'main';
const testDbPath = join(__dirname, '..', `test-hospital-${worker}.db`);
process.env.DB_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret';

// The suite exercises demo behaviour (seeded accounts, one-click login), and
// those features are now gated behind DEPLOYMENT_MODE=demo. Without this the
// demo tests would correctly 404 and the guard tests would have to re-import
// the whole app to flip the mode.
//
// This mirrors what render.yaml sets for the public demo. The onprem refusals
// are covered separately in tests/deployment.test.js against the pure config
// functions, which is where that logic actually lives.
process.env.DEPLOYMENT_MODE = 'demo';

// TRUST_PROXY=3 mirrors the Render chain so the forwarded-IP tests keep
// modelling the real deployment. The "no trusted proxies" default is covered in
// tests/deployment.test.js, which builds a small app rather than re-importing
// this one.
process.env.TRUST_PROXY = '3';

// The [PROXY-IP] drift warning is off by default; the logger tests assert that
// default is respected, and enable it explicitly per case where needed.
process.env.PROXY_IP_WARN = 'true';