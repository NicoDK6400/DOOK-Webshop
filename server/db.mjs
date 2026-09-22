import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {runMigrations} from './migrate.mjs';
// D1-compatible adapter using Node's built-in SQLite module (node:sqlite) — no
// native dependency to install or compile, on any platform or Node version.
export function openDB(path=process.env.DB_PATH||'./data/dook.sqlite'){
 mkdirSync(dirname(path),{recursive:true});
 const sql=new DatabaseSync(path);
 sql.exec('PRAGMA journal_mode = WAL');
 runMigrations(sql);
 return {
  prepare(query){
   const make=(args=[])=>({
    first:async()=>sql.prepare(query).get(...args)||null,
    all:async()=>({results:sql.prepare(query).all(...args)}),
    run:async()=>({meta:sql.prepare(query).run(...args)})
   });
   return {...make(),bind:(...args)=>make(args)};
  },
  async batch(statements){
   sql.exec('BEGIN');
   try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}
   catch(error){sql.exec('ROLLBACK');throw error}
  },
  // Not part of the D1-style surface the worker code uses — only for maintenance
  // scripts (scripts/import-legacy-data.mjs) that need to run a raw multi-statement script.
  exec(script){sql.exec(script)}
 };
}
