import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  Download,
  FileText,
  Flame,
  Import,
  Keyboard,
  Layers3,
  Library,
  ListChecks,
  Loader2,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
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
  subscribeAIBackendStatus,
  type AIBackendStatus,
} from './services/ai';
import { extractPdfText } from './services/pdf';
import { exportData, importData, loadData, saveData } from './services/storage';
import type {
  AIMessage,
  ConfidenceLevel,
  ExamPilotData,
  Flashcard,
  FlashcardDifficulty,
  KnowledgeDocument,
  KnowledgeDocumentType,
  PastPaperItem,
  PracticeQuestion,
  PracticeResult,
  PriorityLevel,
  Subject,
  TimetableMode,
  TimetableSession,
  TopicMastery,
  WeakTopic,
} from './types';

type View = 'Dashboard' | 'Subject' | 'Guidance' | 'Timetable' | 'Flashcards' | 'AI' | 'Practice' | 'Papers' | 'Review' | 'Analytics';
type FlashcardSettings = 'definitions' | 'exam questions' | 'dates' | 'formulas' | 'vocab' | 'essay evidence';

const today = () => new Date().toISOString().slice(0, 10);
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const priorities: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];
const modes: TimetableMode[] = ['Light', 'Normal', 'Panic'];
const swatches = ['#334155', '#0f766e', '#1d4ed8', '#6d28d9', '#9f1239', '#a16207'];
const navItems: Array<[View, ReactNode, string]> = [
  ['Dashboard', <Target size={17} />, 'Overview'],
  ['Subject', <Layers3 size={17} />, 'Subject centre'],
  ['Guidance', <FileText size={17} />, 'Knowledge base'],
  ['Timetable', <CalendarDays size={17} />, 'Timetable'],
  ['Flashcards', <BookOpen size={17} />, 'Cards'],
  ['AI', <MessageSquareText size={17} />, 'Exam Expert'],
  ['Practice', <Brain size={17} />, 'Question bank'],
  ['Papers', <Library size={17} />, 'Past papers'],
  ['Review', <ListChecks size={17} />, 'Daily review'],
  ['Analytics', <BarChart3 size={17} />, 'Analytics'],
];

const priorityRank: Record<PriorityLevel, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function App() {
  const [data, setData] = useState<ExamPilotData>(() => loadData());
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<View>('Dashboard');
  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [mode, setMode] = useState<TimetableMode>('Normal');
  const [aiStatus, setAiStatus] = useState<AIBackendStatus>('idle');
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => saveData(data), 250);
    return () => window.clearTimeout(handle);
  }, [data]);
  useEffect(() => subscribeAIBackendStatus(setAiStatus), []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if ((event.key === '/' && !isTyping) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') setCommandOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!activeSubjectId && data.subjects[0]) setActiveSubjectId(data.subjects[0].id);
  }, [activeSubjectId, data.subjects]);

  const activeSubject = data.subjects.find((subject) => subject.id === activeSubjectId);
  const filteredSubjects = useMemo(() => filterSubjects(data, query), [data, query]);
  const analytics = useMemo(() => getAnalytics(data), [data]);
  const nextBlock = useMemo(() => getNextBestBlock(data), [data]);
  const attention = useMemo(() => getAttentionList(data), [data]);

  const updateData = (updater: (current: ExamPilotData) => ExamPilotData) => setData((current) => updater(current));
  const upsertWeakTopic = (subjectId: string, topic: string, source: string, delta = 1) => {
    updateData((current) => upsertWeakTopicInData(current, subjectId, topic, source, delta));
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setData(await importData(file));
    event.target.value = '';
  };

  const addAiMessage = (message: AIMessage) => {
    updateData((current) => ({ ...current, aiMessages: [...current.aiMessages, message] }));
  };

  const askTonight = async () => {
    const subject = nextBlock?.subject ?? activeSubject;
    const question = subject
      ? `What should I revise tonight for ${subject.name}, and why is it the priority?`
      : 'What should I revise tonight, and why is it the priority?';
    const answer = await askExamExpert(question, subject, data);
    addAiMessage({
      id: newId('message'),
      role: 'assistant',
      content: answer,
      createdAt: new Date().toISOString(),
      subjectId: subject?.id,
      contextSummary: subject ? `${subject.name}, exam ${subject.examDate}` : 'All subjects',
    });
    if (subject) setActiveSubjectId(subject.id);
    setActiveView('AI');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <div className="app-shell">
        <Sidebar
          subjects={filteredSubjects}
          activeSubjectId={activeSubjectId}
          activeView={activeView}
          query={query}
          aiStatus={aiStatus}
          onSearch={setQuery}
          onView={setActiveView}
          onSubject={(id) => {
            setActiveSubjectId(id);
            setActiveView('Subject');
          }}
          onSample={() => setData(sampleData)}
          onExport={() => exportData(data)}
          onImport={importBackup}
          onAddSubject={(subject) => updateData((current) => ({ ...current, subjects: [subject, ...current.subjects] }))}
        />

        <div className="main-stage">
          <TopBar
            query={query}
            activeSubject={activeSubject}
            aiStatus={aiStatus}
            onSearch={setQuery}
            onTonight={askTonight}
            onImport={importBackup}
            onExport={() => exportData(data)}
          />

          <main className="content-grid">
            {activeView === 'Dashboard' && (
              <Dashboard
                data={data}
                analytics={analytics}
                attention={attention}
                nextBlock={nextBlock}
                aiStatus={aiStatus}
                onTonight={askTonight}
                onView={setActiveView}
                onSubject={setActiveSubjectId}
              />
            )}
            {activeView === 'Subject' && activeSubject && (
              <SubjectCentre
                data={data}
                subject={activeSubject}
                updateData={updateData}
                onView={setActiveView}
                onWeakTopic={upsertWeakTopic}
                onAskTonight={askTonight}
              />
            )}
            {activeView === 'Guidance' && activeSubject && (
              <GuidancePanel
                data={data}
                subject={activeSubject}
                updateData={updateData}
                onWeakTopic={(topic) => upsertWeakTopic(activeSubject.id, topic, 'AI guidance analysis', 2)}
              />
            )}
            {activeView === 'Timetable' && (
              <TimetablePanel data={data} updateData={updateData} mode={mode} setMode={setMode} />
            )}
            {activeView === 'Flashcards' && (
              <FlashcardPanel data={data} activeSubject={activeSubject} updateData={updateData} onWeakTopic={upsertWeakTopic} />
            )}
            {activeView === 'AI' && (
              <ExamExpertPanel
                data={data}
                activeSubject={activeSubject}
                activeSubjectId={activeSubjectId}
                setActiveSubjectId={setActiveSubjectId}
                updateData={updateData}
                aiStatus={aiStatus}
                onWeakTopic={upsertWeakTopic}
              />
            )}
            {activeView === 'Practice' && activeSubject && (
              <PracticePanel data={data} subject={activeSubject} updateData={updateData} onWeakTopic={upsertWeakTopic} />
            )}
            {activeView === 'Papers' && activeSubject && (
              <PastPaperPanel data={data} subject={activeSubject} updateData={updateData} onWeakTopic={upsertWeakTopic} />
            )}
            {activeView === 'Review' && (
              <DailyReviewPanel data={data} analytics={analytics} nextBlock={nextBlock} onTonight={askTonight} onView={setActiveView} />
            )}
            {activeView === 'Analytics' && <AnalyticsPanel data={data} analytics={analytics} />}
            {!activeSubject && activeView !== 'Dashboard' && activeView !== 'Timetable' && activeView !== 'Analytics' && activeView !== 'Review' && (
              <EmptyState title="Add a subject to unlock this workspace" body="ExamPilot builds its recommendations from subjects, exam dates, guidance, flashcards, sessions, and mistakes." />
            )}
          </main>
        </div>
      </div>

      <MobileNav activeView={activeView} onView={setActiveView} />
      {commandOpen && (
        <CommandPalette
          subjects={data.subjects}
          onClose={() => setCommandOpen(false)}
          onView={(view) => {
            setActiveView(view);
            setCommandOpen(false);
          }}
          onSubject={(id) => {
            setActiveSubjectId(id);
            setActiveView('Subject');
            setCommandOpen(false);
          }}
          onTonight={() => {
            setCommandOpen(false);
            askTonight();
          }}
        />
      )}
    </div>
  );
}

