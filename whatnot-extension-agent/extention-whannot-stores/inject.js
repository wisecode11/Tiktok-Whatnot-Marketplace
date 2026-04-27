(function () {
  const observePaths = [
    "/services/graphql/",
    "/services/live/socket/v3/session"
  ];

  function shouldObserve(url) {
    try {
      const u = new URL(url, window.location.origin);
      return u.hostname.endsWith("whatnot.com") && observePaths.some((p) => u.pathname.startsWith(p));
    } catch (_e) {
      return false;
    }
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (_e) {
      return value;
    }
  }

  function normalizeHeaders(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }
    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }
    if (typeof headers === "object") {
      return { ...headers };
    }
    return {};
  }

  async function readObservedRequestBody(input, init) {
    const initBody = init?.body;
    if (typeof initBody === "string") {
      return safeJsonParse(initBody);
    }
    if (initBody != null) {
      return initBody;
    }

    if (typeof Request !== "undefined" && input instanceof Request) {
      try {
        const clone = input.clone();
        const text = await clone.text();
        if (!text) return null;
        return safeJsonParse(text);
      } catch (_e) {
        return null;
      }
    }

    return null;
  }

  async function execute(options) {
    const res = await fetch(options.url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
      credentials: "include"
    });

    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch (_e) {}

    return {
      success: res.ok,
      status: res.status,
      data,
      headers: Object.fromEntries(res.headers.entries())
    };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || !event.data || event.data.source !== "wn-extension-content") {
      return;
    }
    if (event.data.type !== "EXECUTE_API") return;

    const { requestId, options } = event.data;
    try {
      const result = await execute(options);
      window.postMessage({ source: "wn-page", type: "API_RESULT", requestId, result }, "*");
    } catch (err) {
      window.postMessage(
        {
          source: "wn-page",
          type: "API_RESULT",
          requestId,
          result: { success: false, error: err.message }
        },
        "*"
      );
    }
  });

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const input = args[0];
    const init = args[1] || {};
    const url = typeof input === "string" ? input : input?.url;
    const method = (init.method || input?.method || "GET").toUpperCase();
    const requestHeaders = normalizeHeaders(init.headers || input?.headers);
    const requestBody = await readObservedRequestBody(input, init);

    const response = await originalFetch.apply(this, args);
    if (url && shouldObserve(url)) {
      const cloned = response.clone();
      const text = await cloned.text();
      window.postMessage(
        {
          source: "wn-page",
          type: "OBSERVED_API",
          payload: {
            timestamp: Date.now(),
            url,
            method,
            requestHeaders,
            requestBody,
            status: response.status,
            responseBody: safeJsonParse(text)
          }
        },
        "*"
      );
    }
    return response;
  };

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__wnMeta = { method: (method || "GET").toUpperCase(), url };
    return open.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const meta = this.__wnMeta || {};
    const onReadyState = () => {
      if (this.readyState !== 4 || !meta.url || !shouldObserve(meta.url)) return;
      window.postMessage(
        {
          source: "wn-page",
          type: "OBSERVED_API",
          payload: {
            timestamp: Date.now(),
            url: meta.url,
            method: meta.method,
            requestBody: typeof body === "string" ? safeJsonParse(body) : body || null,
            status: this.status,
            responseBody: safeJsonParse(this.responseText)
          }
        },
        "*"
      );
    };
    this.addEventListener("readystatechange", onReadyState);
    return send.call(this, body);
  };
})();
