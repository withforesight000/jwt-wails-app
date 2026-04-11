(function () {
  const protocol = window.location.protocol;
  if (protocol === 'http:' || protocol === 'https:') {
    return;
  }

  const hmrBaseUrl = 'ws://localhost:3000';
  const OriginalWebSocket = window.WebSocket;

  function rewriteHMRUrl(url) {
    try {
      const parsed = new URL(String(url), window.location.href);
      if (parsed.pathname !== '/_next/webpack-hmr') {
        return url;
      }
      return hmrBaseUrl + parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  function PatchedWebSocket(url, protocols) {
    const targetUrl = rewriteHMRUrl(url);
    return protocols === undefined
      ? new OriginalWebSocket(targetUrl)
      : new OriginalWebSocket(targetUrl, protocols);
  }

  PatchedWebSocket.prototype = OriginalWebSocket.prototype;
  Object.setPrototypeOf(PatchedWebSocket, OriginalWebSocket);
  window.WebSocket = PatchedWebSocket;
})();
