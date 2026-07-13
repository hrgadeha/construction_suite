// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

const CONCRETE_HARDNESS_FIELDS = ["normal", "reinforced", "high_grade", "pile_cap"];
const CONCRETE_HARDNESS_FACTORS = {
	normal: 1.0,
	reinforced: 1.2,
	high_grade: 1.5,
	pile_cap: 2.0,
};
const MACHINERY_ITEM_GROUP_PARENT = "Machinery";
const MACHINERY_CATEGORY_ICONS = {
	crane: "🏗️",
	rotator: "🌀",
	coring: "🌀",
	excavator: "🚜",
	generator: "⚡",
	truck: "🚚",
	drill: "🛠️",
	bit: "💎",
};
const MANPOWER_ITEM_GROUP_PARENT = "Manpower";
const MANPOWER_CATEGORY_ICONS = {
	mason: "👷",
	carpenter: "🪚",
	electrician: "🔌",
	plumber: "🚰",
	welder: "🔥",
	supervisor: "🦺",
	helper: "🧰",
	labour: "👷",
	laborer: "👷",
	operator: "🕹️",
};

frappe.ui.form.on("Bill of Quantities", {
	refresh(frm) {
		style_boq_button(frm, "add_machinery");
		style_boq_button(frm, "add_manpower");
		style_boq_button(frm, "add_item");
		style_section_headings(frm);
		style_concrete_hardness_checkboxes(frm);
		bind_concrete_hardness_block_click(frm);
		update_concrete_hardness_active_state(frm);
		add_boq_preview_button(frm);
	},
	add_machinery(frm) {
		open_machinery_dialog(frm);
	},
	add_manpower(frm) {
		open_manpower_dialog(frm);
	},
	add_item(frm) {
		open_additional_compliance_item_dialog(frm);
	},
	normal(frm) {
		enforce_concrete_hardness_exclusivity(frm, "normal");
		calculate_boq_totals(frm);
	},
	reinforced(frm) {
		enforce_concrete_hardness_exclusivity(frm, "reinforced");
		calculate_boq_totals(frm);
	},
	high_grade(frm) {
		enforce_concrete_hardness_exclusivity(frm, "high_grade");
		calculate_boq_totals(frm);
	},
	pile_cap(frm) {
		enforce_concrete_hardness_exclusivity(frm, "pile_cap");
		calculate_boq_totals(frm);
	},
	mob_days(frm) {
		calculate_boq_totals(frm);
	},
	demob_days(frm) {
		calculate_boq_totals(frm);
	},
	mobilisation_cost_rate(frm) {
		calculate_boq_totals(frm);
	},
	no_of_holes(frm) {
		calculate_boq_totals(frm);
	},
	depth(frm) {
		calculate_boq_totals(frm);
	},
	diameter(frm) {
		calculate_boq_totals(frm);
	},
	diamond_bit_consumable(frm) {
		calculate_boq_totals(frm);
	},
	days_per_coring_point(frm) {
		calculate_boq_totals(frm);
	},
	pe_lifting_plan(frm) {
		calculate_boq_totals(frm);
	},
	ptw_management(frm) {
		calculate_boq_totals(frm);
	},
	noise_vib_monitor(frm) {
		calculate_boq_totals(frm);
	},
	nce(frm) {
		calculate_boq_totals(frm);
	},
	pe_calculation(frm) {
		calculate_boq_totals(frm);
	},
	waste_management(frm) {
		calculate_boq_totals(frm);
	},
	impact_assessment(frm) {
		calculate_boq_totals(frm);
	},
	overhead(frm) {
		calculate_boq_totals(frm);
	},
	diesel_rate(frm) {
		calculate_boq_totals(frm);
	},
	overhead_lump_sum(frm) {
		calculate_boq_totals(frm);
	},
	diesel_consumption(frm) {
		calculate_boq_totals(frm);
	},
	additional_compliance_items_list_add(frm) {
		calculate_boq_totals(frm);
	},
	additional_compliance_items_list_remove(frm) {
		calculate_boq_totals(frm);
	},
	contingency(frm) {
		calculate_boq_totals(frm);
	},
	profit_margin(frm) {
		calculate_boq_totals(frm);
	},
});

frappe.ui.form.on("Bill of Quantities Additional Compliance Items", {
	amount(frm) {
		calculate_boq_totals(frm);
	},
});

