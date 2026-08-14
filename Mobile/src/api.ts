export type JarvisMode = 'coding' | 'architecture' | 'debugging' | 'problem_solving' | 'ar' | 'ux';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ArchitectureNode = {
  id: string;
  label: string;
  kind: 'client' | 'service' | 'data' | 'external' | 'actor' | 'screen' | 'action' | 'decision';
  description: string;
};

export type ArchitectureEdge = { source: string; target: string; label: string };

export type ArchitectureBlueprint = {
  title: string;
  summary: string;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
};

export type VisionDetection = {
  id: string;
  label: string;
  box: [number, number, number, number];
  observation: string;
  suggestion: string;
};

export type VisionResult = {
  scene: string;
  spoken_update: string;
  detections: VisionDetection[];
};

type ChatResponse = { reply: string; session_id: string; mode: JarvisMode };
type HealthResponse = { status: string; ollama: boolean; model: string; modes: JarvisMode[] };

const rawUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:8000';
export const API_URL = rawUrl.replace(/\/$/, '');
const token = process.env.EXPO_PUBLIC_API_TOKEN;

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail ?? `Request failed (${response.status})`);
  return body as T;
}

export async function getHealth(): Promise<HealthResponse> {
  return parse(await fetch(`${API_URL}/api/health`));
}

export async function sendChat(
  message: string,
  mode: JarvisMode,
  sessionId?: string,
): Promise<ChatResponse> {
  return parse(
    await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ message, mode, session_id: sessionId }),
    }),
  );
}

export async function clearSession(sessionId: string): Promise<void> {
  await parse(
    await fetch(`${API_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: headers(),
    }),
  );
}

export async function transcribeAudio(uri: string): Promise<string> {
  const form = new FormData();
  form.append('audio', { uri, name: 'voice.m4a', type: 'audio/mp4' } as unknown as Blob);
  const response = await fetch(`${API_URL}/api/transcribe`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const result = await parse<{ text: string }>(response);
  return result.text;
}

export async function generateArchitecture(request: string): Promise<ArchitectureBlueprint> {
  return parse(
    await fetch(`${API_URL}/api/architecture`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ request }),
    }),
  );
}

export function speechSource(text: string): { uri: string; headers?: Record<string, string> } {
  return {
    uri: `${API_URL}/api/speech?text=${encodeURIComponent(text.slice(0, 1200))}`,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  };
}

export async function analyzeVision(uri: string, question: string): Promise<VisionResult> {
  const form = new FormData();
  form.append('image', { uri, name: 'jarvis-scene.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('question', question);
  const response = await fetch(`${API_URL}/api/vision/analyze`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  return parse<VisionResult>(response);
}
