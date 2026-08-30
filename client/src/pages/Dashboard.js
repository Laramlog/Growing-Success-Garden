import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const EMPTY_FORM = {
  schoolType: 'elementary',
  grades: [],
  subjects: [],
  classType: 'single',
  className: '',
};

function ClassForm({ initialData, allGrades, allSubjects, onSubmit, onCancel, loading, title }) {
  const [formData, setFormData] = useState(initialData || EMPTY_FORM);
  const [customSubject, setCustomSubject] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const isSplit = formData.classType === 'split';

  const handleSchoolTypeChange = (e) => {
    setFormData({ ...formData, schoolType: e.target.value, grades: [], subjects: [] });
  };

  const toggleGrade = (grade) => {
    if (isSplit) {
      setFormData(prev => ({
        ...prev,
        grades: prev.grades.includes(grade)
          ? prev.grades.filter(g => g !== grade)
          : prev.grades.length < 3 ? [...prev.grades, grade] : prev.grades,
      }));
    } else {
      setFormData(prev => ({ ...prev, grades: [grade] }));
    }
  };

  const toggleSubject = (subject) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    if (!formData.subjects.includes(trimmed)) {
      setFormData(prev => ({ ...prev, subjects: [...prev.subjects, trimmed] }));
    }
    setCustomSubject('');
    setShowCustom(false);
  };

  // subjects from the standard list that aren't already selected
  const knownSubjects = allSubjects || [];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <div className="grid grid-2">
        <div className="form-group">
          <label>School Type</label>
          <select value={formData.schoolType} onChange={handleSchoolTypeChange} required>
            <option value="elementary">Elementary (K–8)</option>
            <option value="secondary">Secondary (9–12)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Class Type</label>
          <select value={formData.classType} onChange={e => setFormData({ ...formData, classType: e.target.value, grades: [] })}>
            <option value="single">Single Grade</option>
            <option value="split">Split Class (2–3 grades)</option>
            <option value="planning-time">Planning Time / Specialist (multiple classes)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Class Name</label>
          <input
            type="text"
            placeholder={isSplit ? 'e.g., Grade 4/5 Split' : 'e.g., Grade 4A, 9-Math'}
            value={formData.className}
            onChange={(e) => setFormData({ ...formData, className: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Grade selection */}
      <div className="form-group">
        <label>
          {isSplit ? 'Grades (select 2–3)' : 'Grade'}
          {formData.grades.length > 0 && <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>{formData.grades.join(' / ')}</span>}
        </label>
        {isSplit ? (
          <div className="checkbox-grid">
            {allGrades.map(grade => (
              <label key={grade} className={`checkbox-chip ${formData.grades.includes(grade) ? 'selected' : ''}`}>
                <input type="checkbox" checked={formData.grades.includes(grade)} onChange={() => toggleGrade(grade)} />
                {grade}
              </label>
            ))}
          </div>
        ) : (
          <select
            value={formData.grades[0] || ''}
            onChange={(e) => setFormData({ ...formData, grades: [e.target.value] })}
            required
          >
            <option value="">Select grade...</option>
            {allGrades.map(grade => <option key={grade} value={grade}>{grade}</option>)}
          </select>
        )}
      </div>

      {/* Subject selection */}
      <div className="form-group">
        <label>
          Subjects (select all you teach in this class)
          {formData.subjects.length > 0 && <span className="badge badge-primary" style={{ marginLeft: '0.5rem' }}>{formData.subjects.length} selected</span>}
        </label>
        <div className="checkbox-grid">
          {knownSubjects.map(subject => (
            <label key={subject} className={`checkbox-chip ${formData.subjects.includes(subject) ? 'selected' : ''}`}>
              <input type="checkbox" checked={formData.subjects.includes(subject)} onChange={() => toggleSubject(subject)} />
              {subject}
            </label>
          ))}
          {/* Custom subjects added by teacher */}
          {formData.subjects.filter(s => !knownSubjects.includes(s)).map(subject => (
            <label key={subject} className="checkbox-chip selected" style={{ borderColor: '#D2E0D3', background: '#D2E0D3' }}>
              <input type="checkbox" checked onChange={() => toggleSubject(subject)} />
              {subject} ✕
            </label>
          ))}
        </div>

        {/* Add custom subject */}
        {showCustom ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              placeholder="e.g., Drama, Robotics, Indigenous Studies…"
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSubject())}
              autoFocus
            />
            <button type="button" className="btn-success" style={{ padding: '0.45rem 1rem' }} onClick={addCustomSubject}>Add</button>
            <button type="button" className="btn-secondary" style={{ padding: '0.45rem 0.8rem' }} onClick={() => { setShowCustom(false); setCustomSubject(''); }}>Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            style={{ marginTop: '0.75rem', background: 'none', border: '1px dashed #97B3AE', borderRadius: '20px', padding: '0.35rem 1rem', cursor: 'pointer', color: '#97B3AE', fontSize: '0.88rem' }}
          >
            + Add custom subject
          </button>
        )}

        {formData.subjects.length > 0 && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Selected: {formData.subjects.join(', ')}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button type="submit" className="btn-success" disabled={loading}>
          {loading ? 'Saving…' : title}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Dashboard() {
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [allGrades, setAllGrades] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadClasses(); loadCurriculum('elementary'); }, []);

  const loadClasses = async () => {
    try {
      const res = await axios.get(`${API}/classes`, { headers });
      setClasses(res.data);
    } catch { setError('Failed to load classes'); }
  };

  const loadCurriculum = async (type) => {
    try {
      const [gradesRes, subjectsRes] = await Promise.all([
        axios.get(`${API}/curriculum/grades`, { params: { schoolType: type } }),
        axios.get(`${API}/curriculum/subjects`, { params: { schoolType: type } }),
      ]);
      setAllGrades(gradesRes.data);
      setAllSubjects(subjectsRes.data);
    } catch { setError('Failed to load curriculum data'); }
  };

  const handleCreateClass = async (formData) => {
    if (formData.grades.length === 0) { setError('Please select at least one grade'); return; }
    if (formData.subjects.length === 0) { setError('Please select at least one subject'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/classes`, formData, { headers });
      setClasses([...classes, res.data]);
      setShowForm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create class');
    } finally { setLoading(false); }
  };

  const handleEditClass = async (formData) => {
    if (formData.grades.length === 0) { setError('Please select at least one grade'); return; }
    if (formData.subjects.length === 0) { setError('Please select at least one subject'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.put(`${API}/classes/${editingClass.id}`, formData, { headers });
      setClasses(classes.map(c => c.id === editingClass.id ? res.data : c));
      setEditingClass(null);
      // reload curriculum for potentially changed school type
      loadCurriculum(formData.schoolType);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update class');
    } finally { setLoading(false); }
  };

  const handleDeleteClass = async (classId) => {
    if (!window.confirm('Delete this class and all its data?')) return;
    try {
      await axios.delete(`${API}/classes/${classId}`, { headers });
      setClasses(classes.filter(c => c.id !== classId));
    } catch { setError('Failed to delete class'); }
  };

  const classTypeLabel = { single: 'Single Grade', split: 'Split Class (2-3 grades)', 'planning-time': 'Planning Time / Specialist' };

  return (
    <div className="container">
      <h1 style={{ marginBottom: '0.3rem' }}>Your Classes</h1>
      <p className="text-muted" style={{ marginTop: 0, marginBottom: '1.5rem' }}>Helping every student grow — manage your Ontario report cards</p>

      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn-primary" style={{ marginBottom: '1.5rem' }} onClick={() => { setShowForm(!showForm); setEditingClass(null); }}>
        {showForm ? 'Cancel' : '+ Create New Class'}
      </button>

      {showForm && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Create New Class</h2>
          <ClassForm
            allGrades={allGrades}
            allSubjects={allSubjects}
            onSubmit={handleCreateClass}
            onCancel={() => setShowForm(false)}
            loading={loading}
            title="Create Class"
          />
        </div>
      )}

      {editingClass && (
        <div className="card" style={{ marginTop: '1.5rem', borderTop: '4px solid #97B3AE' }}>
          <h2>Edit — {editingClass.className}</h2>
          <ClassForm
            initialData={editingClass}
            allGrades={allGrades}
            allSubjects={allSubjects}
            onSubmit={handleEditClass}
            onCancel={() => setEditingClass(null)}
            loading={loading}
            title="Save Changes"
          />
        </div>
      )}

      <h2 style={{ marginTop: '2rem' }}>Your Classes ({classes.length})</h2>
      {classes.length === 0 ? (
        <p className="text-muted">No classes yet. Create one to get started!</p>
      ) : (
        <div className="dashboard-grid">
          {classes.map(cls => (
            <div key={cls.id} className="class-card">
              <h3>{cls.className}</h3>
              <div className="meta">
                <div><strong>Grades:</strong> {Array.isArray(cls.grades) ? cls.grades.join(' / ') : cls.grades}</div>
                <div><strong>Subjects:</strong> {Array.isArray(cls.subjects) ? cls.subjects.join(', ') : cls.subjects}</div>
                <div>
                  <span className={`badge badge-${cls.classType === 'split' ? 'primary' : 'secondary'}`} style={{ fontSize: '0.75rem' }}>
                    {classTypeLabel[cls.classType] || cls.classType}
                  </span>
                  &nbsp;
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    {cls.schoolType === 'elementary' ? 'Elementary' : 'Secondary'}
                  </span>
                </div>
              </div>
              <div className="actions">
                <button className="btn-secondary" onClick={() => navigate(`/class/${cls.id}/setup`)}>Students</button>
                <button className="btn-secondary" onClick={() => navigate(`/class/${cls.id}/gradebook`)}>Grades</button>
                <button className="btn-primary" onClick={() => navigate(`/class/${cls.id}/report-card`)}>Report Cards</button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    setEditingClass(cls);
                    setShowForm(false);
                    loadCurriculum(cls.schoolType);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn-danger"
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  onClick={() => handleDeleteClass(cls.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
