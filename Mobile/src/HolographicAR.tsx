import { CameraType, CameraView } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, DimensionValue, PanResponder, Pressable, SafeAreaView, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { analyzeVision, ArchitectureBlueprint, VisionDetection, VisionResult } from './api';

type Props = {
  blueprint?: ArchitectureBlueprint;
  onClose: () => void;
  onSpeak: (text: string) => void;
  onFlowRearranged: (nodeId: string, positions: Record<string, FlowPoint>) => void | Promise<void>;
  onVoiceToggle: () => void | Promise<void>;
  isListening: boolean;
  isTranscribing: boolean;
  isResponding: boolean;
};

type FlowPoint = { x: number; y: number };

const VISUAL_FOCUS = 'Prioritize visible hands and clearly recognizable coarse gestures, then identify technical objects, screens, errors, controls, and useful next actions. Never infer personal traits.';

export function HolographicAR({
  blueprint, onClose, onSpeak, onFlowRearranged, onVoiceToggle, isListening, isTranscribing, isResponding,
}: Props) {
  const { width, height } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const scanning = useRef(false);
  const voiceBusyRef = useRef(false);
  const lastAnnouncement = useRef({ text: '', time: 0 });
  const lastErrorAnnouncement = useRef(0);
  const flowPositionsRef = useRef<Record<string, FlowPoint>>({});
  const [facing, setFacing] = useState<CameraType>('back');
  const [pictureSize, setPictureSize] = useState<string>();
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<VisionResult>();
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [flowPositions, setFlowPositions] = useState<Record<string, FlowPoint>>({});
  const ownerAge = process.env.EXPO_PUBLIC_OWNER_AGE?.trim();
  const voiceBusy = isListening || isTranscribing || isResponding;
  voiceBusyRef.current = voiceBusy;

  useEffect(() => {
    if (!blueprint) {
      flowPositionsRef.current = {};
      return setFlowPositions({});
    }
    const next: Record<string, FlowPoint> = {};
    blueprint.nodes.slice(0, 6).forEach((node, index) => {
      next[node.id] = { x: index % 2 === 0 ? 14 : Math.max(14, width - 154), y: 145 + Math.floor(index / 2) * 92 };
    });
    flowPositionsRef.current = next;
    setFlowPositions(next);
  }, [blueprint, width]);

  function moveFlowNode(nodeId: string, point: FlowPoint) {
    const next = { ...flowPositionsRef.current, [nodeId]: point };
    flowPositionsRef.current = next;
    setFlowPositions(next);
    void onFlowRearranged(nodeId, next);
  }

  async function cameraReady() {
    try {
      const sizes = await camera.current?.getAvailablePictureSizesAsync();
      const ranked = (sizes ?? []).map((size) => {
        const [w, h] = size.split('x').map(Number);
        return { size, pixels: Number.isFinite(w * h) ? w * h : Number.MAX_SAFE_INTEGER };
      }).sort((a, b) => a.pixels - b.pixels);
      const practical = ranked.filter((item) => item.pixels >= 640 * 480 && item.pixels <= 1280 * 960).pop();
      setPictureSize((practical ?? ranked[0])?.size);
    } finally {
      setReady(true);
    }
  }

  const scan = useCallback(async () => {
    if (scanning.current || !ready || !camera.current || voiceBusy) return;
    scanning.current = true;
    setBusy(true);
    setElapsed(0);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.48, skipProcessing: false });
      if (!photo?.uri) throw new Error('Camera did not return an image.');
      const next = await analyzeVision(photo.uri, VISUAL_FOCUS);
      setResult(next);
      const spoken = next.spoken_update.trim();
      const now = Date.now();
      if (!voiceBusyRef.current && spoken && (spoken !== lastAnnouncement.current.text || now - lastAnnouncement.current.time > 45000)) {
        lastAnnouncement.current = { text: spoken, time: now };
        onSpeak(spoken);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Vision link interrupted.';
      setResult({ scene: detail, spoken_update: '', detections: [] });
      const now = Date.now();
      if (now - lastErrorAnnouncement.current > 30000) {
        lastErrorAnnouncement.current = now;
        onSpeak('Goshujin-sama, the visual scan was interrupted. I will retry automatically.');
      }
    } finally {
      scanning.current = false;
      setBusy(false);
    }
  }, [onSpeak, ready, voiceBusy]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    if (!live || !ready || voiceBusy) return;
    scan();
    const timer = setInterval(scan, 20000);
    return () => clearInterval(timer);
  }, [live, ready, scan, voiceBusy]);

  const seesPerson = result?.detections.some((item) => item.label.toLowerCase() === 'person');
  const voiceLabel = isListening ? 'STOP & ASK' : isTranscribing ? 'TRANSCRIBING' : isResponding ? 'RESPONDING' : 'TALK TO JARVIS';
  const sceneText = isListening
    ? 'Listening to you… Tap again when finished.'
    : isTranscribing
      ? 'Understanding your request…'
      : isResponding
        ? 'Jarvis is preparing a spoken response…'
        : busy
          ? `Analyzing visual field… ${elapsed}s`
          : result?.scene ?? 'Camera ready. Autonomous visual scan will begin.';

  return (
    <View style={styles.page}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} pictureSize={pictureSize} animateShutter={false} onCameraReady={cameraReady} />
      <View pointerEvents="none" style={styles.grid} />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <View><Text style={styles.kicker}>JARVIS AUTONOMOUS VISION</Text><Text style={styles.title}>{live ? 'LIVE SCAN ACTIVE' : 'SCAN PAUSED'}</Text></View>
          <View style={styles.headerActions}>
            <Pressable style={styles.control} onPress={() => { setReady(false); setPictureSize(undefined); setFacing((value) => value === 'back' ? 'front' : 'back'); }}><Text style={styles.controlText}>FLIP</Text></Pressable>
            <Pressable style={styles.control} onPress={onClose}><Text style={styles.controlText}>CLOSE</Text></Pressable>
          </View>
        </View>

        <View style={styles.capability}><Text style={styles.capabilityText}>HAND VISION · AI SNAPSHOT MODE</Text></View>
        <View style={styles.scanLine} pointerEvents="none" />
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {result?.detections.map((detection, index) => <DetectionCallout key={`${detection.id}-${index}`} detection={detection} />)}
          {seesPerson && facing === 'front' ? <View style={styles.ownerBadge}>
            <Text style={styles.ownerTitle}>OWNER PROFILE</Text><Text style={styles.ownerName}>GOSHUJIN-SAMA</Text>
            <Text style={styles.ownerMeta}>AGE · {ownerAge || 'NOT CONFIGURED'}</Text><Text style={styles.ownerMeta}>STATUS · PRESENT</Text>
          </View> : null}
          {blueprint ? <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
            {blueprint.edges.map((edge, index) => {
              const from = flowPositions[edge.source]; const to = flowPositions[edge.target];
              if (!from || !to) return null;
              return <Line key={`${edge.source}-${edge.target}-${index}`} x1={from.x + 66} y1={from.y + 30} x2={to.x + 66} y2={to.y + 30} stroke="#a78bfa" strokeWidth="2" strokeDasharray="6 4" />;
            })}
          </Svg> : null}
          {blueprint?.nodes.slice(0, 6).map((node, index) => {
            const point = flowPositions[node.id];
            return point ? <MovableWorkflowCard key={node.id} index={index} node={node} position={point} bounds={{ width, height }} onMove={moveFlowNode} /> : null;
          })}
        </View>

        <View style={styles.console}>
          <View style={styles.sceneRow}>{busy || isTranscribing || isResponding ? <ActivityIndicator color="#22d3ee" /> : <View style={[styles.liveDot, isListening && styles.listeningDot]} />}<Text numberOfLines={2} style={styles.scene}>{sceneText}</Text></View>
          <View style={styles.actionRow}>
            <Pressable disabled={isTranscribing || isResponding} style={[styles.voiceButton, isListening && styles.voiceButtonActive]} onPress={onVoiceToggle}><Text style={styles.voiceText}>{voiceLabel}</Text></Pressable>
            <Pressable style={[styles.pauseButton, !live && styles.resumeButton]} onPress={() => setLive((value) => !value)}><Text style={styles.pauseText}>{live ? 'PAUSE SCAN' : 'RESUME SCAN'}</Text></Pressable>
          </View>
          <Text style={styles.disclaimer}>Drag a flow node to request a critical spoken review. AI snapshots can see hands; true hover/pinch control requires the native landmark build.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function MovableWorkflowCard({ index, node, position, bounds, onMove }: {
  index: number;
  node: ArchitectureBlueprint['nodes'][number];
  position: FlowPoint;
  bounds: { width: number; height: number };
  onMove: (nodeId: string, point: FlowPoint) => void;
}) {
  const [point, setPoint] = useState(position);
  const pointRef = useRef(position);
  const start = useRef(position);
  const boundsRef = useRef(bounds);
  const onMoveRef = useRef(onMove);
  boundsRef.current = bounds;
  onMoveRef.current = onMove;
  useEffect(() => { pointRef.current = position; setPoint(position); }, [position]);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { start.current = pointRef.current; },
    onPanResponderMove: (_, gesture) => {
      const next = {
        x: Math.max(8, Math.min(boundsRef.current.width - 140, start.current.x + gesture.dx)),
        y: Math.max(110, Math.min(boundsRef.current.height - 190, start.current.y + gesture.dy)),
      };
      pointRef.current = next;
      setPoint(next);
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) onMoveRef.current(node.id, pointRef.current);
    },
    onPanResponderTerminate: () => onMoveRef.current(node.id, pointRef.current),
  })).current;
  return <View {...responder.panHandlers} style={[styles.workflowCard, { left: point.x, top: point.y }]}>
    <Text style={styles.workflowIndex}>0{index + 1} · DRAG</Text><Text style={styles.workflowLabel}>{node.label}</Text><Text style={styles.workflowKind}>{node.kind}</Text>
  </View>;
}

