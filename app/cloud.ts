import { getSupabaseClient } from './supabase';

export type CloudProgress = {
  attempts: number;
  correct: number;
  wrong: number;
  streak: number;
  lastCorrect: boolean;
  lastAnswered: string;
};

export type CloudSession = {
  id: string;
  start: string;
  activeSeconds: number;
  completed: number;
  correct: number;
};

export async function ensureCloudIdentity(displayName: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;

  let user = sessionResult.data.session?.user;
  if (!user) {
    const signInResult = await supabase.auth.signInAnonymously({
      options: { data: { display_name: displayName } },
    });
    if (signInResult.error) throw signInResult.error;
    user = signInResult.data.user ?? undefined;
  }

  if (!user) throw new Error('Unable to create a student identity.');

  const profileResult = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: displayName,
  }, { onConflict: 'id' });
  if (profileResult.error) throw profileResult.error;

  return user.id;
}

export async function loadCloudProgress(userId: string): Promise<Record<string, CloudProgress>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const result = await supabase
    .from('question_progress')
    .select('question_id, attempts, correct_count, wrong_count, streak, last_correct, last_answered_at')
    .eq('student_id', userId);
  if (result.error) throw result.error;

  return Object.fromEntries((result.data ?? []).map((row) => [row.question_id, {
    attempts: row.attempts,
    correct: row.correct_count,
    wrong: row.wrong_count,
    streak: row.streak,
    lastCorrect: row.last_correct,
    lastAnswered: row.last_answered_at,
  } satisfies CloudProgress]));
}

export async function syncCloudSession(userId: string, session: CloudSession) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const result = await supabase.from('practice_sessions').upsert({
    id: session.id,
    student_id: userId,
    started_at: session.start,
    ended_at: new Date().toISOString(),
    active_seconds: session.activeSeconds,
    completed_count: session.completed,
    correct_count: session.correct,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (result.error) throw result.error;
}

export async function syncCloudAttempt(input: {
  userId: string;
  sessionId: string;
  questionId: string;
  unit: 'U1' | 'U2' | 'GRAPH';
  topic: string;
  correct: boolean;
  answerText: string;
  responseMs: number;
  helpLevel: 'assist' | 'standard' | 'exam';
  progress: CloudProgress;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const [attemptResult, progressResult] = await Promise.all([
    supabase.from('attempts').insert({
      student_id: input.userId,
      session_id: input.sessionId,
      question_id: input.questionId,
      unit: input.unit,
      topic: input.topic,
      correct: input.correct,
      answer_text: input.answerText,
      response_ms: input.responseMs,
      help_level: input.helpLevel,
    }),
    supabase.from('question_progress').upsert({
      student_id: input.userId,
      question_id: input.questionId,
      attempts: input.progress.attempts,
      correct_count: input.progress.correct,
      wrong_count: input.progress.wrong,
      streak: input.progress.streak,
      last_correct: input.progress.lastCorrect,
      last_answered_at: input.progress.lastAnswered,
    }, { onConflict: 'student_id,question_id' }),
  ]);

  if (attemptResult.error) throw attemptResult.error;
  if (progressResult.error) throw progressResult.error;
}