function calculate_boq_totals(frm) {
	calculate_total_mob_days(frm);
	calculate_estimated_coring_work_days(frm);
	calculate_total_days(frm);
	sync_row_days_with_total_days(frm);
	calculate_manpower_totals(frm);
	calculate_diamond_bit_consumable(frm);
	calculate_total_machinery_cost(frm);
	calculate_mobilisation_costs(frm);
	calculate_total_management_and_compliance_cost(frm);
	calculate_sub_total(frm);
	calculate_grand_total(frm);
	render_mobilisation_schedule(frm);
}

function sync_row_days_with_total_days(frm) {
	const total_days = frm.doc.total_days || 0;

	(frm.doc.machinery_list || []).forEach((row) => {
		row.no_of_days = total_days;
		row.machine_amount = (row.qty || 0) * (row.rate || 0) * total_days;
		row.mob_amount = (row.qty || 0) * (row.mob_premium || 0);
		row.amount = row.machine_amount + row.mob_amount;
	});
	(frm.doc.manpower_list || []).forEach((row) => {
		row.no_of_days = total_days;
		row.amount = (row.qty || 0) * (row.rate || 0) * total_days;
	});

	frm.refresh_field("machinery_list");
	frm.refresh_field("manpower_list");
}

function calculate_sub_total(frm) {
	const sub_total =
		(frm.doc.total_mob_cost || 0) +
		(frm.doc.total_manpower_cost || 0) +
		(frm.doc.total_machinery_cost || 0) +
		(frm.doc.total_management_and_compliance_cost || 0);
	frm.set_value("sub_total", sub_total);
}

function calculate_grand_total(frm) {
	const sub_total = frm.doc.sub_total || 0;
	const contingency_amount = sub_total * ((frm.doc.contingency || 0) / 100);
	const profit_margin_amount = (sub_total + contingency_amount) * ((frm.doc.profit_margin || 0) / 100);
	frm.set_value("contingency_amount", contingency_amount);
	frm.set_value("profit_margin_amount", profit_margin_amount);
	frm.set_value("grand_total", sub_total + contingency_amount + profit_margin_amount);
}

function get_hardness_factor(frm) {
	const checked_fieldname = CONCRETE_HARDNESS_FIELDS.find((fieldname) => frm.doc[fieldname]);
	return checked_fieldname ? CONCRETE_HARDNESS_FACTORS[checked_fieldname] : 1;
}

function calculate_diamond_bit_consumable(frm) {
	const total_linear_metres = (frm.doc.no_of_holes || 0) * (frm.doc.depth || 0);
	const hardness_factor = get_hardness_factor(frm);
	const amount = (frm.doc.diamond_bit_consumable || 0) * hardness_factor * total_linear_metres;
	frm.set_value("diamond_bit_consumable_amount", amount);
}

function calculate_total_mob_days(frm) {
	frm.set_value("total_mob_days", (frm.doc.mob_days || 0) + (frm.doc.demob_days || 0));
}

function calculate_total_days(frm) {
	const total_days =
		(frm.doc.estimated_coring_work_days || 0) + (frm.doc.mob_days || 0) + (frm.doc.demob_days || 0);
	frm.set_value("total_days", total_days);
}

function calculate_manpower_totals(frm) {
	let total_manpower = 0;
	let total_manpower_cost = 0;
	(frm.doc.manpower_list || []).forEach((row) => {
		total_manpower += row.qty || 0;
		total_manpower_cost += row.amount || 0;
	});
	frm.set_value("total_manpower", total_manpower);
	frm.set_value("total_manpower_cost", total_manpower_cost);
}

function calculate_total_machinery_cost(frm) {
	const machinery_rows_cost = (frm.doc.machinery_list || []).reduce(
		(total, row) => total + flt(row.machine_amount),
		0
	);
	const total_machinery_cost = machinery_rows_cost + (frm.doc.diamond_bit_consumable_amount || 0);
	frm.set_value("total_machinery_cost", total_machinery_cost);
}

function calculate_mobilisation_costs(frm) {
	const mob_total_days = (frm.doc.mob_days || 0) + (frm.doc.demob_days || 0);
	const base_mob_and_demob = mob_total_days * (frm.doc.mobilisation_cost_rate || 0);
	const equipment_premiums = get_total_equipment_mob_premium(frm);
	frm.set_value("base_mob_and_demob", base_mob_and_demob);
	frm.set_value("equipment_premiums", equipment_premiums);
	frm.set_value("total_mob_cost", base_mob_and_demob + equipment_premiums);
}

