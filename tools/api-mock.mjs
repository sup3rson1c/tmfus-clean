/* Local stand-ins for the PHP endpoints.

   The real backend is PHP on cPanel and there is no PHP on this machine, so
   without these every form is a dead end locally and nothing can be reviewed
   end to end. Each mock mirrors the shape of the real response so the front
   end takes exactly the same code path it will take in production.

   These exist only in the dev server. Nothing here ships: on cPanel the real
   api/*.php files answer these same URLs.

   Deliberately noisy — every call is logged with what it received, so you can
   see a submission actually leave the page. Nothing is sent anywhere: a
   posted lead is logged and dropped, never forwarded to the live Sheet. */
import { randomUUID } from "node:crypto";

const json = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

const readBody = (req, limit = 25 * 1024 * 1024) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parse = (buf, type = "") => {
  const text = buf.toString("utf8");
  if (type.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return { _unparsed: text.slice(0, 400) };
    }
  }
  if (type.includes("multipart/form-data")) {
    // Enough to confirm the fields and files arrived; not a real parser.
    const names = [...text.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const files = [...text.matchAll(/filename="([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
    return { _fields: [...new Set(names)], _files: files };
  }
  return Object.fromEntries(new URLSearchParams(text));
};

const log = (name, data) => {
  const shown = JSON.stringify(data);
  console.log(`  [api-mock] ${name} <- ${shown.length > 300 ? shown.slice(0, 300) + "…" : shown}`);
};

/* The HELOC quote. The real endpoint calls Figure with server-held
   credentials; this reproduces the same arithmetic the page expects so the
   result is plausible rather than a placeholder. */
const helocQuote = (d) => {
  const value = Number(d.home_value || d.value || 0);
  const owed = Number(d.mortgage_balance || d.owed || 0);
  const score = Number(d.credit_score || d.score || 700);
  const CLTV = 0.85;
  const available = Math.max(0, Math.round(value * CLTV - owed));
  const capped = Math.min(available, 750000);
  const rate = score >= 780 ? 8.15 : score >= 740 ? 8.45 : score >= 700 ? 8.95 : score >= 660 ? 9.75 : score >= 620 ? 10.9 : 12.25;
  return {
    ok: true,
    mock: true,
    quote: {
      available: capped,
      max_cltv: CLTV,
      apr: rate,
      term_months: 360,
      monthly_estimate: capped ? Math.round((capped * (rate / 100 / 12)) / (1 - (1 + rate / 100 / 12) ** -360)) : 0,
    },
  };
};

const CHAT = new Map();

const ROUTES = {
  "/api/lead.php": (d) => {
    log("lead.php", d);
    return { ok: true, mock: true, id: randomUUID().slice(0, 8), stored: false, note: "logged locally, not forwarded" };
  },
  "/api/application.php": (d) => {
    log("application.php", d);
    return {
      ok: true,
      mock: true,
      reference: "TMF-" + randomUUID().slice(0, 6).toUpperCase(),
      received_fields: d._fields?.length ?? Object.keys(d).length,
      received_files: d._files ?? [],
    };
  },
  "/api/figure-heloc.php": (d) => {
    log("figure-heloc.php", d);
    return helocQuote(d);
  },
  "/api/unsubscribe.php": (d) => {
    log("unsubscribe.php", d);
    return { ok: true, mock: true, removed: true };
  },
  /* Speaks the same actions as the real api/chat.php (start, poll, send,
     human, details) in "message" mode: no agent configured, the visitor
     leaves a message and a person is paged. Sessions live in memory. */
  "/api/chat.php": (d) => {
    log("chat.php", d);
    const t = d.session && CHAT.get(d.session);
    switch (d.action) {
      case "start": {
        const session = randomUUID();
        CHAT.set(session, { messages: [], human: false, waiting: false });
        return { ok: true, mock: true, session, mode: "message" };
      }
      case "poll":
        return { ok: true, human: !!t?.human, waiting: !!t?.waiting, messages: (t?.messages || []).slice(Number(d.since) || 0) };
      case "send": {
        if (!t) return { ok: false, error: "no session" };
        t.waiting = true;
        const reply = { role: "note", text: "Local mock: in production this message is stored and John is paged." };
        return { ok: true, human: false, waiting: true, messages: [reply] };
      }
      case "human":
        if (t) t.waiting = true;
        return { ok: true, waiting: true };
      case "details":
        return { ok: true };
      default:
        return { ok: false, error: "unknown action" };
    }
  },
};

/** Returns true when it handled the request. */
export const handleApi = async (req, res, pathname) => {
  const route = ROUTES[pathname];
  if (!route) return false;

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return true;
  }
  // The chat widget asks once per visit whether to draw its button at all.
  if (req.method === "GET" && pathname === "/api/chat.php" && /[?&]status=1/.test(req.url)) {
    json(res, 200, { ok: true, enabled: true, mode: "message", mock: true });
    return true;
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "POST only" });
    return true;
  }

  try {
    const buf = await readBody(req);
    const data = parse(buf, req.headers["content-type"] || "");
    // A beat of latency, so loading states are actually visible in review.
    await new Promise((r) => setTimeout(r, 220));
    json(res, 200, route(data));
  } catch (err) {
    json(res, 400, { ok: false, mock: true, error: String(err.message || err) });
  }
  return true;
};

export const MOCK_ROUTES = Object.keys(ROUTES);
