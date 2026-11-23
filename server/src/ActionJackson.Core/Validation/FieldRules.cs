using System.Globalization;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace ActionJackson.Core.Validation;

// The checks the forms share. Each adds a fixed sentence to the errors under the field's JSON path.
internal static class FieldRules
{
    // A required, single-line text of 1 to max characters, after trimming.
    public static string? RequiredLine(ValidationErrors errors, string path, string? value, int max, string label)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            errors.Add(path, $"{label} is required.");
            return null;
        }

        return Line(errors, path, text, max, label);
    }

    // An optional single-line text of at most max characters: null or blank is fine and gives null.
    public static string? OptionalLine(ValidationErrors errors, string path, string? value, int max, string label)
    {
        var text = value?.Trim();
        return string.IsNullOrEmpty(text) ? null : Line(errors, path, text, max, label);
    }

    // An optional text that may span lines (notes): tab and line breaks are allowed, other control
    // characters are not.
    public static string? OptionalText(ValidationErrors errors, string path, string? value, int max, string label)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (text.Length > max)
        {
            errors.Add(path, $"{label} must be at most {max} characters.");
            return null;
        }

        if (!IsWellFormed(text) || text.Any(c => char.IsControl(c) && c is not ('\n' or '\r' or '\t')))
        {
            errors.Add(path, $"{label} has characters that are not allowed.");
            return null;
        }

        return text;
    }

    public static bool InList(ValidationErrors errors, string path, string? value, IReadOnlyList<Option> list, string label)
    {
        if (list.Has(value))
        {
            return true;
        }

        errors.Add(path, $"Select a valid {label}.");
        return false;
    }

    // An optional choice: null is fine, any other text must be in the list.
    public static void OptionalInList(ValidationErrors errors, string path, string? value, IReadOnlyList<Option> list, string label)
    {
        if (value is not null)
        {
            InList(errors, path, value, list, label);
        }
    }

    // A list of choices: at most max entries (and at least min), each in the list, none twice.
    public static void ChoiceList(
        ValidationErrors errors,
        string path,
        List<string?>? values,
        IReadOnlyList<Option> list,
        int min,
        int max,
        string label)
    {
        var count = values?.Count ?? 0;
        if (count < min || count > max)
        {
            errors.Add(path, min == 0
                ? $"Select at most {max} {label}."
                : $"Select between {min} and {max} {label}.");
        }

        if (values is null)
        {
            return;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < values.Count; i++)
        {
            var item = $"{path}[{i.ToString(CultureInfo.InvariantCulture)}]";
            if (!list.Has(values[i]))
            {
                errors.Add(item, $"Select a valid {label} option.");
            }
            else if (!seen.Add(values[i]!))
            {
                errors.Add(item, $"Each {label} option can be chosen once.");
            }
        }
    }

    public static void Honeypot(ValidationErrors errors, string? value)
    {
        if (!string.IsNullOrEmpty(value))
        {
            errors.Add("honeypot", "Bot detection triggered.");
        }
    }

    // A count of 0 to the limit. Null means none.
    public static void Count(ValidationErrors errors, string path, int? value, IntRange range, string label)
    {
        if (value is { } count && !range.Contains(count))
        {
            errors.Add(path, $"{label} must be between {range.Min} and {range.Max}.");
        }
    }

    // False for half of a surrogate pair: the database cannot store it, and the driver would fail on it.
    public static bool IsWellFormed(string text)
    {
        for (var i = 0; i < text.Length; i++)
        {
            if (char.IsHighSurrogate(text[i]))
            {
                if (i + 1 >= text.Length || !char.IsLowSurrogate(text[i + 1]))
                {
                    return false;
                }

                i++;
            }
            else if (char.IsLowSurrogate(text[i]))
            {
                return false;
            }
        }

        return true;
    }

    // No control character, line separator or half of a surrogate pair (which the database cannot store).
    public static bool IsSingleLine(string text) =>
        IsWellFormed(text) && !text.Any(c => char.IsControl(c) || c is '\u2028' or '\u2029');

    private static string? Line(ValidationErrors errors, string path, string text, int max, string label)
    {
        if (text.Length > max)
        {
            errors.Add(path, $"{label} must be at most {max} characters.");
            return null;
        }

        if (!IsSingleLine(text))
        {
            errors.Add(path, $"{label} has characters that are not allowed.");
            return null;
        }

        return text;
    }
}

