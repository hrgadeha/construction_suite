// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

const BUDGET_STATUS = {
	good: {
		fill: "var(--green-500)",
		track: "var(--green-50)",
		text: "var(--green-600)",
		icon: "trending-up",
		label: __("On Track"),
	},
	warning: {
		fill: "var(--orange-500)",
		track: "var(--orange-50)",
		text: "var(--orange-600)",
		icon: "triangle-alert",
		label: __("Near Limit"),
	},
	critical: {
		fill: "var(--red-500)",
		track: "var(--red-50)",
		text: "var(--red-600)",
		icon: "trending-down",
		label: __("Over Budget"),
	},
};

frappe.ui.form.on("Project", {
	refresh(frm) {
		render_budget_summary(frm);
		set_budget_and_purchase_buttons(frm);
	},
});

function set_budget_and_purchase_buttons(frm) {
	if (frm.is_new()) {
		return;
	}

	// merge (not overwrite) in case another app's `setup` handler also set make_methods
	frm.make_methods = Object.assign({}, frm.make_methods, {
		Budget: () => make_project_budget(frm),
	});

	if (frappe.model.can_create("Budget")) {
		frm.add_custom_button(__("Budget"), () => frm.make_new("Budget"), __("Create"));
	}
	if (frappe.model.can_create("Purchase Order")) {
		frm.add_custom_button(__("Purchase Order"), () => frm.make_new("Purchase Order"), __("Create"));
	}
}

function make_project_budget(frm) {
	const fiscal_year = erpnext.utils.get_fiscal_year(frappe.datetime.get_today());
	frappe.route_options = {
		budget_against: "Project",
		project: frm.doc.name,
		company: frm.doc.company,
		from_fiscal_year: fiscal_year,
		to_fiscal_year: fiscal_year,
	};
	frappe.new_doc("Budget");
}

function render_budget_summary(frm) {
	const field = frm.fields_dict.custom_budget_summary;
	if (!field) {
		return;
	}

	if (frm.is_new()) {
		field.$wrapper.empty();
		return;
	}

	inject_budget_summary_style();
	field.$wrapper.html(build_budget_loading_html());

	frappe.call({
		method: "construction_suite.construction_suite.api.project.get_project_budget_summary",
		args: { project: frm.doc.name },
		callback: (r) => {
			field.$wrapper.html(build_budget_summary_html(frm, r.message || []));
			field.$wrapper.find(".budget-empty-cta").on("click", () => make_project_budget(frm));

			const currency = frm.doc.currency || frappe.defaults.get_default("currency");
			field.$wrapper.find(".budget-row-toggle").on("click", function () {
				toggle_budget_transactions($(this).closest(".budget-row"), currency);
			});
		},
	});
}

function toggle_budget_transactions($row, currency) {
	const budget_name = $row.data("budget");
	const $toggle = $row.find(".budget-row-toggle");
	const $container = $row.find(".budget-row-transactions");
	const is_open = $row.hasClass("budget-row-expanded");

	if (is_open) {
		$row.removeClass("budget-row-expanded");
		$toggle.html(frappe.utils.icon("chevron-right", "xs"));
		$container.slideUp(150);
		return;
	}

	$row.addClass("budget-row-expanded");
	$toggle.html(frappe.utils.icon("chevron-down", "xs"));

	if ($container.data("loaded")) {
		$container.slideDown(150);
		return;
	}

	$container.html(`<div class="budget-txn-loading">${__("Loading transactions...")}</div>`).show();

	frappe.call({
		method: "construction_suite.construction_suite.api.project.get_budget_transactions",
		args: { budget: budget_name },
		callback: (r) => {
			$container.data("loaded", true);
			$container.html(build_transactions_html(r.message || [], currency));
		},
	});
}

const BUDGET_SEVERITY_ORDER = { critical: 0, warning: 1, good: 2 };

function get_budget_status(budget_amount, actual_amount) {
	const percent = budget_amount ? (actual_amount / budget_amount) * 100 : actual_amount > 0 ? 100 : 0;
	const key = percent > 100 ? "critical" : percent > 80 ? "warning" : "good";
	return { percent, key, ...BUDGET_STATUS[key] };
}

function negative_marker(is_negative) {
	return is_negative
		? `<span class="budget-negative-icon">${frappe.utils.icon("trending-down", "xs")}</span>`
		: "";
}

