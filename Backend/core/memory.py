conversation_history = []

def chat_with_ollama(prompt: str) -> str:
    global conversation_history

    conversation_history.append({"role": "user", "content": prompt})

    payload = {
        "model": "llama3.2",
        "messages": [
            {
                "role": "system",
                "content": "You are Jarvis, a helpful assistant."
            },
            *conversation_history
        ],
        "stream": False
    }

    response = requests.post("http://localhost:11434/api/chat", json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    reply = data["message"]["content"]

    conversation_history.append({"role": "assistant", "content": reply})
    return reply