function calculate_total_management_and_compliance_cost(frm) {
	const total_days = frm.doc.total_days || 0;
	const lump_sum_costs =
		flt(frm.doc.pe_lifting_plan) +
		flt(frm.doc.nce) +
		flt(frm.doc.pe_calculation) +
		flt(frm.doc.impact_assessment);
	const per_day_costs =
		(flt(frm.doc.ptw_management) + flt(frm.doc.noise_vib_monitor) + flt(frm.doc.waste_management)) *
		total_days;
	const diesel_cost = flt(frm.doc.diesel_rate) * flt(frm.doc.diesel_consumption) * total_days;
	const overhead_base = flt(frm.doc.total_manpower_cost) + flt(frm.doc.total_machinery_cost);
	const overhead_cost = overhead_base * (flt(frm.doc.overhead) / 100) + flt(frm.doc.overhead_lump_sum);
	const additional_compliance_cost = (frm.doc.additional_compliance_items_list || []).reduce(
		(total, row) => total + flt(row.amount),
		0
	);

	frm.set_value(
		"total_management_and_compliance_cost",
		lump_sum_costs + per_day_costs + diesel_cost + overhead_cost + additional_compliance_cost
	);
}

frappe.ui.form.on("Bill of Quantities Machinery Item", {
	qty(frm, cdt, cdn) {
		recalculate_machinery_row_amount(frm, cdt, cdn);
	},
	rate(frm, cdt, cdn) {
		recalculate_machinery_row_amount(frm, cdt, cdn);
	},
	mob_premium(frm, cdt, cdn) {
		recalculate_machinery_row_amount(frm, cdt, cdn);
	},
});

function recalculate_machinery_row_amount(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	const qty = row.qty || 0;
	const no_of_days = row.no_of_days || 0;
	const rate = row.rate || 0;
	const mob_premium = row.mob_premium || 0;
	row.machine_amount = qty * rate * no_of_days;
	row.mob_amount = qty * mob_premium;
	row.amount = row.machine_amount + row.mob_amount;
	frm.refresh_field("machinery_list");
	calculate_boq_totals(frm);
}

frappe.ui.form.on("Bill of Quantities Manpower Item", {
	qty(frm, cdt, cdn) {
		recalculate_manpower_row_amount(frm, cdt, cdn);
	},
	rate(frm, cdt, cdn) {
		recalculate_manpower_row_amount(frm, cdt, cdn);
	},
});

function recalculate_manpower_row_amount(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	const qty = row.qty || 0;
	const no_of_days = row.no_of_days || 0;
	const rate = row.rate || 0;
	frappe.model.set_value(cdt, cdn, "amount", (qty * rate * no_of_days));
	calculate_boq_totals(frm);
}

const MOB_PREMIUM_CARD_PALETTE = [
	{ bg: "#f3e9fd", border: "#c9a3f5", text: "#5b2a86" },
	{ bg: "#e8f3fd", border: "#a9d0f5", text: "#0a4d8c" },
	{ bg: "#fdf3e8", border: "#f5d0a3", text: "#8c5a0a" },
	{ bg: "#e8fdf0", border: "#a3f5c0", text: "#0a8c4d" },
];

const DIAMETER_HOLES_PER_DAY_BREAKPOINTS = [
	{ max_mm: 300, holes_per_day: 6 },
	{ max_mm: 500, holes_per_day: 3 },
	{ max_mm: 750, holes_per_day: 2 },
	{ max_mm: 1000, holes_per_day: 1 },
	{ max_mm: 1500, holes_per_day: 0.5 },
	{ max_mm: 1800, holes_per_day: 0.33 },
];
const DIAMETER_HOLES_PER_DAY_FALLBACK = 0.25;

function render_mobilisation_schedule(frm) {
	const field = frm.fields_dict.mobilisation_schedule;
	if (!field) {
		return;
	}

	const premium_cards_html = build_equipment_mob_premium_cards_html(frm);
	const summary_html = build_mobilisation_summary_html(frm);

	field.$wrapper.html(`${premium_cards_html}${summary_html}`);
	inject_mob_premium_card_style();
	inject_mobilisation_summary_style();
}

function get_holes_per_day(diameter_mm) {
	const breakpoint = DIAMETER_HOLES_PER_DAY_BREAKPOINTS.find((bp) => diameter_mm <= bp.max_mm);
	return breakpoint ? breakpoint.holes_per_day : DIAMETER_HOLES_PER_DAY_FALLBACK;
}

function parse_diameter_mm(diameter) {
	return parseInt(diameter, 10) || 600;
}

