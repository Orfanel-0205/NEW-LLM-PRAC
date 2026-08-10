import requests

def chat_with_ollama(prompt: str) -> str:
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": "llama3.2",
        "messages": [
            {
                "role": "system",
                "content": "You are Jarvis, a helpful and concise AI assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": False
    }

    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data["message"]["content"]

if __name__ == "__main__":
    while True:
        user_input = input("You: ")
        if user_input.lower() in {"exit", "quit"}:
            break
        reply = chat_with_ollama(user_input)
        print("Jarvis:", reply)