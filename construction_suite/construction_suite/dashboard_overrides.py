# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

from frappe import _


def get_opportunity_dashboard_data(data=None):
	return {
		"fieldname": "opportunity",
		"non_standard_fieldnames": {
			"Project Planning": "client",
			"Bill of Quantities": "client",
		},
		"transactions": [
			{"label": _("Quotation"), "items": ["Quotation"]},
			{"label": _("Project Planning"), "items": ["Project Planning", "Bill of Quantities"]},
		],
	}


def get_quotation_dashboard_data(data=None):
	return {
		"fieldname": "prevdoc_docname",
		"transactions": [
			{"label": _("Sales Order"), "items": ["Sales Order"]},
		],
	}


def get_sales_order_dashboard_data(data=None):
	return {
		"fieldname": "sales_order",
		"non_standard_fieldnames": {
			"Payment Entry": "reference_name",
		},
		"internal_links": {
			"Quotation": ["items", "prevdoc_docname"],
		},
		"transactions": [
			{"label": _("Reference"), "items": ["Quotation"]},
			{"label": _("Fulfillment"), "items": ["Sales Invoice"]},
			{"label": _("Purchasing"), "items": ["Purchase Order"]},
			{"label": _("Projects"), "items": ["Project"]},
			{"label": _("Payment"), "items": ["Payment Entry"]},
		],
	}


def get_project_dashboard_data(data=None):
	return {
		"heatmap": True,
		"heatmap_message": _("This is based on the Time Sheets created against this project"),
		"fieldname": "project",
		"transactions": [
			{"label": _("Project"), "items": ["Task", "Timesheet", "Project Update"]},
			{"label": _("Sales"), "items": ["Sales Order", "Sales Invoice"]},
			{"label": _("Purchase"), "items": ["Purchase Order", "Purchase Invoice"]},
			{"label": _("Budget"), "items": ["Budget"]},
		],
	}

def get_po_dashboard_data(data=None):
	return {
		"fieldname": "purchase_order",
		"non_standard_fieldnames": {
			"Payment Entry": "reference_name",
		},
		"internal_links": {
			"Supplier Quotation": ["items", "supplier_quotation"],
			"Project": ["items", "project"],
		},
		"transactions": [
			{"label": _("Related"), "items": ["Purchase Invoice"]},
			{"label": _("Payment"), "items": ["Payment Entry"]},
			{
				"label": _("Reference"),
				"items": ["Supplier Quotation", "Project"],
			},
		],
	}

def get_pi_dashboard_data(data=None):
	return {
		"fieldname": "purchase_invoice",
		"non_standard_fieldnames": {
			"Payment Entry": "reference_name",
			"Purchase Invoice": "return_against",
		},
		"internal_links": {
			"Purchase Order": ["items", "purchase_order"],
		},
		"transactions": [
			{"label": _("Payment"), "items": ["Payment Entry"]},
			{
				"label": _("Reference"),
				"items": ["Purchase Order"],
			},
			{"label": _("Returns"), "items": ["Purchase Invoice"]},
		],
	}

def get_si_dashboard_data(data=None):
	return {
		"fieldname": "sales_invoice",
		"non_standard_fieldnames": {
			"Payment Entry": "reference_name",
			"Sales Invoice": "return_against",
		},
		"internal_links": {
			"Sales Order": ["items", "sales_order"],
		},
		"transactions": [
			{
				"label": _("Payment"),
				"items": [
					"Payment Entry"
				],
			},
			{"label": _("Reference"), "items": ["Sales Order"]},
			{"label": _("Returns"), "items": ["Sales Invoice"]},
		],
	}
