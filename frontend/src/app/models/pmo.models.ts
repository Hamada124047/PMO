export interface AuthResponse {
  userId: number;
  fullName: string;
  username: string;
  email: string;
  role: 'PMO Manager' | 'Project Manager' | 'Team Member';
  token: string;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  username: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
}

export interface Department {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  portfolioCount: number;
  initiativeCount: number;
}

export interface Portfolio {
  id: number;
  name: string;
  description?: string;
  departmentId?: number | null;
  departmentName?: string;
  ownerId?: number | null;
  ownerName?: string;
  startDate: string;
  endDate: string;
  status: string;
  initiativeCount: number;
}

export interface Initiative {
  id: number;
  name: string;
  description?: string;
  departmentId?: number | null;
  departmentName?: string;
  portfolioId: number;
  portfolioName?: string;
  ownerId?: number | null;
  ownerName?: string;
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
  description?: string;
  initiativeId: number;
  initiativeName?: string;
  portfolioId?: number;
  portfolioName?: string;
  departmentId?: number;
  departmentName?: string;
  projectManagerId?: number | null;
  projectManagerName?: string;
  startDate: string;
  endDate: string;
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
  description?: string;
  projectId: number;
  projectName?: string;
  ownerId?: number | null;
  ownerName?: string;
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
  description?: string;
  projectId: number;
  projectName?: string;
  workstreamId?: number | null;
  workstreamName?: string;
  ownerId?: number | null;
  ownerName?: string;
  plannedDate: string;
  actualDate?: string | null;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Delayed';
  isDelayed: boolean;
  linkedActivityCount: number;
}

export interface TaskDependency {
  id: number;
  predecessorTaskId: number;
  predecessorTaskName: string;
  predecessorStatus: string;
  successorTaskId: number;
  successorTaskName: string;
  successorStatus: string;
  projectId: number;
  dependencyType: string;
}

export interface Activity {
  id: number;
  name: string;
  description?: string;
  projectId: number;
  projectName?: string;
  initiativeId?: number;
  initiativeName?: string;
  workstreamId?: number | null;
  workstreamName?: string;
  milestoneId?: number | null;
  milestoneName?: string;
  parentActivityId?: number | null;
  parentActivityName?: string;
  assignedUserId?: number | null;
  assignedUserName?: string;
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
  initiativesByDepartment: { departmentName: string; count: number }[];

  // Planning & Execution Metrics
  totalWorkstreams: number;
  totalMilestones: number;
  totalSubtasks: number;
  totalDependencies: number;
  projectsWithOverdueActivities: Project[];
  upcomingMilestones: Milestone[];
  activitiesByStatus: { status: string; count: number }[];
  activitiesByWorkstream: { workstreamName: string; projectName: string; count: number }[];
  milestonesByStatus: { status: string; count: number }[];
  projectsApproachingEndDate: Project[];
}
