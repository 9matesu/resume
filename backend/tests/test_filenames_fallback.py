"""Canonical CV filenames + heuristic extraction fallback + PDF gate."""
from app.services.latex.filenames import cv_filename, first_name, area_slug
from app.services.ai.vision import heuristic_extract, merge_structured
from app.services.latex.validation import validate_pdf, ValidationError
import pytest


def test_cv_filename_mateus_seguranca():
    assert cv_filename("Mateus Santos", "Segurança da Informação", "Acme") == \
        "CVMateus-Seguranca-Da-Informacao.pdf"


def test_cv_filename_no_accents_no_spaces():
    name = cv_filename("Ana Souza", "Analista SOC Júnior", "")
    assert name.startswith("CVAn")
    assert name.endswith(".pdf")
    assert " " not in name
    assert all(ord(c) < 128 for c in name)


def test_first_name_empty():
    assert first_name("") == ""


def test_heuristic_never_empty():
    j = heuristic_extract("Analista de Segurança\nAcme Tecnologia\nRequisitos:\n- Linux\n- Redes\nRemoto", "Vaga | Gupy", "http://x")
    assert j["title"] and j["company"]
    assert isinstance(j["requirements"], list)
    assert j["_fallback"] is True


def test_heuristic_short_text_still_structured():
    j = heuristic_extract("x" * 100, "", "")
    assert j["description"]
    assert j["workplace_type"] in ("remote", "hybrid", "on-site")


def test_merge_structured_prefers_jsonld_when_ai_empty():
    ai = {"title": "", "company": "Unknown Company", "location": ""}
    out = merge_structured(ai, {"title": "Analista SOC", "company": "Acme", "location": "Remoto"})
    assert out["title"] == "Analista SOC"
    assert out["company"] == "Acme"


def test_validate_pdf_rejects_small_file(tmp_path):
    p = tmp_path / "tiny.pdf"
    p.write_bytes(b"%PDF-1.4 fake")
    with pytest.raises(ValidationError):
        validate_pdf(p, "tex", "Mateus")


def test_validate_pdf_rejects_wrong_name(tmp_path):
    p = tmp_path / "resume.pdf"
    p.write_bytes(b"%PDF-1.4 " + b"x" * 3000)
    with pytest.raises(ValidationError):
        validate_pdf(p, "curriculo de outra pessoa", "Mateus")
