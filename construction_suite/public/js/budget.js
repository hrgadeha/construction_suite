// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

frappe.ui.form.on("Budget", {
	refresh(frm) {
		render_project_order_summary(frm);
	},
	project(frm) {
		render_project_order_summary(frm);
	},
	budget_against(frm) {
		render_project_order_summary(frm);
	},
});

function render_project_order_summary(frm) {
	const field = frm.fields_dict.custom_project_order_summary;
	if (!field) {
		return;
	}

	if (frm.doc.budget_against !== "Project" || !frm.doc.project) {
		field.$wrapper.empty();
		return;
	}

	field.$wrapper.html(`<div class="text-muted">${__("Loading Sales Orders...")}</div>`);

	frappe.db
		.get_list("Sales Order", {
			filters: { project: frm.doc.project, docstatus: ["!=", 2] },
			fields: ["name"],
			order_by: "transaction_date desc",
			limit_page_length: 0,
		})
		.then((rows) => {
			if (!rows.length) {
				field.$wrapper.html(
					`<div class="text-muted">${__("No Sales Orders found against this Project.")}</div>`
				);
				return;
			}

			Promise.all(rows.map((row) => frappe.db.get_doc("Sales Order", row.name))).then((sales_orders) => {
				const items_per_order = sales_orders.map((so) => so.items || []);
				field.$wrapper.html(build_project_order_summary_html(sales_orders, items_per_order));
			});
		});
}

function build_project_order_summary_html(sales_orders, items_per_order) {
	inject_project_order_summary_style();

	const grand_total_sum = sales_orders.reduce((sum, so) => sum + flt(so.grand_total), 0);
	const currency = sales_orders[0].currency;

	const orders_html = sales_orders
		.map((so, index) => build_sales_order_block_html(so, items_per_order[index]))
		.join("");

	return `
		<div class="pos-summary">
			<div class="pos-summary-total">
				${__("Total across {0} Sales Order(s)", [sales_orders.length])}:
				<b>${format_currency(grand_total_sum, currency)}</b>
			</div>
			${orders_html}
		</div>
	`;
}

function build_sales_order_block_html(so, items) {
	const items_html = (items || [])
		.map(
			(item) => `
				<tr>
					<td class="pos-d">${frappe.utils.escape_html(item.item_name || item.description || "")}</td>
					<td class="pos-c">${item.qty ?? ""}</td>
					<td class="pos-c">${frappe.utils.escape_html(item.uom || "")}</td>
					<td class="pos-r">${format_currency(item.rate || 0, so.currency)}</td>
					<td class="pos-r">${format_currency(item.amount || 0, so.currency)}</td>
				</tr>
			`
		)
		.join("");

	return `
		<div class="pos-order">
			<div class="pos-order-header">
				<a href="/app/sales-order/${encodeURIComponent(so.name)}" target="_blank">${frappe.utils.escape_html(so.name)}</a>
				&mdash; ${frappe.utils.escape_html(so.customer_name || "")}
				<span class="pos-order-meta">
					${frappe.datetime.str_to_user(so.transaction_date)} &middot; ${frappe.utils.escape_html(so.status || "")}
				</span>
				<span class="pos-order-total">${format_currency(so.grand_total || 0, so.currency)}</span>
			</div>
			<table class="pos-table">
				<thead>
					<tr>
						<th class="pos-d">${__("Item")}</th>
						<th class="pos-c">${__("Qty")}</th>
						<th class="pos-c">${__("UOM")}</th>
						<th class="pos-r">${__("Rate")}</th>
						<th class="pos-r">${__("Amount")}</th>
					</tr>
				</thead>
				<tbody>
					${items_html || `<tr><td colspan="5">${__("No items")}</td></tr>`}
				</tbody>
			</table>
		</div>
	`;
}

function inject_project_order_summary_style() {
	if (document.getElementById("pos-summary-style")) {
		return;
	}
	const style = document.createElement("style");
	style.id = "pos-summary-style";
	style.textContent = `
		.pos-summary-total { font-size: 13px; margin-bottom: 10px; }
		.pos-order { border: 1px solid var(--dark-borderRate-color, #d1d8dd); border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
		.pos-order-header { background: var(--subtle-fg, #f4f5f6); padding: 6px 10px; font-size: 12px; display: flex; align-items: center; gap: 10px; }
		.pos-order-meta { color: var(--text-muted, #8d99a6); }
		.pos-order-total { margin-left: auto; font-weight: 600; }
		.pos-table { width: 100%; border-collapse: collapse; font-size: 12px; }
		.pos-table th, .pos-table td { border-left: 1px solid var(--dark-border-color, #d1d8dd); border-right: 1px solid var(--dark-border-color, #d1d8dd); padding: 4px 10px; border-top: 1px solid var(--dark-border-color, #d1d8dd); }
		.pos-table th { text-align: left; }
		.pos-d { width: 50%; text-align: left; }
		.pos-c { width: 10%; text-align: left; }
		.pos-r { width: 15%; text-align: right; }
	`;
	document.head.appendChild(style);
}
