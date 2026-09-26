EyeCare AI - Bilingual RAG + Voice Assistant Patch
==================================================

WHAT THIS PATCH FIXES
---------------------
The existing frontend already called /api/ai-assistant/*, but the backend did
not implement those routes. The existing widget also explicitly said that RAG
was not connected. This patch adds the missing backend contract and replaces
that placeholder behavior with real retrieval-grounded English/Urdu answers.

WHAT IS INCLUDED
----------------
1. Backend RAG router and persistence
   - /api/ai-assistant/health
   - /api/ai-assistant/context-options
   - /api/ai-assistant/authorized-patients
   - /api/ai-assistant/sessions
   - /api/ai-assistant/sessions/{id}/messages
   - /api/ai-assistant/transcribe
   - MongoDB collections: ai_assistant_sessions, ai_assistant_messages

2. Bilingual retrieval
   - English or Urdu answers only.
   - Curated DR/eye-health knowledge with source links.
   - Local lexical retrieval works even with no LLM API key.
   - Optional OpenAI-compatible LLM can rewrite only retrieved context.
   - Out-of-scope questions get a scope message instead of invented answers.

3. Authorized patient context
   - Patient: own saved EyeCare AI data.
   - Doctor/Hospital: only patient context already authorized by app data.
   - Latest screening, HbA1c/glucose, active medicines and recent adherence can
     be included in local personalized answers.
   - Private context is NOT sent to an external LLM by default.

4. Voice question input
   - Expo Web (Chrome/Edge): browser speech recognition, English en-US or Urdu ur-PK.
   - Android/iOS: expo-audio records the question and backend STT transcribes it.
   - Voice questions are automatically sent to RAG after transcription.

5. Spoken answers
   - expo-speech reads Assistant answers aloud.
   - English uses en-US preference.
   - Urdu uses ur-PK / the closest Urdu device voice when available.
   - Listen / Stop controls are available on each Assistant answer.

6. UX fixes
   - English / Urdu answer-language toggle.
   - Urdu RTL message rendering.
   - Source links shown below grounded answers.
   - Existing mojibake text in the Assistant widget is removed.
   - Existing AppShell integration is reused; no new screen/module is required.

INSTALLATION
------------
Extract the ZIP directly into:

F:\Fyp retinopathy\

Choose "Replace files in destination".

Then install the two Expo SDK 54 compatible packages ONCE:

cd "F:\Fyp retinopathy\frontend"
npx expo install expo-audio expo-speech

No new backend pip package is required; requests/pymongo/FastAPI already exist in
this project.

OPTIONAL: MORE NATURAL LLM RAG ANSWERS
---------------------------------------
Typed RAG works without any new API key. If you want an external OpenAI-compatible
model to phrase the retrieved answer more naturally, copy the relevant values from:

backend/.env.rag.example

into your existing backend/.env, for example:

RAG_LLM_API_KEY=YOUR_KEY
RAG_LLM_BASE_URL=https://api.openai.com/v1
RAG_LLM_MODEL=YOUR_CHAT_MODEL
RAG_SEND_PRIVATE_CONTEXT=false

If these three LLM settings are absent or the provider fails, the backend safely
falls back to local retrieval instead of breaking the Assistant.

OPTIONAL: NATIVE ANDROID/iOS VOICE TRANSCRIPTION
-------------------------------------------------
Web Chrome/Edge voice input normally uses browser recognition. For recorded voice
questions in Android/iOS, configure:

RAG_STT_API_KEY=YOUR_TRANSCRIPTION_KEY
RAG_STT_URL=https://api.openai.com/v1/audio/transcriptions
RAG_STT_MODEL=gpt-4o-mini-transcribe

Do not place provider API keys in frontend/.env.local. Keep them in backend/.env or
in Railway/environment variables.

RUN ON YOUR CURRENT PORTS
-------------------------
This patch does NOT change the local API-port fix you already applied.

Terminal 1 - Backend (8001):

cd "F:\Fyp retinopathy\backend"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\run-local-8001.ps1

Terminal 2 - Frontend (8081):

cd "F:\Fyp retinopathy\frontend"
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\run-web-8081.ps1

Or manually:

Backend:
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8001

Frontend:
npx expo start --clear --web --port 8081

QUICK BACKEND CHECK
-------------------
Open:

http://127.0.0.1:8001/api/ai-assistant/health

Expected shape:
{
  "status": "ok",
  "rag": true,
  "languages": ["en", "ur"],
  "answerMode": "rag_extract" OR "rag_llm",
  "nativeVoiceTranscriptionConfigured": false/true
}

FUNCTIONAL TEST ORDER
---------------------
1. Log in and open the existing floating AI Assistant.
2. English typed question:
   What is diabetic retinopathy?
   -> English grounded answer + source.
3. Switch to Urdu and type:
   ذیابیطس ریٹینوپیتھی کیا ہے؟
   -> Urdu RTL grounded answer + source.
4. Ask an unrelated question such as a cricket result.
   -> Assistant should say it only answers its eye-health/EyeCare scope.
5. Ask a personal question as a Patient:
   What is my latest screening?
   -> Uses the logged-in patient's authorized saved context if available.
6. Press Listen on an answer.
   -> English/Urdu answer is read aloud by the device/browser voice.
7. Web Chrome/Edge:
   - select English or Urdu
   - press microphone
   - speak
   - the transcript is automatically sent to RAG
   - the returned answer is automatically spoken.
8. Android/iOS (with RAG_STT_API_KEY configured):
   - press microphone to record
   - press again to stop
   - recording is transcribed -> sent to RAG -> answer is spoken.

IMPORTANT LIMITATIONS / SAFETY
------------------------------
- This remains a screening/education assistant, not a diagnostic replacement.
- It deliberately refuses/redirects questions outside the configured eye-health scope.
- Urdu TTS depends on an Urdu voice being available on the device/browser; the code
  prefers ur-PK and then any installed Urdu voice.
- Web SpeechRecognition availability depends on the browser. Chrome/Edge are the
  intended web test browsers.
