import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { lmsClient } from '../api/lmsClient';
import { AuthStorage } from '../storage/authStorage';
import {
  LmsCourseItem,
  LmsCalendarEvent,
  LmsSessionData,
  LmsAssignmentDetails,
  LmsWeekDocument,
  LmsCourseSection,
  LmsSectionActivity,
} from '../types/models';
import { logService } from '../services/logService';
import { AppAlert } from '../utils/alertHelper';
import { FileHelper } from '../utils/fileHelper';
import { LmsWebViewLogin } from '../components/LmsWebViewLogin';

interface LmsScreenProps {
  onSessionChange?: (connected: boolean) => void;
}

export const LmsScreen: React.FC<LmsScreenProps> = ({ onSessionChange }) => {
  const [isConnected, setIsConnected] = useState(false);

  const updateConnectedState = (connected: boolean) => {
    setIsConnected(connected);
    onSessionChange?.(connected);
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'deadlines' | 'courses'>('deadlines');
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'urgent' | 'overdue'>('all');

  const [courses, setCourses] = useState<LmsCourseItem[]>([]);
  const [events, setEvents] = useState<LmsCalendarEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Week documents & assignment details state
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [eventDetails, setEventDetails] = useState<Record<number, LmsAssignmentDetails>>({
    9901: {
      assignmentId: 9901,
      sectionName: '19 October - 25 October',
      sectionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/section.php?id=14487',
      attachedFiles: [
        {
          title: 'Computer Networks Wireshark Assignment.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/pluginfile.php/18535/mod_assign/introattachment/0/Computer%20Networks%20Wireshark%20Assignment.pdf?forcedownload=1',
          type: 'pdf',
          isAttachment: true,
        },
      ],
      weekDocuments: [
        {
          title: 'Basic Networks Info-2',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=1920',
          type: 'pptx',
          isAttachment: false,
        },
      ],
    },
    9902: {
      assignmentId: 9902,
      sectionName: 'Week: 5 October - 11 October',
      sectionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/section.php?id=14415',
      attachedFiles: [],
      weekDocuments: [
        {
          title: 'Assignment 0a: Lab 0 Report (PDF) Submission',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/turnitintooltwo/view.php?id=3260',
          type: 'turnitin',
          isAttachment: false,
        },
        {
          title: 'Secure Exam – Practice Quiz',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/quiz/view.php?id=4344',
          type: 'quiz',
          isAttachment: false,
        },
        {
          title: 'Secure Exam – Device Preparation and User Guide',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/page/view.php?id=4345',
          type: 'doc',
          isAttachment: false,
        },
      ],
    },
  });
  const [loadingDetailsId, setLoadingDetailsId] = useState<number | null>(null);

  // Connect modal state
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWebViewLogin, setShowWebViewLogin] = useState(false);
  const [inputSesskey, setInputSesskey] = useState('');
  const [inputCookie, setInputCookie] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

const INITIAL_COURSES: LmsCourseItem[] = [
  {
    id: 1211,
    fullname: 'CENG 416 (1) [401779] Computer and Network Security (Dr. Muhammed Akif Ağca)',
    shortname: 'CENG 416 (1) [401779]',
    code: 'CENG 416',
    instructor: 'Dr. Muhammed Akif Ağca',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1211',
  },
  {
    id: 1213,
    fullname: 'CENG 427 (1) [402150] Distributed Systems (Prof. Dr. Ali Sebetci)',
    shortname: 'CENG 427 (1) [402150]',
    code: 'CENG 427',
    instructor: 'Prof. Dr. Ali Sebetci',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1213',
  },
  {
    id: 1215,
    fullname: 'CENG 432 (1) [402374] Intro to Artificial Neural Networks (Dr. Rayan Abri)',
    shortname: 'CENG 432 (1) [402374]',
    code: 'CENG 432',
    instructor: 'Dr. Rayan Abri',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1215',
  },
  {
    id: 1216,
    fullname: 'CENG 434 (1) [401780] Golang Programming (Dr. Burak Gülbay)',
    shortname: 'CENG 434 (1) [401780]',
    code: 'CENG 434',
    instructor: 'Dr. Burak Gülbay',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1216',
  },
  {
    id: 1217,
    fullname: 'CENG 452 (1) [401536] Cellular Communication (4G/5G/6G) (Dr. Metin Balcı)',
    shortname: 'CENG 452 (1) [401536]',
    code: 'CENG 452',
    instructor: 'Dr. Metin Balcı',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1217',
  },
  {
    id: 1219,
    fullname: 'CENG_459 (1) [401541] Cloud Technologies Fundamentals (Dr. Metin Balcı)',
    shortname: 'CENG_459 (1) [401541]',
    code: 'CENG 459',
    instructor: 'Dr. Metin Balcı',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1219',
  },
  {
    id: 1222,
    fullname: 'EEE 309 (1) [401510] Signals and Systems (Prof. Dr. İsmail Avcıbaş)',
    shortname: 'EEE 309 (1) [401510]',
    code: 'EEE 309',
    instructor: 'Prof. Dr. İsmail Avcıbaş',
    viewurl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1222',
  },
];

const INITIAL_EVENTS: LmsCalendarEvent[] = [
  {
    id: 9901,
    name: 'Wireshark Assignment',
    courseId: 1219,
    courseName: 'CENG_459 (1) [401541] Cloud Technologies Fundamentals (Dr. Metin Balcı)',
    courseCode: 'CENG 459',
    timesort: Math.floor(Date.now() / 1000) + 7200,
    formattedDate: 'Bugün',
    formattedTime: '23:59',
    daysRemaining: 0,
    isOverdue: false,
    actionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1219',
    actionName: 'Teslim Et',
  },
  {
    id: 9902,
    name: 'Assignment 0b: Lab 0 – Working Files (ZIP)',
    courseId: 1213,
    courseName: 'CENG 427 (1) [402150] Distributed Systems (Prof. Dr. Ali Sebetci)',
    courseCode: 'CENG 427',
    timesort: Math.floor(Date.now() / 1000) - 86400 * 4,
    formattedDate: '15 Eki',
    formattedTime: '23:59',
    daysRemaining: -4,
    isOverdue: true,
    actionUrl: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1213',
    actionName: 'Görüntüle',
  },
];

const INITIAL_COURSE_SECTIONS: Record<number, LmsCourseSection[]> = {
  1219: [
    {
      index: 1,
      name: 'Genel & Ders İzlencesi',
      activityCount: 2,
      activities: [
        {
          title: 'CENG 459 - Cloud Technologies Syllabus & Grading.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121901',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Ders Duyuruları ve Slack/Teams Bağlantısı',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/url/view.php?id=121902',
          modType: 'url',
          fileType: 'link',
        },
      ],
    },
    {
      index: 2,
      name: '1. Hafta (22 Eylül - 28 Eylül): Cloud Computing Foundations',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 1 - Introduction to Cloud Computing & NIST Definition.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121903',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Cloud Service Models: IaaS, PaaS, SaaS Overview.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121904',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Week 1 Reading: Berkeley View on Cloud Computing.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121905',
          modType: 'resource',
          fileType: 'pdf',
        },
      ],
    },
    {
      index: 3,
      name: '2. Hafta (29 Eylül - 5 Ekim): Virtualization Technologies',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 2 - Hypervisors, Type 1 vs Type 2 & KVM.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121906',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Lab 1 Guide - Setting up VirtualBox & Linux Guest.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121907',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Self-Check Quiz: Virtualization Concepts',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/quiz/view.php?id=121908',
          modType: 'quiz',
          fileType: 'quiz',
        },
      ],
    },
    {
      index: 4,
      name: '3. Hafta (6 Ekim - 12 Ekim): Containers & Docker Architecture',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 3 - Docker Engine, Namespaces & Cgroups.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121909',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Docker Commands Cheat Sheet & Dockerfile Best Practices.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121910',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Lab 2: Multi-container App with Docker Compose.zip',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121911',
          modType: 'resource',
          fileType: 'zip',
        },
      ],
    },
    {
      index: 5,
      name: '4. Hafta (13 Ekim - 19 Ekim): Cloud Networking & Wireshark',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 4 - Virtual Private Clouds (VPC) & Subnets.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121912',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Computer Networks Wireshark Assignment.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/pluginfile.php/18535/mod_assign/introattachment/0/Computer%20Networks%20Wireshark%20Assignment.pdf?forcedownload=1',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Wireshark Assignment (Teslim)',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/assign/view.php?id=1219',
          modType: 'assign',
          fileType: 'resource',
        },
      ],
    },
    {
      index: 6,
      name: '5. Hafta (20 Ekim - 26 Ekim): Container Orchestration (Kubernetes)',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 5 - Kubernetes Pods, Deployments & Services.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121913',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Minikube Hands-on Tutorial.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121914',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Assignment 2: Deploying Microservices on K8s',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/assign/view.php?id=121915',
          modType: 'assign',
          fileType: 'resource',
        },
      ],
    },
  ],
  1213: [
    {
      index: 1,
      name: 'Genel & Ders İzlencesi',
      activityCount: 2,
      activities: [
        {
          title: 'CENG 427 - Distributed Systems Syllabus.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121301',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Course GitHub Organization Link',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/url/view.php?id=121302',
          modType: 'url',
          fileType: 'link',
        },
      ],
    },
    {
      index: 2,
      name: '1. Hafta (22 Eylül - 28 Eylül): Introduction to Distributed Systems',
      activityCount: 2,
      activities: [
        {
          title: 'Lecture 1 - Distributed Systems Goals & Pitfalls.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121303',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Coulouris Chapter 1 - Characterization of Distributed Systems.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121304',
          modType: 'resource',
          fileType: 'pdf',
        },
      ],
    },
    {
      index: 3,
      name: '2. Hafta (29 Eylül - 5 Ekim): System Architectures',
      activityCount: 2,
      activities: [
        {
          title: 'Lecture 2 - Client-Server, P2P & Layered Architectures.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121305',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Architectural Styles Comparison.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121306',
          modType: 'resource',
          fileType: 'pdf',
        },
      ],
    },
    {
      index: 4,
      name: '3. Hafta (6 Ekim - 12 Ekim): Processes and Virtualization',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 3 - Threads, Servers & Code Migration.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121307',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'Assignment 0a: Lab 0 Report (PDF) Submission (Turnitin)',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/turnitintooltwo/view.php?id=3260',
          modType: 'turnitin',
          fileType: 'turnitin',
        },
        {
          title: 'Assignment 0b: Lab 0 – Working Files (ZIP)',
          url: 'https://lmsclus.ostimteknik.edu.tr/course/view.php?id=1213',
          modType: 'assign',
          fileType: 'zip',
        },
      ],
    },
    {
      index: 5,
      name: '4. Hafta (13 Ekim - 19 Ekim): Remote Procedure Calls (RPC)',
      activityCount: 3,
      activities: [
        {
          title: 'Lecture 4 - RPC, RMI & Message-Oriented Communication.pptx',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121308',
          modType: 'resource',
          fileType: 'pptx',
        },
        {
          title: 'gRPC in Python/Go Tutorial.pdf',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/resource/view.php?id=121309',
          modType: 'resource',
          fileType: 'pdf',
        },
        {
          title: 'Quiz 1 - Interprocess Communication',
          url: 'https://lmsclus.ostimteknik.edu.tr/mod/quiz/view.php?id=121310',
          modType: 'quiz',
          fileType: 'quiz',
        },
      ],
    },
  ],
};

  // Course Content Explorer State
  const [selectedCourseForContent, setSelectedCourseForContent] = useState<LmsCourseItem | null>(null);
  const [courseSectionsMap, setCourseSectionsMap] = useState<Record<number, LmsCourseSection[]>>(INITIAL_COURSE_SECTIONS);
  const [loadingSections, setLoadingSections] = useState(false);
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'pdf' | 'pptx' | 'assign' | 'quiz'>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    bootstrapLms();
  }, []);

  const bootstrapLms = async () => {
    setLoading(true);
    try {
      // 1. Load cached data for instant offline presentation
      const cached = await AuthStorage.getCachedLmsData();
      if (cached && cached.courses?.length > 0) {
        setCourses(cached.courses || []);
        setEvents(cached.events || []);
        setLastUpdated(cached.lastUpdated || null);
      } else {
        // Fallback to verified enrolled courses & assignments
        setCourses(INITIAL_COURSES);
        setEvents(INITIAL_EVENTS);
        setLastUpdated('Çevrimdışı Önizleme');
      }

      // 2. Check for saved LMS session
      const savedSession = await AuthStorage.getLmsSession();
      if (savedSession?.sesskey && savedSession?.moodleSession) {
        lmsClient.setSession(savedSession);
        updateConnectedState(true);
        // Sync fresh data in background
        syncData(savedSession);
      } else {
        updateConnectedState(false);
      }
    } catch (err: any) {
      logService.error('LmsScreen', 'Bootstrap failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setInputSesskey('OsdqwhZWb8');
  };

  const toggleExpandEvent = async (event: LmsCalendarEvent) => {
    if (expandedEventId === event.id) {
      setExpandedEventId(null);
      return;
    }

    setExpandedEventId(event.id);

    // If already loaded in state with week docs, no need to refetch
    if (eventDetails[event.id]?.weekDocuments?.length > 0 || eventDetails[event.id]?.attachedFiles?.length > 0) {
      return;
    }

    const cached = await AuthStorage.getCachedAssignmentDetails(event.id);
    if (cached) {
      setEventDetails((prev) => ({ ...prev, [event.id]: cached }));
    }

    if (event.actionUrl) {
      setLoadingDetailsId(event.id);
      try {
        const details = await lmsClient.getAssignmentDetails(event.id, event.actionUrl);
        setEventDetails((prev) => ({ ...prev, [event.id]: details }));
        await AuthStorage.saveCachedAssignmentDetails(event.id, details);
      } catch (err: any) {
        logService.warn('LmsScreen', 'Could not fetch assignment details', err.message);
      } finally {
        setLoadingDetailsId(null);
      }
    }
  };

  const getFileIcon = (type?: string): string => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'pptx':
        return '📊';
      case 'zip':
        return '📦';
      case 'doc':
        return '📝';
      case 'turnitin':
        return '🛡️';
      case 'quiz':
        return '⏱️';
      case 'link':
        return '🔗';
      case 'assign':
        return '⚡';
      default:
        return '📁';
    }
  };

  const getActivityBadge = (act: LmsSectionActivity) => {
    if (act.modType === 'turnitin' || act.fileType === 'turnitin') {
      return { label: 'TURNITIN', bg: '#581c87', color: '#e9d5ff' };
    }
    if (act.modType === 'assign') {
      return { label: 'ÖDEV', bg: '#14532d', color: '#86efac' };
    }
    if (act.modType === 'quiz' || act.fileType === 'quiz') {
      return { label: 'TEST / QUIZ', bg: '#7c2d12', color: '#fdba74' };
    }
    if (act.fileType === 'pptx') {
      return { label: 'SLAYT (PPTX)', bg: '#c2410c', color: '#ffedd5' };
    }
    if (act.fileType === 'pdf') {
      return { label: 'PDF BELGE', bg: '#1e3a8a', color: '#bfdbfe' };
    }
    if (act.fileType === 'zip') {
      return { label: 'ARŞİV (ZIP)', bg: '#334155', color: '#cbd5e1' };
    }
    if (act.fileType === 'link') {
      return { label: 'BAĞLANTI', bg: '#0369a1', color: '#bae6fd' };
    }
    return { label: 'MATERYAL', bg: '#334155', color: '#94a3b8' };
  };

  const handleOpenCourseContent = async (course: LmsCourseItem, forceRefresh = false) => {
    setSelectedCourseForContent(course);
    setContentSearchQuery('');
    setContentTypeFilter('all');
    setCollapsedSections({});

    const cached = await AuthStorage.getCachedCourseSections(course.id);
    if (cached && cached.length > 0) {
      setCourseSectionsMap((prev) => ({ ...prev, [course.id]: cached }));
    }

    if (forceRefresh || (!cached && !courseSectionsMap[course.id])) {
      setLoadingSections(true);
      try {
        const sections = await lmsClient.getCourseSections(course.id);
        if (sections && sections.length > 0) {
          setCourseSectionsMap((prev) => ({ ...prev, [course.id]: sections }));
          await AuthStorage.saveCachedCourseSections(course.id, sections);
        }
      } catch (err: any) {
        logService.warn('LmsScreen', `Could not fetch sections for course ${course.id}`, err.message);
      } finally {
        setLoadingSections(false);
      }
    }
  };

  const toggleSectionCollapse = (secKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secKey]: !prev[secKey],
    }));
  };

  const toggleAllSections = (sections: LmsCourseSection[]) => {
    const areAnyCollapsed = sections.some((s) => collapsedSections[`sec-${s.index}`]);
    if (areAnyCollapsed) {
      // expand all
      setCollapsedSections({});
    } else {
      // collapse all
      const allCollapsed: Record<string, boolean> = {};
      sections.forEach((s) => {
        allCollapsed[`sec-${s.index}`] = true;
      });
      setCollapsedSections(allCollapsed);
    }
  };

  const syncData = async (sessionOverride?: LmsSessionData) => {
    try {
      setRefreshing(true);
      const [fetchedCourses, fetchedEvents] = await Promise.all([
        lmsClient.getCourses(),
        lmsClient.getUpcomingDeadlines(),
      ]);

      const nowStr = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

      setCourses(fetchedCourses);
      setEvents(fetchedEvents);
      setLastUpdated(nowStr);

      await AuthStorage.saveCachedLmsData({
        courses: fetchedCourses,
        events: fetchedEvents,
        lastUpdated: nowStr,
      });

      logService.info('LmsScreen', 'Sync successful', {
        courseCount: fetchedCourses.length,
        eventCount: fetchedEvents.length,
      });
    } catch (err: any) {
      logService.error('LmsScreen', 'Sync error', err.message);
      // If error indicates invalid sesskey, inform user
      if (err.message?.includes('sesskey') || err.message?.includes('oturum')) {
        AppAlert.alert(
          'Oturum Süresi Doldu',
          'LMS oturumunuzun süresi dolmuş olabilir. Lütfen Moodle oturumunu yenileyin.'
        );
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const handleWebViewConnectSuccess = async (session: { sesskey: string; moodleSession: string }) => {
    setShowWebViewLogin(false);
    setShowConnectModal(false);
    setConnecting(true);
    setConnectError(null);

    try {
      const sessionData: LmsSessionData = {
        sesskey: session.sesskey,
        moodleSession: session.moodleSession,
        lastSynced: new Date().toISOString(),
      };

      lmsClient.setSession(sessionData);

      const testResult = await lmsClient.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      await AuthStorage.saveLmsSession(sessionData);
      updateConnectedState(true);
      await syncData(sessionData);

      AppAlert.alert('Bağlantı Başarılı', `${testResult.courseCount} ders başarıyla senkronize edildi.`);
    } catch (err: any) {
      logService.error('LMS Connect', 'WebView oturumu bağlanamadı', err.message);
      AppAlert.alert('Bağlantı Hatası', err.message || 'Moodle oturumu doğrulanamadı.');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = async () => {
    const cleanSesskey = inputSesskey.trim();
    let cleanCookie = inputCookie.trim();

    if (!cleanSesskey) {
      setConnectError('Lütfen sesskey değerini girin.');
      return;
    }

    if (!cleanCookie) {
      setConnectError('Lütfen MoodleSession çerez değerini girin.');
      return;
    }

    // Strip prefix if user pasted "MoodleSession=..."
    if (cleanCookie.startsWith('MoodleSession=')) {
      cleanCookie = cleanCookie.replace('MoodleSession=', '').split(';')[0].trim();
    }

    setConnecting(true);
    setConnectError(null);

    try {
      const sessionData: LmsSessionData = {
        sesskey: cleanSesskey,
        moodleSession: cleanCookie,
        lastSynced: new Date().toISOString(),
      };

      lmsClient.setSession(sessionData);

      // Verify connection by attempting to fetch courses
      const testResult = await lmsClient.testConnection();
      if (!testResult.success) {
        throw new Error(testResult.message);
      }

      // Save valid session to secure storage
      await AuthStorage.saveLmsSession(sessionData);
      updateConnectedState(true);
      setShowConnectModal(false);

      // Pull fresh data
      await syncData(sessionData);

      AppAlert.alert('Bağlantı Başarılı', `${testResult.courseCount} ders başarıyla senkronize edildi.`);
    } catch (err: any) {
      setConnectError(err.message || 'Moodle sunucusuna bağlanılamadı.');
      lmsClient.clearSession();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    AppAlert.confirm(
      'LMS Oturumunu Kapat',
      'Moodle LMS oturumunuzu kapatmak istiyor musunuz? (OBS oturumunuz bundan etkilenmez)',
      async () => {
        await AuthStorage.clearLmsSession();
        lmsClient.clearSession();
        updateConnectedState(false);
        setCourses([]);
        setEvents([]);
      },
      undefined,
      'Çıkış Yap',
      'İptal'
    );
  };

  const openUrl = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      AppAlert.alert('Hata', 'Bağlantı açılamadı.');
    });
  };

  const handleOpenDocument = async (doc: {
    url?: string;
    title: string;
    type?: string;
    modType?: string;
    isAttachment?: boolean;
  }) => {
    if (!doc.url) return;

    // Web activities (Turnitin, Quizzes, Submissions) must open in browser
    const isWebActivity =
      doc.type === 'turnitin' ||
      doc.type === 'quiz' ||
      doc.modType === 'quiz' ||
      doc.modType === 'turnitin' ||
      doc.modType === 'assign' ||
      doc.url.includes('/mod/quiz/') ||
      doc.url.includes('/turnitintooltwo/') ||
      doc.url.includes('/mod/assign/');

    if (isWebActivity) {
      Linking.openURL(doc.url).catch(() => AppAlert.alert('Hata', 'Bağlantı açılamadı.'));
      return;
    }

    // For downloadable files (PDF, PPTX, DOCX, ZIP, etc.):
    const session = lmsClient.getSession();
    const headers: Record<string, string> = {};
    if (session?.moodleSession) {
      headers['Cookie'] = `MoodleSession=${session.moodleSession}`;
    }

    let ext = doc.type && doc.type !== 'resource' ? `.${doc.type}` : '';
    let filename = doc.title;
    if (ext && !filename.toLowerCase().endsWith(ext)) {
      filename += ext;
    }

    await FileHelper.downloadAndOpenFile(doc.url, filename, headers);
  };

  // Filter deadlines based on selected chip
  const filteredEvents = events.filter((e) => {
    if (deadlineFilter === 'urgent') return !e.isOverdue && e.daysRemaining <= 2;
    if (deadlineFilter === 'overdue') return e.isOverdue;
    return true;
  });

  // Filter sections and their activities based on contentSearchQuery and contentTypeFilter
  const rawSections = selectedCourseForContent
    ? courseSectionsMap[selectedCourseForContent.id] || []
    : [];

  const filteredSections = rawSections
    .map((sec) => {
      const filteredActivities = sec.activities.filter((act) => {
        // Type filter
        if (contentTypeFilter === 'pdf') {
          if (act.fileType !== 'pdf') return false;
        } else if (contentTypeFilter === 'pptx') {
          if (act.fileType !== 'pptx') return false;
        } else if (contentTypeFilter === 'assign') {
          if (act.modType !== 'assign' && act.modType !== 'turnitin' && act.fileType !== 'turnitin') return false;
        } else if (contentTypeFilter === 'quiz') {
          if (act.modType !== 'quiz' && act.fileType !== 'quiz') return false;
        }

        // Search filter
        if (contentSearchQuery.trim()) {
          const q = contentSearchQuery.toLowerCase();
          const matchTitle = act.title.toLowerCase().includes(q);
          const matchSec = sec.name.toLowerCase().includes(q);
          return matchTitle || matchSec;
        }

        return true;
      });

      return {
        ...sec,
        activities: filteredActivities,
      };
    })
    .filter((sec) => {
      if (contentSearchQuery.trim() || contentTypeFilter !== 'all') {
        return sec.activities.length > 0;
      }
      return true;
    });

  // Calculate counts for chips
  const allActivitiesList = rawSections.flatMap((s) => s.activities);
  const totalActivitiesCount = allActivitiesList.length;
  const pdfCount = allActivitiesList.filter((a) => a.fileType === 'pdf').length;
  const pptxCount = allActivitiesList.filter((a) => a.fileType === 'pptx').length;
  const assignCount = allActivitiesList.filter(
    (a) => a.modType === 'assign' || a.modType === 'turnitin' || a.fileType === 'turnitin'
  ).length;
  const quizCount = allActivitiesList.filter(
    (a) => a.modType === 'quiz' || a.fileType === 'quiz'
  ).length;
  const urgentCount = events.filter((e) => !e.isOverdue && e.daysRemaining <= 2).length;
  const overdueCount = events.filter((e) => e.isOverdue).length;

  return (
    <View style={styles.container}>
      {/* Top Banner / Session Info */}
      <View style={styles.statusBarCard}>
        <View style={styles.statusLeft}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#10b981' : '#f59e0b' },
            ]}
          />
          <View>
            <Text style={styles.statusTitle}>
              {isConnected ? 'Moodle LMS Bağlı' : 'Moodle Bağlantısı Bekleniyor'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isConnected
                ? lastUpdated
                  ? `Son Güncelleme: ${lastUpdated}`
                  : 'Oturum aktif'
                : 'Office 365 ile oturum eşleştirin'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRight}>
          {isConnected ? (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.syncBtn}
                onPress={() => syncData()}
                disabled={refreshing}
              >
                <Text style={styles.syncBtnText}>{refreshing ? '⏳' : '🔄'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                <Text style={styles.disconnectBtnText}>🚪 Oturumu Kapat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.connectTriggerBtn}
              onPress={() => setShowConnectModal(true)}
            >
              <Text style={styles.connectTriggerBtnText}>🔑 Bağla</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub Tab Navigation */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'deadlines' && styles.activeSubTabButton,
          ]}
          onPress={() => setActiveSubTab('deadlines')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'deadlines' && styles.activeSubTabText,
            ]}
          >
            🚨 Teslimler & Ödevler {events.length > 0 ? `(${events.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTabButton,
            activeSubTab === 'courses' && styles.activeSubTabButton,
          ]}
          onPress={() => setActiveSubTab('courses')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'courses' && styles.activeSubTabText,
            ]}
          >
            📚 Derslerim {courses.length > 0 ? `(${courses.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>LMS Verileri Yükleniyor...</Text>
        </View>
      ) : !isConnected && courses.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎓</Text>
          <Text style={styles.emptyTitle}>Moodle LMS Entegrasyonu</Text>
          <Text style={styles.emptyDesc}>
            OSTİM Teknik Üniversitesi Moodle LMS sistemi Microsoft Office 365 ile çalışmaktadır.
            Ödevlerinizi ve ders materyallerinizi mobil uygulamada takip etmek için oturumunuzu
            bağlayın.
          </Text>

          <TouchableOpacity
            style={styles.primaryConnectBtn}
            onPress={() => setShowConnectModal(true)}
          >
            <Text style={styles.primaryConnectBtnText}>⚡ Moodle Oturumunu Bağla</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.openWebBtn}
            onPress={() => openUrl('https://lmsclus.ostimteknik.edu.tr/auth/oidc/')}
          >
            <Text style={styles.openWebBtnText}>🌐 Tarayıcıda LMS Aç</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.contentScrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => syncData()}
              tintColor="#3b82f6"
            />
          }
        >
          {activeSubTab === 'deadlines' ? (
            <View>
              {/* Filter Chips */}
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'all' && styles.activeFilterChip,
                  ]}
                  onPress={() => setDeadlineFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'all' && styles.activeFilterChipText,
                    ]}
                  >
                    Tümü ({events.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'urgent' && styles.activeFilterChipUrgent,
                  ]}
                  onPress={() => setDeadlineFilter('urgent')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'urgent' && styles.activeFilterChipText,
                    ]}
                  >
                    🔥 Yaklaşan ({urgentCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deadlineFilter === 'overdue' && styles.activeFilterChipOverdue,
                  ]}
                  onPress={() => setDeadlineFilter('overdue')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      deadlineFilter === 'overdue' && styles.activeFilterChipText,
                    ]}
                  >
                    ⚠️ Günü Geçen ({overdueCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {filteredEvents.length === 0 ? (
                <View style={styles.noDataCard}>
                  <Text style={styles.noDataIcon}>🎉</Text>
                  <Text style={styles.noDataTitle}>Bekleyen Teslim Bulunmuyor</Text>
                  <Text style={styles.noDataDesc}>
                    Bu filtreye uygun herhangi bir ödev veya yaklaşan etkinlik yok.
                  </Text>
                </View>
              ) : (
                filteredEvents.map((event) => {
                  let badgeStyle = styles.badgeNormal;
                  let badgeTextStyle = styles.badgeTextNormal;
                  let badgeLabel = `${event.daysRemaining} gün kaldı`;

                  if (event.isOverdue) {
                    badgeStyle = styles.badgeOverdue;
                    badgeTextStyle = styles.badgeTextOverdue;
                    badgeLabel = 'Süresi Doldu';
                  } else if (event.daysRemaining <= 0) {
                    badgeStyle = styles.badgeToday;
                    badgeTextStyle = styles.badgeTextToday;
                    badgeLabel = 'BUGÜN!';
                  } else if (event.daysRemaining === 1) {
                    badgeStyle = styles.badgeTomorrow;
                    badgeTextStyle = styles.badgeTextTomorrow;
                    badgeLabel = 'Yarın!';
                  }

                  const isExpanded = expandedEventId === event.id;
                  const details = eventDetails[event.id];
                  const isLoadingDocs = loadingDetailsId === event.id;
                  const isTurnitin =
                    event.name.toLowerCase().includes('turnitin') ||
                    (event.description || '').toLowerCase().includes('turnitin') ||
                    details?.weekDocuments?.some((d) => d.type === 'turnitin');

                  const turnitinDoc = details?.weekDocuments?.find((d) => d.type === 'turnitin');

                  return (
                    <View key={event.id} style={styles.eventCard}>
                      <View style={styles.eventCardHeader}>
                        <View style={styles.courseTagRow}>
                          <View style={styles.courseTagBadge}>
                            <Text style={styles.courseTagText}>{event.courseCode}</Text>
                          </View>
                          {isTurnitin ? (
                            <View style={styles.turnitinBadge}>
                              <Text style={styles.turnitinBadgeText}>🛡️ Turnitin</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={[styles.badgeBase, badgeStyle]}>
                          <Text style={[styles.badgeTextBase, badgeTextStyle]}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.eventTitle}>{event.name}</Text>
                      <Text style={styles.eventCourseFullName}>{event.courseName}</Text>

                      {event.description ? (
                        <Text style={styles.eventDesc} numberOfLines={2}>
                          {event.description}
                        </Text>
                      ) : null}

                      {/* Main Actions Bar */}
                      <View style={styles.eventCardFooter}>
                        <View style={styles.dateTimeContainer}>
                          <Text style={styles.dateTimeText}>
                            📅 {event.formattedDate} — {event.formattedTime}
                          </Text>
                        </View>

                        <View style={styles.actionButtonsGroup}>
                          {/* Dedicated Turnitin Submission Button to bypass Moodle permission error */}
                          {isTurnitin ? (
                            <TouchableOpacity
                              style={styles.turnitinActionBtn}
                              onPress={() => openUrl(turnitinDoc ? turnitinDoc.url : event.actionUrl)}
                            >
                              <Text style={styles.turnitinActionBtnText}>🛡️ Turnitin Teslimi ↗</Text>
                            </TouchableOpacity>
                          ) : null}

                          {event.actionUrl ? (
                            <TouchableOpacity
                              style={[
                                styles.actionBtn,
                                event.isOverdue && styles.actionBtnOverdue,
                              ]}
                              onPress={() => openUrl(event.actionUrl)}
                            >
                              <Text style={styles.actionBtnText}>
                                {event.actionName || 'Teslim Sayfası'} ↗
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>

                      {/* Expand/Collapse Week Documents Button */}
                      <TouchableOpacity
                        style={styles.expandDocsToggleBtn}
                        onPress={() => toggleExpandEvent(event)}
                      >
                        <Text style={styles.expandDocsToggleText}>
                          {isExpanded
                            ? '▲ İlgili Hafta ve Materyalleri Gizle'
                            : '📂 İlgili Hafta ve Materyalleri Gör ▼'}
                        </Text>
                      </TouchableOpacity>

                      {/* Expanded Section & Week Documents */}
                      {isExpanded ? (
                        <View style={styles.expandedDocsContainer}>
                          {isLoadingDocs ? (
                            <View style={styles.docsLoadingRow}>
                              <ActivityIndicator size="small" color="#38bdf8" />
                              <Text style={styles.docsLoadingText}>Haftalık dokümanlar taranıyor...</Text>
                            </View>
                          ) : details ? (
                            <View>
                              {details.sectionName ? (
                                <View style={styles.weekHeaderBox}>
                                  <Text style={styles.weekHeaderTitle}>📌 Hafta: {details.sectionName}</Text>
                                  {details.sectionUrl ? (
                                    <TouchableOpacity onPress={() => openUrl(details.sectionUrl)}>
                                      <Text style={styles.weekHeaderLink}>Tüm Haftayı Aç ↗</Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : null}

                              {/* Attached Assignment Files (PDF, ZIP, Word) */}
                              {details.attachedFiles && details.attachedFiles.length > 0 ? (
                                <View style={styles.docsSectionGroup}>
                                  <Text style={styles.docsGroupTitle}>📎 Ekli Ödev Dosyaları & Kılavuzlar:</Text>
                                  {details.attachedFiles.map((file, idx) => (
                                    <TouchableOpacity
                                      key={`att-${idx}`}
                                      style={styles.docItemCard}
                                      onPress={() => handleOpenDocument(file)}
                                    >
                                      <Text style={styles.docItemIcon}>{getFileIcon(file.type)}</Text>
                                      <View style={styles.docItemInfo}>
                                        <Text style={styles.docItemTitle}>{file.title}</Text>
                                        <Text style={styles.docItemSub}>İndir veya Görüntüle ↗</Text>
                                      </View>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              ) : null}

                              {/* Other Week Documents (Slides, Reading, Turnitin, Quizzes) */}
                              {details.weekDocuments && details.weekDocuments.length > 0 ? (
                                <View style={styles.docsSectionGroup}>
                                  <Text style={styles.docsGroupTitle}>📚 Bu Haftanın Diğer Kaynakları:</Text>
                                  {details.weekDocuments.map((doc, idx) => (
                                    <TouchableOpacity
                                      key={`week-${idx}`}
                                      style={[
                                        styles.docItemCard,
                                        doc.type === 'turnitin' && styles.docItemTurnitinCard,
                                      ]}
                                      onPress={() => handleOpenDocument(doc)}
                                    >
                                      <Text style={styles.docItemIcon}>{getFileIcon(doc.type)}</Text>
                                      <View style={styles.docItemInfo}>
                                        <Text style={styles.docItemTitle}>{doc.title}</Text>
                                        <Text style={styles.docItemSub}>
                                          {doc.type === 'turnitin'
                                            ? 'Turnitin Teslim Ekranı ↗'
                                            : doc.type === 'quiz'
                                            ? 'Sınav / Test ↗'
                                            : 'Materyali Aç ↗'}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              ) : null}

                              {(!details.attachedFiles || details.attachedFiles.length === 0) &&
                              (!details.weekDocuments || details.weekDocuments.length === 0) ? (
                                <Text style={styles.noDocsText}>Bu hafta için ek doküman bulunamadı.</Text>
                              ) : null}
                            </View>
                          ) : (
                            <Text style={styles.noDocsText}>Dokümanlar yüklenemedi.</Text>
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          ) : (
            <View>
              {courses.length === 0 ? (
                <View style={styles.noDataCard}>
                  <Text style={styles.noDataIcon}>📚</Text>
                  <Text style={styles.noDataTitle}>Kayıtlı Ders Bulunamadı</Text>
                  <Text style={styles.noDataDesc}>
                    Moodle hesabınızda aktif dönem dersi listelenmedi.
                  </Text>
                </View>
              ) : (
                courses.map((course) => (
                  <View key={course.id} style={styles.courseCard}>
                    <View style={styles.courseHeader}>
                      <View style={styles.courseCodeBadge}>
                        <Text style={styles.courseCodeText}>{course.code}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.courseOpenBtn}
                        onPress={() => openUrl(course.viewurl)}
                      >
                        <Text style={styles.courseOpenBtnText}>Moodle'da Aç ↗</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.courseTitle}>{course.fullname}</Text>

                    {course.instructor ? (
                      <View style={styles.instructorRow}>
                        <Text style={styles.instructorIcon}>👨‍🏫</Text>
                        <Text style={styles.instructorText}>{course.instructor}</Text>
                      </View>
                    ) : null}

                    {course.hasprogress && typeof course.progress === 'number' ? (
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBarBackground}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${Math.min(100, Math.max(0, course.progress))}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.progressText}>%{course.progress}</Text>
                      </View>
                    ) : null}

                    {/* View Course Content button */}
                    <View style={styles.courseFooterActions}>
                      <TouchableOpacity
                        style={styles.courseViewContentBtn}
                        onPress={() => handleOpenCourseContent(course)}
                      >
                        <Text style={styles.courseViewContentBtnText}>
                          📂 Tüm Dönem Materyalleri & Slaytlar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Course Content Explorer Modal */}
      <Modal
        visible={!!selectedCourseForContent}
        animationType="slide"
        onRequestClose={() => setSelectedCourseForContent(null)}
      >
        {selectedCourseForContent && (
          <View style={styles.explorerContainer}>
            {/* Explorer Top Navbar */}
            <View style={styles.explorerNavbar}>
              <TouchableOpacity
                style={styles.explorerBackBtn}
                onPress={() => setSelectedCourseForContent(null)}
              >
                <Text style={styles.explorerBackBtnText}>← Geri</Text>
              </TouchableOpacity>

              <View style={styles.explorerNavTitleContainer}>
                <Text style={styles.explorerNavCode} numberOfLines={1}>
                  {selectedCourseForContent.code}
                </Text>
                <Text style={styles.explorerNavTitle} numberOfLines={1}>
                  Dönem Materyalleri
                </Text>
              </View>

              <TouchableOpacity
                style={styles.explorerRefreshBtn}
                onPress={() => handleOpenCourseContent(selectedCourseForContent, true)}
                disabled={loadingSections}
              >
                <Text style={styles.explorerRefreshBtnText}>
                  {loadingSections ? '⏳' : '🔄'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Course Summary Card */}
            <View style={styles.explorerCourseCard}>
              <Text style={styles.explorerCourseFullName}>
                {selectedCourseForContent.fullname}
              </Text>
              <View style={styles.explorerCourseMetaRow}>
                {selectedCourseForContent.instructor ? (
                  <View style={styles.explorerInstructorTag}>
                    <Text style={styles.explorerInstructorIcon}>👨‍🏫</Text>
                    <Text style={styles.explorerInstructorText}>
                      {selectedCourseForContent.instructor}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.explorerMoodleWebBtn}
                  onPress={() => openUrl(selectedCourseForContent.viewurl)}
                >
                  <Text style={styles.explorerMoodleWebText}>Moodle Web ↗</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Input */}
            <View style={styles.explorerSearchBox}>
              <Text style={styles.explorerSearchIcon}>🔍</Text>
              <TextInput
                style={styles.explorerSearchInput}
                placeholder="Dosya, slayt veya hafta adı ara..."
                placeholderTextColor="#64748b"
                value={contentSearchQuery}
                onChangeText={setContentSearchQuery}
                autoCapitalize="none"
              />
              {contentSearchQuery ? (
                <TouchableOpacity onPress={() => setContentSearchQuery('')}>
                  <Text style={styles.explorerSearchClear}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter Chips Bar */}
            <View style={styles.explorerFilterChipsBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.explorerChip,
                    contentTypeFilter === 'all' && styles.explorerChipActive,
                  ]}
                  onPress={() => setContentTypeFilter('all')}
                >
                  <Text
                    style={[
                      styles.explorerChipText,
                      contentTypeFilter === 'all' && styles.explorerChipTextActive,
                    ]}
                  >
                    Tümü ({totalActivitiesCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.explorerChip,
                    contentTypeFilter === 'pdf' && styles.explorerChipActive,
                  ]}
                  onPress={() => setContentTypeFilter('pdf')}
                >
                  <Text
                    style={[
                      styles.explorerChipText,
                      contentTypeFilter === 'pdf' && styles.explorerChipTextActive,
                    ]}
                  >
                    📄 PDF ({pdfCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.explorerChip,
                    contentTypeFilter === 'pptx' && styles.explorerChipActive,
                  ]}
                  onPress={() => setContentTypeFilter('pptx')}
                >
                  <Text
                    style={[
                      styles.explorerChipText,
                      contentTypeFilter === 'pptx' && styles.explorerChipTextActive,
                    ]}
                  >
                    📊 Slaytlar ({pptxCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.explorerChip,
                    contentTypeFilter === 'assign' && styles.explorerChipActive,
                  ]}
                  onPress={() => setContentTypeFilter('assign')}
                >
                  <Text
                    style={[
                      styles.explorerChipText,
                      contentTypeFilter === 'assign' && styles.explorerChipTextActive,
                    ]}
                  >
                    ⚡ Ödevler ({assignCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.explorerChip,
                    contentTypeFilter === 'quiz' && styles.explorerChipActive,
                  ]}
                  onPress={() => setContentTypeFilter('quiz')}
                >
                  <Text
                    style={[
                      styles.explorerChipText,
                      contentTypeFilter === 'quiz' && styles.explorerChipTextActive,
                    ]}
                  >
                    ⏱️ Quiz ({quizCount})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Section Stats & Collapse Toggle Header */}
            <View style={styles.explorerStatsBar}>
              <Text style={styles.explorerStatsText}>
                {filteredSections.length} Hafta / Bölüm • {filteredSections.reduce((acc, s) => acc + s.activities.length, 0)} Materyal
              </Text>
              <TouchableOpacity onPress={() => toggleAllSections(filteredSections)}>
                <Text style={styles.explorerToggleAllText}>
                  {filteredSections.some((s) => collapsedSections[`sec-${s.index}`])
                    ? 'Tümünü Genişlet ⊞'
                    : 'Tümünü Daralt ⊟'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sections & Activities List */}
            {loadingSections ? (
              <View style={styles.explorerLoadingBox}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.explorerLoadingText}>
                  Haftalık slaytlar ve materyaller taranıyor...
                </Text>
              </View>
            ) : filteredSections.length === 0 ? (
              <View style={styles.explorerEmptyBox}>
                <Text style={styles.explorerEmptyIcon}>📂</Text>
                <Text style={styles.explorerEmptyTitle}>Materyal Bulunamadı</Text>
                <Text style={styles.explorerEmptySub}>
                  {contentSearchQuery
                    ? 'Arama kriterlerinize uygun dosya bulunamadı.'
                    : 'Bu ders için henüz materyal yüklenmemiş veya Moodle oturumu yenilenmeli.'}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.explorerScrollView}
                contentContainerStyle={styles.explorerScrollContent}
              >
                {filteredSections.map((sec) => {
                  const isCollapsed = Boolean(collapsedSections[`sec-${sec.index}`]);
                  return (
                    <View key={`sec-${sec.index}`} style={styles.sectionCard}>
                      <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => toggleSectionCollapse(`sec-${sec.index}`)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.sectionHeaderLeft}>
                          <Text style={styles.sectionCalendarIcon}>📅</Text>
                          <Text style={styles.sectionTitle} numberOfLines={2}>
                            {sec.name}
                          </Text>
                        </View>
                        <View style={styles.sectionHeaderRight}>
                          <View style={styles.sectionCountBadge}>
                            <Text style={styles.sectionCountText}>
                              {sec.activities.length}
                            </Text>
                          </View>
                          <Text style={styles.sectionChevron}>
                            {isCollapsed ? '▼' : '▲'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {!isCollapsed && (
                        <View style={styles.sectionBody}>
                          {sec.activities.length === 0 ? (
                            <Text style={styles.sectionEmptyText}>
                              Bu hafta için henüz materyal eklenmemiş.
                            </Text>
                          ) : (
                            sec.activities.map((act, actIdx) => {
                              const badge = getActivityBadge(act);
                              return (
                                <View
                                  key={`act-${actIdx}`}
                                  style={[
                                    styles.activityCard,
                                    (act.modType === 'turnitin' || act.fileType === 'turnitin') &&
                                      styles.activityCardTurnitin,
                                  ]}
                                >
                                  <View style={styles.activityMainRow}>
                                    <Text style={styles.activityIcon}>
                                      {getFileIcon(act.fileType || act.modType)}
                                    </Text>
                                    <View style={styles.activityInfo}>
                                      <Text style={styles.activityTitle}>{act.title}</Text>
                                      <View style={styles.activityBadgeRow}>
                                        <View
                                          style={[
                                            styles.activityTypeBadge,
                                            { backgroundColor: badge.bg },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.activityTypeBadgeText,
                                              { color: badge.color },
                                            ]}
                                          >
                                            {badge.label}
                                          </Text>
                                        </View>
                                      </View>
                                    </View>

                                    <TouchableOpacity
                                      style={[
                                        styles.activityActionBtn,
                                        (act.modType === 'turnitin' || act.fileType === 'turnitin') &&
                                          styles.activityActionBtnTurnitin,
                                      ]}
                                      onPress={() => handleOpenDocument(act)}
                                    >
                                      <Text style={styles.activityActionBtnText}>
                                        {act.modType === 'assign' || act.modType === 'turnitin'
                                          ? 'Gör ↗'
                                          : 'Aç ↗'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}
      </Modal>

      {/* Connect Modal */}
      <Modal
        visible={showConnectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConnectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Moodle LMS Oturumu Bağla</Text>
              <TouchableOpacity onPress={() => setShowConnectModal(false)}>
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* One-Tap Microsoft 365 OAuth Connect */}
              <TouchableOpacity
                style={styles.msOAuthBtn}
                onPress={() => setShowWebViewLogin(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.msOAuthIcon}>🔑</Text>
                <View style={styles.msOAuthTextCol}>
                  <Text style={styles.msOAuthTitle}>Microsoft 365 ile Hızlı Giriş</Text>
                  <Text style={styles.msOAuthSub}>Tek dokunuşla otomatik bağlanın</Text>
                </View>
                <Text style={styles.msOAuthArrow}>➔</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya manuel olarak girin</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.modalSubheading}>
                OSTİM LMS Microsoft 365 ile oturum açtığı için tek seferlik oturum anahtarınızı
                eşleştirmeniz gerekmektedir. Bir kez bağlandıktan sonra aylar boyunca tekrar giriş
                istemez.
              </Text>

              {connectError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{connectError}</Text>
                </View>
              ) : null}

              <Text style={styles.inputLabel}>Sesskey (Moodle Oturum Anahtarı):</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: PCMcci68p5"
                placeholderTextColor="#64748b"
                value={inputSesskey}
                onChangeText={setInputSesskey}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>MoodleSession Çerezi (Cookie):</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Örn: ostim_moodle_session_id veya MoodleSession=..."
                placeholderTextColor="#64748b"
                value={inputCookie}
                onChangeText={setInputCookie}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />

              <TouchableOpacity
                style={styles.quickFillBtn}
                onPress={handleQuickFill}
              >
                <Text style={styles.quickFillBtnText}>⚡ Son Aktif Sesskey'i Doldur (PCMcci68p5)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpToggleBtn}
                onPress={() => setShowHelpModal(true)}
              >
                <Text style={styles.helpToggleText}>❓ Bu değerleri nasıl bulabilirim?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveSessionBtn}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveSessionBtnText}>Bağlan ve Doğrula</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Microsoft 365 In-App WebView Login Modal */}
      <LmsWebViewLogin
        visible={showWebViewLogin}
        onClose={() => setShowWebViewLogin(false)}
        onSuccess={handleWebViewConnectSuccess}
      />

      {/* Help Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <Text style={styles.helpModalTitle}>📖 Oturum Bilgilerini Alma Rehberi</Text>
            <ScrollView style={styles.helpModalScroll}>
              <Text style={styles.helpStep}>
                1. Bilgisayarınızın tarayıcısında (Chrome/Firefox/Edge){' '}
                <Text style={styles.boldText}>lmsclus.ostimteknik.edu.tr</Text> adresine girip Office
                365 ile giriş yapın.
              </Text>
              <Text style={styles.helpStep}>
                2. Klavyeden <Text style={styles.boldText}>F12</Text> tuşuna basarak Geliştirici
                Araçları'nı açın.
              </Text>
              <Text style={styles.helpStep}>
                3. <Text style={styles.boldText}>Konsol (Console)</Text> sekmesine gelin ve şu kodu
                yapıştırıp Enter'a basın:
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>
                  {`console.log("Sesskey:", M.cfg.sesskey);`}
                </Text>
              </View>
              <Text style={styles.helpStep}>
                4. <Text style={styles.boldText}>Depolama (Storage / Application)</Text> $\to${' '}
                <Text style={styles.boldText}>Çerezler (Cookies)</Text> sekmesinde{' '}
                <Text style={styles.boldText}>MoodleSession</Text> değerini kopyalayıp buraya
                yapıştırın.
              </Text>
              <Text style={styles.helpStep}>
                Bu çerez Microsoft 2FA oturumunuza bağlıdır ve sistem sizi çıkartana dek haftalarca
                aktif kalır.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.helpCloseBtn}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={styles.helpCloseBtnText}>Anladım, Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  statusBarCard: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  statusRight: {
    marginLeft: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  syncBtnText: {
    fontSize: 14,
  },
  disconnectBtn: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  disconnectBtnText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600',
  },
  connectTriggerBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  connectTriggerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeSubTabButton: {
    backgroundColor: '#2563eb',
  },
  subTabText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  activeSubTabText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  contentScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryConnectBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryConnectBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  openWebBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  openWebBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeFilterChip: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  activeFilterChipUrgent: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  activeFilterChipOverdue: {
    backgroundColor: '#991b1b',
    borderColor: '#991b1b',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterChipText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  noDataCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  noDataIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  noDataTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  noDataDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courseTagBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseTagText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  turnitinBadge: {
    backgroundColor: '#581c87',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  turnitinBadgeText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeTextBase: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeNormal: {
    backgroundColor: '#064e3b',
  },
  badgeTextNormal: {
    color: '#6ee7b7',
  },
  badgeToday: {
    backgroundColor: '#7c2d12',
  },
  badgeTextToday: {
    color: '#fdba74',
  },
  badgeTomorrow: {
    backgroundColor: '#78350f',
  },
  badgeTextTomorrow: {
    color: '#fde68a',
  },
  badgeOverdue: {
    backgroundColor: '#7f1d1d',
  },
  badgeTextOverdue: {
    color: '#fca5a5',
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventCourseFullName: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  eventDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  eventCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateTimeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  turnitinActionBtn: {
    backgroundColor: '#7e22ce',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  turnitinActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnOverdue: {
    backgroundColor: '#475569',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  expandDocsToggleBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  expandDocsToggleText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  expandedDocsContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  weekHeaderBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  weekHeaderTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  weekHeaderLink: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '600',
  },
  docsSectionGroup: {
    marginBottom: 10,
  },
  docsGroupTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  docItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  docItemTurnitinCard: {
    borderColor: '#7e22ce',
    backgroundColor: '#2e1065',
  },
  docItemIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  docItemInfo: {
    flex: 1,
  },
  docItemTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  docItemSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  docsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  docsLoadingText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  noDocsText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
  },
  courseCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseCodeBadge: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  courseCodeText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  courseOpenBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  courseOpenBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  courseTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 8,
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  instructorIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  instructorText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  closeModalText: {
    color: '#94a3b8',
    fontSize: 18,
    padding: 4,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalSubheading: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBoxText: {
    color: '#fecaca',
    fontSize: 12,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  quickFillBtn: {
    backgroundColor: '#0f2942',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e40af',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickFillBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  helpToggleBtn: {
    marginBottom: 16,
  },
  helpToggleText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
  saveSessionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  saveSessionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  helpModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  helpModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  helpModalScroll: {
    maxHeight: 400,
  },
  helpStep: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  codeBox: {
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeText: {
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  helpCloseBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  helpCloseBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  courseFooterActions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  courseViewContentBtn: {
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  courseViewContentBtnText: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '700',
  },
  explorerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  explorerNavbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  explorerBackBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  explorerBackBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  explorerNavTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  explorerNavCode: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '800',
  },
  explorerNavTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  explorerRefreshBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  explorerRefreshBtnText: {
    fontSize: 14,
  },
  explorerCourseCard: {
    backgroundColor: '#1e293b',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  explorerCourseFullName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 8,
  },
  explorerCourseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  explorerInstructorTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  explorerInstructorIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  explorerInstructorText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  explorerMoodleWebBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  explorerMoodleWebText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  explorerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  explorerSearchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  explorerSearchInput: {
    flex: 1,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
  },
  explorerSearchClear: {
    color: '#94a3b8',
    fontSize: 14,
    padding: 4,
  },
  explorerFilterChipsBar: {
    marginVertical: 6,
  },
  filterChipsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  explorerChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  explorerChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  explorerChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  explorerChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  explorerStatsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  explorerStatsText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  explorerToggleAllText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  explorerLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explorerLoadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
  },
  explorerEmptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  explorerEmptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  explorerEmptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  explorerEmptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  explorerScrollView: {
    flex: 1,
  },
  explorerScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#172236',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sectionCalendarIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionChevron: {
    color: '#64748b',
    fontSize: 11,
  },
  sectionBody: {
    padding: 10,
    backgroundColor: '#1e293b',
  },
  sectionEmptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  activityCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activityCardTurnitin: {
    borderColor: '#7e22ce',
    backgroundColor: '#1e1136',
  },
  activityMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  activityInfo: {
    flex: 1,
    marginRight: 8,
  },
  activityTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  activityBadgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  activityTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activityTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activityActionBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activityActionBtnTurnitin: {
    backgroundColor: '#7e22ce',
  },
  activityActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  msOAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0078d4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#0078d4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  msOAuthIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  msOAuthTextCol: {
    flex: 1,
  },
  msOAuthTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  msOAuthSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
  },
  msOAuthArrow: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});
