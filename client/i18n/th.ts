// i18n/th.ts — Thai language strings

export const th = {
  // App
  appName: 'Emble',
  appSubtitle: 'ระบบติดตามการบ้าน',

  // Auth
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  studentId: 'รหัสนักเรียน',
  password: 'รหัสผ่าน',
  loginWithDiscord: 'เข้าสู่ระบบด้วย Discord',
  loginError: 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง',
  loginRequired: 'กรุณาเข้าสู่ระบบเพื่อใช้งาน',
  discordNotLinked: 'บัญชี Discord นี้ยังไม่ได้เชื่อมกับข้อมูลนักเรียน กรุณาเข้าสู่ระบบด้วยรหัสนักเรียนก่อน',
  oauthError: 'เข้าสู่ระบบด้วย Discord ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
  discordLinked: 'เชื่อมบัญชี Discord สำเร็จ',
  discordLinkFailed: 'เชื่อมบัญชี Discord ไม่สำเร็จ (บัญชีนี้อาจถูกเชื่อมกับนักเรียนคนอื่นแล้ว)',
  welcome: 'ยินดีต้อนรับ',

  // Navigation
  overview: 'ภาพรวม',
  homework: 'การบ้าน',
  calendar: 'ปฏิทิน',
  timetable: 'ตารางเรียน',
  subjects: 'วิชา',
  announcements: 'ประกาศ',
  analytics: 'สถิติ',
  teacherArea: 'สำหรับครู',
  account: 'บัญชี',
  more: 'เพิ่มเติม',

  // Roles
  roleStudent: 'นักเรียน',
  rolePresident: 'ประธานห้อง',
  roleTeacher: 'ครู',

  // Homework
  addHomework: 'เพิ่มการบ้าน',
  editHomework: 'แก้ไขการบ้าน',
  deleteHomework: 'ลบการบ้าน',
  title: 'ชื่องาน',
  details: 'รายละเอียด',
  dueDate: 'กำหนดส่ง',
  assignDate: 'วันที่มอบหมาย',
  addedBy: 'เพิ่มโดย',
  subject: 'วิชา',
  status: 'สถานะ',
  search: 'ค้นหา',
  all: 'ทั้งหมด',
  pending: 'ยังไม่ส่ง',
  overdue: 'เลยกำหนด',
  completed: 'ส่งแล้ว',
  markComplete: 'ทำเครื่องหมายว่าส่งแล้ว',
  unmarkComplete: 'ยกเลิกการทำเครื่องหมาย',
  noHomework: 'ไม่มีการบ้านในขณะนี้',
  noResults: 'ไม่พบผลลัพธ์',
  imageUrl: 'URL รูปภาพ',
  link: 'ลิงก์',

  // Calendar
  today: 'วันนี้',
  noEvents: 'ไม่มีกิจกรรม',

  // Timetable
  period: 'คาบ',
  day1: 'จันทร์',
  day2: 'อังคาร',
  day3: 'พุธ',
  day4: 'พฤหัสบดี',
  day5: 'ศุกร์',
  free: 'ว่าง',
  importFromImage: 'นำเข้าจากรูปภาพ',
  editCell: 'แก้ไขคาบเรียน',
  cellType: 'ประเภท',
  lunch: 'พักกลางวัน',
  breakTime: 'พักเบรก',
  activity: 'กิจกรรม/โฮมรูม',
  selectSubject: 'เลือกวิชา',
  customLabel: 'ข้อความกำกับ',
  clearCell: 'ล้างเป็นคาบว่าง',
  uploadTimetableImage: 'อัปโหลดรูปภาพตารางเรียน',
  analyzingImage: 'กำลังวิเคราะห์รูปภาพด้วย OCR…',
  confirmImport: 'ยืนยันตารางเรียนที่สแกนได้',
  importTimetableTitle: 'นำเข้าตารางเรียน',
  tabPasteSheets: 'วางจาก Sheets / Excel (ฟรี 100%)',
  tabUploadImage: 'สแกนรูปภาพด้วย AI',
  pasteTimetableHint: 'คัดลอกตารางเรียนจาก Google Sheets หรือ Excel (เช่น คลุมช่องแล้วกด Ctrl+C / Cmd+C) แล้วกดวางลงในกล่องนี้',
  pastePlaceholder: 'วางตารางเรียนที่คัดลอกมาที่นี่ (Tab-separated หรือตารางจาก Google Sheets/Excel)...',
  parseAndPreview: 'วิเคราะห์ข้อมูลตาราง',
  geminiApiKeyLabel: 'Gemini API Key ฟรี (aistudio.google.com)',
  geminiKeyPlaceholder: 'AIzaSy... (สมัครฟรี ไม่ต้องกรอกบัตรเครดิต)',
  geminiKeyHelp: 'Google AI Studio ให้คีย์ฟรี 1,500 ครั้ง/วัน โดยไม่ต้องผูกบัตรเครดิต',

  // Subjects
  addSubject: 'เพิ่มวิชา',
  editSubject: 'แก้ไขวิชา',
  subjectCode: 'รหัสวิชา',
  subjectName: 'ชื่อวิชา',
  credits: 'หน่วยกิต',
  instructor: 'อาจารย์',
  needsReview: 'ต้องตรวจสอบ',
  noSubjects: 'ยังไม่มีวิชาในระบบ',

  // Announcements
  addAnnouncement: 'เพิ่มประกาศ',
  editAnnouncement: 'แก้ไขประกาศ',
  deleteAnnouncement: 'ลบประกาศ',
  body: 'เนื้อหา',
  priority: 'ความสำคัญ',
  pinned: 'ปักหมุด',
  publishDate: 'วันที่เผยแพร่',
  expiryDate: 'วันหมดอายุ',
  noAnnouncements: 'ไม่มีประกาศในขณะนี้',

  // Analytics
  completionRate: 'อัตราการส่ง',
  completedCount: 'ส่งแล้ว',
  pendingCount: 'ยังไม่ส่ง',
  upcoming: 'งานที่ใกล้ครบกำหนด',
  classAnalytics: 'สถิติของห้อง',
  perStudent: 'รายบุคคล',
  perSubject: 'รายวิชา',
  exportCSV: 'ส่งออก CSV',

  // Teacher
  manageUsers: 'จัดการผู้ใช้',
  provisionUser: 'เพิ่มผู้ใช้ใหม่',
  deactivateUser: 'ปิดการใช้งาน',
  appointPresident: 'แต่งตั้งประธานห้อง',
  revokePresident: 'ถอดประธานห้อง',
  firstName: 'ชื่อ',
  lastName: 'นามสกุล',
  isActive: 'ใช้งานอยู่',

  // Common
  save: 'บันทึก',
  cancel: 'ยกเลิก',
  delete: 'ลบ',
  edit: 'แก้ไข',
  close: 'ปิด',
  confirm: 'ยืนยัน',
  loading: 'กำลังโหลด…',
  error: 'เกิดข้อผิดพลาด',
  retry: 'ลองอีกครั้ง',
  create: 'สร้าง',
  update: 'อัปเดต',
  actions: 'การดำเนินการ',
  yes: 'ใช่',
  no: 'ไม่',
  none: 'ไม่มี',

  // Language
  language: 'ภาษา',
  thai: 'ไทย',
  english: 'English',

  // Push notifications
  notifications: 'การแจ้งเตือน',
  enableNotifications: 'เปิดการแจ้งเตือน',
  disableNotifications: 'ปิดการแจ้งเตือน',
  notificationsEnabled: 'การแจ้งเตือนเปิดอยู่',
  notificationsDisabled: 'การแจ้งเตือนปิดอยู่',
  notificationsUnsupported: 'เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือน',
};

export type TranslationKey = keyof typeof th;
