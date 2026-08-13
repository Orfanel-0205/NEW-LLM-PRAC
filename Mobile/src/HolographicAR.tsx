import { CameraType, CameraView } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, PanResponder, Pressable, SafeAreaView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { analyzeVision, ArchitectureBlueprint } from './api';

type Props = {
  blueprint?: ArchitectureBlueprint;
  onClose: () => void;
  onSpeak: (text: string) => void;
};

export function HolographicAR({ blueprint, onClose, onSpeak }: Props) {
  const camera = useRef<CameraView>(null);
  const scanning = useRef(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [question, setQuestion] = useState('Inspect this screen for technical errors, UI state, and the best next debugging action.');
  const [analysis, setAnalysis] = useState('');
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function scan() {
    if (scanning.current || !camera.current) return;
    scanning.current = true;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.55, skipProcessing: false });
      if (!photo?.uri) return;
      const result = await analyzeVision(photo.uri, question);
      setAnalysis(result);
      onSpeak(result);
    } catch (error) {
      setAnalysis(error instanceof Error ? error.message : 'Visual analysis failed');
    } finally {
      scanning.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!live) return;
    scan();
    const timer = setInterval(scan, 15000);
    return () => clearInterval(timer);
  }, [live, question]);

  const nodes = useMemo(() => blueprint?.nodes.slice(0, 8) ?? [], [blueprint]);
  return (
    <View style={styles.page}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} animateShutter={false} />
      <View pointerEvents="none" style={styles.grid} />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <View><Text style={styles.kicker}>JARVIS VISION ARRAY</Text><Text style={styles.title}>{live ? 'LIVE TECH SCAN' : 'AR WORKSPACE'}</Text></View>
          <View style={styles.headerActions}>
            <Pressable style={styles.control} onPress={() => setFacing((value) => value === 'back' ? 'front' : 'back')}><Text style={styles.controlText}>FLIP</Text></Pressable>
            <Pressable style={styles.control} onPress={onClose}><Text style={styles.controlText}>CLOSE</Text></Pressable>
          </View>
        </View>

        <View style={styles.scanLine} pointerEvents="none" />
        {nodes.map((node, index) => <HoloCard key={node.id} label={node.label} detail={node.kind} index={index} />)}
        {analysis ? <HoloCard label="VISUAL DIAGNOSIS" detail={analysis} index={nodes.length + 1} wide /> : null}

        <View style={styles.console}>
          <TextInput value={question} onChangeText={setQuestion} style={styles.question} multiline placeholder="What should Jarvis inspect?" placeholderTextColor="#5f8295" />
          <View style={styles.consoleActions}>
            <Pressable style={[styles.scanButton, live && styles.liveButton]} onPress={() => setLive((value) => !value)}><Text style={styles.scanText}>{live ? 'STOP LIVE' : 'LIVE 15s'}</Text></Pressable>
            <Pressable style={styles.scanButton} onPress={scan} disabled={busy}>{busy ? <ActivityIndicator color="#07111f" /> : <Text style={styles.scanText}>ANALYZE FRAME</Text>}</Pressable>
          </View>
          <Text style={styles.disclaimer}>Drag cards anywhere. Camera analysis is local. World-locked anchors require the development-build phase.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function HoloCard({ label, detail, index, wide = false }: { label: string; detail: string; index: number; wide?: boolean }) {
  const position = useRef(new Animated.ValueXY({ x: 18 + (index % 2) * 175, y: 125 + Math.floor(index / 2) * 105 })).current;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => position.extractOffset(),
    onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], { useNativeDriver: false }),
    onPanResponderRelease: () => position.flattenOffset(),
  }), [position]);
  return <Animated.View {...pan.panHandlers} style={[styles.card, wide && styles.wideCard, { transform: position.getTranslateTransform() }]}>
    <View style={styles.cardGlow} /><Text style={styles.cardLabel}>{label}</Text><Text numberOfLines={wide ? 7 : 2} style={styles.cardDetail}>{detail}</Text><Text style={styles.cardHandle}>+ MOVE</Text>
  </Animated.View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' }, overlay: { flex: 1 },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.16, borderWidth: 1, borderColor: '#22d3ee' },
  header: { margin: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(2,12,27,.72)', borderLeftWidth: 3, borderLeftColor: '#22d3ee', padding: 12 },
  kicker: { color: '#67e8f9', fontSize: 9, letterSpacing: 2.5 }, title: { color: '#ecfeff', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  headerActions: { flexDirection: 'row', gap: 7 }, control: { borderWidth: 1, borderColor: '#22d3ee', padding: 8, borderRadius: 6, backgroundColor: 'rgba(8,47,73,.75)' }, controlText: { color: '#cffafe', fontSize: 10, fontWeight: '800' },
  scanLine: { position: 'absolute', top: '42%', left: 0, right: 0, height: 1, backgroundColor: '#22d3ee', shadowColor: '#22d3ee', shadowOpacity: 1, shadowRadius: 10 },
  card: { position: 'absolute', width: 155, minHeight: 82, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#22d3ee', backgroundColor: 'rgba(5,29,48,.82)', shadowColor: '#22d3ee', shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 },
  wideCard: { width: 320, minHeight: 130, borderColor: '#34d399' }, cardGlow: { position: 'absolute', top: 0, left: 12, right: 12, height: 2, backgroundColor: '#a5f3fc' },
  cardLabel: { color: '#ecfeff', fontWeight: '900', fontSize: 12, marginTop: 3 }, cardDetail: { color: '#a5f3fc', fontSize: 10, lineHeight: 14, marginTop: 5 }, cardHandle: { color: '#22d3ee', fontSize: 8, letterSpacing: 1.5, marginTop: 7 },
  console: { marginTop: 'auto', margin: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#22d3ee', backgroundColor: 'rgba(2,12,27,.9)' },
  question: { minHeight: 44, maxHeight: 80, color: '#ecfeff', fontSize: 13 }, consoleActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  scanButton: { minWidth: 110, minHeight: 38, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#22d3ee' }, liveButton: { backgroundColor: '#fb7185' }, scanText: { color: '#07111f', fontWeight: '900', fontSize: 11 },
  disclaimer: { color: '#5f8295', fontSize: 9, marginTop: 8 },
});
