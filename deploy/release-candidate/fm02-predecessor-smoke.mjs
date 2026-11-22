// Disposable-only FM02 predecessor preservation test. No API, browser or Mac.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareReceivingUpgrade} from './receiving-predecessor.mjs';
import {prepareFm03Upgrade} from './site-issue-predecessor.mjs';
const require=createRequire(new URL('../../apps/api/package.json',import.meta.url));
assert.equal(process.platform,'linux');
assert.equal(process.versions.node,'24.21.0');
assert.equal(process.env.GITHUB_ACTIONS,'true');
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,'/construction_erp');
assert.equal(url.username,'construction_erp');
const {PrismaClient}=require('@prisma/client');
const base=new PrismaClient({datasources:{db:{url:url.href}},log:[]});
try {
  for(const [prefix,fn] of [['receiving',prepareReceivingUpgrade],['fm03',prepareFm03Upgrade]]) {
    const name=prefix+'_'+randomUUID().replaceAll('-','');
    const own=new URL(url);own.pathname='/'+name;
    let created=false;
    try {
      await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
      await fn(own.href);
      console.log(prefix.toUpperCase()+'_FM02_PRESERVED_PREDECESSOR_PASS');
    } finally {
      if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');
    }
  }
} finally {await base.$disconnect();}
