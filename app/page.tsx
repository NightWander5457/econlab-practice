'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ensureCloudIdentity, loadCloudProgress, syncCloudAttempt, syncCloudSession } from './cloud';
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

const graphTasks = [
  { id: 'demand', title: '画出需求曲线', prompt: 'Draw a demand curve and complete all labels.', promptZh: '从左上方向右下方画一条直线，并补全坐标轴与曲线名称。', slope: 'down', y: 'P', x: 'Q', curve: 'D' },
  { id: 'supply', title: '画出供给曲线', prompt: 'Draw a supply curve and complete all labels.', promptZh: '从左下方向右上方画一条直线，并补全坐标轴与曲线名称。', slope: 'up', y: 'P', x: 'Q', curve: 'S' },
  { id: 'ad', title: '画出总需求曲线', prompt: 'Draw an aggregate demand curve.', promptZh: '画出向右下方倾斜的 AD 曲线，并正确标注宏观坐标轴。', slope: 'down', y: 'Price level', x: 'Real output', curve: 'AD' },
  { id: 'lras', title: '画出古典 LRAS', prompt: 'Draw a classical long-run aggregate supply curve.', promptZh: '在潜在产出位置画一条竖直的 LRAS，并补全标注。', slope: 'vertical', y: 'Price level', x: 'Real output', curve: 'LRAS' },
] as const;

type Line = { start: { x: number; y: number }; end: { x: number; y: number } };
type GraphAttempt = { taskId: string; title: string; correct: boolean; answerText: string };

