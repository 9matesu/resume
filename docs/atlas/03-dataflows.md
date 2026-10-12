# Data movement

## L0

```mermaid
flowchart LR
  direction LR
  subgraph FONTES["fontes"]
    PG["Pagina vaga<br/>content.js"]:::concrete
    PM["Perfil mestre<br/>profile.py"]:::concrete
  end
  subgraph MEIO["motor"]
    EX["Auto extract<br/>content.js"]:::concrete
    AP["Adapt pipeline<br/>routes.py"]:::concrete
    LT["Render compile<br/>engine.py"]:::concrete
  end
  subgraph SORV["sorvedouros"]
    PDF["PDF final<br/>filenames.py"]:::concrete
    SQL["SQLite<br/>job.py"]:::concrete
    UI["UI Studio<br/>StudioApp.tsx"]:::concrete
  end
  PG -->|job_html| EX
  EX -->|job_text| AP
  PM -->|profile| AP
  AP -->|tailored| LT
  LT -->|pdf_bytes| PDF
  LT -->|pdf_path| SQL
  AP -->|sql_row| SQL
  PDF -->|pdf_url| UI
  classDef abstract fill:#9AA0A6,stroke:#5F6368,color:#fff,fontStyle:italic
  classDef concrete fill:#ffffff,stroke:#8B1A1A,stroke-width:1px,color:#202124
```

| edge | source | sink |
| ---- | ------ | ---- |
| `job_html: dom text` | `extension/content.js:61` | `extension/content.js:407` |
| `job_text: string ≤30000` | `extension/content.js:407` | `backend/app/api/routes.py:377` |
| `profile: CandidateProfile` | `backend/app/models/profile.py:27` | `backend/app/api/routes.py:307` |
| `tailored: dict` | `backend/app/api/routes.py:307` | `backend/app/services/latex/engine.py:318` |
| `pdf_bytes: bytes` | `backend/app/services/latex/engine.py:246` | `backend/app/services/latex/filenames.py:47` |
| `pdf_path: string` | `backend/app/services/latex/engine.py:318` | `backend/app/models/job.py:42` |
| `sql_row: job plus resume` | `backend/app/api/routes.py:325` | `backend/app/models/job.py:42` |
| `pdf_url: string` | `backend/app/api/routes.py:490` | `ui/src/components/studio/StudioWorkspace.tsx:128` |

Read left to right, sources to sinks. Retries fold into one edge each.

## L1 detail: adapt pipeline

```mermaid
flowchart LR
  direction LR
  subgraph CAP["captura"]
    IN["Texto vaga<br/>content.js"]:::concrete
    EJ["Extract job<br/>vision.py"]:::concrete
    HE["Heuristica<br/>vision.py"]:::concrete
  end
  subgraph ADAPT["adaptacao"]
    CA["Chat adapt<br/>routes.py"]:::concrete
    KR["Keyword refine<br/>routes.py"]:::concrete
  end
  subgraph RENDER["latex"]
    RT["Render tex<br/>engine.py"]:::concrete
    CP["Compile pdf<br/>engine.py"]:::concrete
    SV["Save resume<br/>job.py"]:::concrete
  end
  IN -->|job_text| EJ
  EJ -->|fallback| HE
  EJ -->|job_data| CA
  HE -->|job_data| CA
  CA -->|tailored| KR
  KR -->|refined| RT
  RT -->|tex_src| CP
  CP -->|pdf_path| SV
  classDef abstract fill:#9AA0A6,stroke:#5F6368,color:#fff,fontStyle:italic
  classDef concrete fill:#ffffff,stroke:#8B1A1A,stroke-width:1px,color:#202124
```

| step | code | data |
| ---- | ---- | ---- |
| 1 | `backend/app/api/routes.py:386` | `job_text` enters `extract_job_from_text` |
| 2 | `backend/app/services/ai/vision.py:119` | AI failure falls back to `heuristic_extract` |
| 3 | `backend/app/services/ai/vision.py:122` | thin AI result fills gaps from heuristic |
| 4 | `backend/app/api/routes.py:307` | pass 1 chat returns adapted JSON |
| 5 | `backend/app/api/routes.py:279` | pass 2 refines missing ATS keywords |
| 6 | `backend/app/services/latex/engine.py:318` | `render_tex` builds the tex source |
| 7 | `backend/app/services/latex/engine.py:246` | `compile_pdf` runs Tectonic or pdflatex |
| 8 | `backend/app/models/job.py:42` | `save_adapted_resume` persists tex plus pdf path |
