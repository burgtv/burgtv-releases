#!/usr/bin/env python3
# Prepara le cartelle da pubblicare su Cloudflare Pages partendo dai repo dei siti (che NON vengono toccati):
#   burgtv-site      <- ~/BurgTV-site/burgtv-site-live   (burgtv.com)
#   burgtv-download  <- ~/BurgTV-site/burgtv-releases    (download.burgtv.com)
#   burgtv-portal    <- ~/BurgTV-site/burgtv-portal      (app.burgtv.com e admin.burgtv.com)
# Traduce vercel.json in _redirects/_headers (e per il portale in una Pages Function _middleware.js che fa cio' che
# Vercel faceva con l'host e lo user-agent). Rilancia sempre dopo ogni modifica di vercel.json (es. link agli APK).
# Uso: python3 genera.py [site|download|portal ...]   -> staging/<progetto>/public (+ staging/<progetto>/functions)
import json, os, re, shutil, subprocess, sys
HOME = os.path.expanduser("~/BurgTV-site")
HERE = os.path.dirname(os.path.abspath(__file__))
SITES = {
    "site": ("burgtv-site", f"{HOME}/burgtv-site-live", ["vercel.json", "CNAME", ".nojekyll"]),
    "download": ("burgtv-download", f"{HOME}/burgtv-releases", ["vercel.json", ".vercelignore", "README.md", "scripts"]),
    "portal": ("burgtv-portal", f"{HOME}/burgtv-portal", ["vercel.json", "middleware.js"]),
}
MAX_FILES, MAX_BYTES = 20000, 25 * 1024 * 1024

def status(r):
    if "statusCode" in r:
        return r["statusCode"]
    return 308 if r.get("permanent", True) else 307

def expand(src):
    """Pattern di Vercel -> elenco di percorsi per Pages (alternative (a|b) espanse, (.*) -> *)."""
    m = re.search(r":(\w+)\(([^)]*)\)", src)
    if m and "|" in m.group(2) and ".*" not in m.group(2):
        out = []
        for alt in m.group(2).split("|"):
            out += [(p, {**d, m.group(1): alt}) for p, d in expand(src[:m.start()] + alt + src[m.end():])]
        return out
    m = re.search(r"\(([a-z0-9|-]+)\)", src)
    if m and "|" in m.group(1):
        out = []
        for alt in m.group(1).split("|"):
            out += expand(src[:m.start()] + alt + src[m.end():])
        return out
    if src.endswith("(/?)(.*)"):
        b = src[: -len("(/?)(.*)")]
        return [(b, {}), (b + "/*", {})]
    s = src.replace("/(.*)", "/*").replace("(.*)", "*")
    return [(s, {})]

def translate(cfg, name):
    red, hdr, notes = [], [], []
    for r in cfg.get("redirects", []):
        if r.get("has"):
            notes.append(f"redirect con condizione {r['has']} su {r['source']}: non esprimibile in _redirects")
            continue
        for path, vals in expand(r["source"]):
            dest = r["destination"]
            for k, v in vals.items():
                dest = dest.replace(f":{k}", v)
            red.append(f"{path} {dest} {status(r)}")
            # Vercel con trailingSlash:true fa corrispondere anche la forma con la barra finale
            if cfg.get("trailingSlash") and not path.endswith("/") and "." not in path.rsplit("/", 1)[-1] and "*" not in path:
                red.append(f"{path}/ {dest} {status(r)}")
    for h in cfg.get("headers", []):
        paths = [p for p, _ in expand(h["source"])]
        # Pages toglie .html dagli indirizzi (308 verso la forma senza .html): la regola vale per entrambe le forme
        paths += [p[:-5] for p in paths if p.endswith(".html") and not p.endswith("/index.html")]
        for path in paths:
            hdr.append(path)
            for kv in h["headers"]:
                hdr.append(f"  {kv['key']}: {kv['value']}")
    if cfg.get("rewrites"):
        notes.append(f"rewrites {cfg['rewrites']}: gestiti nella Function del portale")
    # righe uniche, ordine conservato
    seen, red2 = set(), []
    for l in red:
        k = l.split()[0]
        if k not in seen:
            seen.add(k); red2.append(l)
    return red2, hdr, notes

