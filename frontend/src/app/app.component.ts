import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PmoApiService } from './services/pmo-api.service';
import {
  Activity,
  AuthResponse,
  DashboardSummary,
  Department,
  Initiative,
  Milestone,
  Portfolio,
  Project,
  TaskDependency,
  User,
  Workstream
} from './models/pmo.models';

type ViewSection =
  | 'dashboard'
  | 'hierarchy'
  | 'project-workspace'
  | 'departments'
  | 'portfolios'
  | 'initiatives'
  | 'projects'
  | 'workstreams'
  | 'milestones'
  | 'activities';

type WorkspaceTab =
  | 'overview'
  | 'workstreams'
  | 'milestones'
  | 'activities'
  | 'gantt'
  | 'calendar'
  | 'board';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  currentUser: AuthResponse | null = null;
  loginUsername = 'pmo.admin';
  loginPassword = 'Pass123!';
  loginError = '';
  lang: 'en' | 'ar' = 'en';

  activeView: ViewSection = 'dashboard';
  workspaceTab: WorkspaceTab = 'overview';
  activeProjectId = 1;

  dashboard: DashboardSummary | null = null;
  users: User[] = [];
  departments: Department[] = [];
  portfolios: Portfolio[] = [];
  initiatives: Initiative[] = [];
  projects: Project[] = [];
  workstreams: Workstream[] = [];
  milestones: Milestone[] = [];
  activities: Activity[] = [];
  dependencies: TaskDependency[] = [];

  // Search and Filter state
  searchQuery = '';
  statusFilter = 'All';
  workstreamFilter = 0;
  milestoneFilter = 0;
  assignedUserFilter = 0;
  priorityFilter = 'All';
  sortField: 'dueDate' | 'priority' | 'status' | 'progress' = 'dueDate';

  // Calendar Month State (Default October 2026 to match active execution window)
  calendarYear = 2026;
  calendarMonth = 9; // 0-indexed (9 = October)

  // Dependency form state
  newPredecessorId = 0;
  newSuccessorId = 0;
  dependencyError = '';

  constructor(private api: PmoApiService) {}

  ngOnInit(): void {
    const savedLang = localStorage.getItem('pmo_lang');
    if (savedLang === 'ar' || savedLang === 'en') {
      this.setLanguage(savedLang);
    }
    const saved = localStorage.getItem('pmo_auth_user');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      this.loadAllData();
    }
  }

  setLanguage(l: 'en' | 'ar'): void {
    this.lang = l;
    localStorage.setItem('pmo_lang', l);
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = l;
  }

  onLogin(): void {
    this.loginError = '';
    this.api.login(this.loginUsername, this.loginPassword).subscribe({
      next: (res) => {
        this.currentUser = res;
        localStorage.setItem('pmo_auth_user', JSON.stringify(res));
        this.loadAllData();
      },
      error: () => {
        this.loginError = 'Invalid username or password.';
      }
    });
  }

  onLogout(): void {
    this.currentUser = null;
    localStorage.removeItem('pmo_auth_user');
  }

  setView(view: ViewSection): void {
    this.activeView = view;
    this.searchQuery = '';
    this.statusFilter = 'All';
    this.loadAllData();
  }

  openProjectWorkspace(project: Project, tab: WorkspaceTab = 'overview'): void {
    this.activeProjectId = project.id;
    this.workspaceTab = tab;
    this.activeView = 'project-workspace';
  }

  get activeProject(): Project | undefined {
    return this.projects.find((p) => p.id === Number(this.activeProjectId));
  }

  get projectWorkstreams(): Workstream[] {
    return this.workstreams.filter((w) => w.projectId === Number(this.activeProjectId));
  }

  get projectMilestones(): Milestone[] {
    return this.milestones.filter((m) => m.projectId === Number(this.activeProjectId));
  }

  get projectParentActivities(): Activity[] {
    let list = this.activities.filter(
      (a) => a.projectId === Number(this.activeProjectId) && !a.parentActivityId
    );
    if (this.workstreamFilter > 0) {
      list = list.filter((a) => a.workstreamId === Number(this.workstreamFilter));
    }
    if (this.milestoneFilter > 0) {
      list = list.filter((a) => a.milestoneId === Number(this.milestoneFilter));
    }
    if (this.assignedUserFilter > 0) {
      list = list.filter((a) => a.assignedUserId === Number(this.assignedUserFilter));
    }
    if (this.statusFilter !== 'All') {
      list = list.filter((a) => a.status === this.statusFilter);
    }
    if (this.priorityFilter !== 'All') {
      list = list.filter((a) => a.priority === this.priorityFilter);
    }
    return list.sort((a, b) => {
      if (this.sortField === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
      if (this.sortField === 'progress') return b.progressPercentage - a.progressPercentage;
      if (this.sortField === 'status') return a.status.localeCompare(b.status);
      return a.priority.localeCompare(b.priority);
    });
  }

  getSubtasksForParent(parentId: number): Activity[] {
    return this.activities.filter((a) => a.parentActivityId === parentId);
  }

  get projectDependencies(): TaskDependency[] {
    const projectTaskIds = new Set(
      this.activities.filter((a) => a.projectId === Number(this.activeProjectId)).map((a) => a.id)
    );
    return this.dependencies.filter(
      (d) => projectTaskIds.has(d.predecessorTaskId) || projectTaskIds.has(d.successorTaskId)
    );
  }

  loadAllData(): void {
    this.api.getDashboardSummary().subscribe((d) => (this.dashboard = d));
    this.api.getUsers().subscribe((u) => (this.users = u));
    this.api.getDepartments(this.searchQuery).subscribe((d) => (this.departments = d));
    this.api.getPortfolios(this.searchQuery, this.statusFilter).subscribe((p) => (this.portfolios = p));
    this.api.getInitiatives(this.searchQuery, this.statusFilter).subscribe((i) => (this.initiatives = i));
    this.api.getProjects(this.searchQuery, this.statusFilter).subscribe((pr) => (this.projects = pr));
    this.api.getWorkstreams(undefined, this.statusFilter, this.searchQuery).subscribe((w) => (this.workstreams = w));
    this.api.getMilestones(undefined, undefined, this.statusFilter, this.searchQuery).subscribe((m) => (this.milestones = m));
    this.api.getActivities(this.searchQuery, this.statusFilter).subscribe((a) => (this.activities = a));
    this.api.getDependencies().subscribe((dep) => (this.dependencies = dep));
  }

  moveKanbanActivity(activity: Activity, newStatus: 'Not Started' | 'In Progress' | 'Completed'): void {
    const progress = newStatus === 'Completed' ? 100 : newStatus === 'Not Started' ? 0 : 50;
    this.api
      .updateActivity(activity.id, {
        ...activity,
        status: newStatus,
        progressPercentage: progress
      })
      .subscribe(() => this.loadAllData());
  }

  toggleSubtaskCompletion(subtask: Activity): void {
    const nextStatus = subtask.status === 'Completed' ? 'In Progress' : 'Completed';
    const nextProgress = nextStatus === 'Completed' ? 100 : 50;
    this.api
      .updateActivity(subtask.id, {
        ...subtask,
        status: nextStatus,
        progressPercentage: nextProgress
      })
      .subscribe(() => this.loadAllData());
  }

  addDependency(): void {
    this.dependencyError = '';
    if (!this.newPredecessorId || !this.newSuccessorId) {
      this.dependencyError = 'Select both predecessor and successor tasks.';
      return;
    }
    this.api
      .createDependency({
        predecessorTaskId: Number(this.newPredecessorId),
        successorTaskId: Number(this.newSuccessorId),
        dependencyType: 'FinishToStart'
      })
      .subscribe({
        next: () => {
          this.newPredecessorId = 0;
          this.newSuccessorId = 0;
          this.loadAllData();
        },
        error: (err) => {
          this.dependencyError = err?.error?.message || 'Invalid dependency relationship.';
        }
      });
  }

  removeDependency(id: number): void {
    this.api.deleteDependency(id).subscribe(() => this.loadAllData());
  }

  // Gantt bar percentage calculation helper
  getGanttBarPosition(startStr: string, endStr: string): { left: string; width: string } {
    const proj = this.activeProject;
    if (!proj) return { left: '0%', width: '10%' };
    const pStart = new Date(proj.startDate).getTime();
    const pEnd = new Date(proj.endDate).getTime();
    const span = Math.max(1, pEnd - pStart);
    const s = Math.max(pStart, Math.min(pEnd, new Date(startStr).getTime()));
    const e = Math.max(s, Math.min(pEnd, new Date(endStr).getTime()));
    const leftPct = ((s - pStart) / span) * 100;
    const widthPct = Math.max(3, ((e - s) / span) * 100);
    return { left: `${leftPct.toFixed(1)}%`, width: `${widthPct.toFixed(1)}%` };
  }

  getMilestonePosition(dateStr: string): string {
    const proj = this.activeProject;
    if (!proj) return '0%';
    const pStart = new Date(proj.startDate).getTime();
    const pEnd = new Date(proj.endDate).getTime();
    const span = Math.max(1, pEnd - pStart);
    const d = Math.max(pStart, Math.min(pEnd, new Date(dateStr).getTime()));
    return `${(((d - pStart) / span) * 100).toFixed(1)}%`;
  }

  // Monthly Calendar Days Helper
  get calendarDays(): Array<{ day: number; dateStr: string; milestones: Milestone[]; activities: Activity[] }> {
    const daysInMonth = new Date(this.calendarYear, this.calendarMonth + 1, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(this.calendarMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${this.calendarYear}-${mStr}-${dStr}`;
      const dayMilestones = this.projectMilestones.filter((m) => m.plannedDate === dateStr);
      const dayActivities = this.projectParentActivities.filter(
        (a) => a.dueDate === dateStr || a.startDate === dateStr
      );
      result.push({ day: d, dateStr, milestones: dayMilestones, activities: dayActivities });
    }
    return result;
  }

  prevMonth(): void {
    if (this.calendarMonth === 0) {
      this.calendarMonth = 11;
      this.calendarYear--;
    } else {
      this.calendarMonth--;
    }
  }

  nextMonth(): void {
    if (this.calendarMonth === 11) {
      this.calendarMonth = 0;
      this.calendarYear++;
    } else {
      this.calendarMonth++;
    }
  }
}
