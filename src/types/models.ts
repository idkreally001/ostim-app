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

export interface LmsCourseItem {
  id: number;
  fullname: string;
  shortname: string;
  code: string;
  instructor?: string;
  viewurl: string;
  courseimage?: string;
  progress?: number;
  hasprogress?: boolean;
}

export interface LmsCalendarEvent {
  id: number;
  name: string;
  description?: string;
  courseId: number;
  courseName: string;
  courseCode: string;
  timesort: number;
  formattedDate: string;
  formattedTime: string;
  daysRemaining: number;
  isOverdue: boolean;
  actionUrl?: string;
  actionName?: string;
}

export interface LmsSessionData {
  sesskey: string;
  moodleSession: string;
  userId?: number;
  userName?: string;
  lastSynced?: string;
}

export interface LmsCachedData {
  courses: LmsCourseItem[];
  events: LmsCalendarEvent[];
  lastUpdated: string;
}

export interface LmsWeekDocument {
  id?: string | number;
  title: string;
  url: string;
  type: 'pdf' | 'pptx' | 'zip' | 'doc' | 'quiz' | 'turnitin' | 'link' | 'resource';
  isAttachment?: boolean;
}

export interface LmsAssignmentDetails {
  assignmentId: number;
  sectionName?: string;
  sectionUrl?: string;
  attachedFiles: LmsWeekDocument[];
  weekDocuments: LmsWeekDocument[];
}