function calculate_estimated_coring_work_days(frm) {
	const holes = frm.doc.no_of_holes || 0;
	const days_per_coring_point = frm.doc.days_per_coring_point || 0;
	const holes_per_day = get_holes_per_day(parse_diameter_mm(frm.doc.diameter));
	const coring_work_days =
		days_per_coring_point > 0
			? Math.ceil(holes * days_per_coring_point)
			: Math.ceil(holes / holes_per_day);
	frm.set_value("estimated_coring_work_days", coring_work_days);
}

function get_coring_rate_label(frm) {
	const days_per_coring_point = frm.doc.days_per_coring_point || 0;
	if (days_per_coring_point > 0) {
		return `${days_per_coring_point} ${__("day(s)/hole (engineer-defined)")}`;
	}
	const holes_per_day = get_holes_per_day(parse_diameter_mm(frm.doc.diameter));
	const rate_text =
		holes_per_day >= 1
			? `${holes_per_day} ${__("holes/day")}`
			: `${(1 / holes_per_day).toFixed(2)} ${__("days/hole")}`;
	return `${rate_text} (${__("diameter auto")})`;
}

function get_total_equipment_mob_premium(frm) {
	return (frm.doc.machinery_list || []).reduce((total, row) => total + flt(row.mob_amount), 0);
}

function build_mobilisation_summary_html(frm) {
	const mob_days = frm.doc.mob_days || 0;
	const demob_days = frm.doc.demob_days || 0;
	const mob_rate = frm.doc.mobilisation_cost_rate || 0;
	const coring_days = frm.doc.estimated_coring_work_days || 0;
	const total_days = frm.doc.total_days || 0;
	const base_mob_cost = frm.doc.base_mob_and_demob || 0;
	const equipment_premium = frm.doc.equipment_premiums || 0;
	const total_mob_cost = frm.doc.total_mob_cost || 0;

	return `
		<div class="mobilisation-summary-card">
			<div class="mobilisation-summary-title">📅 ${__("Mobilisation Schedule")}</div>
			<div class="mobilisation-summary-row">▸ ${__("Mobilisation")}: <b>${mob_days} ${__(
		"day(s)"
	)}</b> — ${__("LTA site induction, security clearance, equipment deployment")}</div>
			<div class="mobilisation-summary-row">▸ ${__("Coring Works")}: <b>${coring_days} ${__(
		"days"
	)}</b> @ ${get_coring_rate_label(frm)}</div>
			<div class="mobilisation-summary-row">▸ ${__("Demobilisation")}: <b>${demob_days} ${__(
		"day(s)"
	)}</b> — ${__("Equipment removal & site reinstatement")}</div>
			<div class="mobilisation-summary-row">▸ <b>${__("Total Project Duration")}: ${total_days} ${__(
		"days"
	)}</b></div>
			<div class="mobilisation-summary-row">▸ ${__("Base Mob/Demob")}: <b>${format_currency(
		base_mob_cost
	)}</b> (${format_currency(mob_rate)}/day × ${mob_days + demob_days} ${__("days")})</div>
			<div class="mobilisation-summary-row">▸ ${__("Equipment Premiums")}: <b>${format_currency(
		equipment_premium
	)}</b> (${__("crane + rotator mob costs")})</div>
			<div class="mobilisation-summary-row">▸ <b>${__("Total Mob Cost")}: ${format_currency(
		total_mob_cost
	)}</b></div>
		</div>
	`;
}

function inject_mobilisation_summary_style() {
	if ($("#mobilisation-summary-style").length) {
		return;
	}
	$("<style>")
		.attr("id", "mobilisation-summary-style")
		.html(`
			.mobilisation-summary-card {
				background: #f3e9fd;
				border: 1px solid #c9a3f5;
				border-radius: 10px;
				padding: 16px 18px;
				margin-top: 12px;
				color: #3d2a5c;
			}
			.mobilisation-summary-title {
				font-weight: 700;
				font-size: 15px;
				color: #6f2da8;
				margin-bottom: 8px;
			}
			.mobilisation-summary-row {
				font-size: 13px;
				line-height: 1.7;
			}
			.mobilisation-summary-row b {
				color: #6f2da8;
			}
		`)
		.appendTo("head");
}

function build_equipment_mob_premium_cards_html(frm) {
	const rows = (frm.doc.machinery_list || []).filter((row) => flt(row.mob_amount) > 0);

	if (!rows.length) {
		return `<div class="text-muted">${__(
			"No mobilisation premiums yet. Add a Crane or Rotary Casing Machine item with a mob fee to see it here."
		)}</div>`;
	}

	const cards = rows.map((row) => build_mob_premium_card(row)).join("");
	return `<div class="mob-premium-cards">${cards}</div>`;
}

