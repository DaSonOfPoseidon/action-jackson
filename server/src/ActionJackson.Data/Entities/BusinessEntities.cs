using ActionJackson.Core;

namespace ActionJackson.Data.Entities;

// The tables of one business site (lan or car). Both schemas hold exactly these tables.
// Ids are uuid v7, set here on the client. Money is decimal (numeric(12,2) unless noted).

public class Customer : IHasDetails, IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? PostalCode { get; set; }
    public string Details { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class ServicePackage : IHasDetails
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public decimal? PriceFrom { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public string Details { get; set; } = "{}";
}

public class CatalogItem : IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Code { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }

    // Display text such as "Cable Runs". Not an enum: the values differ per site.
    public required string Category { get; set; }
    public CatalogUnitType UnitType { get; set; }
    public required string UnitLabel { get; set; }
    public decimal Price { get; set; }
    public decimal? ThresholdAmount { get; set; }
    public decimal? MaterialCost { get; set; }
    public CatalogUnitType? CostUnitType { get; set; }

    // numeric(6,2)
    public decimal? LaborHours { get; set; }
    public string? PurchaseUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// The bill of materials: parent needs Quantity of component.
public class CatalogItemComponent
{
    public Guid ParentId { get; set; }
    public Guid ComponentId { get; set; }

    // numeric(10,2)
    public decimal Quantity { get; set; }
}

public class AvailabilityRule
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    // 0 (Sunday) to 6, like System.DayOfWeek. smallint.
    public short DayOfWeek { get; set; }
    public TimeOnly Opens { get; set; }
    public TimeOnly Closes { get; set; }
    public short SlotMinutes { get; set; }
}

public class BlackoutDate
{
    public DateOnly Date { get; set; }
    public required string Reason { get; set; }
}

public class Appointment : IHasDetails, IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid CustomerId { get; set; }
    public Guid? QuoteId { get; set; }

    // Not an enum: the kinds differ per site (the API validates them against contracts/).
    public required string Kind { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public AppointmentStatus Status { get; set; }
    public string? Notes { get; set; }
    public string Details { get; set; } = "{}";
    public string? SourceIp { get; set; }
    public string? UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<AppointmentHistoryEntry> History { get; } = [];
}

public class AppointmentHistoryEntry
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid AppointmentId { get; set; }
    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;
    public required string Actor { get; set; }
    public AppointmentStatus? FromStatus { get; set; }
    public AppointmentStatus ToStatus { get; set; }
    public DateTimeOffset? FromStartsAt { get; set; }
    public DateTimeOffset? ToStartsAt { get; set; }
    public string? Note { get; set; }
}

public class ConsultationRequest : IHasDetails, IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    // char(8), eight random digits. Unique; see UniqueNumber.
    public required string RequestNumber { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public string? Phone { get; set; }
    public ConsultationStatus Status { get; set; }
    public string? Message { get; set; }
    public string Details { get; set; } = "{}";
    public required string SourceIp { get; set; }
    public required string UserAgent { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class Quote : IHasDetails, IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    // char(8), eight random digits. Unique; see UniqueNumber.
    public required string QuoteNumber { get; set; }
    public Guid CustomerId { get; set; }
    public QuoteStatus Status { get; set; }

    // Not an enum: the kinds differ per site (drops-only and whole-home for lan).
    public required string Kind { get; set; }

    // numeric(5,2), 0 to 100
    public decimal DiscountPercent { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Total { get; set; }
    public decimal Deposit { get; set; }
    public string? Notes { get; set; }
    public string Details { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<QuoteLine> Lines { get; } = [];
}

public class QuoteLine
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid QuoteId { get; set; }
    public Guid? CatalogItemId { get; set; }
    public required string Description { get; set; }

    // numeric(10,2)
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public bool IsLabor { get; set; }

    // numeric(6,2)
    public decimal? LaborHours { get; set; }
    public int SortOrder { get; set; }
}

public class Invoice : IHasUpdatedAt
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    // "INV-{year}-{n:D4}", from NumberAllocator.
    public required string InvoiceNumber { get; set; }

    // One invoice per quote: unique.
    public Guid QuoteId { get; set; }
    public Guid CustomerId { get; set; }
    public InvoiceStatus Status { get; set; }
    public DateOnly? IssuedOn { get; set; }
    public DateOnly? DueOn { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public List<InvoiceLine> Lines { get; } = [];
}

public class InvoiceLine
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid InvoiceId { get; set; }
    public Guid? CatalogItemId { get; set; }
    public required string Description { get; set; }

    // numeric(10,2)
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
    public bool IsLabor { get; set; }

    // numeric(6,2)
    public decimal? LaborHours { get; set; }
    public int SortOrder { get; set; }
}

public class Payment
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

// A file in object storage. OwnerId points at a quote, invoice or appointment (by OwnerType), so it
// has no foreign key.
public class Attachment
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public AttachmentOwner OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public required string ObjectKey { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public long SizeBytes { get; set; }

    // char(64), lowercase hex
    public required string Sha256 { get; set; }
    public required string UploadedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }
}

public class Testimonial
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Author { get; set; }
    public required string Body { get; set; }

    // smallint, 1 to 5
    public short Rating { get; set; }
    public bool IsPublished { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
