import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './init';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

initializeDatabase();
console.log('Migration completed successfully');
