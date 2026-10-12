"""Job extraction services (raw page text from the browser extension).

Two paths:
- AI path (primary): LLM structures the raw panel text into a job posting.
- Heuristic path (fallback / no-key): deterministic regex extraction so a
  capture without API key or with AI outage still yields a usable job and
  the pipeline can compile a CV instead of failing with 400/500.
"""
from __future__ import annotations

import re

from .gateway import get_provider, AIProvider, AIError
from . import prompts
from ...config import Settings


TECH_KEYWORDS = (
    "python", "java", "javascript", "typescript", "react", "node", "sql",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "linux",
    "git", "ci/cd", "seguranca", "segurança", "soc", "siem", "firewall",
    "pentest", "lgpd", "iso 27001", "nist", "redes", "suporte", "infra",
)

_REQ_HEADINGS = re.compile(
    r"(requisitos|requirements|qualifica|obrigat|desej|diferencial|"
    r"responsabilidades|responsibilities|benef[ií]cios|benefits|"
    r"sobre a vaga|about the role|what you.ll do)", re.I)


def heuristic_extract(job_text: str, page_title: str = "", page_url: str = "") -> dict:
    """Deterministic extraction: never calls the network, never invents."""
    text = (job_text or "").strip()
    lines = [ln.strip(" -*•\t") for ln in text.splitlines()]
    lines = [ln for ln in lines if ln.strip()]
    # Title: first substantial line (or page title prefix before separators).
    title = ""
    if page_title:
        title = re.split(r"\s[|\-–—]\s", page_title.strip())[0].strip()
    for ln in lines[:6]:
        if 8 <= len(ln) <= 140 and len(ln.split()) <= 14:
            title = ln
            break
    title = title or (lines[0][:140] if lines else "Vaga capturada")
    # Company: line mentioning empresa/company, else second short line.
    company = ""
    for ln in lines[1:8]:
        if re.search(r"(empresa|company|contratante|hiring)", ln, re.I) and len(ln) < 120:
            company = re.sub(r"(?i)^(empresa|company|contratante)\s*[:\-–]\s*", "", ln).strip()
            break
    if not company and len(lines) > 1 and len(lines[1]) <= 80:
        company = lines[1][:80]
    company = company or "Empresa não identificada"
    # Location: remote/hybrid/on-site + city patterns.
    loc = ""
    m = re.search(r"(?i)(remoto|remote|h[ií]brido|hybrid|presencial|on[\s\-]?site)[^.\n]{0,60}", text)
    if m:
        loc = m.group(0).strip()
    else:
        m2 = re.search(r"([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+)?\s*[-/,]\s*(?:SP|RJ|MG|RS|PR|BA|SC|GO|PE|CE|PA|Brasil|Brazil))", text)
        if m2:
            loc = m2.group(1).strip()
    # Requirements: bullet-ish lines after a requirements heading, else tech mentions.
    reqs: list[str] = []
    try:
        head_idx = next(i for i, ln in enumerate(lines) if _REQ_HEADINGS.search(ln))
        for ln in lines[head_idx + 1:head_idx + 40]:
            if len(ln) >= 4 and (ln[0] in "-•*·" or len(ln.split()) >= 2):
                reqs.append(ln.strip("-•*· ").strip()[:200])
            if len(reqs) >= 20:
                break
    except StopIteration:
        pass
    if not reqs:
        low = text.lower()
        reqs = [k for k in TECH_KEYWORDS if k in low][:15]
    keywords = list(dict.fromkeys(
        reqs[:10] + [k for k in TECH_KEYWORDS if k in text.lower()][:10]))[:20]
    workplace = "remote" if re.search(r"(?i)remot", (loc + " " + text[:2000])) else (
        "hybrid" if re.search(r"(?i)h[ií]brid|hybrid", (loc + " " + text[:2000])) else "on-site")
    return {
        "title": title[:140],
        "company": company[:120],
        "location": loc[:120],
        "workplace_type": workplace,
        "requirements": reqs[:20],
        "description": text[:8000],
        "keywords": keywords,
        "_fallback": True,
    }


def merge_structured(ai_job: dict, structured: dict | None) -> dict:
    """Frontend JSON-LD/meta hints win for title/company/location/url only."""
    if not structured:
        return ai_job
    out = dict(ai_job)
    for k in ("title", "company", "location", "url"):
        v = (structured.get(k) or "").strip() if isinstance(structured, dict) else ""
        if v and (not out.get(k) or out.get(k) in ("", "Unknown Role", "Unknown Company",
                                                   "Empresa não identificada", "Vaga capturada")):
            out[k] = v[:200]
    return out


def extract_job_from_text(job_text: str, settings: Settings, page_title: str = "",
                          page_url: str = "", structured: dict | None = None) -> dict:
    try:
        prov = get_provider(settings)
    except AIError:
        # No key/provider: heuristic still lets the user generate a CV.
        job = heuristic_extract(job_text, page_title, page_url)
        return merge_structured(job, structured)
    system, user = prompts.build_job_from_text_request(job_text, page_title, page_url)
    try:
        raw = prov.chat(system, user, expect_json=True)
        job = AIProvider._extract_json(raw)
    except Exception:
        job = heuristic_extract(job_text, page_title, page_url)
        return merge_structured(job, structured)
    # AI sometimes returns thin results on login-walls; fill gaps heuristically.
    if not job.get("title") or not job.get("description"):
        heur = heuristic_extract(job_text, page_title, page_url)
        for k in ("title", "company", "location", "requirements", "description", "keywords"):
            if not job.get(k) and heur.get(k):
                job[k] = heur[k]
    return merge_structured(job, structured)
