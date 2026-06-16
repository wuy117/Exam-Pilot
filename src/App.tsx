import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Import,
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { sampleData } from './data/sampleData';
import {
  analyseGuidance,
  askExamExpert,
  generateFlashcards,
  generatePracticeQuestions,
  generateTimetable,
} from './services/ai';
import { exportData, importData, loadData, saveData } from './services/storage';
import type {
  AIMessage,
  ConfidenceLevel,
  ExamPilotData,
  FlashcardDifficulty,
  PracticeResult,
  PriorityLevel,
  Subject,
  TimetableMode,
  TimetableSession,
  WeakTopic,
} from './types';

const colours = ['#0f766e', '#2563eb', '#7c3aed', '#be123c', '#ca8a04', '#475569'];
const priorities: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];
const modes: TimetableMode[] = ['Light', 'Normal', 'Panic'];
const today = () => new Date().toISOString().slice(0, 10);
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const daysUntil = (date: string) => {
  const end = new Date(`${date}T12:00:00`);
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
};

const priorityRank: Record<PriorityLevel, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function App() {
  const [data, setData] = useState<ExamPilotData>(() => loadData());
  const [query, setQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [mode, setMode] = useState<TimetableMode>('Normal');

  useEffect(() => saveData(data), [data]);
  useEffect(() => {
    if (!activeSubjectId && data.subjects[0]) setActiveSubjectId(data.subjects[0].id);
  }, [activeSubjectId, data.subjects]);

  const activeSubject = data.subjects.find((subject) => subject.id === activeSubjectId);
  const filtered = useMemo(() => filterData(data, query), [data, query]);
  const analytics = useMemo(() => getAnalytics(data), [data]);
  const attention = useMemo(() => getAttentionList(data), [data]);

  const updateData = (updater: (current: ExamPilotData) => ExamPilotData) => setData((current) => updater(current));
  const upsertWeakTopic = (subjectId: string, topic: string, source: string, delta = 1) => {
    updateData((current) => {
      const found = current.weakTopics.find(
        (weak) => weak.subjectId === subjectId && weak.topic.toLowerCase() === topic.toLowerCase(),
      );
      const weakTopics = found
        ? current.weakTopics.map((weak) =>
            weak.id === found.id
              ? {
                  ...weak,
                  score: Math.min(10, weak.score + delta),
                  sources: Array.from(new Set([...weak.sources, source])),
                  updatedAt: new Date().toISOString(),
                }
              : weak,
          )
        : [
            ...current.weakTopics,
            { id: newId('weak'), subjectId, topic, score: Math.max(1, delta), sources: [source], updatedAt: new Date().toISOString() },
          ];
      return { ...current, weakTopics };
    });
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setData(await importData(file));
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_34%),linear-gradient(135deg,rgba(37,99,235,0.10),transparent_44%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-white/80 bg-white/80 p-4 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">ExamPilot</h1>
                <p className="text-sm text-slate-600">A calm revision operating system for serious GCSE and IGCSE preparation.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input pl-10"
                placeholder="Search subjects, guidance, flashcards..."
              />
            </label>
            <button className="btn-secondary" onClick={() => exportData(data)}>
              <Download size={17} /> Backup
            </button>
            <label className="btn-secondary cursor-pointer">
              <Upload size={17} /> Import
              <input className="hidden" type="file" accept="application/json" onChange={importBackup} />
            </label>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['Dashboard', Target],
            ['Guidance', FileText],
            ['Timetable', CalendarDays],
            ['Flashcards', BookOpen],
            ['Exam Expert AI', MessageSquareText],
            ['Practice', Brain],
            ['Analytics', BarChart3],
          ].map(([tab, Icon]) => (
            <button key={String(tab)} className={`tab ${activeTab === tab ? 'tab-active' : ''}`} onClick={() => setActiveTab(String(tab))}>
              <Icon size={16} /> {String(tab)}
            </button>
          ))}
        </nav>

        <main className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <SubjectForm onAdd={(subject) => updateData((current) => ({ ...current, subjects: [subject, ...current.subjects] }))} />
            <SubjectRail
              subjects={filtered.subjects}
              activeSubjectId={activeSubjectId}
              onSelect={setActiveSubjectId}
              weakTopics={data.weakTopics}
            />
            <button className="btn-secondary w-full justify-center" onClick={() => setData(sampleData)}>
              <Import size={17} /> Load labelled sample data
            </button>
          </aside>

          <section className="min-w-0">
            {activeTab === 'Dashboard' && (
              <Dashboard data={data} attention={attention} analytics={analytics} activeSubject={activeSubject} setTab={setActiveTab} />
            )}
            {activeTab === 'Guidance' && activeSubject && (
              <GuidancePanel
                data={data}
                subject={activeSubject}
                updateData={updateData}
                onWeakTopic={(topic) => upsertWeakTopic(activeSubject.id, topic, 'AI guidance analysis', 2)}
              />
            )}
            {activeTab === 'Timetable' && (
              <TimetablePanel data={data} updateData={updateData} mode={mode} setMode={setMode} />
            )}
            {activeTab === 'Flashcards' && activeSubject && (
              <FlashcardPanel data={data} subject={activeSubject} updateData={updateData} onWeakTopic={upsertWeakTopic} />
            )}
            {activeTab === 'Exam Expert AI' && (
              <ExamExpertPanel data={data} activeSubject={activeSubject} activeSubjectId={activeSubjectId} setActiveSubjectId={setActiveSubjectId} updateData={updateData} />
            )}
            {activeTab === 'Practice' && activeSubject && (
              <PracticePanel data={data} subject={activeSubject} updateData={updateData} onWeakTopic={upsertWeakTopic} />
            )}
            {activeTab === 'Analytics' && <AnalyticsPanel data={data} analytics={analytics} />}
            {!activeSubject && activeTab !== 'Dashboard' && activeTab !== 'Timetable' && activeTab !== 'Analytics' && (
              <EmptyState title="Add a subject to unlock this workspace" body="ExamPilot builds its recommendations from your subjects, exam dates, guidance, flashcards, and mistakes." />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function SubjectForm({ onAdd }: { onAdd: (subject: Subject) => void }) {
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState(today());
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [confidence, setConfidence] = useState<ConfidenceLevel>(3);
  const [colour, setColour] = useState(colours[0]);
  const [notes, setNotes] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: newId('subject'), name: name.trim(), examDate, priority, confidence, colour, notes, createdAt: new Date().toISOString() });
    setName('');
    setNotes('');
  };

  return (
    <form className="card space-y-3" onSubmit={submit}>
      <h2 className="section-title">Add Subject</h2>
      <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Chemistry" />
      <input className="input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as PriorityLevel)}>
          {priorities.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="input" value={confidence} onChange={(event) => setConfidence(Number(event.target.value) as ConfidenceLevel)}>
          {[1, 2, 3, 4, 5].map((item) => (
            <option key={item} value={item}>{`Confidence ${item}`}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        {colours.map((swatch) => (
          <button
            type="button"
            title={swatch}
            key={swatch}
            className={`h-7 flex-1 rounded-md border-2 ${colour === swatch ? 'border-slate-950' : 'border-white'}`}
            style={{ background: swatch }}
            onClick={() => setColour(swatch)}
          />
        ))}
      </div>
      <textarea className="input min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes, risks, teacher advice..." />
      <button className="btn-primary w-full justify-center">
        <Plus size={17} /> Add subject
      </button>
    </form>
  );
}

function SubjectRail({ subjects, activeSubjectId, onSelect, weakTopics }: { subjects: Subject[]; activeSubjectId: string; onSelect: (id: string) => void; weakTopics: WeakTopic[] }) {
  if (!subjects.length) return <EmptyState title="No subjects yet" body="Start empty, or load labelled sample data when you want to explore the flow." />;
  return (
    <div className="card space-y-3">
      <h2 className="section-title">Subjects</h2>
      {subjects.map((subject) => {
        const weakCount = weakTopics.filter((topic) => topic.subjectId === subject.id).length;
        return (
          <button key={subject.id} className={`subject-button ${activeSubjectId === subject.id ? 'subject-button-active' : ''}`} onClick={() => onSelect(subject.id)}>
            <span className="h-9 w-1.5 rounded-full" style={{ background: subject.colour }} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium">{subject.name}</span>
              <span className="text-xs text-slate-500">{daysUntil(subject.examDate)} days · {subject.priority} · {weakCount} weak</span>
            </span>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </div>
  );
}

function Dashboard({ data, attention, analytics, activeSubject, setTab }: { data: ExamPilotData; attention: string[]; analytics: ReturnType<typeof getAnalytics>; activeSubject?: Subject; setTab: (tab: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="hero">
        <div className="max-w-2xl">
          <p className="eyebrow">Today’s command brief</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">What should I revise next, and why?</h2>
          <p className="mt-3 text-slate-600">
            ExamPilot weighs exam distance, priority, confidence, missed questions, due cards, and stored guidance before suggesting the next useful action.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setTab('Timetable')}>
          <Sparkles size={17} /> Build timetable
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Subjects" value={data.subjects.length} />
        <Metric label="Completed sessions" value={analytics.sessionsCompleted} />
        <Metric label="Flashcards due" value={analytics.dueCards} />
        <Metric label="Revision time" value={`${analytics.revisionHours}h`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <h3 className="section-title">Needs Attention Today</h3>
          {attention.length ? (
            <div className="mt-4 space-y-3">
              {attention.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <AlertTriangle className="mt-0.5 text-amber-600" size={18} />
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No pressure signals yet" body="Add subjects, guidance, sessions, flashcards, or practice results to make the attention list meaningful." />
          )}
        </div>
        <div className="card">
          <h3 className="section-title">Active Context</h3>
          {activeSubject ? (
            <div className="mt-4 space-y-3">
              <SubjectSummary subject={activeSubject} />
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{activeSubject.notes || 'No subject notes yet.'}</p>
            </div>
          ) : (
            <EmptyState title="No active subject" body="Add a subject to start building context." />
          )}
        </div>
      </div>
    </div>
  );
}

function GuidancePanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (topic: string) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const subjectGuidance = data.guidance.filter((item) => item.subjectId === subject.id);

  const addGuidance = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    updateData((current) => ({
      ...current,
      guidance: [
        { id: newId('guidance'), subjectId: subject.id, title: title || `${subject.name} guidance`, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...current.guidance,
      ],
    }));
    setTitle('');
    setContent('');
  };

  const analyse = async (guidanceId: string, guidanceContent: string) => {
    const analysis = await analyseGuidance(subject, guidanceContent, data);
    analysis.likelyWeakAreas.forEach(onWeakTopic);
    updateData((current) => ({
      ...current,
      guidance: current.guidance.map((item) => (item.id === guidanceId ? { ...item, analysis, updatedAt: new Date().toISOString() } : item)),
    }));
  };

  return (
    <Panel title="Revision Guidance Library" subtitle={`${subject.name}: paste checklists, specifications, teacher advice, and mark-scheme notes.`}>
      <form className="grid gap-3 lg:grid-cols-[260px_1fr_auto]" onSubmit={addGuidance}>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Guidance title" />
        <textarea className="input min-h-24" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste revision guidance here..." />
        <button className="btn-primary self-start">
          <Plus size={17} /> Save
        </button>
      </form>
      <div className="mt-5 space-y-4">
        {subjectGuidance.length ? subjectGuidance.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>
              </div>
              <button className="btn-secondary shrink-0" onClick={() => analyse(item.id, item.content)}>
                <Sparkles size={17} /> Analyse with AI
              </button>
            </div>
            {item.analysis && <AnalysisGrid analysis={item.analysis} />}
          </article>
        )) : <EmptyState title="No guidance saved" body="Your AI context starts here. Paste the exact advice your teacher or specification gives you." />}
      </div>
    </Panel>
  );
}

function TimetablePanel({ data, updateData, mode, setMode }: { data: ExamPilotData; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; mode: TimetableMode; setMode: (mode: TimetableMode) => void }) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState<TimetableSession['type']>('revision');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('18:00');
  const [duration, setDuration] = useState(45);
  const [topic, setTopic] = useState('');

  const addSession = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    updateData((current) => ({
      ...current,
      sessions: [
        { id: newId('session'), subjectId: subjectId || undefined, title, type, date, startTime, durationMinutes: duration, mode, status: 'planned', topic },
        ...current.sessions,
      ],
    }));
    setTitle('');
    setTopic('');
  };

  const generate = async () => {
    const sessions = await generateTimetable(data, mode);
    updateData((current) => ({ ...current, sessions: [...sessions, ...current.sessions] }));
  };

  const updateSession = (id: string, patch: Partial<TimetableSession>) =>
    updateData((current) => ({ ...current, sessions: current.sessions.map((session) => (session.id === id ? { ...session, ...patch } : session)) }));

  const markSkipped = (session: TimetableSession) => {
    updateSession(session.id, { status: 'skipped' });
    const date = new Date(`${session.date}T12:00:00`);
    date.setDate(date.getDate() + 1);
    updateData((current) => ({
      ...current,
      sessions: [
        {
          ...session,
          id: newId('session'),
          date: date.toISOString().slice(0, 10),
          status: 'planned',
          reason: `Rescheduled because "${session.title}" was skipped.`,
        },
        ...current.sessions,
      ],
    }));
  };

  return (
    <Panel title="Smart Revision Timetable" subtitle="Blend fixed commitments with revision sessions, then generate a schedule from priority, exam dates, and weak areas.">
      <div className="mb-4 flex flex-wrap gap-2">
        {modes.map((item) => (
          <button key={item} className={`chip ${mode === item ? 'chip-active' : ''}`} onClick={() => setMode(item)}>{item}</button>
        ))}
        <button className="btn-primary ml-auto" onClick={generate}>
          <Sparkles size={17} /> Generate Timetable with AI
        </button>
      </div>
      <form className="grid gap-3 lg:grid-cols-6" onSubmit={addSession}>
        <input className="input lg:col-span-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Session or commitment" />
        <select className="input" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          <option value="">No subject</option>
          {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <select className="input" value={type} onChange={(event) => setType(event.target.value as TimetableSession['type'])}>
          {['revision', 'lesson', 'chapel', 'meal', 'music', 'prep', 'sport', 'free-time', 'exam'].map((item) => <option key={item}>{item}</option>)}
        </select>
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <input className="input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        <input className="input" type="number" min={10} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
        <input className="input lg:col-span-5" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic or purpose" />
        <button className="btn-secondary justify-center"><Plus size={17} /> Add</button>
      </form>
      <div className="mt-5 space-y-3">
        {data.sessions.length ? [...data.sessions]
          .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
          .map((session) => (
            <article key={session.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill">{session.type}</span>
                  <span className="pill">{session.mode}</span>
                  <span className={`pill ${session.status === 'done' ? 'bg-emerald-100 text-emerald-800' : session.status === 'skipped' ? 'bg-rose-100 text-rose-800' : ''}`}>{session.status}</span>
                </div>
                <h3 className="mt-2 font-semibold">{session.title}</h3>
                <p className="text-sm text-slate-600">{session.date} at {session.startTime} · {session.durationMinutes} min · {session.topic || 'No topic'}</p>
                {session.reason && <p className="mt-2 text-sm text-slate-500">{session.reason}</p>}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <button className="btn-secondary" onClick={() => updateSession(session.id, { status: 'done' })}><Check size={16} /> Done</button>
                <button className="btn-secondary" onClick={() => markSkipped(session)}>Skip</button>
                <input className="input w-32" type="time" value={session.startTime} onChange={(event) => updateSession(session.id, { startTime: event.target.value })} />
                <input className="input w-36" type="date" value={session.date} onChange={(event) => updateSession(session.id, { date: event.target.value })} />
              </div>
            </article>
          )) : <EmptyState title="No timetable yet" body="Add fixed commitments first, then generate revision around the real shape of your day." />}
      </div>
    </Panel>
  );
}

function FlashcardPanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void }) {
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const cards = data.flashcards.filter((card) => card.subjectId === subject.id);

  const addCard = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    updateData((current) => ({
      ...current,
      flashcards: [{ id: newId('card'), subjectId: subject.id, topic: topic || 'General', question, answer, difficulty: 'Good', nextReview: today(), createdAt: new Date().toISOString() }, ...current.flashcards],
    }));
    setQuestion('');
    setAnswer('');
    setTopic('');
  };

  const generate = async () => {
    const guidance = data.guidance.filter((item) => item.subjectId === subject.id).map((item) => item.content).join('\n');
    const cards = await generateFlashcards(subject, guidance, data);
    updateData((current) => ({ ...current, flashcards: [...cards, ...current.flashcards] }));
  };

  const review = (id: string, difficulty: FlashcardDifficulty, cardTopic: string) => {
    const days = { Again: 1, Hard: 2, Good: 5, Easy: 9 }[difficulty];
    const next = new Date();
    next.setDate(next.getDate() + days);
    if (difficulty === 'Again' || difficulty === 'Hard') onWeakTopic(subject.id, cardTopic, 'flashcard review', difficulty === 'Again' ? 2 : 1);
    updateData((current) => ({
      ...current,
      flashcards: current.flashcards.map((card) =>
        card.id === id ? { ...card, difficulty, lastReviewed: new Date().toISOString(), nextReview: next.toISOString().slice(0, 10) } : card,
      ),
    }));
  };

  return (
    <Panel title="Flashcards" subtitle={`${subject.name}: create cards manually or generate from saved guidance.`}>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={generate}><Sparkles size={17} /> Generate from guidance</button>
      </div>
      <form className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_auto]" onSubmit={addCard}>
        <input className="input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" />
        <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Question" />
        <input className="input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer" />
        <button className="btn-secondary"><Plus size={17} /> Add</button>
      </form>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {cards.length ? cards.map((card) => (
          <article key={card.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="pill">{card.topic}</span>
              <span className="text-xs text-slate-500">Next: {card.nextReview}</span>
            </div>
            <h3 className="mt-3 font-semibold">{card.question}</h3>
            <p className="mt-2 text-sm text-slate-600">{card.answer}</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(['Again', 'Hard', 'Good', 'Easy'] as FlashcardDifficulty[]).map((item) => (
                <button key={item} className="btn-compact" onClick={() => review(card.id, item, card.topic)}>{item}</button>
              ))}
            </div>
          </article>
        )) : <EmptyState title="No flashcards yet" body="Turn missed marks and guidance into cards. Due dates will stay honest." />}
      </div>
    </Panel>
  );
}

function ExamExpertPanel({ data, activeSubject, activeSubjectId, setActiveSubjectId, updateData }: { data: ExamPilotData; activeSubject?: Subject; activeSubjectId: string; setActiveSubjectId: (id: string) => void; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void }) {
  const [question, setQuestion] = useState('');
  const subjectMessages = data.aiMessages.filter((message) => !activeSubjectId || message.subjectId === activeSubjectId || !message.subjectId);
  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    const user: AIMessage = { id: newId('message'), role: 'user', content: question, createdAt: new Date().toISOString(), subjectId: activeSubjectId };
    const response = await askExamExpert(question, activeSubject, data);
    const assistant: AIMessage = {
      id: newId('message'),
      role: 'assistant',
      content: response,
      createdAt: new Date().toISOString(),
      subjectId: activeSubjectId,
      contextSummary: activeSubject ? `${activeSubject.name}, ${activeSubject.examDate}, confidence ${activeSubject.confidence}/5` : 'All available subjects',
    };
    updateData((current) => ({ ...current, aiMessages: [...current.aiMessages, user, assistant] }));
    setQuestion('');
  };

  return (
    <Panel title="Exam Expert AI" subtitle="Answers use the serverless AI backend when configured, with local fallback kept available. Context is shown openly.">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select className="input sm:w-72" value={activeSubjectId} onChange={(event) => setActiveSubjectId(event.target.value)}>
          <option value="">All subjects</option>
          {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <span className="text-sm text-slate-600">Using: {activeSubject ? `${activeSubject.name} · exam ${activeSubject.examDate}` : 'all stored revision context'}</span>
      </div>
      <div className="max-h-[460px] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
        {subjectMessages.length ? subjectMessages.map((message) => (
          <div key={message.id} className={`chat ${message.role === 'assistant' ? 'chat-ai' : 'chat-user'}`}>
            {message.contextSummary && <p className="mb-1 text-xs font-medium text-slate-500">Context: {message.contextSummary}</p>}
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          </div>
        )) : <EmptyState title="Ask a revision question" body="Try an essay plan, a simple explanation, a test prompt, or a targeted topic strategy." />}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={ask}>
        <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How should I revise Chemistry acids?" />
        <button className="btn-primary"><MessageSquareText size={17} /> Ask</button>
      </form>
    </Panel>
  );
}

function PracticePanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void }) {
  const [topic, setTopic] = useState('');
  const questions = data.practiceQuestions.filter((question) => question.subjectId === subject.id);
  const generate = async () => {
    const created = await generatePracticeQuestions(subject, topic || data.weakTopics.find((weak) => weak.subjectId === subject.id)?.topic || 'priority topic', data);
    updateData((current) => ({ ...current, practiceQuestions: [...created, ...current.practiceQuestions] }));
  };
  const mark = (id: string, result: PracticeResult, questionTopic: string) => {
    if (result !== 'correct') onWeakTopic(subject.id, questionTopic, 'practice mistake', result === 'incorrect' ? 3 : 1);
    updateData((current) => ({
      ...current,
      practiceQuestions: current.practiceQuestions.map((question) => (question.id === id ? { ...question, result } : question)),
    }));
  };
  return (
    <Panel title="Practice Mode" subtitle={`${subject.name}: quick quizzes, definitions, short answers, exam-style prompts, and essay planning.`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input className="input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic to practise" />
        <button className="btn-primary" onClick={generate}><Sparkles size={17} /> Generate quiz</button>
      </div>
      <div className="space-y-3">
        {questions.length ? questions.map((question) => (
          <article key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap gap-2">
              <span className="pill">{question.type}</span>
              <span className="pill">{question.topic}</span>
              {question.result && <span className="pill">{question.result}</span>}
            </div>
            <h3 className="mt-3 font-semibold">{question.prompt}</h3>
            {question.options && <div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <p key={option} className="rounded-md bg-slate-100 p-2 text-sm">{option}</p>)}</div>}
            <p className="mt-3 text-sm text-slate-600">Answer guide: {question.answerGuide}</p>
            {question.explanation && <p className="mt-2 text-sm text-slate-600">Explanation: {question.explanation}</p>}
            {question.markSchemePoints?.length ? (
              <div className="mt-3 rounded-md bg-slate-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Mark-scheme points</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {question.markSchemePoints.map((point) => <li key={point}>• {point}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {(['correct', 'partial', 'incorrect'] as PracticeResult[]).map((result) => (
                <button key={result} className="btn-secondary" onClick={() => mark(question.id, result, question.topic)}>{result}</button>
              ))}
            </div>
          </article>
        )) : <EmptyState title="No practice attempts yet" body="Generate questions from a topic, then mark honestly. Mistakes become weak-topic signals." />}
      </div>
    </Panel>
  );
}

