using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ActionJackson.Data.Migrations.Core
{
    /// <inheritdoc />
    public partial class AddEdgeReceiptRequestHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "request_hash",
                schema: "core",
                table: "edge_receipts",
                type: "text",
                nullable: false,
                defaultValue: "");

            // The default only fills the rows that already exist (an empty hash never matches a request).
            // Without it a writer that forgets the hash would store an empty one without an error.
            migrationBuilder.Sql("ALTER TABLE core.edge_receipts ALTER COLUMN request_hash DROP DEFAULT");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "request_hash",
                schema: "core",
                table: "edge_receipts");
        }
    }
}
