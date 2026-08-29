import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const LEARNING_SKILLS = [
  { key: 'responsibility', label: 'Responsibility', description: 'Fulfils responsibilities and commitments within the learning environment' },
  { key: 'organization', label: 'Organization', description: 'Devises and follows a plan and process for completing work and tasks' },
  { key: 'independentWork', label: 'Independent Work', description: 'Uses class time appropriately to complete tasks' },
  { key: 'collaboration', label: 'Collaboration', description: 'Works with others; responds to ideas, opinions, values, and traditions of others' },
  { key: 'initiative', label: 'Initiative', description: 'Demonstrates curiosity and interest in learning; approaches new tasks positively' },
  { key: 'selfRegulation', label: 'Self-Regulation', description: 'Sets individual goals and monitors progress towards achieving them' },
];
const SKILL_RATINGS = ['E', 'G', 'S', 'N'];
const SKILL_LABELS = { E: 'Excellent', G: 'Good', S: 'Satisfactory', N: 'Needs Improvement' };
const WORD_COUNT_OPTIONS = [50, 75, 100, 125, 150, 200];

const SUBJECT_STRENGTHS = [
  'actively participates in class discussions',
  'demonstrates strong understanding of concepts',
  'completes work with care and attention to detail',
  'shows creativity and original thinking',
  'demonstrates strong problem-solving skills',
  'consistently demonstrates effort and perseverance',
  'shows growth and improvement throughout the term',
  'applies learning to new situations effectively',
  'works well with peers during group activities',
  'asks thoughtful questions that deepen understanding',
];
const SUBJECT_STRUGGLES = [
  'would benefit from additional practice with foundational skills',
  'is working on applying strategies consistently',
  'would benefit from reviewing work before submitting',
  'is developing confidence when approaching new concepts',
  'is working on providing more detail in written responses',
  'is developing strategies for organizing ideas',
  'is working on completing tasks within the allotted time',
];
const LS_STRENGTHS = [
  'consistently completes and submits work on time',
  'comes to class prepared with materials and assignments',
  'manages time effectively during work periods',
  'works independently without requiring redirection',
  'is a positive and supportive team member',
  'takes initiative in their own learning',
  'demonstrates resilience when facing challenges',
  'follows classroom routines and expectations consistently',
];
const LS_STRUGGLES = [
  'is working on submitting assignments on time',
  'is developing strategies to stay focused during independent work',
  'is working on arriving prepared with all required materials',
  'is developing organizational strategies for managing tasks',
  'is working on asking for help when needed',
  'is developing strategies for working through frustration',
  'is working on active listening during instruction',
];

function getOntarioLevel(pct) {
  if (pct == null) return null;
  if (pct >= 80) return 'Level 4';
  if (pct >= 70) return 'Level 3';
  if (pct >= 60) return 'Level 2';
  if (pct >= 50) return 'Level 1';
  return 'R';
}

function Chips({ items, selected, onToggle, type }) {
  return (
    <div className="obs-chips">
      {items.map(obs => (
        <button key={obs} type="button"
          className={`obs-chip obs-${type} ${selected.includes(obs) ? 'selected' : ''}`}
          onClick={() => onToggle(obs)}
        >{obs}</button>
      ))}
    </div>
  );
}