function GraphLab({ onAttempt }: { onAttempt: (attempt: GraphAttempt) => void }) {
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

  const labelOptions = ['P', 'Q', 'D', 'S', 'Price level', 'Real output', 'AD', 'LRAS'];
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
          <label>纵轴 Y-axis<select value={labels.y} onChange={(event) => setLabels({ ...labels, y: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>横轴 X-axis<select value={labels.x} onChange={(event) => setLabels({ ...labels, x: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>曲线 Curve<select value={labels.curve} onChange={(event) => setLabels({ ...labels, curve: event.target.value })}><option value="">选择标注</option>{labelOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
      </div>
      {result && <div className={`feedback ${result === 'correct' ? 'is-correct' : 'is-wrong'}`}><strong>{result === 'correct' ? '图形和标注全部正确。' : '还差一点，再检查方向和标注。'}</strong><p>{result === 'correct' ? '你已经完成这类基础直线图。下一步会逐渐加入曲线移动和均衡点。' : task.slope === 'down' ? '这条曲线应从左上方向右下方倾斜，并且三个标签都必须匹配。' : task.slope === 'up' ? '这条曲线应从左下方向右上方倾斜，并且三个标签都必须匹配。' : '古典 LRAS 应在潜在产出位置保持竖直，并使用宏观经济坐标轴。'}</p></div>}
      <div className="graph-actions"><button className="ghost-button" onClick={() => { setLine(null); setResult(null); }}>清空重画</button><button className="primary-button" onClick={result === 'correct' ? nextTask : checkGraph} disabled={!line}>{result === 'correct' ? '下一张图 →' : '检查图形 →'}</button></div>
    </section>
  );
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
  const [profileName, setProfileName] = useState('学生 A');
  const [profileDraft, setProfileDraft] = useState('学生 A');
  const [cloudStatus, setCloudStatus] = useState<'local' | 'connecting' | 'synced' | 'error'>(() => isCloudConfigured() ? 'connecting' : 'local');
  const lastActivityRef = useRef(0);
  const sessionIdRef = useRef('');
  const cloudUserIdRef = useRef<string | null>(null);
  const questionStartedAtRef = useRef(0);
  const lastSessionSyncRef = useRef({ active: -1, completed: -1 });

  const currentQuestion = questions.find((question) => question.id === currentId) ?? questions[0];
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
            if (!local || remote.attempts >= local.attempts) merged[questionId] = remote;
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
        setActiveSeconds((value) => value + 1);
        setSessions((items) => items.map((item) => item.id === sessionIdRef.current ? { ...item, activeSeconds: item.activeSeconds + 1 } : item));
      }
    }, 1000);
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

  const mistakeQuestions = useMemo(() => questions.filter((question) => (stats[question.id]?.wrong ?? 0) > 0 && (stats[question.id]?.streak ?? 0) < 2), [stats]);

  const recommended = useMemo(() => {
    const due = questions.filter((question) => (stats[question.id]?.wrong ?? 0) > 0 && (stats[question.id]?.streak ?? 0) < 2);
    const unseen = questions.filter((question) => !stats[question.id]);
    return [...due, ...unseen, ...questions].filter((question, index, array) => array.findIndex((item) => item.id === question.id) === index);
  }, [stats]);

  function resetQuestionState() {
    setSelectedChoice(null); setFillAnswer(''); setChecked(null); setShowHint(false);
    questionStartedAtRef.current = currentTimestamp();
  }

  function openQuestion(question: Question, topic: string | null = null) {
    setCurrentId(question.id); setSelectedTopic(topic); setMode('practice'); resetQuestionState();
  }

  function chooseNext() {
    const pool = selectedTopic ? questions.filter((question) => question.topic === selectedTopic) : recommended;
    const index = pool.findIndex((question) => question.id === currentId);
    const next = pool[(index + 1 + pool.length) % pool.length] ?? questions[0];
    setCurrentId(next.id); resetQuestionState();
  }

  function recordAttempt(question: Question, correct: boolean, answerText: string, responseMs: number) {
    const old = stats[question.id] || { attempts: 0, correct: 0, wrong: 0, streak: 0, lastCorrect: false, lastAnswered: '' };
    const next = { attempts: old.attempts + 1, correct: old.correct + (correct ? 1 : 0), wrong: old.wrong + (correct ? 0 : 1), streak: correct ? old.streak + 1 : 0, lastCorrect: correct, lastAnswered: new Date().toISOString() };
    const session = sessions.find((item) => item.id === sessionIdRef.current);
    const nextSession = session ? {
      ...session,
      completed: session.completed + 1,
      correct: session.correct + (correct ? 1 : 0),
    } : null;
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
    const next = {
      attempts: old.attempts + 1,
      correct: old.correct + (attempt.correct ? 1 : 0),
      wrong: old.wrong + (attempt.correct ? 0 : 1),
      streak: attempt.correct ? old.streak + 1 : 0,
      lastCorrect: attempt.correct,
      lastAnswered: new Date().toISOString(),
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
    setSelectedTopic(null); setMode('practice'); setCurrentId(recommended[0]?.id ?? questions[0].id); resetQuestionState();
  }

  function saveProfileName() {
    const nextName = profileDraft.trim().slice(0, 40);
    if (!nextName) return;
    setProfileDraft(nextName);
    setProfileName(nextName);
    setCloudStatus(isCloudConfigured() ? 'connecting' : 'local');
  }

  const topicMastery = (topic: string) => {
    const topicQuestions = questions.filter((question) => question.topic === topic);
    const attempted = topicQuestions.reduce((sum, question) => sum + (stats[question.id]?.attempts ?? 0), 0);
    const correct = topicQuestions.reduce((sum, question) => sum + (stats[question.id]?.correct ?? 0), 0);
    return attempted ? Math.round((correct / attempted) * 100) : 0;
  };

  const totalAttempts = Object.values(stats).reduce((sum, item) => sum + item.attempts, 0);
  const totalCorrect = Object.values(stats).reduce((sum, item) => sum + item.correct, 0);
  const totalActive = sessions.reduce((sum, session) => sum + session.activeSeconds, 0);
  const overallMastery = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  function exportCsv() {
    const rows = [['题目ID', '单元', '主题', '尝试次数', '正确次数', '错误次数', '最后练习']];
    questions.forEach((question) => {
      const item = stats[question.id];
      if (item) rows.push([question.id, question.unit, question.topicZh, String(item.attempts), String(item.correct), String(item.wrong), item.lastAnswered]);
    });
    const csv = `\ufeff${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `EconLab-${profileName}-学习记录.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const canCheck = currentQuestion.kind === 'choice' ? selectedChoice !== null : fillAnswer.trim().length > 0;
  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={openToday} aria-label="EconLab 首页">
          <span className="brand-mark">E</span><span><strong>EconLab</strong><small>基础经济学训练</small></span>
        </button>
        <div className="header-tools">
          <div className="help-switch" aria-label="语言辅助等级">
            <button className={helpLevel === 'assist' ? 'active' : ''} onClick={() => setHelpLevel('assist')}>辅助</button>
            <button className={helpLevel === 'standard' ? 'active' : ''} onClick={() => setHelpLevel('standard')}>标准</button>
            <button className={helpLevel === 'exam' ? 'active' : ''} onClick={() => setHelpLevel('exam')}>考试</button>
          </div>
          <div className={`cloud-pill ${cloudStatus}`} title="云端同步状态">{cloudStatus === 'synced' ? '☁ 已同步' : cloudStatus === 'connecting' ? '☁ 连接中' : cloudStatus === 'error' ? '☁ 待重试' : '本机记录'}</div>
          <div className="session-pill"><span className="pulse" />有效学习 <strong>{formatTime(activeSeconds)}</strong></div>
          <button className="profile-pill" onClick={() => setMode('records')}>{profileName.slice(0, 1)}</button>
        </div>
      </header>

      <section className="compact-hero" id="top">
        <div><p className="eyebrow">TODAY · 今日训练</p><h1>先理解，再记住，最后会用。</h1><p>系统会优先安排错题和未掌握概念。连续答对两次，才暂时离开错题本。</p></div>
        <div className="today-card"><div className="ring" style={{ background: `conic-gradient(var(--green) ${Math.min(100, completedToday / 12 * 100)}%, #dedbd1 0)` }}><span>{completedToday}<small>/12</small></span></div><div><p>今日目标</p><strong>完成 12 道基础题</strong><small>{completedToday >= 12 ? '今天的目标已完成' : `还差 ${12 - completedToday} 题 · 正确 ${correctToday} 题`}</small></div></div>
      </section>

      <nav className="mode-tabs" aria-label="练习模式">
        <button className={mode === 'practice' && !selectedTopic ? 'active' : ''} onClick={openToday}>今日复习 <span>{Math.min(12, recommended.length)}</span></button>
        <button className={mode === 'chapters' || selectedTopic ? 'active' : ''} onClick={() => setMode('chapters')}>章节练习</button>
        <button className={mode === 'graph' ? 'active' : ''} onClick={() => setMode('graph')}>图形训练室</button>
        <button className={mode === 'mistakes' ? 'active' : ''} onClick={() => setMode('mistakes')}>错题本 <span className="warn">{mistakeQuestions.length}</span></button>
        <button className={mode === 'records' ? 'active' : ''} onClick={() => setMode('records')}>学习记录</button>
      </nav>

      {mode === 'practice' && (
        <section className="practice-layout">
          <article className="question-card">
            <div className="question-meta"><span className="unit-tag">{currentQuestion.unit} · {currentQuestion.topicZh}</span><span>本次已完成 {completedToday} 题</span></div>
            <div className="progress"><i style={{ width: `${Math.min(100, completedToday / 12 * 100)}%` }} /></div>
            <div className="question-heading"><span className="question-number">{String((recommended.findIndex((item) => item.id === currentId) + 1) || 1).padStart(2, '0')}</span><div><p className="question-type">{currentQuestion.kind === 'choice' ? '单项选择 · MULTIPLE CHOICE' : '关键词填空 · FILL THE BLANK'}</p><h2>{currentQuestion.prompt}</h2>{helpLevel !== 'exam' && <p className="translation">{currentQuestion.promptZh}</p>}</div></div>
            {helpLevel === 'assist' && <div className="keyword-help"><span>语言辅助</span><p>{currentQuestion.keywords.map(([english, chinese]) => <span key={english}><strong>{english}</strong> {chinese}　</span>)}</p></div>}
            {currentQuestion.kind === 'choice' && currentQuestion.options && <div className="answers">{currentQuestion.options.map((option, index) => { const selected = selectedChoice === index; const showCorrect = checked !== null && index === currentQuestion.answerIndex; const showWrong = checked === false && selected; return <button key={option} disabled={checked !== null} className={`${selected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`} onClick={() => setSelectedChoice(index)}><span>{String.fromCharCode(65 + index)}</span>{option}{showCorrect && <b>✓</b>}{showWrong && <b>×</b>}</button>; })}</div>}
            {currentQuestion.kind === 'fill' && <div className="fill-area"><label htmlFor="fill-answer">Your answer · 输入英文答案</label><div><input id="fill-answer" autoComplete="off" value={fillAnswer} disabled={checked !== null} onChange={(event) => setFillAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && canCheck) checkCurrent(); }} placeholder="Type the missing word..." />{checked !== null && <span className={checked ? 'ok' : 'no'}>{checked ? '✓' : '×'}</span>}</div><small>大小写不影响结果；较长单词允许 1 个字母的轻微拼写错误。</small></div>}
            {showHint && checked === null && <div className="hint-box"><strong>提示</strong>{currentQuestion.hint}</div>}
            {checked !== null && <div className={`feedback ${checked ? 'is-correct' : 'is-wrong'}`} role="status"><strong>{checked ? '答对了，这个概念正在变稳。' : '这道题已加入错题复习。'}</strong><p>{currentQuestion.explanationZh}</p>{!checked && <p className="correct-answer">正确答案：<b>{correctAnswer(currentQuestion)}</b></p>}</div>}
            <footer className="question-actions"><button className="ghost-button" onClick={() => setShowHint((value) => !value)} disabled={checked !== null}>{showHint ? '收起提示' : '给我一个提示'}</button>{checked === null ? <button className="primary-button" disabled={!canCheck} onClick={checkCurrent}>检查答案 <span>→</span></button> : <button className="primary-button" onClick={chooseNext}>下一题 <span>→</span></button>}</footer>
          </article>
          <aside className="side-panel">
            <div className="panel-heading"><div><p className="eyebrow">MASTERY</p><h3>{currentQuestion.topicZh}</h3></div><strong>{topicMastery(currentQuestion.topic)}%</strong></div>
            <div className="mastery-message"><span className={`status-dot ${topicMastery(currentQuestion.topic) >= 70 ? 'good' : topicMastery(currentQuestion.topic) > 0 ? 'mid' : 'low'}`} /><div><strong>{masteryLabel(topicMastery(currentQuestion.topic))}</strong><p>正确率只是参考，系统还会观察连续答对和错题重练。</p></div></div>
            <div className="quick-stats"><div><b>{stats[currentId]?.attempts ?? 0}</b><span>尝试</span></div><div><b>{stats[currentId]?.wrong ?? 0}</b><span>错误</span></div><div><b>{stats[currentId]?.streak ?? 0}</b><span>连对</span></div></div>
            <div className="mini-chart" aria-label="需求曲线示意图"><span className="axis-y">P</span><span className="axis-x">Q</span><i className="demand-line" /><b>D</b></div>
            <button className="chart-link" onClick={() => setMode('graph')}>进入图形训练室 <span>↗</span></button>
          </aside>
        </section>
      )}

      {mode === 'chapters' && <section className="page-card chapter-page"><div className="section-title-row"><div><p className="eyebrow">CHAPTER PRACTICE</p><h2>按章节打牢基础</h2><p>先选单元，再选择一个小主题。每次只练一个知识范围。</p></div></div><div className="unit-columns">{(['U1', 'U2'] as const).map((unit) => <div className="unit-column" key={unit}><div className="unit-title"><span>{unit}</span><div><strong>{unit === 'U1' ? 'Markets in Action' : 'Macroeconomic Performance'}</strong><small>{unit === 'U1' ? '微观经济学' : '宏观经济学'}</small></div></div>{unitTopics[unit].map(([topic, label], index) => { const value = topicMastery(topic); const count = questions.filter((question) => question.topic === topic).length; return <button className="topic-row" key={topic} onClick={() => openQuestion(questions.find((question) => question.topic === topic)!, topic)}><span className="topic-index">{String(index + 1).padStart(2, '0')}</span><span className="topic-name"><strong>{label}</strong><small>{count} 道基础题</small></span><span className="topic-score"><b>{value}%</b><i><em style={{ width: `${value}%` }} /></i></span><span>→</span></button>; })}</div>)}</div></section>}

      {mode === 'graph' && <GraphLab onAttempt={recordGraphAttempt} />}

      {mode === 'mistakes' && <section className="page-card mistakes-page"><div className="section-title-row"><div><p className="eyebrow">MISTAKE REVIEW</p><h2>错题不是惩罚，是复习路线。</h2><p>连续答对两次后，题目会暂时离开这里。</p></div><span className="big-count">{mistakeQuestions.length}<small>待巩固</small></span></div>{mistakeQuestions.length === 0 ? <div className="empty-state"><span>✓</span><h3>目前没有待巩固的错题</h3><p>继续完成今日练习，新出现的薄弱题目会自动来到这里。</p><button className="primary-button" onClick={openToday}>开始今日练习</button></div> : <div className="mistake-list">{mistakeQuestions.map((question) => <button key={question.id} onClick={() => openQuestion(question)}><span className="mistake-unit">{question.unit}</span><span><strong>{question.prompt}</strong><small>{question.topicZh} · 错误 {stats[question.id].wrong} 次 · 连对 {stats[question.id].streak}/2</small></span><b>重练 →</b></button>)}</div>}</section>}

      {mode === 'records' && <section className="page-card records-page"><div className="section-title-row"><div><p className="eyebrow">LEARNING RECORD</p><h2>学习记录</h2><p>{cloudStatus === 'synced' ? '记录已同步到 Supabase，老师可以按学生姓名核对练习。' : cloudStatus === 'error' ? '云端暂时无法连接，本机记录仍会保留并在恢复后重试。' : '当前为本设备记录；配置 Supabase 环境变量后会自动启用云端同步。'}</p></div><button className="export-button" onClick={exportCsv}>导出 CSV</button></div><div className="student-identity"><label htmlFor="student-name"><span>学生姓名</span><input id="student-name" value={profileDraft} maxLength={40} onChange={(event) => setProfileDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveProfileName(); }} /></label><button className="ghost-button" onClick={saveProfileName} disabled={!profileDraft.trim() || profileDraft.trim() === profileName}>保存姓名</button><small>请填写真实姓名；练习时长、开始时间和答题记录会以此姓名同步。</small></div><div className="record-summary"><div><span>总有效学习</span><strong>{Math.floor(totalActive / 60)}<small> 分钟</small></strong></div><div><span>累计答题</span><strong>{totalAttempts}<small> 题</small></strong></div><div><span>总体正确率</span><strong>{overallMastery}<small>%</small></strong></div><div><span>待巩固错题</span><strong>{mistakeQuestions.length}<small> 题</small></strong></div></div><div className="records-grid"><div><h3>章节表现</h3><div className="topic-performance">{[...unitTopics.U1, ...unitTopics.U2].map(([topic, label]) => { const value = topicMastery(topic); return <div key={topic}><span>{label}</span><i><em style={{ width: `${value}%` }} /></i><b>{value}%</b></div>; })}</div></div><div><h3>最近练习</h3><div className="session-list">{sessions.slice().reverse().slice(0, 8).map((session, index) => <div key={session.id}><span className="session-date">{new Date(session.start).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}<small>{new Date(session.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</small></span><span><b>{Math.floor(session.activeSeconds / 60)} 分钟</b><small>有效学习</small></span><span><b>{session.completed} 题</b><small>答题量</small></span><span><b>{session.completed ? Math.round(session.correct / session.completed * 100) : 0}%</b><small>正确率</small></span>{index === 0 && <em>本次</em>}</div>)}</div></div></div></section>}
    </main>
  );
}
