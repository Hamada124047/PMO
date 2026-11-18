using System.ComponentModel.DataAnnotations;

namespace PmoSystem.Api.Models;

public class Role
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public ICollection<User> Users { get; set; } = new List<User>();
}

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required, MaxLength(255)]
    public string PasswordHash { get; set; } = string.Empty;

    public int RoleId { get; set; }
    public Role? Role { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Department
{
    public int Id { get; set; }

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Portfolio> Portfolios { get; set; } = new List<Portfolio>();
    public ICollection<Initiative> Initiatives { get; set; } = new List<Initiative>();
}

public class Portfolio
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }

    public int? OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "Active";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Initiative> Initiatives { get; set; } = new List<Initiative>();
}

public class Initiative
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }

    [Required]
    public int PortfolioId { get; set; }
    public Portfolio? Portfolio { get; set; }

    public int? OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime TargetDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "In Progress";

    [Required, MaxLength(50)]
    public string Priority { get; set; } = "Medium";

    [Range(0, 100)]
    public int ProgressPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Project> Projects { get; set; } = new List<Project>();
}

public class Project
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    [Required]
    public int InitiativeId { get; set; }
    public Initiative? Initiative { get; set; }

    public int? ProjectManagerId { get; set; }
    public User? ProjectManager { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "In Progress";

    [Required, MaxLength(50)]
    public string Priority { get; set; } = "Medium";

    [Range(0, 100)]
    public int ProgressPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Workstream> Workstreams { get; set; } = new List<Workstream>();
    public ICollection<Milestone> Milestones { get; set; } = new List<Milestone>();
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}

// WORKSTREAM ENTITY
public class Workstream
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    [Required]
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int? OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "In Progress"; // Planned, In Progress, Completed, On Hold

    [Range(0, 100)]
    public int ProgressPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Milestone> Milestones { get; set; } = new List<Milestone>();
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}

// MILESTONE ENTITY
public class Milestone
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    [Required]
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int? WorkstreamId { get; set; }
    public Workstream? Workstream { get; set; }

    public int? OwnerId { get; set; }
    public User? Owner { get; set; }

    public DateTime PlannedDate { get; set; }
    public DateTime? ActualDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "Planned"; // Planned, In Progress, Completed, Delayed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}

// ACTIVITY / TASK ENTITY (Supports Subtasks, Workstream, Milestone)
public class Activity
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(1500)]
    public string? Description { get; set; }

    [Required]
    public int ProjectId { get; set; }
    public Project? Project { get; set; }

    public int? WorkstreamId { get; set; }
    public Workstream? Workstream { get; set; }

    public int? MilestoneId { get; set; }
    public Milestone? Milestone { get; set; }

    public int? ParentActivityId { get; set; }
    public Activity? ParentActivity { get; set; }

    public int? AssignedUserId { get; set; }
    public User? AssignedUser { get; set; }

    public DateTime StartDate { get; set; }
    public DateTime DueDate { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "Not Started"; // Not Started, In Progress, Completed

    [Required, MaxLength(50)]
    public string Priority { get; set; } = "Medium";

    [Range(0, 100)]
    public int ProgressPercentage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Activity> Subtasks { get; set; } = new List<Activity>();
    public ICollection<TaskDependency> Predecessors { get; set; } = new List<TaskDependency>();
    public ICollection<TaskDependency> Successors { get; set; } = new List<TaskDependency>();
}

// TASK DEPENDENCY ENTITY (Predecessor -> Successor)
public class TaskDependency
{
    public int Id { get; set; }

    [Required]
    public int PredecessorTaskId { get; set; }
    public Activity? PredecessorTask { get; set; }

    [Required]
    public int SuccessorTaskId { get; set; }
    public Activity? SuccessorTask { get; set; }

    [Required, MaxLength(30)]
    public string DependencyType { get; set; } = "FinishToStart";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