function build_budget_loading_html() {
	return `
		<div class="budget-summary budget-summary-loading">
			<div class="budget-skeleton-stats">
				${Array(3).fill('<div class="budget-skeleton budget-skeleton-tile"></div>').join("")}
			</div>
			<div class="budget-skeleton budget-skeleton-bar"></div>
		</div>
	`;
}

function build_budget_summary_html(frm, budgets) {
	const currency = frm.doc.currency || frappe.defaults.get_default("currency");

	if (!budgets.length) {
		return `
			<div class="budget-summary">
				<div class="budget-empty">
					<div class="budget-empty-icon">${frappe.utils.icon("wallet", "lg")}</div>
					<div class="budget-empty-text">${__("No submitted Budget raised against this Project yet.")}</div>
					<button type="button" class="btn btn-default btn-sm budget-empty-cta">
						${frappe.utils.icon("plus", "xs")} ${__("Create Budget")}
					</button>
				</div>
			</div>
		`;
	}

	const total_budget = budgets.reduce((sum, b) => sum + flt(b.budget_amount), 0);
	const actual_spend = budgets.reduce((sum, b) => sum + flt(b.actual_amount), 0);
	const remaining = total_budget - actual_spend;
	const overall = get_budget_status(total_budget, actual_spend);
	const overall_percent = Math.min(overall.percent, 100);

	const rows = budgets
		.map((b) => ({ b, status: get_budget_status(flt(b.budget_amount), flt(b.actual_amount)) }))
		.sort((a, c) => {
			const severity_diff = BUDGET_SEVERITY_ORDER[a.status.key] - BUDGET_SEVERITY_ORDER[c.status.key];
			return severity_diff !== 0 ? severity_diff : c.status.percent - a.status.percent;
		});
	const over_budget_count = rows.filter((row) => row.status.key === "critical").length;
	const near_limit_count = rows.filter((row) => row.status.key === "warning").length;

	return `
		<div class="budget-summary">
			<div class="budget-summary-stats">
				<div class="budget-tile">
					<div class="budget-tile-icon" style="background: var(--blue-50); color: var(--blue-500);">
						${frappe.utils.icon("wallet", "md")}
					</div>
					<div>
						<div class="budget-stat-label">${__("Total Budget")}</div>
						<div class="budget-stat-value">${format_currency(total_budget, currency)}</div>
					</div>
				</div>
				<div class="budget-tile">
					<div class="budget-tile-icon" style="background: ${overall.track}; color: ${overall.fill};">
						${frappe.utils.icon("receipt", "md")}
					</div>
					<div>
						<div class="budget-stat-label">${__("Actual Spend")}</div>
						<div class="budget-stat-value">${format_currency(actual_spend, currency)}</div>
					</div>
				</div>
				<div class="budget-tile">
					<div class="budget-tile-icon" style="background: ${overall.track}; color: ${overall.fill};">
						${frappe.utils.icon("coins", "md")}
					</div>
					<div>
						<div class="budget-stat-label">${__("Remaining")}</div>
						<div class="budget-stat-value" style="color: ${remaining < 0 ? "var(--red-600)" : "inherit"};">
							${negative_marker(remaining < 0)}${format_currency(remaining, currency)}
						</div>
					</div>
				</div>
			</div>

			<div class="budget-meter-block">
				<div class="budget-meter-header">
					<span class="budget-status-pill" style="background: ${overall.track}; color: ${overall.text};">
						${frappe.utils.icon(overall.icon, "xs")} ${overall.label}
					</span>
					<span class="budget-meter-percent" style="color: ${overall.text};">
						${overall.percent.toFixed(1)}% ${__("consumed")}
					</span>
				</div>
				<div class="budget-bar-track" style="background: ${overall.track};"
					title="${__("Spent {0} of {1} budget", [format_currency(actual_spend, currency), format_currency(total_budget, currency)])}">
					<div class="budget-bar-fill" style="width: ${overall_percent}%; background: ${overall.fill};"></div>
				</div>
			</div>

			<div class="budget-accounts">
				<div class="budget-accounts-header">
					<span class="budget-accounts-title">${__("Expense Heads")}</span>
					${build_risk_summary_html(over_budget_count, near_limit_count)}
				</div>
				${rows.map((row) => build_budget_row_html(row.b, row.status, currency)).join("")}
			</div>
		</div>
	`;
}

