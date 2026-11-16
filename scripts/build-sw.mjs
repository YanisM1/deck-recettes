import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [];
async function walk(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${file.name}`;
    if (file.isDirectory()) await walk(path);
    else if (file.name !== "sw.js") files.push(path);
  }
}
await walk("dist");
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const version = hash.digest("hex").slice(0, 16),
  urls = files.map((p) => "/" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const CACHE='deckchef-${version}';const ASSETS=${JSON.stringify(urls)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('deckchef-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return}e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});`,
);
