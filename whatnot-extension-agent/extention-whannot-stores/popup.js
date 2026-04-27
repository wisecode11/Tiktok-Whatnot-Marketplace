class WhatnotConnectorPopup {
  constructor() {
    this.nodes = {};
    this.init().catch((err) => this.log("Init error: " + err.message));
  }

  async init() {
    this.nodes.connectBtn = document.getElementById("connect-btn");
    this.nodes.status = document.getElementById("status");
    this.nodes.statusText = document.getElementById("status-text");
    this.nodes.tokenContainer = document.getElementById("token-container");
    this.nodes.csrfToken = document.getElementById("csrf-token");
    this.nodes.sessionToken = document.getElementById("session-token");
    this.nodes.cookieStatus = document.getElementById("cookie-status");
    this.nodes.copyTokens = document.getElementById("copy-tokens");
    this.nodes.response = document.getElementById("response");
    this.nodes.bioInput = document.getElementById("bio-input");
    this.nodes.customPayload = document.getElementById("custom-payload");

    document.getElementById("demo-session").onclick = () => this.demoSession();
    document.getElementById("demo-graphql").onclick = () => this.demoLiveReadiness();
    document.getElementById("demo-update-bio").onclick = () => this.demoUpdateBio();
    document.getElementById("demo-custom-post").onclick = () => this.demoCustomPost();
    this.nodes.connectBtn.onclick = () => this.connect();
    this.nodes.copyTokens.onclick = () => this.copyTokens();

    await this.refreshStatus();
    setInterval(() => this.refreshStatus(), 15000);
  }

  async getActiveWhatnotTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("whatnot.com")) {
      throw new Error("Please open and login on whatnot.com in active tab first.");
    }
    return tab;
  }

  async connect() {
    try {
      const tab = await this.getActiveWhatnotTab();
      this.nodes.connectBtn.disabled = true;
      this.nodes.connectBtn.textContent = "Connecting...";

      const result = await chrome.runtime.sendMessage({ action: "connect_whatnot", tabId: tab.id });
      if (!result?.success) {
        throw new Error(result?.error || "Connection failed");
      }
      this.applyTokens(result.auth);
      this.setConnected(true);
      this.log("Connected. Tokens synced.");
    } catch (err) {
      this.setConnected(false);
      this.log("Connect failed: " + err.message);
    } finally {
      this.nodes.connectBtn.disabled = false;
      this.nodes.connectBtn.textContent = "Connect Whatnot";
    }
  }

  applyTokens(auth) {
    this.nodes.tokenContainer.style.display = "block";
    this.nodes.csrfToken.textContent = auth?.csrf_token || "-";
    this.nodes.sessionToken.textContent = auth?.session_extension_token || "-";
    const cookieState = auth?.cookie_state || {};
    this.nodes.cookieStatus.textContent = JSON.stringify(cookieState);
  }

  async copyTokens() {
    const text = JSON.stringify(
      {
        csrf_token: this.nodes.csrfToken.textContent,
        session_extension_token: this.nodes.sessionToken.textContent,
        cookies_present: this.nodes.cookieStatus.textContent
      },
      null,
      2
    );
    await navigator.clipboard.writeText(text);
    this.log("Tokens copied.");
  }

  async callProxy(options) {
    const tab = await this.getActiveWhatnotTab();
    const result = await chrome.runtime.sendMessage({
      action: "execute_api",
      tabId: tab.id,
      options
    });
    if (!result?.success) {
      throw new Error(result?.error || "API call failed");
    }
    return result;
  }

  async callProxyResult(options) {
    const tab = await this.getActiveWhatnotTab();
    const result = await chrome.runtime.sendMessage({
      action: "execute_api",
      tabId: tab.id,
      options
    });
    if (!result) {
      return { success: false, error: "No response from page API bridge." };
    }
    return result;
  }

  async demoSession() {
    try {
      const tab = await this.getActiveWhatnotTab();
      const res = await this.callProxy({
        url: "https://www.whatnot.com/services/live/socket/v3/session",
        method: "GET"
      });
      await chrome.runtime.sendMessage({
        action: "save_get_session_api_data",
        payload: {
          tabId: tab.id,
          responsePayload: res?.data || {}
        }
      });
      this.log("GET session success\n" + JSON.stringify(res.data, null, 2));
    } catch (err) {
      this.log("GET session failed: " + err.message);
    }
  }

  async demoLiveReadiness() {
    try {
      const res = await this.callProxy({
        url: "https://www.whatnot.com/services/graphql/?operationName=GetSellerLiveReadiness&ssr=0",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-whatnot-app": "whatnot-web",
          "x-wn-extension": "1"
        },
        body: JSON.stringify({
          operationName: "GetSellerLiveReadiness",
          variables: {},
          query:
            "query GetSellerLiveReadiness{me{id sellerLiveReadinessState{firstScheduledShow{uuid title scheduledAt __typename}completedChecklistAt overviewStatus scheduleShowStatus addProductsStatus connectShopifyStatus importProductsFromShopifyStatus bringInBuyersStatus goLiveStatus __typename}__typename}}"
        })
      });
      this.log("POST readiness success\n" + JSON.stringify(res.data, null, 2));
    } catch (err) {
      this.log("POST readiness failed: " + err.message);
    }
  }

  async demoUpdateBio() {
    try {
      const bio = (this.nodes.bioInput.value || "").trim();
      if (!bio) {
        throw new Error("Please enter bio text first.");
      }
      const csrfToken = (this.nodes.csrfToken.textContent || "").trim();
      if (!csrfToken || csrfToken === "-") {
        throw new Error("CSRF token missing. Please reconnect Whatnot.");
      }

      const status = await chrome.runtime.sendMessage({ action: "get_status" });
      const template = this.getUpdateProfileTemplate(status?.observedGraphqlTemplates || {});
      const accessToken = (status?.auth?.access_token || "").trim();
      let payload = {
        operationName: "UpdateProfileMutation",
        variables: { bio },
        query: "mutation UpdateProfileMutation($bio: String!){updateProfile(bio:$bio){__typename}}"
      };
      let usedCapturedTemplate = false;
      let usedCustomTemplate = false;
      let fallbackAttempted = false;
      if (template?.requestBody && typeof template.requestBody === "object") {
        payload = structuredClone(template.requestBody);
        payload.operationName = payload.operationName || "UpdateProfileMutation";
        this.injectBioIntoPayload(payload, bio);
        usedCapturedTemplate = true;
      } else {
        const customTemplate = this.parseCustomPayloadTemplate();
        if (customTemplate) {
          payload = customTemplate;
          payload.operationName = payload.operationName || "UpdateProfileMutation";
          this.injectBioIntoPayload(payload, bio);
          usedCustomTemplate = true;
        }
      }

      const defaultHeaders = {
        "content-type": "application/json",
        "x-whatnot-app": "whatnot-web",
        "x-csrf-token": csrfToken,
        "x-wn-extension": "1"
      };
      if (accessToken) {
        defaultHeaders.authorization = `Bearer ${accessToken}`;
      }
      const templateHeaders = this.filterAllowedHeaders(template?.requestHeaders || {});
      const headers = { ...templateHeaders, ...defaultHeaders };

      const payloadCandidates = [payload];
      if (!usedCapturedTemplate && !usedCustomTemplate) {
        fallbackAttempted = true;
        payloadCandidates.push(...this.buildUpdateBioFallbackCandidates(bio));
      }

      let res = null;
      let finalPayload = payloadCandidates[0];
      const attempts = [];
      for (const candidate of payloadCandidates) {
        const response = await this.callProxyResult({
          url: "https://www.whatnot.com/services/graphql/?operationName=UpdateProfileMutation&ssr=0",
          method: "POST",
          headers,
          body: JSON.stringify(candidate)
        });
        attempts.push({
          operationName: candidate?.operationName || null,
          variables: candidate?.variables || null,
          success: Boolean(response?.success),
          status: response?.status ?? null,
          error: response?.error || null,
          graphql_data: response?.data?.data || null,
          graphql_errors: response?.data?.errors || null
        });
        res = response;
        finalPayload = candidate;
        if (this.isSuccessfulUpdateProfileResponse(response)) break;
      }

      if (!res) {
        throw new Error("No response received for update profile attempts.");
      }

      this.log(
        "POST update bio response (inspect result/errors)\n" +
          JSON.stringify(
            {
              used_captured_template: usedCapturedTemplate,
              used_custom_template: usedCustomTemplate,
              fallback_attempted: fallbackAttempted,
              attempts,
              request_payload: finalPayload,
              request_headers: headers,
              proxy_success: Boolean(res.success),
              proxy_error: res.error || null,
              response_status: res.status ?? null,
              graphql_data: res.data?.data || null,
              graphql_errors: res.data?.errors || null,
              raw_response: res.data || null
            },
            null,
            2
          ) +
          (!usedCapturedTemplate && !usedCustomTemplate
            ? "\n\nNote: No captured/custom UpdateProfile template found. Open Whatnot profile page, change bio once manually, save it, then retry so extension can reuse exact platform mutation."
            : "")
      );
    } catch (err) {
      this.log("POST update bio failed: " + err.message);
    }
  }

  async demoCustomPost() {
    try {
      const raw = (this.nodes.customPayload.value || "").trim();
      if (!raw) {
        throw new Error("Paste payload JSON from platform first.");
      }
      const csrfToken = (this.nodes.csrfToken.textContent || "").trim();
      if (!csrfToken || csrfToken === "-") {
        throw new Error("CSRF token missing. Please reconnect Whatnot.");
      }
      const payload = JSON.parse(raw);
      if (!payload?.operationName || !payload?.query) {
        throw new Error("Payload must include operationName and query.");
      }

      const res = await this.callProxy({
        url: `https://www.whatnot.com/services/graphql/?operationName=${encodeURIComponent(payload.operationName)}&ssr=0`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-whatnot-app": "whatnot-web",
          "x-csrf-token": csrfToken,
          "x-wn-extension": "1"
        },
        body: JSON.stringify(payload)
      });

      this.log(
        "POST custom payload response\n" +
          JSON.stringify(
            {
              request_payload: payload,
              response_status: res.status,
              graphql_data: res.data?.data || null,
              graphql_errors: res.data?.errors || null,
              raw_response: res.data
            },
            null,
            2
          )
      );
    } catch (err) {
      this.log("POST custom payload failed: " + err.message);
    }
  }

  async refreshStatus() {
    const status = await chrome.runtime.sendMessage({ action: "get_status" });
    this.setConnected(Boolean(status?.connected));
    if (status?.auth) {
      this.applyTokens(status.auth);
    }
  }

  injectBioIntoPayload(payload, bio) {
    if (!payload || typeof payload !== "object") return;
    if (!payload.variables || typeof payload.variables !== "object") {
      payload.variables = {};
    }

    // Try most common shapes first.
    if (Object.prototype.hasOwnProperty.call(payload.variables, "bio")) {
      payload.variables.bio = bio;
      return;
    }
    if (payload.variables.input && typeof payload.variables.input === "object") {
      payload.variables.input.bio = bio;
      return;
    }

    // Fallback for unknown template shapes.
    payload.variables.bio = bio;
  }

  filterAllowedHeaders(headers) {
    const blocked = new Set([
      "content-length",
      "host",
      "origin",
      "referer",
      "cookie"
    ]);
    const out = {};
    for (const [k, v] of Object.entries(headers || {})) {
      if (!k) continue;
      const key = String(k).toLowerCase();
      if (blocked.has(key)) continue;
      out[key] = v;
    }
    return out;
  }

  getUpdateProfileTemplate(templates) {
    if (!templates || typeof templates !== "object") return null;
    if (templates.UpdateProfileMutation) return templates.UpdateProfileMutation;

    const candidates = Object.entries(templates)
      .filter(([operationName, tpl]) => {
        if (!operationName || !tpl?.requestBody) return false;
        const op = String(operationName).toLowerCase();
        const body = tpl.requestBody;
        const query = typeof body.query === "string" ? body.query.toLowerCase() : "";
        return op.includes("updateprofile") || query.includes("updateprofile");
      })
      .map(([, tpl]) => tpl);

    if (!candidates.length) return null;
    candidates.sort((a, b) => this.scoreTemplateRichness(b) - this.scoreTemplateRichness(a));
    return candidates[0];
  }

  scoreTemplateRichness(template) {
    const body = template?.requestBody || {};
    const vars = body?.variables && typeof body.variables === "object" ? body.variables : {};
    const query = typeof body?.query === "string" ? body.query : "";
    return Object.keys(vars).length * 20 + Math.min(query.length, 800);
  }

  parseCustomPayloadTemplate() {
    try {
      const raw = (this.nodes.customPayload.value || "").trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!this.isUpdateProfilePayload(parsed)) return null;
      return parsed;
    } catch (_e) {
      return null;
    }
  }

  isUpdateProfilePayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    const operationName = String(payload.operationName || "").toLowerCase();
    const query = String(payload.query || "").toLowerCase();
    return operationName.includes("updateprofile") || query.includes("updateprofile");
  }

  buildUpdateBioFallbackCandidates(bio) {
    const out = [];
    out.push({
      operationName: "UpdateProfileMutation",
      variables: { bio },
      query:
        "mutation UpdateProfileMutation($bio: String!){updateProfile(bio:$bio){id bio __typename}}"
    });
    out.push({
      operationName: "UpdateProfileMutation",
      variables: { input: { bio } },
      query:
        "mutation UpdateProfileMutation($input: UpdateProfileInput!){updateProfile(input:$input){id bio __typename}}"
    });
    out.push({
      operationName: "UpdateProfileMutation",
      variables: { bio, displayName: null, username: null },
      query:
        "mutation UpdateProfileMutation($bio: String!, $displayName: String, $username: String){updateProfile(bio:$bio, displayName:$displayName, username:$username){id bio displayName username __typename}}"
    });
    return out;
  }

  isSuccessfulUpdateProfileResponse(response) {
    if (!response || !response.success) return false;
    const data = response?.data?.data;
    const errors = response?.data?.errors;
    if (Array.isArray(errors) && errors.length) return false;
    if (!data || !Object.prototype.hasOwnProperty.call(data, "updateProfile")) return false;
    return data.updateProfile != null;
  }

  setConnected(isConnected) {
    this.nodes.status.className = `status ${isConnected ? "connected" : "disconnected"}`;
    this.nodes.statusText.textContent = isConnected ? "Connected" : "Disconnected";
  }

  log(text) {
    this.nodes.response.textContent = text;
    this.nodes.response.style.display = "block";
  }
}

new WhatnotConnectorPopup();
