#!/usr/bin/env python3
# Controllo DOPO pubblica.sh (dal 05/11/2026 tutti i domini sono su Cloudflare Pages): il dominio vero deve servire
# quello che c'e' nei file locali appena pubblicati. 5 tentativi ogni 30 secondi prima di dare errore.
#   python3 verifica_dominio.py download [/tv.apk /mobile.apk ...]
#       version.json e version-ios.json identici ai file di ~/BurgTV-site/burgtv-releases, e Location dei percorsi
#       indicati (tutti i redirect di _redirects se non se ne indica nessuno) uguale a staging/burgtv-download/public/_redirects
#   python3 verifica_dominio.py site "<testo atteso>" [percorso]      (percorso predefinito: /novita/)
#   python3 verifica_dominio.py portal                                 (assetlinks.json identico al file locale)
#   python3 verifica_dominio.py file <host> <cartella repo> <percorso> ...   (file identici, es. burgtv.com sitemap.xml llms.txt)
#   opzioni: --tentativi N (predefinito 5), --repo e --redirects (GitHub Actions)
# Esce con 0 se tutto torna, 1 altrimenti (con l'elenco delle differenze).
import http.client, os, sys, time, random
HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.path.expanduser("~/BurgTV-site")
TENTATIVI, PAUSA = 5, 30
# In GitHub Actions (opzione B): --repo <checkout> e --redirects <_redirects generato> al posto dei percorsi del Mac
REPO = {"download": os.path.join(HOME, "burgtv-releases"), "portal": os.path.join(HOME, "burgtv-portal")}
REDIRECTS = os.path.join(HERE, "staging", "burgtv-download", "public", "_redirects")

def get(host, path):
    c = http.client.HTTPSConnection(host, timeout=30)
    c.request("GET", path, headers={"User-Agent": "BurgTV-verifica/1.0", "Accept-Encoding": "identity", "Cache-Control": "no-cache"})
    r = c.getresponse()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, r.read()

def nocache(p):
    return f"{p}?v={int(time.time())}{random.randint(0, 9999)}"

def check_download(paths):
    errs = []
    for f in ("version.json", "version-ios.json"):
        local = open(os.path.join(REPO["download"], f), "rb").read()
        s, _, body = get("download.burgtv.com", nocache("/" + f))
        if s != 200 or body != local:
            errs.append(f"/{f}: stato {s}, contenuto {'uguale' if body == local else 'DIVERSO dal file locale'}")
    rules = {}
    for line in open(REDIRECTS):
        parts = line.split()
        if len(parts) == 3:
            rules[parts[0]] = (parts[1], int(parts[2]))
    for p in (paths or list(rules)):
        if p not in rules:
            errs.append(f"{p}: non e' tra i redirect generati"); continue
        dest, code = rules[p]
        s, h, _ = get("download.burgtv.com", p)
        if s != code or h.get("location") != dest:
            errs.append(f"{p}: atteso {code} {dest}, arrivato {s} {h.get('location')}")
    return errs

def check_site(text, path):
    s, _, body = get("burgtv.com", nocache(path))
    return [] if s == 200 and text.encode() in body else [f"{path}: stato {s}, '{text}' {'presente' if text.encode() in body else 'ASSENTE'}"]

def check_files(host, repo, paths):
    errs = []
    for p in paths:
        local = open(os.path.join(repo, p.lstrip("/")), "rb").read()
        s, _, body = get(host, nocache("/" + p.lstrip("/")))
        if s != 200 or body != local:
            errs.append(f"{host}/{p.lstrip('/')}: stato {s}, contenuto {'uguale' if body == local else 'DIVERSO dal file del repo'}")
    return errs

def check_portal():
    local = open(os.path.join(REPO["portal"], ".well-known", "assetlinks.json"), "rb").read()
    s, h, body = get("app.burgtv.com", "/.well-known/assetlinks.json")
    return [] if s == 200 and body == local else [f"assetlinks.json: stato {s}, contenuto {'uguale' if body == local else 'DIVERSO'}"]

if __name__ == "__main__":
    a = sys.argv[1:]
    if "--tentativi" in a:
        i = a.index("--tentativi"); TENTATIVI = int(a[i + 1]); del a[i:i + 2]
    for opt in ("--repo", "--redirects"):
        if opt in a:
            i = a.index(opt); v = os.path.abspath(a[i + 1]); del a[i:i + 2]
            if opt == "--repo":
                REPO["download"] = REPO["portal"] = v
            else:
                REDIRECTS = v
    if not a or a[0] not in ("download", "site", "portal", "file"):
        sys.exit(__doc__ or "uso: verifica_dominio.py download|site|portal ...")
    for t in range(1, TENTATIVI + 1):
        if a[0] == "download":
            errs = check_download(a[1:])
        elif a[0] == "file":
            errs = check_files(a[1], a[2], a[3:])
        elif a[0] == "site":
            errs = check_site(a[1], a[2] if len(a) > 2 else "/novita/")
        else:
            errs = check_portal()
        if not errs:
            print(f"dominio vero = file locali ({a[0]}), tentativo {t}")
            sys.exit(0)
        print(f"tentativo {t}/{TENTATIVI}: " + "; ".join(errs))
        if t < TENTATIVI:
            time.sleep(PAUSA)
    print("ERRORE: il dominio non serve ancora i file pubblicati")
    sys.exit(1)
