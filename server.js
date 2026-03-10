const express = require("express");
const path = require("path");
const { URL } = require("url");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static(path.join(__dirname, "public")));

function cleanUrl(raw) {
  if (!raw) return null;
  raw = raw.trim();
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = "https://" + raw;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

app.get("/go", async (req, res) => {
  const raw = req.query.url || "";
  const target = cleanUrl(raw);
  if (!target) {
    return res.status(400).send("Invalid address");
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: req.headers["accept"] || "*/*",
        "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9"
      },
      redirect: "manual"
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      const loc = upstream.headers.get("location");
      if (loc) {
        const nextUrl = new URL(loc, target).toString();
        return res.redirect(`/go?url=${encodeURIComponent(nextUrl)}`);
      }
    }

    const hopByHop = new Set([
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailers",
      "transfer-encoding",
      "upgrade",
      "content-encoding",
      "content-length"
    ]);

    upstream.headers.forEach((value, key) => {
      if (!hopByHop.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(upstream.status);
    upstream.body.pipe(res);
  } catch (e) {
    res.status(502).send("Unable to reach site");
  }
});

app.get("/browse", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "browse.html"));
});

app.listen(PORT, () => {
  console.log("Listening on", PORT);
});
