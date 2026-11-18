// Types and Data Models for PMO Management Enterprise Module (pmo_management)
import { Language } from '../i18n';

export type PmoViewType = 'dashboard' | 'kanban' | 'single-page-projects' | 'master-tasks';
export type MasterTaskViewMode = 'list' | 'kanban' | 'gantt' | 'calendar' | 'map' | 'pivot' | 'dashboard';
export type SinglePageViewMode = 'projects' | 'high-risk-initiatives';
export type ProjectHealth = 'On Track' | 'At Risk' | 'Delayed' | 'Completed';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type ItemType = 'Workstream' | 'Milestone' | 'Activity';

export interface MultiLangText {
  en: string;
  ar: string;
}

export interface PmoProjectEnriched {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName: string;
  departmentNameAr?: string;
  portfolioId: number | null;
  portfolioName: string;
  portfolioNameAr?: string;
  initiativeId: number;
  initiativeName: string;
  initiativeNameAr?: string;
  strategicGoalId?: string;
  strategicGoalTitle?: string;
  strategicGoalTitleAr?: string;
  clientOrganization: string;
  clientOrganizationAr?: string;
  projectManagerId: number | null;
  projectManagerName: string;
  projectManagerNameAr?: string;
  projectManagerAvatar?: string;
  startDate: string;
  endDate: string;
  status: string;
  healthStatus: ProjectHealth;
  riskLevel: RiskLevel;
  priority: string;
  actualProgressPercentage: number;
  plannedProgressPercentage: number;
  variancePercentage: number; // actual - planned
  availableBudget: number;
  spentBudget: number;
  workstreamCount: number;
  milestoneCount: number;
  activityCount: number;
  overdueActivityCount: number;
  delayFlags: number;
  isDelayed: boolean;
  openTasksCount: number;
  siteLocation?: string;
  siteLocationAr?: string;
  siteCoordinates?: { lat: number; lng: number };
}

export interface PmoInitiativeEnriched {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName: string;
  departmentNameAr?: string;
  portfolioId: number;
  portfolioName: string;
  portfolioNameAr?: string;
  strategicGoalId?: string;
  strategicGoalTitle?: string;
  strategicGoalTitleAr?: string;
  clientOrganization: string;
  clientOrganizationAr?: string;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  actualProgressPercentage: number;
  plannedProgressPercentage: number;
  variancePercentage: number;
  totalBudget: number;
  spentBudget: number;
  healthStatus: ProjectHealth;
  riskLevel: RiskLevel;
  linkedProjectsCount: number;
  overdueTasksCount: number;
  delayFlagsCount: number;
}

export interface DepartmentKanbanGroup {
  id: number;
  name: string;
  nameAr: string;
  code: string;
  leadName: string;
  leadNameAr: string;
  leadRole: string;
  leadAvatar?: string;
  healthStatus: ProjectHealth;
  progressPercentage: number;
  metrics: {
    initiativesCount: number;
    projectsCount: number;
    milestonesCount: number;
    tasksCount: number;
    workstreamsCount: number;
    overdueItemsCount: number;
  };
  totalBudget: number;
  allocatedProjects: PmoProjectEnriched[];
}

export interface MasterTaskItem {
  id: number;
  uniqueKey: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  itemType: ItemType;
  projectId: number;
  projectName: string;
  projectNameAr?: string;
  subtaskParentName?: string | null;
  subtaskParentNameAr?: string | null;
  departmentId: number;
  departmentName: string;
  departmentNameAr?: string;
  assigneeId: number | null;
  assigneeName: string;
  assigneeNameAr?: string;
  assigneeRole?: string;
  assigneeAvatar?: string;
  startDate: string;
  dueDate: string;
  plannedProgress: number;
  actualProgress: number;
  variancePercentage: number;
  baselineHealth: 'Ahead' | 'On Track' | 'Behind' | 'Critical Delay';
  approvalStatus: 'Draft' | 'Approved' | 'Pending Review';
  priorityStars: 1 | 2 | 3; // 1-3 Stars
  isStarred: boolean;
  stage: 'Planning' | 'Execution' | 'Review' | 'Completed';
  nextActivityReminder?: string;
  nextActivityReminderAr?: string;
  locationName?: string;
  locationNameAr?: string;
  coordinates?: { lat: number; lng: number };
}

export interface PmoExecutiveDashboardKpis {
  totalProjects: number;
  totalInitiatives: number;
  totalDepartments: number;
  actualProgressPercentage: number;
  plannedProgressPercentage: number;
  delayFlagsCount: number;
  overdueProjectsCount: number;
  pendingApprovalsCount: number;
  highRiskProjectsCount: number;
  openRisksAndIssuesRatio: string; // e.g. "8 / 12 (67%)"
  healthDistribution: {
    onTrack: number;
    atRisk: number;
    delayed: number;
    completed: number;
  };
  openItemsByType: {
    milestones: number;
    tasks: number;
    workstreams: number;
  };
  upcomingMilestones30Days: Array<{
    id: number;
    name: string;
    nameAr?: string;
    projectName: string;
    projectNameAr?: string;
    dueDate: string;
    ownerName: string;
    ownerNameAr?: string;
    status: string;
    isDelayed: boolean;
  }>;
}
