# Email Scheduler with AI — Chrome Extension (Manifest V3)

An open-source productivity tool that extracts scheduling details from highlighted
emails (Gmail / Outlook) and writes them to calendars using AI.

## Workflow

1. Highlight email text in a supported platform:
   1. Gmail
   2. Outlook
2. Right-click and select `Email Scheduler with AI` while the text is highlighted.
3. The configured AI model extracts the title, start time, end time, venue, and notes from the highlighted email.
4. The extracted data is shown in an editable panel before writing. If existing event(s) overlap the requested slot, the extension lists them and asks whether to overwrite existing event(s) or cancel writing.
5. On confirming, the event is written to Google Calendar and a success toast is shown.

---

## Installation and Setup

You may contact the developer through email (tonyliangfungyuen@gmail.com) to get your Gmail account whitelisted before using this extension. To install and setup the extension:

1. Download or clone the repository folder:

```powershell
git clone https://github.com/ltonygh/email-scheduler-with-ai
```

2. Open `chrome://extensions/`, toggle `Developer mode` (Top right of the page) to **ON**, click `Load Unpacked` and select the downloaded folder.
3. Connect to Google Calendar in the Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options` > `Google Calendar Connection`, then click `Link Google Calendar Account` and complete the sign-in with the whitelisted Gmail account. Google will show a "Google hasn't verified this app" notice. click `Advanced` > `Continue` to proceed, then enable all requested permissions. 

The extension is currently in test phase, and non-whitelisted Gamil accounts are unable to sign in. Contact the developer if you wish to try out the extension.

---

## AI Configuration in Extension

The extension works with any OpenAI-compatible Chat Completions endpoint. Configure it in the Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options` > `Settings`.

| Provider         | Custom API URL                                  | Example model               | API key                                        |
| ---------------- | ----------------------------------------------- | --------------------------- | ---------------------------------------------- |
| Ollama (Local)   |  `http://localhost:11434/v1/chat/completions` | `qwen2.5:7b`              | Leave empty, or use`ollama` as dummy string. |
| OpenRouter       | `https://openrouter.ai/api`                   | `google/gemini-flash-1.5` | OpenRouter token                               |
| DeepSeek         | `https://api.deepseek.com`                    | `deepseek-chat`           | DeepSeek key                                   |
| Google AI Studio | An OpenAI-compatible bridge is required         | -                           | -                                              |

Use `Test Connection` to verify whether the configured endpoint is listening to requests. If successful, an OK (200) status is returned.

---

### Ollama (Recommended)

Ollama is recommended to prevent email content from reaching the Internet. To configure Ollama, follow the steps below:

1. Install Ollama from [ollama.com/download](https://ollama.com/download)
2. Add the extension origin for Ollama to pick up requests from Chrome Extension:

   ```powershell
   [Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS","chrome-extension://*","User")
   ```

   or
   `Start` > `Edit the System Environment Variables` > `Environment Variables` > `User Variables` > `New User Variables` > `OLLAMA_ORIGINS = chrome-extension://*`
3. Pull a model, e.g. `ollama pull qwen2.5:7b`. For a list of models, visit [ollama.com/search](https://ollama.com/search).
4. Run Ollama in the terminal:

   ```Shell
   ollama run qwen2.5:7b
   ```
5. Open the `Email Scheduler with AI` Options page and configure the endpoint according to `AI Configuration`.

### Google AI Studio

Google AI Studio does not natively expose an OpenAI-compatible Chat Completions API, instead its native API uses a Gemini-specific request/response shape. To use it, run an OpenAI-compatible bridge/proxy in front of it, then point the Custom API URL at that bridge.