function build_mob_premium_card(row) {
	const group_name = row.item_group || "";
	const icon = get_boq_category_icon(group_name, MACHINERY_CATEGORY_ICONS, "⚙️");
	const palette = get_mob_premium_card_palette(group_name);
	const item_label = frappe.utils.escape_html(row.machinery || row.item_code || "");
	const group_label = frappe.utils.escape_html(group_name);

	return `
		<div class="mob-premium-card" style="background:${palette.bg}; border-color:${palette.border}; color:${palette.text};">
			<div class="mob-premium-card-title">${icon} ${group_label}: ${format_currency(row.mob_amount || 0)}</div>
			<div class="mob-premium-card-subtitle">${item_label} — ${format_currency(row.rate || 0)}/${frappe.utils.escape_html(row.uom || "")}</div>
		</div>
	`;
}

function get_mob_premium_card_palette(group_name) {
	let hash = 0;
	for (let i = 0; i < group_name.length; i++) {
		hash = (hash * 31 + group_name.charCodeAt(i)) >>> 0;
	}
	return MOB_PREMIUM_CARD_PALETTE[hash % MOB_PREMIUM_CARD_PALETTE.length];
}

function inject_mob_premium_card_style() {
	if ($("#mob-premium-card-style").length) {
		return;
	}
	$("<style>")
		.attr("id", "mob-premium-card-style")
		.html(`
			.mob-premium-cards {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
				margin-top: 4px;
			}
			.mob-premium-card {
				flex: 1 1 220px;
				min-width: 200px;
				border: 1px solid;
				border-radius: 10px;
				padding: 12px 14px;
			}
			.mob-premium-card-title {
				font-weight: 700;
				font-size: 14px;
				margin-bottom: 4px;
			}
			.mob-premium-card-subtitle {
				font-size: 12px;
				opacity: 0.85;
			}
		`)
		.appendTo("head");
}

function style_boq_button(frm, fieldname) {
	const field = frm.fields_dict[fieldname];
	if (field) {
		field.$input.css({
			"background-color": "#0a0f5e",
			"border-color": "#0a0f5e",
			"color": "#fff",
		});
	}
}

const BOQ_PRINT_FORMAT = "BOQ";

function add_boq_preview_button(frm) {
	if (frm.is_new()) {
		return;
	}
	const button = frm.add_custom_button(__("Preview BOQ"), () => {
		open_boq_pdf_preview(frm);
	});
	button.css({
		"background-color": "#0a0f5e",
		"border-color": "#0a0f5e",
		"color": "#fff",
	});
}

function open_boq_pdf_preview(frm) {
	if (frm.is_dirty()) {
		frappe.msgprint(__("Please save the document before previewing the BOQ PDF."));
		return;
	}
	const url = frappe.urllib.get_full_url(
		`/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(
			frm.doctype
		)}&name=${encodeURIComponent(frm.docname)}&format=${encodeURIComponent(
			BOQ_PRINT_FORMAT
		)}&no_letterhead=0`
	);
	window.open(url, "_blank");
}

function open_machinery_dialog(frm) {
	fetch_boq_item_groups(MACHINERY_ITEM_GROUP_PARENT, ["has_mobilisation_fee"]).then((item_groups) => {
		if (!item_groups.length) {
			frappe.msgprint(
				__('No machinery categories found under the "{0}" Item Group.', [MACHINERY_ITEM_GROUP_PARENT])
			);
			return;
		}
		fetch_boq_items_by_group(item_groups, ["mobilisation_premium"]).then((items_by_group) => {
			apply_boq_item_prices(frm, items_by_group).then(() => {
				const dialog = build_machinery_dialog(frm, item_groups, items_by_group);
				dialog.show();
			});
		});
	});
}

function open_manpower_dialog(frm) {
	fetch_boq_item_groups(MANPOWER_ITEM_GROUP_PARENT).then((item_groups) => {
		if (!item_groups.length) {
			frappe.msgprint(
				__('No manpower categories found under the "{0}" Item Group.', [MANPOWER_ITEM_GROUP_PARENT])
			);
			return;
		}
		fetch_boq_items_by_group(item_groups).then((items_by_group) => {
			apply_boq_item_prices(frm, items_by_group).then(() => {
				const dialog = build_manpower_dialog(frm, item_groups, items_by_group);
				dialog.show();
			});
		});
	});
}

