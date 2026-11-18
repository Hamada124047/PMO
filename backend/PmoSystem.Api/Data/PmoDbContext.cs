using Microsoft.EntityFrameworkCore;
using PmoSystem.Api.Models;

namespace PmoSystem.Api.Data;

public class PmoDbContext : DbContext
{
    public PmoDbContext(DbContextOptions<PmoDbContext> options) : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Portfolio> Portfolios => Set<Portfolio>();
    public DbSet<Initiative> Initiatives => Set<Initiative>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Workstream> Workstreams => Set<Workstream>();
    public DbSet<Milestone> Milestones => Set<Milestone>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>()
            .HasIndex(r => r.Name)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Department>()
            .HasIndex(d => d.Name)
            .IsUnique();

        modelBuilder.Entity<Portfolio>()
            .HasOne(p => p.Department)
            .WithMany(d => d.Portfolios)
            .HasForeignKey(p => p.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Portfolio>()
            .HasOne(p => p.Owner)
            .WithMany()
            .HasForeignKey(p => p.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Initiative>()
            .HasOne(i => i.Portfolio)
            .WithMany(p => p.Initiatives)
            .HasForeignKey(i => i.PortfolioId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Initiative>()
            .HasOne(i => i.Department)
            .WithMany(d => d.Initiatives)
            .HasForeignKey(i => i.DepartmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Initiative>()
            .HasOne(i => i.Owner)
            .WithMany()
            .HasForeignKey(i => i.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Project>()
            .HasOne(pr => pr.Initiative)
            .WithMany(i => i.Projects)
            .HasForeignKey(pr => pr.InitiativeId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Project>()
            .HasOne(pr => pr.ProjectManager)
            .WithMany()
            .HasForeignKey(pr => pr.ProjectManagerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Workstream relationships
        modelBuilder.Entity<Workstream>()
            .HasOne(w => w.Project)
            .WithMany(pr => pr.Workstreams)
            .HasForeignKey(w => w.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Workstream>()
            .HasOne(w => w.Owner)
            .WithMany()
            .HasForeignKey(w => w.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Milestone relationships
        modelBuilder.Entity<Milestone>()
            .HasOne(m => m.Project)
            .WithMany(pr => pr.Milestones)
            .HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Milestone>()
            .HasOne(m => m.Workstream)
            .WithMany(w => w.Milestones)
            .HasForeignKey(m => m.WorkstreamId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Milestone>()
            .HasOne(m => m.Owner)
            .WithMany()
            .HasForeignKey(m => m.OwnerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Activity relationships
        modelBuilder.Entity<Activity>()
            .HasOne(a => a.Project)
            .WithMany(pr => pr.Activities)
            .HasForeignKey(a => a.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Activity>()
            .HasOne(a => a.Workstream)
            .WithMany(w => w.Activities)
            .HasForeignKey(a => a.WorkstreamId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Activity>()
            .HasOne(a => a.Milestone)
            .WithMany(m => m.Activities)
            .HasForeignKey(a => a.MilestoneId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Activity>()
            .HasOne(a => a.ParentActivity)
            .WithMany(parent => parent.Subtasks)
            .HasForeignKey(a => a.ParentActivityId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Activity>()
            .HasOne(a => a.AssignedUser)
            .WithMany()
            .HasForeignKey(a => a.AssignedUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // TaskDependency relationships
        modelBuilder.Entity<TaskDependency>()
            .HasIndex(td => new { td.PredecessorTaskId, td.SuccessorTaskId })
            .IsUnique();

        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.PredecessorTask)
            .WithMany(a => a.Successors)
            .HasForeignKey(td => td.PredecessorTaskId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TaskDependency>()
            .HasOne(td => td.SuccessorTask)
            .WithMany(a => a.Predecessors)
            .HasForeignKey(td => td.SuccessorTaskId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
