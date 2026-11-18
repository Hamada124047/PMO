using Microsoft.EntityFrameworkCore;
using PmoSystem.Api.Data;
using PmoSystem.Api.DTOs;
using PmoSystem.Api.Models;

namespace PmoSystem.Api.Services;

public interface IPmoService
{
    Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request);
    Task<List<UserDto>> GetUsersAsync();
    Task<DashboardSummaryDto> GetDashboardSummaryAsync();

    // Departments
    Task<List<DepartmentDto>> GetDepartmentsAsync(string? search, bool? isActive);
    Task<DepartmentDto?> GetDepartmentByIdAsync(int id);
    Task<DepartmentDto> CreateDepartmentAsync(SaveDepartmentDto dto);
    Task<DepartmentDto?> UpdateDepartmentAsync(int id, SaveDepartmentDto dto);
    Task<bool> DeleteDepartmentAsync(int id);

    // Portfolios
    Task<List<PortfolioDto>> GetPortfoliosAsync(string? search, string? status, int? departmentId);
    Task<PortfolioDto?> GetPortfolioByIdAsync(int id);
    Task<PortfolioDto> CreatePortfolioAsync(SavePortfolioDto dto);
    Task<PortfolioDto?> UpdatePortfolioAsync(int id, SavePortfolioDto dto);
    Task<bool> DeletePortfolioAsync(int id);

    // Initiatives
    Task<List<InitiativeDto>> GetInitiativesAsync(string? search, string? status, int? portfolioId, int? departmentId);
    Task<InitiativeDto?> GetInitiativeByIdAsync(int id);
    Task<InitiativeDto> CreateInitiativeAsync(SaveInitiativeDto dto);
    Task<InitiativeDto?> UpdateInitiativeAsync(int id, SaveInitiativeDto dto);
    Task<bool> DeleteInitiativeAsync(int id);

    // Projects
    Task<List<ProjectDto>> GetProjectsAsync(string? search, string? status, int? initiativeId);
    Task<ProjectDto?> GetProjectByIdAsync(int id);
    Task<ProjectDto> CreateProjectAsync(SaveProjectDto dto);
    Task<ProjectDto?> UpdateProjectAsync(int id, SaveProjectDto dto);
    Task<bool> DeleteProjectAsync(int id);
    Task RecalculateProjectProgressAsync(int projectId);

    // Workstreams
    Task<List<WorkstreamDto>> GetWorkstreamsAsync(int? projectId, string? status, string? search);
    Task<WorkstreamDto?> GetWorkstreamByIdAsync(int id);
    Task<WorkstreamDto> CreateWorkstreamAsync(SaveWorkstreamDto dto);
    Task<WorkstreamDto?> UpdateWorkstreamAsync(int id, SaveWorkstreamDto dto);
    Task<bool> DeleteWorkstreamAsync(int id);

    // Milestones
    Task<List<MilestoneDto>> GetMilestonesAsync(int? projectId, int? workstreamId, string? status, string? search);
    Task<MilestoneDto?> GetMilestoneByIdAsync(int id);
    Task<MilestoneDto> CreateMilestoneAsync(SaveMilestoneDto dto);
    Task<MilestoneDto?> UpdateMilestoneAsync(int id, SaveMilestoneDto dto);
    Task<bool> DeleteMilestoneAsync(int id);

    // Activities & Subtasks
    Task<List<ActivityDto>> GetActivitiesAsync(
        string? search,
        string? status,
        int? projectId,
        int? workstreamId,
        int? milestoneId,
        int? assignedUserId,
        string? priority,
        bool includeSubtasksFlat = true);
    Task<ActivityDto?> GetActivityByIdAsync(int id);
    Task<ActivityDto> CreateActivityAsync(SaveActivityDto dto);
    Task<ActivityDto?> UpdateActivityAsync(int id, SaveActivityDto dto);
    Task<bool> DeleteActivityAsync(int id);

    // Task Dependencies
    Task<List<TaskDependencyDto>> GetDependenciesAsync(int? projectId);
    Task<(TaskDependencyDto? Result, string? ErrorMessage)> CreateDependencyAsync(SaveTaskDependencyDto dto);
    Task<bool> DeleteDependencyAsync(int id);
}

public class PmoService : IPmoService
{
    private readonly PmoDbContext _context;

    public PmoService(PmoDbContext context)
    {
        _context = context;
    }

    public async Task<AuthResponseDto?> AuthenticateAsync(LoginRequestDto request)
    {
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u =>
                (u.Username.ToLower() == request.Username.ToLower() || u.Email.ToLower() == request.Username.ToLower()) &&
                u.PasswordHash == request.Password &&
                u.IsActive);

        if (user == null)
            return null;

        var token = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{user.Id}:{user.Username}:{user.Role?.Name}:{DateTime.UtcNow.Ticks}"));

