// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

const CONCRETE_HARDNESS_FIELDS = ["normal", "reinforced", "high_grade", "pile_cap"];
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
		style_concrete_hardness_heading(frm);
		style_concrete_hardness_checkboxes(frm);
		bind_concrete_hardness_block_click(frm);
		update_concrete_hardness_active_state(frm);
	},
	add_machinery(frm) {
		open_machinery_dialog(frm);
	},
	add_manpower(frm) {
		open_manpower_dialog(frm);
	},
	normal(frm) {
		enforce_concrete_hardness_exclusivity(frm, "normal");
	},
	reinforced(frm) {
		enforce_concrete_hardness_exclusivity(frm, "reinforced");
	},
	high_grade(frm) {
		enforce_concrete_hardness_exclusivity(frm, "high_grade");
	},
	pile_cap(frm) {
		enforce_concrete_hardness_exclusivity(frm, "pile_cap");
	},
});

frappe.ui.form.on("Bill of Quantities Machinery Item", {
	qty(frm, cdt, cdn) {
		recalculate_machinery_row_amount(frm, cdt, cdn);
	},
	no_of_days(frm, cdt, cdn) {
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
}

frappe.ui.form.on("Bill of Quantities Manpower Item", {
	qty(frm, cdt, cdn) {
		recalculate_manpower_row_amount(frm, cdt, cdn);
	},
	no_of_days(frm, cdt, cdn) {
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
	row.amount = qty * rate * no_of_days;
	frm.refresh_field("manpower_list");
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
			row.no_of_days = 1;
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
			row.no_of_days = 1;
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

function style_concrete_hardness_heading(frm) {
	const section = frm.fields_dict.concrete_hardness_section;
	if (section && section.head) {
		section.head.css({
			"font-weight": "bold",
			"color": "#e8a020",
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
