// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation", {
	refresh(frm) {
		add_merged_pdf_button(frm);
		render_boq_summary(frm);
	},
	bill_of_quantities(frm) {
		render_boq_summary(frm);
	},
});

function add_merged_pdf_button(frm) {
	if (frm.is_new()) {
		return;
	}
	frm.add_custom_button(__("Download PDF"), () => {
		open_merged_quotation_pdf(frm);
	});
}

function open_merged_quotation_pdf(frm) {
	if (frm.is_dirty()) {
		frappe.msgprint(__("Please save the document before downloading the PDF."));
		return;
	}
	const url = frappe.urllib.get_full_url(
		`/api/method/construction_suite.construction_suite.api.quotation.get_merged_quotation_pdf?name=${encodeURIComponent(
			frm.docname
		)}`
	);
	window.open(url, "_blank");
}

function render_boq_summary(frm) {
	const field = frm.fields_dict.custom_boq_summary;
	if (!field) {
		return;
	}

	if (!frm.doc.bill_of_quantities) {
		field.$wrapper.html(
			`<div class="text-muted">${__("Select a Bill of Quantities to see its summary here.")}</div>`
		);
		return;
	}

	frappe.db.get_doc("Bill of Quantities", frm.doc.bill_of_quantities).then((boq) => {
		build_boq_summary_html(boq).then((html) => {
			field.$wrapper.html(html);
			inject_boq_summary_style();
			bind_boq_summary_tabs(field.$wrapper);
		});
	});
}

function bind_boq_summary_tabs($wrapper) {
	$wrapper.off("click.boq-summary-tabs").on("click.boq-summary-tabs", ".boq-summary-tab", (e) => {
		const target = $(e.currentTarget).data("target");
		$wrapper.find(".boq-summary-tab").removeClass("active");
		$(e.currentTarget).addClass("active");
		$wrapper.find(".boq-summary-section").removeClass("active");
		$wrapper.find(`#${target}`).addClass("active");
	});
}

function build_boq_summary_html(boq) {
	const item_codes = [
		...(boq.machinery_list || []).map((row) => row.item_code),
		...(boq.manpower_list || []).map((row) => row.item_code),
	].filter(Boolean);

	return fetch_boq_summary_item_names([...new Set(item_codes)]).then((item_names) => {
		const currency = boq.currency;
		const sections = [
			{
				id: "boq-summary-overview",
				label: __("Overview"),
				html: build_boq_overview_section_html(boq),
			},
			{
				id: "boq-summary-mobilisation",
				label: __("Mobilisation & Demobilisation"),
				html: build_boq_mobilisation_section_html(boq, currency),
			},
			{
				id: "boq-summary-manpower",
				label: __("Worker Allocation"),
				html: build_boq_manpower_section_html(boq, item_names, currency),
			},
			{
				id: "boq-summary-machinery",
				label: __("Machinery Selection"),
				html: build_boq_machinery_section_html(boq, item_names, currency),
			},
			{
				id: "boq-summary-management",
				label: __("Management & LTA Compliance"),
				html: build_boq_management_section_html(boq, currency),
			},
			{
				id: "boq-summary-totals",
				label: __("Totals"),
				html: build_boq_totals_section_html(boq, currency),
			},
		];

		const tabs_html = build_boq_summary_tabs_html(sections);
		const sections_html = sections
			.map(
				(section, index) => `
					<div class="boq-summary-section${index === 0 ? " active" : ""}" id="${section.id}">
						${section.html}
					</div>
				`
			)
			.join("");

		return `
			<div class="boq-summary">
				<div class="boq-summary-header">
					${__("BOQ Summary")}: <a href="/app/bill-of-quantities/${encodeURIComponent(boq.name)}" target="_blank">${frappe.utils.escape_html(boq.name)}</a>
				</div>
				${tabs_html}
				${sections_html}
			</div>
		`;
	});
}

function fetch_boq_summary_item_names(item_codes) {
	if (!item_codes.length) {
		return Promise.resolve({});
	}
	return frappe.db
		.get_list("Item", {
			filters: { name: ["in", item_codes] },
			fields: ["name", "item_name"],
			limit_page_length: 0,
		})
		.then((rows) => {
			const item_names = {};
			rows.forEach((row) => {
				item_names[row.name] = row.item_name;
			});
			return item_names;
		});
}