function build_risk_summary_html(over_budget_count, near_limit_count) {
	if (!over_budget_count && !near_limit_count) {
		return `<span class="budget-risk-summary budget-risk-ok">${frappe.utils.icon(
			"trending-up",
			"xs"
		)} ${__("All within budget")}</span>`;
	}

	const parts = [];
	if (over_budget_count) {
		parts.push(__("{0} over budget", [over_budget_count]));
	}
	if (near_limit_count) {
		parts.push(__("{0} near limit", [near_limit_count]));
	}

	return `
		<span class="budget-risk-summary ${over_budget_count ? "budget-risk-critical" : "budget-risk-warning"}">
			${frappe.utils.icon(over_budget_count ? "trending-down" : "triangle-alert", "xs")} ${parts.join(" · ")}
		</span>
	`;
}

function build_budget_row_html(b, status, currency) {
	const budget_amount = flt(b.budget_amount);
	const actual_amount = flt(b.actual_amount);
	const row_remaining = budget_amount - actual_amount;
	const row_percent = Math.min(status.percent, 100);

	return `
		<div class="budget-row" data-budget="${frappe.utils.escape_html(b.name)}">
			<div class="budget-row-top">
				<span class="budget-row-toggle">${frappe.utils.icon("chevron-right", "xs")}</span>
				<a class="budget-row-account" href="/app/budget/${encodeURIComponent(b.name)}" target="_blank">
					${frappe.utils.escape_html(b.account || b.name)}
				</a>
				<span class="budget-row-percent" style="color: ${status.text};">${status.percent.toFixed(0)}%</span>
			</div>
			<div class="budget-bar-track budget-bar-track-sm" style="background: ${status.track};"
				title="${__("Spent {0} of {1} budgeted", [format_currency(actual_amount, currency), format_currency(budget_amount, currency)])}">
				<div class="budget-bar-fill" style="width: ${row_percent}%; background: ${status.fill};"></div>
			</div>
			<div class="budget-row-figures">
				<div class="budget-row-figure">
					<span class="budget-row-figure-label">${__("Budgeted")}</span>
					<span class="budget-row-figure-value">${format_currency(budget_amount, currency)}</span>
				</div>
				<div class="budget-row-figure">
					<span class="budget-row-figure-label">${__("Spent")}</span>
					<span class="budget-row-figure-value">${format_currency(actual_amount, currency)}</span>
				</div>
				<div class="budget-row-figure">
					<span class="budget-row-figure-label">${__("Remaining")}</span>
					<span class="budget-row-figure-value" style="color: ${row_remaining < 0 ? "var(--red-600)" : "inherit"};">
						${negative_marker(row_remaining < 0)}${format_currency(row_remaining, currency)}
					</span>
				</div>
			</div>
			<div class="budget-row-transactions"></div>
		</div>
	`;
}

function build_transactions_html(rows, currency) {
	if (!rows.length) {
		return `<div class="budget-txn-empty">${__("No transactions found for this expense head.")}</div>`;
	}

	return `
		<table class="budget-txn-table">
			<thead>
				<tr>
					<th>${__("Voucher")}</th>
					<th>${__("Date")}</th>
					<th>${__("Description")}</th>
					<th class="budget-r">${__("Qty")}</th>
					<th>${__("UOM")}</th>
					<th class="budget-r">${__("Rate")}</th>
					<th class="budget-r">${__("Amount")}</th>
				</tr>
			</thead>
			<tbody>
				${rows.map((row) => build_transaction_row_html(row, currency)).join("")}
			</tbody>
		</table>
	`;
}

function build_transaction_row_html(row, currency) {
	const doctype_route = frappe.router.slug(row.voucher_type);
	return `
		<tr>
			<td>
				<a href="/app/${doctype_route}/${encodeURIComponent(row.voucher_no)}" target="_blank">
					${frappe.utils.escape_html(row.voucher_no)}
				</a>
				<div class="budget-txn-type">${frappe.utils.escape_html(__(row.voucher_type))}${
					row.party ? " · " + frappe.utils.escape_html(row.party) : ""
				}</div>
			</td>
			<td>${row.posting_date ? frappe.datetime.str_to_user(row.posting_date) : "-"}</td>
			<td>${frappe.utils.escape_html(row.description || "-")}</td>
			<td class="budget-r">${row.qty != null ? row.qty : "-"}</td>
			<td>${row.uom ? frappe.utils.escape_html(row.uom) : "-"}</td>
			<td class="budget-r">${row.rate != null ? format_currency(row.rate, currency) : "-"}</td>
			<td class="budget-r">${format_currency(row.amount, currency)}</td>
		</tr>
	`;
}

