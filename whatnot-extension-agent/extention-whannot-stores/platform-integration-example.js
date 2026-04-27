/**
 * Platform-side sample client for your backend.
 * Your backend should relay "action_request" to extension socket and return "action_response".
 */

async function callWhatnotThroughPlatform(userPlatformToken, apiConfig) {
  const response = await fetch("https://your-platform.com/api/proxy-whatnot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userPlatformToken}`
    },
    body: JSON.stringify({
      action: "execute_graphql",
      payload: {
        url: `https://www.whatnot.com/services/graphql/?operationName=${encodeURIComponent(apiConfig.operationName)}&ssr=0`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-whatnot-app": "whatnot-web"
        },
        body: JSON.stringify({
          operationName: apiConfig.operationName,
          variables: apiConfig.variables || {},
          query: apiConfig.query
        })
      }
    })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Platform proxy failed");
  }
  return result.response;
}

async function demoGetSession(userPlatformToken) {
  const response = await fetch("https://your-platform.com/api/proxy-whatnot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userPlatformToken}`
    },
    body: JSON.stringify({
      action: "execute_http",
      payload: {
        url: "https://www.whatnot.com/services/live/socket/v3/session",
        method: "GET"
      }
    })
  });
  return response.json();
}
