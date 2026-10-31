// api/client.ts — Typed API client with cookie-based auth

export interface Principal {
  role: 'student' | 'president' | 'teacher';
  classId: string;
  user: {
    discordId: string;
    firstName: string;
    lastName: string;
    studentId: string;
    isActive: boolean;
  };
}

export interface Homework {
  homeworkId: string;
  subjectCode: string;
  title: string;
  details: string;
  imageUrl: string;
  link: string;
  dueDate: string;
  assignDate: string;
  addedBy: string;
  classId: string;
  isOverdue: boolean;
  completed: boolean;
  completedCount: number;
}

export interface Subject {
  subjectCode: string;
  subjectName: string;
  credits: string;
  instructor: string;
  classId: string;
  needsReview: boolean;
}

export interface Announcement {
  announcementId: string;
  title: string;
  body: string;
  priority: string;
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableCell {
  cellType: string;
  subjectCode: string;
  label: string;
  instructor: string;
  timetableEntryId?: string;
  day?: number;
  period?: number;
}

export interface ClassInfo {
  classId: string;
  className: string;
  room: string;
  defaultTerm: number;
  defaultSchoolYear: number;
  timeZone: string;
  isActive: boolean;
}

export interface Analytics {
  user: { firstName: string; lastName: string; studentId: string };
  pendingCount: number;
  doneCount: number;
  todoCount: number;
  completionRate: number;
  upcoming: { homeworkId: string; title: string; subjectCode: string; dueDate: string }[];
  subjectStats: { subjectCode: string; total: number; completed: number; rate: number }[];
}

export interface ClassAnalytics {
  totalHomework: number;
  totalPending: number;
  overdueCount: number;
  totalStudents: number;
  homeworkStats: {
    homeworkId: string; title: string; subjectCode: string; dueDate: string;
    completedCount: number; totalCount: number; isOverdue: boolean;
  }[];
  studentStats: {
    studentId: string; name: string; completed: number; pending: number; rate: number;
  }[];
  subjectStats: { subjectCode: string; total: number; completed: number }[];
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Read the CSRF token from the emble-csrf cookie set by the server. */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)emble-csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach CSRF token for state-changing requests
  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const res = await fetch(path, {
    credentials: 'same-origin',
    headers,
    ...options,
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch { /* not JSON */ }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export const apiClient = {
  get:  <T>(path: string) => api<T>(path),
  post: <T>(path: string, data?: unknown) =>
    api<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    api<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    api<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),

  // Auth
  auth: {
    login: (studentId: string, password: string) =>
      apiClient.post<{ principal: Principal }>('/api/auth/login', { studentId, password }),
    logout: () => apiClient.post('/api/auth/logout'),
    me: () => apiClient.get<{ principal: Principal | null }>('/api/auth/me'),
    discordUrl: '/api/auth/discord',
  },

  // Meta
  meta: {
    class: () => apiClient.get<ClassInfo>('/api/meta/class'),
  },

  // Homework
  homework: {
    list: (params?: Record<string, string>) => {
      const q = params ? '?' + new URLSearchParams(params).toString() : '';
      return apiClient.get<{ homework: Homework[] }>(`/api/homework${q}`);
    },
    get: (id: string) => apiClient.get<Homework>(`/api/homework/${id}`),
    create: (data: Partial<Homework>) => apiClient.post<Homework>('/api/homework', data),
    update: (id: string, data: Partial<Homework>) => apiClient.patch<Homework>(`/api/homework/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/homework/${id}`),
    complete: (id: string) => apiClient.put(`/api/homework/${id}/completion`),
    uncomplete: (id: string) => apiClient.delete(`/api/homework/${id}/completion`),
  },

  // Completion
  completion: {
    mine: () => apiClient.get<{ completions: { homeworkId: string; completedAt: string }[] }>('/api/completion/mine'),
  },

  // Subjects
  subjects: {
    list: () => apiClient.get<{ subjects: Subject[] }>('/api/subjects'),
    create: (data: Partial<Subject>) => apiClient.post<Subject>('/api/subjects', data),
    update: (code: string, data: Partial<Subject>) => apiClient.patch<Subject>(`/api/subjects/${code}`, data),
    delete: (code: string) => apiClient.delete(`/api/subjects/${code}`),
  },

  // Timetable
  timetable: {
    get: (term?: number, schoolYear?: number) => {
      const params = new URLSearchParams();
      if (term) params.set('term', String(term));
      if (schoolYear) params.set('schoolYear', String(schoolYear));
      return apiClient.get<{ grid: Record<number, Record<number, TimetableCell>>; term: number; schoolYear: number }>(
        `/api/timetable?${params}`
      );
    },
    updateCell: (term: number, schoolYear: number, day: number, period: number, data: Partial<TimetableCell>) =>
      apiClient.put(`/api/timetable/${term}/${schoolYear}/${day}/${period}`, data),
    // OCR import
    imports: () => apiClient.get<{ imports: any[] }>('/api/timetable/imports'),
    getImport: (id: string) => apiClient.get<any>(`/api/timetable/imports/${id}`),
    confirmImport: (id: string, grid?: any, forceOverwrite?: boolean) =>
      apiClient.post(`/api/timetable/imports/${id}/confirm`, { grid, forceOverwrite }),
    rejectImport: (id: string) => apiClient.post(`/api/timetable/imports/${id}/reject`),
  },

  // Announcements
  announcements: {
    list: () => apiClient.get<{ announcements: Announcement[] }>('/api/announcements'),
    create: (data: Partial<Announcement>) => apiClient.post<Announcement>('/api/announcements', data),
    update: (id: string, data: Partial<Announcement>) => apiClient.patch<Announcement>(`/api/announcements/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/announcements/${id}`),
  },

  // Calendar
  calendar: {
    get: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiClient.get<{ events: any[] }>(`/api/calendar?${params}`);
    },
  },

  // Analytics
  analytics: {
    me: () => apiClient.get<Analytics>('/api/analytics/me'),
    class: () => apiClient.get<ClassAnalytics>('/api/analytics/class'),
    exportUrl: (type: string) => `/api/analytics/export?type=${type}`,
  },

  // Teacher
  teacher: {
    users: () => apiClient.get<{ users: any[] }>('/api/teacher/users'),
    createUser: (data: { firstName: string; lastName: string; studentId: string; password: string }) =>
      apiClient.post('/api/teacher/users', data),
    updateUser: (studentId: string, data: Partial<{ firstName: string; lastName: string; isActive: boolean }>) =>
      apiClient.patch(`/api/teacher/users/${studentId}`, data),
    deleteUser: (studentId: string) => apiClient.delete(`/api/teacher/users/${studentId}`),
    createPresident: (studentId: string) => apiClient.post('/api/teacher/presidents', { studentId }),
    revokePresident: (studentId: string) => apiClient.delete(`/api/teacher/presidents/${studentId}`),
    presidents: () => apiClient.get<{ presidents: any[] }>('/api/teacher/presidents'),
  },

  // Push notifications
  push: {
    vapidPublicKey: () => apiClient.get<{ publicKey: string }>('/api/push/vapid-public-key'),
    subscribe: (subscription: PushSubscription) =>
      apiClient.post('/api/push/subscribe', subscription.toJSON()),
    unsubscribe: (endpoint: string) =>
      apiClient.delete('/api/push/subscribe'),
  },
};

export { ApiError };