function AnalyticsPanel({ data, analytics }: { data: ExamPilotData; analytics: ReturnType<typeof getAnalytics> }) {
  return (
    <Panel title="Progress and Analytics" subtitle="Honest signals only: no invented streaks, no fake mastery.">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Total revision time" value={`${analytics.revisionHours}h`} />
        <Metric label="Sessions completed" value={analytics.sessionsCompleted} />
        <Metric label="Flashcards due" value={analytics.dueCards} />
        <Metric label="Weak topics" value={data.weakTopics.length} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="card-flat lg:col-span-2">
          <h3 className="section-title">Confidence by Subject</h3>
          {data.subjects.length ? data.subjects.map((subject) => (
            <div key={subject.id} className="mt-4">
              <div className="mb-1 flex justify-between text-sm"><span>{subject.name}</span><span>{subject.confidence}/5</span></div>
              <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full" style={{ width: `${subject.confidence * 20}%`, background: subject.colour }} /></div>
            </div>
          )) : <EmptyState title="No confidence data" body="Add subjects to see honest confidence tracking." />}
        </div>
        <div className="card-flat">
          <h3 className="section-title">Weakest Topics</h3>
          {data.weakTopics.length ? [...data.weakTopics].sort((a, b) => b.score - a.score).slice(0, 6).map((weak) => (
            <p key={weak.id} className="mt-3 rounded-md bg-slate-100 p-3 text-sm">{subjectName(data, weak.subjectId)} · {weak.topic} · score {weak.score}</p>
          )) : <EmptyState title="No weak topics logged" body="Practice mistakes, hard flashcards, and AI analysis will populate this." />}
        </div>
      </div>
    </Panel>
  );
}

