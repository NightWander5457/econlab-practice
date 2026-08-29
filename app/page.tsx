'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ensureCloudIdentity, loadCloudProgress, syncCloudAttempt, syncCloudSession } from './cloud';
import { ConceptStage, concepts } from './concepts';
import { correctAnswer, Question, questions, unitTopics } from './questions';
import { isCloudConfigured } from './supabase';

type Mode = 'practice' | 'chapters' | 'graph' | 'mistakes' | 'records';
type HelpLevel = 'assist' | 'standard' | 'exam';
type QuestionStat = {
  attempts: number;
  correct: number;
  wrong: number;
  streak: number;
  lastCorrect: boolean;
  lastAnswered: string;
  nextReview?: string;
  reviewLevel?: number;
};
type Stats = Record<string, QuestionStat>;
type Session = {
  id: string;
  start: string;
  activeSeconds: number;
  completed: number;
  correct: number;
};

const STORE_KEY = 'econlab-progress-v1';
const ASSET_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function currentTimestamp() {
  return Date.now();
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/[.,;:!?()]/g, '').replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j += 1) {
    let previous = rows[0];
    rows[0] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const saved = rows[i];
      rows[i] = Math.min(rows[i] + 1, rows[i - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return rows[a.length];
}

function isFillCorrect(value: string, accepted: string[] = []) {
  const attempt = normalize(value);
  return accepted.some((item) => {
    const answer = normalize(item);
    return attempt === answer || (answer.length >= 6 && editDistance(attempt, answer) <= 1);
  });
}

function masteryLabel(value: number) {
  if (value >= 80) return '稳定掌握';
  if (value >= 55) return '练习中';
  return '需要复习';
}

const stageMeta: Record<ConceptStage, { short: string; label: string }> = {
  recognise: { short: '认', label: '识别概念' },
  recall: { short: '忆', label: '英文回忆' },
  apply: { short: '用', label: '情境应用' },
};

const stageQuestionMap = new Map<string, Question[]>();
questions.forEach((question) => {
  if (!question.conceptId || !question.stage) return;
  const key = `${question.conceptId}:${question.stage}`;
  stageQuestionMap.set(key, [...(stageQuestionMap.get(key) ?? []), question]);
});

function questionsForStage(conceptId: string, stage: ConceptStage) {
  return stageQuestionMap.get(`${conceptId}:${stage}`) ?? [];
}

function hashText(value: string) {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function reorderOptions<T>(items: T[], seed: string) {
  if (items.length < 2) return items.map((item, originalIndex) => ({ item, originalIndex }));
  const shift = Math.abs(hashText(seed)) % items.length;
  const indexed = items.map((item, originalIndex) => ({ item, originalIndex }));
  const rotated = [...indexed.slice(shift), ...indexed.slice(0, shift)];
  return Math.abs(hashText(`${seed}:reverse`)) % 2 ? rotated.reverse() : rotated;
}

function mixByTopic(items: Question[]) {
  const groups = new Map<string, Question[]>();
  items.forEach((question) => groups.set(question.topic, [...(groups.get(question.topic) ?? []), question]));
  const mixed: Question[] = [];
  while ([...groups.values()].some((group) => group.length)) {
    groups.forEach((group) => { const next = group.shift(); if (next) mixed.push(next); });
  }
  return mixed;
}

const graphTasks = [
  { id: 'demand', title: '画出需求曲线', prompt: 'Draw a demand curve and complete all labels.', promptZh: '从左上方向右下方画一条直线，并补全坐标轴与曲线名称。', slope: 'down', y: 'P', x: 'Q', curve: 'D' },
  { id: 'supply', title: '画出供给曲线', prompt: 'Draw a supply curve and complete all labels.', promptZh: '从左下方向右上方画一条直线，并补全坐标轴与曲线名称。', slope: 'up', y: 'P', x: 'Q', curve: 'S' },
  { id: 'ad', title: '画出总需求曲线', prompt: 'Draw an aggregate demand curve.', promptZh: '画出向右下方倾斜的 AD 曲线，并正确标注宏观坐标轴。', slope: 'down', y: 'Price level', x: 'Real output', curve: 'AD' },
  { id: 'sras', title: '画出短期总供给曲线', prompt: 'Draw a short-run aggregate supply curve.', promptZh: '画出向右上方倾斜的 SRAS，并正确标注宏观坐标轴。', slope: 'up', y: 'Price level', x: 'Real output', curve: 'SRAS' },
  { id: 'lras', title: '画出古典 LRAS', prompt: 'Draw a classical long-run aggregate supply curve.', promptZh: '在潜在产出位置画一条竖直的 LRAS，并补全标注。', slope: 'vertical', y: 'Price level', x: 'Real output', curve: 'LRAS' },
  { id: 'perfect-inelastic-demand', title: '画出完全无弹性需求', prompt: 'Draw a perfectly inelastic demand curve.', promptZh: '画出竖直的需求曲线，并使用微观经济坐标轴。', slope: 'vertical', y: 'P', x: 'Q', curve: 'D' },
  { id: 'perfect-elastic-demand', title: '画出完全弹性需求', prompt: 'Draw a perfectly elastic demand curve.', promptZh: '画出水平的需求曲线，并使用微观经济坐标轴。', slope: 'horizontal', y: 'P', x: 'Q', curve: 'D' },
  { id: 'phillips', title: '画出短期菲利普斯曲线', prompt: 'Draw a short-run Phillips curve.', promptZh: '画出向右下方倾斜的 SRPC，并标注通胀率与失业率。', slope: 'down', y: 'Inflation rate', x: 'Unemployment rate', curve: 'SRPC' },
] as const;

type Line = { start: { x: number; y: number }; end: { x: number; y: number } };
type GraphAttempt = { taskId: string; title: string; correct: boolean; answerText: string };

function DrawLab({ onAttempt }: { onAttempt: (attempt: GraphAttempt) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [labels, setLabels] = useState({ y: '', x: '', curve: '' });
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const task = graphTasks[taskIndex];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ece7da';
    ctx.lineWidth = 1;
    for (let x = 70; x <= 630; x += 56) { ctx.beginPath(); ctx.moveTo(x, 25); ctx.lineTo(x, 340); ctx.stroke(); }
    for (let y = 25; y <= 340; y += 45) { ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(630, y); ctx.stroke(); }
    ctx.strokeStyle = '#4d5960';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(70, 25); ctx.lineTo(70, 340); ctx.lineTo(640, 340); ctx.stroke();
    ctx.fillStyle = '#4d5960';
    ctx.beginPath(); ctx.moveTo(70, 19); ctx.lineTo(65, 31); ctx.lineTo(75, 31); ctx.fill();
    ctx.beginPath(); ctx.moveTo(646, 340); ctx.lineTo(634, 335); ctx.lineTo(634, 345); ctx.fill();
    ctx.fillStyle = '#8e918d';
    ctx.font = '13px sans-serif';
    ctx.fillText(labels.y || '?', 18, 35);
    ctx.fillText(labels.x || '?', 585, 378);
    if (line) {
      ctx.strokeStyle = result === 'correct' ? '#1f7a63' : result === 'wrong' ? '#c95d4b' : '#d1952f';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(line.start.x, line.start.y); ctx.lineTo(line.end.x, line.end.y); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      for (const point of [line.start, line.end]) { ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = 'italic 700 18px Georgia';
      ctx.fillText(labels.curve || '?', Math.min(610, line.end.x + 12), Math.min(330, line.end.y + 12));
    }
  }, [line, labels, result, task]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(72, Math.min(630, (event.clientX - rect.left) * (event.currentTarget.width / rect.width))),
      y: Math.max(26, Math.min(337, (event.clientY - rect.top) * (event.currentTarget.height / rect.height))),
    };
  }

  function startDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setLine({ start: point, end: point });
    setDrawing(true);
    setResult(null);
  }

  function moveDraw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const point = pointFromEvent(event);
    setLine((current) => current ? { ...current, end: point } : null);
  }

  function checkGraph() {
    if (!line) return;
    const left = line.start.x <= line.end.x ? line.start : line.end;
    const right = line.start.x <= line.end.x ? line.end : line.start;
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const longEnough = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) > 170;
    const shapeCorrect = task.slope === 'down'
      ? dx > 130 && dy > 65
      : task.slope === 'up'
        ? dx > 130 && dy < -65
        : task.slope === 'horizontal'
          ? Math.abs(line.end.y - line.start.y) < 45 && Math.abs(line.end.x - line.start.x) > 190
          : Math.abs(line.end.x - line.start.x) < 45 && Math.abs(line.end.y - line.start.y) > 190;
    const labelCorrect = labels.y === task.y && labels.x === task.x && labels.curve === task.curve;
    const correct = longEnough && shapeCorrect && labelCorrect;
    setResult(correct ? 'correct' : 'wrong');
    onAttempt({
      taskId: task.id,
      title: task.title,
      correct,
      answerText: JSON.stringify({ labels, line }),
    });
  }

  function nextTask() {
    setTaskIndex((value) => (value + 1) % graphTasks.length);
    setLine(null); setLabels({ y: '', x: '', curve: '' }); setResult(null);
  }

  const labelOptions = ['P', 'Q', 'D', 'S', 'Price level', 'Real output', 'AD', 'SRAS', 'LRAS', 'Inflation rate', 'Unemployment rate', 'SRPC'];
  return (
    <section className="graph-lab page-card">
      <div className="section-title-row">
        <div><p className="eyebrow">GRAPH LAB · 图形训练室</p><h2>{task.title}</h2></div>
        <span className="task-count">{taskIndex + 1} / {graphTasks.length}</span>
      </div>
      <div className="graph-instruction"><strong>{task.prompt}</strong><span>{task.promptZh}</span></div>
      <div className="graph-workspace">
        <canvas
          ref={canvasRef}
          width={680}
          height={400}
          aria-label={task.title}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={() => setDrawing(false)}
          onPointerCancel={() => setDrawing(false)}
        />
        <div className="label-controls">
          <div className="keyboard-draw"><strong>键盘作图</strong><span>选择你判断的方向</span><div>{([
            ['向右下', { start: { x: 145, y: 80 }, end: { x: 555, y: 300 } }],
            ['向右上', { start: { x: 145, y: 300 }, end: { x: 555, y: 80 } }],
            ['水平', { start: { x: 145, y: 200 }, end: { x: 555, y: 200 } }],
            ['竖直', { start: { x: 350, y: 60 }, end: { x: 350, y: 315 } }],
          ] as Array<[string, Line]>).map(([label, preset]) => <button key={label} onClick={() => { setLine(preset); setResult(null); }}>{label}</button>)}</div></div>
          <label>纵轴 Y-axis<select value={labels.y} onChange={(event) => setLabels({ ...labels, y: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>横轴 X-axis<select value={labels.x} onChange={(event) => setLabels({ ...labels, x: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>曲线 Curve<select value={labels.curve} onChange={(event) => setLabels({ ...labels, curve: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </div>
      {result && <div className={`feedback ${result === 'correct' ? 'is-correct' : 'is-wrong'}`}><strong>{result === 'correct' ? '图形和标注全部正确。' : '还差一点，再检查方向和标注。'}</strong><p>{result === 'correct' ? '你已经完成这类基础直线图。接下来继续练读图、移动和区域判断。' : task.slope === 'down' ? '这条曲线应从左上方向右下方倾斜，并且三个标签都必须匹配。' : task.slope === 'up' ? '这条曲线应从左下方向右上方倾斜，并且三个标签都必须匹配。' : task.slope === 'horizontal' ? '完全弹性需求曲线应保持水平。' : '竖直曲线的横坐标应基本不变，同时正确填写坐标轴和曲线名称。'}</p></div>}
      <div className="graph-actions"><button className="ghost-button" onClick={() => { setLine(null); setResult(null); }}>清空重画</button><button className="primary-button" onClick={result === 'correct' ? nextTask : checkGraph} disabled={!line}>{result === 'correct' ? '下一张图 →' : '检查图形 →'}</button></div>
    </section>
  );
}

type DiagramCurve = { path: string; label: string; x: number; y: number; color?: string; dash?: string };
type DiagramGuide = { x1: number; y1: number; x2: number; y2: number; label?: string; x?: number; y?: number; color?: string };
type DiagramTask = {
  id: string; title: string; prompt: string; promptZh: string; y: string; x: string;
  curves: DiagramCurve[]; guides?: DiagramGuide[]; area?: string;
  options: string[]; answerIndex: number; explanationZh: string;
};

const diagramTasks: DiagramTask[] = [
  { id: 'ppf-outward', title: 'PPF 与经济增长', prompt: 'Which change is shown by the outer frontier?', promptZh: '外侧生产可能性边界表示什么？', y: 'Capital goods', x: 'Consumer goods', curves: [{ path: 'M105 72 Q490 80 575 315', label: 'PPF₁', x: 505, y: 284, color: '#8b857d' }, { path: 'M145 112 Q445 125 520 315', label: 'PPF₀', x: 448, y: 288, color: '#e0781e', dash: '7 5' }], options: ['An increase in productive capacity', 'A movement into unemployment', 'A fall in demand only'], answerIndex: 0, explanationZh: 'PPF 向外移动表示经济的最大生产能力提高，即潜在经济增长。' },
  { id: 'demand-right', title: '需求增加', prompt: 'What happens to equilibrium after demand shifts from D₀ to D₁?', promptZh: '需求曲线从 D₀ 右移到 D₁ 后，均衡价格和数量怎样变化？', y: 'P', x: 'Q', curves: [{ path: 'M115 75 L545 310', label: 'D₀', x: 535, y: 300, color: '#8b857d' }, { path: 'M180 75 L610 310', label: 'D₁', x: 596, y: 300, color: '#e0781e' }, { path: 'M120 310 L550 75', label: 'S', x: 544, y: 78, color: '#183ccc' }], options: ['Price rises and quantity rises', 'Price falls and quantity rises', 'Price rises and quantity falls'], answerIndex: 0, explanationZh: '需求右移，在供给不变时，新均衡的价格和数量都上升。' },
  { id: 'supply-left', title: '供给减少', prompt: 'What happens after supply shifts from S₀ to S₁?', promptZh: '供给曲线从 S₀ 左移到 S₁ 后会发生什么？', y: 'P', x: 'Q', curves: [{ path: 'M140 310 L570 75', label: 'S₀', x: 560, y: 78, color: '#8b857d' }, { path: 'M80 310 L510 75', label: 'S₁', x: 500, y: 78, color: '#e0781e' }, { path: 'M115 75 L545 310', label: 'D', x: 535, y: 302, color: '#183ccc' }], options: ['Price rises and quantity falls', 'Price falls and quantity rises', 'Price and quantity both rise'], answerIndex: 0, explanationZh: '供给左移意味着每个价格下供给减少，因此均衡价格上升、均衡数量下降。' },
  { id: 'ped-shape', title: 'PED 曲线陡峭程度', prompt: 'Which curve is relatively more price elastic?', promptZh: '哪条需求曲线相对更富有价格弹性？', y: 'P', x: 'Q', curves: [{ path: 'M280 70 L410 315', label: 'D₁', x: 402, y: 305, color: '#183ccc' }, { path: 'M100 145 L590 250', label: 'D₂', x: 582, y: 246, color: '#e0781e' }], options: ['D₂, because it is flatter', 'D₁, because it is steeper', 'Both must have PED = 1'], answerIndex: 0, explanationZh: '在相同坐标尺度下，较平坦的需求曲线通常表示需求量对价格变化反应更大。' },
  { id: 'consumer-surplus-area', title: '消费者剩余区域', prompt: 'The shaded area is above market price and below demand. What is it?', promptZh: '阴影位于市场价格上方、需求曲线下方，它表示什么？', y: 'P', x: 'Q', area: '150,145 150,72 285,145', curves: [{ path: 'M150 72 L545 305', label: 'D', x: 535, y: 300, color: '#183ccc' }, { path: 'M105 305 L505 72', label: 'S', x: 495, y: 78, color: '#e0781e' }], guides: [{ x1: 70, y1: 145, x2: 285, y2: 145, label: 'Pₑ', x: 35, y: 149 }], options: ['Consumer surplus', 'Producer surplus', 'Tax revenue'], answerIndex: 0, explanationZh: '消费者剩余是消费者愿意支付价格与实际市场价格之间的区域，位于需求曲线下、价格线上。' },
  { id: 'tax-shift', title: '间接税图形', prompt: 'What does the vertical gap between S and S + tax represent?', promptZh: 'S 与 S + tax 之间的垂直距离表示什么？', y: 'P', x: 'Q', curves: [{ path: 'M120 305 L520 85', label: 'S', x: 515, y: 83, color: '#183ccc' }, { path: 'M120 245 L520 25', label: 'S + tax', x: 500, y: 32, color: '#e0781e' }, { path: 'M110 70 L560 310', label: 'D', x: 550, y: 305, color: '#508f62' }], options: ['Tax per unit', 'Consumer surplus', 'Quantity demanded'], answerIndex: 0, explanationZh: '从量税图中两条平行供给曲线之间的垂直距离表示每单位税额。' },
  { id: 'subsidy-shift', title: '补贴图形', prompt: 'Which effect follows the shift from S to S + subsidy?', promptZh: '供给从 S 移动到 S + subsidy 后会发生什么？', y: 'P', x: 'Q', curves: [{ path: 'M150 310 L560 85', label: 'S', x: 552, y: 82, color: '#8b857d' }, { path: 'M85 310 L495 85', label: 'S + subsidy', x: 478, y: 82, color: '#e0781e' }, { path: 'M110 70 L560 310', label: 'D', x: 550, y: 304, color: '#183ccc' }], options: ['Price falls and quantity rises', 'Price rises and quantity falls', 'Both price and quantity fall'], answerIndex: 0, explanationZh: '补贴降低生产成本，使供给右移，均衡价格下降而均衡数量上升。' },
  { id: 'maximum-price', title: '最高限价', prompt: 'The price ceiling is below equilibrium. Which area appears?', promptZh: '最高限价低于均衡价格时，市场出现什么？', y: 'P', x: 'Q', curves: [{ path: 'M110 75 L555 310', label: 'D', x: 547, y: 303, color: '#183ccc' }, { path: 'M110 310 L555 75', label: 'S', x: 548, y: 80, color: '#e0781e' }], guides: [{ x1: 70, y1: 245, x2: 610, y2: 245, label: 'Pmax', x: 22, y: 249, color: '#c95d4b' }], options: ['Excess demand (shortage)', 'Excess supply (surplus)', 'No market effect'], answerIndex: 0, explanationZh: '有效最高限价位于均衡价格下方，此时需求量大于供给量，产生短缺。' },
  { id: 'minimum-price', title: '最低限价', prompt: 'The price floor is above equilibrium. Which area appears?', promptZh: '最低限价高于均衡价格时，市场出现什么？', y: 'P', x: 'Q', curves: [{ path: 'M110 75 L555 310', label: 'D', x: 547, y: 303, color: '#183ccc' }, { path: 'M110 310 L555 75', label: 'S', x: 548, y: 80, color: '#e0781e' }], guides: [{ x1: 70, y1: 115, x2: 610, y2: 115, label: 'Pmin', x: 22, y: 119, color: '#c95d4b' }], options: ['Excess supply (surplus)', 'Excess demand (shortage)', 'A lower market price'], answerIndex: 0, explanationZh: '有效最低限价位于均衡价格上方，此时供给量大于需求量，产生过剩。' },
  { id: 'negative-externality', title: '负外部性', prompt: 'Why is the free-market output Qm too high?', promptZh: '为什么负外部性图中的自由市场产量 Qm 过高？', y: 'Cost / Benefit', x: 'Q', curves: [{ path: 'M105 305 L505 90', label: 'MPC', x: 498, y: 92, color: '#8b857d' }, { path: 'M105 250 L505 35', label: 'MSC', x: 498, y: 38, color: '#e0781e' }, { path: 'M105 70 L560 310', label: 'MSB', x: 548, y: 304, color: '#183ccc' }], options: ['MSC exceeds MPC because external costs are ignored', 'MSB exceeds MPB because of external benefits', 'The market price is fixed by law'], answerIndex: 0, explanationZh: '生产的负外部性使MSC高于MPC。市场只考虑私人成本，因此产量超过社会最优水平。' },
  { id: 'positive-externality', title: '正外部性', prompt: 'Why is the free-market output below the social optimum?', promptZh: '为什么正外部性图中的自由市场产量低于社会最优产量？', y: 'Cost / Benefit', x: 'Q', curves: [{ path: 'M105 300 L505 85', label: 'MSC', x: 496, y: 88, color: '#e0781e' }, { path: 'M105 35 L560 275', label: 'MSB', x: 548, y: 270, color: '#183ccc' }, { path: 'M105 70 L560 310', label: 'MPB', x: 548, y: 304, color: '#8b857d', dash: '7 5' }], options: ['External benefits are not fully considered', 'External costs make MSC greater than MPC', 'A minimum price reduces demand'], answerIndex: 0, explanationZh: '正外部性意味着社会收益高于私人收益。消费者只考虑私人收益，因此自由市场消费不足。' },
  { id: 'ad-right', title: '总需求增加', prompt: 'AD shifts right while SRAS is unchanged. What happens in the short run?', promptZh: 'AD右移、SRAS不变时，短期均衡怎样变化？', y: 'Price level', x: 'Real output', curves: [{ path: 'M110 75 L525 305', label: 'AD₀', x: 515, y: 300, color: '#8b857d' }, { path: 'M175 75 L590 305', label: 'AD₁', x: 580, y: 300, color: '#e0781e' }, { path: 'M110 305 L530 90', label: 'SRAS', x: 510, y: 92, color: '#183ccc' }], options: ['Price level and real output both rise', 'Both fall', 'Price level falls while output rises'], answerIndex: 0, explanationZh: '短期总供给向上倾斜时，AD右移会同时提高价格水平和实际产出。' },
  { id: 'sras-left', title: 'SRAS 左移', prompt: 'Oil prices rise and SRAS shifts left. Which combination follows?', promptZh: '石油价格上涨使SRAS左移，会出现哪种组合？', y: 'Price level', x: 'Real output', curves: [{ path: 'M150 305 L545 90', label: 'SRAS₀', x: 522, y: 92, color: '#8b857d' }, { path: 'M90 305 L485 90', label: 'SRAS₁', x: 462, y: 92, color: '#e0781e' }, { path: 'M110 75 L555 310', label: 'AD', x: 545, y: 304, color: '#183ccc' }], options: ['Higher price level and lower real output', 'Lower price level and higher output', 'Lower price level and lower output'], answerIndex: 0, explanationZh: 'SRAS左移会造成成本推动型通胀：价格水平上升、实际产出下降。' },
  { id: 'classical-lras', title: '古典 LRAS', prompt: 'Why is LRAS vertical at Yf?', promptZh: '为什么古典LRAS在Yf处竖直？', y: 'Price level', x: 'Real output', curves: [{ path: 'M390 40 L390 330', label: 'LRAS', x: 398, y: 52, color: '#e0781e' }, { path: 'M110 75 L555 310', label: 'AD', x: 545, y: 304, color: '#183ccc' }], guides: [{ x1: 390, y1: 340, x2: 390, y2: 350, label: 'Yf', x: 382, y: 370 }], options: ['Long-run output is limited by productive capacity', 'Demand is perfectly elastic', 'Prices cannot change'], answerIndex: 0, explanationZh: '古典模型认为长期实际产出由生产能力决定，AD变化长期主要改变价格水平。' },
  { id: 'negative-output-gap', title: '负产出缺口', prompt: 'Actual output Y₁ lies left of potential output Yf. What does this show?', promptZh: '实际产出Y₁位于潜在产出Yf左侧，表示什么？', y: 'Price level', x: 'Real output', curves: [{ path: 'M455 40 L455 330', label: 'LRAS', x: 463, y: 52, color: '#e0781e' }, { path: 'M105 305 L525 85', label: 'SRAS', x: 510, y: 88, color: '#508f62' }, { path: 'M90 80 L455 285', label: 'AD', x: 445, y: 279, color: '#183ccc' }], guides: [{ x1: 300, y1: 205, x2: 300, y2: 340, label: 'Y₁', x: 292, y: 365 }, { x1: 455, y1: 330, x2: 455, y2: 340, label: 'Yf', x: 448, y: 365 }], options: ['Spare capacity and cyclical unemployment', 'Unsustainable excess demand', 'Perfectly inelastic supply'], answerIndex: 0, explanationZh: '实际产出低于潜在产出形成负产出缺口，经济存在闲置产能与周期性失业。' },
  { id: 'positive-output-gap', title: '正产出缺口', prompt: 'Actual output Y₁ lies right of potential output Yf. What is likely?', promptZh: '实际产出Y₁位于潜在产出Yf右侧，最可能出现什么？', y: 'Price level', x: 'Real output', curves: [{ path: 'M360 40 L360 330', label: 'LRAS', x: 368, y: 52, color: '#e0781e' }, { path: 'M105 305 L525 85', label: 'SRAS', x: 510, y: 88, color: '#508f62' }, { path: 'M180 75 L580 300', label: 'AD', x: 568, y: 294, color: '#183ccc' }], guides: [{ x1: 360, y1: 330, x2: 360, y2: 340, label: 'Yf', x: 352, y: 365 }, { x1: 470, y1: 180, x2: 470, y2: 340, label: 'Y₁', x: 462, y: 365 }], options: ['Inflationary pressure and very low unemployment', 'Spare capacity and deflation only', 'A current-account surplus must occur'], answerIndex: 0, explanationZh: '正产出缺口通常不可长期持续，会伴随资源紧张、较低失业和较强通胀压力。' },
  { id: 'lras-growth', title: '潜在经济增长', prompt: 'LRAS shifts from LRAS₀ to LRAS₁. What has increased?', promptZh: 'LRAS从LRAS₀右移到LRAS₁，什么增加了？', y: 'Price level', x: 'Real output', curves: [{ path: 'M330 40 L330 330', label: 'LRAS₀', x: 280, y: 52, color: '#8b857d' }, { path: 'M465 40 L465 330', label: 'LRAS₁', x: 473, y: 52, color: '#e0781e' }], options: ['Productive capacity', 'The current price level only', 'The saving ratio only'], answerIndex: 0, explanationZh: 'LRAS右移表示最大可持续产出增加，即潜在经济增长。' },
  { id: 'phillips-curve-read', title: '菲利普斯曲线', prompt: 'Moving upward along the short-run Phillips curve usually means...', promptZh: '沿短期菲利普斯曲线向上移动通常表示什么？', y: 'Inflation rate', x: 'Unemployment rate', curves: [{ path: 'M125 80 Q280 155 560 305', label: 'SRPC', x: 545, y: 298, color: '#e0781e' }], options: ['Higher inflation and lower unemployment', 'Lower inflation and lower unemployment', 'Higher inflation and higher unemployment'], answerIndex: 0, explanationZh: '短期菲利普斯曲线表示通胀与失业之间的反向关系。向左上移动意味着通胀更高、失业更低。' },
];

function DiagramDrill({ onAttempt }: { onAttempt: (attempt: GraphAttempt) => void }) {
  const [taskIndex, setTaskIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const task = diagramTasks[taskIndex];
  const displayedOptions = useMemo(() => reorderOptions(task.options, `diagram:${task.id}`), [task]);
  const displayedAnswerIndex = displayedOptions.findIndex((option) => option.originalIndex === task.answerIndex);

  function check() {
    if (selected === null || result) return;
    const correct = selected === displayedAnswerIndex;
    setResult(correct ? 'correct' : 'wrong');
    onAttempt({ taskId: `read:${task.id}`, title: task.title, correct, answerText: displayedOptions[selected].item });
  }

  function next() {
    setTaskIndex((value) => (value + 1) % diagramTasks.length);
    setSelected(null); setResult(null);
  }

  return <section className="graph-lab page-card diagram-lab">
    <div className="section-title-row"><div><p className="eyebrow">GRAPH READING · 读图判断</p><h2>{task.title}</h2></div><span className="task-count">{taskIndex + 1} / {diagramTasks.length}</span></div>
    <div className="graph-instruction"><strong>{task.prompt}</strong><span>{task.promptZh}</span></div>
    <div className="diagram-workspace">
      <svg viewBox="0 0 680 400" role="img" aria-label={task.title}>
        <defs><pattern id="diagram-grid" width="55" height="45" patternUnits="userSpaceOnUse"><path d="M55 0H0V45" fill="none" stroke="#eee7da" strokeWidth="1" /></pattern></defs>
        <rect x="70" y="25" width="560" height="315" fill="url(#diagram-grid)" />
        {task.area && <polygon points={task.area} fill="rgba(224,120,30,.25)" stroke="#e0781e" strokeWidth="1" />}
        <path d="M70 25V340H640" fill="none" stroke="#4d5960" strokeWidth="2.5" />
        <path d="M70 18L64 31H76Z M647 340L634 334V346Z" fill="#4d5960" />
        <text x="18" y="35" fill="#5d574f" fontSize="13">{task.y}</text><text x="565" y="382" fill="#5d574f" fontSize="13">{task.x}</text>
        {task.guides?.map((guide, index) => <g key={index}><line x1={guide.x1} y1={guide.y1} x2={guide.x2} y2={guide.y2} stroke={guide.color ?? '#8b857d'} strokeWidth="1.5" strokeDasharray="6 5" />{guide.label && <text x={guide.x} y={guide.y} fill={guide.color ?? '#5d574f'} fontSize="12" fontWeight="700">{guide.label}</text>}</g>)}
        {task.curves.map((curve) => <g key={curve.label}><path d={curve.path} fill="none" stroke={curve.color ?? '#183ccc'} strokeWidth="4" strokeLinecap="round" strokeDasharray={curve.dash} /><text x={curve.x} y={curve.y} fill={curve.color ?? '#183ccc'} fontFamily="Georgia" fontSize="15" fontStyle="italic" fontWeight="700">{curve.label}</text></g>)}
      </svg>
      <div className="diagram-options">{displayedOptions.map(({ item: option }, index) => <button key={option} disabled={result !== null} className={`${selected === index ? 'selected' : ''} ${result && index === displayedAnswerIndex ? 'correct' : ''} ${result === 'wrong' && selected === index ? 'wrong' : ''}`} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
    </div>
    {result && <div className={`feedback ${result === 'correct' ? 'is-correct' : 'is-wrong'}`}><strong>{result === 'correct' ? '读图正确。' : '这张图还需要再看一次。'}</strong><p>{task.explanationZh}</p></div>}
    <div className="graph-actions"><span className="diagram-note">先看坐标轴，再看原曲线与新曲线，最后判断均衡变化。</span><button className="primary-button" disabled={selected === null} onClick={result ? next : check}>{result ? '下一张图 →' : '检查判断 →'}</button></div>
  </section>;
}

function GraphLab({ onAttempt }: { onAttempt: (attempt: GraphAttempt) => void }) {
  const [labMode, setLabMode] = useState<'draw' | 'read'>('draw');
  return <><div className="lab-mode-tabs"><button className={labMode === 'draw' ? 'active' : ''} onClick={() => setLabMode('draw')}>自己绘制 · {graphTasks.length}</button><button className={labMode === 'read' ? 'active' : ''} onClick={() => setLabMode('read')}>读图判断 · {diagramTasks.length}</button></div>{labMode === 'draw' ? <DrawLab onAttempt={onAttempt} /> : <DiagramDrill onAttempt={onAttempt} />}</>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('practice');
  const [helpLevel, setHelpLevel] = useState<HelpLevel>('assist');
  const [stats, setStats] = useState<Stats>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState(questions[0].id);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [checked, setChecked] = useState<boolean | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [dailyGraphActive, setDailyGraphActive] = useState(false);
  const [dailyGraphDone, setDailyGraphDone] = useState(false);
  const [openKnowledgeTopics, setOpenKnowledgeTopics] = useState<Record<string, boolean>>({});
  const [profileName, setProfileName] = useState('学生 A');
  const [profileDraft, setProfileDraft] = useState('学生 A');
  const [cloudStatus, setCloudStatus] = useState<'local' | 'connecting' | 'synced' | 'error'>(() => isCloudConfigured() ? 'connecting' : 'local');
  const lastActivityRef = useRef(0);
  const sessionIdRef = useRef('');
  const cloudUserIdRef = useRef<string | null>(null);
  const questionStartedAtRef = useRef(0);
  const lastSessionSyncRef = useRef({ active: -1, completed: -1 });
  const reviewQueueRef = useRef<Array<{ questionId: string; dueAfter: number }>>([]);

  const currentQuestion = questions.find((question) => question.id === currentId) ?? questions[0];
  const currentConcept = currentQuestion.conceptId ? concepts.find((concept) => concept.id === currentQuestion.conceptId) : null;
  const currentSession = sessions[sessions.length - 1];
  const completedToday = currentSession?.completed ?? 0;
  const correctToday = currentSession?.correct ?? 0;

  useEffect(() => {
    lastActivityRef.current = currentTimestamp();
    questionStartedAtRef.current = currentTimestamp();
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        setStats(saved.stats || {});
        setSessions(saved.sessions || []);
        setHelpLevel(saved.helpLevel || 'assist');
        setProfileName(saved.profileName || '学生 A');
        setProfileDraft(saved.profileName || '学生 A');
      } catch { /* start with clean local cache */ }
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${currentTimestamp()}`;
      sessionIdRef.current = id;
      setSessions((existing) => [...existing.slice(-29), { id, start: new Date().toISOString(), activeSeconds: 0, completed: 0, correct: 0 }]);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isCloudConfigured()) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const userId = await ensureCloudIdentity(profileName);
        if (!userId || cancelled) return;
        cloudUserIdRef.current = userId;
        const cloudProgress = await loadCloudProgress(userId);
        if (cancelled) return;
        setStats((localStats) => {
          const merged = { ...localStats };
          Object.entries(cloudProgress).forEach(([questionId, remote]) => {
            const local = merged[questionId];
            if (!local || remote.attempts > local.attempts) merged[questionId] = { ...remote, nextReview: local?.nextReview, reviewLevel: local?.reviewLevel };
          });
          return merged;
        });
        setCloudStatus('synced');
      } catch {
        if (!cancelled) setCloudStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [hydrated, profileName]);

  useEffect(() => {
    const markActive = () => { lastActivityRef.current = currentTimestamp(); };
    window.addEventListener('pointerdown', markActive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('scroll', markActive, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('scroll', markActive);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && currentTimestamp() - lastActivityRef.current < 120000) {
        setActiveSeconds((value) => value + 5);
        setSessions((items) => items.map((item) => item.id === sessionIdRef.current ? { ...item, activeSeconds: item.activeSeconds + 5 } : item));
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({ stats, sessions, helpLevel, profileName }));
  }, [stats, sessions, helpLevel, profileName, hydrated]);

  useEffect(() => {
    const userId = cloudUserIdRef.current;
    const session = sessions.find((item) => item.id === sessionIdRef.current);
    if (!userId || !session) return;
    const last = lastSessionSyncRef.current;
    const shouldSync = session.activeSeconds >= last.active + 15 || session.completed !== last.completed;
    if (!shouldSync) return;
    lastSessionSyncRef.current = { active: session.activeSeconds, completed: session.completed };
    void syncCloudSession(userId, session)
      .then(() => setCloudStatus('synced'))
      .catch(() => setCloudStatus('error'));
  }, [activeSeconds, sessions]);

  const questionStagePassed = (conceptId: string, stage: ConceptStage, threshold = 2) => questionsForStage(conceptId, stage)
    .some((question) => (stats[question.id]?.streak ?? 0) >= threshold);

  const conceptStageState = (conceptId: string, stage: ConceptStage) => {
    const stageQuestions = questionsForStage(conceptId, stage);
    const attempts = stageQuestions.reduce((sum, question) => sum + (stats[question.id]?.attempts ?? 0), 0);
    if (stageQuestions.some((question) => (stats[question.id]?.streak ?? 0) >= 2)) return 'passed';
    return attempts > 0 ? 'learning' : 'new';
  };

  const mistakeQuestions = useMemo(() => questions.filter((question) => (stats[question.id]?.wrong ?? 0) > 0 && (stats[question.id]?.streak ?? 0) < 2), [stats]);
  const graphQuestionIds = useMemo(() => [
    ...graphTasks.map((task) => `graph:${task.id}`),
    ...diagramTasks.map((task) => `graph:read:${task.id}`),
  ], []);
  const mistakeGraphIds = useMemo(() => graphQuestionIds.filter((id) => (stats[id]?.wrong ?? 0) > 0 && (stats[id]?.streak ?? 0) < 2), [graphQuestionIds, stats]);

  const recommended = useMemo(() => {
    const passedOnce = (conceptId: string, stage: ConceptStage) => questionsForStage(conceptId, stage)
      .some((question) => (stats[question.id]?.streak ?? 0) >= 1);
    const unlocked = questions.filter((question) => {
      if (!question.conceptId || !question.stage || question.stage === 'recognise') return true;
      if (question.stage === 'recall') return passedOnce(question.conceptId, 'recognise');
      return passedOnce(question.conceptId, 'recall');
    });
    const now = currentTimestamp();
    const due = unlocked.filter((question) => {
      const item = stats[question.id];
      return item && ((item.wrong > 0 && item.streak < 2) || (item.nextReview && new Date(item.nextReview).getTime() <= now));
    });
    const unseen = unlocked.filter((question) => !stats[question.id]);
    const learning = unlocked.filter((question) => stats[question.id] && (stats[question.id]?.streak ?? 0) < 2 && (stats[question.id]?.wrong ?? 0) === 0);
    const stable = unlocked.filter((question) => (stats[question.id]?.streak ?? 0) >= 2);
    return [...mixByTopic(due), ...mixByTopic(unseen), ...mixByTopic(learning), ...mixByTopic(stable)]
      .filter((question, index, array) => array.findIndex((item) => item.id === question.id) === index);
  }, [stats]);

  function resetQuestionState() {
    setSelectedChoice(null); setFillAnswer(''); setChecked(null); setShowHint(false);
    questionStartedAtRef.current = currentTimestamp();
  }

  function openQuestion(question: Question, topic: string | null = null) {
    setDailyGraphActive(false); setCurrentId(question.id); setSelectedTopic(topic); setMode('practice'); resetQuestionState();
  }

  function chooseNext() {
    if (!selectedTopic && completedToday > 0 && completedToday < 12 && completedToday % 4 === 3) {
      setDailyGraphDone(false);
      setDailyGraphActive(true);
      return;
    }
    const dueIndex = reviewQueueRef.current.findIndex((item) => item.dueAfter <= completedToday && item.questionId !== currentId);
    if (dueIndex >= 0) {
      const [due] = reviewQueueRef.current.splice(dueIndex, 1);
      const reviewQuestion = questions.find((question) => question.id === due.questionId);
      if (reviewQuestion) { setCurrentId(reviewQuestion.id); resetQuestionState(); return; }
    }
    const pool = selectedTopic ? questions.filter((question) => question.topic === selectedTopic) : recommended;
    const index = pool.findIndex((question) => question.id === currentId);
    const next = pool[(index + 1 + pool.length) % pool.length] ?? questions[0];
    setCurrentId(next.id); resetQuestionState();
  }

  function recordAttempt(question: Question, correct: boolean, answerText: string, responseMs: number) {
    const old = stats[question.id] || { attempts: 0, correct: 0, wrong: 0, streak: 0, lastCorrect: false, lastAnswered: '' };
    const reviewLevel = correct ? Math.min(4, (old.reviewLevel ?? 0) + 1) : 0;
    const reviewDelay = correct ? [1, 3, 7, 14][reviewLevel - 1] * 86400000 : 10 * 60000;
    const next = { attempts: old.attempts + 1, correct: old.correct + (correct ? 1 : 0), wrong: old.wrong + (correct ? 0 : 1), streak: correct ? old.streak + 1 : 0, lastCorrect: correct, lastAnswered: new Date().toISOString(), nextReview: new Date(currentTimestamp() + reviewDelay).toISOString(), reviewLevel };
    const session = sessions.find((item) => item.id === sessionIdRef.current);
    const nextSession = session ? {
      ...session,
      completed: session.completed + 1,
      correct: session.correct + (correct ? 1 : 0),
    } : null;
    const repeatAfter = correct ? (next.streak < 2 ? 6 : 0) : 3;
    if (repeatAfter && nextSession) {
      reviewQueueRef.current = reviewQueueRef.current.filter((item) => item.questionId !== question.id);
      reviewQueueRef.current.push({ questionId: question.id, dueAfter: nextSession.completed + repeatAfter });
    }
    setStats((existing) => ({ ...existing, [question.id]: next }));
    setSessions((items) => items.map((item) => item.id === sessionIdRef.current && nextSession ? nextSession : item));
    const userId = cloudUserIdRef.current;
    if (userId && nextSession) {
      void (async () => {
        await syncCloudSession(userId, nextSession);
        await syncCloudAttempt({
          userId,
          sessionId: sessionIdRef.current,
          questionId: question.id,
          unit: question.unit,
          topic: question.topic,
          correct,
          answerText,
          responseMs,
          helpLevel,
          progress: next,
        });
      })().then(() => setCloudStatus('synced')).catch(() => setCloudStatus('error'));
    }
  }

  function recordGraphAttempt(attempt: GraphAttempt) {
    const questionId = `graph:${attempt.taskId}`;
    const old = stats[questionId] || { attempts: 0, correct: 0, wrong: 0, streak: 0, lastCorrect: false, lastAnswered: '' };
    const reviewLevel = attempt.correct ? Math.min(4, (old.reviewLevel ?? 0) + 1) : 0;
    const reviewDelay = attempt.correct ? [1, 3, 7, 14][reviewLevel - 1] * 86400000 : 10 * 60000;
    const next = {
      attempts: old.attempts + 1,
      correct: old.correct + (attempt.correct ? 1 : 0),
      wrong: old.wrong + (attempt.correct ? 0 : 1),
      streak: attempt.correct ? old.streak + 1 : 0,
      lastCorrect: attempt.correct,
      lastAnswered: new Date().toISOString(),
      nextReview: new Date(currentTimestamp() + reviewDelay).toISOString(),
      reviewLevel,
    };
    const session = sessions.find((item) => item.id === sessionIdRef.current);
    const nextSession = session ? {
      ...session,
      completed: session.completed + 1,
      correct: session.correct + (attempt.correct ? 1 : 0),
    } : null;
    setStats((existing) => ({ ...existing, [questionId]: next }));
    setSessions((items) => items.map((item) => item.id === sessionIdRef.current && nextSession ? nextSession : item));

    const userId = cloudUserIdRef.current;
    if (userId && nextSession) {
      void (async () => {
        await syncCloudSession(userId, nextSession);
        await syncCloudAttempt({
          userId,
          sessionId: sessionIdRef.current,
          questionId,
          unit: 'GRAPH',
          topic: attempt.title,
          correct: attempt.correct,
          answerText: attempt.answerText,
          responseMs: 0,
          helpLevel,
          progress: next,
        });
      })().then(() => setCloudStatus('synced')).catch(() => setCloudStatus('error'));
    }
  }

  function recordDailyGraphAttempt(attempt: GraphAttempt) {
    if (dailyGraphDone) return;
    recordGraphAttempt(attempt);
    setDailyGraphDone(true);
  }

  function checkCurrent() {
    if (checked !== null) return;
    const correct = currentQuestion.kind === 'choice'
      ? selectedChoice === currentQuestion.answerIndex
      : isFillCorrect(fillAnswer, currentQuestion.accepted);
    const answerText = currentQuestion.kind === 'choice'
      ? currentQuestion.options?.[selectedChoice ?? -1] ?? ''
      : fillAnswer.trim();
    setChecked(correct);
    recordAttempt(currentQuestion, correct, answerText, currentTimestamp() - questionStartedAtRef.current);
  }

  function openToday() {
    const graphIsNext = completedToday > 0 && completedToday < 12 && completedToday % 4 === 3;
    setDailyGraphActive(graphIsNext); setDailyGraphDone(false); setSelectedTopic(null); setMode('practice'); setCurrentId(recommended[0]?.id ?? questions[0].id); resetQuestionState();
  }

  function saveProfileName() {
    const nextName = profileDraft.trim().slice(0, 40);
    if (!nextName) return;
    setProfileDraft(nextName);
    setProfileName(nextName);
    setCloudStatus(isCloudConfigured() ? 'connecting' : 'local');
  }

  const topicMastery = (topic: string) => {
    const topicConcepts = concepts.filter((concept) => concept.topic === topic);
    const passedStages = topicConcepts.reduce((sum, concept) => sum + (['recognise', 'recall', 'apply'] as ConceptStage[])
      .filter((stage) => questionStagePassed(concept.id, stage)).length, 0);
    return topicConcepts.length ? Math.round((passedStages / (topicConcepts.length * 3)) * 100) : 0;
  };

  const conceptMastery = (conceptId?: string) => {
    if (!conceptId) return 0;
    const passed = (['recognise', 'recall', 'apply'] as ConceptStage[]).filter((stage) => questionStagePassed(conceptId, stage)).length;
    return Math.round((passed / 3) * 100);
  };

  const totalAttempts = Object.values(stats).reduce((sum, item) => sum + item.attempts, 0);
  const totalCorrect = Object.values(stats).reduce((sum, item) => sum + item.correct, 0);
  const totalActive = sessions.reduce((sum, session) => sum + session.activeSeconds, 0);
  const overallMastery = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const masteredConcepts = concepts.filter((concept) => (['recognise', 'recall', 'apply'] as ConceptStage[])
    .every((stage) => questionStagePassed(concept.id, stage))).length;
  const masteredGraphs = graphQuestionIds.filter((id) => (stats[id]?.streak ?? 0) >= 2).length;
  const courseMastery = Math.round(((masteredConcepts * 3 + masteredGraphs) / (concepts.length * 3 + graphQuestionIds.length)) * 100);

  function exportCsv() {
    const rows = [['题目ID', '单元', '主题', '知识点', '练习层级', '尝试次数', '正确次数', '错误次数', '连续答对', '最后练习']];
    Object.entries(stats).forEach(([questionId, item]) => {
      const question = questions.find((candidate) => candidate.id === questionId);
      const concept = question?.conceptId ? concepts.find((candidate) => candidate.id === question.conceptId) : null;
      rows.push([
        questionId,
        question?.unit ?? 'GRAPH',
        question?.topicZh ?? '图形训练',
        concept ? `${concept.termZh} / ${concept.termEn}` : question?.promptZh ?? questionId.replace('graph:', ''),
        question?.stage ? stageMeta[question.stage].label : '专项练习',
        String(item.attempts), String(item.correct), String(item.wrong), String(item.streak), item.lastAnswered,
      ]);
    });
    const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `EconLab-${profileName}-学习记录.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const optionRound = Math.max(0, (stats[currentQuestion.id]?.attempts ?? 0) - (checked !== null ? 1 : 0));
  const displayedOptions = reorderOptions(currentQuestion.options ?? [], `${currentQuestion.id}:${optionRound}`);
  const fillWordBank = (() => {
    if (currentQuestion.kind !== 'fill') return [];
    const correct = currentQuestion.accepted?.[0] ?? '';
    const related = questions.filter((question) => question.kind === 'fill' && question.topic === currentQuestion.topic && question.id !== currentQuestion.id)
      .map((question) => question.accepted?.[0] ?? '').filter(Boolean);
    return reorderOptions([...new Set([correct, ...related.slice(0, 2)])], `fill:${currentQuestion.id}`).map((item) => item.item);
  })();
  const currentConceptMastery = conceptMastery(currentConcept?.id);
  const currentTopicMastery = topicMastery(currentQuestion.topic);
  const totalMistakes = mistakeQuestions.length + mistakeGraphIds.length;
  const canCheck = currentQuestion.kind === 'choice' ? selectedChoice !== null : fillAnswer.trim().length > 0;

  function speakCurrentQuestion() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt);
    utterance.lang = 'en-GB';
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }
  return (
    <main className={`app-shell ${focusMode ? 'focus-mode' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={openToday} aria-label="EconLab 首页">
          {/* Native image loading keeps this shared build compatible with both Next.js and Vinext. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src={`${ASSET_BASE_PATH}/logo.png`} alt="Young Education" width="159" height="62" />
          <span className="brand-divider" />
          <span><strong>经济学通关</strong><small>ECONOMICS PRACTICE</small></span>
        </button>
        <div className="header-tools">
          <div className="help-switch" aria-label="语言辅助等级">
            <button className={helpLevel === 'assist' ? 'active' : ''} onClick={() => setHelpLevel('assist')}>双语辅助</button>
            <button className={helpLevel === 'standard' ? 'active' : ''} onClick={() => setHelpLevel('standard')}>关键词提示</button>
            <button className={helpLevel === 'exam' ? 'active' : ''} onClick={() => setHelpLevel('exam')}>全英文</button>
          </div>
          <button className={`focus-toggle ${focusMode ? 'active' : ''}`} onClick={() => setFocusMode((value) => !value)}>{focusMode ? '退出专注' : '专注练习'}</button>
          <div className={`cloud-pill ${cloudStatus}`} title="学习记录保存状态">{cloudStatus === 'synced' ? '本次记录已保存' : cloudStatus === 'connecting' ? '正在保存' : cloudStatus === 'error' ? '稍后自动重试' : '已保存在本机'}</div>
          <div className="session-pill"><span className="pulse" />有效学习 <strong>{formatTime(activeSeconds)}</strong></div>
          <button className="profile-pill" onClick={() => setMode('records')}>{profileName.slice(0, 1)}</button>
        </div>
      </header>

      {mode === 'practice' && !selectedTopic && <section className="compact-hero" id="top">
        <div><p className="eyebrow">TODAY · 今日小任务</p><h1>{completedToday >= 12 ? '今天完成了，做得很好。' : `现在只做第 ${Math.min(12, completedToday + 1)} 步。`}</h1><p>今天共 12 步：9 次概念练习 + 3 次图形练习。一次只看一道，不用担心整本讲义。</p></div>
        <div className="today-card"><div className="ring" style={{ background: `conic-gradient(var(--brand) ${Math.min(100, completedToday / 12 * 100)}%, #eaddc7 0)` }}><span>{completedToday}<small>/12</small></span></div><div><p>今日进度</p><strong>{completedToday >= 12 ? '任务已完成' : `还剩 ${12 - completedToday} 步`}</strong><small>概念与图形都会计入 · 已答对 {correctToday} 次</small></div></div>
      </section>}

      <nav className="mode-tabs" aria-label="练习模式">
        <button className={mode === 'practice' && !selectedTopic ? 'active' : ''} onClick={openToday}>今日 12 步 <span>{Math.min(12, completedToday)}</span></button>
        <button className={mode === 'chapters' || selectedTopic ? 'active' : ''} onClick={() => setMode('chapters')}>章节练习</button>
        <button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}>图形训练室</button>
        <button className={mode === 'mistakes' ? 'active' : ''} onClick={() => setMode('mistakes')}>需要再练 <span className="warn">{totalMistakes}</span></button>
        <button className={mode === 'records' ? 'active' : ''} onClick={() => setMode('records')}>我的进度</button>
      </nav>

      {mode === 'practice' && dailyGraphActive && <section className="daily-graph-step">
        <div className="daily-step-banner"><span>第 {Math.min(12, completedToday + (dailyGraphDone ? 0 : 1))} 步</span><div><strong>今天的图形关</strong><p>完成一次绘图或读图判断。图形也会进入错题与间隔复习。</p></div><b>{dailyGraphDone ? '已完成 ✓' : '完成后继续概念题'}</b></div>
        <GraphLab onAttempt={recordDailyGraphAttempt} />
        {dailyGraphDone && <div className="daily-graph-continue"><button className="primary-button" onClick={() => { setDailyGraphActive(false); setDailyGraphDone(false); chooseNext(); }}>返回今日练习 →</button></div>}
      </section>}

      {mode === 'practice' && !dailyGraphActive && (
        <section className="practice-layout">
          <article className="question-card">
            <div className="question-meta"><span className="unit-tag">{currentQuestion.unit} · {currentQuestion.topicZh}</span><span>本次已完成 {completedToday} 题</span></div>
            <div className="progress"><i style={{ width: `${Math.min(100, completedToday / 12 * 100)}%` }} /></div>
            <div className="question-heading"><span className="question-number">{String((completedToday % 12) + 1).padStart(2, '0')}</span><div><p className="question-type">{currentQuestion.stage && <span className={`stage-chip ${currentQuestion.stage}`}>{stageMeta[currentQuestion.stage].short} · {stageMeta[currentQuestion.stage].label}</span>}{currentQuestion.kind === 'choice' ? '单项选择 · MULTIPLE CHOICE' : '关键词填空 · FILL THE BLANK'}</p><div className="prompt-row"><h2>{currentQuestion.prompt}</h2><button className="speak-button" onClick={speakCurrentQuestion} aria-label="朗读英文题目" title="慢速朗读英文">▶</button></div>{helpLevel === 'assist' && <p className="translation">{currentQuestion.promptZh}</p>}</div></div>
            {helpLevel !== 'exam' && <div className="keyword-help"><span>{helpLevel === 'assist' ? '双语拆解' : '关键词'}</span><p>{currentQuestion.keywords.map(([english, chinese]) => <span key={english}><strong>{english}</strong>{helpLevel === 'assist' ? ` ${chinese}` : ''}　</span>)}</p></div>}
            {currentQuestion.kind === 'choice' && currentQuestion.options && <div className="answers">{displayedOptions.map(({ item: option, originalIndex }, displayIndex) => { const selected = selectedChoice === originalIndex; const showCorrect = checked !== null && originalIndex === currentQuestion.answerIndex; const showWrong = checked === false && selected; return <button key={`${originalIndex}:${option}`} disabled={checked !== null} className={`${selected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`} onClick={() => setSelectedChoice(originalIndex)}><span>{String.fromCharCode(65 + displayIndex)}</span>{option}{showCorrect && <b>✓</b>}{showWrong && <b>×</b>}</button>; })}</div>}
            {currentQuestion.kind === 'fill' && <div className="fill-area"><label htmlFor="fill-answer">Your answer · 输入英文答案</label>{helpLevel === 'assist' && fillWordBank.length > 1 && <div className="word-bank"><span>可选词</span>{fillWordBank.map((word) => <button key={word} disabled={checked !== null} onClick={() => setFillAnswer(word)}>{word}</button>)}</div>}<div><input id="fill-answer" autoComplete="off" value={fillAnswer} disabled={checked !== null} onChange={(event) => setFillAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && canCheck) checkCurrent(); }} placeholder="Type the missing word..." />{checked !== null && <span className={checked ? 'ok' : 'no'}>{checked ? '✓' : '×'}</span>}</div><small>大小写不影响结果；较长单词允许 1 个字母的轻微拼写错误。</small></div>}
            {showHint && checked === null && helpLevel !== 'exam' && <div className="hint-box"><strong>提示</strong>{currentQuestion.hint}</div>}
            {checked !== null && <div className={`feedback ${checked ? 'is-correct' : 'is-wrong'}`} role="status"><strong>{checked ? (stats[currentId]?.streak ?? 0) >= 2 ? '这一关已通过。' : '答对了，稍后会再次确认。' : '没关系，这道题会很快再出现。'}</strong>{helpLevel === 'exam' ? <p>{checked ? 'Correct.' : `Correct answer: ${correctAnswer(currentQuestion)}`}</p> : <div className="feedback-steps"><p><span>{checked ? '为什么正确' : '错在哪里'}</span>{currentQuestion.explanationZh}</p><p><span>记忆句</span>{currentQuestion.promptZh} → <b>{correctAnswer(currentQuestion)}</b></p><p><span>下一步</span>{checked ? '先继续做题，系统会在合适的时间再次检查。' : '看一遍正确答案，继续前进；3 题后重新作答。'}</p></div>}</div>}
            <footer className="question-actions">{helpLevel !== 'exam' ? <button className="ghost-button" onClick={() => setShowHint((value) => !value)} disabled={checked !== null}>{showHint ? '收起提示' : '给我一个提示'}</button> : <span />}{checked === null ? <button className="primary-button" disabled={!canCheck} onClick={checkCurrent}>检查答案 <span>→</span></button> : <button className="primary-button" onClick={chooseNext}>下一题 <span>→</span></button>}</footer>
          </article>
          <aside className="side-panel">
            <div className="panel-heading"><div><p className="eyebrow">当前知识点</p><h3>{currentConcept?.termZh ?? currentQuestion.topicZh}</h3>{currentConcept && <small>{currentConcept.termEn}</small>}</div><strong>{currentConceptMastery}%</strong></div>
            <div className="mastery-message"><span className={`status-dot ${currentConceptMastery >= 70 ? 'good' : currentConceptMastery > 0 ? 'mid' : 'low'}`} /><div><strong>{masteryLabel(currentConceptMastery)}</strong><p>本知识点 {currentConceptMastery}% · 所属章节 {currentTopicMastery}%</p></div></div>
            {currentConcept && <div className="stage-ladder">{(['recognise', 'recall', 'apply'] as ConceptStage[]).map((stage) => { const state = conceptStageState(currentConcept.id, stage); return <div key={stage} className={state}><span>{stageMeta[stage].short}</span><p><strong>{stageMeta[stage].label}</strong><small>{state === 'passed' ? '已通过' : state === 'learning' ? '练习中' : '未开始'}</small></p></div>; })}</div>}
            <div className="quick-stats"><div><b>{stats[currentId]?.attempts ?? 0}</b><span>尝试</span></div><div><b>{stats[currentId]?.wrong ?? 0}</b><span>错误</span></div><div><b>{stats[currentId]?.streak ?? 0}</b><span>连对</span></div></div>
            <div className="mini-chart" aria-label="需求曲线示意图"><span className="axis-y">P</span><span className="axis-x">Q</span><i className="demand-line" /><b>D</b></div>
            <button className="chart-link" onClick={() => setMode('graph')}>进入图形训练室 <span>↗</span></button>
          </aside>
        </section>
      )}

      {mode === 'chapters' && <section className="page-card chapter-page"><div className="section-title-row"><div><p className="eyebrow">CHAPTER PRACTICE</p><h2>按小组打牢基础</h2><p>每组只练 6–8 个概念，完成后休息一下，再开始下一组。</p></div><span className="micro-pack-badge">每组约 6 分钟</span></div><div className="unit-columns">{(['U1', 'U2'] as const).map((unit) => <div className="unit-column" key={unit}><div className="unit-title"><span>{unit}</span><div><strong>{unit === 'U1' ? 'Markets in Action' : 'Macroeconomic Performance'}</strong><small>{unit === 'U1' ? '微观经济学' : '宏观经济学'}</small></div></div>{unitTopics[unit].map(([topic, label], index) => { const value = topicMastery(topic); const conceptCount = concepts.filter((concept) => concept.topic === topic).length; const packCount = Math.ceil(conceptCount / 7); return <button className="topic-row" key={topic} onClick={() => openQuestion(questions.find((question) => question.topic === topic)!, topic)}><span className="topic-index">{String(index + 1).padStart(2, '0')}</span><span className="topic-name"><strong>{label}</strong><small>{packCount} 个小组 · 每组 6–8 个概念</small></span><span className="topic-score"><b>{value}%</b><i><em style={{ width: `${value}%` }} /></i></span><span>→</span></button>; })}</div>)}</div></section>}

      {mode === 'graph' && <GraphLab onAttempt={recordGraphAttempt} />}

      {mode === 'mistakes' && <section className="page-card mistakes-page"><div className="section-title-row"><div><p className="eyebrow">REVIEW NEXT · 需要再练</p><h2>这里是下一步，不是惩罚。</h2><p>答错后会在本次练习中快速重现，并在 1、3、7、14 天后再次复习。</p></div><span className="big-count">{totalMistakes}<small>待巩固</small></span></div>{totalMistakes === 0 ? <div className="empty-state"><span>✓</span><h3>目前没有待巩固内容</h3><p>继续完成今日练习，新发现的薄弱概念和图形会自动来到这里。</p><button className="primary-button" onClick={openToday}>开始今日练习</button></div> : <div className="mistake-list">{mistakeQuestions.map((question) => <button key={question.id} onClick={() => openQuestion(question)}><span className="mistake-unit">{question.unit}</span><span><strong>{question.prompt}</strong><small>{question.topicZh} · 错误 {stats[question.id].wrong} 次 · 连对 {stats[question.id].streak}/2</small></span><b>重练 →</b></button>)}{mistakeGraphIds.length > 0 && <button onClick={() => setMode('graph')}><span className="mistake-unit graph">图</span><span><strong>图形专项有 {mistakeGraphIds.length} 项需要再练</strong><small>包括绘图方向、坐标轴、曲线标注或读图判断</small></span><b>进入图形室 →</b></button>}</div>}</section>}

      {mode === 'records' && <section className="page-card records-page">
        <div className="section-title-row"><div><p className="eyebrow">MY PROGRESS</p><h2>我的进度</h2><p>{cloudStatus === 'synced' ? '本次学习记录已保存，老师可以按学生姓名核对。' : cloudStatus === 'error' ? '暂时无法保存到云端，本机记录仍会保留并稍后重试。' : '当前记录已保存在本设备。'}</p></div><button className="export-button" onClick={exportCsv}>老师导出记录</button></div>
        <div className="student-identity"><label htmlFor="student-name"><span>学生姓名</span><input id="student-name" value={profileDraft} maxLength={40} onChange={(event) => setProfileDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveProfileName(); }} /></label><button className="ghost-button" onClick={saveProfileName} disabled={!profileDraft.trim() || profileDraft.trim() === profileName}>保存姓名</button><small>请填写真实姓名；练习时长、开始时间和答题记录会以此姓名同步。</small></div>
        <div className="coverage-banner"><div><span>课程掌握度</span><strong>{courseMastery}<small>%</small></strong></div><div><span>图形已通过</span><strong>{masteredGraphs}<small> / {graphQuestionIds.length}</small></strong></div><p>概念需要通过识别、英文回忆和情境应用三关；图形需要连续正确两次。全部内容仍可在下方展开查看。</p></div>
        <div className="record-summary"><div><span>总有效学习</span><strong>{Math.floor(totalActive / 60)}<small> 分钟</small></strong></div><div><span>累计答题</span><strong>{totalAttempts}<small> 题</small></strong></div><div><span>总体正确率</span><strong>{overallMastery}<small>%</small></strong></div><div><span>待巩固错题</span><strong>{mistakeQuestions.length}<small> 题</small></strong></div></div>
        <div className="records-grid"><div><h3>章节表现</h3><div className="topic-performance">{[...unitTopics.U1, ...unitTopics.U2].map(([topic, label]) => { const value = topicMastery(topic); return <div key={topic}><span>{label}</span><i><em style={{ width: `${value}%` }} /></i><b>{value}%</b></div>; })}</div></div><div><h3>最近练习</h3><div className="session-list">{sessions.slice().reverse().slice(0, 8).map((session, index) => <div key={session.id}><span className="session-date">{new Date(session.start).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}<small>{new Date(session.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small></span><span><b>{Math.floor(session.activeSeconds / 60)} 分钟</b><small>有效学习</small></span><span><b>{session.completed} 题</b><small>答题量</small></span><span><b>{session.completed ? Math.round(session.correct / session.completed * 100) : 0}%</b><small>正确率</small></span>{index === 0 && <em>本次</em>}</div>)}</div></div></div>
        <div className="knowledge-map"><div className="knowledge-map-title"><div><p className="eyebrow">KNOWLEDGE MAP</p><h3>知识点通关地图</h3></div><div className="stage-key"><span><i className="passed">认</i>识别</span><span><i className="passed">忆</i>回忆</span><span><i className="passed">用</i>应用</span></div></div>{[...unitTopics.U1, ...unitTopics.U2].map(([topic, label]) => { const topicConcepts = concepts.filter((concept) => concept.topic === topic); const mastered = topicConcepts.filter((concept) => (['recognise', 'recall', 'apply'] as ConceptStage[]).every((stage) => questionStagePassed(concept.id, stage))).length; const isOpen = Boolean(openKnowledgeTopics[topic]); return <details key={topic} open={isOpen} onToggle={(event) => setOpenKnowledgeTopics((current) => ({ ...current, [topic]: event.currentTarget.open }))}><summary><span>{label}</span><small>{mastered} / {topicConcepts.length} 完全掌握</small><b>{topicMastery(topic)}%</b></summary>{isOpen && <div className="concept-list">{topicConcepts.map((concept) => <div key={concept.id}><span><strong>{concept.termZh}</strong><small>{concept.termEn}</small></span><div>{(['recognise', 'recall', 'apply'] as ConceptStage[]).map((stage) => <i key={stage} title={stageMeta[stage].label} className={conceptStageState(concept.id, stage)}>{stageMeta[stage].short}</i>)}</div></div>)}</div>}</details>; })}</div>
      </section>}
    </main>
  );
}
