// Data models and TypeScript definitions for Strategic Planning module (strategic_planning)

export type PlanStatus = 'Draft' | 'Approved';
export type InitiativeStatus = 'Draft' | 'Approved';
export type ActivityStatus = 'Draft' | 'Approved';

export interface StrategicPerspective {
  id: string;
  name: string;
  nameEn?: string;
  weight: number; // percentage, e.g. 25
  description?: string;
  descriptionEn?: string;
}

export interface StrategicGoal {
  id: string;
  perspectiveId: string;
  perspectiveName?: string;
  perspectiveNameEn?: string;
  title: string;
  titleEn?: string;
  weight: number; // percentage
  code?: string;
  description?: string;
  descriptionEn?: string;
}

export interface SeminarCardDetails {
  organizer?: string;
  organizerEn?: string;
  venue?: string;
  venueEn?: string;
  sessionDate?: string;
  executiveSummary?: string;
  executiveSummaryEn?: string;
  strategicPillars?: string[];
  strategicPillarsEn?: string[];
  keyStakeholders?: string;
  keyStakeholdersEn?: string;
  kpiFramework?: string;
  kpiFrameworkEn?: string;
  budgetNotes?: string;
  budgetNotesEn?: string;
  notes?: string;
  notesEn?: string;
}

export interface StrategicPlan {
  id: number;
  titleAr: string;
  titleEn: string;
  cycle: string; // e.g. '2026 - 2030'
  yearsRange: string[]; // e.g. ['2026', '2027', '2028', '2029', '2030']
  planType: string; // e.g. 'خطة خمسية استراتيجية'
  planTypeEn?: string;
  vision: string;
  visionEn?: string;
  mission: string;
  missionEn?: string;
  description: string;
  descriptionEn?: string;
  strategicIssues: string[];
  strategicIssuesEn?: string[];
  values: string[];
  valuesEn?: string[];
  perspectives: StrategicPerspective[];
  goals: StrategicGoal[];
  seminarCard: SeminarCardDetails;
  status: PlanStatus;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface StrategicInitiative {
  id: number;
  title: string;
  titleEn?: string;
  code?: string;
  domains: string[];
  domainsEn?: string[];
  planId: number;
  planTitle?: string;
  planTitleAr?: string;
  planTitleEn?: string;
  departmentId: number;
  departmentName?: string;
  departmentNameEn?: string;
  departmentNameAr?: string;
  section: string;
  sectionEn?: string;
  planType: string;
  planTypeEn?: string;
  indicator: string;
  indicatorEn?: string;
  goalId: string;
  goalTitle?: string;
  goalTitleAr?: string;
  goalTitleEn?: string;
  perspectiveName?: string;
  perspectiveNameEn?: string;
  organizationUnit: string;
  organizationUnitEn?: string;
  cycle: string;
  years: string[];
  startDate: string;
  endDate: string;
  status: InitiativeStatus; // 'Draft' | 'Approved'
  totalActivitiesBudget?: number;
  activitiesCount?: number;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatterMessage {
  id: string;
  type: 'message' | 'internal_note' | 'audit_log';
  author: string;
  authorEn?: string;
  authorRole?: string;
  authorRoleEn?: string;
  content: string;
  contentEn?: string;
  timestamp: string;
}

export interface StrategicActivity {
  id: number;
  name: string;
  nameEn?: string;
  source: string;
  sourceEn?: string;
  domains: string[];
  domainsEn?: string[];
  indicator: string;
  indicatorEn?: string;
  initiativeId: number;
  initiativeTitle?: string;
  initiativeTitleAr?: string;
  initiativeTitleEn?: string;
  departmentId: number;
  departmentName?: string;
  departmentNameAr?: string;
  section: string;
  sectionEn?: string;
  startDate: string;
  endDate: string;
  targetValue: number;
  activityValue: number;
  isDevelopmentalProject: boolean;
  isExecutiveBodyActivity: boolean;
  status: ActivityStatus; // 'Draft' | 'Approved'
  customFields?: Record<string, any>;
  chatter: ChatterMessage[];
  createdAt: string;
  updatedAt: string;
}
