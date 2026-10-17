export interface StudentProfile {
  studentNo: string;
  firstName: string;
  lastName: string;
  department: string;
  faculty?: string;
  email?: string;
  photoUrl?: string;
  gpa: number; // AGNO
  termGpa?: number; // ANO
  activeTermId?: number;
}

export interface TimetableEntry {
  courseCode: string;
  courseName: string;
  dayName: string;
  dayId: number; // 1 = Monday, etc.
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  classroom: string;
  instructor?: string;
}

export interface AttendanceEntry {
  courseCode: string;
  courseName: string;
  theoryAbsence: number;
  practiceAbsence: number;
  maxAllowedAbsence: number;
  status: string; // 'Devam Ediyor' / 'Kaldı'
  isDanger: boolean;
}

export interface GradeEntry {
  courseCode: string;
  courseName: string;
  credits: number;
  akts: number;
  midterm?: number | string | null;
  finalExam?: number | string | null;
  makeupExam?: number | string | null;
  letterGrade?: string;
  gradeAverage?: number;
  passed?: boolean;
}

export interface SemesterTerm {
  termId: number;
  termName: string;
  isActive: boolean;
}

export interface LmsAssignment {
  id: number;
  courseName: string;
  title: string;
  dueDate: string;
  isSubmitted: boolean;
}
