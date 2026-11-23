using ActionJackson.Data;

namespace ActionJackson.Api.Business;

// Where consultation and quote numbers come from. A seam so a test can force a collision; the unique
// index and the retry in UniqueNumber are what make a number safe, not this.
internal interface IDocumentNumbers
{
    string Next();
}

internal sealed class RandomDocumentNumbers : IDocumentNumbers
{
    public string Next() => UniqueNumber.RandomEightDigits();
}