function open_additional_compliance_item_dialog(frm) {
	const dialog = new frappe.ui.Dialog({
		title: __("Add Item"),
		fields: [
			{
				fieldname: "additional_compliance_item",
				fieldtype: "Data",
				label: __("Item"),
				reqd: 1,
			},
			{
				fieldname: "amount",
				fieldtype: "Currency",
				label: __("Amount"),
				reqd: 1,
			},
		],
		primary_action_label: __("Add"),
		primary_action(values) {
			add_additional_compliance_item_to_grid(frm, values);
			dialog.hide();
		},
	});
	dialog.show();
}

function add_additional_compliance_item_to_grid(frm, values) {
	const row = frm.add_child("additional_compliance_items_list");
	row.additional_compliance_item = values.additional_compliance_item;
	row.amount = values.amount || 0;
	frm.refresh_field("additional_compliance_items_list");
	calculate_boq_totals(frm);
	frm.dirty();
}

function fetch_boq_item_groups(parent_item_group, extra_fields = []) {
	return frappe.db.get_list("Item Group", {
		filters: { parent_item_group },
		fields: ["name", ...extra_fields],
		order_by: "name asc",
		limit_page_length: 0,
	});
}

function fetch_boq_items_by_group(item_groups, extra_fields = []) {
	return Promise.all(
		item_groups.map((group) =>
			frappe.db.get_list("Item", {
				filters: { item_group: group.name, disabled: 0 },
				fields: ["name", "item_name", "stock_uom", ...extra_fields],
				order_by: "item_name asc",
				limit_page_length: 0,
			})
		)
	).then((results) => {
		const items_by_group = {};
		item_groups.forEach((group, index) => {
			items_by_group[group.name] = results[index];
		});
		return items_by_group;
	});
}

function apply_boq_item_prices(frm, items_by_group) {
	const all_items = Object.values(items_by_group).flat();
	const item_codes = all_items.map((item) => item.name);
	return fetch_boq_item_prices(item_codes, frm.doc.currency).then((price_by_item_code) => {
		all_items.forEach((item) => {
			const price = price_by_item_code[item.name];
			item.rate = price ? price.price_list_rate : 0;
			item.uom = (price && price.uom) || item.stock_uom;
		});
	});
}

function fetch_boq_item_prices(item_codes, currency) {
	if (!item_codes.length) {
		return Promise.resolve({});
	}
	const filters = { item_code: ["in", item_codes], selling: 1 };
	if (currency) {
		filters.currency = currency;
	}
	return frappe.db
		.get_list("Item Price", {
			filters,
			fields: ["item_code", "price_list_rate", "uom", "valid_from"],
			order_by: "valid_from desc",
			limit_page_length: 0,
		})
		.then((rows) => {
			const price_by_item_code = {};
			rows.forEach((row) => {
				if (!price_by_item_code[row.item_code]) {
					price_by_item_code[row.item_code] = row;
				}
			});
			return price_by_item_code;
		});
}

function get_boq_category_icon(group_name, icon_map, fallback_icon) {
	const key = Object.keys(icon_map).find((candidate) => group_name.toLowerCase().includes(candidate));
	return key ? icon_map[key] : fallback_icon;
}

function get_boq_multicheck_fieldname(prefix, group_name) {
	return `${prefix}_multicheck_${frappe.scrub(group_name)}`;
}

function build_boq_category_fields({ prefix, group, items, icon_map, fallback_icon, build_label }) {
	const icon = get_boq_category_icon(group.name, icon_map, fallback_icon);
	return [
		{
			fieldtype: "Section Break",
			label: `${icon}  ${group.name}`,
			collapsible: 1,
		},
		{
			fieldname: get_boq_multicheck_fieldname(prefix, group.name),
			fieldtype: "MultiCheck",
			label: __("Select one or more {0}", [group.name]),
			columns: 2,
			select_all: 1,
			options: items.map((item) => ({
				value: item.name,
				label: build_label(item, group),
			})),
		},
	];
}

function build_machinery_dialog(frm, item_groups, items_by_group) {
	const fields = [];
	item_groups.forEach((group) => {
		fields.push(
			...build_boq_category_fields({
				prefix: "machinery",
				group,
				items: items_by_group[group.name],
				icon_map: MACHINERY_CATEGORY_ICONS,
				fallback_icon: "⚙️",
				build_label: (item, grp) => format_machinery_option_label(item, grp.has_mobilisation_fee),
			})
		);
	});

	const dialog = new frappe.ui.Dialog({
		title: __("Add Machinery"),
		size: "extra-large",
		fields,
		primary_action_label: __("Add"),
		primary_action() {
			add_selected_machinery_to_grid(frm, dialog, item_groups, items_by_group);
		},
	});

	style_boq_dialog(dialog);

	return dialog;
}