function inject_budget_summary_style() {
	if (document.getElementById("budget-summary-style")) {
		return;
	}
	const style = document.createElement("style");
	style.id = "budget-summary-style";
	style.textContent = `
		.budget-summary {
			padding: 16px;
			background: var(--subtle-fg);
			border: 1px solid var(--border-color);
			border-radius: var(--border-radius-lg, 10px);
		}

		.budget-summary-stats { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
		.budget-tile {
			flex: 1 1 180px;
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 12px 14px;
			border-radius: var(--border-radius-md, 8px);
			background: var(--card-bg, var(--fg-color));
			border: 1px solid var(--border-color, var(--dark-border-color));
			transition: box-shadow 0.15s ease;
		}
		.budget-tile:hover { box-shadow: var(--shadow-sm); }
		.budget-tile-icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 34px;
			height: 34px;
			border-radius: var(--border-radius-md, 8px);
			flex-shrink: 0;
		}
		.budget-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
		.budget-stat-value { font-size: 17px; font-weight: 600; line-height: 1.4; }

		.budget-meter-block { margin-bottom: 20px; }
		.budget-meter-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
		.budget-status-pill {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
			font-weight: 600;
			padding: 2px 8px;
			border-radius: var(--border-radius-full, 999px);
		}
		.budget-meter-percent { font-size: 12px; font-weight: 500; }

		.budget-bar-track { position: relative; height: 10px; border-radius: var(--border-radius-full, 999px); overflow: hidden; }
		.budget-bar-track-sm { height: 6px; }
		.budget-bar-fill { height: 100%; border-radius: var(--border-radius-full, 999px); transition: width 0.4s ease; }

		.budget-negative-icon { display: inline-flex; vertical-align: -1px; margin-right: 2px; }

		.budget-accounts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
		.budget-accounts-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
		.budget-risk-summary { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; }
		.budget-risk-ok { color: var(--green-600); }
		.budget-risk-warning { color: var(--orange-600); }
		.budget-risk-critical { color: var(--red-600); }

		.budget-accounts { display: flex; flex-direction: column; gap: 4px; }
		.budget-row {
			padding: 10px 12px;
			border-radius: var(--border-radius-md, 8px);
			transition: background 0.15s ease;
		}
		.budget-row:hover { background: var(--subtle-fg); }
		.budget-row-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
		.budget-row-toggle { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); flex-shrink: 0; }
		.budget-row-account { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-color); }
		.budget-row-account:hover { color: var(--blue-500); }
		.budget-row-percent { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }

		.budget-row-figures { display: flex; gap: 20px; margin-top: 8px; flex-wrap: wrap; }
		.budget-row-figure { display: flex; flex-direction: column; gap: 1px; }
		.budget-row-figure-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
		.budget-row-figure-value { font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }

		.budget-row-transactions { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); overflow-x: auto; }
		.budget-txn-loading, .budget-txn-empty { font-size: 12px; color: var(--text-muted); padding: 6px 0; }
		.budget-txn-table { width: 100%; border-collapse: collapse; font-size: 12px; }
		.budget-txn-table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-muted); padding: 0 8px 6px; font-weight: 600; }
		.budget-txn-table td { padding: 6px 8px; border-top: 1px solid var(--border-color); vertical-align: top; font-variant-numeric: tabular-nums; }
		.budget-txn-table tr:first-child td { border-top: none; }
		.budget-txn-type { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
		.budget-r { text-align: right; }

		.budget-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px 4px; color: var(--text-muted); }
		.budget-empty-icon { color: var(--text-muted); opacity: 0.6; }
		.budget-empty-cta { display: inline-flex; align-items: center; gap: 4px; }

		.budget-skeleton { background: var(--subtle-fg); border-radius: var(--border-radius-md, 8px); animation: budget-pulse 1.2s ease-in-out infinite; }
		.budget-skeleton-stats { display: flex; gap: 12px; margin-bottom: 18px; }
		.budget-skeleton-tile { flex: 1 1 180px; height: 58px; }
		.budget-skeleton-bar { height: 16px; }
		@keyframes budget-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
	`;
	document.head.appendChild(style);
}