// The customer part of every public form: name, email, phone.
public static partial class CustomerRules
{
    public const int MaxEmailLength = 254;

    // The legacy list (routes/consultations.js), compared lower-case, and any subdomain of one.
    private static readonly string[] DisposableDomains =
    [
        "10minutemail.com", "mailinator.com", "guerrillamail.com", "tempmail.org", "temp-mail.org", "0-mail.com",
    ];

    // Characters that make an address more than one plain mailbox (a display name, a list, a comment, a
    // quoted part, a route). The address we store is what we send to, so none of them is accepted.
    private const string AddressForbidden = "\"<>(),;:\\[]";

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    internal static void Validate(CustomerInput? customer, ValidationErrors errors, string prefix = "customer")
    {
        ValidateName(errors, $"{prefix}.name", customer?.Name);
        ValidateEmail(errors, $"{prefix}.email", customer?.Email);
        ValidatePhone(errors, $"{prefix}.phone", customer?.Phone);
    }

    // Trimmed, 2 to 100 characters: letters (any script), single spaces, apostrophes and hyphens.
    private static void ValidateName(ValidationErrors errors, string path, string? value)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length < 2 || name.Length > 100)
        {
            errors.Add(path, "Name must be between 2 and 100 characters.");
        }
        else if (!NameShape().IsMatch(name) || !name.Any(char.IsLetter))
        {
            errors.Add(path, "Name can only contain letters, single spaces, apostrophes and hyphens.");
        }
    }

    internal static void ValidateEmail(ValidationErrors errors, string path, string? value)
    {
        var email = value?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > MaxEmailLength || !IsPlainAddress(email))
        {
            errors.Add(path, "Enter a valid email address.");
        }
        else if (IsDisposable(email[(email.LastIndexOf('@') + 1)..]))
        {
            errors.Add(path, "Please use a valid business email address.");
        }
    }

    private static bool IsPlainAddress(string email)
    {
        if (!FieldRules.IsWellFormed(email) || email.Any(c => char.IsControl(c) || char.IsWhiteSpace(c) || AddressForbidden.Contains(c)))
        {
            return false;
        }

        var at = email.LastIndexOf('@');
        if (at < 1 || at != email.IndexOf('@') || at > 64)
        {
            return false;
        }

        var labels = email[(at + 1)..].Split('.');
        if (labels.Length < 2 || labels.Any(label => label.Length is 0 or > 63))
        {
            return false;
        }

        return MailAddress.TryCreate(email, out var parsed)
            && string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsDisposable(string domain)
    {
        var lower = domain.ToLowerInvariant();
        return DisposableDomains.Any(disposable =>
            lower == disposable || lower.EndsWith("." + disposable, StringComparison.Ordinal));
    }

    // Optional. Blank means none. Otherwise 7 to 20 of: digits, space, parentheses, plus, hyphen.
    internal static void ValidatePhone(ValidationErrors errors, string path, string? value)
    {
        var phone = value?.Trim();
        if (!string.IsNullOrEmpty(phone) && !PhoneShape().IsMatch(phone))
        {
            errors.Add(path, "Please enter a valid phone number.");
        }
    }

    [GeneratedRegex(@"^[\p{L}\p{M}'-]+( [\p{L}\p{M}'-]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex NameShape();

    [GeneratedRegex("^[0-9 ()+-]{7,20}$", RegexOptions.CultureInvariant)]
    private static partial Regex PhoneShape();
}
