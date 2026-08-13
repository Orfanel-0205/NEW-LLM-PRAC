# Jarvis Personal Technical Copilot

Jarvis is a local-first assistant for coding, system architecture, debugging, structured
problem solving, and augmented-reality prototyping. Ollama performs inference on your computer;
the Expo app is the mobile interface.

## What works in this MVP

- Local Ollama chat through a versioned FastAPI backend
- Specialized coding, architecture, UX-flow, debugging, problem-solving, and AR prompts
- SQLite conversation memory, isolated by session
- Health, chat, history, and clear-session endpoints
- Expo Go TypeScript app with status feedback and mode selection
- Push-to-talk with offline Whisper transcription
- Custom local Danny/Piper voice with personalized startup greeting
- Front/rear camera technical analysis using Qwen3-VL
- Draggable holographic architecture and UX workflow cards
- Optional bearer-token protection

The model cannot execute terminal commands. This is intentional until command allowlists,
user confirmation, timeouts, and audit logging are implemented.

## 1. Install prerequisites

Install:

- Python 3.11 or newer
- [Ollama](https://ollama.com/download)
- Node.js 20 or newer
- Expo Go on the phone

Then download a model:

```powershell
ollama pull llama3.2
ollama pull qwen3-vl:2b
```

For visual scene analysis later, also consider a vision-capable Ollama model. The current AR
screen is a camera overlay and does not send images to the model.

## 2. Start the backend

From the repository root:

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:8000/docs` to inspect and try the API. Verify that
`http://localhost:8000/api/health` reports `"ollama": true`.

To test from a phone, allow Python or port 8000 through Windows Firewall only for private
networks. Do not expose this development server directly to the public internet.

## 3. Find the computer's local IP

```powershell
ipconfig
```

Use the IPv4 address of the active Wi-Fi adapter, for example `192.168.1.10`. The phone and
computer must be on the same Wi-Fi network. `localhost` on the phone means the phone itself,
not the computer.

## 4. Configure and start the mobile app

Copy `Mobile/.env.example` to `Mobile/.env.local`, then replace its sample address:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Start Expo:

```powershell
cd Mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. If LAN discovery fails, press `t` in Expo CLI to use a tunnel
for the JavaScript bundle; the Jarvis API still needs to be reachable from the phone.

## Optional API token

On a trusted private network you can initially leave the token empty. To enable it, set the
same long random value in both environments:

```text
# Backend environment
JARVIS_API_TOKEN=replace-with-a-long-random-value

# Mobile/.env.local
EXPO_PUBLIC_API_TOKEN=replace-with-the-same-value
```

An `EXPO_PUBLIC_` value is visible in the app bundle. This token is only a basic private-LAN
guard, not production authentication. A remotely hosted version needs HTTPS and proper user
authentication.

## Verification

```powershell
cd Backend
python -m pip install pytest
python -m pytest -q

cd ..\Mobile
npm run typecheck
```

## Roadmap

1. **Workspace context:** explicitly select a project and retrieve relevant files for the model.
2. **Safe tools:** read-only file search first; later confirmed commands in a workspace sandbox.
3. **RAG:** index personal documentation and architecture decisions with local embeddings.
4. **Voice input:** record with Expo and transcribe locally through Whisper.
5. **Vision:** send captured images to a vision-capable Ollama model for visual debugging.
6. **Real AR:** migrate from Expo Go to an Expo development build and add plane detection,
   spatial anchors, object placement, and persistent scenes with a maintained native AR stack.
7. **Remote access:** use a private VPN such as Tailscale or deploy an authenticated HTTPS API.

## Project layout

```text
Backend/                 Python API and local intelligence
  api/routes.py          Mobile-facing endpoints
  core/ollama_client.py  Ollama HTTP adapter
  core/orchestrator.py   Prompt + memory coordination
  core/memory.py         SQLite conversations
  core/prompt_manager.py Specialist behavior
Mobile/                  Expo Go React Native client
  App.tsx                Chat and AR prototype UI
  src/api.ts             Typed backend client
```
