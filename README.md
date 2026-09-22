# Email Scheduler with AI (0.3.1) - Chrome Extension (Manifest V3)

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

## Installation

1. Add extension from Chrome Web Store

```
https://chromewebstore.google.com/detail/email-scheduler-with-ai/hjfcccpikffkikkneiiaemkmcjkomkam?authuser=0&hl=en-GB&pli=1
```

2. Open the extension's Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options`
3. Under `Google Calendar Connection`, click `Link Google Calendar Account` and complete the sign-in with the whitelisted Gmail account. Google will show a "Google hasn't verified this app" notice. Click `Advanced` > `Continue` to proceed, then enable all requested permissions.

---

## AI Configuration in Extension

The extension works with any OpenAI-compatible Chat Completions endpoint. Configure it in the Options page by `Extensions` > `Email Scheduler with AI` > `More Options` > `Options` > `Settings`.

| Provider         | Custom API URL                          | Example model               | API key                                        |
| ---------------- | --------------------------------------- | --------------------------- | ---------------------------------------------- |
| Ollama (Local)   | `http://localhost:11434/`             | `qwen2.5:7b`              | Leave empty, or use`ollama` as dummy string. |
| OpenRouter       | `https://openrouter.ai/api`           | `google/gemini-flash-1.5` | OpenRouter token                               |
| DeepSeek         | `https://api.deepseek.com`            | `deepseek-chat`           | DeepSeek key                                   |
| Google AI Studio | An OpenAI-compatible bridge is required | -                           | -                                              |

Use `Test Connection` to verify whether the configured endpoint is listening to requests. If successful, an OK (200) status is returned.

### Ollama Setup

**Recommended**

Ollama is recommended to prevent email content from reaching the Internet and guarantee data privacy. To configure Ollama, follow the steps below:

1. Install Ollama from [Ollama Official Website](https://ollama.com/download).
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
3. Pull a model, e.g. `ollama pull qwen2.5:7b`. For a list of models, visit [Ollama Models](https://ollama.com/search).
4. Run Ollama in the terminal:

   ```Shell
   ollama run qwen2.5:7b
   ```
5. Open the `Email Scheduler with AI` Options page and configure the endpoint according to `AI Configuration`.

### Google AI Studio

Google AI Studio does not natively expose an OpenAI-compatible Chat Completions API, instead its native API uses a Gemini-specific request/response shape. To use it, run an OpenAI-compatible bridge/proxy in front of it, then point the Custom API URL at that bridge.

---

## Beta Tester

This extension is currently in a **beta test phase**. Distribution is limited to whitelisted testers, and only whitelisted Gmail accounts can sign in to Google Calendar. If you would like to try it out, contact the developer at **tonyliangfungyuen@gmail.com** to have your Gmail account added to the tester list.

As a beta tester, expect the following:

- The Google consent screen shows a **"Google hasn't verified this app"** notice. Thisis expected before public release. Click `Advanced` > `Continue` to proceed.
- Some providers and configurations are still being validated; if something fails, sharing the error message (and the `Test Connection` result) helps a lot.
- The extension updates automatically from the Chrome Web Store; no manual reloadis needed.

Feedback, bug reports, and feature suggestions are welcome and directly shape the roadmap. Thank you for helping test the extension!

---

## Privacy

This extension does not operate on any servers hosted by the developer, and does not collect your data. Email content is directly sent to your configured AI endpoint, and events are written to your own Google Calendar. No analytics or telemetry is involved in the process.

Read [Privacy Policy](https://github.com/ltonygh/email-scheduler-with-ai/blob/main/PRIVACY.md) for more details.

---

## License

MIT - Copyright 2026 ltonygh

Read [License](https://github.com/ltonygh/email-scheduler-with-ai/blob/main/LICENSE.md) for more details.

---

## Support

Like this project? Leave a star ⭐ and share with others!

You can also support me through [Buy Me a Coffee](https://buymeacoffee.com/tonyliang) or [Ko-Fi](https://ko-fi.com/radicalbaguette) ☕!
