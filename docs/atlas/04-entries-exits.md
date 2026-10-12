# Entries and exits

## Inbound

| entry | site | data |
| ----- | ---- | ---- |
| `http` | `backend/app/api/routes.py:363` | `job_text: string, structured: dict, mode: string` |
| `http` | `backend/app/api/routes.py:211` | `multipart resume file: bytes` |
| `http` | `backend/app/api/routes.py:201` | `profile: CandidateProfile` |
| `http` | `backend/app/api/routes.py:442` | `tex_code: string or profile: dict` |
| `http` | `backend/app/api/routes.py:90` | `SettingsPayload` |
| `http` | `backend/app/api/routes.py:130` | `SettingsPayload, probe: bool` |
| `cli` | `backend/run.py:1` | `RESUME_PORT env, reload flag` |
| `cli` | `Abrir-resuMe.ps1:1` | no args, health probe on port 8322 |
| `queue` | `extension/content.js:491` | `resume-capture-start: void` |
| `queue` | `extension/content.js:493` | `resume-capture-auto: void` |
| `queue` | `extension/content.js:526` | `resume-capture-cancel: void` |
| `callback` | `extension/background.js:12` | `capture command: Alt+Shift+A` |
| `file` | `backend/app/api/routes.py:224` | `file_path: string` |
| `env` | `backend/app/config.py:39` | `AI_PROVIDER, AI_MODEL, AI_API_KEY` |

## Outbound

| exit | site | data |
| ---- | ---- | ---- |
| `db` | `backend/app/models/job.py:11` | `jobs row: title company match_score` |
| `db` | `backend/app/models/job.py:42` | `adapted_resumes row: tex pdf_path` |
| `db` | `backend/app/models/profile.py:43` | `candidates row: profile json` |
| `file` | `backend/app/services/latex/engine.py:311` | `resume.tex plus CVMateus-*.pdf` |
| `net` | `backend/app/services/ai/gateway.py:336` | `prompt: string to provider HTTPS` |
| `net` | `extension/content.js:503` | `POST adapt-text: job_text json` |
| `ui` | `ui/src/SidePanelApp.tsx:160` | `AdaptedResult card plus pdf_url` |
| `ui` | `ui/src/components/studio/StudioWorkspace.tsx:86` | `recompiled pdf iframe` |
| `callback` | `extension/content.js:398` | `resume-capture-result: ok or error` |
| `callback` | `native-host/host_main.py:175` | `Popen backend process` |
| `error` | `backend/app/api/routes.py:367` | `400 Texto curto demais para extrair a vaga` |
| `error` | `backend/app/api/routes.py:369` | `400 Perfil mestre nao encontrado` |
| `error` | `backend/app/services/latex/engine.py:260` | `LatexError no compiler found` |

Typed errors are exits. Each return site is listed.

## Hot path

```mermaid
sequenceDiagram
  participant U as User<br/>externo
  participant SP as SidePanel<br/>SidePanel
  participant CH as Chrome Tabs<br/>chrome.ts
  participant CT as Content<br/>content.js
  participant API as Motor API<br/>routes.py
  participant VS as Vision<br/>vision.py
  participant LT as LaTeX<br/>engine.py
  SP ->> CH: auto_capture
  CH ->> CT: send_msg
  CT ->> CT: auto_extract
  alt ok
  CT ->> API: job_text
  API ->> VS: extract_job
  VS -->> API: job_data
  API ->> LT: tex_compile
  LT -->> API: pdf_bytes
  API -->> SP: pdf_url
  else falha
  CT -->> SP: texto curto
  API -->> SP: sem vaga
  end
  classDef abstract fill:#9AA0A6,stroke:#5F6368,color:#fff,fontStyle:italic
  classDef concrete fill:#ffffff,stroke:#8B1A1A,stroke-width:1px,color:#202124
```

Notes: auto capture from panel click to pdf url. Message names match `chrome.ts:39` and `content.js:493`. Failure labels match the errors surfaced to the panel.
