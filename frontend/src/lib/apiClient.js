import { API_BASE_URL } from "../app/config/env.js";

const DEFAULT_TIMEOUT_MS = 15000;

function isJsonResponse(res) {
  const ct = res.headers?.get?.("content-type") || "";
  return ct.includes("application/json");
}

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string | null, details?: unknown }} [opts]
   */
  constructor(message, { status = 0, code = null, details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const inflightGets = new Map();

function abortError() {
  return new ApiError("Request aborted.", { status: 0, code: "ABORTED" });
}

function sharedGet(key, makeRequest, userSignal) {
  let entry = inflightGets.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = { controller, promise: null, waiters: new Set() };
    entry.promise = makeRequest(controller.signal);
    entry.promise.then(
      () => {
        if (inflightGets.get(key) === entry) inflightGets.delete(key);
      },
      () => {
        if (inflightGets.get(key) === entry) inflightGets.delete(key);
      },
    );
    inflightGets.set(key, entry);
  }
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject };
    entry.waiters.add(waiter);
    const settle = (fn, val) => {
      if (!entry.waiters.delete(waiter)) return;
      // Detached long-lived screen signals would leak a listener per shared GET.
      try { userSignal?.removeEventListener?.("abort", detach); } catch { /* noop */ }
      fn(val);
    };
    const detach = () => {
      if (!entry.waiters.delete(waiter)) return;
      reject(abortError());
      if (entry.waiters.size === 0) {
        queueMicrotask(() => {
          if (entry.waiters.size === 0) {
            try {
              entry.controller.abort();
            } catch {
              /* noop */
            }
          }
        });
      }
    };
    if (userSignal) {
      if (userSignal.aborted) detach();
      else userSignal.addEventListener("abort", detach, { once: true });
    }
    entry.promise.then(
      (data) => settle(resolve, data),
      (err) => settle(reject, err),
    );
  });
}

export function cancelInflightRequests() {
  for (const [, entry] of inflightGets) {
    try {
      entry.controller.abort();
    } catch {
      /* noop */
    }
  }
  inflightGets.clear();
}

/**
 * @param {string} path
 * @param {{ timeoutMs?: number, skipAuthRedirect?: boolean, method?: string, signal?: AbortSignal | null, headers?: Record<string,string>, body?: string | FormData | null }} [options]
 */
export async function apiFetch(path, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuthRedirect = false,
    ...rest
  } = options;
  const method = String(rest.method || "GET").toUpperCase();
  const userSignal = rest.signal;
  const shareable = method === "GET" && rest.body == null;
  if (shareable) {
    const key = `GET ${path} ${skipAuthRedirect ? "skip401" : "auth401"} ${JSON.stringify(rest.headers || {})} t${timeoutMs}`;
    if (userSignal?.aborted) throw abortError();
    return sharedGet(
      key,
      (signal) =>
        doFetch(path, { timeoutMs, skipAuthRedirect, rest, method }, signal),
      userSignal,
    );
  }

  // Non-shared (writes + GETs with bodies): doFetch owns timeout + abort.
  return doFetch(
    path,
    { timeoutMs, skipAuthRedirect, rest, method },
    userSignal || null,
  );
}

async function doFetch(
  path,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuthRedirect = false,
    rest = /** @type {any} */ ({}),
    method = "GET",
  },
  outerSignal,
) {
  const controller = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onOuterAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
  }

  const isBodyless = !rest.body || method === "GET" || method === "HEAD";
  // FormData must keep its auto browser-set multipart boundary header.
  const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...rest,
      signal: controller.signal,
      headers: {
        ...(!isBodyless && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(rest.headers || {}),
      },
    });
    let data = null;
    try {
      // Proxy 502s are JSON; static-host HTML stays null (tells 204 apart from wrong host).
      data = isJsonResponse(res) ? await res.json() : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      if (
        res.status === 401 &&
        !skipAuthRedirect &&
        typeof window !== "undefined"
      ) {
        const p = window.location.pathname;
        if (
          ![
            "/",
            "/login",
            "/register",
            "/forgot-password",
            "/onboarding",
            "/reset-password",
            "/verify-email",
            "/check-email",
          ].includes(p)
        ) {
          window.dispatchEvent(new CustomEvent("vitalis:unauthorized"));
        }
      }
      throw new ApiError(
        data?.error || data?.message || `Request failed: ${res.status}`,
        {
          status: res.status,
          // 502/503/504 = backend/proxy down: callers show "offline".
          code:
            data?.code ||
            (res.status === 502 || res.status === 503 || res.status === 504
              ? 'UPSTREAM'
              : null),
          details: data?.details || null,
        },
      );
    }
    return data;
  } catch (err) {
    if (err?.name === "AbortError") {
      if (timedOut) {
        throw new ApiError("Request timed out. Please try again.", {
          status: 0,
          code: "TIMEOUT",
        });
      }
      throw abortError();
    }
    throw err;
  } finally {
    clearTimeout(t);
    if (outerSignal) outerSignal.removeEventListener?.("abort", onOuterAbort);
  }
}

export const apiGet = (path, options = {}) =>
  apiFetch(path, { ...options, method: "GET" });
export const apiPost = (path, body, options = {}) =>
  apiFetch(path, {
    ...options,
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
export const apiPatch = (path, body, options = {}) =>
  apiFetch(path, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(body ?? {}),
  });
export const apiDelete = (path, options = {}) =>
  apiFetch(path, { ...options, method: "DELETE" });