function build_manpower_dialog(frm, item_groups, items_by_group) {
	const fields = [];
	item_groups.forEach((group) => {
		fields.push(
			...build_boq_category_fields({
				prefix: "manpower",
				group,
				items: items_by_group[group.name],
				icon_map: MANPOWER_CATEGORY_ICONS,
				fallback_icon: "🧑‍🔧",
				build_label: (item) => format_manpower_option_label(item),
			})
		);
	});

	const dialog = new frappe.ui.Dialog({
		title: __("Add Manpower"),
		size: "extra-large",
		fields,
		primary_action_label: __("Add"),
		primary_action() {
			add_selected_manpower_to_grid(frm, dialog, item_groups, items_by_group);
		},
	});

	style_boq_dialog(dialog);

	return dialog;
}

function format_machinery_option_label(item, has_mobilisation_fee) {
	let label = `${item.item_name} — ${format_currency(item.rate || 0)}/${item.uom || ""}`;
	if (has_mobilisation_fee && item.mobilisation_premium) {
		label += ` (+${format_currency(item.mobilisation_premium)} mob)`;
	}
	return label;
}

function format_manpower_option_label(item) {
	return `${item.item_name} — ${format_currency(item.rate || 0)}/${item.uom || ""}`;
}

function add_selected_machinery_to_grid(frm, dialog, item_groups, items_by_group) {
	let added_any = false;

	item_groups.forEach((group) => {
		const fieldname = get_boq_multicheck_fieldname("machinery", group.name);
		const selected_item_codes = dialog.get_value(fieldname) || [];
		const items = items_by_group[group.name];

		selected_item_codes.forEach((item_code) => {
			const item = items.find((candidate) => candidate.name === item_code);
			if (!item) {
				return;
			}
			const rate = item.rate || 0;
			const mob_premium = group.has_mobilisation_fee ? item.mobilisation_premium || 0 : 0;
			const row = frm.add_child("machinery_list");
			row.item_code = item_code;
			row.uom = item.uom;
			row.qty = 1;
			row.no_of_days = frm.doc.total_days || 0;
			row.rate = rate;
			row.mob_premium = mob_premium;
			row.machine_amount = row.qty * rate * row.no_of_days;
			row.mob_amount = row.qty * mob_premium;
			row.amount = row.machine_amount + row.mob_amount;
			added_any = true;
		});
	});

	if (!added_any) {
		frappe.msgprint(__("Please select at least one machinery item."));
		return;
	}

	frm.refresh_field("machinery_list");
	calculate_boq_totals(frm);
	frm.dirty();
	dialog.hide();
}

function add_selected_manpower_to_grid(frm, dialog, item_groups, items_by_group) {
	let added_any = false;

	item_groups.forEach((group) => {
		const fieldname = get_boq_multicheck_fieldname("manpower", group.name);
		const selected_item_codes = dialog.get_value(fieldname) || [];
		const items = items_by_group[group.name];

		selected_item_codes.forEach((item_code) => {
			const item = items.find((candidate) => candidate.name === item_code);
			if (!item) {
				return;
			}
			const rate = item.rate || 0;
			const row = frm.add_child("manpower_list");
			row.item_code = item_code;
			row.uom = item.uom;
			row.qty = 1;
			row.no_of_days = frm.doc.total_days || 0;
			row.rate = rate;
			row.amount = row.qty * rate * row.no_of_days;
			added_any = true;
		});
	});

	if (!added_any) {
		frappe.msgprint(__("Please select at least one manpower item."));
		return;
	}

	frm.refresh_field("manpower_list");
	calculate_boq_totals(frm);
	frm.dirty();
	dialog.hide();
}

function style_boq_dialog(dialog) {
	dialog.modal_body.addClass("boq-selection-dialog");
	inject_boq_dialog_style();
}

function inject_boq_dialog_style() {
	if ($("#boq-selection-dialog-style").length) {
		return;
	}
	$("<style>")
		.attr("id", "boq-selection-dialog-style")
		.html(`
			.boq-selection-dialog .form-section {
				border: 1px solid var(--border-color, #d1d8dd) !important;
				border-radius: 10px;
				padding: 16px 16px 4px !important;
				margin-bottom: 16px;
				transition: border-color 0.15s ease;
			}
			.boq-selection-dialog .form-section:hover {
				border-color: #0a0f5e;
			}
			.boq-selection-dialog .form-section .section-head {
				padding-top: 0 !important;
				padding-bottom: 8px !important;
				font-weight: 700;
				font-size: 13px;
				letter-spacing: 0.02em;
				text-transform: uppercase;
				color: #0a0f5e;
				border-bottom: 2px solid #e8a020;
				margin-bottom: 10px;
			}
			.boq-selection-dialog .unit-checkbox {
				border: 1px solid var(--border-color, #d1d8dd);
				border-radius: 8px;
				margin: 4px !important;
				padding: 8px 10px !important;
				transition: border-color 0.15s ease, background-color 0.15s ease;
			}
			.boq-selection-dialog .unit-checkbox:has(input:checked) {
				border-color: #0a0f5e;
				background-color: rgba(10, 15, 94, 0.06);
			}
		`)
		.appendTo("head");
}

