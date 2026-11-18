export interface AuthUser {
  userId: number;
  fullName: string;
  fullNameAr?: string;
  username: string;
  email: string;
  role: 'PMO Manager' | 'Project Manager' | 'Team Member';
  token: string;
}

export interface UserRecord {
  id: number;
  fullName: string;
  fullNameAr?: string;
  email: string;
  username: string;
  roleId: number;
  roleName: string;
  roleDescription?: string;
  roleDescriptionAr?: string;
  isActive: boolean;
}

export interface Department {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  responsibleManagerId?: number | null;
  responsibleManagerName?: string | null;
  responsibleManagerNameAr?: string | null;
  isActive: boolean;
  portfolioCount: number;
  initiativeCount: number;
}

export interface Portfolio {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  targetDate?: string;
  status: string;
  initiativeCount: number;
}

export interface Initiative {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  departmentId: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  portfolioId: number;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  progressPercentage: number;
  projectCount: number;
}

export interface Project {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  initiativeId: number;
  initiativeName?: string | null;
  initiativeNameAr?: string | null;
  portfolioId?: number | null;
  portfolioName?: string | null;
  portfolioNameAr?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  projectManagerId: number | null;
  projectManagerName?: string | null;
  projectManagerNameAr?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  targetDate?: string;
  status: string;
  priority: string;
  progressPercentage: number;
  workstreamCount: number;
  milestoneCount: number;
  activityCount: number;
  overdueActivityCount: number;
}

export interface Workstream {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
  projectNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  progressPercentage: number;
  activityCount: number;
  milestoneCount: number;
}

export interface Milestone {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
  projectNameAr?: string | null;
  workstreamId: number | null;
  workstreamName?: string | null;
  workstreamNameAr?: string | null;
  ownerId: number | null;
  ownerName?: string | null;
  ownerNameAr?: string | null;
  plannedDate: string;
  actualDate: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Delayed';
  isDelayed: boolean;
  linkedActivityCount: number;
}

export interface TaskDependency {
  id: number;
  predecessorTaskId: number;
  predecessorTaskName: string;
  predecessorTaskNameAr?: string;
  predecessorStatus: string;
  successorTaskId: number;
  successorTaskName: string;
  successorTaskNameAr?: string;
  successorStatus: string;
  projectId: number;
  dependencyType: string;
}

export interface Activity {
  id: number;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  projectId: number;
  projectName?: string | null;
  projectNameAr?: string | null;
  initiativeId?: number | null;
  initiativeName?: string | null;
  initiativeNameAr?: string | null;
  workstreamId: number | null;
  workstreamName?: string | null;
  workstreamNameAr?: string | null;
  milestoneId: number | null;
  milestoneName?: string | null;
  milestoneNameAr?: string | null;
  parentActivityId: number | null;
  parentActivityName?: string | null;
  parentActivityNameAr?: string | null;
  assignedUserId: number | null;
  assignedUserName?: string | null;
  assignedUserNameAr?: string | null;
  startDate: string;
  dueDate: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  priority: string;
  progressPercentage: number;
  isOverdue: boolean;
  subtaskCount: number;
  completedSubtaskCount: number;
  subtasks: Activity[];
  predecessors: TaskDependency[];
  successors: TaskDependency[];
}

export interface DashboardSummary {
  totalDepartments: number;
  totalPortfolios: number;
  totalInitiatives: number;
  totalProjects: number;
  totalActivities: number;
  activeProjects: number;
  completedProjects: number;
  overdueActivities: number;
  projectsByStatus: { status: string; count: number }[];
  initiativesByDepartment: { departmentName: string; departmentNameAr?: string; count: number }[];

  // Planning & Execution Metrics
  totalWorkstreams: number;
  totalMilestones: number;
  totalSubtasks: number;
  totalDependencies: number;
  projectsWithOverdueActivities: Project[];
  upcomingMilestones: Milestone[];
  activitiesByStatus: { status: string; count: number }[];
  activitiesByWorkstream: {
    workstreamName: string;
    workstreamNameAr?: string;
    projectName: string;
    projectNameAr?: string;
    count: number;
  }[];
  milestonesByStatus: { status: string; count: number }[];
  projectsApproachingEndDate: Project[];
}

export interface SourceFile {
  path: string;
  content: string;
}