function DetectionCallout({ detection }: { detection: VisionDetection }) {
  const [x1, y1, x2, y2] = detection.box;
  const position = {
    left: `${x1 / 10}%` as DimensionValue, top: `${y1 / 10}%` as DimensionValue,
    width: `${Math.max(8, (x2 - x1) / 10)}%` as DimensionValue,
    height: `${Math.max(6, (y2 - y1) / 10)}%` as DimensionValue,
  };
  return <View style={[styles.detectBox, position]}>
    <View style={styles.cornerTopLeft} /><View style={styles.cornerBottomRight} />
    <View style={styles.callout}><Text style={styles.detectLabel}>{detection.label.toUpperCase()}</Text><Text numberOfLines={2} style={styles.detectObservation}>{detection.observation}</Text>{detection.suggestion ? <Text numberOfLines={2} style={styles.detectSuggestion}>SUGGEST · {detection.suggestion}</Text> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' }, overlay: { flex: 1 }, grid: { ...StyleSheet.absoluteFillObject, opacity: 0.13, borderWidth: 1, borderColor: '#22d3ee' },
  header: { margin: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(2,12,27,.78)', borderLeftWidth: 3, borderLeftColor: '#22d3ee', padding: 11 },
  kicker: { color: '#67e8f9', fontSize: 8, letterSpacing: 2.2 }, title: { color: '#ecfeff', fontSize: 17, fontWeight: '900', letterSpacing: 1.4 }, headerActions: { flexDirection: 'row', gap: 7 },
  control: { borderWidth: 1, borderColor: '#22d3ee', padding: 8, borderRadius: 6, backgroundColor: 'rgba(8,47,73,.8)' }, controlText: { color: '#cffafe', fontSize: 9, fontWeight: '800' },
  capability: { alignSelf: 'flex-start', marginLeft: 14, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(2,12,27,.76)', borderWidth: 1, borderColor: '#0e7490' }, capabilityText: { color: '#67e8f9', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  scanLine: { position: 'absolute', top: '43%', left: 0, right: 0, height: 1, backgroundColor: '#22d3ee', shadowColor: '#22d3ee', shadowOpacity: 1, shadowRadius: 10 },
  detectBox: { position: 'absolute', borderWidth: 1.5, borderColor: '#22d3ee', backgroundColor: 'rgba(8,145,178,.06)' }, cornerTopLeft: { position: 'absolute', left: -2, top: -2, width: 18, height: 18, borderLeftWidth: 4, borderTopWidth: 4, borderColor: '#a5f3fc' }, cornerBottomRight: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRightWidth: 4, borderBottomWidth: 4, borderColor: '#a5f3fc' },
  callout: { position: 'absolute', left: 8, top: -4, minWidth: 145, maxWidth: 225, transform: [{ translateY: -58 }], padding: 7, borderLeftWidth: 2, borderLeftColor: '#22d3ee', backgroundColor: 'rgba(2,20,36,.88)' }, detectLabel: { color: '#ecfeff', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, detectObservation: { color: '#a5f3fc', fontSize: 9, marginTop: 2 }, detectSuggestion: { color: '#bef264', fontSize: 8, marginTop: 3 },
  ownerBadge: { position: 'absolute', left: 15, top: 125, padding: 10, borderWidth: 1, borderColor: '#f472b6', backgroundColor: 'rgba(35,8,35,.82)' }, ownerTitle: { color: '#f9a8d4', fontSize: 8, letterSpacing: 2 }, ownerName: { color: '#fdf2f8', fontSize: 15, fontWeight: '900' }, ownerMeta: { color: '#fbcfe8', fontSize: 9, marginTop: 2 },
  workflowCard: { position: 'absolute', width: 132, minHeight: 60, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#a78bfa', backgroundColor: 'rgba(30,18,64,.9)' }, workflowIndex: { color: '#c4b5fd', fontSize: 8 }, workflowLabel: { color: '#f5f3ff', fontSize: 11, fontWeight: '800' }, workflowKind: { color: '#a78bfa', fontSize: 8, textTransform: 'uppercase' },
  console: { marginTop: 'auto', margin: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#22d3ee', backgroundColor: 'rgba(2,12,27,.90)' }, sceneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34d399' }, listeningDot: { backgroundColor: '#fb7185' }, scene: { flex: 1, color: '#cffafe', fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 7 }, voiceButton: { flex: 1.4, alignItems: 'center', padding: 10, borderRadius: 7, backgroundColor: '#0e7490' }, voiceButtonActive: { backgroundColor: '#be123c' }, voiceText: { color: '#ecfeff', fontWeight: '900', fontSize: 10, letterSpacing: 1 }, pauseButton: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 7, backgroundColor: '#164e63' }, resumeButton: { backgroundColor: '#0f766e' }, pauseText: { color: '#ecfeff', fontWeight: '900', fontSize: 10, letterSpacing: 1 }, disclaimer: { color: '#6f93a5', fontSize: 8, lineHeight: 11, marginTop: 6 },
});
