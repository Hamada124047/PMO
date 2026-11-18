using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using PmoSystem.Api.Data;
using PmoSystem.Api.Repositories;
using PmoSystem.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Configure Microsoft SQL Server LocalDB with Entity Framework Core
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=PMO Agile;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";

builder.Services.AddDbContext<PmoDbContext>(options =>
    options.UseSqlServer(connectionString));

// 2. Register Repositories and Services (Dependency Injection)
builder.Services.AddScoped(typeof(IGenericRepository<>), typeof(GenericRepository<>));
builder.Services.AddScoped<IPmoService, PmoService>();

// 3. Add Controllers & JSON options
builder.Services.AddControllers();

// 4. Configure CORS for Angular Frontend (http://localhost:4200)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 5. Configure Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "PMO Project Portfolio Management System API",
        Version = "v1.0.0",
        Description = "RESTful ASP.NET Core Web API with Entity Framework Core and Microsoft SQL Server LocalDB for managing organizational Departments, Portfolios, Initiatives, Projects, Workstreams, Milestones, Activities, Subtasks, and Task Dependencies."
    });
});

var app = builder.Build();

// 6. Initialize & Seed Database on Startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var dbContext = services.GetRequiredService<PmoDbContext>();
        await DbSeeder.SeedAsync(dbContext);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while initializing or seeding the SQL Server database. Verify (localdb)\\MSSQLLocalDB is running and connection string in appsettings.json is accurate.");
    }
}

// 7. HTTP Request Pipeline
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "PMO Portfolio Management API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowAngularFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
