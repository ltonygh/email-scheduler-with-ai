# Privacy Policy — Email Scheduler with AI

_Last updated: 2025_

This Privacy Policy explains how the **Email Scheduler with AI** Chrome extension
("the extension", "we", "us") handles information. The extension is an open-source
tool that extracts scheduling details from text you highlight in Gmail or Outlook and
writes the resulting event to your Google Calendar.

By installing and using the extension, you agree to this policy.

## Summary

- We do **not** operate any servers and we **do not** collect, see, or store your
  data on our side.
- The extension processes **only the text you explicitly highlight**.
- That text is sent **only to the AI endpoint you configure yourself** (for example
  OpenRouter, DeepSeek, a Google AI Studio bridge, or a local Ollama server).
- Extracted event details are written to **your own** Google Calendar using **your**
  Google account.
- We do **not** sell or share your data, and we do **not** use it for advertising.
- There is **no analytics and no telemetry**.

## What information is handled, and why

### 1. Highlighted email text

When you highlight text in a supported email page (Gmail or Outlook) and choose
**Email Scheduler with AI** from the right-click menu, the extension reads that
highlighted text and sends it to the AI endpoint **you** configure in the Options
page, so the AI can extract the event details.

- **Why:** to perform the extension's single purpose — extracting event details from
  email content.
- **Where it goes:** only to the endpoint you configure. This may be:
  - a third-party AI provider you have chosen (e.g. OpenRouter, DeepSeek);
  - an OpenAI-compatible service you host or point to; or
  - a local server on your own computer (e.g. Ollama), in which case the text does
    not leave your device.
- **Important:** the extension has no "Our servers" step. The highlighted text is sent
  by your browser **directly** to your chosen endpoint. How that provider handles the
  text is governed by **that provider's own privacy policy**, not this one. If you
  want the text to stay on your device, configure a local endpoint such as Ollama.

### 2. Extracted event details and Google Calendar

After extraction, the resulting event details (title, start/end time, venue, and
notes) are used to:

- check your calendar for **conflicting events** in the requested time range; and
- **create the new event** (and delete conflicts you approve overwriting).

This is done through the **Google Calendar API** using an OAuth access token for
**your** Google account. This data is exchanged only between your browser and Google's
official endpoints (`https://www.googleapis.com`).

### 3. Extension settings

Your settings are stored locally using Chrome's `chrome.storage.sync`:

- the AI provider API key,
- the AI model name,
- the custom API endpoint URL,
- the calendar routing target.

- **Why:** so the extension remembers your configuration.
- **Note:** `chrome.storage.sync` is a Chrome feature that may sync these values
  across browsers where you are signed in to the same Chrome profile. This sync is
  performed by **Google/Chrome**, not by us. We never receive your settings.
- Your **API key** is sent only to the endpoint you configured, as an authorization
  header on your own requests. It is never sent to us.

### 4. Google account access (OAuth)

The extension uses Chrome's built-in identity API (`chrome.identity`) to request a
Google OAuth token for the following scopes:

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.readonly`

These scopes are used **only** to read calendar conflicts and create events on your
behalf. Access tokens are held in memory for the current session and are **not**
persisted by the extension. You can revoke access at any time using the
**Disconnect** button on the Options page, or via your
[Google Account permissions](https://myaccount.google.com/permissions).

## What we do NOT do

- We do **not** collect or store your data on any server we control.
- We do **not** sell, rent, or transfer your data to third parties.
- We do **not** use your data for advertising, profiling, or creditworthiness/lending
  purposes.
- We do **not** run analytics, tracking, or telemetry.
- We do **not** read email content other than the text you explicitly highlight.

## Third-party services

The extension sends data only to the endpoints **you** configure:

- **Your chosen AI provider** (e.g. OpenRouter, DeepSeek, or another
  OpenAI-compatible service), governed by that provider's privacy policy.
- **A local AI server** (e.g. Ollama) if you configure one; in this case the data
  stays on your machine.
- **Google Calendar API**, governed by
  [Google's Privacy Policy](https://policies.google.com/privacy).

## Security

- Extracted text is sanitized (HTML tags stripped, dangerous URL schemes and control
  characters removed) before it is rendered in the extension's interface or written to
  your calendar.
- All network requests to AI providers and Google use HTTPS.
- Your API key and settings stay in Chrome's storage; they are never transmitted to
  the developer.

## Children's privacy

The extension is not directed at children and does not knowingly collect information
from children.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected in the
extension's repository. Continued use after an update constitutes acceptance of the
revised policy.

## Contact

For questions about this policy, contact:

**Tony Liang** — tonyliangfungyuen@gmail.com

Project repository: https://github.com/ltonygh/email-scheduler-with-ai
