import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const INVITE_CODE = process.env.INVITE_CODE || null; // if set, required to register

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper: convert ?-style placeholders to $1,$2... for PostgreSQL
function toPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbRun(sql, params = []) {
  const { rows } = await pool.query(toPostgres(sql), params);
  return rows[0] || {};
}
async function dbGet(sql, params = []) {
  const { rows } = await pool.query(toPostgres(sql), params);
  return rows[0] || null;
}
async function dbAll(sql, params = []) {
  const { rows } = await pool.query(toPostgres(sql), params);
  return rows;
}

async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id),
    grades TEXT,
    subjects TEXT,
    "classType" TEXT,
    "schoolType" TEXT,
    "className" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    "firstName" TEXT,
    "lastName" TEXT,
    pronouns TEXT,
    "classNotes" TEXT,
    grade TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS grade TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject TEXT,
    name TEXT NOT NULL,
    "maxGrade" REAL DEFAULT 100,
    weight REAL DEFAULT 1,
    category TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS grades (
    id SERIAL PRIMARY KEY,
    "studentId" INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    "assignmentId" INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    "assignmentName" TEXT,
    "assignmentWeight" REAL DEFAULT 1,
    grade REAL,
    "maxGrade" REAL DEFAULT 100,
    "dateSubmitted" TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    "studentId" INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject TEXT,
    "commentType" TEXT,
    content TEXT,
    draft BOOLEAN DEFAULT TRUE,
    term TEXT DEFAULT 'Term 1',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS "learningSkills" (
    id SERIAL PRIMARY KEY,
    "studentId" INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    responsibility TEXT,
    organization TEXT,
    "independentWork" TEXT,
    collaboration TEXT,
    initiative TEXT,
    "selfRegulation" TEXT,
    term TEXT DEFAULT 'Term 1'
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "geminiApiKey" TEXT,
    "gradeFormat" TEXT DEFAULT 'percentage',
    theme TEXT DEFAULT 'light',
    "emailUser" TEXT,
    "emailPass" TEXT
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS "passwordResets" (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    "expiresAt" BIGINT NOT NULL,
    used INTEGER DEFAULT 0
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS "classContexts" (
    id SERIAL PRIMARY KEY,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    term TEXT NOT NULL DEFAULT 'Term 1',
    context TEXT DEFAULT '',
    UNIQUE("classId", subject, term)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS "studentNotes" (
    id SERIAL PRIMARY KEY,
    "studentId" INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    "classId" INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject TEXT,
    term TEXT NOT NULL DEFAULT 'Term 1',
    strengths TEXT DEFAULT '[]',
    struggles TEXT DEFAULT '[]',
    "customContext" TEXT DEFAULT '',
    UNIQUE("studentId", "classId", subject, term)
  )`);

  console.log('Database tables ready');
}

initializeDatabase().catch(console.error);

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
}

// ===== AUTH =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body;
    if (INVITE_CODE && inviteCode !== INVITE_CODE) {
      return res.status(403).json({ error: 'Invalid invite code. Please contact the administrator.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?) RETURNING id',
      [email, hashedPassword, name]
    );
    await dbRun('INSERT INTO settings ("userId") VALUES (?) RETURNING id', [result.id]);
    const token = jwt.sign({ id: result.id, email }, JWT_SECRET);
    res.json({ token, userId: result.id, name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, userId: user.id, name: user.name });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== PASSWORD RESET =====

// Direct password reset — verify email exists, then set new password immediately
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'No account found with that email address' });

    if (!newPassword) {
      return res.json({ exists: true, name: user.name });
    }

    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const reset = await dbGet('SELECT * FROM "passwordResets" WHERE token = ? AND used = 0', [token]);
    if (!reset) return res.status(400).json({ error: 'Invalid or expired reset link' });
    if (Date.now() > Number(reset.expiresat || reset.expiresAt)) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });

    const hashed = await bcrypt.hash(password, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashed, reset.userid || reset.userId]);
    await dbRun('UPDATE "passwordResets" SET used = 1 WHERE id = ?', [reset.id]);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== CLASSES =====

app.post('/api/classes', verifyToken, async (req, res) => {
  try {
    const { grades, subjects, classType, schoolType, className } = req.body;
    const gradesJson = JSON.stringify(Array.isArray(grades) ? grades : [grades]);
    const subjectsJson = JSON.stringify(Array.isArray(subjects) ? subjects : [subjects]);
    const result = await dbRun(
      'INSERT INTO classes ("userId", grades, subjects, "classType", "schoolType", "className") VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [req.userId, gradesJson, subjectsJson, classType, schoolType, className]
    );
    const cls = { id: result.id, grades: JSON.parse(gradesJson), subjects: JSON.parse(subjectsJson), classType, schoolType, className };
    res.json(cls);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/classes', verifyToken, async (req, res) => {
  try {
    const classes = await dbAll('SELECT * FROM classes WHERE "userId" = ?', [req.userId]);
    res.json(classes.map(parseClass));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/classes/:classId', verifyToken, async (req, res) => {
  try {
    const cls = await dbGet('SELECT * FROM classes WHERE id = ? AND "userId" = ?', [req.params.classId, req.userId]);
    res.json(cls ? parseClass(cls) : null);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/classes/:classId', verifyToken, async (req, res) => {
  try {
    const { grades, subjects, classType, schoolType, className } = req.body;
    const gradesJson = JSON.stringify(Array.isArray(grades) ? grades : [grades]);
    const subjectsJson = JSON.stringify(Array.isArray(subjects) ? subjects : [subjects]);
    await dbRun(
      'UPDATE classes SET grades = ?, subjects = ?, "classType" = ?, "schoolType" = ?, "className" = ? WHERE id = ? AND "userId" = ?',
      [gradesJson, subjectsJson, classType, schoolType, className, req.params.classId, req.userId]
    );
    const cls = await dbGet('SELECT * FROM classes WHERE id = ? AND "userId" = ?', [req.params.classId, req.userId]);
    res.json(cls ? parseClass(cls) : null);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/classes/:classId', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM classes WHERE id = ? AND "userId" = ?', [req.params.classId, req.userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function parseClass(cls) {
  if (!cls) return null;
  try {
    return {
      ...cls,
      id: cls.id,
      className: cls.className || cls.classname,
      classType: cls.classType || cls.classtype,
      schoolType: cls.schoolType || cls.schooltype,
      grades: cls.grades ? JSON.parse(cls.grades) : [],
      subjects: cls.subjects ? JSON.parse(cls.subjects) : [],
    };
  } catch {
    return {
      ...cls,
      className: cls.className || cls.classname,
      classType: cls.classType || cls.classtype,
      schoolType: cls.schoolType || cls.schooltype,
      grades: cls.grades ? [cls.grades] : [],
      subjects: cls.subjects ? [cls.subjects] : [],
    };
  }
}

// ===== STUDENTS =====

app.post('/api/classes/:classId/students/import', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const classId = req.params.classId;
    const classData = await dbGet('SELECT * FROM classes WHERE id = ? AND "userId" = ?', [classId, req.userId]);
    if (!classData) return res.status(403).json({ error: 'Unauthorized' });

    const workbook = xlsx.readFile(file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const students = [];
    for (const row of data) {
      const firstName = row.firstName || row['First Name'] || row.firstname || '';
      const lastName = row.lastName || row['Last Name'] || row.lastname || '';
      const pronouns = row.pronouns || row.Pronouns || '';
      if (!firstName) continue;
      const result = await dbRun(
        'INSERT INTO students ("classId", "firstName", "lastName", pronouns) VALUES (?, ?, ?, ?) RETURNING id',
        [classId, firstName, lastName, pronouns]
      );
      students.push({ id: result.id, firstName, lastName, pronouns });
    }

    fs.unlink(file.path, () => {});
    res.json({ imported: students.length, students });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/classes/:classId/students', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, pronouns, grade } = req.body;
    const classId = req.params.classId;
    const classData = await dbGet('SELECT * FROM classes WHERE id = ? AND "userId" = ?', [classId, req.userId]);
    if (!classData) return res.status(403).json({ error: 'Unauthorized' });
    const result = await dbRun(
      'INSERT INTO students ("classId", "firstName", "lastName", pronouns, grade) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [classId, firstName, lastName || '', pronouns || '', grade || '']
    );
    res.json({ id: result.id, firstName, lastName: lastName || '', pronouns: pronouns || '', grade: grade || '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/students/:studentId/class-notes', verifyToken, async (req, res) => {
  try {
    const { classNotes } = req.body;
    await dbRun(
      `UPDATE students SET "classNotes" = ? WHERE id = ? AND "classId" IN (SELECT id FROM classes WHERE "userId" = ?)`,
      [classNotes, req.params.studentId, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/classes/:classId/students', verifyToken, async (req, res) => {
  try {
    const students = await dbAll(
      'SELECT s.* FROM students s JOIN classes c ON s."classId" = c.id WHERE c."userId" = ? AND s."classId" = ? ORDER BY s."firstName"',
      [req.userId, req.params.classId]
    );
    res.json(students);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/students/:studentId', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM students WHERE id = ?', [req.params.studentId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== ASSIGNMENTS =====

app.post('/api/classes/:classId/assignments', verifyToken, async (req, res) => {
  try {
    const { name, maxGrade, weight, category, subject } = req.body;
    const result = await dbRun(
      'INSERT INTO assignments ("classId", subject, name, "maxGrade", weight, category) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [req.params.classId, subject || null, name, maxGrade || 100, weight || 1, category || '']
    );
    res.json({ id: result.id, classId: req.params.classId, subject: subject || null, name, maxGrade: maxGrade || 100, weight: weight || 1, category: category || '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/classes/:classId/assignments', verifyToken, async (req, res) => {
  try {
    const { subject } = req.query;
    const assignments = subject
      ? await dbAll('SELECT * FROM assignments WHERE "classId" = ? AND subject = ? ORDER BY "createdAt"', [req.params.classId, subject])
      : await dbAll('SELECT * FROM assignments WHERE "classId" = ? ORDER BY "createdAt"', [req.params.classId]);
    res.json(assignments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/assignments/:assignmentId', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM grades WHERE assignmentId = ?', [req.params.assignmentId]);
    await dbRun('DELETE FROM assignments WHERE id = ?', [req.params.assignmentId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== GRADES =====

// Gradebook: all grades in spreadsheet format, optionally filtered by subject
app.get('/api/classes/:classId/gradebook', verifyToken, async (req, res) => {
  try {
    const classId = req.params.classId;
    const { subject } = req.query;
    const students = await dbAll(
      'SELECT s.* FROM students s JOIN classes c ON s."classId" = c.id WHERE c."userId" = ? AND s."classId" = ? ORDER BY s."firstName"',
      [req.userId, classId]
    );
    const assignments = subject
      ? await dbAll('SELECT * FROM assignments WHERE "classId" = ? AND subject = ? ORDER BY "createdAt"', [classId, subject])
      : await dbAll('SELECT * FROM assignments WHERE "classId" = ? ORDER BY "createdAt"', [classId]);
    const allGrades = await dbAll('SELECT * FROM grades WHERE "classId" = ?', [classId]);

    // Build grade matrix: { studentId: { assignmentId: { id, grade } } }
    const gradeMatrix = {};
    for (const student of students) {
      gradeMatrix[student.id] = {};
    }
    for (const g of allGrades) {
      if (g.assignmentId && gradeMatrix[g.studentId]) {
        gradeMatrix[g.studentId][g.assignmentId] = { id: g.id, grade: g.grade };
      }
      // pg returns lowercase keys
      if (g.assignmentid && gradeMatrix[g.studentid]) {
        gradeMatrix[g.studentid][g.assignmentid] = { id: g.id, grade: g.grade };
      }
    }

    res.json({ students, assignments, gradeMatrix });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upsert a single grade cell
app.put('/api/classes/:classId/grades/upsert', verifyToken, async (req, res) => {
  try {
    const { studentId, assignmentId, grade } = req.body;
    const classId = req.params.classId;

    // Get assignment for maxGrade
    const assignment = await dbGet('SELECT * FROM assignments WHERE id = ?', [assignmentId]);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    // normalise pg lowercase keys
    assignment.maxGrade = assignment.maxGrade ?? assignment.maxgrade ?? 100;
    assignment.weight = assignment.weight ?? 1;

    const existing = await dbGet(
      'SELECT id FROM grades WHERE "studentId" = ? AND "assignmentId" = ?',
      [studentId, assignmentId]
    );

    if (existing) {
      await dbRun('UPDATE grades SET grade = ? WHERE id = ?', [grade, existing.id]);
      res.json({ id: existing.id, grade });
    } else {
      const result = await dbRun(
        'INSERT INTO grades ("studentId", "assignmentId", "classId", "assignmentName", grade, "maxGrade", "assignmentWeight") VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [studentId, assignmentId, classId, assignment.name, grade, assignment.maxGrade, assignment.weight]
      );
      res.json({ id: result.id, grade });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/grades/:gradeId', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM grades WHERE id = ?', [req.params.gradeId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get student overall grade, optionally filtered by subject
app.get('/api/classes/:classId/students/:studentId/overall-grade', verifyToken, async (req, res) => {
  try {
    const { subject } = req.query;
    const grades = subject
      ? await dbAll(
          'SELECT g.*, a."maxGrade" as "aMaxGrade", a.weight as "aWeight" FROM grades g JOIN assignments a ON g."assignmentId" = a.id WHERE g."studentId" = ? AND g."classId" = ? AND a.subject = ?',
          [req.params.studentId, req.params.classId, subject]
        )
      : await dbAll(
          'SELECT g.*, a."maxGrade" as "aMaxGrade", a.weight as "aWeight" FROM grades g LEFT JOIN assignments a ON g."assignmentId" = a.id WHERE g."studentId" = ? AND g."classId" = ?',
          [req.params.studentId, req.params.classId]
        );

    let totalPoints = 0, totalWeight = 0;
    for (const g of grades) {
      const max = g.aMaxGrade || g.maxGrade || 100;
      const weight = g.aWeight || g.assignmentWeight || 1;
      if (g.grade != null && max > 0) {
        totalPoints += (g.grade / max) * 100 * weight;
        totalWeight += weight;
      }
    }
    const overallGrade = totalWeight > 0 ? totalPoints / totalWeight : null;
    res.json({ overallGrade: overallGrade !== null ? Math.round(overallGrade * 10) / 10 : null });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== COMMENTS =====

app.post('/api/classes/:classId/generate-comment', verifyToken, async (req, res) => {
  try {
    const { studentId, overallGrade, classContext, strengths, struggles, commentType, quickObservations, customContext, subject, targetWordCount, term, previousTermComments } = req.body;
    const classId = req.params.classId;

    const settings = await dbGet('SELECT "geminiApiKey" FROM settings WHERE "userId" = ?', [req.userId]);
    const apiKey = settings?.geminiApiKey || settings?.geminiApikey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API key not configured in Settings' });
    }

    const student = await dbGet('SELECT * FROM students WHERE id = ?', [studentId]);
    const classInfo = parseClass(await dbGet('SELECT * FROM classes WHERE id = ?', [classId]));

    const pronounObj = parsePronoun(student.pronouns);
    const prevContext = previousTermComments && previousTermComments.length > 0
      ? `\nPrevious term comments for context and consistency:\n${previousTermComments.map(c => `- ${c.subject || 'Learning Skills'}: "${c.content}"`).join('\n')}`
      : '';
    const wordTarget = targetWordCount || 100;
    const gradeDisplay = classInfo.schoolType === 'elementary'
      ? `${overallGrade}% (${getOntarioLevel(overallGrade)})`
      : `${overallGrade}%`;

    const observationText = quickObservations && quickObservations.length > 0
      ? `Teacher-selected observations:\n${quickObservations.join('\n')}`
      : '';

    const customText = customContext
      ? `IMPORTANT — TEACHER NOTES ABOUT THIS SPECIFIC STUDENT (must be reflected in the comment, do NOT contradict these):\n${customContext}`
      : '';

    const gradesDisplay = classInfo.grades ? classInfo.grades.join('/') : '';
    const subjectsDisplay = subject || (classInfo.subjects ? classInfo.subjects.join(', ') : '');

    let prompt;
    if (commentType === 'learning-skills') {
      prompt = `You are an Ontario teacher writing a Learning Skills and Work Habits comment for a student's report card.
Target length: approximately ${wordTarget} words.
Reporting period: ${term || 'Term 1'}

Student first name: ${student.firstName}
PRONOUNS — NON-NEGOTIABLE: ${student.firstName}'s pronouns are "${student.pronouns || 'they/them'}".
Subject pronoun: "${pronounObj.subject}" — use this wherever you would write he/she/they
Object pronoun: "${pronounObj.object}" — use this wherever you would write him/her/them
Possessive pronoun: "${pronounObj.possessive}" — use this wherever you would write his/her/their
NEVER substitute a different pronoun. If unsure, re-read: use ONLY "${pronounObj.subject}/${pronounObj.object}/${pronounObj.possessive}".
${customText ? `
TEACHER NOTES — READ CAREFULLY BEFORE WRITING:
${customContext}
These notes describe this student's ACTUAL behaviour. Every point must shape what you write. Do NOT write anything that contradicts these notes. Do NOT tack them on as an awkward final sentence — weave them naturally into the comment so it reads as one coherent paragraph.
` : ''}
${classContext ? `Class context: ${classContext}` : ''}
${observationText}
${prevContext}

Ontario Learning Skills: Responsibility, Organization, Independent Work, Collaboration, Initiative, Self-Regulation
Rating scale: E=Excellent, G=Good, S=Satisfactory, N=Needs Improvement

Writing rules:
- Write approximately ${wordTarget} words as one flowing paragraph — no bullet points, no headers
- Reflect the teacher notes above throughout the comment, not just at the end
- Comment on learning skills and work habits specifically (not subject content)
- Be specific and use observable, concrete language
- Growth-oriented tone — frame weaknesses as areas to continue developing
- Do not use generic filler like "is a pleasure to have in class"
- If previous term comments are provided, show growth or continued progress
- Every sentence must be clear and make sense on its own

Write only the comment text.`;
    } else {
      prompt = `You are an Ontario teacher writing a ${subjectsDisplay} report card comment.
Target length: approximately ${wordTarget} words.
Reporting period: ${term || 'Term 1'}

Student first name: ${student.firstName}
PRONOUNS — NON-NEGOTIABLE: ${student.firstName}'s pronouns are "${student.pronouns || 'they/them'}".
Subject pronoun: "${pronounObj.subject}" — use this wherever you would write he/she/they
Object pronoun: "${pronounObj.object}" — use this wherever you would write him/her/them
Possessive pronoun: "${pronounObj.possessive}" — use this wherever you would write his/her/their
NEVER substitute a different pronoun. If unsure, re-read: use ONLY "${pronounObj.subject}/${pronounObj.object}/${pronounObj.possessive}".

Grade Level: ${gradesDisplay}
Subject: ${subjectsDisplay}
Achievement: ${gradeDisplay}
School: ${classInfo.schoolType === 'elementary' ? 'Elementary (K-8)' : 'Secondary (9-12)'}
${customText ? `
TEACHER NOTES — READ CAREFULLY BEFORE WRITING:
${customContext}
These notes describe this student's ACTUAL behaviour and performance. Every point must shape what you write. Do NOT write anything that contradicts these notes. Do NOT tack them on as an awkward final sentence — weave them naturally into the comment so it reads as one coherent paragraph.
` : ''}
What the class has been working on this term:
${classContext || 'Various curriculum expectations for this subject'}

Student strengths: ${strengths || 'Not specified'}
Areas for growth: ${struggles || 'Not specified'}
${observationText}
${prevContext}

Writing rules:
- Write approximately ${wordTarget} words as one flowing paragraph — no bullet points, no headers
- Reflect the teacher notes above throughout the comment, not just at the end
- Every sentence must be clear, specific, and make sense on its own — no vague or confusing phrasing
- Elementary: use "is demonstrating", "is developing" language; reference Ontario achievement levels (Level 1–4)
- Secondary: reference percentage achievement and specific course content
- Balance strengths with one or two concrete next steps
- Growth-oriented and encouraging tone
- Do not write anything that contradicts the teacher notes

Write only the comment text.`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const commentText = result.response.text();

    const commentResult = await dbRun(
      'INSERT INTO comments ("studentId", "classId", subject, "commentType", content, draft, term) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [studentId, classId, subject || null, commentType, commentText, true, term || 'Term 1']
    );

    res.json({ id: commentResult.id, content: commentText, draft: true, commentType, subject: subject || null, term: term || 'Term 1' });
  } catch (error) {
    console.error('Error generating comment:', error);
    res.status(400).json({ error: error.message });
  }
});

function parsePronoun(pronounString) {
  if (!pronounString) return { subject: 'they', object: 'them', possessive: 'their' };
  const lower = pronounString.toLowerCase().trim();
  // Check she/her before he/him — "she" contains "he" so order matters
  if (lower.startsWith('she') || lower.includes('she/her')) return { subject: 'she', object: 'her', possessive: 'her' };
  if (lower.startsWith('he') || lower.includes('he/him')) return { subject: 'he', object: 'him', possessive: 'his' };
  return { subject: 'they', object: 'them', possessive: 'their' };
}

function getOntarioLevel(percentage) {
  if (percentage >= 80) return 'Level 4';
  if (percentage >= 70) return 'Level 3';
  if (percentage >= 60) return 'Level 2';
  if (percentage >= 50) return 'Level 1';
  return 'Below Level 1 (R)';
}

app.get('/api/classes/:classId/students/:studentId/comments', verifyToken, async (req, res) => {
  try {
    const { subject, term } = req.query;
    let sql = 'SELECT * FROM comments WHERE "studentId" = ? AND "classId" = ?';
    const params = [req.params.studentId, req.params.classId];
    if (subject) { sql += ' AND subject = ?'; params.push(subject); }
    if (term) { sql += ' AND term = ?'; params.push(term); }
    sql += ' ORDER BY "createdAt" DESC';
    const comments = await dbAll(sql, params);
    res.json(comments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== CLASS CONTEXT (saved per subject per term) =====

app.get('/api/classes/:classId/context', verifyToken, async (req, res) => {
  try {
    const { subject, term } = req.query;
    const ctx = await dbGet(
      'SELECT * FROM "classContexts" WHERE "classId" = ? AND subject = ? AND term = ?',
      [req.params.classId, subject || '', term || 'Term 1']
    );
    res.json(ctx || { context: '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/classes/:classId/context', verifyToken, async (req, res) => {
  try {
    const { subject, term, context } = req.body;
    await dbRun(
      `INSERT INTO "classContexts" ("classId", subject, term, context) VALUES (?, ?, ?, ?)
       ON CONFLICT("classId", subject, term) DO UPDATE SET context = EXCLUDED.context`,
      [req.params.classId, subject || '', term || 'Term 1', context]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== STUDENT NOTES (observations saved per student per subject per term) =====

app.get('/api/classes/:classId/students/:studentId/notes', verifyToken, async (req, res) => {
  try {
    const { subject, term } = req.query;
    const notes = await dbGet(
      'SELECT * FROM "studentNotes" WHERE "studentId" = ? AND "classId" = ? AND subject IS NOT DISTINCT FROM ? AND term = ?',
      [req.params.studentId, req.params.classId, subject || null, term || 'Term 1']
    );
    res.json(notes ? {
      ...notes,
      strengths: JSON.parse(notes.strengths || '[]'),
      struggles: JSON.parse(notes.struggles || '[]'),
    } : { strengths: [], struggles: [], customContext: '' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/classes/:classId/students/:studentId/notes', verifyToken, async (req, res) => {
  try {
    const { subject, term, strengths, struggles, customContext } = req.body;
    await dbRun(
      `INSERT INTO "studentNotes" ("studentId", "classId", subject, term, strengths, struggles, "customContext")
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT("studentId", "classId", subject, term) DO UPDATE SET
         strengths = EXCLUDED.strengths,
         struggles = EXCLUDED.struggles,
         "customContext" = EXCLUDED."customContext"`,
      [req.params.studentId, req.params.classId, subject || null, term || 'Term 1',
       JSON.stringify(strengths || []), JSON.stringify(struggles || []), customContext || '']
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/comments/:commentId', verifyToken, async (req, res) => {
  try {
    const { content, draft } = req.body;
    await dbRun(
      'UPDATE comments SET content = ?, draft = ?, "updatedAt" = NOW() WHERE id = ?',
      [content, draft ?? 1, req.params.commentId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bulk fill comments for multiple students — swaps name & pronouns with plain string replacement (no AI)
app.post('/api/classes/:classId/bulk-comment', verifyToken, async (req, res) => {
  try {
    const { subject, term, commentText, studentIds, templateName, templatePronouns } = req.body;
    if (!commentText || !studentIds?.length) return res.status(400).json({ error: 'Missing required fields' });

    const tmplName = (templateName || '').trim();

    // Full pronoun sets for each pronoun group (longest/most-specific forms first to avoid partial matches)
    const PRONOUN_SETS = {
      'she': { reflex:'herself',   possPron:'hers',   possAdj:'her',   object:'her',  subject:'she'  },
      'he':  { reflex:'himself',   possPron:'his',    possAdj:'his',   object:'him',  subject:'he'   },
      'they':{ reflex:'themselves',possPron:'theirs', possAdj:'their', object:'them', subject:'they' },
    };

    function pronounKey(str) {
      const s = (str || '').toLowerCase().trim();
      if (s.startsWith('she')) return 'she';
      if (s.startsWith('he'))  return 'he';
      return 'they';
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function personalise(text, student) {
      const fromKey = pronounKey(templatePronouns);
      const toKey   = pronounKey(student.pronouns);
      let out = text;

      // Replace name — preserve capitalisation
      if (tmplName) {
        out = out.replace(new RegExp(`\\b${escRe(tmplName)}\\b`, 'gi'), m =>
          m[0] === m[0].toUpperCase() ? cap(student.firstName) : student.firstName
        );
      }

      if (fromKey === toKey) return out; // pronouns already match, nothing to do

      const from = PRONOUN_SETS[fromKey];
      const to   = PRONOUN_SETS[toKey];

      // Build unique source→target pairs (seen set prevents "her"/"his" duplicates in she/he sets)
      const seen = new Set();
      const pairs = [];
      for (const key of ['reflex', 'possPron', 'possAdj', 'object', 'subject']) {
        if (!seen.has(from[key])) {
          seen.add(from[key]);
          pairs.push([from[key], to[key]]);
        }
      }

      // Single-pass: replace each unique source word, preserving sentence-start capitalisation
      for (const [f, t] of pairs) {
        out = out.replace(new RegExp(`\\b${escRe(f)}\\b`, 'gi'), m =>
          m[0] === m[0].toUpperCase() ? cap(t) : t
        );
      }

      return out;
    }

    const created = [];
    for (const studentId of studentIds) {
      const student = await dbGet('SELECT * FROM students WHERE id = ?', [studentId]);
      if (!student) continue;

      const personalised = personalise(commentText, student);

      const row = await dbRun(
        'INSERT INTO comments ("classId", "studentId", content, draft, "commentType", subject, term) VALUES (?, ?, ?, true, ?, ?, ?) RETURNING id',
        [req.params.classId, studentId, personalised, 'subject', subject, term]
      );
      created.push({ id: row.id, studentId, content: personalised, draft: 1, commentType: 'subject', subject, term });
    }
    res.json({ created });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Bulk delete comments (for undo)
app.post('/api/comments/bulk-delete', verifyToken, async (req, res) => {
  try {
    const { commentIds } = req.body;
    if (!commentIds?.length) return res.json({ success: true });
    const placeholders = commentIds.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM comments WHERE id IN (${placeholders})`, commentIds);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Refine a comment based on teacher feedback (chat)
app.post('/api/comments/:commentId/refine', verifyToken, async (req, res) => {
  try {
    const { feedback, currentContent } = req.body;
    const settings = await dbGet('SELECT "geminiApiKey" FROM settings WHERE "userId" = ?', [req.userId]);
    if (!settings?.geminiApiKey) return res.status(400).json({ error: 'Gemini API key not configured in Settings' });

    const comment = await dbGet('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const student = await dbGet('SELECT * FROM students WHERE id = ?', [comment.studentId || comment.studentid]);
    const pronounObj = parsePronoun(student?.pronouns);

    const prompt = `You are revising an Ontario report card comment based on a teacher's feedback.

PRONOUNS — NON-NEGOTIABLE: ${student?.firstName}'s pronouns are "${student?.pronouns || 'they/them'}".
Subject pronoun: "${pronounObj.subject}" — use this wherever you would write he/she/they
Object pronoun: "${pronounObj.object}" — use this wherever you would write him/her/them
Possessive pronoun: "${pronounObj.possessive}" — use this wherever you would write his/her/their
NEVER substitute a different pronoun. Use ONLY "${pronounObj.subject}/${pronounObj.object}/${pronounObj.possessive}".

Current comment:
"${currentContent || comment.content}"

Teacher's feedback / requested changes:
"${feedback}"

Instructions:
- Apply the teacher's requested changes
- Keep the same approximate length unless the teacher asks to change it
- Maintain Ontario report card tone and language
- Output only the revised comment text, nothing else`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const refined = result.response.text();

    // Update comment in DB
    await dbRun('UPDATE comments SET content = ?, "updatedAt" = NOW() WHERE id = ?', [refined, req.params.commentId]);

    res.json({ content: refined });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Export all final comments to Excel
app.get('/api/classes/:classId/export', verifyToken, async (req, res) => {
  try {
    const { term } = req.query;
    const classInfo = parseClass(await dbGet('SELECT * FROM classes WHERE id = ? AND "userId" = ?', [req.params.classId, req.userId]));
    if (!classInfo) return res.status(403).json({ error: 'Unauthorized' });

    const students = await dbAll(
      'SELECT s.* FROM students s WHERE s."classId" = ? ORDER BY s."firstName"',
      [req.params.classId]
    );

    let commentsSql = 'SELECT * FROM comments WHERE "classId" = ? AND draft = false';
    const commentParams = [req.params.classId];
    if (term) { commentsSql += ' AND term = ?'; commentParams.push(term); }
    const allComments = await dbAll(commentsSql, commentParams);

    let skillsSql = 'SELECT * FROM "learningSkills" WHERE "classId" = ?';
    const skillsParams = [req.params.classId];
    if (term) { skillsSql += ' AND term = ?'; skillsParams.push(term); }
    const allSkills = await dbAll(skillsSql, skillsParams);

    const subjects = Array.isArray(classInfo.subjects) ? classInfo.subjects : [];
    const columns = [...subjects, 'Learning Skills Comment', 'Responsibility', 'Organization', 'Independent Work', 'Collaboration', 'Initiative', 'Self-Regulation'];

    const rows = students.map(student => {
      const row = { 'First Name': student.firstName, 'Last Name': student.lastName || '', Pronouns: student.pronouns || '' };
      const studentComments = allComments.filter(c => (c.studentId || c.studentid) === student.id);
      const studentSkills = allSkills.find(s => (s.studentId || s.studentid) === student.id) || {};

      subjects.forEach(sub => {
        const c = studentComments.find(c => c.commentType === 'subject' && c.subject === sub);
        row[sub] = c ? c.content : '';
      });
      const lsComment = studentComments.find(c => c.commentType === 'learning-skills');
      row['Learning Skills Comment'] = lsComment ? lsComment.content : '';
      row['Responsibility'] = studentSkills.responsibility || '';
      row['Organization'] = studentSkills.organization || '';
      row['Independent Work'] = studentSkills.independentWork || '';
      row['Collaboration'] = studentSkills.collaboration || '';
      row['Initiative'] = studentSkills.initiative || '';
      row['Self-Regulation'] = studentSkills.selfRegulation || '';

      return row;
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows);
    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 30) }));
    ws['!cols'] = colWidths;
    xlsx.utils.book_append_sheet(wb, ws, term || 'All Terms');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="report-cards-${term || 'export'}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/comments/:commentId', verifyToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM comments WHERE id = ?', [req.params.commentId]);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== LEARNING SKILLS =====

app.post('/api/classes/:classId/students/:studentId/learning-skills', verifyToken, async (req, res) => {
  try {
    const { responsibility, organization, independentWork, collaboration, initiative, selfRegulation, term } = req.body;
    const t = term || 'Term 1';
    const existing = await dbGet(
      'SELECT id FROM "learningSkills" WHERE "studentId" = ? AND "classId" = ? AND (term = ? OR term IS NULL)',
      [req.params.studentId, req.params.classId, t]
    );
    if (existing) {
      await dbRun(
        'UPDATE "learningSkills" SET responsibility=?, organization=?, "independentWork"=?, collaboration=?, initiative=?, "selfRegulation"=?, term=? WHERE id=?',
        [responsibility, organization, independentWork, collaboration, initiative, selfRegulation, t, existing.id]
      );
    } else {
      await dbRun(
        'INSERT INTO "learningSkills" ("studentId", "classId", responsibility, organization, "independentWork", collaboration, initiative, "selfRegulation", term) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.params.studentId, req.params.classId, responsibility, organization, independentWork, collaboration, initiative, selfRegulation, t]
      );
    }
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/classes/:classId/students/:studentId/learning-skills', verifyToken, async (req, res) => {
  try {
    const { term } = req.query;
    const skills = await dbGet(
      'SELECT * FROM "learningSkills" WHERE "studentId" = ? AND "classId" = ? AND (term = ? OR term IS NULL) ORDER BY id DESC LIMIT 1',
      [req.params.studentId, req.params.classId, term || 'Term 1']
    );
    res.json(skills || {});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SETTINGS =====

app.put('/api/settings', verifyToken, async (req, res) => {
  try {
    const { geminiApiKey, gradeFormat, theme, emailUser, emailPass } = req.body;
    await dbRun(
      'UPDATE settings SET "geminiApiKey" = ?, "gradeFormat" = ?, theme = ?, "emailUser" = ?, "emailPass" = ? WHERE "userId" = ?',
      [geminiApiKey, gradeFormat, theme, emailUser || null, emailPass || null, req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/settings', verifyToken, async (req, res) => {
  try {
    const settings = await dbGet('SELECT * FROM settings WHERE "userId" = ?', [req.userId]);
    res.json(settings || {});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== ONTARIO CURRICULUM DATA =====

const CURRICULUM = {
  elementary: {
    grades: ['Kindergarten (JK/SK)', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'],
    subjects: [
      'Language',
      'Reading',
      'Writing',
      'Oral Communication and Media Literacy',
      'Mathematics',
      'Science and Technology',
      'Social Studies',
      'History',
      'Geography',
      'Health',
      'Physical Education',
      'Visual Arts',
      'Music',
      'Drama',
      'Dance',
      'The Arts',
      'Core French (FSL)',
      'Extended French',
      'French Immersion',
      'Indigenous Languages and Cultures',
      'Computer Studies',
    ],
  },
  secondary: {
    grades: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
    subjects: [
      'English',
      'English as a Second Language (ESL)',
      'French',
      'Extended French',
      'French Immersion',
      'Spanish',
      'Mathematics (Grade 9)',
      'Mathematics (Grade 10)',
      'Functions (MCR3U / MCF3M)',
      'Advanced Functions (MHF4U)',
      'Calculus & Vectors (MCV4U)',
      'Mathematics of Data Management (MDM4U)',
      'Foundations for College Mathematics',
      'Biology',
      'Chemistry',
      'Physics',
      'Earth and Space Science',
      'Science (Grade 9)',
      'Science (Grade 10)',
      'Environmental Science',
      'Canadian History Since World War I',
      'World History to the End of the 15th Century',
      'World History Since the 15th Century',
      'Canadian and World Issues: Geography',
      'Human Geography',
      'Civics and Careers',
      'Law',
      'Economics',
      'Politics',
      'Philosophy',
      'Business Studies',
      'Accounting',
      'Marketing',
      'Entrepreneurship and Business',
      'Leadership and Peer Support',
      'Computer Science',
      'Computer Engineering Technology',
      'Technological Education',
      'Construction Technology',
      'Communications Technology',
      'Visual Arts',
      'Music',
      'Drama',
      'Dance',
      'Media Arts',
      'Health',
      'Physical Education',
      'Cooperative Education',
      'Guidance and Career Education',
      'Indigenous Studies',
    ],
  },
};

app.get('/api/curriculum/subjects', (req, res) => {
  const { schoolType } = req.query;
  res.json(CURRICULUM[schoolType]?.subjects || CURRICULUM.elementary.subjects);
});

app.get('/api/curriculum/grades', (req, res) => {
  const { schoolType } = req.query;
  res.json(CURRICULUM[schoolType]?.grades || CURRICULUM.elementary.grades);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
