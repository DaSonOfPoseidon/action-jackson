namespace ActionJackson.Core.Validation;

// What a validator found: messages keyed by the JSON path of the field ("customer.email",
// "property.currentIssues[2]"). The messages are fixed sentences: they never repeat the client's input.
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> errors = new(StringComparer.Ordinal);

    public bool IsValid => errors.Count == 0;

    public IReadOnlyCollection<string> Keys => errors.Keys;

    public void Add(string path, string message)
    {
        if (!errors.TryGetValue(path, out var messages))
        {
            errors[path] = messages = [];
        }

        if (!messages.Contains(message))
        {
            messages.Add(message);
        }
    }

    public Dictionary<string, string[]> ToDictionary() =>
        errors.ToDictionary(error => error.Key, error => error.Value.ToArray(), StringComparer.Ordinal);
}
