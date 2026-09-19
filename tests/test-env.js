import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDbPath = join(__dirname, '..', 'test-hospital.db');

// Set test database path before any other imports
process.env.DB_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret';