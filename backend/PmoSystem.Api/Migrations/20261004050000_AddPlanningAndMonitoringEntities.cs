using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PmoSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPlanningAndMonitoringEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create Workstreams Table
            migrationBuilder.CreateTable(
                name: "Workstreams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    OwnerId = table.Column<int>(type: "int", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ProgressPercentage = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workstreams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Workstreams_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Workstreams_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            // 2. Create Milestones Table
            migrationBuilder.CreateTable(
                name: "Milestones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1500)", maxLength: 1500, nullable: true),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    WorkstreamId = table.Column<int>(type: "int", nullable: true),
                    OwnerId = table.Column<int>(type: "int", nullable: true),
                    PlannedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ActualDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Milestones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Milestones_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Milestones_Workstreams_WorkstreamId",
                        column: x => x.WorkstreamId,
                        principalTable: "Workstreams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                    table.ForeignKey(
                        name: "FK_Milestones_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            // 3. Extend Activities Table with WorkstreamId, MilestoneId, ParentActivityId
            migrationBuilder.AddColumn<int>(
                name: "WorkstreamId",
                table: "Activities",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MilestoneId",
                table: "Activities",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ParentActivityId",
                table: "Activities",
                type: "int",
                nullable: true);

            // 4. Create TaskDependencies Table
            migrationBuilder.CreateTable(
                name: "TaskDependencies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PredecessorTaskId = table.Column<int>(type: "int", nullable: false),
                    SuccessorTaskId = table.Column<int>(type: "int", nullable: false),
                    DependencyType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskDependencies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskDependencies_Activities_PredecessorTaskId",
                        column: x => x.PredecessorTaskId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskDependencies_Activities_SuccessorTaskId",
                        column: x => x.SuccessorTaskId,
                        principalTable: "Activities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.NoAction);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workstreams_OwnerId",
                table: "Workstreams",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Workstreams_ProjectId",
                table: "Workstreams",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Milestones_OwnerId",
                table: "Milestones",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Milestones_ProjectId",
                table: "Milestones",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_Milestones_WorkstreamId",
                table: "Milestones",
                column: "WorkstreamId");

            migrationBuilder.CreateIndex(
                name: "IX_Activities_WorkstreamId",
                table: "Activities",
                column: "WorkstreamId");

            migrationBuilder.CreateIndex(
                name: "IX_Activities_MilestoneId",
                table: "Activities",
                column: "MilestoneId");

            migrationBuilder.CreateIndex(
                name: "IX_Activities_ParentActivityId",
                table: "Activities",
                column: "ParentActivityId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskDependencies_PredecessorTaskId_SuccessorTaskId",
                table: "TaskDependencies",
                columns: new[] { "PredecessorTaskId", "SuccessorTaskId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskDependencies_SuccessorTaskId",
                table: "TaskDependencies",
                column: "SuccessorTaskId");

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Workstreams_WorkstreamId",
                table: "Activities",
                column: "WorkstreamId",
                principalTable: "Workstreams",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Milestones_MilestoneId",
                table: "Activities",
                column: "MilestoneId",
                principalTable: "Milestones",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_Activities_Activities_ParentActivityId",
                table: "Activities",
                column: "ParentActivityId",
                principalTable: "Activities",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(name: "FK_Activities_Activities_ParentActivityId", table: "Activities");
            migrationBuilder.DropForeignKey(name: "FK_Activities_Milestones_MilestoneId", table: "Activities");
            migrationBuilder.DropForeignKey(name: "FK_Activities_Workstreams_WorkstreamId", table: "Activities");

            migrationBuilder.DropTable(name: "TaskDependencies");
            migrationBuilder.DropTable(name: "Milestones");
            migrationBuilder.DropTable(name: "Workstreams");

            migrationBuilder.DropIndex(name: "IX_Activities_WorkstreamId", table: "Activities");
            migrationBuilder.DropIndex(name: "IX_Activities_MilestoneId", table: "Activities");
            migrationBuilder.DropIndex(name: "IX_Activities_ParentActivityId", table: "Activities");

            migrationBuilder.DropColumn(name: "WorkstreamId", table: "Activities");
            migrationBuilder.DropColumn(name: "MilestoneId", table: "Activities");
            migrationBuilder.DropColumn(name: "ParentActivityId", table: "Activities");
        }
    }
}
