import assert from 'node:assert/strict';
import test from 'node:test';
import {getAvailableRelease,createAppUpdateUrl,clearAppliedUpdateToken,checkAppRelease} from '../src/utils/appUpdates.js';
const current={version:'2.18.0',buildId:'2.18.0-first',builtAt:1000};
const next={schemaVersion:1,version:'2.18.1',buildId:'2.18.1-second',builtAt:2000};
test('release discovery detects new builds and rejects stale CDN responses or malformed manifests',()=>{
 assert.equal(getAvailableRelease(next,current).buildId,next.buildId);
 assert.equal(getAvailableRelease({...next,...current},current),null);
 assert.equal(getAvailableRelease({...next,version:'2.17.9'},current),null);
 assert.equal(getAvailableRelease({...next,version:'2.18.0',builtAt:500},current),null);
 assert.equal(getAvailableRelease({...next,version:'2.18.0',builtAt:1500},current).builtAt,1500);
 for(const invalid of [null,{}, {...next,buildId:'https://elsewhere.invalid/'},{...next,builtAt:'2000'},{...next,schemaVersion:2}])assert.equal(getAvailableRelease(invalid,current),null);
});
test('updating bypasses a cached entry document while preserving the same origin, active workout route and filters',()=>{
 const href='https://027123-prog.github.io/GYM-Tracker/?keep=yes#/workouts/active/edit?exercise=e';
 const update=createAppUpdateUrl(href,next);
 const url=new URL(update);
 assert.equal(url.origin,new URL(href).origin);
 assert.equal(url.pathname,'/GYM-Tracker/');
 assert.equal(url.hash,'#/workouts/active/edit?exercise=e');
 assert.equal(url.searchParams.get('keep'),'yes');
 assert.equal(url.searchParams.get('_hg_version'),next.buildId);
 assert.equal(clearAppliedUpdateToken(update,next.buildId),href);
 assert.equal(clearAppliedUpdateToken(update,'different-build'),null);
 assert.throws(()=>createAppUpdateUrl(href,{buildId:'../outside'}));
});
test('update probes are cache-free, abortable, use the project path and send no credentials or stored training data',async()=>{
 let called;
 const signal=new AbortController().signal;
 const release=await checkAppRelease(current,{baseUrl:'https://027123-prog.github.io/GYM-Tracker/',now:1234,signal,fetcher:async(url,options)=>{called={url,options};return{ok:true,json:async()=>next};}});
 assert.equal(release.buildId,next.buildId);
 assert.equal(called.url,'https://027123-prog.github.io/GYM-Tracker/version.json?check=1234');
 assert.equal(called.options.cache,'no-store');
 assert.equal(called.options.credentials,'omit');
 assert.equal(called.options.signal,signal);
 assert(!Object.hasOwn(called.options,'body'));
 assert.equal(await checkAppRelease(current,{baseUrl:'https://example.test/',fetcher:async()=>({ok:false})}),null);
});