function build_boq_summary_tabs_html(sections) {
	const tabs = sections
		.map(
			(section, index) => `
				<div class="boq-summary-tab${index === 0 ? " active" : ""}" data-target="${section.id}">
					${section.label}
				</div>
			`
		)
		.join("");
	return `<div class="boq-summary-tabs">${tabs}</div>`;
}

function get_boq_hardness(boq) {
	if (boq.pile_cap) {
		return { factor: 2.0, label: __("Pile Cap") };
	}
	if (boq.high_grade) {
		return { factor: 1.5, label: __("High Grade") };
	}
	if (boq.reinforced) {
		return { factor: 1.2, label: __("Reinforced") };
	}
	return { factor: 1.0, label: __("Normal") };
}

function build_boq_overview_section_html(boq) {
	const hardness = get_boq_hardness(boq);
	const total_lm = (boq.no_of_holes || 0) * (boq.depth || 0);

	return `
		<div class="boq-summary-scope-box">
			<b>${__("Client")}:</b> ${frappe.utils.escape_html(boq.customer_name || boq.customer || "—")}
			&nbsp;|&nbsp; <b>${__("Project")}:</b> ${frappe.utils.escape_html(boq.project_reference || "—")}<br>
			<b>${__("Scope")}:</b> ${boq.no_of_holes || 0} ${__("core holes")} &middot; &Oslash;${
		boq.diameter || "—"
	} &middot; ${boq.depth || 0} m/hole &middot; ${total_lm.toFixed(2)} ${__("linear metres total")}<br>
			<b>${__("Hardness")}:</b> ${hardness.label} (&times;${hardness.factor})
			&nbsp;|&nbsp; <b>${__("Coring Work Days")}:</b> ${boq.estimated_coring_work_days || 0}
			&nbsp;|&nbsp; <b>${__("Total Project Duration")}:</b> ${boq.total_days || 0} ${__("days")}
		</div>
	`;
}

function build_boq_summary_table_html(rows, total_label, total_amount) {
	return `
		<table class="boq-summary-table">
			<thead>
				<tr>
					<th>${__("Description")}</th>
					<th>${__("Rate")}</th>
					<th>${__("Qty / Days")}</th>
					<th class="r">${__("Amount")}</th>
				</tr>
			</thead>
			<tbody>
				${rows.join("") || `<tr><td colspan="4">${__("No data.")}</td></tr>`}
				<tr class="boq-summary-total-row">
					<td colspan="3">${total_label}</td>
					<td class="r">${total_amount}</td>
				</tr>
			</tbody>
		</table>
	`;
}

function build_boq_summary_row_html(description, rate, qty_days, amount) {
	return `<tr><td>${description}</td><td>${rate}</td><td>${qty_days}</td><td class="r">${amount}</td></tr>`;
}

function build_boq_mobilisation_section_html(boq, currency) {
	const mob_days = boq.mob_days || 0;
	const demob_days = boq.demob_days || 0;
	const mob_rate = boq.mobilisation_cost_rate || 0;

	const rows = [
		build_boq_summary_row_html(
			__("Mobilisation"),
			`${format_currency(mob_rate, currency)}/day`,
			`${mob_days} ${__("day(s)")}`,
			format_currency(mob_days * mob_rate, currency)
		),
		build_boq_summary_row_html(
			__("Demobilisation"),
			`${format_currency(mob_rate, currency)}/day`,
			`${demob_days} ${__("day(s)")}`,
			format_currency(demob_days * mob_rate, currency)
		),
	];

	(boq.machinery_list || []).forEach((row) => {
		if (flt(row.mob_amount) > 0) {
			rows.push(
				build_boq_summary_row_html(
					`${frappe.utils.escape_html(row.item_group || "")} ${__("Mob Premium")}`,
					__("Lump Sum"),
					"—",
					format_currency(row.mob_amount, currency)
				)
			);
		}
	});

	return build_boq_summary_table_html(
		rows,
		__("Total Mob / Demob Cost"),
		format_currency(boq.total_mob_cost, currency)
	);
}