function ChatBox({ commentId, currentContent, onRefined, headers, classId }) {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    const userMsg = feedback;
    setHistory(prev => [...prev, { role: 'teacher', text: userMsg }]);
    setFeedback('');
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/comments/${commentId}/refine`,
        { feedback: userMsg, currentContent },
        { headers }
      );
      setHistory(prev => [...prev, { role: 'ai', text: res.data.content }]);
      onRefined(res.data.content);
    } catch (err) {
      setHistory(prev => [...prev, { role: 'error', text: err.response?.data?.error || 'Failed to refine' }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">💬 Refine this comment — tell the AI what to change</div>
      {history.length > 0 && (
        <div className="chat-history">
          {history.map((msg, i) => (
            <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
              <span className="chat-role">{msg.role === 'teacher' ? 'You' : msg.role === 'ai' ? 'AI' : '⚠️'}</span>
              <span className="chat-text">{msg.text}</span>
            </div>
          ))}
          {loading && <div className="chat-msg chat-msg-ai"><span className="chat-role">AI</span><span className="chat-text chat-typing">Rewriting…</span></div>}
        </div>
      )}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
          placeholder="e.g. Make it shorter, mention she struggles with fractions, change the tone to be more positive…"
          rows={2}
          disabled={loading}
        />
        <button className="btn-primary chat-send" onClick={handleRefine} disabled={loading || !feedback.trim()}>
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment, onUpdate, onDelete, onFinalize, onContentChange, headers, classId }) {
  const [showChat, setShowChat] = useState(false);
  const wordCount = comment.content ? comment.content.trim().split(/\s+/).length : 0;

  return (
    <div className={`comment-block ${comment.draft ? 'draft' : 'final'}`}>
      <div className="comment-header">
        <div>
          <strong>
            {comment.commentType === 'subject'
              ? `📚 ${comment.subject || 'Subject'} Comment`
              : '📋 Learning Skills Comment'}
          </strong>
          {comment.term && <span className="badge badge-secondary" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>{comment.term}</span>}
          <span className="text-muted" style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }}>~{wordCount} words</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className={`badge ${comment.draft ? 'badge-secondary' : 'badge-success'}`}>
            {comment.draft ? 'Draft' : 'Final'}
          </span>
          {comment.draft && (
            <button className="btn-success" style={{ padding: '0.25rem 0.75rem', fontSize: '0.82rem' }} onClick={onFinalize}>Mark Final</button>
          )}
          <button
            className={showChat ? 'btn-secondary' : 'btn-primary'}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}
            onClick={() => setShowChat(s => !s)}
          >
            {showChat ? 'Close Chat' : '💬 Refine'}
          </button>
          <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.82rem' }} onClick={onDelete}>Delete</button>
        </div>
      </div>
      <textarea
        value={comment.content}
        onChange={e => onContentChange(e.target.value)}
        className="comment-textarea"
        rows={5}
      />
      {showChat && (
        <ChatBox
          commentId={comment.id}
          currentContent={comment.content}
          onRefined={onContentChange}
          headers={headers}
          classId={classId}
        />
      )}
    </div>
  );
}

function ReportCardWriter() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [classData, setClassData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [term, setTerm] = useState('Term 1');
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentGrade, setStudentGrade] = useState(null);
  const [allComments, setAllComments] = useState([]);
  const [previousComments, setPreviousComments] = useState([]);
  const [learningSkills, setLearningSkills] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [latestComment, setLatestComment] = useState(null);

  // Persisted context (loaded from/saved to DB)
  const [classContext, setClassContext] = useState('');
  const [subjectStrengths, setSubjectStrengths] = useState({});
  const [subjectStruggles, setSubjectStruggles] = useState({});
  const [subjectCustom, setSubjectCustom] = useState({});
  const [subjectWordCount, setSubjectWordCount] = useState({});
  const [lsStrengths, setLsStrengths] = useState([]);
  const [lsStruggles, setLsStruggles] = useState([]);
  const [lsCustom, setLsCustom] = useState('');
  const [lsWordCount, setLsWordCount] = useState(100);
  const [lsContext, setLsContext] = useState('');
  const [showPrevious, setShowPrevious] = useState(false);

  // Bulk fill state
  const [bulkMode, setBulkMode] = useState(null); // null | 'all' | 'level'
  const [bulkLevel, setBulkLevel] = useState('Level 4');
  const [bulkText, setBulkText] = useState('');
  const [bulkTemplateName, setBulkTemplateName] = useState('');
  const [bulkTemplatePronouns, setBulkTemplatePronouns] = useState('they/them');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [undoIds, setUndoIds] = useState(null); // array of comment ids to delete on undo
  const [allStudentGrades, setAllStudentGrades] = useState({}); // studentId → overall %

  const commentsRef = useRef(null);
  const saveContextTimer = useRef(null);

  // Determine available terms based on school type
  const termOptions = classData?.schoolType === 'secondary'
    ? ['Semester 1', 'Semester 2']
    : ['Term 1', 'Term 2', 'Term 3'];

  useEffect(() => { loadClassAndStudents(); }, [classId]);

  useEffect(() => {
    if (selectedStudentId && activeTab !== null) {
      setLatestComment(null);
      loadStudentData();
    }
  }, [selectedStudentId, activeTab, term]);

  useEffect(() => {
    if (activeTab && activeTab !== 'learning-skills') {
      loadClassContext();
      loadAllStudentGrades(activeTab);
      if (selectedStudentId) loadStudentNotes();
    } else if (activeTab === 'learning-skills') {
      loadClassContext();
      if (selectedStudentId) loadStudentNotes();
    }
    // Reset bulk UI when switching tabs
    setBulkMode(null);
    setBulkText('');
    setUndoIds(null);
  }, [activeTab, term, selectedStudentId]);

  const loadClassAndStudents = async () => {
    try {
      const [classRes, studentsRes] = await Promise.all([
        axios.get(`${API}/classes/${classId}`, { headers }),
        axios.get(`${API}/classes/${classId}/students`, { headers }),
      ]);
      const cls = classRes.data;
      setClassData(cls);
      const subs = Array.isArray(cls.subjects) ? cls.subjects : [];
      setSubjects(subs);
      setActiveTab(subs.length > 0 ? subs[0] : 'learning-skills');
      setStudents(studentsRes.data);
      if (studentsRes.data.length > 0) setSelectedStudentId(studentsRes.data[0].id);
    } catch { setError('Failed to load class data'); }
  };

  const loadStudentData = async () => {
    if (!selectedStudentId) return;
    try {
      const subject = activeTab !== 'learning-skills' ? activeTab : null;
      const params = { term };
      if (subject) params.subject = subject;

      const [gradeRes, commentsRes, skillsRes, prevRes] = await Promise.all([
        axios.get(`${API}/classes/${classId}/students/${selectedStudentId}/overall-grade`, { headers, params: subject ? { subject } : {} }),
        axios.get(`${API}/classes/${classId}/students/${selectedStudentId}/comments`, { headers, params }),
        axios.get(`${API}/classes/${classId}/students/${selectedStudentId}/learning-skills`, { headers, params: { term } }),
        // Load previous term comments for context
        loadPreviousTermComments(selectedStudentId, subject, term),
      ]);
      setStudentGrade(gradeRes.data.overallGrade);
      setAllComments(commentsRes.data);
      setLearningSkills(skillsRes.data || {});
    } catch (err) { console.error('Failed to load student data:', err); }
  };

  const loadPreviousTermComments = async (studentId, subject, currentTerm) => {
    try {
      // Get ALL comments for this student (all terms) to find previous term ones
      const res = await axios.get(
        `${API}/classes/${classId}/students/${studentId}/comments`,
        { headers }
      );
      const allStudentComments = res.data;
      // Filter to DIFFERENT terms than current
      const prev = allStudentComments.filter(c => c.term && c.term !== currentTerm && c.draft === 0);
      setPreviousComments(prev);
      return prev;
    } catch { return []; }
  };

  const loadAllStudentGrades = async (subject) => {
    if (!subject || subject === 'learning-skills') return;
    try {
      const gb = await axios.get(`${API}/classes/${classId}/gradebook`, { headers, params: { subject } });
      const matrix = gb.data.gradeMatrix;
      const assignments = gb.data.assignments;
      const grades = {};
      for (const s of gb.data.students) {
        let totalPoints = 0, totalWeight = 0;
        for (const a of assignments) {
          const cell = matrix[s.id]?.[a.id];
          if (cell?.grade != null && cell.grade !== '') {
            totalPoints += (parseFloat(cell.grade) / a.maxGrade) * 100 * a.weight;
            totalWeight += a.weight;
          }
        }
        grades[s.id] = totalWeight > 0 ? Math.round((totalPoints / totalWeight) * 10) / 10 : null;
      }
      setAllStudentGrades(grades);
    } catch {}
  };

  const loadClassContext = async () => {
    if (!activeTab) return;
    try {
      const subject = activeTab === 'learning-skills' ? '__ls__' : activeTab;
      const res = await axios.get(`${API}/classes/${classId}/context`, { headers, params: { subject, term } });
      if (activeTab === 'learning-skills') {
        setLsContext(res.data.context || '');
      } else {
        setClassContext(res.data.context || '');
      }
    } catch {}
  };

  const loadStudentNotes = async () => {
    if (!selectedStudentId || !activeTab) return;
    try {
      const subject = activeTab === 'learning-skills' ? null : activeTab;
      const res = await axios.get(
        `${API}/classes/${classId}/students/${selectedStudentId}/notes`,
        { headers, params: { subject: subject || undefined, term } }
      );
      const notes = res.data;
      if (activeTab === 'learning-skills') {
        setLsStrengths(notes.strengths || []);
        setLsStruggles(notes.struggles || []);
        setLsCustom(notes.customContext || '');
      } else {
        setSubjectStrengths(prev => ({ ...prev, [activeTab]: notes.strengths || [] }));
        setSubjectStruggles(prev => ({ ...prev, [activeTab]: notes.struggles || [] }));
        setSubjectCustom(prev => ({ ...prev, [activeTab]: notes.customContext || '' }));
      }
    } catch {}
  };

  const saveClassContext = useCallback((subject, ctx) => {
    clearTimeout(saveContextTimer.current);
    saveContextTimer.current = setTimeout(async () => {
      try {
        await axios.put(`${API}/classes/${classId}/context`, { subject, term, context: ctx }, { headers });
      } catch {}
    }, 1000);
  }, [classId, term]);

  const saveStudentNotes = useCallback((subject, strengths, struggles, custom) => {
    clearTimeout(saveContextTimer.current);
    saveContextTimer.current = setTimeout(async () => {
      if (!selectedStudentId) return;
      try {
        await axios.put(
          `${API}/classes/${classId}/students/${selectedStudentId}/notes`,
          { subject: subject || null, term, strengths, struggles, customContext: custom },
          { headers }
        );
      } catch {}
    }, 800);
  }, [classId, selectedStudentId, term]);

  const getStudentsForBulk = () => {
    if (bulkMode === 'all') return students.map(s => s.id);
    if (bulkMode === 'level') {
      return students.filter(s => {
        const pct = allStudentGrades[s.id];
        return getOntarioLevel(pct) === bulkLevel;
      }).map(s => s.id);
    }
    return [];
  };

  const handleBulkFill = async () => {
    const studentIds = getStudentsForBulk();
    if (!studentIds.length) { setError('No students match that level for this subject.'); return; }
    if (!bulkText.trim()) { setError('Please enter a comment to fill.'); return; }
    setBulkLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/classes/${classId}/bulk-comment`,
        { subject: activeTab, term, commentText: bulkText.trim(), studentIds, templateName: bulkTemplateName.trim(), templatePronouns: bulkTemplatePronouns },
        { headers }
      );
      setUndoIds(res.data.created.map(c => c.id));
      // If current student was one of them, add to their displayed comments
      const mine = res.data.created.find(c => c.studentId === selectedStudentId);
      if (mine) {
        setAllComments(prev => [mine, ...prev]);
        setLatestComment(mine);
      }
      setBulkMode(null);
      setBulkText('');
      setBulkTemplateName('');
      setBulkTemplatePronouns('they/them');
      setSuccess(`Comment filled for ${studentIds.length} student${studentIds.length !== 1 ? 's' : ''}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Bulk fill failed');
    } finally { setBulkLoading(false); }
  };

  const handleUndo = async () => {
    if (!undoIds?.length) return;
    try {
      await axios.post(`${API}/comments/bulk-delete`, { commentIds: undoIds }, { headers });
      setAllComments(prev => prev.filter(c => !undoIds.includes(c.id)));
      if (undoIds.includes(latestComment?.id)) setLatestComment(null);
      setUndoIds(null);
      setSuccess('Bulk fill undone.');
    } catch { setError('Undo failed'); }
  };

  const handleGenerateSubjectComment = async (subject) => {
    if (!selectedStudentId) return;
    setLoading(true); setError(''); setSuccess('');
    const strengths = subjectStrengths[subject] || [];
    const struggles = subjectStruggles[subject] || [];
    const wordCount = subjectWordCount[subject] || 100;
    const prevForSubject = previousComments.filter(c => c.subject === subject || c.commentType === 'subject');
    try {
      const res = await axios.post(`${API}/classes/${classId}/generate-comment`, {
        studentId: selectedStudentId,
        overallGrade: studentGrade,
        classContext,
        strengths: strengths.join('; '),
        struggles: struggles.join('; '),
        customContext: subjectCustom[subject] || '',
        commentType: 'subject',
        subject, term, targetWordCount: wordCount,
        previousTermComments: prevForSubject,
        quickObservations: [...strengths.map(s => `Strength: ${s}`), ...struggles.map(s => `Growth: ${s}`)],
      }, { headers });
      setAllComments(prev => [res.data, ...prev]);
      setLatestComment(res.data);
      setSuccess(`${subject} comment generated!`);
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate comment');
    } finally { setLoading(false); }
  };

  const handleGenerateLSComment = async () => {
    if (!selectedStudentId) return;
    setLoading(true); setError(''); setSuccess('');
    const prevLS = previousComments.filter(c => c.commentType === 'learning-skills');
    try {
      const res = await axios.post(`${API}/classes/${classId}/generate-comment`, {
        studentId: selectedStudentId,
        overallGrade: null,
        classContext: lsContext,
        strengths: lsStrengths.join('; '),
        struggles: lsStruggles.join('; '),
        customContext: lsCustom,
        commentType: 'learning-skills',
        subject: null, term, targetWordCount: lsWordCount,
        previousTermComments: prevLS,
        quickObservations: [...lsStrengths.map(s => `Strength: ${s}`), ...lsStruggles.map(s => `Growth: ${s}`)],
      }, { headers });
      setAllComments(prev => [res.data, ...prev]);
      setLatestComment(res.data);
      setSuccess('Learning Skills comment generated!');
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate comment');
    } finally { setLoading(false); }
  };

  const handleSaveLearningSkills = async () => {
    if (!selectedStudentId) return;
    try {
      await axios.post(`${API}/classes/${classId}/students/${selectedStudentId}/learning-skills`, { ...learningSkills, term }, { headers });
      setSuccess('Learning skills saved!');
    } catch { setError('Failed to save learning skills'); }
  };

  const handleUpdateComment = (commentId, content) => {
    setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, content } : c));
    if (latestComment?.id === commentId) setLatestComment(prev => ({ ...prev, content }));
    axios.put(`${API}/comments/${commentId}`, { content, draft: true }, { headers }).catch(() => {});
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(`${API}/comments/${commentId}`, { headers });
      setAllComments(prev => prev.filter(c => c.id !== commentId));
      if (latestComment?.id === commentId) setLatestComment(null);
    } catch { setError('Failed to delete comment'); }
  };

  const handleFinalizeComment = async (commentId) => {
    const comment = allComments.find(c => c.id === commentId) || latestComment;
    try {
      await axios.put(`${API}/comments/${commentId}`, { content: comment.content, draft: false }, { headers });
      setAllComments(prev => prev.map(c => c.id === commentId ? { ...c, draft: false } : c));
      if (latestComment?.id === commentId) setLatestComment(prev => ({ ...prev, draft: false }));
      setSuccess('Comment marked as final!');
    } catch { setError('Failed to finalize comment'); }
  };

  const handleExport = () => {
    const url = `${API}/classes/${classId}/export?term=${encodeURIComponent(term)}`;
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('Authorization', `Bearer ${token}`);
    // Need to fetch with auth header
    axios.get(url, { headers, responseType: 'blob' }).then(res => {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `report-cards-${term.replace(' ', '-')}.xlsx`;
      link.click();
    }).catch(() => setError('Export failed'));
  };

  const currentStudent = students.find(s => s.id == selectedStudentId);
  const gradesDisplay = Array.isArray(classData?.grades) ? classData.grades.join(' / ') : classData?.grades;
  const isElementary = classData?.schoolType === 'elementary';
  const level = isElementary && studentGrade != null ? getOntarioLevel(studentGrade) : null;
  const allTabs = [...subjects, 'learning-skills'];

  const tabComments = allComments.filter(c =>
    activeTab === 'learning-skills'
      ? c.commentType === 'learning-skills'
      : c.commentType === 'subject' && c.subject === activeTab
  );

  const finalCount = allComments.filter(c => !c.draft).length;

  return (
    <div className="container">
      <button className="btn-secondary" onClick={() => navigate('/dashboard')}>← Dashboard</button>

      {classData && (
        <div style={{ margin: '1rem 0 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>{classData.className} — Report Card Writer</h1>
            <p className="text-muted">{gradesDisplay}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Term selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Reporting Period:</label>
              <select
                value={term}
                onChange={e => setTerm(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '2px solid #97B3AE', fontWeight: 600, color: '#3f6460' }}
              >
                {termOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button className="btn-success" onClick={handleExport} title={`Export final comments for ${term}`}>
              ⬇️ Export {term} to Excel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', color: 'inherit', padding: '0 0.5rem' }}>×</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          {success}
          <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', color: 'inherit', padding: '0 0.5rem' }}>×</button>
        </div>
      )}

      {/* Student selector */}
      <div className="card">
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: '1', minWidth: '200px', marginBottom: 0 }}>
            <label><strong>Student</strong></label>
            <select value={selectedStudentId || ''} onChange={e => setSelectedStudentId(parseInt(e.target.value))}>
              {students.map(s => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
            </select>
          </div>
          {currentStudent && (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', paddingTop: '1.6rem' }}>
              <div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>Pronouns</div>
                <div style={{ fontWeight: 600 }}>{currentStudent.pronouns || 'Not set'}</div>
              </div>
              {studentGrade != null && (
                <div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {activeTab && activeTab !== 'learning-skills' ? `${activeTab} Grade` : 'Grade'}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: studentGrade >= 70 ? '#27ae60' : studentGrade >= 50 ? '#e67e22' : '#e74c3c' }}>
                    {studentGrade}%
                    {level && <span style={{ fontSize: '0.9rem', marginLeft: '0.4rem', color: '#555' }}>({level})</span>}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>Finals this term</div>
                <div style={{ fontWeight: 600, color: '#27ae60' }}>{finalCount} / {allComments.length} comments</div>
              </div>
            </div>
          )}
        </div>

        {/* Previous term comments toggle */}
        {previousComments.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#8e44ad', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.9rem' }}
              onClick={() => setShowPrevious(p => !p)}
            >
              {showPrevious ? '▼' : '▶'} Previous term comments ({previousComments.length}) — used as AI context
            </button>
            {showPrevious && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {previousComments.map(c => (
                  <div key={c.id} style={{ background: '#f5eef8', border: '1px solid #d2b4de', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.88rem' }}>
                    <strong style={{ color: '#6c3483' }}>{c.term} — {c.commentType === 'learning-skills' ? 'Learning Skills' : c.subject}</strong>
                    <p style={{ margin: '0.25rem 0 0', color: '#555', lineHeight: '1.5' }}>{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {students.length === 0 && (
        <div className="card">
          <p className="text-muted">No students yet. Go to <strong>Students</strong> to import your class list first.</p>
        </div>
      )}

      {/* Newly generated comment — always shown immediately */}
      {latestComment && (
        <div ref={commentsRef} className="card" style={{ border: '2px solid #27ae60', background: '#f0fff4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong style={{ color: '#1e8449' }}>
              ✅ New: {latestComment.commentType === 'learning-skills' ? 'Learning Skills' : latestComment.subject} Comment — {latestComment.term}
            </strong>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {latestComment.draft && (
                <button className="btn-success" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => handleFinalizeComment(latestComment.id)}>
                  Mark Final
                </button>
              )}
              <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                onClick={() => { handleDeleteComment(latestComment.id); setLatestComment(null); }}>
                Delete
              </button>
              <button style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                onClick={() => setLatestComment(null)}>
                Dismiss
              </button>
            </div>
          </div>
          <textarea
            value={latestComment.content}
            onChange={e => handleUpdateComment(latestComment.id, e.target.value)}
            style={{ width: '100%', minHeight: '140px', border: '1px solid #a9dfbf', borderRadius: '4px', padding: '0.75rem', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: '1.6', boxSizing: 'border-box', resize: 'vertical' }}
          />
          <ChatBox
            commentId={latestComment.id}
            currentContent={latestComment.content}
            onRefined={content => handleUpdateComment(latestComment.id, content)}
            headers={headers}
            classId={classId}
          />
        </div>
      )}

      {selectedStudentId && allTabs.length > 0 && (
        <>
          <div className="subject-tabs">
            {allTabs.map(tab => (
              <button key={tab} className={`subject-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab === 'learning-skills' ? '📋 Learning Skills' : tab}
                {tab !== 'learning-skills' && (() => {
                  const c = allComments.filter(x => x.commentType === 'subject' && x.subject === tab);
                  return c.length > 0 ? <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', opacity: 0.8 }}>({c.filter(x => !x.draft).length}/{c.length})</span> : null;
                })()}
              </button>
            ))}
          </div>

          {/* SUBJECT TAB */}
          {activeTab !== 'learning-skills' && activeTab && (
            <div>
              {/* CLASS-WIDE CONTEXT — saved once, applies to all students */}
              <div className="card" style={{ borderTop: '3px solid #97B3AE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Class Context — {activeTab} ({term})</h2>
                  <span style={{ fontSize: '0.78rem', background: '#D2E0D3', color: '#3f6460', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Saved once for all students
                  </span>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>What has the whole class been working on in {activeTab} this {term}?</label>
                  <textarea rows={4} value={classContext}
                    onChange={e => { setClassContext(e.target.value); saveClassContext(activeTab, e.target.value); }}
                    placeholder={`e.g., This ${term} we have been exploring patterning and algebra, working with addition and subtraction strategies, and practicing word problems. Students have been developing their skills in…`}
                  />
                  <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                    This context is used for every student's comment in {activeTab} — you only need to write it once.
                  </p>
                </div>
              </div>

              {/* ── Bulk Fill ── */}
              <div className="card" style={{ borderTop: '3px solid #F2C3B9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ color: '#5a524c' }}>Bulk Fill Comment</strong>
                    <span className="text-muted" style={{ fontSize: '0.82rem', marginLeft: '0.6rem' }}>Apply the same comment to multiple students at once</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={bulkMode === 'all' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.88rem' }}
                      onClick={() => { setBulkMode(bulkMode === 'all' ? null : 'all'); setBulkText(''); }}
                    >
                      Fill All Students ({students.length})
                    </button>
                    <button
                      type="button"
                      className={bulkMode === 'level' ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.88rem' }}
                      onClick={() => { setBulkMode(bulkMode === 'level' ? null : 'level'); setBulkText(''); }}
                    >
                      Fill by Level
                    </button>
                  </div>
                </div>

                {bulkMode && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #F0EEEA', paddingTop: '1rem' }}>
                    {bulkMode === 'level' && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem', color: '#5a524c' }}>Select level to fill</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {['Level 4', 'Level 3', 'Level 2', 'Level 1'].map(lvl => {
                            const count = students.filter(s => getOntarioLevel(allStudentGrades[s.id]) === lvl).length;
                            return (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setBulkLevel(lvl)}
                                style={{
                                  padding: '0.4rem 0.9rem',
                                  borderRadius: '20px',
                                  border: `2px solid ${bulkLevel === lvl ? '#97B3AE' : '#D6CBBF'}`,
                                  background: bulkLevel === lvl ? '#97B3AE' : 'white',
                                  color: bulkLevel === lvl ? 'white' : '#5a524c',
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {lvl} <span style={{ opacity: 0.75 }}>({count})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Preview */}
                    {(() => {
                      const ids = getStudentsForBulk();
                      const names = students.filter(s => ids.includes(s.id)).map(s => s.firstName);
                      return ids.length > 0 ? (
                        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#F0EEEA', borderRadius: '8px', fontSize: '0.85rem', color: '#5a524c' }}>
                          Will apply to <strong>{ids.length} student{ids.length !== 1 ? 's' : ''}</strong>: {names.join(', ')}
                        </div>
                      ) : (
                        <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#fdf5f3', borderRadius: '8px', fontSize: '0.85rem', color: '#c9897e' }}>
                          No students at {bulkLevel} for this subject yet.
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label style={{ color: '#5a524c', fontWeight: 600, fontSize: '0.88rem' }}>Name used in the comment</label>
                        <input
                          type="text"
                          value={bulkTemplateName}
                          onChange={e => setBulkTemplateName(e.target.value)}
                          placeholder="e.g. Alex (leave blank if none)"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label style={{ color: '#5a524c', fontWeight: 600, fontSize: '0.88rem' }}>Pronouns used in the comment</label>
                        <select value={bulkTemplatePronouns} onChange={e => setBulkTemplatePronouns(e.target.value)}>
                          <option value="they/them">they/them</option>
                          <option value="she/her">she/her</option>
                          <option value="he/him">he/him</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label style={{ color: '#5a524c', fontWeight: 600 }}>Comment to fill</label>
                      <textarea
                        rows={5}
                        value={bulkText}
                        onChange={e => setBulkText(e.target.value)}
                        placeholder="Type or paste the comment here — it will be added as a draft for each student…"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleBulkFill}
                        disabled={bulkLoading || !bulkText.trim()}
                      >
                        {bulkLoading ? 'Filling…' : `Apply to ${getStudentsForBulk().length} student${getStudentsForBulk().length !== 1 ? 's' : ''}`}
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => { setBulkMode(null); setBulkText(''); setBulkTemplateName(''); setBulkTemplatePronouns('they/them'); }} disabled={bulkLoading}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Undo banner */}
              {undoIds && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef9e7', border: '1.5px solid #F2C3B9', borderRadius: '10px', marginBottom: '1rem' }}>
                  <span style={{ color: '#7a5c1e', fontSize: '0.9rem' }}>
                    Bulk fill applied to {undoIds.length} student{undoIds.length !== 1 ? 's' : ''} — did that go wrong?
                  </span>
                  <button
                    type="button"
                    onClick={handleUndo}
                    style={{ padding: '0.35rem 1rem', background: '#c9897e', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                  >
                    ↩ Undo
                  </button>
                </div>
              )}

              {tabComments.length > 0 ? (
                <div className="card">
                  <h2 style={{ marginTop: 0 }}>Comments — {currentStudent?.firstName} ({term})</h2>
                  {tabComments.map(c => (
                    <CommentCard key={c.id} comment={c}
                      onContentChange={val => handleUpdateComment(c.id, val)}
                      onDelete={() => handleDeleteComment(c.id)}
                      onFinalize={() => handleFinalizeComment(c.id)}
                      headers={headers} classId={classId}
                    />
                  ))}
                </div>
              ) : !latestComment && (
                <div className="card" style={{ borderLeft: '4px solid #97B3AE', background: '#f4f8f7' }}>
                  <p style={{ margin: 0, color: '#3f6460' }}>
                    No {activeTab} comments yet for {currentStudent?.firstName} in {term}. Add observations below and click <strong>Generate</strong>.
                  </p>
                </div>
              )}

              {/* STUDENT-SPECIFIC NOTES */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Notes for {currentStudent?.firstName}</h2>
                  <span style={{ fontSize: '0.78rem', background: '#F0DDD6', color: '#8b3a34', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Individual — changes per student
                  </span>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Anything specific about {currentStudent?.firstName} in {activeTab}? <span className="text-muted" style={{ fontWeight: 400 }}>(auto-saved)</span></label>
                  <textarea rows={3} value={subjectCustom[activeTab] || ''}
                    onChange={e => {
                      setSubjectCustom(prev => ({ ...prev, [activeTab]: e.target.value }));
                      saveStudentNotes(activeTab, subjectStrengths[activeTab] || [], subjectStruggles[activeTab] || [], e.target.value);
                    }}
                    placeholder={`e.g., ${currentStudent?.firstName} excels at group discussions but finds written responses challenging. Recently completed the independent reading project with strong results…`}
                  />
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Observations — {currentStudent?.firstName}</h2>
                  <span style={{ fontSize: '0.78rem', background: '#F0DDD6', color: '#8b3a34', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Individual — changes per student
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ color: '#27ae60', marginTop: 0 }}>Strengths</h3>
                    <Chips items={SUBJECT_STRENGTHS} selected={subjectStrengths[activeTab] || []}
                      onToggle={val => {
                        const next = (subjectStrengths[activeTab] || []).includes(val)
                          ? (subjectStrengths[activeTab] || []).filter(x => x !== val)
                          : [...(subjectStrengths[activeTab] || []), val];
                        setSubjectStrengths(prev => ({ ...prev, [activeTab]: next }));
                        saveStudentNotes(activeTab, next, subjectStruggles[activeTab] || [], subjectCustom[activeTab] || '');
                      }}
                      type="strength"
                    />
                  </div>
                  <div>
                    <h3 style={{ color: '#e67e22', marginTop: 0 }}>Areas for Growth</h3>
                    <Chips items={SUBJECT_STRUGGLES} selected={subjectStruggles[activeTab] || []}
                      onToggle={val => {
                        const next = (subjectStruggles[activeTab] || []).includes(val)
                          ? (subjectStruggles[activeTab] || []).filter(x => x !== val)
                          : [...(subjectStruggles[activeTab] || []), val];
                        setSubjectStruggles(prev => ({ ...prev, [activeTab]: next }));
                        saveStudentNotes(activeTab, subjectStrengths[activeTab] || [], next, subjectCustom[activeTab] || '');
                      }}
                      type="struggle"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Target word count</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {WORD_COUNT_OPTIONS.map(wc => (
                        <button key={wc} type="button"
                          className={`word-count-btn ${(subjectWordCount[activeTab] || 100) === wc ? 'selected' : ''}`}
                          onClick={() => setSubjectWordCount(prev => ({ ...prev, [activeTab]: wc }))}
                        >{wc}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: '1.4rem' }}
                    onClick={() => handleGenerateSubjectComment(activeTab)} disabled={loading}>
                    {loading ? 'Generating…' : `✏️ Generate ${activeTab} Comment`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LEARNING SKILLS TAB */}
          {activeTab === 'learning-skills' && (
            <div>
              {tabComments.length > 0 ? (
                <div className="card">
                  <h2 style={{ marginTop: 0 }}>💬 Learning Skills Comments — {currentStudent?.firstName} ({term})</h2>
                  {tabComments.map(c => (
                    <CommentCard key={c.id} comment={c}
                      onContentChange={val => handleUpdateComment(c.id, val)}
                      onDelete={() => handleDeleteComment(c.id)}
                      onFinalize={() => handleFinalizeComment(c.id)}
                      headers={headers} classId={classId}
                    />
                  ))}
                </div>
              ) : !latestComment && (
                <div className="card" style={{ borderLeft: '4px solid #9b59b6', background: '#f5eef8' }}>
                  <p style={{ margin: 0, color: '#7d3c98' }}>
                    No Learning Skills comments yet for {currentStudent?.firstName} in {term}. Set ratings below and click <strong>Generate</strong>.
                  </p>
                </div>
              )}

              <div className="card">
                <h2 style={{ marginTop: 0 }}>📋 Learning Skills & Work Habits — {term}</h2>
                <p className="text-muted">E = Excellent · G = Good · S = Satisfactory · N = Needs Improvement</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {LEARNING_SKILLS.map(({ key, label, description }) => (
                    <div key={key} className="learning-skill-row">
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: '0.5rem' }}>{description}</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {SKILL_RATINGS.map(val => (
                          <button key={val} type="button"
                            className={`skill-btn ${learningSkills[key] === val ? 'skill-btn-selected' : ''}`}
                            onClick={() => setLearningSkills(prev => ({ ...prev, [key]: prev[key] === val ? '' : val }))}
                            title={SKILL_LABELS[val]}
                          >{val}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn-success" onClick={handleSaveLearningSkills}>Save Learning Skills</button>
              </div>

              {/* CLASS-WIDE LS CONTEXT */}
              <div className="card" style={{ borderTop: '3px solid #97B3AE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Class Context — Learning Skills ({term})</h2>
                  <span style={{ fontSize: '0.78rem', background: '#D2E0D3', color: '#3f6460', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Saved once for all students
                  </span>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>General notes about your class's work habits and learning skills this {term}</label>
                  <textarea rows={3} value={lsContext}
                    onChange={e => { setLsContext(e.target.value); saveClassContext('__ls__', e.target.value); }}
                    placeholder="e.g., This term students have been working on developing independence during work periods and collaborative skills during group projects…"
                  />
                  <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.3rem 0 0' }}>
                    This context is shared across all students' Learning Skills comments — write it once.
                  </p>
                </div>
              </div>

              {/* STUDENT-SPECIFIC LS NOTES */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Notes for {currentStudent?.firstName}</h2>
                  <span style={{ fontSize: '0.78rem', background: '#F0DDD6', color: '#8b3a34', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Individual — changes per student
                  </span>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Specific notes about {currentStudent?.firstName}'s work habits this {term} <span className="text-muted" style={{ fontWeight: 400 }}>(auto-saved)</span></label>
                  <textarea rows={3} value={lsCustom}
                    onChange={e => {
                      setLsCustom(e.target.value);
                      saveStudentNotes(null, lsStrengths, lsStruggles, e.target.value);
                    }}
                    placeholder={`e.g., ${currentStudent?.firstName} has shown significant growth in organization this term. Consistently brings materials and completes homework on time…`}
                  />
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h2 style={{ marginTop: 0, color: '#5a524c' }}>Observations — {currentStudent?.firstName}'s Work Habits</h2>
                  <span style={{ fontSize: '0.78rem', background: '#F0DDD6', color: '#8b3a34', padding: '0.2rem 0.6rem', borderRadius: '12px', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                    Individual — changes per student
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <h3 style={{ color: '#27ae60', marginTop: 0 }}>Strengths</h3>
                    <Chips items={LS_STRENGTHS} selected={lsStrengths}
                      onToggle={val => {
                        const next = lsStrengths.includes(val) ? lsStrengths.filter(x => x !== val) : [...lsStrengths, val];
                        setLsStrengths(next);
                        saveStudentNotes(null, next, lsStruggles, lsCustom);
                      }}
                      type="strength"
                    />
                  </div>
                  <div>
                    <h3 style={{ color: '#e67e22', marginTop: 0 }}>Areas for Growth</h3>
                    <Chips items={LS_STRUGGLES} selected={lsStruggles}
                      onToggle={val => {
                        const next = lsStruggles.includes(val) ? lsStruggles.filter(x => x !== val) : [...lsStruggles, val];
                        setLsStruggles(next);
                        saveStudentNotes(null, lsStrengths, next, lsCustom);
                      }}
                      type="struggle"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Target word count</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {WORD_COUNT_OPTIONS.map(wc => (
                        <button key={wc} type="button"
                          className={`word-count-btn ${lsWordCount === wc ? 'selected' : ''}`}
                          onClick={() => setLsWordCount(wc)}
                        >{wc}</button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: '1.4rem' }} onClick={handleGenerateLSComment} disabled={loading}>
                    {loading ? 'Generating…' : '📋 Generate Learning Skills Comment'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ReportCardWriter;
