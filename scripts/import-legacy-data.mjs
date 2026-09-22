import {readFileSync} from 'node:fs';
import {openDB} from '../server/db.mjs';
// database/restore.sql is a full CREATE TABLE + INSERT dump meant for a brand new,
// empty database — but our own DB is already migrated to the current schema on
// first boot. Rewriting the statements to be idempotent (IF NOT EXISTS / OR IGNORE)
// lets the same file be replayed safely against an already-migrated database, and
// run more than once. Executed as one script (not split by line) because some
// description values in the dump contain literal newlines.
const path=new URL('../database/restore.sql',import.meta.url);
const script=readFileSync(path,'utf8')
 .replace(/CREATE TABLE /g,'CREATE TABLE IF NOT EXISTS ')
 .replace(/CREATE UNIQUE INDEX /g,'CREATE UNIQUE INDEX IF NOT EXISTS ')
 .replace(/CREATE INDEX /g,'CREATE INDEX IF NOT EXISTS ')
 .replace(/INSERT INTO /g,'INSERT OR IGNORE INTO ');

const db=openDB();
const before=(await db.prepare('SELECT COUNT(*) AS n FROM prices').first()).n;
db.exec(script);
const after=(await db.prepare('SELECT COUNT(*) AS n FROM prices').first()).n;
console.log(`Imported database/restore.sql — prices table went from ${before} to ${after} row(s).`);
