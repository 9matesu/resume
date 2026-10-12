"""Canonical CV filenames: CV<FirstName>-<JobArea>.

Example: candidate "Mateus Santos" + job "Segurança da Informação"
-> "CVMateus-Seguranca-da-Informacao.pdf" (ASCII-safe for filesystems/ATS).

Rules:
- FirstName: first token of candidate name, ASCII-normalized, Capitalized.
- Area: job title (fallback company), ASCII-normalized, Title-Case words
  joined with "-", truncated to 60 chars.
- Always ends with .pdf. Never empty: falls back to CV.pdf.
"""
from __future__ import annotations

import re
import unicodedata


def _ascii(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def _clean_token(s: str) -> str:
    s = _ascii(s).strip()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")
    return s


def first_name(candidate_name: str) -> str:
    clean = _ascii(candidate_name or "").strip().split()
    if not clean:
        return ""
    tok = re.sub(r"[^A-Za-z0-9]", "", clean[0])
    return tok[:30].capitalize() if tok else ""


def area_slug(title: str, company: str = "") -> str:
    base = (title or "").strip() or (company or "").strip() or "Vaga"
    words = re.split(r"\s+", _ascii(base).strip())
    toks = [_clean_token(w).capitalize() for w in words]
    toks = [t for t in toks if t]
    slug = "-".join(toks)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug[:60] or "Vaga"


def cv_filename(candidate_name: str, job_title: str, job_company: str = "") -> str:
    """Return e.g. 'CVMateus-Seguranca-da-Informacao.pdf'."""
    fn = first_name(candidate_name)
    area = area_slug(job_title, job_company)
    if fn:
        return f"CV{fn}-{area}.pdf"
    return f"CV-{area}.pdf"


def content_disposition(filename: str) -> str:
    safe = re.sub(r"[^\x20-\x7E]", "", filename).replace('"', "")
    return f'attachment; filename="{safe}"'
