using System.Globalization;
using System.Net;
using System.Text;
using ActionJackson.Core;

namespace ActionJackson.Api.Email;

// One rendered email, ready to be queued in the outbox. Template is one of the EmailTemplates names.
public sealed record RenderedEmail(string Subject, string TextBody, string HtmlBody, string Template);

// A label and a value, for the parts of an email whose lines depend on the request (a quote's scope).
public sealed record EmailLine(string Label, string Value);

// Every value in these models comes from a customer form: the templates encode and clean it. Callers
// pass plain values (labels already looked up), never markup.
public sealed record ConsultationAdminModel(
    Site Site,
    string RequestNumber,
    string Name,
    string Email,
    string? Phone,
    string SquareFootage,
    string? Isp,
    IReadOnlyList<string> CurrentIssues,
    IReadOnlyList<string> InterestedServices,
    string? PackageInterest,
    string ClientIp,
    DateTimeOffset At);

public sealed record ConsultationAckModel(Site Site, string RequestNumber, string Name);

// Total is null when the quote has no priced total (a whole-home quote); the deposit is always known.
public sealed record QuoteAdminModel(
    Site Site,
    string QuoteNumber,
    string ServiceType,
    string Name,
    string Email,
    string? Phone,
    IReadOnlyList<EmailLine> Scope,
    decimal? Total,
    decimal Deposit,
    IReadOnlyList<EmailLine> HomeInfo,
    string ClientIp,
    DateTimeOffset At);

public sealed record BookingConfirmationModel(
    Site Site,
    string QuoteNumber,
    string Name,
    DateTimeOffset StartsAt,
    string? Phone,
    string? Notes);

public sealed record BookingAdminModel(
    Site Site,
    string QuoteNumber,
    string Name,
    string Email,
    string? Phone,
    DateTimeOffset StartsAt,
    string? Notes,
    string Package,
    bool IncludeSurvey,
    string ClientIp);

// The five emails the API sends. Pure functions: no I/O, no template engine. Callers never pass a free
// template string; the names below are what the outbox stores.
public static class EmailTemplates
{
    public const string ConsultationAdmin = "consultation-admin";
    public const string ConsultationAck = "consultation-ack";
    public const string QuoteAdmin = "quote-admin";
    public const string BookingConfirmation = "booking-confirmation";
    public const string BookingAdmin = "booking-admin";

    // lan and car share one brand; the spec gives no separate car brand.
    public const string Brand = "Action Jackson Installs";

    internal const int MaxSubject = 200;

    // The business's time zone. The runtime has no ICU (InvariantGlobalization), but time zones come
    // from tzdata, which the aspnet image has.
    private static readonly TimeZoneInfo Chicago = TimeZoneInfo.FindSystemTimeZoneById("America/Chicago");

    // The invariant culture's English names and AM/PM are the en-US ones. new CultureInfo("en-US") would
    // throw here: invariant globalization allows no other culture.
    private static readonly CultureInfo Format = CultureInfo.InvariantCulture;

    public static string BrandFor(Site site) => Brand;