function SubjectSummary({ subject }: { subject: Subject }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-2 rounded-full" style={{ background: subject.colour }} />
        <div>
          <h3 className="font-semibold">{subject.name}</h3>
          <p className="text-sm text-slate-600">{daysUntil(subject.examDate)} days until exam · {subject.priority} priority · confidence {subject.confidence}/5</p>
        </div>
      </div>
    </div>
  );
}

function AnalysisGrid({ analysis }: { analysis: NonNullable<import('./types').RevisionGuidance['analysis']> }) {
  const sections = [
    ['Key topics', analysis.keyTopics],
    ['Subtopics', analysis.subtopics],
    ['Priority areas', analysis.priorityAreas],
    ['Question types', analysis.examQuestionTypes],
    ['Suggested tasks', analysis.suggestedRevisionTasks],
    ['Likely weak areas', analysis.likelyWeakAreas],
  ];
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      {sections.map(([title, items]) => (
        <div key={String(title)} className="rounded-lg bg-slate-50 p-3">
          <h4 className="text-sm font-semibold">{String(title)}</h4>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {(items as string[]).map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-flat">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-5">
        <p className="eyebrow">ExamPilot</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-5 text-center">
      <Clock3 className="mx-auto text-slate-400" size={24} />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function filterData(data: ExamPilotData, query: string) {
  if (!query.trim()) return data;
  const q = query.toLowerCase();
  const subjectIds = new Set(data.subjects.filter((subject) => `${subject.name} ${subject.notes}`.toLowerCase().includes(q)).map((subject) => subject.id));
  data.guidance.forEach((item) => {
    if (`${item.title} ${item.content}`.toLowerCase().includes(q)) subjectIds.add(item.subjectId);
  });
  data.flashcards.forEach((card) => {
    if (`${card.topic} ${card.question} ${card.answer}`.toLowerCase().includes(q)) subjectIds.add(card.subjectId);
  });
  return { ...data, subjects: data.subjects.filter((subject) => subjectIds.has(subject.id)) };
}

function getAnalytics(data: ExamPilotData) {
  const sessionsCompleted = data.sessions.filter((session) => session.status === 'done').length;
  const revisionMinutes = data.sessions.filter((session) => session.status === 'done' && session.type === 'revision').reduce((total, session) => total + session.durationMinutes, 0);
  return {
    sessionsCompleted,
    revisionHours: Math.round((revisionMinutes / 60) * 10) / 10,
    dueCards: data.flashcards.filter((card) => card.nextReview <= today()).length,
  };
}

function getAttentionList(data: ExamPilotData) {
  const items: string[] = [];
  [...data.subjects]
    .sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate) || priorityRank[b.priority] - priorityRank[a.priority])
    .slice(0, 3)
    .forEach((subject) => {
      const days = daysUntil(subject.examDate);
      if (days <= 21 || subject.priority === 'Critical' || subject.confidence <= 2) {
        const weak = data.weakTopics.find((topic) => topic.subjectId === subject.id)?.topic;
        items.push(`${subject.name}: ${days} days to exam, ${subject.priority.toLowerCase()} priority, confidence ${subject.confidence}/5${weak ? `. Start with ${weak}.` : '.'}`);
      }
    });
  const due = data.flashcards.filter((card) => card.nextReview <= today()).length;
  if (due) items.push(`${due} flashcard${due === 1 ? '' : 's'} due today. Do retrieval before re-reading notes.`);
  const skipped = data.sessions.filter((session) => session.status === 'skipped').length;
  if (skipped) items.push(`${skipped} skipped session${skipped === 1 ? '' : 's'} need rescheduling or a smaller replacement task.`);
  return items;
}

function subjectName(data: ExamPilotData, id: string) {
  return data.subjects.find((subject) => subject.id === id)?.name ?? 'Unknown subject';
}

export default App;
