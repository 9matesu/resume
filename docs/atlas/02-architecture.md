# Architecture

## Context

```mermaid
flowchart LR
  direction LR
  subgraph EXT["externos"]
    U["User<br/>externo"]:::abstract
    CH["Chrome<br/>chrome"]:::abstract
    VG["Vaga LinkedIn<br/>externo"]:::abstract
    AI["Provedor IA<br/>externo"]:::abstract
    TX["Tectonic<br/>externo"]:::abstract
  end
  subgraph REPO["repo"]
    E["Extension<br/>content.js"]:::concrete
    M["Motor API<br/>main.py"]:::concrete
    S["UI Studio<br/>StudioApp.tsx"]:::concrete
  end
  U -->|click_auto| E
  CH -->|tabs_msg| E
  VG -->|job_html| E
  E -->|job_text| M
  M -->|prompt| AI
  AI -->|json_out| M
  M -->|tex_src| TX
  TX -->|pdf_bytes| M
  M -->|pdf_url| S
  S -->|pdf_view| U
  classDef abstract fill:#9AA0A6,stroke:#5F6368,color:#fff,fontStyle:italic
  classDef concrete fill:#ffffff,stroke:#8B1A1A,stroke-width:1px,color:#202124
```

| edge | source | sink |
| ---- | ------ | ---- |
| `click_auto` | `ui/src/SidePanelApp.tsx:160` | `ui/src/chrome.ts:39` |
| `tabs_msg` | `ui/src/chrome.ts:45` | `extension/content.js:491` |
| `job_html` | `extension/content.js:61` | `extension/content.js:503` |
| `job_text` | `extension/content.js:503` | `backend/app/api/routes.py:363` |
| `prompt` | `backend/app/services/ai/gateway.py:336` | provider HTTPS API |
| `json_out` | provider HTTPS API | `backend/app/services/ai/vision.py:122` |
| `tex_src` | `backend/app/services/latex/engine.py:311` | tectonic subprocess |
| `pdf_bytes` | tectonic subprocess | `backend/app/services/latex/engine.py:245` |
| `pdf_url` | `backend/app/api/routes.py:474` | `ui/src/components/studio/StudioWorkspace.tsx:128` |
| `pdf_view` | `ui/src/components/studio/StudioWorkspace.tsx:128` | user download |

Notes: the user drives the extension, the repo calls providers and Tectonic, Chrome carries tab messages. No screenshot crosses the boundary, per `docs/adr/001-captura-dom.md`.

## Containers

```mermaid
classDiagram
  direction TB
  class Ext["Extension<br/>content.js"]
  class UI["UI<br/>SidePanel"]
  class Api["API<br/>routes.py"]
  class Svc["Services<br/>engine.py"]
  class Mod["Models<br/>job.py"]
  class Host["Native host<br/>host_main.py"]
  class Scr["Scripts<br/>instalar.ps1"]
  class AIGw["AI gateway<br/>gateway.py"]
  class HttpProv["HTTP provider<br/>gateway.py"]
  Ext --> Api : job_text
  UI --> Api : http_json
  Api --> Svc : calls
  Svc --> Mod : saves
  Host --> Api : spawn
  Scr --> Host : installs
  Api --> AIGw : prompts
  AIGw <|-- HttpProv : extends
  classDef abstract fill:#9AA0A6,stroke:#5F6368,color:#fff,fontStyle:italic
  classDef concrete fill:#ffffff,stroke:#8B1A1A,stroke-width:1px,color:#202124
```

| edge | source | sink |
| ---- | ------ | ---- |
| `job_text` | `extension/content.js:503` | `backend/app/api/routes.py:363` |
| `http_json` | `ui/src/services/api.ts:239` | `backend/app/api/routes.py:363` |
| `calls` | `backend/app/api/routes.py:372` | `backend/app/services/latex/engine.py:311` |
| `saves` | `backend/app/api/routes.py:322` | `backend/app/models/job.py:42` |
| `spawn` | `native-host/host_main.py:175` | `backend/run.py:1` |
| `installs` | `scripts/instalar.ps1:1` | `native-host/install-host.ps1:1` |
| `prompts` | `backend/app/api/routes.py:265` | `backend/app/services/ai/gateway.py:336` |
| `extends` | `backend/app/services/ai/gateway.py:336` | provider subclass in same file |

Notes: module boundaries match folders. The UI never touches SQLite or LaTeX directly. Everything crosses `routes.py`.