function Sidebar({
  subjects,
  activeSubjectId,
  activeView,
  query,
  aiStatus,
  onSearch,
  onView,
  onSubject,
  onSample,
  onExport,
  onImport,
  onAddSubject,
}: {
  subjects: Subject[];
  activeSubjectId: string;
  activeView: View;
  query: string;
  aiStatus: AIBackendStatus;
  onSearch: (value: string) => void;
  onView: (view: View) => void;
  onSubject: (id: string) => void;
  onSample: () => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onAddSubject: (subject: Subject) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">EP</div>
        <div>
          <h1>ExamPilot</h1>
          <p>Revision command centre</p>
        </div>
      </div>

      <label className="command-input">
        <Command size={15} />
        <input value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Search everything" />
      </label>

      <div className="nav-section">
        {navItems.map(([view, icon, label]) => (
          <button key={view} className={`nav-item ${activeView === view ? 'nav-item-active' : ''}`} onClick={() => onView(view)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-block">
        <div className="sidebar-heading">Subjects</div>
        <div className="subject-stack">
          {subjects.length ? subjects.map((subject) => (
            <button key={subject.id} className={`subject-chip ${activeSubjectId === subject.id ? 'subject-chip-active' : ''}`} onClick={() => onSubject(subject.id)}>
              <span className="subject-colour" style={{ background: subject.colour }} />
              <span className="min-w-0">
                <span className="block truncate">{subject.name}</span>
                <span className="text-[11px] text-stone-500">{formatCountdown(subject.examDate)} · {subject.priority}</span>
              </span>
            </button>
          )) : <p className="empty-note">No subjects yet. Start clean or load sample data.</p>}
        </div>
      </div>

      <SubjectForm onAdd={onAddSubject} compact />

      <div className="sidebar-footer">
        <AIStatusPill status={aiStatus} />
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="icon-button" title="Backup" onClick={onExport}><Download size={15} /></button>
          <label className="icon-button cursor-pointer" title="Import">
            <Upload size={15} />
            <input className="hidden" type="file" accept="application/json" onChange={onImport} />
          </label>
          <button type="button" className="icon-button" title="Load sample data" onClick={onSample}><Import size={15} /></button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  query,
  activeSubject,
  aiStatus,
  onSearch,
  onTonight,
  onImport,
  onExport,
}: {
  query: string;
  activeSubject?: Subject;
  aiStatus: AIBackendStatus;
  onSearch: (value: string) => void;
  onTonight: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Today</p>
        <h2>{activeSubject ? `${activeSubject.name} in focus` : 'Exam season overview'}</h2>
      </div>
      <label className="top-search">
        <Search size={16} />
        <input value={query} onChange={(event) => onSearch(event.target.value)} placeholder="Search subjects, guidance, weak topics, cards" />
        <kbd>/</kbd>
      </label>
      <div className="top-actions">
        <AIStatusPill status={aiStatus} />
        <button className="btn-primary" onClick={onTonight}><Moon size={16} /> Tonight</button>
        <button className="icon-button" title="Backup" onClick={onExport}><Download size={16} /></button>
        <label className="icon-button cursor-pointer" title="Import">
          <Upload size={16} />
          <input className="hidden" type="file" accept="application/json" onChange={onImport} />
        </label>
      </div>
    </header>
  );
}

function Dashboard({
  data,
  analytics,
  attention,
  nextBlock,
  aiStatus,
  onTonight,
  onView,
  onSubject,
}: {
  data: ExamPilotData;
  analytics: ReturnType<typeof getAnalytics>;
  attention: string[];
  nextBlock?: NextBlock;
  aiStatus: AIBackendStatus;
  onTonight: () => void;
  onView: (view: View) => void;
  onSubject: (id: string) => void;
}) {
  const upcoming = [...data.subjects].sort((a, b) => a.examDate.localeCompare(b.examDate)).slice(0, 5);
  const todaySessions = sessionsForDate(data.sessions, today());
  const skipped = data.sessions.filter((session) => session.status === 'skipped').slice(0, 3);
  const dueCards = getDueCards(data.flashcards).slice(0, 4);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Command brief"
        title="What should I revise next?"
        subtitle="ExamPilot prioritises exam distance, subject confidence, weak topics, due cards, skipped work, and saved guidance."
        action={<button className="btn-primary" onClick={onTonight}><Sparkles size={16} /> Ask AI for tonight</button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="panel panel-dark">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow text-stone-300">Next best revision block</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-white">{nextBlock?.title ?? 'Add a subject to unlock priority guidance'}</h3>
              <p className="mt-3 text-sm leading-6 text-stone-300">{nextBlock?.reason ?? 'Once you add subjects, ExamPilot will explain what deserves attention and why.'}</p>
            </div>
            <div className="grid min-w-52 grid-cols-3 gap-2">
              <MiniStat label="Due" value={analytics.dueCards} dark />
              <MiniStat label="Weak" value={data.weakTopics.length} dark />
              <MiniStat label="Streak" value={`${analytics.streak}d`} dark />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-light" onClick={() => onView('Timetable')}><CalendarDays size={16} /> Schedule</button>
            <button className="btn-light" onClick={() => onView('Practice')}><Brain size={16} /> Generate quiz</button>
            <button className="btn-light" onClick={() => onView('Flashcards')}><BookOpen size={16} /> Review cards</button>
          </div>
        </section>

        <section className="panel">
          <div className="section-line">
            <div>
              <p className="eyebrow">AI recommendation</p>
              <h3 className="section-heading">Tonight’s decision support</h3>
            </div>
            <AIStatusPill status={aiStatus} />
          </div>
          <div className="mt-4 space-y-3">
            {(attention.length ? attention : ['No pressure signals yet. Add exam dates, guidance, or practice results to make recommendations sharper.']).slice(0, 4).map((item) => (
              <PriorityLine key={item} text={item} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Revision time" value={`${analytics.revisionHours}h`} sub="completed sessions" />
        <MetricCard label="Completed" value={analytics.sessionsCompleted} sub={`${analytics.skippedSessions} skipped`} />
        <MetricCard label="Flashcards due" value={analytics.dueCards} sub={`${analytics.overdueCards} overdue`} />
        <MetricCard label="Readiness" value={`${analytics.readiness}%`} sub="honest estimate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
        <section className="panel">
          <SectionTitle icon={<Clock3 size={17} />} title="Today’s plan" />
          <div className="mt-4 space-y-2">
            {todaySessions.length ? todaySessions.map((session) => <SessionRow key={session.id} session={session} subject={subjectById(data, session.subjectId)} />) : (
              <EmptyState title="No sessions today" body="Generate a timetable or add one focused revision block for this evening." compact />
            )}
          </div>
        </section>

        <section className="panel">
          <SectionTitle icon={<CalendarDays size={17} />} title="Upcoming exam timeline" />
          <div className="mt-4 space-y-3">
            {upcoming.length ? upcoming.map((subject) => (
              <button key={subject.id} className="timeline-row" onClick={() => { onSubject(subject.id); onView('Subject'); }}>
                <span className="timeline-dot" style={{ background: subject.colour }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{subject.name}</span>
                  <span className="text-xs text-stone-500">{subject.examDate}</span>
                </span>
                <span className="countdown">{formatCountdown(subject.examDate)}</span>
              </button>
            )) : <EmptyState title="No exams logged" body="Add subjects with exam dates to build a real countdown." compact />}
          </div>
        </section>

        <section className="panel">
          <SectionTitle icon={<AlertTriangle size={17} />} title="Overdue and weak" />
          <div className="mt-4 space-y-3">
            {dueCards.length ? dueCards.map((card) => (
              <CompactLine key={card.id} title={card.topic} meta={`${subjectName(data, card.subjectId)} · due ${card.nextReview}`} />
            )) : <CompactLine title="No due flashcards" meta="The queue is clear." />}
            {skipped.length ? skipped.map((session) => (
              <CompactLine key={session.id} title={`Recover: ${session.title}`} meta={session.reason || 'Missed session needs a smaller replacement.'} />
            )) : null}
          </div>
        </section>
      </div>

      <section className="panel">
        <SectionTitle icon={<Layers3 size={17} />} title="Subject priorities" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.subjects.length ? [...data.subjects].sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]).map((subject) => (
            <SubjectPriorityCard key={subject.id} data={data} subject={subject} onOpen={() => { onSubject(subject.id); onView('Subject'); }} />
          )) : <EmptyState title="No subjects yet" body="Add your GCSE/IGCSE subjects to begin." />}
        </div>
      </section>
    </div>
  );
}

function SubjectCentre({
  data,
  subject,
  updateData,
  onView,
  onWeakTopic,
  onAskTonight,
}: {
  data: ExamPilotData;
  subject: Subject;
  updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void;
  onView: (view: View) => void;
  onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void;
  onAskTonight: () => void;
}) {
  const guidance = data.guidance.filter((item) => item.subjectId === subject.id);
  const analysed = guidance.filter((item) => item.analysis);
  const cards = data.flashcards.filter((card) => card.subjectId === subject.id);
  const sessions = data.sessions.filter((session) => session.subjectId === subject.id);
  const questions = data.practiceQuestions.filter((question) => question.subjectId === subject.id);
  const weak = data.weakTopics.filter((topic) => topic.subjectId === subject.id).sort((a, b) => b.score - a.score);
  const activity = getRecentActivity(data, subject.id);
  const readiness = subjectReadiness(data, subject);

  const createChecklist = async () => {
    const text = guidance.map((item) => item.content).join('\n\n') || subject.notes || `${subject.name} GCSE/IGCSE overview`;
    const analysis = await analyseGuidance(subject, text, data);
    updateData((current) => ({
      ...current,
      guidance: [
        {
          id: newId('guidance'),
          subjectId: subject.id,
          title: `${subject.name} AI topic checklist`,
          content: analysis.suggestedRevisionTasks.join('\n'),
          analysis,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current.guidance,
      ],
    }));
    analysis.likelyWeakAreas.forEach((topic) => onWeakTopic(subject.id, topic, 'AI topic checklist', 1));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Subject command centre"
        title={subject.name}
        subtitle={`${formatCountdown(subject.examDate)} until exam · ${subject.priority} priority · confidence ${subject.confidence}/5`}
        action={<button className="btn-primary" onClick={onAskTonight}><Sparkles size={16} /> What tonight?</button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Exam countdown" value={formatCountdown(subject.examDate)} sub={subject.examDate} />
        <MetricCard label="Confidence" value={`${subject.confidence}/5`} sub="self-rated" />
        <MetricCard label="Mastery" value={`${readiness}%`} sub="from current signals" />
        <MetricCard label="Due cards" value={cards.filter((card) => card.nextReview <= today()).length} sub={`${cards.length} total`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel">
          <div className="section-line">
            <SectionTitle icon={<Library size={17} />} title="Topic map and mastery" />
            <button className="btn-secondary" onClick={createChecklist}><Sparkles size={15} /> AI checklist</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {topicMasteryRows(subject, data).length ? topicMasteryRows(subject, data).map((row) => (
              <div key={row.topic} className="topic-card">
                <div className="flex items-center justify-between gap-3">
                  <h3>{row.topic}</h3>
                  <span className="pill">{row.level}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-stone-200">
                  <div className="h-1.5 rounded-full bg-stone-900" style={{ width: `${row.score}%` }} />
                </div>
                <p className="mt-2 text-xs text-stone-500">{row.reason}</p>
                <TopicActions
                  data={data}
                  subject={subject}
                  topic={row.topic}
                  updateData={updateData}
                  onWeakTopic={onWeakTopic}
                  onView={onView}
                />
              </div>
            )) : <EmptyState title="No topic map yet" body="Analyse guidance or generate practice to build topic mastery." />}
          </div>
        </section>

        <section className="panel">
          <SectionTitle icon={<AlertTriangle size={17} />} title="Weak topics" />
          <div className="mt-4 space-y-2">
            {weak.length ? weak.slice(0, 6).map((topic) => (
              <button
                key={topic.id}
                className="weak-row"
                onClick={() => updateData((current) => ({
                  ...current,
                  sessions: [{
                    id: newId('session'),
                    subjectId: subject.id,
                    title: `${subject.name}: recover ${topic.topic}`,
                    type: 'revision',
                    date: today(),
                    startTime: '19:30',
                    durationMinutes: 35,
                    mode: 'Normal',
                    status: 'planned',
                    topic: topic.topic,
                    reason: `Created from weak-topic signal: ${topic.sources.join(', ')}`,
                  }, ...current.sessions],
                }))}
              >
                <span>{topic.topic}</span>
                <span className="pill">score {topic.score}</span>
              </button>
            )) : <EmptyState title="No weak topics yet" body="Mark practice and flashcards honestly to reveal them." compact />}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SubjectMiniPanel title="Guidance" count={guidance.length} button="Open" onClick={() => onView('Guidance')}>
          {analysed[0]?.analysis ? <AnalysisCompact analysis={analysed[0].analysis} /> : <p className="muted">Paste guidance and run analysis to extract a topic map.</p>}
        </SubjectMiniPanel>
        <SubjectMiniPanel title="Flashcards" count={cards.length} button="Review" onClick={() => onView('Flashcards')}>
          {cards.slice(0, 3).map((card) => <CompactLine key={card.id} title={card.topic} meta={card.question} />)}
          {!cards.length && <p className="muted">No cards yet.</p>}
        </SubjectMiniPanel>
        <SubjectMiniPanel title="Practice bank" count={questions.length} button="Practise" onClick={() => onView('Practice')}>
          {questions.slice(0, 3).map((question) => <CompactLine key={question.id} title={question.type} meta={question.prompt} />)}
          {!questions.length && <p className="muted">Generate exam-style questions from the current guidance.</p>}
        </SubjectMiniPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <section className="panel">
          <SectionTitle icon={<CalendarDays size={17} />} title="Revision sessions" />
          <div className="mt-4 space-y-2">
            {sessions.length ? sessions.slice(0, 6).map((session) => <SessionRow key={session.id} session={session} subject={subject} />) : <EmptyState title="No sessions" body="Create one from a weak topic or generate a timetable." compact />}
          </div>
        </section>
        <section className="panel">
          <SectionTitle icon={<MoreHorizontal size={17} />} title="Recent activity" />
          <div className="mt-4 space-y-2">
            {activity.length ? activity.map((item) => <CompactLine key={item.title + item.meta} title={item.title} meta={item.meta} />) : <EmptyState title="No recent activity" body="Reviews, sessions, and practice attempts will appear here." compact />}
          </div>
        </section>
      </div>
    </div>
  );
}

function GuidancePanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (topic: string) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentType, setDocumentType] = useState<KnowledgeDocumentType>('teacher-note');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const subjectGuidance = data.guidance.filter((item) => item.subjectId === subject.id);
  const documents = data.knowledgeDocuments.filter((item) => item.subjectId === subject.id);

  const addGuidance = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    const sourceName = title || `${subject.name} knowledge note`;
    const topics = extractTopicsFromText(content);
    updateData((current) => ({
      ...current,
      knowledgeDocuments: [
        {
          id: newId('doc'),
          subjectId: subject.id,
          sourceName,
          type: documentType,
          status: 'ready',
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          text: content,
          extractedTopics: topics,
        },
        ...current.knowledgeDocuments,
      ],
      guidance: [
        { id: newId('guidance'), subjectId: subject.id, title: sourceName, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...current.guidance,
      ],
    }));
    setTitle('');
    setContent('');
  };

  const uploadPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const docId = newId('doc');
    setExtractionProgress(1);
    updateData((current) => ({
      ...current,
      knowledgeDocuments: [
        {
          id: docId,
          subjectId: subject.id,
          sourceName: file.name,
          type: 'pdf',
          status: 'extracting',
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          text: '',
          extractedTopics: [],
        },
        ...current.knowledgeDocuments,
      ],
    }));

    const result = await extractPdfText(file, setExtractionProgress);
    const topics = extractTopicsFromText(result.text);
    updateData((current) => ({
      ...current,
      knowledgeDocuments: current.knowledgeDocuments.map((doc) =>
        doc.id === docId
          ? { ...doc, status: result.status, text: result.text, extractedTopics: topics, error: result.error, updatedAt: new Date().toISOString() }
          : doc,
      ),
      guidance: result.status === 'ready'
        ? [
            { id: newId('guidance'), subjectId: subject.id, title: file.name, content: result.text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            ...current.guidance,
          ]
        : current.guidance,
    }));
    setExtractionProgress(0);
  };

  const analyse = async (guidanceId: string, guidanceContent: string) => {
    const analysis = await analyseGuidance(subject, guidanceContent, data);
    analysis.likelyWeakAreas.forEach(onWeakTopic);
    updateData((current) => ({
      ...current,
      guidance: current.guidance.map((item) => (item.id === guidanceId ? { ...item, analysis, updatedAt: new Date().toISOString() } : item)),
    }));
  };

  const deleteDocument = (document: KnowledgeDocument) => {
    updateData((current) => ({
      ...current,
      knowledgeDocuments: current.knowledgeDocuments.filter((item) => item.id !== document.id),
      guidance: current.guidance.filter((item) => !(item.subjectId === document.subjectId && item.title === document.sourceName && item.content === document.text)),
    }));
  };

  return (
    <Panel eyebrow="Knowledge base" title={`${subject.name} source of truth`} subtitle="Upload PDFs or paste specifications, notes, mark schemes, textbook extracts, and teacher guidance. AI uses this first.">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <form className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4" onSubmit={addGuidance}>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Source name, e.g. Paper 2 specification" />
            <select className="input" value={documentType} onChange={(event) => setDocumentType(event.target.value as KnowledgeDocumentType)}>
              {['teacher-note', 'specification', 'mark-scheme', 'textbook', 'note', 'revision-guide'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <textarea className="input min-h-36" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste specification notes, teacher advice, mark schemes, textbook extracts, or personal notes..." />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary"><Plus size={16} /> Save to knowledge base</button>
            <label className="btn-secondary cursor-pointer">
              <Upload size={16} /> Upload PDF
              <input className="hidden" type="file" accept="application/pdf" onChange={uploadPdf} />
            </label>
            {extractionProgress > 0 && <span className="ai-pill"><Loader2 size={13} className="animate-spin" /> Extracting {extractionProgress}%</span>}
          </div>
        </form>

        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <SectionTitle icon={<Library size={17} />} title="Documents" />
          <div className="mt-4 space-y-2">
            {documents.length ? documents.map((doc) => (
              <div key={doc.id} className="document-row">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3>{doc.sourceName}</h3>
                    <span className={`pill status-${doc.status === 'ready' ? 'done' : doc.status === 'failed' ? 'skipped' : 'planned'}`}>{doc.status}</span>
                  </div>
                  <p>{doc.type} · uploaded {doc.uploadedAt.slice(0, 10)} · {doc.text.length.toLocaleString()} chars</p>
                  {doc.error && <p className="text-rose-700">{doc.error}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.extractedTopics.slice(0, 6).map((topic) => <span key={topic} className="pill">{topic}</span>)}
                  </div>
                </div>
                <button className="icon-button" title="Delete document" onClick={() => deleteDocument(doc)}><Trash2 size={15} /></button>
              </div>
            )) : <EmptyState title="No documents yet" body="Upload a PDF or paste source material to build the subject knowledge base." compact />}
          </div>
        </section>
      </div>

      <div className="mt-5 space-y-3">
        {subjectGuidance.length ? subjectGuidance.map((item) => (
          <article key={item.id} className="document-card">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3>{item.title}</h3>
                <p>{item.content}</p>
              </div>
              <button className="btn-secondary shrink-0" onClick={() => analyse(item.id, item.content)}><Sparkles size={16} /> Analyse with AI</button>
            </div>
            {item.analysis && <AnalysisGrid analysis={item.analysis} />}
          </article>
        )) : <EmptyState title="No guidance saved" body="Paste the exact information your teacher or specification gives you. This becomes the AI context." />}
      </div>
    </Panel>
  );
}

function TopicActions({
  data,
  subject,
  topic,
  updateData,
  onWeakTopic,
  onView,
}: {
  data: ExamPilotData;
  subject: Subject;
  topic: string;
  updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void;
  onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void;
  onView: (view: View) => void;
}) {
  const saveAiAnswer = async (prompt: string) => {
    const answer = await askExamExpert(prompt, subject, data);
    updateData((current) => ({
      ...current,
      aiMessages: [
        ...current.aiMessages,
        {
          id: newId('message'),
          role: 'assistant',
          content: answer,
          createdAt: new Date().toISOString(),
          subjectId: subject.id,
          contextSummary: `${subject.name} · ${topic} · knowledge base first`,
        },
      ],
    }));
    onView('AI');
  };

  const makeCards = async () => {
    const docs = data.knowledgeDocuments.filter((doc) => doc.subjectId === subject.id && doc.text.toLowerCase().includes(topic.toLowerCase()));
    const cards = await generateFlashcards(subject, [`Topic: ${topic}`, ...docs.map((doc) => doc.text)].join('\n\n'), data);
    updateData((current) => ({ ...current, flashcards: [...cards, ...current.flashcards] }));
    onView('Flashcards');
  };

  const makeQuiz = async (kind = 'quiz') => {
    const questions = await generatePracticeQuestions(subject, `${topic} (${kind})`, data);
    updateData((current) => ({ ...current, practiceQuestions: [...questions, ...current.practiceQuestions] }));
    onView('Practice');
  };

  const makeSession = () => {
    updateData((current) => ({
      ...current,
      topicMastery: upsertTopicMastery(current.topicMastery, subject.id, topic, { revisionCountDelta: 1 }),
      sessions: [
        {
          id: newId('session'),
          subjectId: subject.id,
          title: `${subject.name}: ${topic}`,
          type: 'revision',
          date: today(),
          startTime: '19:30',
          durationMinutes: 30,
          mode: 'Normal',
          status: 'planned',
          topic,
          reason: 'Created from one-click topic action.',
        },
        ...current.sessions,
      ],
    }));
    onView('Timetable');
  };

  return (
    <div className="topic-actions">
      <button onClick={() => saveAiAnswer(`Explain ${topic} for ${subject.name} using my uploaded knowledge base first.`)}>Explain</button>
      <button onClick={makeCards}>Flashcards</button>
      <button onClick={() => makeQuiz('quiz')}>Quiz</button>
      <button onClick={() => makeQuiz('exam questions')}>Exam questions</button>
      <button onClick={() => saveAiAnswer(`Create an essay plan for ${topic} in ${subject.name}, if this subject uses essays. If not, create an extended response plan.`)}>Essay plan</button>
      <button onClick={() => saveAiAnswer(`Summarise ${topic} for ${subject.name} into concise GCSE/IGCSE revision notes and mark-scheme points.`)}>Summarise</button>
      <button onClick={makeSession}>30-minute session</button>
      <button onClick={() => onWeakTopic(subject.id, topic, 'manual topic flag', 1)}>Flag weak</button>
    </div>
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

  const todayItems = sessionsForDate(data.sessions, today());
  const week = nextSevenDays();

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

  const deleteSession = (id: string) => updateData((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== id) }));

  const markSkipped = (session: TimetableSession) => {
    const date = new Date(`${session.date}T12:00:00`);
    date.setDate(date.getDate() + 1);
    updateData((current) => ({
      ...current,
      sessions: [
        { ...session, id: newId('session'), date: date.toISOString().slice(0, 10), status: 'planned' as const, durationMinutes: Math.max(25, session.durationMinutes - 10), reason: `Recovery block for skipped session: ${session.title}` },
        ...current.sessions.map((item) => (item.id === session.id ? { ...item, status: 'skipped' as const } : item)),
      ],
    }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Timetable"
        title="Weekly revision plan"
        subtitle="Fixed school commitments and flexible revision blocks, with recovery suggestions for missed sessions."
        action={<button className="btn-primary" onClick={generate}><Sparkles size={16} /> Regenerate with constraints</button>}
      />

      <section className="panel">
        <div className="flex flex-wrap gap-2">
          {modes.map((item) => <button key={item} className={`chip ${mode === item ? 'chip-active' : ''}`} onClick={() => setMode(item)}>{item}</button>)}
          {['music practice included', 'school commitments included', 'light day'].map((item) => <span key={item} className="constraint-chip">{item}</span>)}
        </div>
        <form className="mt-4 grid gap-3 lg:grid-cols-7" onSubmit={addSession}>
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
          <button className="btn-secondary justify-center"><Plus size={16} /> Add</button>
          <input className="input lg:col-span-2" type="number" min={10} value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
          <input className="input lg:col-span-5" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic, constraint, or purpose" />
        </form>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
        <section className="panel">
          <SectionTitle icon={<Clock3 size={17} />} title="Today view" />
          <div className="mt-4 space-y-2">
            {todayItems.length ? todayItems.map((session) => (
              <EditableSessionRow key={session.id} session={session} subject={subjectById(data, session.subjectId)} onUpdate={updateSession} onSkip={markSkipped} onDelete={deleteSession} />
            )) : <EmptyState title="Nothing booked today" body="Add one fixed commitment or a short revision block." compact />}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <SectionTitle icon={<CalendarDays size={17} />} title="Weekly calendar" />
          <div className="weekly-grid mt-4">
            {week.map((day) => (
              <div key={day.date} className="day-column">
                <div className="day-heading">
                  <span>{day.label}</span>
                  <small>{day.date.slice(5)}</small>
                </div>
                <div className="space-y-2">
                  {sessionsForDate(data.sessions, day.date).slice(0, 5).map((session) => <CalendarBlock key={session.id} session={session} subject={subjectById(data, session.subjectId)} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <SectionTitle icon={<RotateCcw size={17} />} title="Missed-session recovery" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.sessions.filter((session) => session.status === 'skipped').length ? data.sessions.filter((session) => session.status === 'skipped').map((session) => (
            <div key={session.id} className="recovery-card">
              <h3>{session.title}</h3>
              <p>Suggested recovery: halve the scope, keep the same topic, and complete a 25-minute block within 24 hours.</p>
              <button className="btn-secondary" onClick={() => markSkipped(session)}><Plus size={15} /> Add recovery block</button>
            </div>
          )) : <EmptyState title="No skipped sessions" body="Recovery suggestions will appear when something is missed." compact />}
        </div>
      </section>
    </div>
  );
}

function FlashcardPanel({ data, activeSubject, updateData, onWeakTopic }: { data: ExamPilotData; activeSubject?: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void }) {
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [filter, setFilter] = useState<'due' | 'overdue' | 'all'>('due');
  const [topicFilter, setTopicFilter] = useState('');
  const [settings, setSettings] = useState<FlashcardSettings>('definitions');
  const [cardSupport, setCardSupport] = useState('');

  const scopedCards = data.flashcards
    .filter((card) => !activeSubject || card.subjectId === activeSubject.id)
    .filter((card) => !topicFilter || card.topic.toLowerCase().includes(topicFilter.toLowerCase()))
    .filter((card) => filter === 'all' || (filter === 'due' ? card.nextReview <= today() : card.nextReview < today()));
  const reviewCard = scopedCards[0];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!reviewCard || !['1', '2', '3', '4'].includes(event.key)) return;
      const shortcuts: Record<string, FlashcardDifficulty> = { '1': 'Again', '2': 'Hard', '3': 'Good', '4': 'Easy' };
      const difficulty = shortcuts[event.key];
      if (!difficulty) return;
      review(reviewCard, difficulty);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const addCard = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !answer.trim() || !activeSubject) return;
    updateData((current) => ({
      ...current,
      flashcards: [{ id: newId('card'), subjectId: activeSubject.id, topic: topic || settings, question, answer, difficulty: 'Good', nextReview: today(), createdAt: new Date().toISOString() }, ...current.flashcards],
    }));
    setQuestion('');
    setAnswer('');
    setTopic('');
  };

  const generate = async () => {
    if (!activeSubject) return;
    const guidance = [
      `Generate ${settings} flashcards.`,
      ...data.guidance.filter((item) => item.subjectId === activeSubject.id).map((item) => item.content),
    ].join('\n');
    const cards = await generateFlashcards(activeSubject, guidance, data);
    updateData((current) => ({ ...current, flashcards: [...cards, ...current.flashcards] }));
  };

  const review = (card: Flashcard, difficulty: FlashcardDifficulty) => {
    const days = { Again: 1, Hard: 2, Good: 5, Easy: 9 }[difficulty];
    const next = new Date();
    next.setDate(next.getDate() + days);
    if (difficulty === 'Again' || difficulty === 'Hard') onWeakTopic(card.subjectId, card.topic, 'flashcard review', difficulty === 'Again' ? 2 : 1);
    updateData((current) => ({
      ...current,
      topicMastery: upsertTopicMastery(current.topicMastery, card.subjectId, card.topic, {
        flashcardReviewsDelta: 1,
        flashcardGoodDelta: difficulty === 'Good' || difficulty === 'Easy' ? 1 : 0,
      }),
      flashcards: current.flashcards.map((item) =>
        item.id === card.id ? { ...item, difficulty, lastReviewed: new Date().toISOString(), nextReview: next.toISOString().slice(0, 10) } : item,
      ),
    }));
  };

  const exportCards = () => {
    const blob = new Blob([JSON.stringify(scopedCards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exampilot-flashcards-${today()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const explainCard = async (kind: 'explanation' | 'memory aid') => {
    if (!reviewCard) return;
    const subject = subjectById(data, reviewCard.subjectId);
    const prompt = kind === 'explanation'
      ? `Explain this flashcard answer clearly and exam-focused: Q: ${reviewCard.question} A: ${reviewCard.answer}`
      : `Create a concise memory aid for this flashcard without being childish: Q: ${reviewCard.question} A: ${reviewCard.answer}`;
    setCardSupport(await askExamExpert(prompt, subject, data));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Flashcards"
        title="Review queue"
        subtitle="Due filters, topic targeting, keyboard shortcuts, and AI card-generation modes."
        action={<button className="btn-primary" onClick={generate}><Sparkles size={16} /> Generate {settings}</button>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <section className="panel">
          <div className="section-line">
            <SectionTitle icon={<Keyboard size={17} />} title="Review interface" />
            <span className="muted">1 Again · 2 Hard · 3 Good · 4 Easy</span>
          </div>
          {reviewCard ? (
            <div className="review-card">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill">{subjectName(data, reviewCard.subjectId)}</span>
                <span className="pill">{reviewCard.topic}</span>
                <span className="pill">due {reviewCard.nextReview}</span>
              </div>
              <h3>{reviewCard.question}</h3>
              <p>{reviewCard.answer}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => explainCard('explanation')}><Sparkles size={15} /> Explain answer</button>
                <button className="btn-secondary" onClick={() => explainCard('memory aid')}><Brain size={15} /> Memory aid</button>
              </div>
              {cardSupport && <div className="support-note">{cardSupport}</div>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['Again', 'Hard', 'Good', 'Easy'] as FlashcardDifficulty[]).map((item) => (
                  <button key={item} className="btn-secondary justify-center" onClick={() => review(reviewCard, item)}>{item}</button>
                ))}
              </div>
            </div>
          ) : <EmptyState title="No cards in this queue" body="Change the filter or generate cards from current guidance." />}
        </section>

        <section className="panel">
          <SectionTitle icon={<Sparkles size={17} />} title="Generation settings" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['definitions', 'exam questions', 'dates', 'formulas', 'vocab', 'essay evidence'] as FlashcardSettings[]).map((item) => (
              <button key={item} className={`chip ${settings === item ? 'chip-active' : ''}`} onClick={() => setSettings(item)}>{item}</button>
            ))}
          </div>
          <form className="mt-4 space-y-3" onSubmit={addCard}>
            <input className="input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" />
            <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Question" />
            <textarea className="input min-h-20" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Answer" />
            <button className="btn-secondary w-full justify-center" disabled={!activeSubject}><Plus size={16} /> Add card</button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="section-line">
          <div className="flex flex-wrap gap-2">
            {(['due', 'overdue', 'all'] as const).map((item) => <button key={item} className={`chip ${filter === item ? 'chip-active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}
            <input className="input h-9 w-48" value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} placeholder="Filter topic" />
          </div>
          <button className="btn-secondary" onClick={exportCards}><Download size={16} /> Export cards</button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scopedCards.length ? scopedCards.slice(0, 18).map((card) => (
            <div key={card.id} className="flashcard-tile">
              <span className="pill">{card.topic}</span>
              <h3>{card.question}</h3>
              <p>{card.answer}</p>
            </div>
          )) : <EmptyState title="No matching cards" body="Use AI generation settings or add one manually." />}
        </div>
      </section>
    </div>
  );
}

function ExamExpertPanel({
  data,
  activeSubject,
  activeSubjectId,
  setActiveSubjectId,
  updateData,
  aiStatus,
  onWeakTopic,
}: {
  data: ExamPilotData;
  activeSubject?: Subject;
  activeSubjectId: string;
  setActiveSubjectId: (id: string) => void;
  updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void;
  aiStatus: AIBackendStatus;
  onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void;
}) {
  const [question, setQuestion] = useState('');
  const subjectMessages = data.aiMessages.filter((message) => !activeSubjectId || message.subjectId === activeSubjectId || !message.subjectId);
  const latestAssistant = [...subjectMessages].reverse().find((message) => message.role === 'assistant');

  const ask = async (prompt = question) => {
    if (!prompt.trim()) return;
    const user: AIMessage = { id: newId('message'), role: 'user', content: prompt, createdAt: new Date().toISOString(), subjectId: activeSubjectId };
    const response = await askExamExpert(prompt, activeSubject, data);
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

  const turnAnswerIntoCards = async () => {
    if (!latestAssistant || !activeSubject) return;
    const cards = await generateFlashcards(activeSubject, latestAssistant.content, data);
    updateData((current) => ({ ...current, flashcards: [...cards, ...current.flashcards] }));
  };

  const turnWeakIntoSession = () => {
    const weak = data.weakTopics.find((topic) => !activeSubject || topic.subjectId === activeSubject.id);
    const subject = activeSubject ?? data.subjects.find((item) => item.id === weak?.subjectId);
    if (!weak || !subject) return;
    updateData((current) => ({
      ...current,
      sessions: [{
        id: newId('session'),
        subjectId: subject.id,
        title: `${subject.name}: ${weak.topic}`,
        type: 'revision',
        date: today(),
        startTime: '19:30',
        durationMinutes: 40,
        mode: 'Normal',
        status: 'planned',
        topic: weak.topic,
        reason: 'Created from weak-topic AI action.',
      }, ...current.sessions],
    }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Exam Expert AI"
        title="Context-aware revision assistant"
        subtitle="Uses stored guidance, exam dates, weak topics, flashcards, sessions, and the selected subject."
        action={<AIStatusPill status={aiStatus} />}
      />
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="panel">
          <SectionTitle icon={<CircleDot size={17} />} title="Context controls" />
          <select className="input mt-4" value={activeSubjectId} onChange={(event) => setActiveSubjectId(event.target.value)}>
            <option value="">All subjects</option>
            {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
          <div className="mt-4 space-y-2">
            <QuickPrompt text="Make me a 16-mark essay plan." onClick={() => ask('Make me a 16-mark essay plan using my stored guidance.')} />
            <QuickPrompt text="Generate mark scheme bullet points." onClick={() => ask('Generate mark scheme bullet points for my weakest current topic.')} />
            <QuickPrompt text="Test me on this subject." onClick={() => ask('Test me on the most important weak area for this subject.')} />
            <QuickPrompt text="Create tonight’s revision strategy." onClick={() => ask('What should I revise tonight, and why?')} />
          </div>
          <div className="mt-4 grid gap-2">
            <button className="btn-secondary justify-center" onClick={turnAnswerIntoCards} disabled={!latestAssistant || !activeSubject}><BookOpen size={16} /> Turn answer into flashcards</button>
            <button className="btn-secondary justify-center" onClick={turnWeakIntoSession}><CalendarDays size={16} /> Turn weak topic into session</button>
            <button className="btn-secondary justify-center" onClick={() => activeSubject && generatePracticeQuestions(activeSubject, data.weakTopics.find((topic) => topic.subjectId === activeSubject.id)?.topic || 'priority topic', data).then((questions) => updateData((current) => ({ ...current, practiceQuestions: [...questions, ...current.practiceQuestions] })))} disabled={!activeSubject}><Brain size={16} /> Quiz from guidance</button>
          </div>
        </section>

        <section className="panel">
          <div className="chat-window">
            {subjectMessages.length ? subjectMessages.map((message) => (
              <div key={message.id} className={`chat ${message.role === 'assistant' ? 'chat-ai' : 'chat-user'}`}>
                {message.contextSummary && <p className="mb-1 text-xs font-medium text-stone-500">Context used: {message.contextSummary}</p>}
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </div>
            )) : <EmptyState title="Ask a revision question" body="Try an essay plan, simple explanation, self-test, mark scheme, or topic strategy." />}
          </div>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <input className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="How should I revise Chemistry acids?" />
            <button className="btn-primary"><MessageSquareText size={16} /> Ask</button>
          </form>
        </section>
      </div>
    </div>
  );
}

function PracticePanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'mixed' | 'essay' | 'mark scheme' | 'french vocab' | 'formula/definition'>('mixed');
  const questions = data.practiceQuestions.filter((question) => question.subjectId === subject.id);

  const generate = async () => {
    const baseTopic = topic || data.weakTopics.find((weak) => weak.subjectId === subject.id)?.topic || 'priority topic';
    const created = await generatePracticeQuestions(subject, `${baseTopic} (${mode})`, data);
    updateData((current) => ({ ...current, practiceQuestions: [...created, ...current.practiceQuestions] }));
  };

  const mark = (id: string, result: PracticeResult, questionTopic: string) => {
    if (result !== 'correct') onWeakTopic(subject.id, questionTopic, 'practice mistake', result === 'incorrect' ? 3 : 1);
    updateData((current) => ({
      ...current,
      topicMastery: upsertTopicMastery(current.topicMastery, subject.id, questionTopic, {
        quizAttemptsDelta: 1,
        quizCorrectDelta: result === 'correct' ? 1 : 0,
      }),
      practiceQuestions: current.practiceQuestions.map((question) => (question.id === id ? { ...question, result } : question)),
    }));
  };

  const mistakes = questions.filter((question) => question.result === 'partial' || question.result === 'incorrect');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Practice mode"
        title={`${subject.name} question bank`}
        subtitle="Generate exam-style questions, essay plans, mark schemes, vocab drills, and formula or definition checks."
        action={<button className="btn-primary" onClick={generate}><Sparkles size={16} /> Generate</button>}
      />

      <section className="panel">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <input className="input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic to practise" />
          <div className="flex flex-wrap gap-2">
            {(['mixed', 'essay', 'mark scheme', 'french vocab', 'formula/definition'] as const).map((item) => (
              <button key={item} className={`chip ${mode === item ? 'chip-active' : ''}`} onClick={() => setMode(item)}>{item}</button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel">
          <SectionTitle icon={<Brain size={17} />} title="Exam-style question bank" />
          <div className="mt-4 space-y-3">
            {questions.length ? questions.map((question) => (
              <article key={question.id} className="question-card">
                <div className="flex flex-wrap gap-2">
                  <span className="pill">{question.type}</span>
                  <span className="pill">{question.topic}</span>
                  {question.result && <span className="pill">{question.result}</span>}
                </div>
                <h3>{question.prompt}</h3>
                {question.options?.length ? <div className="grid gap-2 sm:grid-cols-2">{question.options.map((option) => <p key={option} className="option-line">{option}</p>)}</div> : null}
                <p className="muted">Answer guide: {question.answerGuide}</p>
                {question.explanation && <p className="muted">Explanation: {question.explanation}</p>}
                {question.markSchemePoints?.length ? <BulletList title="Mark scheme" items={question.markSchemePoints} /> : null}
                <div className="flex flex-wrap gap-2">
                  {(['correct', 'partial', 'incorrect'] as PracticeResult[]).map((result) => (
                    <button key={result} className="btn-secondary" onClick={() => mark(question.id, result, question.topic)}>{result}</button>
                  ))}
                </div>
              </article>
            )) : <EmptyState title="No practice attempts yet" body="Generate a question set from a weak topic or pasted guidance." />}
          </div>
        </section>

        <section className="panel">
          <SectionTitle icon={<AlertTriangle size={17} />} title="Mistake log" />
          <div className="mt-4 space-y-3">
            {mistakes.length ? mistakes.map((question) => (
              <div key={question.id} className="mistake-card">
                <h3>{question.topic}</h3>
                <p>{question.prompt}</p>
                <span className="pill">{question.result}</span>
              </div>
            )) : <EmptyState title="No mistakes logged" body="Mark answers honestly. Partial and incorrect responses feed weak-topic tracking." compact />}
          </div>
        </section>
      </div>
    </div>
  );
}

function PastPaperPanel({ data, subject, updateData, onWeakTopic }: { data: ExamPilotData; subject: Subject; updateData: (updater: (current: ExamPilotData) => ExamPilotData) => void; onWeakTopic: (subjectId: string, topic: string, source: string, delta?: number) => void }) {
  const [sourceName, setSourceName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [topicHint, setTopicHint] = useState('');
  const [loading, setLoading] = useState(false);
  const items = data.pastPaperItems.filter((item) => item.subjectId === subject.id);

  const analyseQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!questionText.trim()) return;
    setLoading(true);
    const prompt = [
      `Analyse this past-paper question for ${subject.name}.`,
      'Identify the topic, estimate difficulty, give a model answer, mark-scheme bullet points, and follow-up revision.',
      'Use uploaded knowledge-base documents first, then general GCSE/IGCSE knowledge only if needed.',
      topicHint ? `Topic hint: ${topicHint}` : '',
      `Question:\n${questionText}`,
    ].filter(Boolean).join('\n\n');
    const answer = await askExamExpert(prompt, subject, data);
    const topic = topicHint || inferTopicFromText(questionText, data, subject.id) || 'AI identified topic';
    const markSchemePoints = extractBulletishLines(answer).slice(0, 8);
    const item: PastPaperItem = {
      id: newId('paper'),
      subjectId: subject.id,
      sourceName: sourceName || 'Pasted exam question',
      questionText,
      topic,
      difficulty: inferDifficulty(questionText),
      modelAnswer: answer,
      markSchemePoints: markSchemePoints.length ? markSchemePoints : ['Check answer against the official mark scheme.', 'Convert missing marks into flashcards.'],
      followUpRevision: [`Revise ${topic}`, 'Attempt a similar timed question', 'Log any missing mark-scheme points'],
      createdAt: new Date().toISOString(),
    };
    updateData((current) => ({
      ...current,
      pastPaperItems: [item, ...current.pastPaperItems],
      topicMastery: upsertTopicMastery(current.topicMastery, subject.id, topic, { quizAttemptsDelta: 1 }),
    }));
    onWeakTopic(subject.id, topic, 'past paper assistant', 1);
    setQuestionText('');
    setTopicHint('');
    setSourceName('');
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Past paper assistant"
        title={`${subject.name} exam-question workspace`}
        subtitle="Paste exam questions, identify topics, estimate difficulty, generate model answers, mark-scheme bullets, and follow-up revision."
      />
      <section className="panel">
        <form className="space-y-3" onSubmit={analyseQuestion}>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="input" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Source, e.g. June 2024 Paper 1 Q5" />
            <input className="input" value={topicHint} onChange={(event) => setTopicHint(event.target.value)} placeholder="Optional topic hint" />
          </div>
          <textarea className="input min-h-40" value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Paste an exam question, source extract, essay prompt, or mark-scheme fragment..." />
          <button className="btn-primary" disabled={loading}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Analyse question</button>
        </form>
      </section>
      <section className="panel">
        <SectionTitle icon={<Library size={17} />} title="Analysed questions" />
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {items.length ? items.map((item) => (
            <article key={item.id} className="question-card">
              <div className="flex flex-wrap gap-2">
                <span className="pill">{item.sourceName}</span>
                <span className="pill">{item.topic}</span>
                <span className="pill">{item.difficulty}</span>
              </div>
              <h3>{item.questionText}</h3>
              {item.modelAnswer && <p className="muted">{item.modelAnswer}</p>}
              <BulletList title="Mark-scheme points" items={item.markSchemePoints} />
              <BulletList title="Follow-up revision" items={item.followUpRevision} />
            </article>
          )) : <EmptyState title="No analysed questions yet" body="Paste a past-paper question to turn it into a revision task." />}
        </div>
      </section>
    </div>
  );
}

function DailyReviewPanel({ data, analytics, nextBlock, onTonight, onView }: { data: ExamPilotData; analytics: ReturnType<typeof getAnalytics>; nextBlock?: NextBlock; onTonight: () => void; onView: (view: View) => void }) {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Daily review"
        title="Close the loop before tomorrow"
        subtitle="A short evening review: recover missed work, clear due cards, and schedule one specific next block."
        action={<button className="btn-primary" onClick={onTonight}><Moon size={16} /> Ask tonight</button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <ReviewStep title="1. Clear retrieval" body={`${analytics.dueCards} flashcards due. Start with the smallest honest queue.`} action="Review cards" onClick={() => onView('Flashcards')} />
        <ReviewStep title="2. Recover misses" body={`${analytics.skippedSessions} skipped sessions. Replace one with a smaller block.`} action="Open timetable" onClick={() => onView('Timetable')} />
        <ReviewStep title="3. Choose next block" body={nextBlock?.title ?? 'Add a subject or weak topic to generate a next action.'} action="Dashboard" onClick={() => onView('Dashboard')} />
      </div>
      <FocusMode />
      <section className="panel">
        <SectionTitle icon={<ListChecks size={17} />} title="Daily checklist" />
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {[
            'Review due cards before opening notes',
            'Do one exam-style question for the weakest topic',
            'Mark strictly with bullet-point evidence',
            'Schedule a recovery block if anything was skipped',
            'Update confidence after practice',
            'Stop with one clear first task for tomorrow',
          ].map((item) => <label key={item} className="check-row"><input type="checkbox" /> <span>{item}</span></label>)}
        </div>
      </section>
    </div>
  );
}

function AnalyticsPanel({ data, analytics }: { data: ExamPilotData; analytics: ReturnType<typeof getAnalytics> }) {
  const bySubject = data.subjects.map((subject) => ({
    subject,
    minutes: data.sessions.filter((session) => session.subjectId === subject.id && session.status === 'done').reduce((sum, session) => sum + session.durationMinutes, 0),
  }));
  const flashAccuracy = analytics.reviewedCards ? Math.round((analytics.goodCards / analytics.reviewedCards) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Analytics" title="Honest progress signals" subtitle="No fake streaks, no inflated mastery. These numbers come from what you actually logged." />
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Study streak" value={`${analytics.streak}d`} sub="completed sessions" />
        <MetricCard label="Readiness" value={`${analytics.readiness}%`} sub="exam estimate" />
        <MetricCard label="Flashcard accuracy" value={`${flashAccuracy}%`} sub={`${analytics.reviewedCards} reviewed`} />
        <MetricCard label="Completed" value={analytics.sessionsCompleted} sub={`${analytics.skippedSessions} skipped`} />
        <MetricCard label="Revision time" value={`${analytics.revisionHours}h`} sub="total done" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel">
          <SectionTitle icon={<BarChart3 size={17} />} title="Revision time by subject" />
          <div className="mt-4 space-y-4">
            {bySubject.length ? bySubject.map(({ subject, minutes }) => (
              <ProgressRow key={subject.id} label={subject.name} value={`${Math.round(minutes / 6) / 10}h`} percent={Math.min(100, minutes / Math.max(1, analytics.maxSubjectMinutes) * 100)} colour={subject.colour} />
            )) : <EmptyState title="No revision time yet" body="Mark sessions done to build time analytics." compact />}
          </div>
        </section>
        <section className="panel">
          <SectionTitle icon={<AlertTriangle size={17} />} title="Weakest topics" />
          <div className="mt-4 space-y-2">
            {data.weakTopics.length ? [...data.weakTopics].sort((a, b) => b.score - a.score).slice(0, 8).map((weak) => (
              <CompactLine key={weak.id} title={`${subjectName(data, weak.subjectId)} · ${weak.topic}`} meta={`score ${weak.score} · ${weak.sources.join(', ')}`} />
            )) : <EmptyState title="No weak topics" body="Practice mistakes and hard flashcards populate this." compact />}
          </div>
        </section>
      </div>
      <section className="panel">
        <SectionTitle icon={<Target size={17} />} title="Confidence trend" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.subjects.length ? data.subjects.map((subject) => (
            <div key={subject.id} className="trend-card">
              <div className="flex items-center justify-between">
                <h3>{subject.name}</h3>
                <span>{subject.confidence}/5</span>
              </div>
              <div className="sparkline" style={{ background: `linear-gradient(90deg, ${subject.colour} ${subject.confidence * 20}%, #e7e5e4 ${subject.confidence * 20}%)` }} />
              <p>Current confidence snapshot. Future imports can preserve dated trend points.</p>
            </div>
          )) : <EmptyState title="No subjects" body="Add a subject to begin confidence tracking." compact />}
        </div>
      </section>
    </div>
  );
}

function SubjectForm({ onAdd, compact = false }: { onAdd: (subject: Subject) => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [name, setName] = useState('');
  const [examDate, setExamDate] = useState(today());
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [confidence, setConfidence] = useState<ConfidenceLevel>(3);
  const [colour, setColour] = useState(swatches[0]);
  const [notes, setNotes] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: newId('subject'), name: name.trim(), examDate, priority, confidence, colour, notes, createdAt: new Date().toISOString() });
    setName('');
    setNotes('');
    if (compact) setOpen(false);
  };

  if (compact && !open) {
    return <button className="btn-secondary w-full justify-center" onClick={() => setOpen(true)}><Plus size={15} /> Add subject</button>;
  }

  return (
    <form className={compact ? 'compact-subject-form' : 'panel space-y-3'} onSubmit={submit}>
      <div className="section-line">
        <span className="sidebar-heading">Add subject</span>
        {compact && <button type="button" className="tiny-button" onClick={() => setOpen(false)}>Close</button>}
      </div>
      <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Chemistry" />
      <input className="input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as PriorityLevel)}>
          {priorities.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="input" value={confidence} onChange={(event) => setConfidence(Number(event.target.value) as ConfidenceLevel)}>
          {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item}/5</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        {swatches.map((swatch) => (
          <button type="button" title={swatch} key={swatch} className={`swatch ${colour === swatch ? 'swatch-active' : ''}`} style={{ background: swatch }} onClick={() => setColour(swatch)} />
        ))}
      </div>
      <textarea className="input min-h-16" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes, risks, teacher advice" />
      <button className="btn-primary w-full justify-center"><Plus size={15} /> Save subject</button>
    </form>
  );
}

function FocusMode() {
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [task, setTask] = useState('One focused revision block');
  const [progress, setProgress] = useState(0);
  const [help, setHelp] = useState('');

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) setRunning(false);
  }, [secondsLeft]);

  const reset = (value = minutes) => {
    setMinutes(value);
    setSecondsLeft(value * 60);
    setRunning(false);
  };

  const complete = () => {
    setProgress(100);
    setRunning(false);
  };

  return (
    <section className="panel focus-panel">
      <div>
        <p className="eyebrow">Focus mode</p>
        <h3>Distraction-free study mode</h3>
        <input className="focus-task-input" value={task} onChange={(event) => setTask(event.target.value)} aria-label="Current focus task" />
        <div className="mt-3 h-2 rounded-full bg-stone-200">
          <div className="h-2 rounded-full bg-stone-950 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="timer-face">{formatTimer(secondsLeft)}</div>
      <div className="flex flex-wrap gap-2">
        {[25, 45, 60].map((value) => <button key={value} className={`chip ${minutes === value ? 'chip-active' : ''}`} onClick={() => reset(value)}>{value}m</button>)}
        <button className="btn-primary" onClick={() => setRunning((value) => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause' : 'Start'}</button>
        <button className="btn-secondary" onClick={() => reset()}><TimerReset size={16} /> Reset</button>
        <button className="btn-secondary" onClick={() => setHelp('Quick AI help: name the command word, recall the mark-scheme points, answer one narrow question, then check notes.')}>AI help</button>
        <button className="btn-secondary" onClick={() => setProgress((value) => Math.min(100, value + 25))}>+25%</button>
        <button className="btn-primary" onClick={complete}><Check size={16} /> Finish session</button>
      </div>
      {help && <p className="focus-help">{help}</p>}
    </section>
  );
}

function MobileNav({ activeView, onView }: { activeView: View; onView: (view: View) => void }) {
  const mobileItems: Array<[View, ReactNode]> = [
    ['Dashboard', <Target size={18} />],
    ['Subject', <Layers3 size={18} />],
    ['Timetable', <CalendarDays size={18} />],
    ['Flashcards', <BookOpen size={18} />],
    ['AI', <MessageSquareText size={18} />],
  ];
  return (
    <nav className="mobile-nav">
      {mobileItems.map(([view, icon]) => <button key={view} className={activeView === view ? 'mobile-active' : ''} onClick={() => onView(view)}>{icon}<span>{view === 'Flashcards' ? 'Cards' : view}</span></button>)}
    </nav>
  );
}

function CommandPalette({
  subjects,
  onClose,
  onView,
  onSubject,
  onTonight,
}: {
  subjects: Subject[];
  onClose: () => void;
  onView: (view: View) => void;
  onSubject: (id: string) => void;
  onTonight: () => void;
}) {
  const [filter, setFilter] = useState('');
  const actions: Array<{ label: string; meta: string; run: () => void }> = [
    { label: 'What should I revise now?', meta: 'AI planner', run: onTonight },
    ...navItems.map(([view, , label]) => ({ label: `Open ${label}`, meta: 'Navigate', run: () => onView(view) })),
    ...subjects.map((subject) => ({ label: `Open ${subject.name}`, meta: `${formatCountdown(subject.examDate)} · ${subject.priority}`, run: () => onSubject(subject.id) })),
  ].filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="command-backdrop" onMouseDown={onClose}>
      <div className="command-panel" onMouseDown={(event) => event.stopPropagation()}>
        <label className="command-modal-input">
          <Search size={17} />
          <input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search commands, subjects, and AI actions" />
          <kbd>Esc</kbd>
        </label>
        <div className="command-results">
          {actions.slice(0, 12).map((action) => (
            <button key={action.label + action.meta} onClick={action.run}>
              <span>{action.label}</span>
              <small>{action.meta}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="mb-5">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="section-heading">{title}</h2>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="section-title">{icon}<span>{title}</span></div>;
}

function AIStatusPill({ status }: { status: AIBackendStatus }) {
  const copy = status === 'real' ? 'Real AI' : status === 'mock' ? 'Mock fallback' : status === 'error' ? 'AI error' : 'AI ready';
  return <span className={`ai-pill ai-${status}`}><span />{copy}</span>;
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{sub}</span>
    </div>
  );
}

function MiniStat({ label, value, dark = false }: { label: string; value: string | number; dark?: boolean }) {
  return <div className={dark ? 'mini-stat mini-stat-dark' : 'mini-stat'}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`empty-state ${compact ? 'empty-compact' : ''}`}>
      <Clock3 size={compact ? 18 : 22} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function SubjectPriorityCard({ data, subject, onOpen }: { data: ExamPilotData; subject: Subject; onOpen: () => void }) {
  const weak = data.weakTopics.filter((topic) => topic.subjectId === subject.id);
  const due = data.flashcards.filter((card) => card.subjectId === subject.id && card.nextReview <= today()).length;
  return (
    <button className="subject-priority-card" onClick={onOpen}>
      <span className="subject-colour" style={{ background: subject.colour }} />
      <h3>{subject.name}</h3>
      <p>{formatCountdown(subject.examDate)} · confidence {subject.confidence}/5</p>
      <div className="flex gap-2">
        <span className="pill">{subject.priority}</span>
        <span className="pill">{weak.length} weak</span>
        <span className="pill">{due} due</span>
      </div>
    </button>
  );
}

function SubjectMiniPanel({ title, count, button, onClick, children }: { title: string; count: number; button: string; onClick: () => void; children: ReactNode }) {
  return (
    <section className="panel mini-panel">
      <div className="section-line">
        <div>
          <h3>{title}</h3>
          <p>{count} item{count === 1 ? '' : 's'}</p>
        </div>
        <button className="btn-secondary" onClick={onClick}>{button}</button>
      </div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function SessionRow({ session, subject }: { session: TimetableSession; subject?: Subject }) {
  return (
    <div className="session-row">
      <span className="session-bar" style={{ background: subject?.colour ?? '#78716c' }} />
      <div className="min-w-0 flex-1">
        <h3>{session.title}</h3>
        <p>{session.startTime} · {session.durationMinutes}m · {session.topic || session.type}</p>
      </div>
      <span className={`status-dot status-${session.status}`}>{session.status}</span>
    </div>
  );
}

function EditableSessionRow({ session, subject, onUpdate, onSkip, onDelete }: { session: TimetableSession; subject?: Subject; onUpdate: (id: string, patch: Partial<TimetableSession>) => void; onSkip: (session: TimetableSession) => void; onDelete: (id: string) => void }) {
  return (
    <div className="session-row editable-session">
      <span className="session-bar" style={{ background: subject?.colour ?? '#78716c' }} />
      <div className="min-w-0 flex-1">
        <h3>{session.title}</h3>
        <p>{session.date} · {session.startTime} · {session.durationMinutes}m</p>
      </div>
      <input className="input w-28" type="time" value={session.startTime} onChange={(event) => onUpdate(session.id, { startTime: event.target.value })} />
      <button className="icon-button" title="Done" onClick={() => onUpdate(session.id, { status: 'done' })}><Check size={15} /></button>
      <button className="icon-button" title="Skip and recover" onClick={() => onSkip(session)}><RotateCcw size={15} /></button>
      <button className="icon-button" title="Delete" onClick={() => onDelete(session.id)}><Trash2 size={15} /></button>
    </div>
  );
}

function CalendarBlock({ session, subject }: { session: TimetableSession; subject?: Subject }) {
  return (
    <div className={`calendar-block calendar-${session.status}`}>
      <span style={{ background: subject?.colour ?? '#78716c' }} />
      <strong>{session.startTime}</strong>
      <p>{session.title}</p>
    </div>
  );
}

function CompactLine({ title, meta }: { title: string; meta: string }) {
  return <div className="compact-line"><h3>{title}</h3><p>{meta}</p></div>;
}

function PriorityLine({ text }: { text: string }) {
  return <div className="priority-line"><AlertTriangle size={16} /><p>{text}</p></div>;
}

function QuickPrompt({ text, onClick }: { text: string; onClick: () => void }) {
  return <button className="quick-prompt" onClick={onClick}>{text}<ChevronRight size={15} /></button>;
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bullet-box">
      <p>{title}</p>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

function AnalysisCompact({ analysis }: { analysis: NonNullable<import('./types').RevisionGuidance['analysis']> }) {
  return (
    <div className="space-y-2">
      {analysis.keyTopics.slice(0, 4).map((topic) => <CompactLine key={topic} title={topic} meta="Extracted key topic" />)}
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
    <div className="analysis-grid">
      {sections.map(([title, items]) => (
        <div key={String(title)}>
          <h4>{String(title)}</h4>
          <ul>{(items as string[]).slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function ReviewStep({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) {
  return (
    <section className="panel review-step">
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="btn-secondary" onClick={onClick}>{action}</button>
    </section>
  );
}

function ProgressRow({ label, value, percent, colour }: { label: string; value: string; percent: number; colour: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm"><span>{label}</span><span className="text-stone-500">{value}</span></div>
      <div className="h-2 rounded-full bg-stone-200"><div className="h-2 rounded-full" style={{ width: `${percent}%`, background: colour }} /></div>
    </div>
  );
}

function filterSubjects(data: ExamPilotData, query: string) {
  if (!query.trim()) return data.subjects;
  const q = query.toLowerCase();
  const subjectIds = new Set(data.subjects.filter((subject) => `${subject.name} ${subject.notes}`.toLowerCase().includes(q)).map((subject) => subject.id));
  data.guidance.forEach((item) => {
    if (`${item.title} ${item.content}`.toLowerCase().includes(q)) subjectIds.add(item.subjectId);
  });
  data.knowledgeDocuments.forEach((item) => {
    if (`${item.sourceName} ${item.text} ${item.extractedTopics.join(' ')}`.toLowerCase().includes(q)) subjectIds.add(item.subjectId);
  });
  data.flashcards.forEach((card) => {
    if (`${card.topic} ${card.question} ${card.answer}`.toLowerCase().includes(q)) subjectIds.add(card.subjectId);
  });
  data.weakTopics.forEach((topic) => {
    if (topic.topic.toLowerCase().includes(q)) subjectIds.add(topic.subjectId);
  });
  data.pastPaperItems.forEach((item) => {
    if (`${item.sourceName} ${item.questionText} ${item.topic}`.toLowerCase().includes(q)) subjectIds.add(item.subjectId);
  });
  return data.subjects.filter((subject) => subjectIds.has(subject.id));
}

function upsertWeakTopicInData(data: ExamPilotData, subjectId: string, topic: string, source: string, delta = 1): ExamPilotData {
  const found = data.weakTopics.find((weak) => weak.subjectId === subjectId && weak.topic.toLowerCase() === topic.toLowerCase());
  const weakTopics = found
    ? data.weakTopics.map((weak) => weak.id === found.id ? { ...weak, score: Math.min(10, weak.score + delta), sources: Array.from(new Set([...weak.sources, source])), updatedAt: new Date().toISOString() } : weak)
    : [...data.weakTopics, { id: newId('weak'), subjectId, topic, score: Math.max(1, delta), sources: [source], updatedAt: new Date().toISOString() }];
  return { ...data, weakTopics };
}

function getAnalytics(data: ExamPilotData) {
  const done = data.sessions.filter((session) => session.status === 'done');
  const sessionsCompleted = done.length;
  const skippedSessions = data.sessions.filter((session) => session.status === 'skipped').length;
  const revisionMinutes = done.filter((session) => session.type === 'revision').reduce((total, session) => total + session.durationMinutes, 0);
  const dueCards = data.flashcards.filter((card) => card.nextReview <= today()).length;
  const overdueCards = data.flashcards.filter((card) => card.nextReview < today()).length;
  const reviewedCards = data.flashcards.filter((card) => card.lastReviewed).length;
  const goodCards = data.flashcards.filter((card) => card.lastReviewed && (card.difficulty === 'Good' || card.difficulty === 'Easy')).length;
  const maxSubjectMinutes = Math.max(1, ...data.subjects.map((subject) => done.filter((session) => session.subjectId === subject.id).reduce((sum, session) => sum + session.durationMinutes, 0)));
  const avgConfidence = data.subjects.length ? data.subjects.reduce((sum, subject) => sum + subject.confidence, 0) / data.subjects.length : 0;
  const readiness = data.subjects.length ? Math.max(0, Math.min(100, Math.round(avgConfidence * 16 + sessionsCompleted * 2 - data.weakTopics.length * 3 - overdueCards * 2))) : 0;
  return {
    sessionsCompleted,
    skippedSessions,
    revisionHours: Math.round((revisionMinutes / 60) * 10) / 10,
    dueCards,
    overdueCards,
    reviewedCards,
    goodCards,
    maxSubjectMinutes,
    readiness,
    streak: studyStreak(done),
  };
}

function getNextBestBlock(data: ExamPilotData): NextBlock | undefined {
  const ranked = data.subjects.map((subject) => {
    const days = daysUntil(subject.examDate);
    const weak = data.weakTopics.filter((topic) => topic.subjectId === subject.id).sort((a, b) => b.score - a.score)[0];
    const due = data.flashcards.filter((card) => card.subjectId === subject.id && card.nextReview <= today()).length;
    const weakestMastery = data.topicMastery.filter((topic) => topic.subjectId === subject.id).sort((a, b) => a.aiEstimatedMastery - b.aiEstimatedMastery)[0];
    const skipped = data.sessions.filter((session) => session.subjectId === subject.id && session.status === 'skipped').length;
    const docs = data.knowledgeDocuments.filter((doc) => doc.subjectId === subject.id && doc.status === 'ready').length;
    const masteryRisk = weakestMastery ? Math.max(0, 80 - weakestMastery.aiEstimatedMastery) : 12;
    const score = priorityRank[subject.priority] * 18 + Math.max(0, 35 - days) + (6 - subject.confidence) * 7 + (weak?.score ?? 0) * 4 + due * 2 + skipped * 6 + masteryRisk + docs;
    return { subject, weak, due, score, days };
  }).sort((a, b) => b.score - a.score)[0];
  if (!ranked) return undefined;
  const topic = ranked.weak?.topic ?? (ranked.due ? 'due flashcards' : 'exam technique');
  return {
    subject: ranked.subject,
    title: `${ranked.subject.name}: ${topic}`,
    reason: `${ranked.subject.priority} priority, ${ranked.days} days to exam, confidence ${ranked.subject.confidence}/5${ranked.weak ? `, weak topic score ${ranked.weak.score}` : ''}${ranked.due ? `, ${ranked.due} cards due` : ''}.`,
  };
}

interface NextBlock {
  subject: Subject;
  title: string;
  reason: string;
}

function getAttentionList(data: ExamPilotData) {
  const items: string[] = [];
  [...data.subjects].sort((a, b) => daysUntil(a.examDate) - daysUntil(b.examDate) || priorityRank[b.priority] - priorityRank[a.priority]).slice(0, 3).forEach((subject) => {
    const days = daysUntil(subject.examDate);
    if (days <= 21 || subject.priority === 'Critical' || subject.confidence <= 2) {
      const weak = data.weakTopics.find((topic) => topic.subjectId === subject.id)?.topic;
      items.push(`${subject.name}: ${days} days to exam, ${subject.priority.toLowerCase()} priority, confidence ${subject.confidence}/5${weak ? `. Start with ${weak}.` : '.'}`);
    }
  });
  const due = data.flashcards.filter((card) => card.nextReview <= today()).length;
  if (due) items.push(`${due} flashcard${due === 1 ? '' : 's'} due today. Do retrieval before re-reading notes.`);
  const skipped = data.sessions.filter((session) => session.status === 'skipped').length;
  if (skipped) items.push(`${skipped} skipped session${skipped === 1 ? '' : 's'} need a smaller recovery block.`);
  return items;
}

function topicMasteryRows(subject: Subject, data: ExamPilotData) {
  const topics = new Set<string>();
  data.guidance.filter((item) => item.subjectId === subject.id).forEach((item) => item.analysis?.keyTopics.forEach((topic) => topics.add(topic)));
  data.knowledgeDocuments.filter((item) => item.subjectId === subject.id).forEach((item) => item.extractedTopics.forEach((topic) => topics.add(topic)));
  data.flashcards.filter((card) => card.subjectId === subject.id).forEach((card) => topics.add(card.topic));
  data.practiceQuestions.filter((question) => question.subjectId === subject.id).forEach((question) => topics.add(question.topic));
  data.weakTopics.filter((weak) => weak.subjectId === subject.id).forEach((weak) => topics.add(weak.topic));
  data.topicMastery.filter((mastery) => mastery.subjectId === subject.id).forEach((mastery) => topics.add(mastery.topic));
  return [...topics].slice(0, 10).map((topic) => {
    const weak = data.weakTopics.find((item) => item.subjectId === subject.id && item.topic.toLowerCase() === topic.toLowerCase());
    const mastery = data.topicMastery.find((item) => item.subjectId === subject.id && item.topic.toLowerCase() === topic.toLowerCase());
    const correct = data.practiceQuestions.filter((item) => item.subjectId === subject.id && item.topic === topic && item.result === 'correct').length;
    const cards = data.flashcards.filter((item) => item.subjectId === subject.id && item.topic === topic && item.lastReviewed).length;
    const score = mastery?.aiEstimatedMastery ?? Math.max(10, Math.min(95, 45 + correct * 12 + cards * 5 - (weak?.score ?? 0) * 7 + subject.confidence * 5));
    return {
      topic,
      score,
      level: score > 75 ? 'secure' : score > 50 ? 'developing' : 'fragile',
      reason: mastery
        ? `${mastery.revisionCount} revisions · quiz ${mastery.quizCorrect}/${mastery.quizAttempts} · cards ${mastery.flashcardGood}/${mastery.flashcardReviews}`
        : weak ? `Weak-topic score ${weak.score}` : `${correct} correct practice answers · ${cards} reviewed cards`,
    };
  });
}

function subjectReadiness(data: ExamPilotData, subject: Subject) {
  const weak = data.weakTopics.filter((topic) => topic.subjectId === subject.id).reduce((sum, topic) => sum + topic.score, 0);
  const done = data.sessions.filter((session) => session.subjectId === subject.id && session.status === 'done').length;
  const due = data.flashcards.filter((card) => card.subjectId === subject.id && card.nextReview <= today()).length;
  return Math.max(0, Math.min(100, Math.round(subject.confidence * 17 + done * 4 - weak * 3 - due * 2)));
}

function getRecentActivity(data: ExamPilotData, subjectId: string) {
  return [
    ...data.flashcards.filter((card) => card.subjectId === subjectId && card.lastReviewed).map((card) => ({ title: `Reviewed ${card.topic}`, meta: card.lastReviewed?.slice(0, 10) ?? '' })),
    ...data.sessions.filter((session) => session.subjectId === subjectId && session.status !== 'planned').map((session) => ({ title: `${session.status}: ${session.title}`, meta: session.date })),
    ...data.practiceQuestions.filter((question) => question.subjectId === subjectId && question.result).map((question) => ({ title: `${question.result}: ${question.topic}`, meta: question.prompt })),
  ].slice(0, 8);
}

function sessionsForDate(sessions: TimetableSession[], date: string) {
  return [...sessions].filter((session) => session.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function nextSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      label: index === 0 ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short' }),
    };
  });
}

function getDueCards(cards: Flashcard[]) {
  return [...cards].filter((card) => card.nextReview <= today()).sort((a, b) => a.nextReview.localeCompare(b.nextReview));
}

function studyStreak(done: TimetableSession[]) {
  const dates = new Set(done.map((session) => session.date));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 90; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysUntil(date: string) {
  const end = new Date(`${date}T12:00:00`);
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function formatCountdown(date: string) {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)}d past`;
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function subjectById(data: ExamPilotData, id?: string) {
  return data.subjects.find((subject) => subject.id === id);
}

function subjectName(data: ExamPilotData, id?: string) {
  return subjectById(data, id)?.name ?? 'No subject';
}

function extractTopicsFromText(text: string) {
  const stop = new Set(['revision', 'question', 'questions', 'answer', 'answers', 'explain', 'describe', 'teacher', 'specification', 'method', 'example']);
  const words = text
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 4 && !stop.has(word.toLowerCase()));
  const counts = new Map<string, number>();
  words.forEach((word) => {
    const clean = word[0].toUpperCase() + word.slice(1).toLowerCase();
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word).slice(0, 10);
}

function upsertTopicMastery(
  items: TopicMastery[],
  subjectId: string,
  topic: string,
  patch: {
    confidence?: ConfidenceLevel;
    revisionCountDelta?: number;
    quizAttemptsDelta?: number;
    quizCorrectDelta?: number;
    flashcardReviewsDelta?: number;
    flashcardGoodDelta?: number;
    aiEstimatedMastery?: number;
  },
) {
  const existing = items.find((item) => item.subjectId === subjectId && item.topic.toLowerCase() === topic.toLowerCase());
  const next = (item: TopicMastery): TopicMastery => {
    const revisionCount = item.revisionCount + (patch.revisionCountDelta ?? 0);
    const quizAttempts = item.quizAttempts + (patch.quizAttemptsDelta ?? 0);
    const quizCorrect = item.quizCorrect + (patch.quizCorrectDelta ?? 0);
    const flashcardReviews = item.flashcardReviews + (patch.flashcardReviewsDelta ?? 0);
    const flashcardGood = item.flashcardGood + (patch.flashcardGoodDelta ?? 0);
    const quizAccuracy = quizAttempts ? quizCorrect / quizAttempts : 0.5;
    const cardAccuracy = flashcardReviews ? flashcardGood / flashcardReviews : 0.5;
    const estimated = patch.aiEstimatedMastery ?? Math.round((item.confidence / 5) * 35 + quizAccuracy * 35 + cardAccuracy * 20 + Math.min(10, revisionCount * 2));
    return {
      ...item,
      confidence: patch.confidence ?? item.confidence,
      revisionCount,
      quizAttempts,
      quizCorrect,
      flashcardReviews,
      flashcardGood,
      aiEstimatedMastery: Math.max(5, Math.min(98, estimated)),
      lastRevised: patch.revisionCountDelta ? today() : item.lastRevised,
      updatedAt: new Date().toISOString(),
    };
  };

  if (existing) return items.map((item) => (item.id === existing.id ? next(item) : item));
  return [
    ...items,
    next({
      id: newId('mastery'),
      subjectId,
      topic,
      confidence: 3,
      revisionCount: 0,
      quizAttempts: 0,
      quizCorrect: 0,
      flashcardReviews: 0,
      flashcardGood: 0,
      aiEstimatedMastery: 45,
      updatedAt: new Date().toISOString(),
    }),
  ];
}

function inferTopicFromText(text: string, data: ExamPilotData, subjectId: string) {
  const lower = text.toLowerCase();
  const known = [
    ...data.topicMastery.filter((item) => item.subjectId === subjectId).map((item) => item.topic),
    ...data.weakTopics.filter((item) => item.subjectId === subjectId).map((item) => item.topic),
    ...data.knowledgeDocuments.filter((item) => item.subjectId === subjectId).flatMap((item) => item.extractedTopics),
  ];
  return known.find((topic) => lower.includes(topic.toLowerCase())) ?? extractTopicsFromText(text)[0];
}

function inferDifficulty(text: string): PastPaperItem['difficulty'] {
  const lower = text.toLowerCase();
  if (lower.includes('higher') || lower.includes('evaluate') || lower.includes('assess')) return 'Higher';
  if (lower.includes('foundation')) return 'Foundation';
  if (text.length > 700 || lower.includes('essay') || lower.includes('16 mark')) return 'Higher';
  if (text.length > 250) return 'Standard';
  return 'Unknown';
}

function extractBulletishLines(text: string) {
  return text
    .split(/\n|\. /)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((line) => line.length > 18)
    .slice(0, 10);
}

export default App;
