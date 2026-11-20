using System;
using ActionJackson.Core;
using ActionJackson.Data.Sql;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ActionJackson.Data.Migrations.Lan
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "lan");

            migrationBuilder.CreateTable(
                name: "attachments",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_type = table.Column<string>(type: "text", nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    object_key = table.Column<string>(type: "text", nullable: false),
                    file_name = table.Column<string>(type: "text", nullable: false),
                    content_type = table.Column<string>(type: "text", nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    sha256 = table.Column<string>(type: "char(64)", nullable: false),
                    uploaded_by = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_attachments", x => x.id);
                    table.CheckConstraint("ck_attachments_owner_type", "\"owner_type\" IN ('Quote', 'Invoice', 'Appointment')");
                    table.CheckConstraint("ck_attachments_sha256", "sha256 ~ '^[0-9a-f]{64}$'");
                    table.CheckConstraint("ck_attachments_size_bytes", "size_bytes >= 0");
                });

            migrationBuilder.CreateTable(
                name: "availability_rules",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    day_of_week = table.Column<short>(type: "smallint", nullable: false),
                    opens = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    closes = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    slot_minutes = table.Column<short>(type: "smallint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_availability_rules", x => x.id);
                    table.CheckConstraint("ck_availability_rules_day_of_week", "day_of_week BETWEEN 0 AND 6");
                    table.CheckConstraint("ck_availability_rules_hours", "closes > opens");
                    table.CheckConstraint("ck_availability_rules_slot_minutes", "slot_minutes > 0");
                });

            migrationBuilder.CreateTable(
                name: "blackout_dates",
                schema: "lan",
                columns: table => new
                {
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_blackout_dates", x => x.date);
                });

            migrationBuilder.CreateTable(
                name: "catalog_items",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    category = table.Column<string>(type: "text", nullable: false),
                    unit_type = table.Column<string>(type: "text", nullable: false),
                    unit_label = table.Column<string>(type: "text", nullable: false),
                    price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    threshold_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    material_cost = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    cost_unit_type = table.Column<string>(type: "text", nullable: true),
                    labor_hours = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    purchase_url = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_catalog_items", x => x.id);
                    table.CheckConstraint("ck_catalog_items_cost_unit_type", "\"cost_unit_type\" IN ('PerFoot', 'PerRun', 'PerUnit', 'FlatFee', 'Threshold')");
                    table.CheckConstraint("ck_catalog_items_unit_type", "\"unit_type\" IN ('PerFoot', 'PerRun', 'PerUnit', 'FlatFee', 'Threshold')");
                });

            migrationBuilder.CreateTable(
                name: "consultation_requests",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    request_number = table.Column<string>(type: "char(8)", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    source_ip = table.Column<string>(type: "text", nullable: false),
                    user_agent = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_consultation_requests", x => x.id);
                    table.CheckConstraint("ck_consultation_requests_details", "jsonb_typeof(\"details\") = 'object'");
                    table.CheckConstraint("ck_consultation_requests_request_number", "request_number ~ '^[0-9]{8}$'");
                    table.CheckConstraint("ck_consultation_requests_status", "\"status\" IN ('New', 'Contacted', 'ConsultationScheduled', 'Quoted', 'Booked', 'Completed', 'Closed')");
                });

            migrationBuilder.CreateTable(
                name: "customers",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    address_line1 = table.Column<string>(type: "text", nullable: true),
                    address_line2 = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    state = table.Column<string>(type: "text", nullable: true),
                    postal_code = table.Column<string>(type: "text", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_customers", x => x.id);
                    table.CheckConstraint("ck_customers_details", "jsonb_typeof(\"details\") = 'object'");
                });

            migrationBuilder.CreateTable(
                name: "service_packages",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    price_from = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    details = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_packages", x => x.id);
                    table.CheckConstraint("ck_service_packages_details", "jsonb_typeof(\"details\") = 'object'");
                });

            migrationBuilder.CreateTable(
                name: "testimonials",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    author = table.Column<string>(type: "text", nullable: false),
                    body = table.Column<string>(type: "text", nullable: false),
                    rating = table.Column<short>(type: "smallint", nullable: false),
                    is_published = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_testimonials", x => x.id);
                    table.CheckConstraint("ck_testimonials_rating", "rating BETWEEN 1 AND 5");
                });

            migrationBuilder.CreateTable(
                name: "catalog_item_components",
                schema: "lan",
                columns: table => new
                {
                    parent_id = table.Column<Guid>(type: "uuid", nullable: false),
                    component_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_catalog_item_components", x => new { x.parent_id, x.component_id });
                    table.CheckConstraint("ck_catalog_item_components_not_self", "parent_id <> component_id");
                    table.CheckConstraint("ck_catalog_item_components_quantity", "quantity > 0");
                    table.ForeignKey(
                        name: "fk_catalog_item_components_catalog_items_component_id",
                        column: x => x.component_id,
                        principalSchema: "lan",
                        principalTable: "catalog_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_catalog_item_components_catalog_items_parent_id",
                        column: x => x.parent_id,
                        principalSchema: "lan",
                        principalTable: "catalog_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "quotes",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_number = table.Column<string>(type: "char(8)", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    discount_percent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    subtotal = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    deposit = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quotes", x => x.id);
                    table.CheckConstraint("ck_quotes_amounts", "subtotal >= 0 AND total >= 0 AND deposit >= 0");
                    table.CheckConstraint("ck_quotes_details", "jsonb_typeof(\"details\") = 'object'");
                    table.CheckConstraint("ck_quotes_discount_percent", "discount_percent BETWEEN 0 AND 100");
                    table.CheckConstraint("ck_quotes_quote_number", "quote_number ~ '^[0-9]{8}$'");
                    table.CheckConstraint("ck_quotes_status", "\"status\" IN ('Pending', 'Reviewed', 'Approved', 'Rejected', 'Completed')");
                    table.ForeignKey(
                        name: "fk_quotes_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "lan",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "appointments",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_id = table.Column<Guid>(type: "uuid", nullable: true),
                    kind = table.Column<string>(type: "text", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    source_ip = table.Column<string>(type: "text", nullable: true),
                    user_agent = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_appointments", x => x.id);
                    table.CheckConstraint("ck_appointments_details", "jsonb_typeof(\"details\") = 'object'");
                    table.CheckConstraint("ck_appointments_ends_after_starts", "ends_at > starts_at");
                    table.CheckConstraint("ck_appointments_status", "\"status\" IN ('Scheduled', 'Confirmed', 'InProgress', 'Completed', 'Cancelled', 'NoShow', 'NeedsReview')");
                    table.ForeignKey(
                        name: "fk_appointments_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "lan",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_appointments_quotes_quote_id",
                        column: x => x.quote_id,
                        principalSchema: "lan",
                        principalTable: "quotes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "invoices",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_number = table.Column<string>(type: "text", nullable: false),
                    quote_id = table.Column<Guid>(type: "uuid", nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    issued_on = table.Column<DateOnly>(type: "date", nullable: true),
                    due_on = table.Column<DateOnly>(type: "date", nullable: true),
                    subtotal = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    discount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoices", x => x.id);
                    table.CheckConstraint("ck_invoices_amounts", "subtotal >= 0 AND discount >= 0 AND total >= 0");
                    table.CheckConstraint("ck_invoices_status", "\"status\" IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')");
                    table.ForeignKey(
                        name: "fk_invoices_customers_customer_id",
                        column: x => x.customer_id,
                        principalSchema: "lan",
                        principalTable: "customers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_invoices_quotes_quote_id",
                        column: x => x.quote_id,
                        principalSchema: "lan",
                        principalTable: "quotes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "quote_lines",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    quote_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    description = table.Column<string>(type: "text", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    is_labor = table.Column<bool>(type: "boolean", nullable: false),
                    labor_hours = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_quote_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_quote_lines_catalog_items_catalog_item_id",
                        column: x => x.catalog_item_id,
                        principalSchema: "lan",
                        principalTable: "catalog_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_quote_lines_quotes_quote_id",
                        column: x => x.quote_id,
                        principalSchema: "lan",
                        principalTable: "quotes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "appointment_history",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    appointment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    actor = table.Column<string>(type: "text", nullable: false),
                    from_status = table.Column<string>(type: "text", nullable: true),
                    to_status = table.Column<string>(type: "text", nullable: false),
                    from_starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    to_starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_appointment_history", x => x.id);
                    table.CheckConstraint("ck_appointment_history_from_status", "\"from_status\" IN ('Scheduled', 'Confirmed', 'InProgress', 'Completed', 'Cancelled', 'NoShow', 'NeedsReview')");
                    table.CheckConstraint("ck_appointment_history_to_status", "\"to_status\" IN ('Scheduled', 'Confirmed', 'InProgress', 'Completed', 'Cancelled', 'NoShow', 'NeedsReview')");
                    table.ForeignKey(
                        name: "fk_appointment_history_appointments_appointment_id",
                        column: x => x.appointment_id,
                        principalSchema: "lan",
                        principalTable: "appointments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "invoice_lines",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    catalog_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    description = table.Column<string>(type: "text", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    is_labor = table.Column<bool>(type: "boolean", nullable: false),
                    labor_hours = table.Column<decimal>(type: "numeric(6,2)", precision: 6, scale: 2, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_lines", x => x.id);
                    table.ForeignKey(
                        name: "fk_invoice_lines_catalog_items_catalog_item_id",
                        column: x => x.catalog_item_id,
                        principalSchema: "lan",
                        principalTable: "catalog_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_invoice_lines_invoices_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "lan",
                        principalTable: "invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "lan",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    invoice_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    paid_on = table.Column<DateOnly>(type: "date", nullable: false),
                    method = table.Column<string>(type: "text", nullable: false),
                    reference = table.Column<string>(type: "text", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                    table.CheckConstraint("ck_payments_amount", "amount > 0");
                    table.CheckConstraint("ck_payments_method", "\"method\" IN ('Cash', 'Check', 'Card', 'BankTransfer', 'Other')");
                    table.ForeignKey(
                        name: "fk_payments_invoices_invoice_id",
                        column: x => x.invoice_id,
                        principalSchema: "lan",
                        principalTable: "invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_appointment_history_appointment_id",
                schema: "lan",
                table: "appointment_history",
                column: "appointment_id");

            migrationBuilder.CreateIndex(
                name: "ix_appointments_customer_id",
                schema: "lan",
                table: "appointments",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_appointments_quote_id",
                schema: "lan",
                table: "appointments",
                column: "quote_id",
                unique: true,
                filter: "quote_id IS NOT NULL AND status IN ('Scheduled', 'Confirmed', 'InProgress')");

            migrationBuilder.CreateIndex(
                name: "ix_attachments_object_key",
                schema: "lan",
                table: "attachments",
                column: "object_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_attachments_owner_type_owner_id",
                schema: "lan",
                table: "attachments",
                columns: new[] { "owner_type", "owner_id" });

            migrationBuilder.CreateIndex(
                name: "ix_catalog_item_components_component_id",
                schema: "lan",
                table: "catalog_item_components",
                column: "component_id");

            migrationBuilder.CreateIndex(
                name: "ix_catalog_items_code",
                schema: "lan",
                table: "catalog_items",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_consultation_requests_request_number",
                schema: "lan",
                table: "consultation_requests",
                column: "request_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoice_lines_catalog_item_id",
                schema: "lan",
                table: "invoice_lines",
                column: "catalog_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_lines_invoice_id",
                schema: "lan",
                table: "invoice_lines",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_customer_id",
                schema: "lan",
                table: "invoices",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoices_invoice_number",
                schema: "lan",
                table: "invoices",
                column: "invoice_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invoices_quote_id",
                schema: "lan",
                table: "invoices",
                column: "quote_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_payments_invoice_id",
                schema: "lan",
                table: "payments",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "ix_quote_lines_catalog_item_id",
                schema: "lan",
                table: "quote_lines",
                column: "catalog_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_quote_lines_quote_id",
                schema: "lan",
                table: "quote_lines",
                column: "quote_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotes_customer_id",
                schema: "lan",
                table: "quotes",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_quotes_quote_number",
                schema: "lan",
                table: "quotes",
                column: "quote_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_service_packages_code",
                schema: "lan",
                table: "service_packages",
                column: "code",
                unique: true);

            // What EF's model cannot express. The same helpers build both business schemas' SQL.
            migrationBuilder.Sql(BusinessSchemaSql.NoOverlap("lan", AppointmentStatuses.Blocking));
            migrationBuilder.Sql(BusinessSchemaSql.CustomerEmailIndex("lan"));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "appointment_history",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "attachments",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "availability_rules",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "blackout_dates",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "catalog_item_components",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "consultation_requests",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "invoice_lines",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "quote_lines",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "service_packages",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "testimonials",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "appointments",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "invoices",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "catalog_items",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "quotes",
                schema: "lan");

            migrationBuilder.DropTable(
                name: "customers",
                schema: "lan");
        }
    }
}