PORTAL_MW = r"""// Pages Function del portale: rifa' cio' che su Vercel facevano middleware.js e le regole di vercel.json che
// dipendono dall'host o dallo user-agent (generata da cloudflare-pages/genera.py, non modificare a mano).
const DOCS = 'terms|privacy|cookies|aup|dmca|good-faith|transparency|delete-account|faq';
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const host = url.hostname;
  const p = url.pathname;
  // admin.burgtv.com: tutto cio' che non e' /admin va a /admin/... con 307 (come middleware.js su Vercel)
  if (host === 'admin.burgtv.com' && !p.startsWith('/admin')) {
    const t = new URL(url); t.pathname = '/admin' + (p === '/' ? '/' : p);
    return Response.redirect(t.toString(), 307);
  }
  const ua = ctx.request.headers.get('user-agent') || '';
  const R = (to, code) => Response.redirect(to, code);
  if (p === '/legal' || p === '/legal/' || p === '/legal/index.html') return R('https://burgtv.com/legal/', 301);
  let m = p.match(/^\/legal\/(terms|privacy)(\.html)?$/);
  if (m && /(iPhone|iPad|iPod)/.test(ua)) return R(`https://burgtv.com/legal/ios/${m[1]}/`, 302);
  if (m && /^Mozilla\/5\.0 \(Linux; Android/.test(ua)) return R(`https://burgtv.com/legal/android/${m[1]}/`, 302);
  m = p.match(new RegExp(`^/legal/(${DOCS})(\\.html)?$`));
  if (m) return R(`https://burgtv.com/legal/${m[1]}/`, 301);
  m = p.match(/^\/play\/(terms|privacy)(\.html)?$/);
  if (m) return R(`https://burgtv.com/legal/play/${m[1]}/`, 301);
  return ctx.next();
}
"""
# Percorsi che NON devono passare dalla Function (statici con intestazioni proprie, file .well-known, pannello admin):
PORTAL_ROUTES = {"version": 1, "include": ["/*"], "exclude": [
    "/admin/*", "/assets/*", "/.well-known/*", "/collega", "/collega/*", "/reset-password.html", "/reset-password",
    "/favicon.ico", "/robots.txt", "/logo.png", "/apple-touch-icon.png"]}

def build(key, repo=None, base=None):
    """repo/base: in GitHub Actions (opzione B) il repo e' la cartella del checkout e base la cartella di uscita."""
    project, repo0, skip = SITES[key]
    repo = repo or repo0
    skip = skip + [".github", ".cloudflare", "_pages"]
    base = base or os.path.join(HERE, "staging", project)
    pub = os.path.join(base, "public")
    shutil.rmtree(base, ignore_errors=True)
    os.makedirs(base)
    ex = sum((["--exclude", s] for s in [".git", ".DS_Store", "* 2", "* 2.*"] + skip), [])
    subprocess.run(["rsync", "-a", "--delete", *ex, repo + "/", pub + "/"], check=True)
    cfg = json.load(open(os.path.join(repo, "vercel.json")))
    red, hdr, notes = translate(cfg, key)
    if key == "portal":
        # le regole del portale con host e user-agent sono nella Function; qui solo le riscritture (200) che tengono
        # gli indirizzi come su Vercel (senza cleanUrls): /collega e le pagine .html rispondono 200, senza 308
        red = ["/collega /collega/ 200"]
        for root, _, files in os.walk(pub):
            rel = os.path.relpath(root, pub).replace(os.sep, "/")
            if rel.split("/")[0] in ("legal", "play", "admin", ".well-known"):
                continue
            for f in sorted(files):
                if f.endswith(".html") and f not in ("index.html", "404.html"):
                    path = ("" if rel == "." else "/" + rel) + "/" + f
                    red.append(f"{path} {path[:-5]} 200")
        os.makedirs(os.path.join(base, "functions"))
        open(os.path.join(base, "functions", "_middleware.js"), "w").write(PORTAL_MW)
        json.dump(PORTAL_ROUTES, open(os.path.join(pub, "_routes.json"), "w"), indent=1)
    if key == "site":
        notes.append("www.burgtv.com -> burgtv.com (301): va fatto con una Redirect Rule della zona Cloudflare al passaggio del dominio")
    # Vercel serve i file .json con "application/json; charset=utf-8": stessa intestazione su Pages
    jl = []
    for root, _, files in os.walk(pub):
        for f in files:
            if f.endswith(".json") and f != "_routes.json" and "/admin" not in root:
                jl.append("/" + os.path.relpath(os.path.join(root, f), pub).replace(os.sep, "/"))
    for path in sorted(jl):
        if path in hdr:
            i = hdr.index(path) + 1
            while i < len(hdr) and hdr[i].startswith("  "):
                if hdr[i].lower().startswith("  content-type:"):
                    hdr[i] = "  Content-Type: application/json; charset=utf-8"
                i += 1
            if not any(hdr[j].lower().startswith("  content-type:") for j in range(hdr.index(path) + 1, i)):
                hdr.insert(i, "  Content-Type: application/json; charset=utf-8")
        else:
            hdr += [path, "  Content-Type: application/json; charset=utf-8"]
    open(os.path.join(pub, "_redirects"), "w").write("\n".join(red) + ("\n" if red else ""))
    open(os.path.join(pub, "_headers"), "w").write("\n".join(hdr) + "\n")
    n, big = 0, []
    for root, _, files in os.walk(pub):
        for f in files:
            n += 1
            sz = os.path.getsize(os.path.join(root, f))
            if sz > MAX_BYTES:
                big.append((os.path.relpath(os.path.join(root, f), pub), sz))
    assert n <= MAX_FILES, f"{project}: {n} file (limite {MAX_FILES})"
    assert not big, f"{project}: file oltre 25 MiB: {big}"
    print(f"{project}: {n} file, {len(red)} redirect, {sum(1 for l in hdr if not l.startswith(' '))} regole di intestazioni")
    for x in notes:
        print("   nota:", x)

if __name__ == "__main__":
    # GitHub Actions: python3 .cloudflare/genera.py --ci <site|download|portal> <cartella repo> <cartella uscita>
    if sys.argv[1:2] == ["--ci"]:
        build(sys.argv[2], os.path.abspath(sys.argv[3]), os.path.abspath(sys.argv[4]))
        sys.exit(0)
    for k in (sys.argv[1:] or list(SITES)):
        build(k)
