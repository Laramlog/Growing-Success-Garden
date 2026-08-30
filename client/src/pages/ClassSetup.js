import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function NotepadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <rect x="7" y="0.5" width="6" height="3" rx="1" fill="currentColor" opacity="0.5"/>
    </svg>
  );
}

function StickyNote({ student, onClose, onSave }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = student.classNotes || '';
      editorRef.current.focus();
      // place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, []);

  const exec = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(student.id, editorRef.current?.innerHTML || '');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const btnStyle = (active) => ({
    background: active ? '#e8d84a' : 'none',
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '2px 7px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#5a4e00',
    fontWeight: 600,
    lineHeight: 1.4,
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.25)'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFF9C4',
          borderRadius: '4px',
          boxShadow: '4px 6px 18px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.12)',
          width: '340px',
          padding: '0',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{
          background: '#F9E84B',
          borderRadius: '4px 4px 0 0',
          padding: '10px 14px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#5a4e00' }}>
            Notes — {student.firstName} {student.lastName || ''}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#5a4e00', lineHeight: 1, padding: '0 2px' }}
            title="Close"
          >✕</button>
        </div>

        {/* Toolbar */}
        <div style={{
          background: '#FFF59D',
          borderBottom: '1px solid #e8d84a',
          padding: '4px 10px',
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <button style={btnStyle()} title="Bold" onMouseDown={e => { e.preventDefault(); exec('bold'); }}><strong>B</strong></button>
          <button style={{ ...btnStyle(), fontStyle: 'italic' }} title="Italic" onMouseDown={e => { e.preventDefault(); exec('italic'); }}><em>I</em></button>
          <button style={{ ...btnStyle(), textDecoration: 'underline' }} title="Underline" onMouseDown={e => { e.preventDefault(); exec('underline'); }}>U</button>
          <span style={{ color: '#c9b800', margin: '0 2px' }}>|</span>
          <button style={btnStyle()} title="Bullet list" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>• List</button>
          <button style={btnStyle()} title="Numbered list" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}>1. List</button>
          <span style={{ color: '#c9b800', margin: '0 2px' }}>|</span>
          <button style={btnStyle()} title="Highlight" onMouseDown={e => { e.preventDefault(); exec('hiliteColor', '#ffe066'); }}>Highlight</button>
        </div>

        {/* Editor */}
        <div style={{ padding: '10px 14px 14px' }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write notes about this student…"
            style={{
              minHeight: '140px',
              maxHeight: '260px',
              overflowY: 'auto',
              outline: 'none',
              fontSize: '0.92rem',
              color: '#3a3000',
              lineHeight: '1.7',
              caretColor: '#3a3000',
            }}
          />
          <style>{`
            [contenteditable]:empty:before {
              content: attr(data-placeholder);
              color: #b8a800;
              pointer-events: none;
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid #c9b800', borderRadius: '12px',
                padding: '4px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#5a4e00'
              }}
            >Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#5a4e00', border: 'none', borderRadius: '12px',
                padding: '4px 14px', cursor: 'pointer', fontSize: '0.85rem', color: '#FFF9C4',
                fontWeight: 600
              }}
            >{saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassSetup() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ firstName: '', lastName: '', pronouns: '', grade: '' });
  const [noteStudent, setNoteStudent] = useState(null);

  useEffect(() => {
    loadClassData();
    loadStudents();
  }, [classId]);

  const loadClassData = async () => {
    try {
      const res = await axios.get(`${API}/classes/${classId}`, { headers });
      setClassData(res.data);
    } catch { setError('Failed to load class data'); }
  };

  const loadStudents = async () => {
    try {
      const res = await axios.get(`${API}/classes/${classId}/students`, { headers });
      setStudents([...res.data].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')));
    } catch { setError('Failed to load students'); }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a file'); return; }
    setLoading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(
        `${API}/classes/${classId}/students/import`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
      setSuccess(`Successfully imported ${res.data.imported} students`);
      await loadStudents();
      setFile(null);
      document.getElementById('file-input').value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import students');
    } finally { setLoading(false); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/classes/${classId}/students`, newStudent, { headers });
      setNewStudent({ firstName: '', lastName: '', pronouns: '', grade: '' });
      setShowAddStudent(false);
      await loadStudents();
      setSuccess('Student added!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add student');
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Remove this student?')) return;
    try {
      await axios.delete(`${API}/students/${studentId}`, { headers });
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch { setError('Failed to remove student'); }
  };

  const handleSaveNote = async (studentId, classNotes) => {
    await axios.put(`${API}/students/${studentId}/class-notes`, { classNotes }, { headers });
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, classNotes } : s));
    if (noteStudent?.id === studentId) setNoteStudent(prev => ({ ...prev, classNotes }));
  };

  const gradesDisplay = Array.isArray(classData?.grades) ? classData.grades.join(' / ') : classData?.grades;
  const subjectsDisplay = Array.isArray(classData?.subjects) ? classData.subjects.join(', ') : classData?.subjects;

  return (
    <div className="container">
      <button className="btn-secondary" onClick={() => navigate('/dashboard')}>← Dashboard</button>

      {classData && (
        <div style={{ margin: '1rem 0' }}>
          <h1 style={{ marginBottom: '0.25rem' }}>{classData.className} — Students</h1>
          <p className="text-muted">{gradesDisplay} · {subjectsDisplay}</p>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Import Excel */}
      <div className="card">
        <h2>Import Class List from Excel</h2>
        <p className="text-muted">
          Upload an <strong>.xlsx</strong> file with columns: <code>firstName</code>, <code>lastName</code>, <code>pronouns</code>
        </p>
        <div style={{ background: '#F0EEEA', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem', fontFamily: 'monospace' }}>
          firstName | lastName | pronouns<br />
          Emma | Smith | she/her<br />
          James | Lee | he/him<br />
          Alex | Chen | they/them
        </div>
        <div className="form-group">
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFile(e.target.files[0])}
          />
        </div>
        <button className="btn-primary" onClick={handleImport} disabled={loading || !file}>
          {loading ? 'Importing…' : 'Import Students'}
        </button>
      </div>

      {/* Manual Add */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button className="btn-secondary" onClick={() => setShowAddStudent(!showAddStudent)}>
          {showAddStudent ? 'Cancel' : '+ Add Student Manually'}
        </button>
      </div>

      {showAddStudent && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add Student</h3>
          <form onSubmit={handleAddStudent}>
            <div className="grid grid-2">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={newStudent.firstName}
                  onChange={e => setNewStudent({ ...newStudent, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={newStudent.lastName}
                  onChange={e => setNewStudent({ ...newStudent, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Pronouns</label>
              <select
                value={newStudent.pronouns}
                onChange={e => setNewStudent({ ...newStudent, pronouns: e.target.value })}
              >
                <option value="">Not specified</option>
                <option value="she/her">she/her</option>
                <option value="he/him">he/him</option>
                <option value="they/them">they/them</option>
                <option value="she/they">she/they</option>
                <option value="he/they">he/they</option>
              </select>
            </div>
            {classData?.grades?.length > 1 && (
              <div className="form-group">
                <label>Grade</label>
                <select
                  value={newStudent.grade}
                  onChange={e => setNewStudent({ ...newStudent, grade: e.target.value })}
                >
                  <option value="">Not specified</option>
                  {classData.grades.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
            <button type="submit" className="btn-success">Add Student</button>
          </form>
        </div>
      )}

      {/* Student List */}
      {students.length > 0 && (
        <div className="card">
          <h2>Class List ({students.length} students)</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Pronouns</th>
                {classData?.grades?.length > 1 && <th>Grade</th>}
                <th style={{ textAlign: 'center' }}>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => (
                <tr key={student.id}>
                  <td>{i + 1}</td>
                  <td>{student.firstName}</td>
                  <td>{student.lastName || '—'}</td>
                  <td>{student.pronouns || '—'}</td>
                  {classData?.grades?.length > 1 && <td>{student.grade || '—'}</td>}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      title={student.classNotes ? 'View/edit notes' : 'Add notes'}
                      onClick={() => setNoteStudent(student)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: student.classNotes ? '#97B3AE' : '#bbb',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#5a9e97'}
                      onMouseLeave={e => e.currentTarget.style.color = student.classNotes ? '#97B3AE' : '#bbb'}
                    >
                      <NotepadIcon />
                      {student.classNotes && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F2C3B9', marginLeft: 3, display: 'inline-block' }} />
                      )}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}
                      onClick={() => handleDeleteStudent(student.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {students.length === 0 && !loading && (
        <p className="text-muted">No students yet. Import an Excel file or add them manually above.</p>
      )}

      {students.length > 0 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => navigate(`/class/${classId}/gradebook`)}>
            Go to Gradebook →
          </button>
          <button className="btn-primary" onClick={() => navigate(`/class/${classId}/report-card`)}>
            Go to Report Cards →
          </button>
        </div>
      )}

      {noteStudent && (
        <StickyNote
          student={noteStudent}
          onClose={() => setNoteStudent(null)}
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
}

export default ClassSetup;