const SECTION_HEADING_STYLES = [
	{ fieldname: "section_break_oqhc", color: "#1a3a5c" },
	{ fieldname: "mobilisation_schedule_section", color: "#1a3a5c" },
	{ fieldname: "section_break_nrju", color: "#1a3a5c" },
	{ fieldname: "section_break_fnqi", color: "#1a3a5c" },
	{ fieldname: "lta_compliance_costs_section", color: "#1a3a5c" },
	{ fieldname: "overhead_and_diesel_section", color: "#1a3a5c" },
	{ fieldname: "margins_and_notes_section", color: "#1a3a5c" },
	{ fieldname: "additional_compliance_items_section", color: "#1a3a5c" },
	{ fieldname: "total_section", color: "#1a3a5c" },
	{ fieldname: "concrete_hardness_section", color: "#e8a020" },
	{ fieldname: "coring_point_schedule_section", color: "#6f42c1" },
	{ fieldname: "equipment_mob_premiums_section", color: "#6f42c1" },
];

function style_section_headings(frm) {
	SECTION_HEADING_STYLES.forEach(({ fieldname, color }) => {
		style_section_heading(frm, fieldname, color);
	});
}

function style_section_heading(frm, fieldname, color) {
	const section = frm.fields_dict[fieldname];
	if (section && section.head) {
		section.head.css({
			"font-weight": "bold",
			color,
		});
	}
}

function style_concrete_hardness_checkboxes(frm) {
	CONCRETE_HARDNESS_FIELDS.forEach((fieldname) => {
		const field = frm.fields_dict[fieldname];
		if (field) {
			field.$wrapper.addClass("concrete-hardness-block");
		}
	});
	inject_concrete_hardness_style();
}

function inject_concrete_hardness_style() {
	if ($("#concrete-hardness-style").length) {
		return;
	}
	$("<style>")
		.attr("id", "concrete-hardness-style")
		.html(`
			.concrete-hardness-block {
				border: 1px solid var(--border-color, #d1d8dd);
				border-radius: 8px;
				padding: 10px 14px;
				cursor: pointer;
				transition: border-color 0.15s ease, background-color 0.15s ease;
			}
			.concrete-hardness-block .checkbox-label {
				margin: 0;
				cursor: pointer;
			}
			.concrete-hardness-block input[type="checkbox"] {
				width: 16px;
				height: 16px;
			}
			.concrete-hardness-block.concrete-hardness-block-active {
				border-color: #0a0f5e;
				background-color: rgba(10, 15, 94, 0.06);
			}
		`)
		.appendTo("head");
}

function bind_concrete_hardness_block_click(frm) {
	CONCRETE_HARDNESS_FIELDS.forEach((fieldname) => {
		const field = frm.fields_dict[fieldname];
		if (!field) {
			return;
		}
		field.$wrapper
			.off("click.concrete-hardness-block")
			.on("click.concrete-hardness-block", (e) => {
				if ($(e.target).is("input[type='checkbox']")) {
					return;
				}
				field.$input.prop("checked", true).trigger("change");
			});
	});
}

function enforce_concrete_hardness_exclusivity(frm, changed_fieldname) {
	if (!frm.doc[changed_fieldname]) {
		update_concrete_hardness_active_state(frm);
		return;
	}
	CONCRETE_HARDNESS_FIELDS.forEach((fieldname) => {
		if (fieldname !== changed_fieldname && frm.doc[fieldname]) {
			frm.set_value(fieldname, 0);
		}
	});
	update_concrete_hardness_active_state(frm);
}

function update_concrete_hardness_active_state(frm) {
	CONCRETE_HARDNESS_FIELDS.forEach((fieldname) => {
		const field = frm.fields_dict[fieldname];
		if (field) {
			field.$wrapper.toggleClass("concrete-hardness-block-active", !!frm.doc[fieldname]);
		}
	});
}
