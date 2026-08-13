// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Planning", {
	refresh(frm) {
		if (frm.is_new()) {
			return;
		}
		frm.add_custom_button(
			__("Bill of Quantities"),
			() => create_boq_from_project_planning(frm),
			__("Create")
		);
	},
	project_planning_milestones_add(frm) {
		calculate_planned_total_days(frm);
	},
	project_planning_milestones_remove(frm) {
		calculate_planned_total_days(frm);
	},
});

frappe.ui.form.on("Project Planning Milestones", {
	start_date(frm, cdt, cdn) {
		calculate_milestone_row_days(frm, cdt, cdn);
	},
	end_date(frm, cdt, cdn) {
		calculate_milestone_row_days(frm, cdt, cdn);
	},
});

function calculate_milestone_row_days(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	if (row.start_date && row.end_date) {
		const days = frappe.datetime.get_diff(row.end_date, row.start_date) + 1;
		row.total_days = days > 0 ? days : 0;
	} else {
		row.total_days = 0;
	}
	frm.refresh_field("project_planning_milestones");
	calculate_planned_total_days(frm);
}

function calculate_planned_total_days(frm) {
	const milestones = frm.doc.project_planning_milestones || [];
	const start_dates = milestones.map((row) => row.start_date).filter(Boolean);
	const end_dates = milestones.map((row) => row.end_date).filter(Boolean);

	if (!start_dates.length || !end_dates.length) {
		frm.set_value("planned_total_days", 0);
		return;
	}

	const earliest_start = start_dates.reduce((min, date) => (date < min ? date : min));
	const latest_end = end_dates.reduce((max, date) => (date > max ? date : max));
	const total_days = frappe.datetime.get_diff(latest_end, earliest_start) + 1;
	frm.set_value("planned_total_days", total_days > 0 ? total_days : 0);
}

function create_boq_from_project_planning(frm) {
	frappe.new_doc("Bill of Quantities", null, (doc) => {
		doc.boq_for = frm.doc.boq_for;
		doc.client = frm.doc.client;
		doc.client_name = frm.doc.client_name;
		doc.customer = frm.doc.customer;
		doc.customer_name = frm.doc.customer_name;
		doc.company = frm.doc.company;
		doc.posting_date = frm.doc.posting_date;
		doc.project_reference = frm.doc.project_reference;
		doc.project_planning = frm.doc.name;
		doc.planned_total_days = frm.doc.planned_total_days;

		(frm.doc.project_planning_milestones || []).forEach((row) => {
			const child = frappe.model.add_child(doc, "Bill of Quantities Milestone", "milestones");
			child.milestone = row.milestone;
			child.start_date = row.start_date;
			child.end_date = row.end_date;
			child.total_days = row.total_days;
		});
	});
}
