// Fictional sample data; integer cents keep every displayed amount exact.
(() => {
  const products = [
    { model: "DEMO-AC-100", description: "Indoor equipment assembly - illustrative unit", quantity: 2, uom: "set", cents: 125000 },
    { model: "DEMO-FM-020", description: "Replacement fan module - sample spare part", quantity: 3, uom: "pc", cents: 18500 },
    { model: "DEMO-CT-030", description: "Control module - sample spare part", quantity: 2, uom: "pc", cents: 24000 },
    { model: "DEMO-FL-040", description: "Filter pack - illustrative consumable", quantity: 6, uom: "pack", cents: 4500 },
    { model: "DEMO-MK-050", description: "Mounting kit - illustrative accessory", quantity: 4, uom: "set", cents: 6500 }
  ];
  // Forty-eight individually identified fictional supply lines exercise automatic pagination.
  const count = 48;
  const locations = ["Demo reception", "Demo office", "Demo workshop", "Demo store", "Demo service area", "Demo meeting room", "Demo training room", "Demo dispatch area", "Demo maintenance room", "Demo packing area"];
  const money = cents => (cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const anchor = document.getElementById("quotation-items");
  let subtotal = 0;
  for (let index = 0; index < count; index += 1) {
    const item = products[index % products.length];
    const amount = item.quantity * item.cents;
    subtotal += amount;
    const section = document.createElement("section");
    section.className = "paper_width prowitem";
    section.dataset.sampleRow = String(index + 1);
    const grid = document.createElement("div");
    grid.className = "item-grid item-row";
    [index + 1, item.description + ". Allocation: " + locations[Math.floor(index / products.length)] + ".", item.quantity, item.uom, money(item.cents), money(amount)].forEach((value, cell) => {
      const node = document.createElement("div");
      node.textContent = value;
      if ([2, 4, 5].includes(cell)) node.className = "num";
      if (cell === 1) {
        const model = document.createElement("strong");
        model.className = "model";
        model.textContent = item.model + "-" + String(index + 1).padStart(3, "0");
        node.prepend(model);
      }
      grid.append(node);
    });
    section.append(grid);
    anchor.before(section);
  }
  anchor.remove();
  const discount = Math.round(subtotal * 5 / 100);
  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("discount").textContent = "-" + money(discount);
  document.getElementById("total").textContent = money(subtotal - discount);
})();
