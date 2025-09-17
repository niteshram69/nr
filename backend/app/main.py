import os
import time
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass
try:
    from openai import OpenAI
except Exception:  # pragma: no covers
    OpenAI = None  # type: ignore


app = FastAPI(title="Livekit Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


class TokenRequest(BaseModel):
    roomName: str
    username: str


@app.post("/token")
def create_token(payload: TokenRequest) -> Dict[str, Any]:
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    livekit_host = os.getenv("LIVEKIT_HOST", "wss://your-livekit-server")

    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    now = int(time.time())
    claims = {
        "iss": api_key,
        "exp": now + 15 * 60,
        "nbf": now - 5,
        "sub": payload.username,
        "video": {
            "room": payload.roomName,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
    }

    token = jwt.encode(claims, api_secret, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return {"url": livekit_host, "token": token}


# --- Simple in-memory store as a placeholder for mem0/RAG integration ---
_user_memory: Dict[str, List[Dict[str, str]]] = {}


class ChatRequest(BaseModel):
    username: str
    message: str


class ChatResponse(BaseModel):
    reply: str


def _generate_ai_reply(username: str, message: str, history: List[Dict[str, str]]) -> str:
    # Prefer OpenRouter if configured, otherwise fall back to OpenAI
    use_openrouter = bool(os.getenv("OPENROUTER_API_KEY"))
    openai_key = os.getenv("OPENAI_API_KEY")

    if OpenAI is None or (not use_openrouter and not openai_key):
        return (
            "[AI] OpenAI/OpenRouter not configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY. "
            "Echo: " + message
        )

    system_prompt = (
        "You are a helpful, empathetic AI chat assistant. You can recall a user's past "
        "context from provided memory entries to personalize your response. Keep replies concise."
    )

    if use_openrouter:
        client = OpenAI(
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
        )
        model_name = os.getenv("OPENROUTER_MODEL", "openrouter/auto")
    else:
        client = OpenAI(api_key=openai_key)
        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    messages = [
        {"role": "system", "content": system_prompt},
    ]
    if history:
        memory_lines = [f"{h['role']}: {h['content']}" for h in history[-10:]]
        messages.append({
            "role": "system",
            "content": "Relevant memory/context for user '" + username + "':\n" + "\n".join(memory_lines),
        })
    messages.append({"role": "user", "content": message})

    try:
        completion = client.chat.completions.create(
            model=model_name,
            messages=messages,  # type: ignore[arg-type]
            temperature=0.6,
            max_tokens=300,
        )
        return completion.choices[0].message.content or "(no response)"
    except Exception as e:  # pragma: no cover
        return f"[AI Error] {e}"


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest) -> ChatResponse:
    username = req.username.strip()
    message = req.message.strip()
    if not username or not message:
        raise HTTPException(status_code=400, detail="username and message are required")

    history = _user_memory.get(username, [])
    history.append({"role": "user", "content": message})

    reply = _generate_ai_reply(username, message, history)
    history.append({"role": "assistant", "content": reply})
    _user_memory[username] = history[-50:]

    return ChatResponse(reply=reply)


class MemoryUpsertRequest(BaseModel):
    username: str
    entries: List[Dict[str, str]]  # [{role, content}]


@app.get("/memory/{username}")
def get_memory(username: str) -> Dict[str, Any]:
    return {"username": username, "entries": _user_memory.get(username, [])}


@app.post("/memory")
def upsert_memory(req: MemoryUpsertRequest) -> Dict[str, Any]:
    existing = _user_memory.get(req.username, [])
    existing.extend(req.entries)
    _user_memory[req.username] = existing[-200:]
    return {"ok": True, "count": len(_user_memory[req.username])}


class HandoffRequest(BaseModel):
    from_user: str
    to_agent: str


@app.post("/handoff")
def handoff_context(req: HandoffRequest) -> Dict[str, Any]:
    context = _user_memory.get(req.from_user, [])
    # In a real system, publish this context to another agent via broker
    return {"ok": True, "to": req.to_agent, "context_size": len(context)}


class STTRequest(BaseModel):
    audio_url: str


@app.post("/stt")
def speech_to_text(_: STTRequest) -> Dict[str, Any]:
    return {"text": "[STT stub]"}


class TTSRequest(BaseModel):
    text: str


@app.post("/tts")
def text_to_speech(_: TTSRequest) -> Dict[str, Any]:
    return {"audio_url": "[TTS stub]"}


