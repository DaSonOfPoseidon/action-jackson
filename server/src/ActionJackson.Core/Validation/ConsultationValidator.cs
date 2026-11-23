namespace ActionJackson.Core.Validation;

// Checks a consultation request against the contract. Pure: no I/O, no ASP.NET types.
public static class ConsultationValidator
{
    private const int MaxIspLength = 200;
    private const int MaxIssues = 8;
    private const int MaxServices = 4;

    public static ValidationErrors Validate(ConsultationInput? input, SiteOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var errors = new ValidationErrors();
        var choices = options.Consultation;

        CustomerRules.Validate(input?.Customer, errors);
        FieldRules.InList(errors, "property.squareFootage", input?.Property?.SquareFootage, choices.SquareFootage, "square footage range");
        FieldRules.OptionalLine(errors, "property.isp", input?.Property?.Isp, MaxIspLength, "ISP name");
        FieldRules.ChoiceList(errors, "property.currentIssues", input?.Property?.CurrentIssues, choices.CurrentIssues, 0, MaxIssues, "current issues");
        FieldRules.ChoiceList(errors, "interestedServices", input?.InterestedServices, choices.InterestedServices, 1, MaxServices, "services");
        FieldRules.OptionalInList(errors, "interestedPackage", input?.InterestedPackage, choices.InterestedPackage, "package");
        FieldRules.Honeypot(errors, input?.Honeypot);
        return errors;
    }
}
