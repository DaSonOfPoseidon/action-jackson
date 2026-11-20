namespace ActionJackson.Core;

// One PascalCase enum per entity. The database stores the name as text and checks it against
// this list, so a value like 'pending' or 'No-Show' cannot be written.
public enum AppointmentStatus
{
    Scheduled,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
    NoShow,
    NeedsReview,
}

public enum QuoteStatus
{
    Pending,
    Reviewed,
    Approved,
    Rejected,
    Completed,
}

public enum InvoiceStatus
{
    Draft,
    Sent,
    Paid,
    Overdue,
    Cancelled,
}

// The legacy models/ConsultationRequest.js values, in PascalCase.
public enum ConsultationStatus
{
    New,
    Contacted,
    ConsultationScheduled,
    Quoted,
    Booked,
    Completed,
    Closed,
}

public enum ContactStatus
{
    New,
    Read,
    Archived,
}

public enum PaymentMethod
{
    Cash,
    Check,
    Card,
    BankTransfer,
    Other,
}

public enum CatalogUnitType
{
    PerFoot,
    PerRun,
    PerUnit,
    FlatFee,
    Threshold,
}

public enum AttachmentOwner
{
    Quote,
    Invoice,
    Appointment,
}

public enum EmailStatus
{
    Pending,
    Sent,
    Failed,
}

public enum ErrorSource
{
    Api,
    Edge,
    Browser,
}

public static class AppointmentStatuses
{
    // The statuses that hold a time slot. The database exclusion constraint and the booking
    // code both use this one list. NeedsReview is deliberately absent: the offline replay must
    // be able to insert a conflicting booking in that state.
    public static readonly IReadOnlyList<AppointmentStatus> Blocking =
    [
        AppointmentStatus.Scheduled,
        AppointmentStatus.Confirmed,
        AppointmentStatus.InProgress,
    ];
}
