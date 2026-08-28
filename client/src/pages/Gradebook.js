import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:5000/api';

function getOntarioLevel(pct) {
  if (pct == null) return '—';
  if (pct >= 80) return 'Level 4';
  if (pct >= 70) return 'Level 3';
  if (pct >= 60) return 'Level 2';
  if (pct >= 50) return 'Level 1';
  return 'R';
}

function calcOverall(studentId, gradeMatrix, assignments) {
  let totalPoints = 0, totalWeight = 0;
  for (const a of assignments) {
    const cell = gradeMatrix[studentId]?.[a.id];
    if (cell?.grade != null && cell.grade !== '') {
      totalPoints += (parseFloat(cell.grade) / a.maxGrade) * 100 * a.weight;
      totalWeight += a.weight;
    }
  }
  if (totalWeight === 0) return null;
  return Math.round((totalPoints / totalWeight) * 10) / 10;
}

function Gradebook() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [classData, setClassData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [gradeMatrix, setGradeMatrix] = useState({});
  const [error, setError] = useState('');
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ name: '', maxGrade: 100, weight: 1, category: '' });
  const [saving, setSaving] = useState({});

  const loadGradebook = useCallback(async (subject) => {
    try {
      const [classRes, gbRes] = await Promise.all([
        axios.get(`${API}/classes/${classId}`, { headers }),
        axios.get(`${API}/classes/${classId}/gradebook`, { headers, params: subject ? { subject } : {} }),
      ]);
      const cls = classRes.data;
      setClassData(cls);
      const subs = Array.isArray(cls.subjects) ? cls.subjects : [];
      setSubjects(subs);
      if (!subject && subs.length > 0) {
        setSelectedSubject(subs[0]);
        // reload with first subject
        const gb2 = await axios.get(`${API}/classes/${classId}/gradebook`, { headers, params: { subject: subs[0] } });
        setStudents(gb2.data.students);
        setAssignments(gb2.data.assignments);
        setGradeMatrix(gb2.data.gradeMatrix);
      } else {
        setStudents(gbRes.data.students);
        setAssignments(gbRes.data.assignments);
        setGradeMatrix(gbRes.data.gradeMatrix);
      }
    } catch (err) {
      setError('Failed to load gradebook');
    }
  }, [classId]);

  useEffect(() => { loadGradebook(null); }, [loadGradebook]);

  const switchSubject = async (subject) => {
    setSelectedSubject(subject);
    setShowAddAssignment(false);
    try {
      const gb = await axios.get(`${API}/classes/${classId}/gradebook`, { headers, params: { subject } });
      setStudents(gb.data.students);
      setAssignments(gb.data.assignments);
      setGradeMatrix(gb.data.gradeMatrix);
    } catch { setError('Failed to load gradebook'); }
  };

  const handleGradeChange = (studentId, assignmentId, value) => {
    setGradeMatrix(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [assignmentId]: { ...prev[studentId]?.[assignmentId], grade: value },
      },
    }));
  };

  const handleGradeBlur = async (studentId, assignmentId, value) => {
    const key = `${studentId}-${assignmentId}`;
    if (value === '' || value == null) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      const res = await axios.put(
        `${API}/classes/${classId}/grades/upsert`,
        { studentId, assignmentId, grade: parseFloat(value) },
        { headers }
      );
      setGradeMatrix(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [assignmentId]: { id: res.data.id, grade: parseFloat(value) },
        },
      }));
    } catch (err) {
      setError('Failed to save grade');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.name) return;
    try {
      const res = await axios.post(`${API}/classes/${classId}/assignments`, { ...newAssignment, subject: selectedSubject }, { headers });
      setAssignments(prev => [...prev, res.data]);
      setGradeMatrix(prev => {
        const updated = { ...prev };
        for (const s of students) {
          updated[s.id] = { ...updated[s.id], [res.data.id]: { grade: '' } };
        }
        return updated;
      });
      setNewAssignment({ name: '', maxGrade: 100, weight: 1, category: '' });
      setShowAddAssignment(false);
    } catch (err) {
      setError('Failed to add assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Delete this assignment and all its grades?')) return;
    try {
      await axios.delete(`${API}/assignments/${assignmentId}`, { headers });
      setAssignments(prev => prev.filter(a => a.id !== assignmentId));
      setGradeMatrix(prev => {
        const updated = { ...prev };
        for (const sid in updated) {
          const { [assignmentId]: _, ...rest } = updated[sid];
          updated[sid] = rest;
        }
        return updated;
      });
    } catch { setError('Failed to delete assignment'); }
  };

  const isElementary = classData?.schoolType === 'elementary';
  const gradesDisplay = Array.isArray(classData?.grades) ? classData.grades.join(' / ') : classData?.grades;
  const subjectsDisplay = Array.isArray(classData?.subjects) ? classData.subjects.join(', ') : classData?.subjects;

  return (
    <div className="container">
      <button className="btn-secondary" onClick={() => navigate('/dashboard')}>← Dashboard</button>

      {classData && (
        <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
          <h1 style={{ marginBottom: '0.25rem' }}>{classData.className} — Gradebook</h1>
          <p className="text-muted">{gradesDisplay}</p>
        </div>
      )}

      {/* Subject tabs */}
      {subjects.length > 1 && (
        <div className="subject-tabs">
          {subjects.map(sub => (
            <button
              key={sub}
              className={`subject-tab ${selectedSubject === sub ? 'active' : ''}`}
              onClick={() => switchSubject(sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}
      {subjects.length === 1 && (
        <div style={{ marginBottom: '1rem' }}>
          <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>{subjects[0]}</span>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* Add Assignment */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button className="btn-primary" onClick={() => setShowAddAssignment(!showAddAssignment)}>
          {showAddAssignment ? 'Cancel' : '+ Add Assignment'}
        </button>
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
          {students.length} students · {assignments.length} assignments
        </span>
      </div>

      {showAddAssignment && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>New Assignment</h3>
          <form onSubmit={handleAddAssignment}>
            <div className="grid grid-2">
              <div className="form-group">
                <label>Assignment Name</label>
                <input
                  type="text"
                  placeholder="e.g., Unit 1 Test, Reading Response"
                  value={newAssignment.name}
                  onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Test, Assignment, Project"
                  value={newAssignment.category}
                  onChange={e => setNewAssignment({ ...newAssignment, category: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Out of (max grade)</label>
                <input
                  type="number"
                  value={newAssignment.maxGrade}
                  onChange={e => setNewAssignment({ ...newAssignment, maxGrade: parseFloat(e.target.value) })}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Weight</label>
                <input
                  type="number"
                  step="0.1"
                  value={newAssignment.weight}
                  onChange={e => setNewAssignment({ ...newAssignment, weight: parseFloat(e.target.value) })}
                  min="0.1"
                />
              </div>
            </div>
            <button type="submit" className="btn-success">Add Assignment</button>
          </form>
        </div>
      )}

      {/* Spreadsheet Table */}
      {students.length === 0 ? (
        <div className="card">
          <p className="text-muted">No students yet. Go to <strong>Students</strong> to import your class list first.</p>
        </div>
      ) : (
        <div className="gradebook-scroll">
          <table className="gradebook-table">
            <thead>
              <tr>
                <th className="student-col sticky-col">Student</th>
                {assignments.map(a => (
                  <th key={a.id} className="assignment-col">
                    <div className="assignment-header">
                      <span title={a.name}>{a.name}</span>
                      <span className="assignment-meta">/{a.maxGrade}{a.weight !== 1 ? ` ×${a.weight}` : ''}</span>
                      {a.category && <span className="assignment-category">{a.category}</span>}
                      <button
                        className="delete-assignment-btn"
                        onClick={() => handleDeleteAssignment(a.id)}
                        title="Delete assignment"
                      >×</button>
                    </div>
                  </th>
                ))}
                {assignments.length > 0 && (
                  <th className="overall-col">Overall</th>
                )}
                {assignments.length === 0 && (
                  <th className="overall-col" style={{ color: '#aaa', fontStyle: 'italic' }}>
                    Add assignments →
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {students.map(student => {
                const overall = calcOverall(student.id, gradeMatrix, assignments);
                return (
                  <tr key={student.id}>
                    <td className="student-col sticky-col">
                      <strong>{student.lastName}</strong>, {student.firstName}
                      {student.pronouns && <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.3rem' }}>({student.pronouns})</span>}
                      {overall !== null && overall < 60 && (
                        <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: '#c0392b', fontWeight: 700, background: '#fdecea', borderRadius: '4px', padding: '0.1rem 0.4rem', display: 'inline-block' }}>
                          ⚠️ Contact parents
                        </div>
                      )}
                    </td>
                    {assignments.map(a => {
                      const key = `${student.id}-${a.id}`;
                      const cell = gradeMatrix[student.id]?.[a.id];
                      const gradeVal = cell?.grade ?? '';
                      const pct = gradeVal !== '' ? Math.round((parseFloat(gradeVal) / a.maxGrade) * 100) : null;
                      return (
                        <td key={a.id} className="grade-cell">
                          <div className="grade-cell-inner">
                            <input
                              type="number"
                              className="grade-input"
                              value={gradeVal}
                              min="0"
                              max={a.maxGrade}
                              step="0.5"
                              onChange={e => handleGradeChange(student.id, a.id, e.target.value)}
                              onBlur={e => handleGradeBlur(student.id, a.id, e.target.value)}
                              placeholder="—"
                            />
                            {saving[key] && <span className="saving-dot">·</span>}
                            {pct !== null && (
                              <span className="grade-pct" style={{ color: pct >= 70 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c' }}>
                                {pct}%
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="overall-col">
                      {overall !== null ? (
                        <div>
                          <strong style={{ color: overall >= 70 ? '#27ae60' : overall >= 50 ? '#e67e22' : '#e74c3c' }}>
                            {overall}%
                          </strong>
                          {isElementary && (
                            <div style={{ fontSize: '0.8rem', color: '#555' }}>{getOntarioLevel(overall)}</div>
                          )}
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isElementary && assignments.length > 0 && (
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Ontario levels: Level 4 (80–100%) · Level 3 (70–79%) · Level 2 (60–69%) · Level 1 (50–59%) · R (below 50%)
        </p>
      )}
    </div>
  );
}

export default Gradebook;
