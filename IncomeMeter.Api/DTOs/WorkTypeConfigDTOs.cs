using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

public class CreateWorkTypeConfigDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    public List<CreateIncomeSourceTemplateDto> IncomeSourceTemplates { get; set; } = new();

    public bool IsActive { get; set; } = true;
}

public class UpdateWorkTypeConfigDto
{
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; set; }

    [StringLength(500)]
    public string? Description { get; set; }

    public List<CreateIncomeSourceTemplateDto>? IncomeSourceTemplates { get; set; }

    public bool? IsActive { get; set; }
}

public class WorkTypeConfigDto
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<IncomeSourceTemplateDto> IncomeSourceTemplates { get; set; } = new();
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreateIncomeSourceTemplateDto
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Category { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? DefaultAmount { get; set; }

    public bool IsRequired { get; set; } = false;

    [StringLength(250)]
    public string? Description { get; set; }

    [Range(0, int.MaxValue)]
    public int DisplayOrder { get; set; } = 0;
}

public class IncomeSourceTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal? DefaultAmount { get; set; }
    public bool IsRequired { get; set; }
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
}

public class WorkTypeConfigResponseDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<IncomeSourceTemplateDto> IncomeSourceTemplates { get; set; } = new();
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}