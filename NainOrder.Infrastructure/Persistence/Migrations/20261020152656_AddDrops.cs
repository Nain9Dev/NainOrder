using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NainOrder.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDrops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Drops",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProductId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ProductName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    ProductSku = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    UnitPrice = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalUnits = table.Column<int>(type: "INTEGER", nullable: false),
                    OpensAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PerBuyerLimit = table.Column<int>(type: "INTEGER", nullable: false),
                    HoldSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Drops", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Drops_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Holds",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    DropId = table.Column<Guid>(type: "TEXT", nullable: false),
                    BuyerToken = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    State = table.Column<int>(type: "INTEGER", nullable: false),
                    OrderId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Holds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Holds_Drops_DropId",
                        column: x => x.DropId,
                        principalTable: "Drops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Drops_CreatedAt",
                table: "Drops",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Drops_ProductId",
                table: "Drops",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Holds_DropId_BuyerToken",
                table: "Holds",
                columns: new[] { "DropId", "BuyerToken" });

            migrationBuilder.CreateIndex(
                name: "IX_Holds_State_ExpiresAt",
                table: "Holds",
                columns: new[] { "State", "ExpiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Holds");

            migrationBuilder.DropTable(
                name: "Drops");
        }
    }
}
