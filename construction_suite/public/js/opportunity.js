// Copyright (c) 2026, Hardik Gadesha and contributors
// For license information, please see license.txt

frappe.ui.form.on("Opportunity", {
	refresh(frm) {
		hide_default_quotation_buttons(frm);

		if (frm.is_new()) {
			return;
		}
		frm.add_custom_button(
			__("Project Planning"),
			() => create_project_planning_from_opportunity(frm),
			__("Create")
		);
		frm.add_custom_button(
			__("Bill of Quantities"),
			() => create_boq_from_opportunity(frm),
			__("Create")
		);
	},
});

function hide_default_quotation_buttons(frm) {
	frm.remove_custom_button(__("Supplier Quotation"), __("Create"));
	frm.remove_custom_button(__("Request For Quotation"), __("Create"));
	frm.remove_custom_button(__("Quotation"), __("Create"));
}

function get_opportunity_client_name(frm) {
	return frm.doc.customer_name || frm.doc.title || frm.doc.party_name || "";
}

function create_project_planning_from_opportunity(frm) {
	frappe.new_doc("Project Planning", null, (doc) => {
		doc.boq_for = "Opportunity";
		doc.client = frm.doc.name;
		doc.client_name = get_opportunity_client_name(frm);
		doc.company = frm.doc.company;
		doc.project_reference = frm.doc.title || frm.doc.name;
	});
}

function create_boq_from_opportunity(frm) {
	frappe.new_doc("Bill of Quantities", null, (doc) => {
		doc.boq_for = "Opportunity";
		doc.client = frm.doc.name;
		doc.client_name = get_opportunity_client_name(frm);
		doc.company = frm.doc.company;
		doc.project_reference = frm.doc.title || frm.doc.name;
	});
}
