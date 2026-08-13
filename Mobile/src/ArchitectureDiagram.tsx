import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Marker, Path, Rect, Text as SvgText } from 'react-native-svg';
import { ArchitectureBlueprint, ArchitectureNode } from './api';

const WIDTH = 720;
const NODE_W = 150;
const NODE_H = 70;
const COLORS: Record<ArchitectureNode['kind'], string> = {
  client: '#38bdf8', service: '#34d399', data: '#f59e0b', external: '#c084fc',
  actor: '#f472b6', screen: '#22d3ee', action: '#a3e635', decision: '#fb7185',
};

function layout(blueprint: ArchitectureBlueprint) {
  const positions = new Map<string, { x: number; y: number }>();
  blueprint.nodes.forEach((node, index) => {
    positions.set(node.id, { x: 25 + (index % 4) * 175, y: 35 + Math.floor(index / 4) * 115 });
  });
  return positions;
}

export function ArchitectureDiagram({ blueprint }: { blueprint: ArchitectureBlueprint }) {
  const positions = layout(blueprint);
  const height = Math.max(330, ...Array.from(positions.values()).map(({ y }) => y + 110));
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>GENERATED SOFTWARE BLUEPRINT</Text>
      <Text style={styles.title}>{blueprint.title}</Text>
      <Text style={styles.summary}>{blueprint.summary}</Text>
      <ScrollView horizontal style={styles.canvasScroll}>
        <Svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
          <Defs><Marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><Path d="M0,0 L0,6 L8,3 z" fill="#64748b" /></Marker></Defs>
          {blueprint.edges.map((edge, index) => {
            const from = positions.get(edge.source); const to = positions.get(edge.target);
            if (!from || !to) return null;
            return <Line key={`${edge.source}-${edge.target}-${index}`} x1={from.x + NODE_W} y1={from.y + NODE_H / 2} x2={to.x} y2={to.y + NODE_H / 2} stroke="#64748b" strokeWidth="2" markerEnd="url(#arrow)" />;
          })}
          {blueprint.nodes.map((node) => {
            const point = positions.get(node.id)!; const color = COLORS[node.kind];
            return <ViewNode key={node.id} node={node} x={point.x} y={point.y} color={color} />;
          })}
        </Svg>
      </ScrollView>
      <View style={styles.legend}>{Object.entries(COLORS).map(([kind, color]) => <View key={kind} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{kind}</Text></View>)}</View>
    </ScrollView>
  );
}

function ViewNode({ node, x, y, color }: { node: ArchitectureNode; x: number; y: number; color: string }) {
  return <>
    <Rect x={x} y={y} width={NODE_W} height={NODE_H} rx="12" fill="#0d1b2a" stroke={color} strokeWidth="2" />
    <SvgText x={x + 12} y={y + 27} fill="#f8fafc" fontSize="14" fontWeight="700">{node.label.slice(0, 18)}</SvgText>
    <SvgText x={x + 12} y={y + 50} fill={color} fontSize="10">{node.kind.toUpperCase()}</SvgText>
  </>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 20 }, eyebrow: { color: '#34d399', fontSize: 10, letterSpacing: 2 },
  title: { color: '#f8fafc', fontSize: 25, fontWeight: '800', marginTop: 7 }, summary: { color: '#94a3b8', lineHeight: 21, marginTop: 10 },
  canvasScroll: { marginTop: 18, backgroundColor: '#091524', borderRadius: 14, borderWidth: 1, borderColor: '#1e293b' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 14 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { color: '#94a3b8', textTransform: 'capitalize' },
});
