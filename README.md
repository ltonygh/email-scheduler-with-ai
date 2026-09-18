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

1. Download or clone the repository folder:

```powershell
git clone https://github.com/ltonygh/email-scheduler-with-ai
```

2. Open `chrome://extensions/`, toggle `Developer mode` (Top right of the page) to **ON**, click `Load Unpacked` and select the downloaded folder.
3. Connect to Google Calendar in the Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options` > `Google Calendar Connection`, then click `Link Google Calendar Account` and complete the sign-in with the whitelisted Gmail account. Google will show a "Google hasn't verified this app" notice. click `Advanced` > `Continue` to proceed, then enable all requested permissions.

---

## Privacy

This extension does not operate any servers and does not collect your data. The email text you highlight is sent only to the AI endpoint you configure, and events are written to your own Google Calendar. There is no analytics or telemetry.

See the full [Privacy Policy](https://github.com/ltonygh/email-scheduler-with-ai/blob/main/PRIVACY.md) for details.

---

## AI Configuration in Extension

The extension works with any OpenAI-compatible Chat Completions endpoint. Configure it in the Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options` > `Settings`.

| Provider         | Custom API URL                          | Example model               | API key                                        |
| ---------------- | --------------------------------------- | --------------------------- | ---------------------------------------------- |
| Ollama (Local)   | `http://localhost:11434/`             | `qwen2.5:7b`              | Leave empty, or use `ollama` as dummy string. |
| OpenRouter       | `https://openrouter.ai/api`           | `google/gemini-flash-1.5` | OpenRouter token                               |
| DeepSeek         | `https://api.deepseek.com`            | `deepseek-chat`           | DeepSeek key                                   |
| Google AI Studio | An OpenAI-compatible bridge is required | -                           | -                                              |

Use `Test Connection` to verify whether the configured endpoint is listening to requests. If successful, an OK (200) status is returned.

---

### Ollama Setup (Recommended)

Ollama is recommended to prevent email content from reaching the Internet and guarantee data privacy. To configure Ollama, follow the steps below:

1. Install Ollama from https://ollama.com/download.
2. Add the extension origin for Ollama to pick up requests from Chrome Extension (Ollama must be completely terminated during the setup):

   1. Windows

      ```Shell
      [Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS","chrome-extension://*","User")
      ```

      or alternatively,
      `Start` > `Edit the System Environment Variables` > `Environment Variables` > `User Variables` > `New User Variables` > `OLLAMA_ORIGINS = chrome-extension://*`
   2. Mac

      ```Shell
      OLLAMA_ORIGINS="chrome-extension://*" ollama serve
      ```
   3. Linux

      ```Shell
      sudo systemctl edit ollama.service
      ```

      then add the following lines into the text editor

      ```
      [Service]
      Environment="OLLAMA_ORIGINS=chrome-extension://*"
      ```

      save and close the editor, and restart the service through the terminal

      ```Shell
      sudo systemctl daemon-reload
      sudo systemctl restart ollama
      ```
3. Pull a model, e.g. `ollama pull qwen2.5:7b`. For a list of models, visit (https://ollama.com/search).
4. Run Ollama in the terminal:

   ```Shell
   ollama run qwen2.5:7b
   ```
5. Open the `Email Scheduler with AI` Options page and configure the endpoint according to `AI Configuration`.

---

### Google AI Studio

Google AI Studio does not natively expose an OpenAI-compatible Chat Completions API, instead its native API uses a Gemini-specific request/response shape. To use it, run an OpenAI-compatible bridge/proxy in front of it, then point the Custom API URL at that bridge.

---

## License

MIT - Copyright 2026 ltonygh

---

## Support

Like this project? Leave a star ⭐ and share with others!
