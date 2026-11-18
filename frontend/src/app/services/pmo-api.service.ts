import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
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
} from '../models/pmo.models';

@Injectable({
  providedIn: 'root'
})
export class PmoApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  // Authentication & Users
  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, { username, password });
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseUrl}/auth/users`);
  }

  // Dashboard
  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/dashboard`);
  }

  // Departments
  getDepartments(search?: string, isActive?: boolean): Observable<Department[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', String(isActive));
    return this.http.get<Department[]>(`${this.baseUrl}/departments`, { params });
  }

  createDepartment(payload: Partial<Department>): Observable<Department> {
    return this.http.post<Department>(`${this.baseUrl}/departments`, payload);
  }

  updateDepartment(id: number, payload: Partial<Department>): Observable<Department> {
    return this.http.put<Department>(`${this.baseUrl}/departments/${id}`, payload);
  }

  deleteDepartment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/departments/${id}`);
  }

  // Portfolios
  getPortfolios(search?: string, status?: string, departmentId?: number): Observable<Portfolio[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status && status !== 'All') params = params.set('status', status);
    if (departmentId) params = params.set('departmentId', String(departmentId));
    return this.http.get<Portfolio[]>(`${this.baseUrl}/portfolios`, { params });
  }

  createPortfolio(payload: Partial<Portfolio>): Observable<Portfolio> {
    return this.http.post<Portfolio>(`${this.baseUrl}/portfolios`, payload);
  }

  updatePortfolio(id: number, payload: Partial<Portfolio>): Observable<Portfolio> {
    return this.http.put<Portfolio>(`${this.baseUrl}/portfolios/${id}`, payload);
  }

  deletePortfolio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/portfolios/${id}`);
  }

  // Initiatives
  getInitiatives(search?: string, status?: string, portfolioId?: number, departmentId?: number): Observable<Initiative[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status && status !== 'All') params = params.set('status', status);
    if (portfolioId) params = params.set('portfolioId', String(portfolioId));
    if (departmentId) params = params.set('departmentId', String(departmentId));
    return this.http.get<Initiative[]>(`${this.baseUrl}/initiatives`, { params });
  }

  createInitiative(payload: Partial<Initiative>): Observable<Initiative> {
    return this.http.post<Initiative>(`${this.baseUrl}/initiatives`, payload);
  }

  updateInitiative(id: number, payload: Partial<Initiative>): Observable<Initiative> {
    return this.http.put<Initiative>(`${this.baseUrl}/initiatives/${id}`, payload);
  }

  deleteInitiative(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/initiatives/${id}`);
  }

  // Projects
  getProjects(search?: string, status?: string, initiativeId?: number): Observable<Project[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status && status !== 'All') params = params.set('status', status);
    if (initiativeId) params = params.set('initiativeId', String(initiativeId));
    return this.http.get<Project[]>(`${this.baseUrl}/projects`, { params });
  }

  createProject(payload: Partial<Project>): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/projects`, payload);
  }

  updateProject(id: number, payload: Partial<Project>): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/projects/${id}`, payload);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${id}`);
  }

  // Workstreams
  getWorkstreams(projectId?: number, status?: string, search?: string): Observable<Workstream[]> {
    let params = new HttpParams();
    if (projectId) params = params.set('projectId', String(projectId));
    if (status && status !== 'All') params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<Workstream[]>(`${this.baseUrl}/workstreams`, { params });
  }

  createWorkstream(payload: Partial<Workstream>): Observable<Workstream> {
    return this.http.post<Workstream>(`${this.baseUrl}/workstreams`, payload);
  }

  updateWorkstream(id: number, payload: Partial<Workstream>): Observable<Workstream> {
    return this.http.put<Workstream>(`${this.baseUrl}/workstreams/${id}`, payload);
  }

  deleteWorkstream(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/workstreams/${id}`);
  }

  // Milestones
  getMilestones(projectId?: number, workstreamId?: number, status?: string, search?: string): Observable<Milestone[]> {
    let params = new HttpParams();
    if (projectId) params = params.set('projectId', String(projectId));
    if (workstreamId) params = params.set('workstreamId', String(workstreamId));
    if (status && status !== 'All') params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<Milestone[]>(`${this.baseUrl}/milestones`, { params });
  }

  createMilestone(payload: Partial<Milestone>): Observable<Milestone> {
    return this.http.post<Milestone>(`${this.baseUrl}/milestones`, payload);
  }

  updateMilestone(id: number, payload: Partial<Milestone>): Observable<Milestone> {
    return this.http.put<Milestone>(`${this.baseUrl}/milestones/${id}`, payload);
  }

  deleteMilestone(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/milestones/${id}`);
  }

  // Activities & Subtasks
  getActivities(
    search?: string,
    status?: string,
    projectId?: number,
    workstreamId?: number,
    milestoneId?: number,
    assignedUserId?: number,
    priority?: string
  ): Observable<Activity[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (status && status !== 'All') params = params.set('status', status);
    if (projectId) params = params.set('projectId', String(projectId));
    if (workstreamId) params = params.set('workstreamId', String(workstreamId));
    if (milestoneId) params = params.set('milestoneId', String(milestoneId));
    if (assignedUserId) params = params.set('assignedUserId', String(assignedUserId));
    if (priority && priority !== 'All') params = params.set('priority', priority);
    return this.http.get<Activity[]>(`${this.baseUrl}/activities`, { params });
  }

  createActivity(payload: Partial<Activity>): Observable<Activity> {
    return this.http.post<Activity>(`${this.baseUrl}/activities`, payload);
  }

  updateActivity(id: number, payload: Partial<Activity>): Observable<Activity> {
    return this.http.put<Activity>(`${this.baseUrl}/activities/${id}`, payload);
  }

  deleteActivity(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/activities/${id}`);
  }

  // Task Dependencies
  getDependencies(projectId?: number): Observable<TaskDependency[]> {
    let params = new HttpParams();
    if (projectId) params = params.set('projectId', String(projectId));
    return this.http.get<TaskDependency[]>(`${this.baseUrl}/dependencies`, { params });
  }

  createDependency(predecessorTaskId: number, successorTaskId: number, dependencyType = 'FinishToStart'): Observable<TaskDependency> {
    return this.http.post<TaskDependency>(`${this.baseUrl}/dependencies`, {
      predecessorTaskId,
      successorTaskId,
      dependencyType
    });
  }

  deleteDependency(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/dependencies/${id}`);
  }
}
