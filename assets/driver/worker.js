/* Configuração fornecida pelo endpoint do worker; cache estrito do shell sem dados. */
const config = self.CTDriverWorker;
const CACHE = 'ctdrv-shell-' + config.version;
const shell = config.page;
const assets = new Set(config.assets);
self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of [shell, ...assets]) {
        const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
        if (!response.ok) throw new Error('Shell indisponível');
        await cache.put(url, response);
    }
    await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('ctdrv-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    const isShell = request.mode === 'navigate' && url.origin + url.pathname === new URL(shell).origin + new URL(shell).pathname;
    if (!isShell && !assets.has(request.url)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        if (!isShell) return (await cache.match(request.url)) || fetch(request);
        try { const response = await fetch(request); if (response.ok) return response; } catch (_) { /* offline */ }
        return (await cache.match(shell)) || new Response('Sem conexão. Abra novamente o link quando a internet voltar.', { status: 503 });
    })());
});
