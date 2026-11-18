using System.ComponentModel.DataAnnotations;

namespace PmoSystem.Api.DTOs;

public record LoginRequestDto(
    [Required] string Username,
    [Required] string Password
);

public record AuthResponseDto(
    int UserId,
    string FullName,
    string Username,
    string Email,
    string Role,
    string Token
);

public record UserDto(
    int Id,
    string FullName,
    string Email,
    string Username,
    int RoleId,
    string RoleName,
    bool IsActive
);

// Department DTOs
public record DepartmentDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int PortfolioCount,
    int InitiativeCount
);

public record SaveDepartmentDto(
    [Required, MaxLength(150)] string Name,
    [MaxLength(1000)] string? Description,
    bool IsActive
);

// Portfolio DTOs
public record PortfolioDto(
    int Id,
    string Name,
    string? Description,
    int? DepartmentId,
    string? DepartmentName,
    int? OwnerId,
    string? OwnerName,
    string StartDate,
    string EndDate,
    string Status,
    int InitiativeCount
);

public record SavePortfolioDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    int? DepartmentId,
    int? OwnerId,
    [Required] string StartDate,
    [Required] string EndDate,
    [Required] string Status
);

// Initiative DTOs
public record InitiativeDto(
    int Id,
    string Name,
    string? Description,
    int? DepartmentId,
    string? DepartmentName,
    int PortfolioId,
    string? PortfolioName,
    int? OwnerId,
    string? OwnerName,
    string StartDate,
    string TargetDate,
    string Status,
    string Priority,
    int ProgressPercentage,
    int ProjectCount
);

public record SaveInitiativeDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    int? DepartmentId,
    [Required] int PortfolioId,
    int? OwnerId,
    [Required] string StartDate,
    [Required] string TargetDate,
    [Required] string Status,
    [Required] string Priority,
    [Range(0, 100)] int ProgressPercentage
);

// Project DTOs
public record ProjectDto(
    int Id,
    string Name,
    string? Description,
    int InitiativeId,
    string? InitiativeName,
    int? PortfolioId,
    string? PortfolioName,
    int? DepartmentId,
    string? DepartmentName,
    int? ProjectManagerId,
    string? ProjectManagerName,
    string StartDate,
    string EndDate,
    string Status,
    string Priority,
    int ProgressPercentage,
    int WorkstreamCount,
    int MilestoneCount,
    int ActivityCount,
    int OverdueActivityCount
);

public record SaveProjectDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    [Required] int InitiativeId,
    int? ProjectManagerId,
    [Required] string StartDate,
    [Required] string EndDate,
    [Required] string Status,
    [Required] string Priority,
    [Range(0, 100)] int ProgressPercentage
);

// Workstream DTOs
public record WorkstreamDto(
    int Id,
    string Name,
    string? Description,
    int ProjectId,
    string? ProjectName,
    int? OwnerId,
    string? OwnerName,
    string StartDate,
    string EndDate,
    string Status,
    int ProgressPercentage,
    int ActivityCount,
    int MilestoneCount
);

public record SaveWorkstreamDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    [Required] int ProjectId,
    int? OwnerId,
    [Required] string StartDate,
    [Required] string EndDate,
    [Required] string Status,
    [Range(0, 100)] int ProgressPercentage
);

// Milestone DTOs
public record MilestoneDto(
    int Id,
    string Name,
    string? Description,
    int ProjectId,
    string? ProjectName,
    int? WorkstreamId,
    string? WorkstreamName,
    int? OwnerId,
    string? OwnerName,
    string PlannedDate,
    string? ActualDate,
    string Status,
    bool IsDelayed,
    int LinkedActivityCount
);

public record SaveMilestoneDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    [Required] int ProjectId,
    int? WorkstreamId,
    int? OwnerId,
    [Required] string PlannedDate,
    string? ActualDate,
    [Required] string Status
);

// Task Dependency DTOs
public record TaskDependencyDto(
    int Id,
    int PredecessorTaskId,
    string PredecessorTaskName,
    string PredecessorStatus,
    int SuccessorTaskId,
    string SuccessorTaskName,
    string SuccessorStatus,
    int ProjectId,
    string DependencyType
);

public record SaveTaskDependencyDto(
    [Required] int PredecessorTaskId,
    [Required] int SuccessorTaskId,
    string DependencyType = "FinishToStart"
);

// Activity DTOs (With Workstream, Milestone, Subtasks & Dependencies)
public record ActivityDto(
    int Id,
    string Name,
    string? Description,
    int ProjectId,
    string? ProjectName,
    int? InitiativeId,
    string? InitiativeName,
    int? WorkstreamId,
    string? WorkstreamName,
    int? MilestoneId,
    string? MilestoneName,
    int? ParentActivityId,
    string? ParentActivityName,
    int? AssignedUserId,
    string? AssignedUserName,
    string StartDate,
    string DueDate,
    string Status,
    string Priority,
    int ProgressPercentage,
    bool IsOverdue,
    int SubtaskCount,
    int CompletedSubtaskCount,
    List<ActivityDto> Subtasks,
    List<TaskDependencyDto> Predecessors,
    List<TaskDependencyDto> Successors
);

public record SaveActivityDto(
    [Required, MaxLength(200)] string Name,
    [MaxLength(1500)] string? Description,
    [Required] int ProjectId,
    int? WorkstreamId,
    int? MilestoneId,
    int? ParentActivityId,
    int? AssignedUserId,
    [Required] string StartDate,
    [Required] string DueDate,
    [Required] string Status,
    [Required] string Priority,
    [Range(0, 100)] int ProgressPercentage
);

// Dashboard Summary DTO
public record StatusCountDto(string Status, int Count);
public record DepartmentCountDto(string DepartmentName, int Count);
public record WorkstreamCountDto(string WorkstreamName, string ProjectName, int Count);

public record DashboardSummaryDto(
    // Portfolio & Hierarchy Metrics
    int TotalDepartments,
    int TotalPortfolios,
    int TotalInitiatives,
    int TotalProjects,
    int TotalActivities,
    int ActiveProjects,
    int CompletedProjects,
    int OverdueActivities,
    List<StatusCountDto> ProjectsByStatus,
    List<DepartmentCountDto> InitiativesByDepartment,

    // Planning & Execution Metrics
    int TotalWorkstreams,
    int TotalMilestones,
    int TotalSubtasks,
    int TotalDependencies,
    List<ProjectDto> ProjectsWithOverdueActivities,
    List<MilestoneDto> UpcomingMilestones,
    List<StatusCountDto> ActivitiesByStatus,
    List<WorkstreamCountDto> ActivitiesByWorkstream,
    List<StatusCountDto> MilestonesByStatus,
    List<ProjectDto> ProjectsApproachingEndDate
);