function build_boq_manpower_section_html(boq, item_names, currency) {
	const rows = (boq.manpower_list || []).map((row) =>
		build_boq_summary_row_html(
			frappe.utils.escape_html(item_names[row.item_code] || row.item_code || ""),
			`${format_currency(row.rate, currency)}/day`,
			`${row.qty} &times; ${row.no_of_days}d`,
			format_currency(row.amount, currency)
		)
	);

	return build_boq_summary_table_html(
		rows,
		__("Total Manpower ({0} workers)", [boq.total_manpower || 0]),
		format_currency(boq.total_manpower_cost, currency)
	);
}

function build_boq_machinery_section_html(boq, item_names, currency) {
	const rows = (boq.machinery_list || []).map((row) =>
		build_boq_summary_row_html(
			frappe.utils.escape_html(item_names[row.item_code] || row.item_code || ""),
			`${format_currency(row.rate, currency)}/day`,
			`${row.qty} &times; ${row.no_of_days}d`,
			format_currency(row.machine_amount, currency)
		)
	);

	if (boq.diamond_bit_consumable) {
		const hardness = get_boq_hardness(boq);
		const total_lm = (boq.no_of_holes || 0) * (boq.depth || 0);
		rows.push(
			build_boq_summary_row_html(
				__("Consumables — Diamond Bits (×{0} hardness)", [hardness.factor]),
				`${format_currency(boq.diamond_bit_consumable, currency)}/LM`,
				`${total_lm.toFixed(2)} LM`,
				format_currency(boq.diamond_bit_consumable_amount, currency)
			)
		);
	}

	return build_boq_summary_table_html(
		rows,
		__("Total Machinery"),
		format_currency(boq.total_machinery_cost, currency)
	);
}

function build_boq_management_section_html(boq, currency) {
	const total_days = boq.total_days || 0;
	const rows = [];

	if (boq.pe_lifting_plan) {
		rows.push(
			build_boq_summary_row_html(
				__("PE-Endorsed Lifting Plans"),
				__("Lump Sum"),
				"—",
				format_currency(boq.pe_lifting_plan, currency)
			)
		);
	}
	if (boq.ptw_management) {
		rows.push(
			build_boq_summary_row_html(
				__("PTW Management"),
				`${format_currency(boq.ptw_management, currency)}/day`,
				`${total_days}d`,
				format_currency(boq.ptw_management * total_days, currency)
			)
		);
	}
	if (boq.noise_vib_monitor) {
		rows.push(
			build_boq_summary_row_html(
				__("Noise & Vibration Monitoring"),
				`${format_currency(boq.noise_vib_monitor, currency)}/day`,
				`${total_days}d`,
				format_currency(boq.noise_vib_monitor * total_days, currency)
			)
		);
	}
	if (boq.waste_management) {
		rows.push(
			build_boq_summary_row_html(
				__("Waste Management & Slurry Disposal"),
				`${format_currency(boq.waste_management, currency)}/day`,
				`${total_days}d`,
				format_currency(boq.waste_management * total_days, currency)
			)
		);
	}
	if (boq.diesel_rate && boq.diesel_consumption) {
		rows.push(
			build_boq_summary_row_html(
				__("Diesel Cost ({0}L/day × {1}/L)", [boq.diesel_consumption, format_currency(boq.diesel_rate, currency)]),
				`${format_currency(boq.diesel_rate * boq.diesel_consumption, currency)}/day`,
				`${total_days}d`,
				format_currency(boq.diesel_rate * boq.diesel_consumption * total_days, currency)
			)
		);
	}
	if (boq.overhead || boq.overhead_lump_sum) {
		const overhead_base = flt(boq.total_manpower_cost) + flt(boq.total_machinery_cost);
		const overhead_cost = overhead_base * (flt(boq.overhead) / 100) + flt(boq.overhead_lump_sum);
		rows.push(
			build_boq_summary_row_html(__("Overhead"), "—", "—", format_currency(overhead_cost, currency))
		);
	}
	if (boq.nce) {
		rows.push(build_boq_summary_row_html(__("NCE"), __("Lump Sum"), "—", format_currency(boq.nce, currency)));
	}
	if (boq.pe_calculation) {
		rows.push(
			build_boq_summary_row_html(
				__("PE Calculation"),
				__("Lump Sum"),
				"—",
				format_currency(boq.pe_calculation, currency)
			)
		);
	}
	if (boq.impact_assessment) {
		rows.push(
			build_boq_summary_row_html(
				__("Impact Assessment"),
				__("Lump Sum"),
				"—",
				format_currency(boq.impact_assessment, currency)
			)
		);
	}
	(boq.additional_compliance_items_list || []).forEach((row) => {
		rows.push(
			build_boq_summary_row_html(
				frappe.utils.escape_html(row.additional_compliance_item || ""),
				__("Lump Sum"),
				"—",
				format_currency(row.amount, currency)
			)
		);
	});

	return build_boq_summary_table_html(
		rows,
		__("Total Management & Compliance"),
		format_currency(boq.total_management_and_compliance_cost, currency)
	);
}

