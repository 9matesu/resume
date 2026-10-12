# Inventory

Generated from `assets/inventory.csv` on 2026-10-12. Counts below reflect files on disk at `933f89e`.

## By role

| path | language | role | entry | notes |
| ---- | -------- | ---- | ----- | ----- |
| `extension/content.js` | javascript | logic | no | autoExtract plus POST adapt-text, DOM capture |
| `extension/background.js` | javascript | logic | no | service worker ensure-backend via native host |
| `extension/manifest.json` | json | config | no | MV3 side_panel background content_scripts |
| `extension/sidepanel.html` | html | entry | no | loads sidepanel bundle |
| `extension/studio.html` | html | entry | no | loads studio bundle |
| `extension/test/chooser.test.mjs` | javascript | test | no | static asserts of the chooser |
| `extension/test/sw-contract.test.mjs` | javascript | test | no | service worker contract |
| `extension/test/fixtures/linkedin_like.html` | html | test | no | LinkedIn fixture |
| `extension/test/fixtures/indeed_like.html` | html | test | no | Indeed fixture |
| `extension/test/fixtures/gupy_like.html` | html | test | no | Gupy fixture |
| `extension/fonts/schibsted-grotesk.woff2` | binary | vendor | no | UI font |
| `Abrir-resuMe.ps1` | powershell | entry | yes | light launcher without pip or build |
| `Abrir-resuMe.bat` | batch | entry | no | double-click shortcut of the launcher |
| `ui/src/chrome.ts` | typescript | io | no | startAutoCapture tabs.sendMessage ensureBackend |
| `ui/src/services/api.ts` | typescript | io | no | FastAPI HTTP client |
| `ui/src/cvFilename.ts` | typescript | logic | no | canonical CV name, mirrors filenames.py |
| `ui/src/SidePanelApp.tsx` | tsx | entry | yes | handleAutoCapture side panel |
| `ui/src/StudioApp.tsx` | tsx | entry | yes | studio root reopens adaptation |
| `ui/src/main-sidepanel.tsx` | tsx | entry | yes | sidepanel bootstrap |
| `ui/src/main-studio.tsx` | tsx | entry | yes | studio bootstrap |
| `ui/src/ErrorBoundary.tsx` | tsx | logic | no | UI error |
| `ui/src/index.css` | css | config | no | tailwind base plus brutal tokens |
| `ui/src/components/studio/StudioWorkspace.tsx` | tsx | logic | no | handleRecompile handleDownload editing |
| `ui/src/components/history/ApplicationHistory.tsx` | tsx | logic | no | history pdf_url |
| `ui/src/components/onboarding/OnboardingWizard.tsx` | tsx | logic | no | master profile |
| `ui/src/components/settings/SettingsPanel.tsx` | tsx | logic | no | AI provider and template |
| `ui/src/components/settings/AiProviderFields.tsx` | tsx | logic | no | Gemini OpenAI fields |
| `ui/test/copy.test.mjs` | javascript | test | no | UI copy |
| `ui/e2e/sidepanel.spec.ts` | typescript | test | no | panel E2E with screenshots |
| `ui/e2e/studio.spec.ts` | typescript | test | no | studio E2E and mobile overflow |
| `ui/playwright.config.ts` | typescript | config | no | serial workers vite webServer |
| `backend/app/main.py` | python | entry | yes | FastAPI app router |
| `backend/app/config.py` | python | config | no | get_settings OUTPUT_DIR |
| `backend/app/db.py` | python | io | no | sqlite new_id |
| `backend/app/api/routes.py` | python | logic | no | adapt_from_text PUT resumes GET pdf |
| `backend/app/services/ai/gateway.py` | python | logic | no | chat providers Gemini OpenAI |
| `backend/app/services/ai/vision.py` | python | logic | no | extract_job_from_text heuristic_extract |
| `backend/app/services/ai/prompts.py` | python | logic | no | build_adapt_payload keyword refine |
| `backend/app/services/latex/engine.py` | python | logic | no | generate render_tex compile_pdf tectonic |
| `backend/app/services/latex/filenames.py` | python | logic | no | cv_filename content_disposition |
| `backend/app/services/latex/validation.py` | python | logic | no | validates compiled PDF, unused live |
| `backend/app/services/resume/importer.py` | python | io | no | profile import |
| `backend/app/models/job.py` | python | io | no | save_adapted_resume get_job |
| `backend/app/models/profile.py` | python | io | no | active master profile |
| `backend/app/templates/devcelio/resume.tex.j2` | jinja | config | no | default resume template |
| `backend/app/templates/editorial/resume.tex.j2` | jinja | config | no | alternate ATS template |
| `backend/run.py` | python | entry | yes | serves uvicorn on port 8322 |
| `backend/tests/test_api.py` | python | test | no | adapt-text pdf PUT |
| `backend/tests/test_models.py` | python | test | no | models sqlite |
| `backend/tests/test_resume_template.py` | python | test | no | template render |
| `backend/tests/test_filenames_fallback.py` | python | test | no | fallback CV name |
| `backend/tests/conftest.py` | python | test | no | pytest fixtures |
| `native-host/host_main.py` | python | entry | yes | ensure_backend Popen run.py |
| `native-host/install-host.ps1` | powershell | config | no | installs host on Windows |
| `site/index.html` | html | entry | yes | resuMe landing |
| `site/landing.js` | javascript | logic | no | landing interactions |
| `site/landing.css` | css | config | no | landing style |
| `site/test/landing.test.mjs` | javascript | test | no | landing test |
| `scripts/instalar.ps1` | powershell | config | no | registers engine and host |
| `scripts/package-release.ps1` | powershell | config | no | packs release |

## Grouped remainder

* `extension/assets/`: generated bundles, gitignored, rebuilt by `npm run build`.
* `native-host/`: `com.resume.host.json` and `resume-host.json` are generated at install, gitignored.
* `scripts/ext-id.ps1`: utility that derives the extension id, used rarely.
* `ui/src/components/arc/`: cited during recon, absent on disk at this commit.

## Notes for readers

Vendor and generated code are marked so line counts stop misleading. Test fixtures are listed separately. `validation.py` stays listed with an unused note so nobody wires it twice.
