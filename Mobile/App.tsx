import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCameraPermissions } from 'expo-camera';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArchitectureDiagram } from './src/ArchitectureDiagram';
import { HolographicAR } from './src/HolographicAR';
import { API_URL, ArchitectureBlueprint, ChatMessage, clearSession, generateArchitecture, getHealth, JarvisMode, sendChat, speechSource, transcribeAudio } from './src/api';

const MODES: { id: JarvisMode; label: string; hint: string }[] = [
  { id: 'coding', label: 'Code', hint: 'Build, explain, or review code…' },
  { id: 'architecture', label: 'Architect', hint: 'Design a system or evaluate tradeoffs…' },
  { id: 'debugging', label: 'Debug', hint: 'Paste an error, symptom, or log…' },
  { id: 'problem_solving', label: 'Solve', hint: 'Describe the objective and constraints…' },
  { id: 'ar', label: 'AR Lab', hint: 'Ask about this AR scene or implementation…' },
  { id: 'ux', label: 'UX Flow', hint: 'Describe screens, actors, decisions, and recovery paths…' },
];
const SESSION_KEY = 'jarvis.session';

export default function App() {
  const [mode, setMode] = useState<JarvisMode>('coding');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState<'checking' | 'ready' | 'ollama-offline' | 'offline'>('checking');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [blueprint, setBlueprint] = useState<ArchitectureBlueprint>();
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const voicePlayer = useAudioPlayer(null);
  const greeted = useRef(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  const speak = useCallback((text: string) => {
    voicePlayer.pause();
    voicePlayer.replace(speechSource(text));
    voicePlayer.play();
  }, [voicePlayer]);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((value) => value && setSessionId(value));
    checkServer();
  }, []);

  async function checkServer() {
    setServer('checking');
    try {
      const health = await getHealth();
      setServer(health.ollama ? 'ready' : 'ollama-offline');
      if (health.ollama && !greeted.current) {
        greeted.current = true;
        speak('Okaerinasaimase, Goshujin-sama. Jarvis is online.');
      }
    } catch {
      setServer('offline');
    }
  }

  async function submitText(rawContent: string) {
    const content = rawContent.trim();
    if (!content || busy) return;
    const user: ChatMessage = { id: `${Date.now()}-u`, role: 'user', content };
    setMessages((current) => [...current, user]);
    setInput('');
    setBusy(true);
    try {
      const result = await sendChat(content, mode, sessionId);
      setSessionId(result.session_id);
      await AsyncStorage.setItem(SESSION_KEY, result.session_id);
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-a`, role: 'assistant', content: result.reply },
      ]);
      if (autoSpeak) speak(result.reply);
      if (mode === 'architecture' || mode === 'ar' || mode === 'ux') {
        try {
          const structure = await generateArchitecture(content);
          setBlueprint(structure);
          if (mode === 'architecture') setBlueprintOpen(true);
          if (autoSpeak && mode === 'architecture') speak(structure.summary);
        } catch (architectureError) {
          const detail = architectureError instanceof Error ? architectureError.message : 'Blueprint failed';
          setMessages((current) => [...current, { id: `${Date.now()}-arch`, role: 'assistant', content: `Blueprint unavailable: ${detail}` }]);
        }
      }
      setServer('ready');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown network error';
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-e`, role: 'assistant', content: `I could not respond: ${detail}` },
      ]);
      checkServer();
    } finally {
      setBusy(false);
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  async function submit() { await submitText(input); }

  async function toggleRecording() {
    if (recorderState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      setTranscribing(true);
      try {
        const text = await transcribeAudio(uri);
        setInput(text);
        await submitText(text);
      } catch (error) {
        Alert.alert('Voice input failed', error instanceof Error ? error.message : 'Could not transcribe audio');
      } finally {
        setTranscribing(false);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      }
      return;
    }
    voicePlayer.pause();
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) return Alert.alert('Microphone required', 'Allow microphone access to talk to Jarvis.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function startFresh() {
    if (sessionId) await clearSession(sessionId).catch(() => undefined);
    await AsyncStorage.removeItem(SESSION_KEY);
    voicePlayer.pause();
    setSessionId(undefined);
    setMessages([]);
    setBlueprint(undefined);
    setBlueprintOpen(false);
  }

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return Alert.alert('Camera required', 'Allow camera access to use AR Lab.');
    }
    setMode('ar');
    setCameraOpen(true);
  }

  const selected = MODES.find((item) => item.id === mode)!;
  const statusText = {
    checking: 'Checking…', ready: 'Jarvis ready',
    'ollama-offline': 'API ready · Ollama stopped', offline: 'API offline',
  }[server];

  if (cameraOpen) {
    return <HolographicAR
      blueprint={blueprint}
      onClose={() => setCameraOpen(false)}
      onSpeak={speak}
      onVoiceToggle={toggleRecording}
      isListening={recorderState.isRecording}
      isTranscribing={transcribing}
      isResponding={busy}
    />;
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>PERSONAL TECHNICAL COPILOT</Text><Text style={styles.title}>JARVIS</Text></View>
          <Pressable onPress={startFresh} style={styles.smallButton}><Text style={styles.buttonText}>New chat</Text></Pressable>
        </View>
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionChip, autoSpeak && styles.actionChipActive]} onPress={() => { voicePlayer.pause(); setAutoSpeak((value) => !value); }}><Text style={styles.actionText}>{autoSpeak ? 'Voice on' : 'Voice off'}</Text></Pressable>
          {blueprint && <Pressable style={styles.actionChip} onPress={() => setBlueprintOpen((value) => !value)}><Text style={styles.actionText}>{blueprintOpen ? 'Chat' : 'Blueprint'}</Text></Pressable>}
          <Pressable style={styles.actionChip} onPress={openCamera}><Text style={styles.actionText}>AR view</Text></Pressable>
        </View>
        <Pressable onPress={checkServer} style={styles.statusRow}>
          <View style={[styles.dot, server === 'ready' && styles.dotReady]} />
          <Text style={styles.status}>{statusText} · {API_URL.replace('http://', '')}</Text>
        </Pressable>
        <FlatList
          horizontal
          data={MODES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.modes}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { setMode(item.id); if (item.id === 'ar') openCamera(); }}
              style={[styles.mode, mode === item.id && styles.modeActive]}
            ><Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>{item.label}</Text></Pressable>
          )}
        />
        {blueprintOpen && blueprint ? <ArchitectureDiagram blueprint={blueprint} /> : <FlatList
          ref={list}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={messages.length ? styles.chat : styles.emptyChat}
          ListEmptyComponent={<View><Text style={styles.emptyTitle}>What are we building?</Text><Text style={styles.emptyCopy}>Choose a specialist mode, share the context, and Jarvis will help you reason through it.</Text></View>}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => item.role === 'assistant' && speak(item.content)}
              style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.jarvisBubble]}
            >
              <Text style={styles.role}>{item.role === 'user' ? 'YOU' : 'JARVIS · hold to speak'}</Text>
              <Text style={styles.message}>{item.content}</Text>
            </Pressable>
          )}
        />}
        {(busy || transcribing) && <View style={styles.thinking}><ActivityIndicator color="#6ee7b7" /><Text style={styles.thinkingText}>{transcribing ? 'Transcribing locally…' : 'Reasoning locally…'}</Text></View>}
        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={selected.hint}
            placeholderTextColor="#64748b"
            multiline
            style={styles.input}
            onSubmitEditing={submit}
          />
          <Pressable onPress={toggleRecording} disabled={busy || transcribing} style={[styles.mic, recorderState.isRecording && styles.micRecording]}><Text style={styles.micText}>{recorderState.isRecording ? '■' : '●'}</Text></Pressable>
          <Pressable onPress={submit} disabled={busy || !input.trim()} style={[styles.send, (!input.trim() || busy) && styles.sendDisabled]}><Text style={styles.sendText}>↑</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { flex: 1, backgroundColor: '#07111f' },
  header: { paddingHorizontal: 20, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#64748b', fontSize: 10, letterSpacing: 2 }, title: { color: '#f8fafc', fontSize: 30, fontWeight: '800', letterSpacing: 5 },
  smallButton: { backgroundColor: 'rgba(15,23,42,.86)', borderColor: '#334155', borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 }, buttonText: { color: '#cbd5e1', fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 21, marginTop: 6 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 7 }, dotReady: { backgroundColor: '#34d399' }, status: { color: '#64748b', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 12 }, actionChip: { borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#0b1728' }, actionChipActive: { borderColor: '#34d399' }, actionText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  modes: { paddingHorizontal: 16, paddingVertical: 15, gap: 8 }, mode: { height: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#1e293b', backgroundColor: '#0b1728' }, modeActive: { borderColor: '#34d399', backgroundColor: '#0c2c2b' }, modeText: { color: '#94a3b8', fontWeight: '600' }, modeTextActive: { color: '#6ee7b7' },
  chat: { padding: 16, gap: 12 }, emptyChat: { flexGrow: 1, justifyContent: 'center', padding: 38 }, emptyTitle: { color: '#e2e8f0', fontSize: 25, fontWeight: '700', marginBottom: 10 }, emptyCopy: { color: '#94a3b8', fontSize: 16, lineHeight: 24 },
  bubble: { maxWidth: '92%', padding: 15, borderRadius: 16, borderWidth: 1 }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#102a43', borderColor: '#1e4970' }, jarvisBubble: { alignSelf: 'flex-start', backgroundColor: '#0d1b2a', borderColor: '#1e293b' }, role: { color: '#6ee7b7', fontSize: 9, letterSpacing: 1.3, fontWeight: '700', marginBottom: 7 }, message: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  thinking: { flexDirection: 'row', gap: 9, paddingHorizontal: 20, paddingVertical: 6 }, thinkingText: { color: '#94a3b8' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, margin: 14, padding: 8, borderRadius: 18, backgroundColor: '#0d1b2a', borderWidth: 1, borderColor: '#1e293b' }, input: { flex: 1, color: '#f8fafc', minHeight: 42, maxHeight: 130, paddingHorizontal: 9, paddingVertical: 10, fontSize: 15 }, send: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#34d399', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { backgroundColor: '#1e293b' }, sendText: { color: '#052e2b', fontSize: 24, fontWeight: '800' },
  mic: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#475569' }, micRecording: { backgroundColor: '#7f1d1d', borderColor: '#f87171' }, micText: { color: '#f8fafc', fontSize: 16 },
  cameraPage: { flex: 1, backgroundColor: '#000' }, cameraOverlay: { flex: 1, justifyContent: 'space-between' }, cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 18 }, cameraTitle: { color: '#6ee7b7', fontWeight: '800', letterSpacing: 2, backgroundColor: 'rgba(0,0,0,.5)', padding: 9 }, reticle: { position: 'absolute', left: '50%', top: '50%', width: 100, height: 100, marginLeft: -50, marginTop: -50, borderColor: '#6ee7b7', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, reticleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6ee7b7' }, cameraHelp: { color: '#e2e8f0', lineHeight: 20, backgroundColor: 'rgba(0,0,0,.7)', margin: 18, padding: 14, borderRadius: 10 },
  arStructure: { margin: 20, marginTop: 'auto', marginBottom: 30, maxWidth: 320, backgroundColor: 'rgba(3,12,24,.82)', borderRadius: 16, borderWidth: 1, borderColor: '#34d399', padding: 14 }, arTitle: { color: '#f8fafc', fontWeight: '800', fontSize: 17, marginBottom: 10 }, arNode: { alignSelf: 'flex-start', backgroundColor: 'rgba(13,27,42,.9)', borderColor: '#34d399', borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7, marginVertical: 3 }, arNodeText: { color: '#f8fafc', fontWeight: '700' }, arNodeKind: { color: '#6ee7b7', fontSize: 9, textTransform: 'uppercase' }, narrateButton: { marginTop: 10, backgroundColor: '#163b39', padding: 10, borderRadius: 8, alignItems: 'center' },
});