function build_boq_totals_section_html(boq, currency) {
	const rows = [
		{ label: __("Sub Total"), amount: boq.sub_total },
		{ label: __("Contingency ({0}%)", [boq.contingency || 0]), amount: boq.contingency_amount },
		{ label: __("Profit Margin ({0}%)", [boq.profit_margin || 0]), amount: boq.profit_margin_amount },
	];

	const rows_html = rows
		.map(
			(row) => `
				<tr>
					<td>${row.label}</td>
					<td class="r">${format_currency(row.amount, currency)}</td>
				</tr>
			`
		)
		.join("");

	return `
		<table class="boq-summary-table">
			<tbody>
				${rows_html}
				<tr class="boq-summary-grand-row">
					<td>${__("Grand Total")}</td>
					<td class="r">${format_currency(boq.grand_total, currency)}</td>
				</tr>
			</tbody>
		</table>
	`;
}

function inject_boq_summary_style() {
	if ($("#boq-summary-style").length) {
		return;
	}
	$("<style>")
		.attr("id", "boq-summary-style")
		.html(`
			.boq-summary {
				font-size: 12px;
				color: #1a2733;
				margin-bottom: 24px;
			}
			.boq-summary-header {
				font-weight: 700;
				font-size: 14px;
				color: #0a2540;
				margin-bottom: 10px;
			}
			.boq-summary-tabs {
				display: flex;
				flex-wrap: wrap;
				gap: 4px;
				border-bottom: 2px solid #e3e8ee;
				margin-bottom: 14px;
			}
			.boq-summary-tab {
				cursor: pointer;
				padding: 7px 12px;
				font-size: 11.5px;
				font-weight: 600;
				color: #5c6b7a;
				border-bottom: 2px solid transparent;
				margin-bottom: -2px;
				user-select: none;
			}
			.boq-summary-tab:hover {
				color: #0a2540;
			}
			.boq-summary-tab.active {
				color: #0a2540;
				border-bottom-color: #0a2540;
			}
			.boq-summary-section {
				display: none;
				border: 1px solid #e3e8ee;
				border-radius: 8px;
				padding: 12px 14px;
			}
			.boq-summary-section.active {
				display: block;
			}
			.boq-summary-scope-box {
				background: #f5f7fa;
				border-radius: 6px;
				padding: 10px 12px;
				line-height: 1.7;
			}
			.boq-summary-table {
				width: 100%;
				border-collapse: collapse;
			}
			.boq-summary-table th {
				background: #0a2540;
				color: #fff;
				text-align: left;
				padding: 6px 8px;
				font-size: 11px;
			}
			.boq-summary-table td {
				padding: 5px 8px;
				border-bottom: 1px solid #e3e8ee;
				font-size: 11.5px;
			}
			.boq-summary-table td.r, .boq-summary-table th.r {
				text-align: right;
			}
			.boq-summary-total-row td {
				background: #f5f5f5;
				font-weight: 700;
			}
			.boq-summary-grand-row td {
				background: #0a2540;
				color: #fff;
				font-weight: 700;
				font-size: 13px;
				padding: 9px 8px;
			}
		`)
		.appendTo("head");
}