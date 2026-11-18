using Microsoft.AspNetCore.Mvc;
using PmoSystem.Api.DTOs;
using PmoSystem.Api.Services;

namespace PmoSystem.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public AuthController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var result = await _pmoService.AuthenticateAsync(request);
        if (result == null)
            return Unauthorized(new { message = "Invalid username/email or password." });

        return Ok(result);
    }

    [HttpGet("users")]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        return Ok(await _pmoService.GetUsersAsync());
    }
}

[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public DashboardController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary()
    {
        return Ok(await _pmoService.GetDashboardSummaryAsync());
    }
}

[ApiController]
[Route("api/departments")]
public class DepartmentsController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public DepartmentsController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<DepartmentDto>>> GetAll([FromQuery] string? search, [FromQuery] bool? isActive)
    {
        return Ok(await _pmoService.GetDepartmentsAsync(search, isActive));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DepartmentDto>> GetById(int id)
    {
        var item = await _pmoService.GetDepartmentByIdAsync(id);
        return item == null ? NotFound(new { message = $"Department {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<DepartmentDto>> Create([FromBody] SaveDepartmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateDepartmentAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<DepartmentDto>> Update(int id, [FromBody] SaveDepartmentDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateDepartmentAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Department {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteDepartmentAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Department {id} not found." });
    }
}

[ApiController]
[Route("api/portfolios")]
public class PortfoliosController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public PortfoliosController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<PortfolioDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? departmentId)
    {
        return Ok(await _pmoService.GetPortfoliosAsync(search, status, departmentId));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PortfolioDto>> GetById(int id)
    {
        var item = await _pmoService.GetPortfolioByIdAsync(id);
        return item == null ? NotFound(new { message = $"Portfolio {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<PortfolioDto>> Create([FromBody] SavePortfolioDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreatePortfolioAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PortfolioDto>> Update(int id, [FromBody] SavePortfolioDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdatePortfolioAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Portfolio {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeletePortfolioAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Portfolio {id} not found." });
    }
}

[ApiController]
[Route("api/initiatives")]
public class InitiativesController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public InitiativesController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<InitiativeDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? portfolioId,
        [FromQuery] int? departmentId)
    {
        return Ok(await _pmoService.GetInitiativesAsync(search, status, portfolioId, departmentId));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<InitiativeDto>> GetById(int id)
    {
        var item = await _pmoService.GetInitiativeByIdAsync(id);
        return item == null ? NotFound(new { message = $"Initiative {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<InitiativeDto>> Create([FromBody] SaveInitiativeDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateInitiativeAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<InitiativeDto>> Update(int id, [FromBody] SaveInitiativeDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateInitiativeAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Initiative {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteInitiativeAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Initiative {id} not found." });
    }
}

[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public ProjectsController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<ProjectDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? initiativeId)
    {
        return Ok(await _pmoService.GetProjectsAsync(search, status, initiativeId));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProjectDto>> GetById(int id)
    {
        var item = await _pmoService.GetProjectByIdAsync(id);
        return item == null ? NotFound(new { message = $"Project {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] SaveProjectDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateProjectAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ProjectDto>> Update(int id, [FromBody] SaveProjectDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateProjectAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Project {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteProjectAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Project {id} not found." });
    }
}

// WORKSTREAMS CONTROLLER
[ApiController]
[Route("api/workstreams")]
public class WorkstreamsController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public WorkstreamsController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<WorkstreamDto>>> GetAll(
        [FromQuery] int? projectId,
        [FromQuery] string? status,
        [FromQuery] string? search)
    {
        return Ok(await _pmoService.GetWorkstreamsAsync(projectId, status, search));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WorkstreamDto>> GetById(int id)
    {
        var item = await _pmoService.GetWorkstreamByIdAsync(id);
        return item == null ? NotFound(new { message = $"Workstream {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<WorkstreamDto>> Create([FromBody] SaveWorkstreamDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateWorkstreamAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<WorkstreamDto>> Update(int id, [FromBody] SaveWorkstreamDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateWorkstreamAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Workstream {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteWorkstreamAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Workstream {id} not found." });
    }
}

// MILESTONES CONTROLLER
[ApiController]
[Route("api/milestones")]
public class MilestonesController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public MilestonesController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<MilestoneDto>>> GetAll(
        [FromQuery] int? projectId,
        [FromQuery] int? workstreamId,
        [FromQuery] string? status,
        [FromQuery] string? search)
    {
        return Ok(await _pmoService.GetMilestonesAsync(projectId, workstreamId, status, search));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MilestoneDto>> GetById(int id)
    {
        var item = await _pmoService.GetMilestoneByIdAsync(id);
        return item == null ? NotFound(new { message = $"Milestone {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<MilestoneDto>> Create([FromBody] SaveMilestoneDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateMilestoneAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<MilestoneDto>> Update(int id, [FromBody] SaveMilestoneDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateMilestoneAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Milestone {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteMilestoneAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Milestone {id} not found." });
    }
}

// ACTIVITIES & SUBTASKS CONTROLLER
[ApiController]
[Route("api/activities")]
public class ActivitiesController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public ActivitiesController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<ActivityDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int? projectId,
        [FromQuery] int? workstreamId,
        [FromQuery] int? milestoneId,
        [FromQuery] int? assignedUserId,
        [FromQuery] string? priority)
    {
        return Ok(await _pmoService.GetActivitiesAsync(
            search, status, projectId, workstreamId, milestoneId, assignedUserId, priority));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ActivityDto>> GetById(int id)
    {
        var item = await _pmoService.GetActivityByIdAsync(id);
        return item == null ? NotFound(new { message = $"Activity {id} not found." }) : Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<ActivityDto>> Create([FromBody] SaveActivityDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _pmoService.CreateActivityAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ActivityDto>> Update(int id, [FromBody] SaveActivityDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _pmoService.UpdateActivityAsync(id, dto);
        return updated == null ? NotFound(new { message = $"Activity {id} not found." }) : Ok(updated);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteActivityAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Activity {id} not found." });
    }
}

// TASK DEPENDENCIES CONTROLLER
[ApiController]
[Route("api/dependencies")]
public class DependenciesController : ControllerBase
{
    private readonly IPmoService _pmoService;

    public DependenciesController(IPmoService pmoService) => _pmoService = pmoService;

    [HttpGet]
    public async Task<ActionResult<List<TaskDependencyDto>>> GetAll([FromQuery] int? projectId)
    {
        return Ok(await _pmoService.GetDependenciesAsync(projectId));
    }

    [HttpPost]
    public async Task<ActionResult<TaskDependencyDto>> Create([FromBody] SaveTaskDependencyDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var (result, errorMessage) = await _pmoService.CreateDependencyAsync(dto);
        if (errorMessage != null)
            return BadRequest(new { message = errorMessage });

        return CreatedAtAction(nameof(GetAll), new { id = result!.Id }, result);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _pmoService.DeleteDependencyAsync(id);
        return deleted ? NoContent() : NotFound(new { message = $"Dependency {id} not found." });
    }
}