        return new AuthResponseDto(
            user.Id,
            user.FullName,
            user.Username,
            user.Email,
            user.Role?.Name ?? "Team Member",
            token
        );
    }

    public async Task<List<UserDto>> GetUsersAsync()
    {
        return await _context.Users
            .Include(u => u.Role)
            .OrderBy(u => u.FullName)
            .Select(u => new UserDto(
                u.Id,
                u.FullName,
                u.Email,
                u.Username,
                u.RoleId,
                u.Role != null ? u.Role.Name : "Team Member",
                u.IsActive
            ))
            .ToListAsync();
    }

    // ==================== PROGRESS ROLL-UP CALCULATION ====================
    public async Task RecalculateProjectProgressAsync(int projectId)
    {
        var allProjectActivities = await _context.Activities
            .Where(a => a.ProjectId == projectId)
            .ToListAsync();

        var parentTasks = allProjectActivities.Where(a => a.ParentActivityId == null).ToList();
        var subtasksByParent = allProjectActivities
            .Where(a => a.ParentActivityId != null)
            .GroupBy(a => a.ParentActivityId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        // 1. Update each parent task progress based on its subtasks
        foreach (var parent in parentTasks)
        {
            if (subtasksByParent.TryGetValue(parent.Id, out var subs) && subs.Count > 0)
            {
                var avgSubProgress = (int)Math.Round(subs.Average(s => s.ProgressPercentage));
                parent.ProgressPercentage = avgSubProgress;
                if (subs.All(s => s.Status == "Completed"))
                    parent.Status = "Completed";
                else if (subs.Any(s => s.Status == "In Progress" || s.Status == "Completed"))
                    parent.Status = "In Progress";
                else
                    parent.Status = "Not Started";
            }
        }

        // 2. Update Workstream progress from top-level activities in that workstream
        var workstreams = await _context.Workstreams
            .Where(w => w.ProjectId == projectId)
            .ToListAsync();

        foreach (var ws in workstreams)
        {
            var wsTasks = parentTasks.Where(a => a.WorkstreamId == ws.Id).ToList();
            if (wsTasks.Count > 0)
            {
                ws.ProgressPercentage = (int)Math.Round(wsTasks.Average(t => t.ProgressPercentage));
                if (ws.ProgressPercentage == 100) ws.Status = "Completed";
                else if (ws.ProgressPercentage > 0 && ws.Status == "Planned") ws.Status = "In Progress";
            }
        }

        // 3. Update overall Project progress from top-level activities
        var project = await _context.Projects.FindAsync(projectId);
        if (project != null && parentTasks.Count > 0)
        {
            project.ProgressPercentage = (int)Math.Round(parentTasks.Average(t => t.ProgressPercentage));
        }

        await _context.SaveChangesAsync();
    }

    // ==================== DASHBOARD SUMMARY ====================
    public async Task<DashboardSummaryDto> GetDashboardSummaryAsync()
    {
        var today = DateTime.UtcNow.Date;
        var soonThreshold = today.AddDays(45);

        var totalDepartments = await _context.Departments.CountAsync();
        var totalPortfolios = await _context.Portfolios.CountAsync();
        var totalInitiatives = await _context.Initiatives.CountAsync();
        var totalProjects = await _context.Projects.CountAsync();
        var totalActivities = await _context.Activities.CountAsync(a => a.ParentActivityId == null);

        var totalWorkstreams = await _context.Workstreams.CountAsync();
        var totalMilestones = await _context.Milestones.CountAsync();
        var totalSubtasks = await _context.Activities.CountAsync(a => a.ParentActivityId != null);
        var totalDependencies = await _context.TaskDependencies.CountAsync();

        var activeProjects = await _context.Projects.CountAsync(p => p.Status == "In Progress" || p.Status == "Active");
        var completedProjects = await _context.Projects.CountAsync(p => p.Status == "Completed");
        var overdueActivities = await _context.Activities.CountAsync(a => a.Status != "Completed" && a.DueDate < today);

        var projectsByStatus = await _context.Projects
            .GroupBy(p => p.Status)
            .Select(g => new StatusCountDto(g.Key, g.Count()))
            .ToListAsync();

        var initiativesByDept = await _context.Departments
            .Select(d => new DepartmentCountDto(d.Name, d.Initiatives.Count))
            .ToListAsync();

        var allProjects = await GetProjectsAsync(null, null, null);
        var projectsWithOverdue = allProjects.Where(p => p.OverdueActivityCount > 0).ToList();
        var projectsApproachingEnd = allProjects
            .Where(p => p.Status != "Completed" && DateTime.Parse(p.EndDate) >= today && DateTime.Parse(p.EndDate) <= soonThreshold)
            .OrderBy(p => p.EndDate)
            .ToList();

        var allMilestones = await GetMilestonesAsync(null, null, null, null);
        var upcomingMilestones = allMilestones
            .Where(m => m.Status != "Completed")
            .OrderBy(m => m.PlannedDate)
            .Take(6)
            .ToList();

        var activitiesByStatus = await _context.Activities
            .GroupBy(a => a.Status)
            .Select(g => new StatusCountDto(g.Key, g.Count()))
            .ToListAsync();

        var activitiesByWorkstream = await _context.Workstreams
            .Include(w => w.Project)
            .Select(w => new WorkstreamCountDto(
                w.Name,
                w.Project != null ? w.Project.Name : "",
                w.Activities.Count(a => a.ParentActivityId == null)
            ))
            .ToListAsync();

        var milestonesByStatus = await _context.Milestones
            .GroupBy(m => m.Status)
            .Select(g => new StatusCountDto(g.Key, g.Count()))
            .ToListAsync();

        return new DashboardSummaryDto(
            totalDepartments,
            totalPortfolios,
            totalInitiatives,
            totalProjects,
            totalActivities,
            activeProjects,
            completedProjects,
            overdueActivities,
            projectsByStatus,
            initiativesByDept,
            totalWorkstreams,
            totalMilestones,
            totalSubtasks,
            totalDependencies,
            projectsWithOverdue,
            upcomingMilestones,
            activitiesByStatus,
            activitiesByWorkstream,
            milestonesByStatus,
            projectsApproachingEnd
        );
    }

    // ==================== DEPARTMENTS ====================
    public async Task<List<DepartmentDto>> GetDepartmentsAsync(string? search, bool? isActive)
    {
        var query = _context.Departments.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(s) || (d.Description != null && d.Description.ToLower().Contains(s)));
        }

        if (isActive.HasValue)
        {
            query = query.Where(d => d.IsActive == isActive.Value);
        }

        return await query
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto(
                d.Id,
                d.Name,
                d.Description,
                d.IsActive,
                d.Portfolios.Count,
                d.Initiatives.Count
            ))
            .ToListAsync();
    }

    public async Task<DepartmentDto?> GetDepartmentByIdAsync(int id)
    {
        return await _context.Departments
            .Where(d => d.Id == id)
            .Select(d => new DepartmentDto(
                d.Id,
                d.Name,
                d.Description,
                d.IsActive,
                d.Portfolios.Count,
                d.Initiatives.Count
            ))
            .FirstOrDefaultAsync();
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(SaveDepartmentDto dto)
    {
        var entity = new Department
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            IsActive = dto.IsActive
        };

        _context.Departments.Add(entity);
        await _context.SaveChangesAsync();

        return (await GetDepartmentByIdAsync(entity.Id))!;
    }

    public async Task<DepartmentDto?> UpdateDepartmentAsync(int id, SaveDepartmentDto dto)
    {
        var entity = await _context.Departments.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.IsActive = dto.IsActive;

        await _context.SaveChangesAsync();
        return await GetDepartmentByIdAsync(id);
    }

    public async Task<bool> DeleteDepartmentAsync(int id)
    {
        var entity = await _context.Departments.FindAsync(id);
        if (entity == null) return false;

        _context.Departments.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== PORTFOLIOS ====================
    public async Task<List<PortfolioDto>> GetPortfoliosAsync(string? search, string? status, int? departmentId)
    {
        var query = _context.Portfolios
            .Include(p => p.Department)
            .Include(p => p.Owner)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(s) || (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(p => p.Status == status);
        }

        if (departmentId.HasValue)
        {
            query = query.Where(p => p.DepartmentId == departmentId.Value);
        }

        return await query
            .OrderBy(p => p.Name)
            .Select(p => new PortfolioDto(
                p.Id,
                p.Name,
                p.Description,
                p.DepartmentId,
                p.Department != null ? p.Department.Name : null,
                p.OwnerId,
                p.Owner != null ? p.Owner.FullName : null,
                p.StartDate.ToString("yyyy-MM-dd"),
                p.EndDate.ToString("yyyy-MM-dd"),
                p.Status,
                p.Initiatives.Count
            ))
            .ToListAsync();
    }

    public async Task<PortfolioDto?> GetPortfolioByIdAsync(int id)
    {
        return await _context.Portfolios
            .Include(p => p.Department)
            .Include(p => p.Owner)
            .Where(p => p.Id == id)
            .Select(p => new PortfolioDto(
                p.Id,
                p.Name,
                p.Description,
                p.DepartmentId,
                p.Department != null ? p.Department.Name : null,
                p.OwnerId,
                p.Owner != null ? p.Owner.FullName : null,
                p.StartDate.ToString("yyyy-MM-dd"),
                p.EndDate.ToString("yyyy-MM-dd"),
                p.Status,
                p.Initiatives.Count
            ))
            .FirstOrDefaultAsync();
    }

    public async Task<PortfolioDto> CreatePortfolioAsync(SavePortfolioDto dto)
    {
        var entity = new Portfolio
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            DepartmentId = dto.DepartmentId,
            OwnerId = dto.OwnerId,
            StartDate = DateTime.Parse(dto.StartDate),
            EndDate = DateTime.Parse(dto.EndDate),
            Status = dto.Status
        };

        _context.Portfolios.Add(entity);
        await _context.SaveChangesAsync();
        return (await GetPortfolioByIdAsync(entity.Id))!;
    }

    public async Task<PortfolioDto?> UpdatePortfolioAsync(int id, SavePortfolioDto dto)
    {
        var entity = await _context.Portfolios.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.DepartmentId = dto.DepartmentId;
        entity.OwnerId = dto.OwnerId;
        entity.StartDate = DateTime.Parse(dto.StartDate);
        entity.EndDate = DateTime.Parse(dto.EndDate);
        entity.Status = dto.Status;

        await _context.SaveChangesAsync();
        return await GetPortfolioByIdAsync(id);
    }

    public async Task<bool> DeletePortfolioAsync(int id)
    {
        var entity = await _context.Portfolios.FindAsync(id);
        if (entity == null) return false;

        _context.Portfolios.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== INITIATIVES ====================
    public async Task<List<InitiativeDto>> GetInitiativesAsync(string? search, string? status, int? portfolioId, int? departmentId)
    {
        var query = _context.Initiatives
            .Include(i => i.Department)
            .Include(i => i.Portfolio)
            .Include(i => i.Owner)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i => i.Name.ToLower().Contains(s) || (i.Description != null && i.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(i => i.Status == status);
        }

        if (portfolioId.HasValue)
        {
            query = query.Where(i => i.PortfolioId == portfolioId.Value);
        }

        if (departmentId.HasValue)
        {
            query = query.Where(i => i.DepartmentId == departmentId.Value);
        }

        return await query
            .OrderBy(i => i.Name)
            .Select(i => new InitiativeDto(
                i.Id,
                i.Name,
                i.Description,
                i.DepartmentId,
                i.Department != null ? i.Department.Name : null,
                i.PortfolioId,
                i.Portfolio != null ? i.Portfolio.Name : null,
                i.OwnerId,
                i.Owner != null ? i.Owner.FullName : null,
                i.StartDate.ToString("yyyy-MM-dd"),
                i.TargetDate.ToString("yyyy-MM-dd"),
                i.Status,
                i.Priority,
                i.ProgressPercentage,
                i.Projects.Count
            ))
            .ToListAsync();
    }

    public async Task<InitiativeDto?> GetInitiativeByIdAsync(int id)
    {
        return await _context.Initiatives
            .Include(i => i.Department)
            .Include(i => i.Portfolio)
            .Include(i => i.Owner)
            .Where(i => i.Id == id)
            .Select(i => new InitiativeDto(
                i.Id,
                i.Name,
                i.Description,
                i.DepartmentId,
                i.Department != null ? i.Department.Name : null,
                i.PortfolioId,
                i.Portfolio != null ? i.Portfolio.Name : null,
                i.OwnerId,
                i.Owner != null ? i.Owner.FullName : null,
                i.StartDate.ToString("yyyy-MM-dd"),
                i.TargetDate.ToString("yyyy-MM-dd"),
                i.Status,
                i.Priority,
                i.ProgressPercentage,
                i.Projects.Count
            ))
            .FirstOrDefaultAsync();
    }

    public async Task<InitiativeDto> CreateInitiativeAsync(SaveInitiativeDto dto)
    {
        var entity = new Initiative
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            DepartmentId = dto.DepartmentId,
            PortfolioId = dto.PortfolioId,
            OwnerId = dto.OwnerId,
            StartDate = DateTime.Parse(dto.StartDate),
            TargetDate = DateTime.Parse(dto.TargetDate),
            Status = dto.Status,
            Priority = dto.Priority,
            ProgressPercentage = dto.ProgressPercentage
        };

        _context.Initiatives.Add(entity);
        await _context.SaveChangesAsync();
        return (await GetInitiativeByIdAsync(entity.Id))!;
    }

    public async Task<InitiativeDto?> UpdateInitiativeAsync(int id, SaveInitiativeDto dto)
    {
        var entity = await _context.Initiatives.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.DepartmentId = dto.DepartmentId;
        entity.PortfolioId = dto.PortfolioId;
        entity.OwnerId = dto.OwnerId;
        entity.StartDate = DateTime.Parse(dto.StartDate);
        entity.TargetDate = DateTime.Parse(dto.TargetDate);
        entity.Status = dto.Status;
        entity.Priority = dto.Priority;
        entity.ProgressPercentage = dto.ProgressPercentage;

        await _context.SaveChangesAsync();
        return await GetInitiativeByIdAsync(id);
    }

    public async Task<bool> DeleteInitiativeAsync(int id)
    {
        var entity = await _context.Initiatives.FindAsync(id);
        if (entity == null) return false;

        _context.Initiatives.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== PROJECTS ====================
    public async Task<List<ProjectDto>> GetProjectsAsync(string? search, string? status, int? initiativeId)
    {
        var today = DateTime.UtcNow.Date;
        var query = _context.Projects
            .Include(p => p.Initiative)
                .ThenInclude(i => i!.Portfolio)
            .Include(p => p.Initiative)
                .ThenInclude(i => i!.Department)
            .Include(p => p.ProjectManager)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(s) || (p.Description != null && p.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(p => p.Status == status);
        }

        if (initiativeId.HasValue)
        {
            query = query.Where(p => p.InitiativeId == initiativeId.Value);
        }

        return await query
            .OrderBy(p => p.Name)
            .Select(p => new ProjectDto(
                p.Id,
                p.Name,
                p.Description,
                p.InitiativeId,
                p.Initiative != null ? p.Initiative.Name : null,
                p.Initiative != null ? p.Initiative.PortfolioId : null,
                p.Initiative != null && p.Initiative.Portfolio != null ? p.Initiative.Portfolio.Name : null,
                p.Initiative != null ? p.Initiative.DepartmentId : null,
                p.Initiative != null && p.Initiative.Department != null ? p.Initiative.Department.Name : null,
                p.ProjectManagerId,
                p.ProjectManager != null ? p.ProjectManager.FullName : null,
                p.StartDate.ToString("yyyy-MM-dd"),
                p.EndDate.ToString("yyyy-MM-dd"),
                p.Status,
                p.Priority,
                p.ProgressPercentage,
                p.Workstreams.Count,
                p.Milestones.Count,
                p.Activities.Count(a => a.ParentActivityId == null),
                p.Activities.Count(a => a.Status != "Completed" && a.DueDate < today)
            ))
            .ToListAsync();
    }

    public async Task<ProjectDto?> GetProjectByIdAsync(int id)
    {
        var list = await GetProjectsAsync(null, null, null);
        return list.FirstOrDefault(p => p.Id == id);
    }

    public async Task<ProjectDto> CreateProjectAsync(SaveProjectDto dto)
    {
        var entity = new Project
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            InitiativeId = dto.InitiativeId,
            ProjectManagerId = dto.ProjectManagerId,
            StartDate = DateTime.Parse(dto.StartDate),
            EndDate = DateTime.Parse(dto.EndDate),
            Status = dto.Status,
            Priority = dto.Priority,
            ProgressPercentage = dto.ProgressPercentage
        };

        _context.Projects.Add(entity);
        await _context.SaveChangesAsync();
        return (await GetProjectByIdAsync(entity.Id))!;
    }

    public async Task<ProjectDto?> UpdateProjectAsync(int id, SaveProjectDto dto)
    {
        var entity = await _context.Projects.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.InitiativeId = dto.InitiativeId;
        entity.ProjectManagerId = dto.ProjectManagerId;
        entity.StartDate = DateTime.Parse(dto.StartDate);
        entity.EndDate = DateTime.Parse(dto.EndDate);
        entity.Status = dto.Status;
        entity.Priority = dto.Priority;
        entity.ProgressPercentage = dto.ProgressPercentage;

        await _context.SaveChangesAsync();
        return await GetProjectByIdAsync(id);
    }

    public async Task<bool> DeleteProjectAsync(int id)
    {
        var entity = await _context.Projects.FindAsync(id);
        if (entity == null) return false;

        var activityIds = await _context.Activities
            .Where(a => a.ProjectId == id)
            .Select(a => a.Id)
            .ToListAsync();

        if (activityIds.Count > 0)
        {
            var deps = await _context.TaskDependencies
                .Where(td => activityIds.Contains(td.PredecessorTaskId) || activityIds.Contains(td.SuccessorTaskId))
                .ToListAsync();
            if (deps.Count > 0)
                _context.TaskDependencies.RemoveRange(deps);

            var subtasks = await _context.Activities
                .Where(a => a.ProjectId == id && a.ParentActivityId != null)
                .ToListAsync();
            if (subtasks.Count > 0)
                _context.Activities.RemoveRange(subtasks);

            var rootActivities = await _context.Activities
                .Where(a => a.ProjectId == id && a.ParentActivityId == null)
                .ToListAsync();
            if (rootActivities.Count > 0)
                _context.Activities.RemoveRange(rootActivities);
        }

        var milestones = await _context.Milestones.Where(m => m.ProjectId == id).ToListAsync();
        if (milestones.Count > 0)
            _context.Milestones.RemoveRange(milestones);

        var workstreams = await _context.Workstreams.Where(w => w.ProjectId == id).ToListAsync();
        if (workstreams.Count > 0)
            _context.Workstreams.RemoveRange(workstreams);

        _context.Projects.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== WORKSTREAMS ====================
    public async Task<List<WorkstreamDto>> GetWorkstreamsAsync(int? projectId, string? status, string? search)
    {
        var query = _context.Workstreams
            .Include(w => w.Project)
            .Include(w => w.Owner)
            .AsQueryable();

        if (projectId.HasValue)
            query = query.Where(w => w.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
            query = query.Where(w => w.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(w => w.Name.ToLower().Contains(s) || (w.Description != null && w.Description.ToLower().Contains(s)));
        }

        return await query
            .OrderBy(w => w.StartDate)
            .Select(w => new WorkstreamDto(
                w.Id,
                w.Name,
                w.Description,
                w.ProjectId,
                w.Project != null ? w.Project.Name : null,
                w.OwnerId,
                w.Owner != null ? w.Owner.FullName : null,
                w.StartDate.ToString("yyyy-MM-dd"),
                w.EndDate.ToString("yyyy-MM-dd"),
                w.Status,
                w.ProgressPercentage,
                w.Activities.Count(a => a.ParentActivityId == null),
                w.Milestones.Count
            ))
            .ToListAsync();
    }

    public async Task<WorkstreamDto?> GetWorkstreamByIdAsync(int id)
    {
        var all = await GetWorkstreamsAsync(null, null, null);
        return all.FirstOrDefault(w => w.Id == id);
    }

    public async Task<WorkstreamDto> CreateWorkstreamAsync(SaveWorkstreamDto dto)
    {
        var entity = new Workstream
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            ProjectId = dto.ProjectId,
            OwnerId = dto.OwnerId,
            StartDate = DateTime.Parse(dto.StartDate),
            EndDate = DateTime.Parse(dto.EndDate),
            Status = dto.Status,
            ProgressPercentage = dto.ProgressPercentage
        };

        _context.Workstreams.Add(entity);
        await _context.SaveChangesAsync();
        return (await GetWorkstreamByIdAsync(entity.Id))!;
    }

    public async Task<WorkstreamDto?> UpdateWorkstreamAsync(int id, SaveWorkstreamDto dto)
    {
        var entity = await _context.Workstreams.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.ProjectId = dto.ProjectId;
        entity.OwnerId = dto.OwnerId;
        entity.StartDate = DateTime.Parse(dto.StartDate);
        entity.EndDate = DateTime.Parse(dto.EndDate);
        entity.Status = dto.Status;
        entity.ProgressPercentage = dto.ProgressPercentage;

        await _context.SaveChangesAsync();
        return await GetWorkstreamByIdAsync(id);
    }

    public async Task<bool> DeleteWorkstreamAsync(int id)
    {
        var entity = await _context.Workstreams.FindAsync(id);
        if (entity == null) return false;

        var linkedMilestones = await _context.Milestones.Where(m => m.WorkstreamId == id).ToListAsync();
        foreach (var m in linkedMilestones) m.WorkstreamId = null;

        var linkedActivities = await _context.Activities.Where(a => a.WorkstreamId == id).ToListAsync();
        foreach (var a in linkedActivities) a.WorkstreamId = null;

        _context.Workstreams.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== MILESTONES ====================
    public async Task<List<MilestoneDto>> GetMilestonesAsync(int? projectId, int? workstreamId, string? status, string? search)
    {
        var today = DateTime.UtcNow.Date;
        var query = _context.Milestones
            .Include(m => m.Project)
            .Include(m => m.Workstream)
            .Include(m => m.Owner)
            .AsQueryable();

        if (projectId.HasValue)
            query = query.Where(m => m.ProjectId == projectId.Value);

        if (workstreamId.HasValue)
            query = query.Where(m => m.WorkstreamId == workstreamId.Value);

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
            query = query.Where(m => m.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(m => m.Name.ToLower().Contains(s) || (m.Description != null && m.Description.ToLower().Contains(s)));
        }

        return await query
            .OrderBy(m => m.PlannedDate)
            .Select(m => new MilestoneDto(
                m.Id,
                m.Name,
                m.Description,
                m.ProjectId,
                m.Project != null ? m.Project.Name : null,
                m.WorkstreamId,
                m.Workstream != null ? m.Workstream.Name : null,
                m.OwnerId,
                m.Owner != null ? m.Owner.FullName : null,
                m.PlannedDate.ToString("yyyy-MM-dd"),
                m.ActualDate.HasValue ? m.ActualDate.Value.ToString("yyyy-MM-dd") : null,
                m.Status,
                m.Status == "Delayed" || (m.Status != "Completed" && m.PlannedDate < today),
                m.Activities.Count
            ))
            .ToListAsync();
    }

    public async Task<MilestoneDto?> GetMilestoneByIdAsync(int id)
    {
        var all = await GetMilestonesAsync(null, null, null, null);
        return all.FirstOrDefault(m => m.Id == id);
    }

    public async Task<MilestoneDto> CreateMilestoneAsync(SaveMilestoneDto dto)
    {
        var entity = new Milestone
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            ProjectId = dto.ProjectId,
            WorkstreamId = dto.WorkstreamId,
            OwnerId = dto.OwnerId,
            PlannedDate = DateTime.Parse(dto.PlannedDate),
            ActualDate = !string.IsNullOrWhiteSpace(dto.ActualDate) ? DateTime.Parse(dto.ActualDate) : null,
            Status = dto.Status
        };

        _context.Milestones.Add(entity);
        await _context.SaveChangesAsync();
        return (await GetMilestoneByIdAsync(entity.Id))!;
    }

    public async Task<MilestoneDto?> UpdateMilestoneAsync(int id, SaveMilestoneDto dto)
    {
        var entity = await _context.Milestones.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.ProjectId = dto.ProjectId;
        entity.WorkstreamId = dto.WorkstreamId;
        entity.OwnerId = dto.OwnerId;
        entity.PlannedDate = DateTime.Parse(dto.PlannedDate);
        entity.ActualDate = !string.IsNullOrWhiteSpace(dto.ActualDate) ? DateTime.Parse(dto.ActualDate) : null;
        entity.Status = dto.Status;

        await _context.SaveChangesAsync();
        return await GetMilestoneByIdAsync(id);
    }

    public async Task<bool> DeleteMilestoneAsync(int id)
    {
        var entity = await _context.Milestones.FindAsync(id);
        if (entity == null) return false;

        var linkedActivities = await _context.Activities.Where(a => a.MilestoneId == id).ToListAsync();
        foreach (var a in linkedActivities) a.MilestoneId = null;

        _context.Milestones.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }

    // ==================== ACTIVITIES & SUBTASKS ====================
    public async Task<List<ActivityDto>> GetActivitiesAsync(
        string? search,
        string? status,
        int? projectId,
        int? workstreamId,
        int? milestoneId,
        int? assignedUserId,
        string? priority,
        bool includeSubtasksFlat = true)
    {
        var today = DateTime.UtcNow.Date;

        var allActivities = await _context.Activities
            .Include(a => a.Project)
                .ThenInclude(p => p!.Initiative)
            .Include(a => a.Workstream)
            .Include(a => a.Milestone)
            .Include(a => a.ParentActivity)
            .Include(a => a.AssignedUser)
            .OrderBy(a => a.StartDate)
            .ThenBy(a => a.DueDate)
            .ToListAsync();

        var allDeps = await GetDependenciesAsync(projectId);

        ActivityDto MapToDto(Activity a)
        {
            var subtasks = allActivities
                .Where(sub => sub.ParentActivityId == a.Id)
                .Select(sub => new ActivityDto(
                    sub.Id,
                    sub.Name,
                    sub.Description,
                    sub.ProjectId,
                    sub.Project?.Name,
                    sub.Project?.InitiativeId,
                    sub.Project?.Initiative?.Name,
                    sub.WorkstreamId,
                    sub.Workstream?.Name,
                    sub.MilestoneId,
                    sub.Milestone?.Name,
                    sub.ParentActivityId,
                    a.Name,
                    sub.AssignedUserId,
                    sub.AssignedUser?.FullName,
                    sub.StartDate.ToString("yyyy-MM-dd"),
                    sub.DueDate.ToString("yyyy-MM-dd"),
                    sub.Status,
                    sub.Priority,
                    sub.ProgressPercentage,
                    sub.Status != "Completed" && sub.DueDate < today,
                    0,
                    0,
                    new List<ActivityDto>(),
                    allDeps.Where(d => d.SuccessorTaskId == sub.Id).ToList(),
                    allDeps.Where(d => d.PredecessorTaskId == sub.Id).ToList()
                ))
                .ToList();

            var completedSubtasks = subtasks.Count(s => s.Status == "Completed");

            return new ActivityDto(
                a.Id,
                a.Name,
                a.Description,
                a.ProjectId,
                a.Project?.Name,
                a.Project?.InitiativeId,
                a.Project?.Initiative?.Name,
                a.WorkstreamId,
                a.Workstream?.Name,
                a.MilestoneId,
                a.Milestone?.Name,
                a.ParentActivityId,
                a.ParentActivity?.Name,
                a.AssignedUserId,
                a.AssignedUser?.FullName,
                a.StartDate.ToString("yyyy-MM-dd"),
                a.DueDate.ToString("yyyy-MM-dd"),
                a.Status,
                a.Priority,
                a.ProgressPercentage,
                a.Status != "Completed" && a.DueDate < today,
                subtasks.Count,
                completedSubtasks,
                subtasks,
                allDeps.Where(d => d.SuccessorTaskId == a.Id).ToList(),
                allDeps.Where(d => d.PredecessorTaskId == a.Id).ToList()
            );
        }

        var mapped = allActivities
            .Where(a => includeSubtasksFlat || a.ParentActivityId == null)
            .Select(MapToDto)
            .AsEnumerable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            mapped = mapped.Where(a => a.Name.ToLower().Contains(s) || (a.Description != null && a.Description.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
            mapped = mapped.Where(a => a.Status == status);

        if (projectId.HasValue)
            mapped = mapped.Where(a => a.ProjectId == projectId.Value);

        if (workstreamId.HasValue)
            mapped = mapped.Where(a => a.WorkstreamId == workstreamId.Value);

        if (milestoneId.HasValue)
            mapped = mapped.Where(a => a.MilestoneId == milestoneId.Value);

        if (assignedUserId.HasValue)
            mapped = mapped.Where(a => a.AssignedUserId == assignedUserId.Value);

        if (!string.IsNullOrWhiteSpace(priority) && priority != "All")
            mapped = mapped.Where(a => a.Priority == priority);

        return mapped.ToList();
    }

    public async Task<ActivityDto?> GetActivityByIdAsync(int id)
    {
        var all = await GetActivitiesAsync(null, null, null, null, null, null, null, true);
        return all.FirstOrDefault(a => a.Id == id);
    }

    public async Task<ActivityDto> CreateActivityAsync(SaveActivityDto dto)
    {
        var progress = dto.Status == "Completed" ? 100 : (dto.Status == "Not Started" ? 0 : dto.ProgressPercentage);
        var entity = new Activity
        {
            Name = dto.Name.Trim(),
            Description = dto.Description?.Trim(),
            ProjectId = dto.ProjectId,
            WorkstreamId = dto.WorkstreamId,
            MilestoneId = dto.MilestoneId,
            ParentActivityId = dto.ParentActivityId,
            AssignedUserId = dto.AssignedUserId,
            StartDate = DateTime.Parse(dto.StartDate),
            DueDate = DateTime.Parse(dto.DueDate),
            Status = dto.Status,
            Priority = dto.Priority,
            ProgressPercentage = progress
        };

        _context.Activities.Add(entity);
        await _context.SaveChangesAsync();

        await RecalculateProjectProgressAsync(entity.ProjectId);
        return (await GetActivityByIdAsync(entity.Id))!;
    }

    public async Task<ActivityDto?> UpdateActivityAsync(int id, SaveActivityDto dto)
    {
        var entity = await _context.Activities.FindAsync(id);
        if (entity == null) return null;

        var progress = dto.Status == "Completed" ? 100 : (dto.Status == "Not Started" ? 0 : dto.ProgressPercentage);

        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description?.Trim();
        entity.ProjectId = dto.ProjectId;
        entity.WorkstreamId = dto.WorkstreamId;
        entity.MilestoneId = dto.MilestoneId;
        entity.ParentActivityId = dto.ParentActivityId;
        entity.AssignedUserId = dto.AssignedUserId;
        entity.StartDate = DateTime.Parse(dto.StartDate);
        entity.DueDate = DateTime.Parse(dto.DueDate);
        entity.Status = dto.Status;
        entity.Priority = dto.Priority;
        entity.ProgressPercentage = progress;

        await _context.SaveChangesAsync();
        await RecalculateProjectProgressAsync(entity.ProjectId);

        return await GetActivityByIdAsync(id);
    }

    public async Task<bool> DeleteActivityAsync(int id)
    {
        var entity = await _context.Activities.FindAsync(id);
        if (entity == null) return false;

        var projectId = entity.ProjectId;
        var subtasks = await _context.Activities.Where(a => a.ParentActivityId == id).ToListAsync();
        var idsToDelete = subtasks.Select(s => s.Id).Append(id).ToList();

        var deps = await _context.TaskDependencies
            .Where(td => idsToDelete.Contains(td.PredecessorTaskId) || idsToDelete.Contains(td.SuccessorTaskId))
            .ToListAsync();
        if (deps.Count > 0)
            _context.TaskDependencies.RemoveRange(deps);

        if (subtasks.Count > 0)
            _context.Activities.RemoveRange(subtasks);

        _context.Activities.Remove(entity);
        await _context.SaveChangesAsync();

        await RecalculateProjectProgressAsync(projectId);
        return true;
    }

    // ==================== TASK DEPENDENCIES ====================
    public async Task<List<TaskDependencyDto>> GetDependenciesAsync(int? projectId)
    {
        var query = _context.TaskDependencies
            .Include(td => td.PredecessorTask)
            .Include(td => td.SuccessorTask)
            .AsQueryable();

        if (projectId.HasValue)
        {
            query = query.Where(td =>
                (td.PredecessorTask != null && td.PredecessorTask.ProjectId == projectId.Value) ||
                (td.SuccessorTask != null && td.SuccessorTask.ProjectId == projectId.Value));
        }

        return await query
            .Select(td => new TaskDependencyDto(
                td.Id,
                td.PredecessorTaskId,
                td.PredecessorTask != null ? td.PredecessorTask.Name : "",
                td.PredecessorTask != null ? td.PredecessorTask.Status : "",
                td.SuccessorTaskId,
                td.SuccessorTask != null ? td.SuccessorTask.Name : "",
                td.SuccessorTask != null ? td.SuccessorTask.Status : "",
                td.PredecessorTask != null ? td.PredecessorTask.ProjectId : 0,
                td.DependencyType
            ))
            .ToListAsync();
    }

    public async Task<(TaskDependencyDto? Result, string? ErrorMessage)> CreateDependencyAsync(SaveTaskDependencyDto dto)
    {
        if (dto.PredecessorTaskId == dto.SuccessorTaskId)
        {
            return (null, "A task cannot depend on itself.");
        }

        var pred = await _context.Activities.FindAsync(dto.PredecessorTaskId);
        var succ = await _context.Activities.FindAsync(dto.SuccessorTaskId);
        if (pred == null || succ == null)
        {
            return (null, "Both predecessor and successor tasks must exist.");
        }

        var exists = await _context.TaskDependencies.AnyAsync(td =>
            td.PredecessorTaskId == dto.PredecessorTaskId && td.SuccessorTaskId == dto.SuccessorTaskId);
        if (exists)
        {
            return (null, "This dependency relationship already exists.");
        }

        var reverseExists = await _context.TaskDependencies.AnyAsync(td =>
            td.PredecessorTaskId == dto.SuccessorTaskId && td.SuccessorTaskId == dto.PredecessorTaskId);
        if (reverseExists)
        {
            return (null, "Circular dependency detected: the successor is already a predecessor of this task.");
        }

        var entity = new TaskDependency
        {
            PredecessorTaskId = dto.PredecessorTaskId,
            SuccessorTaskId = dto.SuccessorTaskId,
            DependencyType = string.IsNullOrWhiteSpace(dto.DependencyType) ? "FinishToStart" : dto.DependencyType
        };

        _context.TaskDependencies.Add(entity);
        await _context.SaveChangesAsync();

        var all = await GetDependenciesAsync(pred.ProjectId);
        return (all.First(d => d.Id == entity.Id), null);
    }

    public async Task<bool> DeleteDependencyAsync(int id)
    {
        var entity = await _context.TaskDependencies.FindAsync(id);
        if (entity == null) return false;

        _context.TaskDependencies.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }
}