    public static RenderedEmail Render(ConsultationAdminModel m)
    {
        var body = new EmailBody();
        body.Title($"New Consultation Request - #{m.RequestNumber}");
        body.Rule();
        body.Fields(
            ("Name", m.Name),
            ("Email", m.Email),
            ("Phone", m.Phone));
        body.Section("Property:");
        body.Indented(
            ("Square Footage", m.SquareFootage),
            ("ISP", m.Isp),
            ("Current Issues", m.CurrentIssues.Count > 0 ? string.Join(", ", m.CurrentIssues) : null));
        body.Fields(
            ("Interested Services", string.Join(", ", m.InterestedServices)),
            ("Package Interest", string.IsNullOrWhiteSpace(m.PackageInterest) ? "Not specified" : m.PackageInterest));
        body.Fields(
            ("IP Address", m.ClientIp),
            ("Timestamp", m.At.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", Format)));

        return Finish(AdminSubject(m.Site, $"New Consultation Request #{m.RequestNumber}"), body, ConsultationAdmin);
    }

    public static RenderedEmail Render(ConsultationAckModel m)
    {
        var brand = BrandFor(m.Site);
        var body = new EmailBody();
        body.Title("We received your request");
        body.Paragraph($"Hello {FirstName(m.Name)},");
        body.Paragraph($"We received your request #{m.RequestNumber} and will contact you.");
        body.Paragraph("We'll review your request and contact you to schedule your consultation.");
        body.Paragraph($"If you have questions in the meantime, contact us and mention request #{m.RequestNumber}.");
        body.Paragraph($"Thank you for choosing {brand}!");

        return Finish($"We received your consultation request #{m.RequestNumber} - {brand}", body, ConsultationAck);
    }

    public static RenderedEmail Render(QuoteAdminModel m)
    {
        var body = new EmailBody();
        body.Title($"New Quote Submission - #{m.QuoteNumber}");
        body.Rule();
        body.Fields(
            ("Quote Number", m.QuoteNumber),
            ("Service Type", m.ServiceType),
            ("Name", m.Name),
            ("Email", m.Email),
            ("Phone", m.Phone));
        body.Fields([.. m.Scope.Select(line => (line.Label, (string?)line.Value))]);
        body.Fields(
            ("Total Cost", m.Total is { } total ? Money(total) : null),
            ("Deposit Required", Money(m.Deposit)));
        if (m.HomeInfo.Count > 0)
        {
            body.Section("Home Info:");
            body.Indented([.. m.HomeInfo.Select(line => (line.Label, (string?)line.Value))]);
        }

        body.Fields(
            ("IP Address", m.ClientIp),
            ("Timestamp", m.At.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", Format)));

        return Finish(AdminSubject(m.Site, $"New Quote #{m.QuoteNumber} - {m.ServiceType}"), body, QuoteAdmin);
    }

    public static RenderedEmail Render(BookingConfirmationModel m)
    {
        var brand = BrandFor(m.Site);
        var local = ToChicago(m.StartsAt);
        var body = new EmailBody();
        body.Title("Appointment Confirmed!");
        body.Paragraph($"Hello {FirstName(m.Name)},");
        body.Paragraph($"Your appointment has been successfully scheduled for Quote #{m.QuoteNumber}:");
        body.Fields(
            ("Quote Number", $"#{m.QuoteNumber}"),
            ("Date", local.ToString("dddd, MMMM d, yyyy", Format)),
            ("Time", TimeOf(local)),
            ("Phone", m.Phone));
        body.Multiline(("Notes", m.Notes));
        body.Paragraph("We'll contact you 24 hours before the appointment to confirm.");
        body.Paragraph($"If you need to reschedule, please contact us as soon as possible and reference your quote number #{m.QuoteNumber}.");
        body.Paragraph($"Thank you for choosing {brand}!");

        return Finish($"Appointment Confirmation - {brand}", body, BookingConfirmation);
    }

    public static RenderedEmail Render(BookingAdminModel m)
    {
        var local = ToChicago(m.StartsAt);
        var body = new EmailBody();
        body.Title("New Appointment Scheduled");
        body.Fields(
            ("Quote Number", $"#{m.QuoteNumber}"),
            ("Customer", m.Name),
            ("Email", m.Email),
            ("Phone", string.IsNullOrWhiteSpace(m.Phone) ? "Not provided" : m.Phone),
            ("Date", local.ToString("M/d/yyyy", Format)),
            ("Time", TimeOf(local)));
        body.Multiline(("Notes", string.IsNullOrWhiteSpace(m.Notes) ? "None" : m.Notes));
        body.Fields(
            ("Package", m.Package + (m.IncludeSurvey ? " + Survey" : string.Empty)),
            ("IP", m.ClientIp));

        return Finish(AdminSubject(m.Site, $"\U0001F4C5 New Appointment for Quote #{m.QuoteNumber}"), body, BookingAdmin);
    }

    // $1,234.50: rounded once to cents, away from zero, in decimal. Never a double, and never "C": the
    // invariant culture's currency symbol is not "$".
    public static string Money(decimal amount)
    {
        var rounded = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        return (rounded < 0 ? "-$" : "$") + Math.Abs(rounded).ToString("N2", Format);
    }

    // One line, no control characters, at most 200 characters, and never half a surrogate pair. MailKit
    // encodes headers, but the stored subject must be a single line too.
    internal static string CapSubject(string subject)
    {
        var clean = OneLine(subject);
        if (clean.Length <= MaxSubject)
        {
            return clean;
        }

        var length = MaxSubject;
        if (char.IsHighSurrogate(clean[length - 1]))
        {
            length--;
        }

        return clean[..length];
    }

    // Line breaks and other control characters become single spaces; runs of whitespace collapse.
    internal static string OneLine(string value)
    {
        var text = new StringBuilder(value.Length);
        var space = false;
        foreach (var c in value)
        {
            if (char.IsControl(c) || char.IsWhiteSpace(c))
            {
                space = text.Length > 0;
                continue;
            }

            if (space)
            {
                text.Append(' ');
                space = false;
            }

            text.Append(c);
        }

        return text.ToString();
    }

    private static string AdminSubject(Site site, string subject) => $"[{site.Schema()}] {subject}";

    private static RenderedEmail Finish(string subject, EmailBody body, string template) =>
        new(CapSubject(subject), body.Text(), body.Html(), template);

    // The first word of the name, like the legacy greeting.
    private static string FirstName(string name)
    {
        var words = OneLine(name).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return words.Length > 0 ? words[0] : "there";
    }

    private static DateTimeOffset ToChicago(DateTimeOffset moment) => TimeZoneInfo.ConvertTime(moment, Chicago);

    private static string TimeOf(DateTimeOffset local) =>
        local.ToString("h:mm tt", Format) + (Chicago.IsDaylightSavingTime(local) ? " CDT" : " CST");

    // Builds the text and HTML bodies together from the same content, so they cannot drift apart.
    // Text keeps values raw (single-line ones with line breaks flattened, so a value cannot start a fake
    // line); HTML encodes every value, and no value is ever put in an attribute.
    private sealed class EmailBody
    {
        private readonly List<string> text = [];
        private readonly StringBuilder html = new();
        private bool listOpen;

        public string Text() => string.Join('\n', text);

        public string Html()
        {
            CloseList();
            return "<!DOCTYPE html><html><body>" + html + "</body></html>";
        }

        public void Title(string title)
        {
            CloseList();
            text.Add(OneLine(title));
            html.Append("<h2>").Append(Encode(title)).Append("</h2>");
        }

        public void Rule()
        {
            text.Add("----------------------------------------");
        }

        public void Section(string heading)
        {
            CloseList();
            text.Add(string.Empty);
            text.Add(OneLine(heading));
            html.Append("<h3>").Append(Encode(heading)).Append("</h3>");
        }

        public void Paragraph(string content)
        {
            CloseList();
            text.Add(string.Empty);
            text.Add(OneLine(content));
            html.Append("<p>").Append(Encode(content)).Append("</p>");
        }

        // A missing or blank value leaves its line out, like the legacy emails.
        public void Fields(params (string Label, string? Value)[] fields) => Write(false, false, fields);

        // Lines indented by two spaces in the text body, for the parts under a section heading.
        public void Indented(params (string Label, string? Value)[] fields) => Write(true, false, fields);

        // Values that may hold line breaks (notes): kept as lines in the text body.
        public void Multiline(params (string Label, string? Value)[] fields) => Write(false, true, fields);

        private void Write(bool indent, bool multiline, (string Label, string? Value)[] fields)
        {
            foreach (var (label, value) in fields)
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                if (!listOpen)
                {
                    html.Append("<ul>");
                    listOpen = true;
                }

                var flat = multiline ? value.ReplaceLineEndings("\n") : OneLine(value);
                text.Add((indent ? "  " : string.Empty) + label + ": " + flat);
                html.Append("<li><strong>").Append(Encode(label)).Append(":</strong> ").Append(Encode(value)).Append("</li>");
            }
        }

        private void CloseList()
        {
            if (listOpen)
            {
                html.Append("</ul>");
                listOpen = false;
            }
        }

        private static string Encode(string value) => WebUtility.HtmlEncode(value);
    }
}
